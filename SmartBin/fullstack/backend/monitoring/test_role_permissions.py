"""Unit test hak akses berdasarkan role SmartBin."""

from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from .permissions import (
    IsSmartBinAdmin,
    IsSmartBinPetugas,
    IsSmartBinPengelola,
    IsSmartBinInternal,
)
from .role_service import RoleLookupError


class SmartBinRolePermissionTests(SimpleTestCase):

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = SimpleNamespace(
            id="00000000-0000-4000-8000-000000000001",
            is_authenticated=True,
        )

    def check_permission(self, permission_class, role):
        request = self.factory.get("/api/test/")
        request.user = self.user

        with patch(
            "monitoring.permissions.get_internal_role",
            return_value=role,
        ):
            return permission_class().has_permission(
                request, None
            )

    def test_admin_permissions(self):
        self.assertTrue(
            self.check_permission(IsSmartBinAdmin, "admin")
        )
        self.assertTrue(
            self.check_permission(IsSmartBinInternal, "admin")
        )
        self.assertFalse(
            self.check_permission(IsSmartBinPetugas, "admin")
        )
        self.assertFalse(
            self.check_permission(IsSmartBinPengelola, "admin")
        )

    def test_petugas_permissions(self):
        self.assertTrue(
            self.check_permission(IsSmartBinPetugas, "petugas")
        )
        self.assertTrue(
            self.check_permission(IsSmartBinInternal, "petugas")
        )
        self.assertFalse(
            self.check_permission(IsSmartBinAdmin, "petugas")
        )
        self.assertFalse(
            self.check_permission(IsSmartBinPengelola, "petugas")
        )

    def test_pengelola_permissions(self):
        self.assertTrue(
            self.check_permission(IsSmartBinPengelola, "pengelola")
        )
        self.assertTrue(
            self.check_permission(IsSmartBinInternal, "pengelola")
        )
        self.assertFalse(
            self.check_permission(IsSmartBinAdmin, "pengelola")
        )
        self.assertFalse(
            self.check_permission(IsSmartBinPetugas, "pengelola")
        )

    def test_without_role_rejected(self):
        for permission_class in [
            IsSmartBinAdmin,
            IsSmartBinPetugas,
            IsSmartBinPengelola,
            IsSmartBinInternal,
        ]:
            self.assertFalse(
                self.check_permission(permission_class, None)
            )

    def test_unauthenticated_rejected(self):
        request = self.factory.get("/api/test/")
        request.user = SimpleNamespace(
            is_authenticated=False,
        )

        with patch(
            "monitoring.permissions.get_internal_role"
        ) as mock_role:
            result = IsSmartBinInternal().has_permission(
                request, None
            )

        self.assertFalse(result)
        mock_role.assert_not_called()

    def test_role_lookup_failure_rejected(self):
        request = self.factory.get("/api/test/")
        request.user = self.user

        with patch(
            "monitoring.permissions.get_internal_role",
            side_effect=RoleLookupError(
                "Database tidak tersedia."
            ),
        ):
            result = IsSmartBinInternal().has_permission(
                request, None
            )

        self.assertFalse(result)
