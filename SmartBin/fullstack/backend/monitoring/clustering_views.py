import logging
import math

from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from .supabase_jwt_auth import SupabaseJWTAuthentication
from .permissions import IsSmartBinAdmin
from rest_framework.response import Response

from ai_clustering.smartbin_clustering import (
    FITUR_MODEL,
    predict_clustering,
)

logger = logging.getLogger(__name__)


@api_view(["POST"])
@authentication_classes([SupabaseJWTAuthentication])
@permission_classes([IsSmartBinAdmin])
def clustering_predict(request):
    """
    API prediksi clustering menggunakan fitur pengujian.

    Belum digunakan untuk clustering operasional.
    Tidak mengubah atau menyimpan data Supabase.
    """

    payload = request.data

    if not isinstance(payload, dict) or "data" not in payload:
        return Response(
            {"detail": "Body harus memiliki field data."},
            status=400,
        )

    data = payload["data"]
    records = [data] if isinstance(data, dict) else data

    if not isinstance(records, list) or not 1 <= len(records) <= 100:
        return Response(
            {"detail": "Data harus berisi 1 sampai 100 objek."},
            status=400,
        )

    for index, record in enumerate(records):
        if not isinstance(record, dict):
            return Response(
                {"detail": f"Data ke-{index} harus berupa objek."},
                status=400,
            )

        container_id = record.get("Container_ID")

        if (
            not isinstance(container_id, str)
            or not 1 <= len(container_id) <= 100
            or not container_id.strip()
        ):
            return Response(
                {"detail": f"Container_ID data ke-{index} tidak valid."},
                status=400,
            )

        for fitur in FITUR_MODEL:
            nilai = record.get(fitur)

            if isinstance(nilai, bool) or not isinstance(
                nilai, (int, float)
            ):
                return Response(
                    {"detail": f"{fitur} harus berupa angka."},
                    status=400,
                )

            if not math.isfinite(nilai) or not 0 <= nilai <= 100:
                return Response(
                    {"detail": f"{fitur} harus berada pada 0-100."},
                    status=400,
                )

        if (
            record["Persen_Waktu_GE80"]
            + record["Persen_Waktu_LE20"] > 100.000001
        ):
            return Response(
                {"detail": "Total proporsi waktu tidak valid."},
                status=400,
            )

    try:
        hasil = predict_clustering(records)
    except Exception:
        logger.exception("Prediksi clustering SmartBin gagal.")
        return Response(
            {"detail": "Model clustering tidak dapat diproses."},
            status=503,
        )

    return Response({
        "mode": "pengujian",
        "operasional_tervalidasi": False,
        "jumlah_data": len(hasil),
        "results": hasil,
    })
