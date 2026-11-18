from django.db import connection, DatabaseError
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


BIN_QUERY = """
    SELECT
        t.id_tong,
        t.kode_tong,
        t.id_lokasi,
        t.jenis_tong,
        t.kapasitas_liter,
        t.tinggi_acuan,
        t.status_aktif,
        l.nama_lokasi,
        l.latitude,
        l.longitude,
        l.sumber_koordinat
    FROM public.tong_sampah AS t
    JOIN public.location AS l
        ON t.id_lokasi = l.id_lokasi
"""


def format_bin(row):
    return {
        "id_tong": row[0],
        "kode_tong": row[1],
        "jenis_tong": row[3],
        "kapasitas_liter": row[4],
        "tinggi_acuan": (
            float(row[5]) if row[5] is not None else None
        ),
        "status_aktif": row[6],
        "lokasi": {
            "id_lokasi": row[2],
            "nama_lokasi": row[7],
            "latitude": (
                float(row[8]) if row[8] is not None else None
            ),
            "longitude": (
                float(row[9]) if row[9] is not None else None
            ),
            "sumber_koordinat": row[10],
        },
    }


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def list_bins(request):
    """Mengambil seluruh data tempat sampah SmartBin."""

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                BIN_QUERY + " ORDER BY t.id_tong ASC"
            )
            rows = cursor.fetchall()

    except DatabaseError:
        return Response(
            {"detail": "Database tong tidak dapat diakses."},
            status=503,
        )

    bins = [format_bin(row) for row in rows]

    return Response({
        "count": len(bins),
        "results": bins,
    })


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def bin_detail(request, bin_identifier):
    """Mengambil detail tong berdasarkan kode atau ID."""

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                BIN_QUERY + """
                WHERE t.kode_tong = %s
                   OR t.id_tong::text = %s
                LIMIT 1
                """,
                [bin_identifier, bin_identifier],
            )
            row = cursor.fetchone()

    except DatabaseError:
        return Response(
            {"detail": "Database tong tidak dapat diakses."},
            status=503,
        )

    if row is None:
        return Response(
            {"detail": "Tempat sampah tidak ditemukan."},
            status=404,
        )

    return Response(format_bin(row))
