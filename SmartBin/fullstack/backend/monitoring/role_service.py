"""Pembacaan role internal SmartBin dari PostgreSQL."""

from uuid import UUID

from django.db import connection, DatabaseError


VALID_INTERNAL_ROLES = frozenset({
    "admin",
    "petugas",
    "pengelola",
})


class RoleLookupError(Exception):
    """Role tidak dapat diverifikasi dari database."""


def get_internal_role(user_id):
    """Membaca role berdasarkan UUID hasil verifikasi JWT."""

    try:
        valid_user_id = UUID(str(user_id))
    except (ValueError, TypeError, AttributeError):
        return None

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT role
                FROM public.user_roles
                WHERE user_id = %s
                LIMIT 1
                """,
                [str(valid_user_id)],
            )

            row = cursor.fetchone()

    except DatabaseError as exc:
        raise RoleLookupError(
            "Verifikasi role pengguna tidak tersedia."
        ) from exc

    if row is None:
        return None

    role = row[0]

    if role not in VALID_INTERNAL_ROLES:
        return None

    return role
