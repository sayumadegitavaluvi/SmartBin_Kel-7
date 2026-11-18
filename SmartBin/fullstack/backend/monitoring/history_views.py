from django.db import connection, DatabaseError
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from .supabase_jwt_auth import SupabaseJWTAuthentication
from .permissions import IsSmartBinInternal
from rest_framework.response import Response


@api_view(["GET"])
@authentication_classes([SupabaseJWTAuthentication])
@permission_classes([IsSmartBinInternal])
def bin_history(request, bin_identifier):
    """
    Mengambil histori sensor berdasarkan kode tong.

    Hanya membaca database.
    Validitas pembacaan belum diverifikasi.
    """

    try:
        limit = int(request.query_params.get("limit", "100"))
        offset = int(request.query_params.get("offset", "0"))
    except (ValueError, TypeError):
        return Response(
            {"detail": "Parameter limit atau offset tidak valid."},
            status=400,
        )

    if not 1 <= limit <= 500 or offset < 0:
        return Response(
            {"detail": "Limit harus 1-500 dan offset minimal 0."},
            status=400,
        )

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id_tong, kode_tong, jenis_tong
                FROM public.tong_sampah
                WHERE kode_tong = %s
                LIMIT 1
            """, [bin_identifier])

            tong = cursor.fetchone()

            if tong is None:
                return Response(
                    {"detail": "Tong tidak ditemukan."},
                    status=404,
                )

            id_tong, kode_tong, jenis_tong = tong

            cursor.execute("""
                SELECT
                    id_data,
                    id_perangkat,
                    jarak_sensor,
                    tingkat_kepenuhan,
                    waktu_pembacaan,
                    sumber_data
                FROM public.sensor_data
                WHERE id_tong = %s
                ORDER BY waktu_pembacaan ASC, id_data ASC
                LIMIT %s OFFSET %s
            """, [id_tong, limit + 1, offset])

            rows = cursor.fetchall()

    except DatabaseError:
        return Response(
            {"detail": "Histori sensor tidak dapat diakses."},
            status=503,
        )

    has_more = len(rows) > limit
    rows = rows[:limit]

    results = []

    for row in rows:
        (
            id_data,
            id_perangkat,
            jarak_sensor,
            kepenuhan,
            waktu,
            sumber_data,
        ) = row

        results.append({
            "id_data": id_data,
            "id_perangkat": id_perangkat,
            "jarak_sensor": (
                float(jarak_sensor)
                if jarak_sensor is not None else None
            ),
            "tingkat_kepenuhan": float(kepenuhan),
            "waktu_pembacaan": waktu.isoformat(),
            "sumber_data": sumber_data,
            "validitas_sensor": "belum_diverifikasi",
        })

    return Response({
        "id_tong": id_tong,
        "kode_tong": kode_tong,
        "jenis_tong": jenis_tong,
        "count": len(results),
        "has_more": has_more,
        "next_offset": offset + limit if has_more else None,
        "results": results,
    })
