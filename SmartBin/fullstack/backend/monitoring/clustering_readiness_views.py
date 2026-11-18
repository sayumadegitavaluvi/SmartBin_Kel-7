from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from .supabase_jwt_auth import SupabaseJWTAuthentication
from .permissions import IsSmartBinAdmin
from rest_framework.response import Response

from .clustering_readiness import get_clustering_readiness


@api_view(["GET"])
@authentication_classes([SupabaseJWTAuthentication])
@permission_classes([IsSmartBinAdmin])
def clustering_readiness(request):
    """
    Pemeriksaan kesiapan clustering untuk admin internal.

    Tidak menjalankan prediksi AI.
    Tidak menyimpan atau mengubah database.
    """

    results = get_clustering_readiness()

    return Response({
        "mode": "pemeriksaan_kesiapan",
        "operasional_tervalidasi": False,
        "jumlah_tong": len(results),
        "results": results,
    })
