from django.db import connection, DatabaseError
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def latest_all_bins(request):
    """
    Mengambil seluruh tong SmartBin beserta
    satu pembacaan sensor terbaru per tong.
    """

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    t.id_tong,
                    t.kode_tong,
                    t.jenis_tong,
                    t.kapasitas_liter,
                    t.status_aktif,
                    l.id_lokasi,
                    l.nama_lokasi,
                    l.latitude,
                    l.longitude,
                    l.sumber_koordinat,
                    s.id_data,
                    s.id_perangkat,
                    s.jarak_sensor,
                    s.tingkat_kepenuhan,
                    s.waktu_pembacaan,
                    s.sumber_data
                FROM public.tong_sampah AS t
                JOIN public.location AS l
                    ON l.id_lokasi = t.id_lokasi
                LEFT JOIN LATERAL (
                    SELECT
                        id_data,
                        id_perangkat,
                        jarak_sensor,
                        tingkat_kepenuhan,
                        waktu_pembacaan,
                        sumber_data
                    FROM public.sensor_data
                    WHERE id_tong = t.id_tong
                    ORDER BY
                        waktu_pembacaan DESC NULLS LAST,
                        id_data DESC
                    LIMIT 1
                ) AS s ON TRUE
                ORDER BY t.kode_tong ASC
            """)

            rows = cursor.fetchall()

    except DatabaseError:
        return Response(
            {"detail": "Data monitoring tidak dapat diakses."},
            status=503,
        )

    results = []

    for row in rows:
        (
            id_tong,
            kode_tong,
            jenis_tong,
            kapasitas_liter,
            status_aktif,
            id_lokasi,
            nama_lokasi,
            latitude,
            longitude,
            sumber_koordinat,
            id_data,
            id_perangkat,
            jarak_sensor,
            tingkat_kepenuhan,
            waktu_pembacaan,
            sumber_data,
        ) = row

        monitoring = None

        if id_data is not None:
            monitoring = {
                "id_data": id_data,
                "id_perangkat": id_perangkat,
                "jarak_sensor": (
                    float(jarak_sensor)
                    if jarak_sensor is not None else None
                ),
                "tingkat_kepenuhan": (
                    float(tingkat_kepenuhan)
                    if tingkat_kepenuhan is not None else None
                ),
                "waktu_pembacaan": (
                    waktu_pembacaan.isoformat()
                    if waktu_pembacaan is not None else None
                ),
                "sumber_data": sumber_data,
            }

        results.append({
            "id_tong": id_tong,
            "kode_tong": kode_tong,
            "jenis_tong": jenis_tong,
            "kapasitas_liter": kapasitas_liter,
            "status_aktif": status_aktif,
            "lokasi": {
                "id_lokasi": id_lokasi,
                "nama_lokasi": nama_lokasi,
                "latitude": (
                    float(latitude)
                    if latitude is not None else None
                ),
                "longitude": (
                    float(longitude)
                    if longitude is not None else None
                ),
                "sumber_koordinat": sumber_koordinat,
            },
            "monitoring": monitoring,
        })

    return Response({
        "count": len(results),
        "results": results,
    })
