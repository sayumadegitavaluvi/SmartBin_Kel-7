"""Pengujian RBAC endpoint clustering predict SmartBin."""

from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from ai_clustering.smartbin_clustering import FITUR_MODEL
from .supabase_jwt_auth import SupabasePrincipal


class ClusteringPredictRBACTests(SimpleTestCase):

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/clustering/predict/"
        self.user_id = "00000000-0000-4000-8000-000000000001"

        record = {
            "Container_ID": "BIN-TEST",
        }
        record.update({
            fitur: 10.0 for fitur in FITUR_MODEL
        })

        self.payload = {"data": [record]}

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
        "monitoring.clustering_views.predict_clustering",
        return_value=[{
            "Container_ID": "BIN-TEST",
            "Cluster": 0,
        }],
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
        mock_predict,
    ):
        mock_verify.return_value = self.mock_identity()

        response = self.client.post(
            self.url,
            self.payload,
            format="json",
            HTTP_AUTHORIZATION="Bearer test-admin",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["mode"], "pengujian")
        self.assertEqual(response.data["jumlah_data"], 1)
        self.assertFalse(
            response.data["operasional_tervalidasi"]
        )

        mock_role.assert_called_once_with(self.user_id)
        mock_predict.assert_called_once_with(
            self.payload["data"]
        )
