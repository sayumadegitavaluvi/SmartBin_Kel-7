import os
from functools import lru_cache
from uuid import UUID

import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class SupabasePrincipal:
    """Identitas pengguna hasil verifikasi JWT."""

    def __init__(self, user_id, email=None):
        self.id = user_id
        self.pk = user_id
        self.email = email
        self.is_authenticated = True
        self.is_active = True

        # Role internal belum dihubungkan.
        # Tidak boleh otomatis memperoleh izin admin.
        self.is_staff = False
        self.is_superuser = False


@lru_cache(maxsize=2)
def get_jwks_client(jwks_url):
    return jwt.PyJWKClient(
        jwks_url,
        cache_jwk_set=True,
        lifespan=300,
        timeout=5,
    )


def verify_supabase_token(token):
    supabase_url = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("SUPABASE_PROJECT_URL")
        or ""
    ).rstrip("/")

    if not (
        supabase_url.startswith("https://")
        and supabase_url
    ):
        raise AuthenticationFailed(
            "Konfigurasi autentikasi belum tersedia."
        )

    issuer = f"{supabase_url}/auth/v1"
    jwks_url = f"{issuer}/.well-known/jwks.json"

    try:
        header = jwt.get_unverified_header(token)

        if (
            header.get("alg") != "ES256"
            or not header.get("kid")
        ):
            raise AuthenticationFailed(
                "Jenis token tidak didukung."
            )

        signing_key = get_jwks_client(
            jwks_url
        ).get_signing_key_from_jwt(token)

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            issuer=issuer,
            audience="authenticated",
            options={
                "require": [
                    "exp",
                    "iss",
                    "aud",
                    "sub",
                ]
            },
        )

    except jwt.PyJWTError as exc:
        raise AuthenticationFailed(
            "Token tidak valid atau kedaluwarsa."
        ) from exc

    if claims.get("role") != "authenticated":
        raise AuthenticationFailed(
            "Token bukan milik pengguna terautentikasi."
        )

    try:
        user_id = str(UUID(claims["sub"]))
    except (ValueError, TypeError, KeyError) as exc:
        raise AuthenticationFailed(
            "Identitas pengguna tidak valid."
        ) from exc

    return SupabasePrincipal(
        user_id=user_id,
        email=claims.get("email"),
    ), claims


class SupabaseJWTAuthentication(BaseAuthentication):
    """Autentikasi Bearer token untuk API Django."""

    def authenticate(self, request):
        authorization = request.headers.get(
            "Authorization", ""
        )

        if not authorization:
            return None

        parts = authorization.split()

        if (
            len(parts) != 2
            or parts[0].lower() != "bearer"
        ):
            raise AuthenticationFailed(
                "Format Authorization harus Bearer token."
            )

        return verify_supabase_token(parts[1])

    def authenticate_header(self, request):
        return 'Bearer realm="api"'
