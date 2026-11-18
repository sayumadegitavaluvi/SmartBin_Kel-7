"""Pengujian RBAC endpoint clustering from history."""

from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from .supabase_jwt_auth import SupabasePrincipal


class ClusteringFromHistoryRBACTests(SimpleTestCase):

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/clustering/from-history/"
        self.user_id = "00000000-0000-4000-8000-000000000001"
        self.payload = {
            "Container_ID": "BIN-TEST",
            "histori": [
                {
                    "valid": True,
                    "waktu_pembacaan": "2026-01-01T10:00:00Z",
                },
                {
                    "valid": True,
                    "waktu_pembacaan": "2026-01-01T10:05:00Z",
                },
            ],
        }

    def mock_identity(self):
        return (
            SupabasePrincipal(
                user_id=self.user_id,
                email="penguji@example.invalid",
            ),
            {"sub": self.user_id},
        )

    def test_without_token_rejected(self):
        response = self.client.post(
            self.url,
            self.payload,
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    @patch(
        "monitoring.permissions.get_internal_role",
        return_value="petugas",
    )
    @patch(
        "monitoring.supabase_jwt_auth.verify_supabase_token"
    )
    def test_non_admin_rejected(self, mock_verify, mock_role):
        mock_verify.return_value = self.mock_identity()

        response = self.client.post(
            self.url,
            self.payload,
            format="json",
            HTTP_AUTHORIZATION="Bearer test-petugas",
        )

        self.assertEqual(response.status_code, 403)
        mock_role.assert_called_once_with(self.user_id)

    @patch(
        "monitoring.clustering_history_views.calculate_clustering_features",
        return_value={"fitur": None},
    )
    @patch(
        "monitoring.permissions.get_internal_role",
        return_value="admin",
    )
    @patch(
        "monitoring.supabase_jwt_auth.verify_supabase_token"
    )
    def test_admin_allowed(
        self,
        mock_verify,
        mock_role,
        mock_features,
    ):
        mock_verify.return_value = self.mock_identity()

        response = self.client.post(
            self.url,
            self.payload,
            format="json",
            HTTP_AUTHORIZATION="Bearer test-admin",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["mode"],
            "pengujian",
        )
        self.assertEqual(
            response.data["status"],
            "belum_ada_interval_valid",
        )

        mock_role.assert_called_once_with(self.user_id)
        mock_features.assert_called_once()
