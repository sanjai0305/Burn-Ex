"""
backend/db/database.py
SQLAlchemy 2.x synchronous engine, session factory, and DeclarativeBase for MySQL.

Configuration is read from the MYSQL_URL environment variable.
The application will fail clearly on startup if MYSQL_URL is missing or MySQL
is unreachable — there is NO silent fallback to any other database.
"""

import os
import sys
from pathlib import Path
from contextlib import contextmanager
from typing import Generator

# Ensure backend directory is in sys.path for db package resolution
_backend_dir = str(Path(__file__).resolve().parent.parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from sqlalchemy.exc import OperationalError

# ---------------------------------------------------------------------------
# 1.  DeclarativeBase — imported by models.py as `from db.database import Base`
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# 2.  Build the MySQL URL from environment
# ---------------------------------------------------------------------------

def _get_mysql_url() -> str:
    """
    Read MYSQL_URL from backend/.env or root .env file.
    Always refresh environment variables from .env to prevent stale process cache.
    """
    if os.environ.get("ENV") == "testing" or os.environ.get("MYSQL_URL", "").startswith("sqlite"):
        return os.environ.get("MYSQL_URL", "sqlite:///:memory:")

    possible_env_paths = [
        Path(__file__).resolve().parent.parent / ".env",          # backend/.env
        Path(__file__).resolve().parent.parent.parent / ".env",   # root .env
    ]
    for env_path in possible_env_paths:
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        key = k.strip()
                        val = v.strip()
                        if key == "MYSQL_URL" and not os.environ.get("MYSQL_URL_OVERRIDE"):
                            os.environ["MYSQL_URL"] = val

    url = os.environ.get("MYSQL_URL", "")
    if not url:
        raise RuntimeError(
            "[BurnEx DB] FATAL: MYSQL_URL environment variable is not set.\n"
            "Set it in backend/.env or as a system environment variable, e.g.:\n"
            "  MYSQL_URL=mysql+pymysql://burnex:secret@127.0.0.1:3306/burnex_db\n"
            "The application cannot start without a MySQL connection."
        )
    if "USERNAME:PASSWORD" in url or "YOUR_" in url or "PLACEHOLDER" in url:
        raise RuntimeError(
            "[BurnEx DB] FATAL: MYSQL_URL still contains placeholder values.\n"
            "Replace them with real MySQL credentials before starting the application."
        )
    return url


# ---------------------------------------------------------------------------
# 3.  Engine and SessionLocal — created lazily so that the module can be
#     imported during testing without immediately opening a connection.
# ---------------------------------------------------------------------------

_engine = None
_SessionLocal = None


def reset_db_engine():
    """Reset the global engine and session factory to allow URL switching during tests."""
    global _engine, _SessionLocal
    if _engine is not None:
        try:
            _engine.dispose()
        except Exception:
            pass
    _engine = None
    _SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        mysql_url = _get_mysql_url()
        engine_kwargs = {
            "echo": os.environ.get("DB_ECHO", "false").lower() == "true",
        }
        if mysql_url.startswith("sqlite"):
            from sqlalchemy.pool import StaticPool
            engine_kwargs.update({
                "connect_args": {"check_same_thread": False},
                "poolclass": StaticPool,
            })
        else:
            engine_kwargs.update({
                "pool_pre_ping": True,
                "pool_recycle": 1800,
                "pool_size": 10,
                "max_overflow": 20,
            })

        engine = create_engine(mysql_url, **engine_kwargs)
        # Verify connectivity immediately
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            _engine = engine
            print(f"[BurnEx DB] MySQL connected successfully.")
        except Exception as exc:
            _engine = None
            print(f"[BurnEx DB] WARNING: Cannot connect to MySQL: {exc}", file=sys.stderr)
            raise RuntimeError(
                f"[BurnEx DB] MySQL is unreachable. Check MYSQL_URL and that the MySQL "
                f"server is running.\nOriginal error: {exc}"
            ) from exc
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(),
            autocommit=False,
            autoflush=False,
        )
    return _SessionLocal


# ---------------------------------------------------------------------------
# 4.  Dependency — use in FastAPI route handlers
# ---------------------------------------------------------------------------

def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and always closes it."""
    SessionLocal = get_session_factory()
    db: Session = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# Plain context manager for non-FastAPI usage (scripts, background threads)
@contextmanager
def db_session() -> Generator[Session, None, None]:
    """Context manager version of get_db for use outside FastAPI route handlers."""
    SessionLocal = get_session_factory()
    db: Session = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 5.  Table initializer — call once on startup
# ---------------------------------------------------------------------------

def init_db():
    """
    Create all tables defined in the SQLAlchemy models if they do not
    already exist.  This is safe to call on every startup (idempotent).
    Import models BEFORE calling this so that Base.metadata is populated.
    """
    try:
        from db import models  # noqa: F401
    except ImportError:
        from backend.db import models  # noqa: F401
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    print("[BurnEx DB] Database tables verified / created successfully.")
