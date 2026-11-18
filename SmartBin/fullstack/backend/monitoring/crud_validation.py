from collections.abc import Mapping
from decimal import Decimal

from rest_framework import serializers



class StrictInputSerializer(serializers.Serializer):
    """Menolak field tambahan yang tidak didefinisikan."""

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            unknown = sorted(
                set(data.keys()) - set(self.fields.keys())
            )

            if unknown:
                raise serializers.ValidationError({
                    field: ["Field tidak diperbolehkan."]
                    for field in unknown
                })

        return super().to_internal_value(data)


class LocationCreateInputSerializer(StrictInputSerializer):
    """
    Validasi input pembuatan lokasi.
    Tidak melakukan operasi database.
    """

    nama_lokasi = serializers.CharField(
        max_length=150,
        allow_blank=False,
        trim_whitespace=True,
    )

    latitude = serializers.DecimalField(
        max_digits=12,
        decimal_places=8,
        min_value=Decimal("-90"),
        max_value=Decimal("90"),
        required=False,
        allow_null=True,
    )

    longitude = serializers.DecimalField(
        max_digits=12,
        decimal_places=8,
        min_value=Decimal("-180"),
        max_value=Decimal("180"),
        required=False,
        allow_null=True,
    )

    sumber_koordinat = serializers.ChoiceField(
        choices=[
            "belum_tersedia",
            "manual_peta",
            "simulasi",
        ]
    )

    def validate(self, attrs):
        latitude = attrs.get("latitude")
        longitude = attrs.get("longitude")
        sumber = attrs["sumber_koordinat"]

        has_lat = latitude is not None
        has_lon = longitude is not None

        if has_lat != has_lon:
            raise serializers.ValidationError(
                "Latitude dan longitude harus diisi bersama."
            )

        if sumber == "belum_tersedia":
            if has_lat or has_lon:
                raise serializers.ValidationError(
                    "Koordinat harus kosong jika belum tersedia."
                )

        if sumber in ("manual_peta", "simulasi"):
            if not has_lat:
                raise serializers.ValidationError(
                    "Sumber ini memerlukan koordinat lengkap."
                )

        if (
            has_lat
            and latitude == 0
            and longitude == 0
        ):
            raise serializers.ValidationError(
                "Koordinat 0,0 tidak diperbolehkan."
            )

        return attrs


class BinCreateInputSerializer(StrictInputSerializer):
    """
    Validasi input pembuatan tong.
    Tidak melakukan operasi database.
    """

    kode_tong = serializers.RegexField(
        regex=r"^[A-Z0-9][A-Z0-9_-]{0,39}$",
        min_length=3,
        max_length=40,
    )

    id_lokasi = serializers.IntegerField(
        min_value=1,
    )

    jenis_tong = serializers.ChoiceField(
        choices=["fisik", "virtual"]
    )

    kapasitas_liter = serializers.IntegerField(
        min_value=1,
        required=False,
        allow_null=True,
    )

    tinggi_acuan = serializers.DecimalField(
        max_digits=12,
        decimal_places=8,
        min_value=Decimal("0.00000001"),
        required=False,
        allow_null=True,
    )

    status_aktif = serializers.BooleanField(
        required=False,
        default=True,
    )


