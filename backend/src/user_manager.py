"""
backend/src/user_manager.py
User Profile & Workout History Management for Burn-Ex.

Previously used SQLite (data/workout_history.db) and JSON (data/user_profile.json).
All persistence is now routed through MySQL via the mysql_repository module.
SQLite and JSON file code has been removed.
"""

import datetime
from typing import Dict, Any, List, Optional

from src.config import DEFAULT_USER_WEIGHT_KG


class UserManager:
    """
    Manages athlete profile persistence and historical workout session logging.
    All data is persisted in MySQL via mysql_repository.
    """

    def __init__(self, firebase_uid: Optional[str] = None, *args, **kwargs) -> None:
        self.firebase_uid = firebase_uid or "local_session"

    # ------------------------------------------------------------------
    # Profile helpers — used by the local (non-authenticated) biomechanics
    # engine as a lightweight local context.  For authenticated sessions
    # the full profile is managed by the API layer via mysql_repository.
    # ------------------------------------------------------------------

    def get_profile(self) -> Dict[str, Any]:
        """Load athlete profile from MySQL or return calibrated defaults."""
        if self.firebase_uid and self.firebase_uid != "local_session":
            try:
                from db.mysql_repository import find_user_by_uid
                profile = find_user_by_uid(self.firebase_uid)
                if profile:
                    return {
                        "name": profile.get("name", "Athlete"),
                        "weight_kg": float(profile.get("weight_kg") or DEFAULT_USER_WEIGHT_KG),
                        "height_cm": float(profile.get("height_cm") or 175.0),
                        "age": int(profile.get("age") or 25),
                        "gender": str(profile.get("gender") or "male"),
                        "fitness_goal": str(profile.get("fitness_goal") or "fat_loss"),
                        "updated_at": profile.get("updated_at") or datetime.datetime.now().isoformat(),
                    }
            except Exception as e:
                print(f"[UserManager] Profile fetch warning: {e}")

        return self._default_profile()

    def _default_profile(self) -> Dict[str, Any]:
        return {
            "name": "Athlete",
            "weight_kg": DEFAULT_USER_WEIGHT_KG,
            "height_cm": 175.0,
            "age": 25,
            "gender": "male",
            "fitness_goal": "fat_loss",
            "updated_at": datetime.datetime.now().isoformat(),
        }

    def save_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save athlete profile to MySQL."""
        profile: Dict[str, Any] = {
            "name": str(profile_data.get("name", "Athlete")).strip() or "Athlete",
            "weight_kg": float(profile_data.get("weight_kg", DEFAULT_USER_WEIGHT_KG)),
            "height_cm": float(profile_data.get("height_cm", 175.0)),
            "age": int(profile_data.get("age", 25)),
            "gender": str(profile_data.get("gender", "male")),
            "fitness_goal": str(profile_data.get("fitness_goal", "fat_loss")),
        }
        if self.firebase_uid and self.firebase_uid != "local_session":
            try:
                from db.mysql_repository import upsert_user
                upsert_user(self.firebase_uid, profile)
            except Exception as e:
                print(f"[UserManager] Profile save warning: {e}")
        return profile

    # ------------------------------------------------------------------
    # Session recording — replaces SQLite workout_sessions table
    # ------------------------------------------------------------------

    def record_session(
        self,
        exercise_type: str,
        exercise_name: str,
        duration_sec: float,
        total_reps: int,
        valid_reps: int,
        invalid_reps: int,
        valid_rep_ratio: float,
        avg_rom_deg: float,
        rep_velocity: float,
        form_score_pct: float,
        predicted_kcal: tuple,
        rep_rom_history: Optional[List[float]] = None,
    ) -> int:
        """
        Record a completed workout session in MySQL.
        Returns the inserted session ID.
        """
        lower_kcal, point_kcal, upper_kcal = predicted_kcal
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        session_data = {
            "timestamp": timestamp,
            "exercise_type": exercise_type,
            "exercise_name": exercise_name,
            "duration_sec": round(duration_sec, 2),
            "total_reps": total_reps,
            "valid_reps": valid_reps,
            "invalid_reps": invalid_reps,
            "valid_rep_ratio": round(valid_rep_ratio, 3),
            "avg_rom_deg": round(avg_rom_deg, 2),
            "rep_velocity": round(rep_velocity, 2),
            "form_score_pct": round(form_score_pct, 1),
            "kcal_lower": round(lower_kcal, 2),
            "kcal_point": round(point_kcal, 2),
            "kcal_upper": round(upper_kcal, 2),
            "rep_rom_data": rep_rom_history or [],
        }

        try:
            from db.mysql_repository import save_workout_session
            return save_workout_session(self.firebase_uid, session_data)
        except Exception as e:
            print(f"[UserManager] Session record error: {e}")
            return -1

    def get_recent_sessions(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieve recent workout session records from MySQL."""
        try:
            from db.mysql_repository import get_all_sessions_for_user
            sessions = get_all_sessions_for_user(self.firebase_uid)
            return sessions[:limit]
        except Exception as e:
            print(f"[UserManager] Get sessions error: {e}")
            return []

    def get_aggregate_stats(self) -> Dict[str, Any]:
        """Compute all-time workout stats from MySQL."""
        try:
            from db.mysql_repository import get_calories_analytics
            analytics = get_calories_analytics(self.firebase_uid)
            sessions = self.get_recent_sessions(limit=1000)
            total_reps = sum(int(s.get("total_reps", 0)) for s in sessions)
            total_dur = sum(float(s.get("duration_sec", 0.0)) for s in sessions)
            avg_form = (
                sum(float(s.get("form_score_pct", 100.0)) for s in sessions) / len(sessions)
                if sessions else 100.0
            )
            total_kcal = analytics.get("totalCalories", 0.0) or sum(float(s.get("kcal_point", 0.0)) for s in sessions)
            return {
                "total_workouts": analytics.get("workouts") or len(sessions),
                "total_reps": total_reps,
                "total_duration_sec": total_dur,
                "total_kcal_point": total_kcal,
                "avg_form_score": round(avg_form, 1),
            }
        except Exception as e:
            print(f"[UserManager] Aggregate stats error: {e}")
            return {
                "total_workouts": 0,
                "total_reps": 0,
                "total_duration_sec": 0.0,
                "total_kcal_point": 0.0,
                "avg_form_score": 100.0,
            }
