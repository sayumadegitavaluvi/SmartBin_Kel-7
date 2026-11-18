
from datetime import datetime, timedelta
import math


FITUR_MODEL = (
    "Rata_rata_Fill_Waktu",
    "Persen_Waktu_GE80",
    "Persen_Waktu_LE20",
)


def calculate_clustering_features(readings):
    """
    Menghitung fitur berbobot waktu sesuai metode Tim AI.

    Setiap pembacaan memiliki:
    - waktu_pembacaan: datetime dengan zona waktu
    - tingkat_kepenuhan: angka 0 sampai 100
    - valid: True, False, atau None

    Validitas harus dipastikan oleh sumber data.
    None berarti pembacaan belum diverifikasi.
    """

    if not isinstance(readings, list):
        raise ValueError("Histori harus berupa list.")

    records = []

    for index, row in enumerate(readings):
        if not isinstance(row, dict):
            raise ValueError(f"Pembacaan ke-{index} bukan objek.")

        timestamp = row.get("waktu_pembacaan")

        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(
                timestamp.replace("Z", "+00:00")
            )

        if (
            not isinstance(timestamp, datetime)
            or timestamp.tzinfo is None
            or timestamp.utcoffset() is None
        ):
            raise ValueError(
                f"Waktu pembacaan ke-{index} harus memiliki zona waktu."
            )

        valid = row.get("valid") is True
        fill = None

        if valid:
            raw_fill = row.get("tingkat_kepenuhan")

            if isinstance(raw_fill, bool):
                raise ValueError("Fill tidak boleh berupa boolean.")

            try:
                fill = float(raw_fill)
            except (TypeError, ValueError, OverflowError):
                raise ValueError(
                    f"Fill pembacaan ke-{index} tidak valid."
                )

            if not math.isfinite(fill) or not 0 <= fill <= 100:
                raise ValueError(
                    f"Fill pembacaan ke-{index} harus 0-100."
                )

        records.append({
            "timestamp": timestamp,
            "fill": fill,
            "valid": valid,
        })

    records.sort(key=lambda item: item["timestamp"])

    total_jam = 0.0
    total_fill = 0.0
    total_ge80 = 0.0
    total_le20 = 0.0
    interval_valid = 0
    interval_dilewati = 0

    for awal, akhir in zip(records, records[1:]):
        durasi = akhir["timestamp"] - awal["timestamp"]

        if (
            not awal["valid"]
            or not akhir["valid"]
            or not timedelta(0) < durasi <= timedelta(hours=24)
        ):
            interval_dilewati += 1
            continue

        jam = durasi.total_seconds() / 3600
        fill_awal = awal["fill"]
        fill_akhir = akhir["fill"]

        total_jam += jam

        total_fill += (
            (fill_awal + fill_akhir) / 2
        ) * jam

        total_ge80 += (
            (int(fill_awal >= 80) + int(fill_akhir >= 80)) / 2
        ) * jam

        total_le20 += (
            (int(fill_awal <= 20) + int(fill_akhir <= 20)) / 2
        ) * jam

        interval_valid += 1

    hasil = {
        "jumlah_pembacaan": len(records),
        "jumlah_interval_valid": interval_valid,
        "jumlah_interval_dilewati": interval_dilewati,
        "durasi_valid_jam": total_jam,
        "fitur": None,
    }

    if total_jam <= 0:
        hasil["status"] = "belum_ada_interval_valid"
        return hasil

    hasil["status"] = "fitur_tersedia_belum_validasi_operasional"
    hasil["fitur"] = {
        "Rata_rata_Fill_Waktu": total_fill / total_jam,
        "Persen_Waktu_GE80": total_ge80 / total_jam * 100,
        "Persen_Waktu_LE20": total_le20 / total_jam * 100,
    }

    return hasil
