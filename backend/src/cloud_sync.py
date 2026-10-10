"""
backend/src/cloud_sync.py
Leaderboard and session sync using MySQL as the sole database.

All Firestore and SQLite code has been removed.
MySQL is the single source of truth for leaderboard data.
"""

import datetime
import threading
from typing import Dict, List, Any, Optional

# No Firestore. No SQLite. MySQL only.
db_client = None  # Retained as None so that api.py imports don't break


def push_session_data(
    athlete_alias: str,
    kcal_burned: float,
    form_score: float,
    valid_reps: int,
    firebase_uid: Optional[str] = None,
) -> None:
    """
    Asynchronously update the MySQL leaderboard for a completed workout session.
    Never blocks the caller.
    """
    t = threading.Thread(
        target=_background_leaderboard_update,
        args=(athlete_alias, kcal_burned, form_score, valid_reps, firebase_uid),
        daemon=True,
    )
    t.start()


def _background_leaderboard_update(
    athlete_alias: str,
    kcal_burned: float,
    form_score: float,
    valid_reps: int,
    firebase_uid: Optional[str],
) -> None:
    try:
        from db.mysql_repository import update_leaderboard
        uid = firebase_uid or athlete_alias  # fall back to alias if no UID
        update_leaderboard(
            firebase_uid=uid,
            athlete_alias=athlete_alias,
            kcal_burned=kcal_burned,
            form_score=form_score,
            valid_reps=valid_reps,
        )
    except Exception as e:
        print(f"[BurnEx Leaderboard] Background update error: {e}")


def get_leaderboard_data() -> List[Dict[str, Any]]:
    """
    Retrieve top 10 athletes ranked by total calories burned from MySQL.
    """
    try:
        from db.mysql_repository import get_leaderboard_data as mysql_lb
        return mysql_lb()
    except Exception as e:
        print(f"[BurnEx Leaderboard] MySQL fetch error: {e}")
        return []
