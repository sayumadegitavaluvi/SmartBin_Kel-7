"""Pengujian RBAC endpoint clustering overview SmartBin."""

from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from .supabase_jwt_auth import SupabasePrincipal


class ClusteringOverviewRBACTests(SimpleTestCase):

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/clustering/overview/"
        self.user_id = "00000000-0000-4000-8000-000000000001"

    def test_without_token_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    @patch(
        "monitoring.permissions.get_internal_role",
        return_value="petugas",
    )
    @patch(
        "monitoring.supabase_jwt_auth.verify_supabase_token"
    )
    def test_non_admin_rejected(self, mock_verify, mock_role):
        mock_verify.return_value = (
            SupabasePrincipal(
                user_id=self.user_id,
                email="petugas@example.invalid",
            ),
            {"sub": self.user_id},
        )

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION="Bearer test-petugas",
        )

        self.assertEqual(response.status_code, 403)
        mock_role.assert_called_once_with(self.user_id)

    @patch(
        "monitoring.clustering_overview_views.get_clustering_readiness",
        return_value=[],
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
        mock_readiness,
    ):
        mock_verify.return_value = (
            SupabasePrincipal(
                user_id=self.user_id,
                email="admin@example.invalid",
            ),
            {"sub": self.user_id},
        )

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION="Bearer test-admin",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["mode"],
            "pemeriksaan_kesiapan",
        )
        self.assertEqual(response.data["jumlah_tong"], 0)
        mock_role.assert_called_once_with(self.user_id)
        mock_readiness.assert_called_once_with()
