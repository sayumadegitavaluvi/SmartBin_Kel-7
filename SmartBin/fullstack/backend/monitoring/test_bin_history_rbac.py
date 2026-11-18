"""Pengujian RBAC endpoint histori sensor SmartBin."""

from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from .supabase_jwt_auth import SupabasePrincipal


class BinHistoryRBACTests(SimpleTestCase):

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/bins/BIN-TEST/history/"
        self.user_id = "00000000-0000-4000-8000-000000000001"

    def mock_identity(self):
        return (
            SupabasePrincipal(
                user_id=self.user_id,
                email="penguji@example.invalid",
            ),
            {"sub": self.user_id},
        )

    def test_without_token_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    @patch(
        "monitoring.permissions.get_internal_role",
        return_value=None,
    )
    @patch(
        "monitoring.supabase_jwt_auth.verify_supabase_token"
    )
    def test_without_internal_role_rejected(
        self, mock_verify, mock_role
    ):
        mock_verify.return_value = self.mock_identity()

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION="Bearer test-user",
        )

        self.assertEqual(response.status_code, 403)
        mock_role.assert_called_once_with(self.user_id)

    def test_all_internal_roles_pass_rbac(self):
        for role in ("admin", "petugas", "pengelola"):
            with self.subTest(role=role):
                with patch(
                    "monitoring.supabase_jwt_auth.verify_supabase_token",
                    return_value=self.mock_identity(),
                ), patch(
                    "monitoring.permissions.get_internal_role",
                    return_value=role,
                ) as mock_role:
                    response = self.client.get(
                        self.url,
                        HTTP_AUTHORIZATION="Bearer test-internal",
                        QUERY_STRING="limit=0",
                    )

                    self.assertEqual(response.status_code, 400)
                    mock_role.assert_called_once_with(self.user_id)
