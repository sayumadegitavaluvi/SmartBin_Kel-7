from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .supabase_jwt_auth import SupabaseJWTAuthentication
from .role_service import get_internal_role, RoleLookupError
from rest_framework.exceptions import APIException


@api_view(["GET"])
@authentication_classes([SupabaseJWTAuthentication])
@permission_classes([IsAuthenticated])
def auth_me(request):
    """
    Memeriksa identitas melalui JWT Supabase.

    Membaca role internal dari database PostgreSQL.
    Tidak mengubah data pengguna.
    """

    try:
        internal_role = get_internal_role(request.user.id)
    except RoleLookupError as exc:
        raise APIException(
            "Verifikasi hak akses sementara tidak tersedia."
        ) from exc

    response = Response({
        "authenticated": True,
        "user_id": request.user.id,
        "email": request.user.email,
        "internal_role": internal_role,
    })

    response["Cache-Control"] = "no-store"

    return response
