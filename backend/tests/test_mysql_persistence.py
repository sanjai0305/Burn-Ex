"""
backend/tests/test_mysql_persistence.py
Integration & unit tests for Burn-Ex MySQL / SQLAlchemy 2.x persistence layer.
Validates async sessions, models, constraints, idempotency, analytics aggregation, and rollback.
"""

import os
import unittest
import datetime
from sqlalchemy import select, func
from db.database import Base, get_engine, AsyncSessionLocal, init_db, close_db
from db.models import User, Workout, Leaderboard, AIPlan, OTPVerification
from db import user_repository


class TestMySQLPersistence(unittest.IsolatedAsyncioTestCase):

    @classmethod
    def setUpClass(cls):
        # Set environment to testing with SQLite async or local MySQL
        os.environ["ENV"] = "testing"
        os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

    async def asyncSetUp(self):
        engine = get_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def asyncTearDown(self):
        engine = get_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    # 1. User Profile Creation, Retrieval, and Updates
    async def test_user_crud_operations(self):
        async with AsyncSessionLocal() as session:
            # Create user
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
            inserted_uid = await user_repository.create_user(user_data, session=session)
            self.assertEqual(inserted_uid, uid)

            # Retrieve user
            user = await user_repository.find_user_by_uid(uid, session=session)
            self.assertIsNotNone(user)
            self.assertEqual(user["name"], "Sarah Connor")
            self.assertEqual(user["weight_kg"], 62.5)
            self.assertTrue(user["profile_completed"])

            # Update user
            updated = await user_repository.update_user(uid, {"weight_kg": 61.0, "fitness_goal": "endurance"}, session=session)
            self.assertTrue(updated)

            user_updated = await user_repository.find_user_by_uid(uid, session=session)
            self.assertEqual(user_updated["weight_kg"], 61.0)
            self.assertEqual(user_updated["fitness_goal"], "endurance")

    # 2. Mobile Uniqueness Checking
    async def test_mobile_uniqueness_checks(self):
        async with AsyncSessionLocal() as session:
            await user_repository.create_user({
                "firebase_uid": "user_mobile_1",
                "name": "User 1",
                "mobile_number": "+15559876543",
                "alternate_mobile_number": "+15559876544",
            }, session=session)

            # Same mobile for different user should be found
            dup_check = await user_repository.find_user_by_mobile("+15559876543", exclude_uid="user_mobile_2", session=session)
            self.assertIsNotNone(dup_check)

            # Same mobile for same user should be excluded
            self_check = await user_repository.find_user_by_mobile("+15559876543", exclude_uid="user_mobile_1", session=session)
            self.assertIsNone(self_check)

    # 3. Workout History Persistence & Idempotency
    async def test_workout_persistence_and_idempotency(self):
        async with AsyncSessionLocal() as session:
            uid = "athlete_workout_test"
            await user_repository.create_user({
                "firebase_uid": uid,
                "name": "Marcus Aurelius",
            }, session=session)

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

            # First save
            saved_id1 = await user_repository.save_workout_history(workout_doc, session=session)
            self.assertEqual(saved_id1, workout_id)

            # Second save with updated values (retry)
            workout_doc["calories_burned"] = 160.0
            saved_id2 = await user_repository.save_workout_history(workout_doc, session=session)
            self.assertEqual(saved_id2, workout_id)

            # Query workouts - must have exactly 1 record, not 2
            history = await user_repository.get_workout_history(uid, session=session)
            self.assertEqual(history["total"], 1)
            self.assertEqual(history["items"][0]["calories_burned"], 160.0)

    # 4. SQL-Level Analytics Aggregation
    async def test_calories_analytics_aggregation(self):
        async with AsyncSessionLocal() as session:
            uid = "analytics_user_001"
            await user_repository.create_user({"firebase_uid": uid, "name": "Analytic Runner"}, session=session)

            # Add multiple workouts on different dates
            workouts = [
                {"workout_id": "w1", "firebase_uid": uid, "exercise_type": "squat", "workout_date": "2026-10-01", "calories_burned": 100.0, "total_reps": 20, "valid_reps": 18, "form_accuracy_score": 90.0},
                {"workout_id": "w2", "firebase_uid": uid, "exercise_type": "pushup", "workout_date": "2026-10-01", "calories_burned": 50.0, "total_reps": 25, "valid_reps": 22, "form_accuracy_score": 88.0},
                {"workout_id": "w3", "firebase_uid": uid, "exercise_type": "lunge", "workout_date": "2026-10-02", "calories_burned": 150.0, "total_reps": 40, "valid_reps": 38, "form_accuracy_score": 95.0},
            ]
            for w in workouts:
                await user_repository.save_workout_history(w, session=session)

            # Get overall analytics
            analytics = await user_repository.get_calories_analytics(uid, session=session)
            self.assertEqual(analytics["totalCalories"], 300.0)
            self.assertEqual(analytics["workouts"], 3)
            self.assertEqual(analytics["totalReps"], 85)
            self.assertEqual(len(analytics["dailyBreakdown"]), 2)

            # Check daily breakdown aggregation
            day1 = next(d for d in analytics["dailyBreakdown"] if d["date"] == "2026-10-01")
            self.assertEqual(day1["calories"], 150.0)
            self.assertEqual(day1["workouts"], 2)
            self.assertEqual(day1["reps"], 45)

            # Filter by date range
            range_analytics = await user_repository.get_calories_analytics(uid, start_date="2026-10-02", end_date="2026-10-02", session=session)
            self.assertEqual(range_analytics["totalCalories"], 150.0)
            self.assertEqual(range_analytics["workouts"], 1)

    # 5. Leaderboard Rankings
    async def test_leaderboard_rankings(self):
        async with AsyncSessionLocal() as session:
            # Athlete 1
            await user_repository.create_user({"firebase_uid": "lb_user_1", "name": "Alice Champion"}, session=session)
            await user_repository.save_workout_history({"workout_id": "lb_w1", "firebase_uid": "lb_user_1", "exercise_type": "squat", "calories_burned": 500.0, "valid_reps": 100, "form_accuracy_score": 95.0}, session=session)

            # Athlete 2
            await user_repository.create_user({"firebase_uid": "lb_user_2", "name": "Bob Master"}, session=session)
            await user_repository.save_workout_history({"workout_id": "lb_w2", "firebase_uid": "lb_user_2", "exercise_type": "squat", "calories_burned": 800.0, "valid_reps": 150, "form_accuracy_score": 92.0}, session=session)

            leaderboard = await user_repository.get_leaderboard(limit=10, session=session)
            self.assertGreaterEqual(len(leaderboard), 2)
            # Bob should be #1 with 800 kcal
            self.assertEqual(leaderboard[0]["firebase_uid"], "lb_user_2")
            self.assertEqual(leaderboard[0]["total_kcal_burned"], 800.0)
            self.assertEqual(leaderboard[1]["firebase_uid"], "lb_user_1")
            self.assertEqual(leaderboard[1]["total_kcal_burned"], 500.0)

    # 6. Transaction Rollback Safety
    async def test_transaction_rollback_safety(self):
        async with AsyncSessionLocal() as session:
            try:
                user1 = User(firebase_uid="rollback_user_1", name="Rollback Tester 1")
                session.add(user1)
                await session.flush()

                # Attempt to insert duplicate user with same firebase_uid within transaction
                user2 = User(firebase_uid="rollback_user_1", name="Duplicate User")
                session.add(user2)
                await session.flush()
            except Exception:
                await session.rollback()

        # Check that session rollback left database clean
        async with AsyncSessionLocal() as session:
            res = await user_repository.find_user_by_uid("rollback_user_1", session=session)
            self.assertIsNone(res)


if __name__ == "__main__":
    unittest.main()
