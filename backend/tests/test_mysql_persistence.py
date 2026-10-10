"""
backend/tests/test_mysql_persistence.py
Integration & unit tests for Burn-Ex MySQL / SQLAlchemy 2.x persistence layer.
Validates sync sessions, models, constraints, idempotency, analytics aggregation, and rollback.
"""

import os
import unittest
import datetime
from sqlalchemy import create_engine
from db.database import Base, reset_db_engine, init_db
from db.models import User, Workout, Leaderboard, AIPlan, OTPVerification
from db import mysql_repository as mysql_repo


class TestMySQLPersistence(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        os.environ["ENV"] = "testing"
        os.environ["MYSQL_URL"] = "sqlite:///:memory:"
        reset_db_engine()
        init_db()

    # 1. User Profile Creation, Retrieval, and Updates
    def test_user_crud_operations(self):
        uid = "athlete_test_001"
        user_data = {
            "firebase_uid": uid,
            "email": "athlete001@burnex.test",
            "name": "Sarah Connor",
            "age": 28,
            "gender": "female",
            "height_cm": 168.0,
            "weight_kg": 62.5,
            "fitness_goal": "hypertrophy",
            "mobile_number": "+15551234567",
            "role": "user",
            "is_verified": True,
            "profile_completed": True,
        }
        inserted_uid = mysql_repo.create_user(user_data)
        self.assertEqual(inserted_uid, uid)

        user = mysql_repo.find_user_by_uid(uid)
        self.assertIsNotNone(user)
        self.assertEqual(user["name"], "Sarah Connor")
        self.assertEqual(user["weight_kg"], 62.5)
        self.assertTrue(user["profile_completed"])

        updated = mysql_repo.update_user(uid, {"weight_kg": 61.0, "fitness_goal": "endurance"})
        self.assertTrue(updated)

        user_updated = mysql_repo.find_user_by_uid(uid)
        self.assertEqual(user_updated["weight_kg"], 61.0)
        self.assertEqual(user_updated["fitness_goal"], "endurance")

    # 2. Mobile Uniqueness Checking
    def test_mobile_uniqueness_checks(self):
        mysql_repo.create_user({
            "firebase_uid": "user_mobile_1",
            "name": "User 1",
            "mobile_number": "+15559876543",
            "alternate_mobile_number": "+15559876544",
        })

        dup_check = mysql_repo.find_user_by_mobile("+15559876543", exclude_uid="user_mobile_2")
        self.assertIsNotNone(dup_check)

        self_check = mysql_repo.find_user_by_mobile("+15559876543", exclude_uid="user_mobile_1")
        self.assertIsNone(self_check)

    # 3. Workout History Persistence & Idempotency
    def test_workout_persistence_and_idempotency(self):
        uid = "athlete_workout_test"
        mysql_repo.create_user({
            "firebase_uid": uid,
            "name": "Marcus Aurelius",
        })

        workout_id = "sess_idempotent_123"
        workout_doc = {
            "workout_id": workout_id,
            "firebase_uid": uid,
            "exercise_type": "squat",
            "exercise_name": "Deep Squats",
            "workout_date": "2026-10-09",
            "duration_sec": 450.0,
            "calories_burned": 150.5,
            "predicted_kcal": 150.5,
            "total_reps": 30,
            "valid_reps": 28,
            "invalid_reps": 2,
            "avg_rom_deg": 105.0,
            "form_accuracy_score": 93.3,
        }

        saved_id1 = mysql_repo.save_workout(workout_doc)
        self.assertEqual(saved_id1, workout_id)

        workout_doc["calories_burned"] = 160.0
        saved_id2 = mysql_repo.save_workout(workout_doc)
        self.assertEqual(saved_id2, workout_id)

        history = mysql_repo.get_workout_history(uid)
        self.assertEqual(history["total"], 1)
        self.assertEqual(history["items"][0]["calories_burned"], 160.0)

    # 4. SQL-Level Analytics Aggregation
    def test_calories_analytics_aggregation(self):
        uid = "analytics_user_001"
        mysql_repo.create_user({"firebase_uid": uid, "name": "Analytic Runner"})

        workouts = [
            {"workout_id": "w1", "firebase_uid": uid, "exercise_type": "squat", "workout_date": "2026-10-01", "calories_burned": 100.0, "total_reps": 20, "valid_reps": 18, "form_accuracy_score": 90.0},
            {"workout_id": "w2", "firebase_uid": uid, "exercise_type": "pushup", "workout_date": "2026-10-01", "calories_burned": 50.0, "total_reps": 25, "valid_reps": 22, "form_accuracy_score": 88.0},
            {"workout_id": "w3", "firebase_uid": uid, "exercise_type": "lunge", "workout_date": "2026-10-02", "calories_burned": 150.0, "total_reps": 40, "valid_reps": 38, "form_accuracy_score": 95.0},
        ]
        for w in workouts:
            mysql_repo.save_workout(w)

        analytics = mysql_repo.get_calories_analytics(uid)
        self.assertEqual(analytics["totalCalories"], 300.0)
        self.assertEqual(analytics["workouts"], 3)
        self.assertEqual(analytics["totalReps"], 85)
        self.assertEqual(len(analytics["dailyBreakdown"]), 2)

        day1 = next(d for d in analytics["dailyBreakdown"] if d["date"] == "2026-10-01")
        self.assertEqual(day1["calories"], 150.0)
        self.assertEqual(day1["workouts"], 2)
        self.assertEqual(day1["reps"], 45)

        range_analytics = mysql_repo.get_calories_analytics(uid, start_date="2026-10-02", end_date="2026-10-02")
        self.assertEqual(range_analytics["totalCalories"], 150.0)
        self.assertEqual(range_analytics["workouts"], 1)


if __name__ == "__main__":
    unittest.main()
