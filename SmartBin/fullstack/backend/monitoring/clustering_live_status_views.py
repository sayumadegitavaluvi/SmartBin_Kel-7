from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from .supabase_jwt_auth import SupabaseJWTAuthentication
from .permissions import IsSmartBinAdmin
from rest_framework.response import Response

from .clustering_history_source import load_physical_history
from .clustering_features import calculate_clustering_features


@api_view(["GET"])
@authentication_classes([SupabaseJWTAuthentication])
@permission_classes([IsSmartBinAdmin])
def clustering_history_status(request, bin_identifier):
    """
    Evaluasi histori fisik dari database.

    Tidak melakukan prediksi AI.
    Tidak mengubah database.
    """

    if not bin_identifier or len(bin_identifier) > 100:
        return Response(
            {"detail": "Identitas tong tidak valid."},
            status=400,
        )

    histori = load_physical_history(bin_identifier)
    evaluasi = calculate_clustering_features(histori)

    if not histori:
        status_kesiapan = "histori_fisik_tidak_tersedia"
    elif evaluasi["fitur"] is None:
        status_kesiapan = "belum_ada_interval_valid"
    else:
        status_kesiapan = "menunggu_ketentuan_durasi"

    return Response({
        "kode_tong": bin_identifier,
        "mode": "evaluasi_histori",
        "sumber": "sensor_data_fisik",
        "batas_pembacaan": 500,
        "jumlah_pembacaan": len(histori),
        "status_kesiapan": status_kesiapan,
        "evaluasi_histori": evaluasi,
        "siap_clustering_operasional": False,
        "operasional_tervalidasi": False,
        "hasil_clustering": None,
    })
