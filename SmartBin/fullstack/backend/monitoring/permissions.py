"""Permission berdasarkan role internal SmartBin."""

from rest_framework.permissions import BasePermission

from .role_service import get_internal_role, RoleLookupError


class SmartBinRolePermission(BasePermission):
    """Permission dasar untuk role internal SmartBin."""

    allowed_roles = frozenset()
    message = "Anda tidak memiliki hak akses untuk fitur ini."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        try:
            role = get_internal_role(user.id)
        except RoleLookupError:
            return False

        return role in self.allowed_roles


class IsSmartBinAdmin(SmartBinRolePermission):
    allowed_roles = frozenset({"admin"})


class IsSmartBinPetugas(SmartBinRolePermission):
    allowed_roles = frozenset({"petugas"})


class IsSmartBinPengelola(SmartBinRolePermission):
    allowed_roles = frozenset({"pengelola"})


class IsSmartBinInternal(SmartBinRolePermission):
    allowed_roles = frozenset({
        "admin",
        "petugas",
        "pengelola",
    })
