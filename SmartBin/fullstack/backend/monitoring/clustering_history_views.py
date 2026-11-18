import logging

from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from .supabase_jwt_auth import SupabaseJWTAuthentication
from .permissions import IsSmartBinAdmin
from rest_framework.response import Response

from monitoring.clustering_features import calculate_clustering_features
from ai_clustering.smartbin_clustering import predict_clustering

logger = logging.getLogger(__name__)


@api_view(["POST"])
@authentication_classes([SupabaseJWTAuthentication])
@permission_classes([IsSmartBinAdmin])
def clustering_from_history(request):
    """
    Pengujian pipeline histori -> fitur -> model AI.

    Hanya untuk pengujian internal.
    Tidak menghasilkan status operasional tervalidasi.
    Tidak menyimpan data ke Supabase.
    """

    payload = request.data

    if not isinstance(payload, dict):
        return Response(
            {"detail": "Payload harus berupa objek JSON."},
            status=400,
        )

    container_id = payload.get("Container_ID")
    histori = payload.get("histori")

    if (
        not isinstance(container_id, str)
        or not container_id.strip()
        or len(container_id) > 100
    ):
        return Response(
            {"detail": "Container_ID tidak valid."},
            status=400,
        )

    if (
        not isinstance(histori, list)
        or not 2 <= len(histori) <= 1000
    ):
        return Response(
            {"detail": "Histori harus berisi 2 sampai 1000 pembacaan."},
            status=400,
        )

    for index, row in enumerate(histori):
        if not isinstance(row, dict):
            return Response(
                {"detail": f"Pembacaan ke-{index} bukan objek."},
                status=400,
            )

        if "valid" not in row or row["valid"] not in (True, False, None):
            return Response(
                {"detail": f"Status valid pembacaan ke-{index} tidak sesuai."},
                status=400,
            )

        if "waktu_pembacaan" not in row:
            return Response(
                {"detail": f"Timestamp pembacaan ke-{index} tidak tersedia."},
                status=400,
            )

    try:
        evaluasi = calculate_clustering_features(histori)
    except (ValueError, TypeError, OverflowError):
        return Response(
            {"detail": "Format atau nilai histori tidak valid."},
            status=400,
        )

    response_data = {
        "Container_ID": container_id,
        "mode": "pengujian",
        "sumber_input": "histori_pengujian",
        "operasional_tervalidasi": False,
        "evaluasi_histori": evaluasi,
        "hasil_clustering": None,
    }

    if evaluasi["fitur"] is None:
        response_data["status"] = "belum_ada_interval_valid"
        return Response(response_data)

    input_ai = {
        "Container_ID": container_id,
        **evaluasi["fitur"],
    }

    try:
        hasil_ai = predict_clustering(input_ai)
    except Exception:
        logger.exception("Prediksi clustering dari histori gagal.")
        return Response(
            {"detail": "Model clustering tidak dapat diproses."},
            status=503,
        )

    response_data["status"] = "prediksi_pengujian"
    response_data["hasil_clustering"] = hasil_ai

    return Response(response_data)
