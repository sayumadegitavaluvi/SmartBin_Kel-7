"""
Aturan pemeriksaan awal penghapusan data SmartBin.

Tidak mengakses database.
Tidak menjalankan operasi DELETE.
"""


def valid_count(value):
    return type(value) is int and value >= 0


def check_bin_delete(
    *,
    jenis_tong,
    jumlah_histori,
    jumlah_perangkat,
):
    """
    Memeriksa syarat awal penghapusan tong.

    candidate=True bukan izin untuk menghapus.
    Autentikasi, relasi lain, dan transaksi aman
    tetap wajib diperiksa sebelum operasi nyata.
    """

    if jenis_tong not in {"fisik", "virtual"}:
        return {
            "candidate": False,
            "reason": "Jenis tong tidak valid.",
        }

    if not all(
        valid_count(value)
        for value in (jumlah_histori, jumlah_perangkat)
    ):
        return {
            "candidate": False,
            "reason": "Jumlah relasi tidak valid.",
        }

    if jenis_tong == "fisik":
        return {
            "candidate": False,
            "reason": (
                "Tong fisik tidak boleh dihapus "
                "melalui CRUD biasa."
            ),
        }

    if jumlah_perangkat > 0:
        return {
            "candidate": False,
            "reason": (
                "Tong masih terhubung dengan perangkat IoT."
            ),
        }

    if jumlah_histori > 0:
        return {
            "candidate": False,
            "reason": (
                "Tong masih mempunyai histori sensor."
            ),
        }

    return {
        "candidate": True,
        "reason": (
            "Lolos pemeriksaan awal. "
            "Penghapusan masih memerlukan otorisasi "
            "dan pemeriksaan relasi database lainnya."
        ),
    }


def check_location_delete(*, jumlah_tong):
    """
    Memeriksa syarat awal penghapusan lokasi.
    """

    if not valid_count(jumlah_tong):
        return {
            "candidate": False,
            "reason": "Jumlah tong tidak valid.",
        }

    if jumlah_tong > 0:
        return {
            "candidate": False,
            "reason": (
                "Lokasi masih digunakan tempat sampah."
            ),
        }

    return {
        "candidate": True,
        "reason": (
            "Lokasi tidak memiliki tong. "
            "Penghapusan masih memerlukan otorisasi "
            "dan pemeriksaan relasi database lainnya."
        ),
    }
