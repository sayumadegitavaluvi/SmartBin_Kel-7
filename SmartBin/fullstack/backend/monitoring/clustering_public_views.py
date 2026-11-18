from django.db import connection, transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .clustering_readiness import get_clustering_readiness


@api_view(["GET"])
@permission_classes([AllowAny])
def clustering_public_overview(request):
    """
    Ringkasan clustering untuk dashboard publik.

    - Tidak membutuhkan login.
    - Hanya membaca database.
    - Tidak menjalankan model AI.
    - Tidak menampilkan prediksi pengujian.
    - Tidak menampilkan fitur mentah atau histori sensor.
    """

    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION READ ONLY")

            results = get_clustering_readiness()

            cursor.execute("""
                SELECT DISTINCT ON (h.id_tong)
                    h.id_tong,
                    h.cluster,
                    h.profil_cluster,
                    h.interpretasi,
                    h.waktu_analisis
                FROM public.hasil_clustering h
                JOIN public.tong_sampah t
                    ON t.id_tong = h.id_tong
                WHERE t.jenis_tong = 'fisik'
                  AND h.mode = 'operasional'
                  AND h.sumber_input = 'histori_fisik'
                  AND h.operasional_tervalidasi = TRUE
                  AND h.durasi_valid_jam >= 4320
                  AND h.cluster IN (0, 1, 2)
                  AND h.fitur IS NOT NULL
                  AND h.versi_model IS NOT NULL
                  AND h.periode_awal IS NOT NULL
                  AND h.periode_akhir IS NOT NULL
                ORDER BY
                    h.id_tong,
                    h.waktu_analisis DESC,
                    h.id_hasil DESC
            """)

            predictions = {
                row[0]: row[1:]
                for row in cursor.fetchall()
            }

    jumlah_siap = 0

    for item in results:
        item["operasional_tervalidasi"] = False

        hasil = predictions.get(item["id_tong"])

        if hasil is None:
            if item["jenis_tong"] == "fisik":
                item["status_kesiapan"] = (
                    "menunggu_validasi_operasional"
                )
                item["keterangan"] = (
                    "Belum tersedia hasil clustering "
                    "operasional yang tervalidasi."
                )
            continue

        cluster, profil, interpretasi, waktu = hasil

        item["status_kesiapan"] = (
            "hasil_operasional_tersedia"
        )
        item["siap_clustering_operasional"] = True
        item["operasional_tervalidasi"] = True

        item["hasil_clustering"] = {
            "cluster": cluster,
            "profil_cluster": profil,
            "interpretasi": interpretasi,
        }

        item["waktu_analisis"] = (
            waktu.isoformat() if waktu else None
        )

        jumlah_siap += 1

    return Response({
        "mode": "ringkasan_publik",
        "operasional_tervalidasi": jumlah_siap > 0,
        "jumlah_tong": len(results),
        "jumlah_siap_operasional": jumlah_siap,
        "results": results,
    })
