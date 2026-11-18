from django.db import connection


def load_physical_history(kode_tong, limit=500):
    """
    Mengambil histori sensor fisik dari Supabase.

    Semua pembacaan diberi valid=None karena
    kualitas sensor belum diverifikasi.

    Fungsi ini hanya membaca database.
    """

    if (
        not isinstance(kode_tong, str)
        or not kode_tong.strip()
        or type(limit) is not int
        or not 1 <= limit <= 500
    ):
        raise ValueError("Parameter histori tidak valid.")

    query = """
        SELECT
            s.id_data,
            s.waktu_pembacaan,
            s.tingkat_kepenuhan
        FROM public.sensor_data AS s
        JOIN public.tong_sampah AS t
            ON t.id_tong = s.id_tong
        WHERE t.kode_tong = %s
          AND t.jenis_tong = 'fisik'
          AND s.sumber_data = 'fisik'
        ORDER BY
            s.waktu_pembacaan DESC,
            s.id_data DESC
        LIMIT %s
    """

    with connection.cursor() as cursor:
        cursor.execute(query, [kode_tong, limit])
        rows = cursor.fetchall()

    return [
        {
            "id_data": id_data,
            "waktu_pembacaan": waktu.isoformat(),
            "tingkat_kepenuhan": float(kepenuhan),
            "valid": None,
        }
        for id_data, waktu, kepenuhan in reversed(rows)
    ]
