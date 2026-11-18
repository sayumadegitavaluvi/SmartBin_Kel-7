from django.db import connection, DatabaseError
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


def format_location(row):
    return {
        "id_lokasi": row[0],
        "nama_lokasi": row[1],
        "latitude": float(row[2]) if row[2] is not None else None,
        "longitude": float(row[3]) if row[3] is not None else None,
        "sumber_koordinat": row[4],
    }


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def list_locations(request):
    """Mengambil seluruh lokasi SmartBin dari Supabase."""

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    id_lokasi,
                    nama_lokasi,
                    latitude,
                    longitude,
                    sumber_koordinat
                FROM public.location
                ORDER BY id_lokasi ASC
            """)
            rows = cursor.fetchall()

    except DatabaseError:
        return Response(
            {"detail": "Database lokasi tidak dapat diakses."},
            status=503,
        )

    locations = [format_location(row) for row in rows]

    return Response({
        "count": len(locations),
        "results": locations,
    })


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def location_detail(request, id_lokasi):
    """Mengambil detail lokasi berdasarkan ID."""

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    id_lokasi,
                    nama_lokasi,
                    latitude,
                    longitude,
                    sumber_koordinat
                FROM public.location
                WHERE id_lokasi = %s
                LIMIT 1
            """, [id_lokasi])

            row = cursor.fetchone()

    except DatabaseError:
        return Response(
            {"detail": "Database lokasi tidak dapat diakses."},
            status=503,
        )

    if row is None:
        return Response(
            {"detail": "Lokasi tidak ditemukan."},
            status=404,
        )

    return Response(format_location(row))
