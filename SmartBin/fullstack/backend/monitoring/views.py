from rest_framework.decorators import authentication_classes, permission_classes
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({
        "success": True,
        "service": "SmartBin Backend API",
        "status": "running",
        "message": "Django REST Framework is running successfully"
    })


from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def latest_bin_monitoring(request, bin_identifier):
    """
    Mengambil satu pembacaan sensor terbaru berdasarkan
    id_tong atau kode_tong.
    """

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                t.id_tong,
                t.kode_tong,
                l.nama_lokasi,
                t.jenis_tong,
                t.kapasitas_liter,
                t.status_aktif
            FROM public.tong_sampah AS t
            JOIN public.location AS l
                ON l.id_lokasi = t.id_lokasi
            WHERE t.kode_tong = %s
               OR t.id_tong::text = %s
            LIMIT 1
        """, [bin_identifier, bin_identifier])

        bin_row = cursor.fetchone()

        if bin_row is None:
            return Response(
                {"detail": "Tempat sampah tidak ditemukan."},
                status=404
            )

        (
            id_tong,
            kode_tong,
            nama_lokasi,
            jenis_tong,
            kapasitas_liter,
            status_aktif
        ) = bin_row

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
            ORDER BY waktu_pembacaan DESC, id_data DESC
            LIMIT 1
        """, [id_tong])

        sensor_row = cursor.fetchone()

    monitoring = None

    if sensor_row is not None:
        (
            id_data,
            id_perangkat,
            jarak_sensor,
            tingkat_kepenuhan,
            waktu_pembacaan,
            sumber_data
        ) = sensor_row

        monitoring = {
            "id_data": id_data,
            "id_perangkat": id_perangkat,
            "jarak_sensor": (
                float(jarak_sensor)
                if jarak_sensor is not None else None
            ),
            "tingkat_kepenuhan": float(tingkat_kepenuhan),
            "waktu_pembacaan": waktu_pembacaan.isoformat(),
            "sumber_data": sumber_data
        }

    return Response({
        "id_tong": id_tong,
        "kode_tong": kode_tong,
        "nama_lokasi": nama_lokasi,
        "jenis_tong": jenis_tong,
        "kapasitas_liter": kapasitas_liter,
        "status_aktif": status_aktif,
        "monitoring": monitoring
    })


import math
import os
import requests
from rest_framework.exceptions import ParseError


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def receive_monitoring(request):
    """
    Gateway penerimaan sensor SmartBin.
    Autentikasi perangkat dilakukan oleh Edge Function.
    """

    token = request.headers.get("x-device-token")

    if not token:
        return Response(
            {"error": "Unauthorized device"},
            status=401
        )

    try:
        payload = request.data
    except ParseError:
        return Response({"error": "Invalid JSON"}, status=400)

    if not isinstance(payload, dict):
        return Response({"error": "Invalid JSON body"}, status=400)

    device_id = payload.get("device_id")
    distance_cm = payload.get("distance_cm")
    fill_percent = payload.get("fill_percent")

    if (
        not isinstance(device_id, str)
        or not device_id.strip()
        or type(distance_cm) not in (int, float)
        or not math.isfinite(distance_cm)
        or distance_cm < 0
        or type(fill_percent) not in (int, float)
        or not math.isfinite(fill_percent)
        or not 0 <= fill_percent <= 100
    ):
        return Response({"error": "Invalid sensor data"}, status=400)

    edge_url = os.getenv("SUPABASE_EDGE_FUNCTION_URL")

    if not edge_url:
        return Response(
            {"error": "Monitoring service unavailable"},
            status=503
        )

    try:
        upstream = requests.post(
            edge_url,
            json={
                "device_id": device_id,
                "distance_cm": distance_cm,
                "fill_percent": fill_percent,
            },
            headers={
                "x-device-token": token,
                "Content-Type": "application/json",
            },
            timeout=(5, 15),
        )
    except requests.RequestException:
        return Response(
            {"error": "Monitoring service unavailable"},
            status=503
        )

    try:
        result = upstream.json()
    except ValueError:
        return Response(
            {"error": "Invalid monitoring service response"},
            status=502
        )

    if upstream.status_code in (200, 201, 400, 401, 403):
        return Response(result, status=upstream.status_code)

    return Response(
        {"error": "Monitoring service failed"},
        status=502
    )
