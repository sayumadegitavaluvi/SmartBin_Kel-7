from django.test import SimpleTestCase
from rest_framework.test import APIClient

from .crud_validation import (
    LocationCreateInputSerializer,
    LocationUpdateInputSerializer,
    BinCreateInputSerializer,
    BinUpdateInputSerializer,
)

from .crud_delete_policy import (
    check_bin_delete,
    check_location_delete,
)


class CrudValidationSafetyTests(SimpleTestCase):

    def test_location_create_rejects_extra_id(self):
        serializer = LocationCreateInputSerializer(data={
            "nama_lokasi": "Gedung Uji",
            "sumber_koordinat": "belum_tersedia",
            "id_lokasi": 999,
        })
        self.assertFalse(serializer.is_valid())

    def test_location_create_rejects_manual_gps_claim(self):
        serializer = LocationCreateInputSerializer(data={
            "nama_lokasi": "Gedung Uji",
            "latitude": -5.35,
            "longitude": 105.23,
            "sumber_koordinat": "gps_fisik",
        })
        self.assertFalse(serializer.is_valid())

    def test_bin_create_rejects_sensor_field(self):
        serializer = BinCreateInputSerializer(data={
            "kode_tong": "SB-V009",
            "id_lokasi": 1,
            "jenis_tong": "virtual",
            "tingkat_kepenuhan": 90,
        })
        self.assertFalse(serializer.is_valid())

    def test_bin_patch_rejects_physical_relocation(self):
        serializer = BinUpdateInputSerializer(
            data={"id_lokasi": 2},
            context={
                "existing_bin": {"jenis_tong": "fisik"},
            },
        )
        self.assertFalse(serializer.is_valid())

    def test_location_patch_rejects_physical_coordinate_change(self):
        serializer = LocationUpdateInputSerializer(
            data={
                "latitude": -5.36,
                "longitude": 105.24,
            },
            context={
                "existing_location": {
                    "nama_lokasi": "Gedung Fisik",
                    "latitude": -5.35,
                    "longitude": 105.23,
                    "sumber_koordinat": "gps_fisik",
                },
                "linked_to_physical_bin": True,
            },
        )
        self.assertFalse(serializer.is_valid())


class CrudDeleteSafetyTests(SimpleTestCase):

    def test_physical_bin_cannot_be_delete_candidate(self):
        result = check_bin_delete(
            jenis_tong="fisik",
            jumlah_histori=9,
            jumlah_perangkat=1,
        )
        self.assertFalse(result["candidate"])

    def test_virtual_bin_with_history_is_protected(self):
        result = check_bin_delete(
            jenis_tong="virtual",
            jumlah_histori=1,
            jumlah_perangkat=0,
        )
        self.assertFalse(result["candidate"])

    def test_location_in_use_is_protected(self):
        result = check_location_delete(jumlah_tong=1)
        self.assertFalse(result["candidate"])


class CrudApiSecurityTests(SimpleTestCase):

    def setUp(self):
        self.client = APIClient()

    def test_bin_endpoints_reject_write_methods(self):
        cases = [
            ("post", "/api/bins/"),
            ("patch", "/api/bins/SB-F001/"),
            ("put", "/api/bins/SB-F001/"),
            ("delete", "/api/bins/SB-F001/"),
        ]

        for method, url in cases:
            with self.subTest(method=method, url=url):
                response = getattr(self.client, method)(
                    url,
                    data={},
                    format="json",
                )
                self.assertEqual(response.status_code, 405)

    def test_location_endpoints_reject_write_methods(self):
        cases = [
            ("post", "/api/locations/"),
            ("patch", "/api/locations/1/"),
            ("put", "/api/locations/1/"),
            ("delete", "/api/locations/1/"),
        ]

        for method, url in cases:
            with self.subTest(method=method, url=url):
                response = getattr(self.client, method)(
                    url,
                    data={},
                    format="json",
                )
                self.assertEqual(response.status_code, 405)

    def test_history_requires_authentication(self):
        response = self.client.get(
            "/api/bins/SB-F001/history/"
        )

        self.assertIn(
            response.status_code,
            (401, 403),
        )