class LocationUpdateInputSerializer(StrictInputSerializer):
    """Validasi PATCH lokasi tanpa menulis database."""

    nama_lokasi = serializers.CharField(
        max_length=150,
        allow_blank=False,
        trim_whitespace=True,
        required=False,
    )

    latitude = serializers.DecimalField(
        max_digits=12,
        decimal_places=8,
        min_value=Decimal("-90"),
        max_value=Decimal("90"),
        required=False,
        allow_null=True,
    )

    longitude = serializers.DecimalField(
        max_digits=12,
        decimal_places=8,
        min_value=Decimal("-180"),
        max_value=Decimal("180"),
        required=False,
        allow_null=True,
    )

    sumber_koordinat = serializers.ChoiceField(
        choices=[
            "belum_tersedia",
            "manual_peta",
            "simulasi",
        ],
        required=False,
    )

    def validate(self, attrs):
        existing = self.context.get("existing_location")

        if not isinstance(existing, dict):
            raise serializers.ValidationError(
                "Data lokasi saat ini wajib tersedia."
            )

        if not attrs:
            raise serializers.ValidationError(
                "Minimal satu field harus diubah."
            )

        coordinate_fields = {
            "latitude",
            "longitude",
            "sumber_koordinat",
        }

        changes_coordinates = bool(
            coordinate_fields.intersection(attrs)
        )

        if existing.get("sumber_koordinat") == "gps_fisik":
            if changes_coordinates:
                raise serializers.ValidationError(
                    "Koordinat GPS fisik tidak boleh diubah "
                    "melalui CRUD biasa."
                )

            return attrs

        if changes_coordinates:
            linked = self.context.get(
                "linked_to_physical_bin"
            )

            if linked is not False:
                raise serializers.ValidationError(
                    "Perubahan koordinat memerlukan konfirmasi "
                    "backend bahwa lokasi tidak digunakan "
                    "tong fisik."
                )

        lat_provided = "latitude" in attrs
        lon_provided = "longitude" in attrs

        if lat_provided != lon_provided:
            raise serializers.ValidationError(
                "Perubahan koordinat harus menyertakan "
                "latitude dan longitude bersama."
            )

        source = attrs.get(
            "sumber_koordinat",
            existing.get("sumber_koordinat"),
        )

        latitude = attrs.get(
            "latitude",
            existing.get("latitude"),
        )

        longitude = attrs.get(
            "longitude",
            existing.get("longitude"),
        )

        if source not in {
            "belum_tersedia",
            "manual_peta",
            "simulasi",
        }:
            raise serializers.ValidationError(
                "Sumber koordinat saat ini tidak valid "
                "untuk perubahan manual."
            )

        has_lat = latitude is not None
        has_lon = longitude is not None

        if has_lat != has_lon:
            raise serializers.ValidationError(
                "Latitude dan longitude harus lengkap."
            )

        if source == "belum_tersedia" and has_lat:
            raise serializers.ValidationError(
                "Hapus kedua koordinat jika sumber "
                "diubah menjadi belum_tersedia."
            )

        if source in {"manual_peta", "simulasi"}:
            if not has_lat:
                raise serializers.ValidationError(
                    "Sumber koordinat ini memerlukan "
                    "latitude dan longitude."
                )

        if has_lat and latitude == 0 and longitude == 0:
            raise serializers.ValidationError(
                "Koordinat 0,0 tidak diperbolehkan."
            )

        return attrs


class BinUpdateInputSerializer(StrictInputSerializer):
    """Validasi PATCH tong tanpa menulis database."""

    id_lokasi = serializers.IntegerField(
        min_value=1,
        required=False,
    )

    kapasitas_liter = serializers.IntegerField(
        min_value=1,
        required=False,
        allow_null=True,
    )

    tinggi_acuan = serializers.DecimalField(
        max_digits=12,
        decimal_places=8,
        min_value=Decimal("0.00000001"),
        required=False,
        allow_null=True,
    )

    status_aktif = serializers.BooleanField(
        required=False,
    )

    def validate(self, attrs):
        existing = self.context.get("existing_bin")

        if not isinstance(existing, dict):
            raise serializers.ValidationError(
                "Data tong saat ini wajib tersedia."
            )

        if not attrs:
            raise serializers.ValidationError(
                "Minimal satu field harus diubah."
            )

        if "id_lokasi" in attrs:
            if existing.get("jenis_tong") != "virtual":
                raise serializers.ValidationError(
                    "Lokasi tong fisik tidak boleh dipindahkan "
                    "melalui CRUD biasa."
                )

        return attrs
