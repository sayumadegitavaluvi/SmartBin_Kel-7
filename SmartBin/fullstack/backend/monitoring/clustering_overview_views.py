from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from .supabase_jwt_auth import SupabaseJWTAuthentication
from .permissions import IsSmartBinAdmin
from rest_framework.response import Response

from .clustering_readiness import get_clustering_readiness
from .clustering_history_source import load_physical_history
from .clustering_features import calculate_clustering_features


@api_view(["GET"])
@authentication_classes([SupabaseJWTAuthentication])
@permission_classes([IsSmartBinAdmin])
def clustering_overview(request):
    """
    Ringkasan kesiapan AI seluruh tong.

    Tidak menjalankan prediksi AI.
    Tidak menyimpan hasil ke database.
    """

    results = get_clustering_readiness()

    for item in results:
        item["evaluasi_histori"] = None

        if item["jenis_tong"] != "fisik":
            continue

        histori = load_physical_history(item["kode_tong"])
        evaluasi = calculate_clustering_features(histori)

        item["evaluasi_histori"] = evaluasi

        if evaluasi["fitur"] is None:
            item["status_kesiapan"] = "belum_ada_interval_valid"
            item["keterangan"] = (
                "Belum ada interval dengan validitas sensor "
                "yang terverifikasi."
            )
        else:
            item["status_kesiapan"] = "menunggu_ketentuan_operasional"
            item["keterangan"] = (
                "Fitur dapat dihitung, tetapi syarat durasi "
                "dan kelayakan operasional belum ditetapkan."
            )

    return Response({
        "mode": "pemeriksaan_kesiapan",
        "operasional_tervalidasi": False,
        "jumlah_tong": len(results),
        "jumlah_siap_operasional": 0,
        "results": results,
    })
