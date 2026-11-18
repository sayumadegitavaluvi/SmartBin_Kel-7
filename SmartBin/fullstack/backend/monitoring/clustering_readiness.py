from django.db import connection


def get_clustering_readiness():
    """
    Memeriksa kesiapan histori setiap tong.

    Belum menjalankan model AI.
    Belum memvalidasi kualitas sensor.
    Tidak mengubah database.
    """

    query = """
        SELECT
            t.id_tong,
            t.kode_tong,
            t.jenis_tong,
            COUNT(s.id_data),
            MIN(s.waktu_pembacaan),
            MAX(s.waktu_pembacaan)
        FROM public.tong_sampah AS t
        LEFT JOIN public.sensor_data AS s
            ON s.id_tong = t.id_tong
        GROUP BY
            t.id_tong,
            t.kode_tong,
            t.jenis_tong
        ORDER BY t.kode_tong
    """

    with connection.cursor() as cursor:
        cursor.execute(query)
        rows = cursor.fetchall()

    results = []

    for (
        id_tong,
        kode_tong,
        jenis_tong,
        jumlah,
        awal,
        akhir,
    ) in rows:

        if jenis_tong == "virtual":
            status = "data_simulasi"
            keterangan = (
                "Data tong virtual merupakan simulasi "
                "dan belum digunakan untuk analisis operasional."
            )

        elif jumlah < 2:
            status = "histori_belum_cukup"
            keterangan = (
                "Diperlukan setidaknya dua pembacaan "
                "untuk membentuk satu interval waktu."
            )

        else:
            status = "menunggu_verifikasi_sensor"
            keterangan = (
                "Histori tersedia, tetapi validitas sensor "
                "dan durasi minimum belum terkonfirmasi."
            )

        results.append({
            "id_tong": id_tong,
            "kode_tong": kode_tong,
            "jenis_tong": jenis_tong,
            "jumlah_pembacaan": jumlah,
            "pembacaan_pertama": (
                awal.isoformat() if awal else None
            ),
            "pembacaan_terakhir": (
                akhir.isoformat() if akhir else None
            ),
            "status_kesiapan": status,
            "keterangan": keterangan,
            "siap_clustering_operasional": False,
            "hasil_clustering": None,
            "waktu_analisis": None,
        })

    return results
