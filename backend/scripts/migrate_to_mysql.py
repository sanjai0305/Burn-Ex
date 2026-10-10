"""
backend/scripts/migrate_to_mysql.py
Migration script to transfer historical data from JSON files and SQLite databases into MySQL.
Reads:
- backend/data/users.json
- backend/data/ai_plans.json
- backend/data/notifications.json
- backend/data/leaderboard.db (SQLite)
Inserts/upserts records into MySQL via SQLAlchemy.
"""

import os
import sys
import json
import sqlite3
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from db.database import init_db
import db.mysql_repository as mysql_repo


def migrate_all():
    print("[Migration] Initialising MySQL database schema...")
    try:
        init_db()
    except Exception as e:
        print(f"[Migration] ERROR: Cannot connect to MySQL: {e}")
        print("[Migration] Please ensure MYSQL_URL is set in backend/.env and MySQL service is running.")
        sys.exit(1)

    data_dir = backend_dir / "data"

    # 1. Migrate Users from users.json
    users_file = data_dir / "users.json"
    if users_file.exists():
        try:
            with open(users_file, "r", encoding="utf-8") as f:
                users_data = json.load(f)
            count = 0
            for uid, user_doc in users_data.items():
                mysql_repo.upsert_user(uid, user_doc)
                count += 1
            print(f"[Migration] Successfully migrated {count} users from users.json to MySQL.")
        except Exception as e:
            print(f"[Migration] Warning migrating users.json: {e}")

    # 2. Migrate AI Plans from ai_plans.json
    plans_file = data_dir / "ai_plans.json"
    if plans_file.exists():
        try:
            with open(plans_file, "r", encoding="utf-8") as f:
                plans_data = json.load(f)
            count = 0
            for uid, plan_doc in plans_data.items():
                mysql_repo.set_ai_plan(uid, plan_doc)
                count += 1
            print(f"[Migration] Successfully migrated {count} AI plans from ai_plans.json to MySQL.")
        except Exception as e:
            print(f"[Migration] Warning migrating ai_plans.json: {e}")

    # 3. Migrate Notifications from notifications.json
    notifs_file = data_dir / "notifications.json"
    if notifs_file.exists():
        try:
            with open(notifs_file, "r", encoding="utf-8") as f:
                notifs_data = json.load(f)
            count = 0
            for uid, user_notifs in notifs_data.items():
                items = user_notifs.get("items", []) if isinstance(user_notifs, dict) else user_notifs
                for item in items:
                    mysql_repo.add_notification(uid, item)
                    count += 1
            print(f"[Migration] Successfully migrated {count} notifications from notifications.json to MySQL.")
        except Exception as e:
            print(f"[Migration] Warning migrating notifications.json: {e}")

    # 4. Migrate Leaderboard from SQLite leaderboard.db
    leaderboard_file = data_dir / "leaderboard.db"
    if leaderboard_file.exists():
        try:
            conn = sqlite3.connect(str(leaderboard_file))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='leaderboard'")
            if cursor.fetchone():
                cursor.execute("SELECT * FROM leaderboard")
                rows = cursor.fetchall()
                count = 0
                for r in rows:
                    row_dict = dict(r)
                    mysql_repo.update_leaderboard(
                        athlete_alias=row_dict.get("athlete_alias", "Athlete"),
                        kcal_burned=float(row_dict.get("kcal_burned", 0.0)),
                        form_score=float(row_dict.get("form_score", 100.0)),
                        valid_reps=int(row_dict.get("valid_reps", 0)),
                        firebase_uid=row_dict.get("firebase_uid") or row_dict.get("athlete_alias")
                    )
                    count += 1
                print(f"[Migration] Successfully migrated {count} leaderboard entries from SQLite leaderboard.db to MySQL.")
            conn.close()
        except Exception as e:
            print(f"[Migration] Warning migrating leaderboard.db: {e}")

    print("[Migration] Migration complete!")


if __name__ == "__main__":
    migrate_all()
