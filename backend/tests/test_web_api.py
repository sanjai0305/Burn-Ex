"""
Unit tests for FastAPI Web API endpoints.
"""

import os
import unittest
import httpx

# Patch httpx.Client.__init__ for Starlette TestClient / httpx 0.28+ compatibility
_orig_httpx_init = httpx.Client.__init__
def _compat_httpx_init(self, *args, **kwargs):
    app = kwargs.pop("app", None)
    if app is not None and "transport" not in kwargs:
        kwargs["transport"] = httpx.ASGITransport(app=app)
    _orig_httpx_init(self, *args, **kwargs)
httpx.Client.__init__ = _compat_httpx_init

from fastapi.testclient import TestClient
from db.database import init_db, reset_db_engine
from api import app


class TestWebAPI(unittest.TestCase):
    """Test FastAPI Web API routes and controllers."""

    @classmethod
    def setUpClass(cls):
        os.environ["ENV"] = "testing"
        os.environ["MYSQL_URL"] = "sqlite:///:memory:"
        reset_db_engine()
        init_db()

    def setUp(self) -> None:
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer mock-user-token-testuser"}

    def test_index_route(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"ok", response.content)

    def test_profile_api(self) -> None:
        # GET Profile
        res = self.client.get("/api/profile", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
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
            json=payload,
            headers=self.headers
        )
        self.assertEqual(res_post.status_code, 200)
        post_data = res_post.json()
        self.assertEqual(post_data["profile"]["name"], "Marcus Kane")
        self.assertEqual(post_data["profile"]["weight_kg"], 82.0)

    def test_telemetry_api(self) -> None:
        res = self.client.get("/api/telemetry")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("exercise_type", data)
        self.assertIn("total_reps", data)
        self.assertIn("form_score_pct", data)

    def test_history_and_export_api(self) -> None:
        # History API
        res_hist = self.client.get("/api/history", headers=self.headers)
        self.assertEqual(res_hist.status_code, 200)
        hist_data = res_hist.json()
        self.assertIn("sessions", hist_data)
        self.assertIn("stats", hist_data)

        # Export JSON
        res_json = self.client.get("/api/export?format=json", headers=self.headers)
        self.assertEqual(res_json.status_code, 200)

        # Export CSV
        res_csv = self.client.get("/api/export?format=csv", headers=self.headers)
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn("text/csv", res_csv.headers["content-type"])


if __name__ == "__main__":
    unittest.main()
