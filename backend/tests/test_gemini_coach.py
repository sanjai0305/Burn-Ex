"""
Unit tests for Gemini AI Coach error handling, exponential backoff retries,
HTTP status codes, and atomic credit protection.
"""

import os
import unittest
from unittest.mock import patch, MagicMock
import httpx

# Compatibility patch for Starlette TestClient with httpx 0.28+
_orig_httpx_init = httpx.Client.__init__
def _compat_httpx_init(self, *args, **kwargs):
    app = kwargs.pop("app", None)
    if app is not None and "transport" not in kwargs:
        kwargs["transport"] = httpx.ASGITransport(app=app)
    _orig_httpx_init(self, *args, **kwargs)
httpx.Client.__init__ = _compat_httpx_init

from fastapi.testclient import TestClient
from db.database import init_db, reset_db_engine
from db.models import AICredits
from db.database import db_session
from api import app


class TestGeminiAICoach(unittest.TestCase):
    """Test AI Coach endpoint robustness, credit safety, and Gemini error handling."""

    @classmethod
    def setUpClass(cls):
        os.environ["ENV"] = "testing"
        os.environ["MYSQL_URL"] = "sqlite:///:memory:"
        os.environ["GEMINI_API_KEY"] = "test-fake-gemini-key"
        os.environ["GEMINI_MAX_RETRIES"] = "2"
        os.environ["GEMINI_INITIAL_BACKOFF_SEC"] = "0.01"
        os.environ["GEMINI_TIMEOUT_SEC"] = "1.0"
        reset_db_engine()
        init_db()

    def setUp(self) -> None:
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer mock-user-token-testuser-coach"}
        # Reset credits for testuser-coach
        with db_session() as db:
            credits = db.query(AICredits).filter_by(firebase_uid="testuser-coach").first()
            if credits:
                credits.used_today = 0
                db.commit()

    def _get_credits_used(self, uid: str = "testuser-coach") -> int:
        with db_session() as db:
            credits = db.query(AICredits).filter_by(firebase_uid=uid).first()
            return credits.used_today if credits else 0

    @patch("requests.post")
    def test_1_successful_gemini_response(self, mock_post):
        """1 & 8. Successful generation deducts credit exactly once and returns HTTP 200."""
        initial_used = self._get_credits_used()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{"text": "Keep up the great posture and maintain your rep pace!"}]
                }
            }]
        }
        mock_post.return_value = mock_resp

        res = self.client.post(
            "/api/ai/coach",
            json={"message": "How is my workout form?"},
            headers=self.headers
        )

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("Keep up the great posture", data["reply"])
        self.assertEqual(self._get_credits_used(), initial_used + 1)

    @patch("time.sleep", return_value=None)
    @patch("requests.post")
    def test_2_one_503_then_success_retry(self, mock_post, mock_sleep):
        """2. Transient 503 on 1st attempt succeeded by 200 on retry deducts credit once."""
        initial_used = self._get_credits_used()

        mock_503 = MagicMock()
        mock_503.status_code = 503
        mock_503.text = "Service Unavailable"

        mock_200 = MagicMock()
        mock_200.status_code = 200
        mock_200.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{"text": "Recovered response after transient retry."}]
                }
            }]
        }
        mock_post.side_effect = [mock_503, mock_200]

        res = self.client.post(
            "/api/ai/coach",
            json={"message": "Give me a nutrition tip."},
            headers=self.headers
        )

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("Recovered response", data["reply"])
        self.assertEqual(self._get_credits_used(), initial_used + 1)

    @patch("time.sleep", return_value=None)
    @patch("requests.post")
    def test_3_repeated_503_failures_exhausted(self, mock_post, mock_sleep):
        """3 & 7. Repeated 503 failures return HTTP 503 and DO NOT deduct credit."""
        initial_used = self._get_credits_used()

        mock_503 = MagicMock()
        mock_503.status_code = 503
        mock_503.text = "Service Unavailable High Load"
        mock_post.return_value = mock_503

        res = self.client.post(
            "/api/ai/coach",
            json={"message": "Can you analyze my squat reps?"},
            headers=self.headers
        )

        self.assertEqual(res.status_code, 503)
        data = res.json()
        self.assertIn("detail", data)
        self.assertEqual(data["detail"]["error_code"], "GEMINI_UNAVAILABLE")
        self.assertEqual(self._get_credits_used(), initial_used)

    @patch("time.sleep", return_value=None)
    @patch("requests.post")
    def test_4_http_429_rate_limit(self, mock_post, mock_sleep):
        """4. Upstream 429 returns HTTP 429 and 0 credits deducted."""
        initial_used = self._get_credits_used()

        mock_429 = MagicMock()
        mock_429.status_code = 429
        mock_429.text = "RESOURCE_EXHAUSTED"
        mock_post.return_value = mock_429

        res = self.client.post(
            "/api/ai/coach",
            json={"message": "Check my calorie burn."},
            headers=self.headers
        )

        self.assertEqual(res.status_code, 429)
        data = res.json()
        self.assertEqual(data["detail"]["error_code"], "GEMINI_RATE_LIMITED")
        self.assertEqual(self._get_credits_used(), initial_used)

    @patch("time.sleep", return_value=None)
    @patch("requests.post")
    def test_5_upstream_timeout_error(self, mock_post, mock_sleep):
        """5. Request timeout returns HTTP 504 and 0 credits deducted."""
        import requests
        initial_used = self._get_credits_used()

        mock_post.side_effect = requests.Timeout("Read timed out")

        res = self.client.post(
            "/api/ai/coach",
            json={"message": "Suggest a workout routine."},
            headers=self.headers
        )

        self.assertEqual(res.status_code, 504)
        data = res.json()
        self.assertEqual(data["detail"]["error_code"], "GEMINI_TIMEOUT")
        self.assertEqual(self._get_credits_used(), initial_used)

    @patch("requests.post")
    def test_6_invalid_api_response_format(self, mock_post):
        """6. Invalid JSON response returns HTTP 502 and 0 credits deducted."""
        initial_used = self._get_credits_used()

        mock_200_bad = MagicMock()
        mock_200_bad.status_code = 200
        mock_200_bad.json.return_value = {"invalid": "structure"}
        mock_post.return_value = mock_200_bad

        res = self.client.post(
            "/api/ai/coach",
            json={"message": "Help me plan breakfast."},
            headers=self.headers
        )

        self.assertEqual(res.status_code, 502)
        data = res.json()
        self.assertEqual(data["detail"]["error_code"], "GEMINI_INVALID_RESPONSE")
        self.assertEqual(self._get_credits_used(), initial_used)

    def test_9_credit_limit_exhaustion(self):
        """9. User with 5 used credits gets status: exhausted without calling Gemini."""
        with db_session() as db:
            credits = db.query(AICredits).filter_by(firebase_uid="testuser-coach").first()
            if not credits:
                credits = AICredits(firebase_uid="testuser-coach", used_today=5)
                db.add(credits)
            else:
                credits.used_today = 5
            db.commit()

        res = self.client.post(
            "/api/ai/coach",
            json={"message": "Another question."},
            headers=self.headers
        )

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "exhausted")
        self.assertTrue(data["exhausted"])
        self.assertEqual(data["credits_remaining"], 0)


if __name__ == "__main__":
    unittest.main()
