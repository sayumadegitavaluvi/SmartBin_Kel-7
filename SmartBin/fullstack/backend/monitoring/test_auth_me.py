from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIClient

from .supabase_jwt_auth import SupabasePrincipal
from .role_service import RoleLookupError


class AuthMeTests(SimpleTestCase):

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/auth/me/"

    def test_without_token_rejected(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)

    @patch(
        "monitoring.auth_views.get_internal_role",
        return_value=None,
    )
    @patch(
        "monitoring.supabase_jwt_auth.verify_supabase_token"
    )
    def test_valid_mocked_token(self, mock_verify, mock_role):
        user_id = "00000000-0000-4000-8000-000000000001"

        mock_verify.return_value = (
            SupabasePrincipal(
                user_id=user_id,
                email="penguji@example.invalid",
            ),
            {"sub": user_id},
        )

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION="Bearer test-local",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["authenticated"])
        self.assertEqual(response.data["user_id"], user_id)
        self.assertIsNone(response.data["internal_role"])
        mock_role.assert_called_once_with(user_id)
        self.assertEqual(
            response["Cache-Control"],
            "no-store",
        )

    @patch(
        "monitoring.supabase_jwt_auth.verify_supabase_token"
    )
    def test_invalid_mocked_token(self, mock_verify):
        mock_verify.side_effect = AuthenticationFailed(
            "Token tidak valid."
        )

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION="Bearer token-salah",
        )

        self.assertEqual(response.status_code, 401)

    @patch(
        "monitoring.auth_views.get_internal_role",
        return_value="petugas",
    )
    @patch(
        "monitoring.supabase_jwt_auth.verify_supabase_token"
    )
    def test_valid_token_with_role(self, mock_verify, mock_role):
        user_id = "00000000-0000-4000-8000-000000000002"

        mock_verify.return_value = (
            SupabasePrincipal(
                user_id=user_id,
                email="petugas@example.invalid",
            ),
            {"sub": user_id},
        )

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION="Bearer test-role",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["internal_role"],
            "petugas",
        )
        mock_role.assert_called_once_with(user_id)

    @patch(
        "monitoring.auth_views.get_internal_role",
        side_effect=RoleLookupError("Database tidak tersedia."),
    )
    @patch(
        "monitoring.supabase_jwt_auth.verify_supabase_token"
    )
    def test_role_lookup_error(self, mock_verify, mock_role):
        user_id = "00000000-0000-4000-8000-000000000003"

        mock_verify.return_value = (
            SupabasePrincipal(
                user_id=user_id,
                email="penguji@example.invalid",
            ),
            {"sub": user_id},
        )

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION="Bearer test-error",
        )

        self.assertEqual(response.status_code, 500)
        self.assertNotIn("internal_role", response.data)
        mock_role.assert_called_once_with(user_id)
