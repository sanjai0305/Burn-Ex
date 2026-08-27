"""
Unit tests for Flask Web API endpoints.
"""

import unittest
import json
from app import app


class TestWebAPI(unittest.TestCase):
    """Test Flask Web API routes and controllers."""

    def setUp(self) -> None:
        self.client = app.test_client()

    def test_index_route(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"BURN-EX", response.data)

    def test_profile_api(self) -> None:
        # GET Profile
        res = self.client.get("/api/profile")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "success")

        # POST Profile
        payload = {
            "name": "Marcus Kane",
            "weight_kg": 82.0,
            "height_cm": 182.0,
            "age": 30,
            "gender": "male",
            "fitness_goal": "hypertrophy",
        }
        res_post = self.client.post(
            "/api/profile",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(res_post.status_code, 200)
        post_data = json.loads(res_post.data)
        self.assertEqual(post_data["profile"]["name"], "Marcus Kane")
        self.assertEqual(post_data["profile"]["weight_kg"], 82.0)

    def test_telemetry_api(self) -> None:
        res = self.client.get("/api/telemetry")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertIn("exercise_type", data)
        self.assertIn("total_reps", data)
        self.assertIn("form_score_pct", data)
        self.assertIn("burn_rate_kcal_min", data)

    def test_workout_lifecycle(self) -> None:
        # Start workout
        res_start = self.client.post(
            "/api/workout/start",
            data=json.dumps({"exercise": "squat"}),
            content_type="application/json",
        )
        self.assertEqual(res_start.status_code, 200)
        start_data = json.loads(res_start.data)
        self.assertEqual(start_data["exercise"], "squat")

        # Toggle pause
        res_pause = self.client.post("/api/workout/pause")
        self.assertEqual(res_pause.status_code, 200)
        pause_data = json.loads(res_pause.data)
        self.assertIn("is_paused", pause_data)

        # Reset workout
        res_reset = self.client.post("/api/workout/reset")
        self.assertEqual(res_reset.status_code, 200)
        reset_data = json.loads(res_reset.data)
        self.assertEqual(reset_data["status"], "success")

        # End workout
        res_end = self.client.post("/api/workout/end")
        self.assertEqual(res_end.status_code, 200)
        end_data = json.loads(res_end.data)
        self.assertEqual(end_data["status"], "success")
        self.assertIn("summary", end_data)
        self.assertIn("kcal_point", end_data["summary"])

    def test_history_and_export_api(self) -> None:
        # History API
        res_hist = self.client.get("/api/history")
        self.assertEqual(res_hist.status_code, 200)
        hist_data = json.loads(res_hist.data)
        self.assertIn("sessions", hist_data)
        self.assertIn("stats", hist_data)

        # Export JSON
        res_json = self.client.get("/api/export?format=json")
        self.assertEqual(res_json.status_code, 200)

        # Export CSV
        res_csv = self.client.get("/api/export?format=csv")
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn("text/csv", res_csv.content_type)


if __name__ == "__main__":
    unittest.main()
