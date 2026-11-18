import csv
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from monitoring.clustering_features import (
    calculate_clustering_features,
)
from ai_clustering.smartbin_clustering import predict_clustering


MINIMUM_JAM = 4320
KOLOM = {
    "id_tong",
    "tingkat_kepenuhan",
    "waktu_pembacaan",
    "sumber_data",
}


def load_csv(path):
    groups = defaultdict(list)

    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(file)

        if not reader.fieldnames or not KOLOM.issubset(
            reader.fieldnames
        ):
            raise ValueError("Kolom CSV tidak sesuai.")

        for nomor, row in enumerate(reader, start=2):
            if row["sumber_data"] != "simulasi":
                raise ValueError(
                    f"Baris {nomor}: sumber bukan simulasi."
                )

            try:
                fill = float(row["tingkat_kepenuhan"])
                timestamp = datetime.fromisoformat(
                    row["waktu_pembacaan"].replace(
                        "Z", "+00:00"
                    )
                )
            except (ValueError, TypeError) as exc:
                raise ValueError(
                    f"Baris {nomor}: data tidak valid."
                ) from exc

            if timestamp.tzinfo is None:
                raise ValueError(
                    f"Baris {nomor}: timestamp tanpa timezone."
                )

            if not 0 <= fill <= 100:
                raise ValueError(
                    f"Baris {nomor}: Fill di luar 0–100%."
                )

            groups[row["id_tong"]].append({
                "waktu_pembacaan": timestamp,
                "tingkat_kepenuhan": fill,
            })

    for rows in groups.values():
        rows.sort(key=lambda item: item["waktu_pembacaan"])

    return groups


def run_scenario(groups, accept_zero):
    label = (
        "A — Fill 0% diterima untuk simulasi"
        if accept_zero
        else "B — Fill 0% belum diverifikasi"
    )

    print(f"\n=== SKENARIO {label} ===")

    predictions = []

    for container_id, rows in sorted(
        groups.items(),
        key=lambda item: item[0],
    ):
        history = [
            {
                **row,
                "valid": (
                    True
                    if accept_zero
                    else row["tingkat_kepenuhan"] != 0
                ),
            }
            for row in rows
        ]

        evaluation = calculate_clustering_features(
            history
        )

        hours = evaluation["durasi_valid_jam"]
        eligible = hours >= MINIMUM_JAM

        status = (
            "CUKUP UNTUK UJI SIMULASI"
            if eligible
            else "DURASI BELUM CUKUP"
        )

        print(
            f"ID={container_id} | "
            f"pembacaan={evaluation['jumlah_pembacaan']} | "
            f"interval_valid="
            f"{evaluation['jumlah_interval_valid']} | "
            f"durasi={hours:.2f} jam | "
            f"{status}"
        )

        if eligible and evaluation["fitur"]:
            predictions.append({
                "Container_ID": container_id,
                **evaluation["fitur"],
            })

    if predictions:
        results = predict_clustering(predictions)

        print("\nHASIL MODEL — MODE PENGUJIAN SIMULASI")

        for result in results:
            print(
                f"ID={result['Container_ID']} | "
                f"Cluster={result['cluster']} | "
                f"Profil={result['profil_cluster']}"
            )
    else:
        print("Tidak ada data yang memenuhi syarat.")

    print(
        "\nCATATAN: Hasil ini bukan prediksi "
        "operasional SmartBin."
    )


def main():
    if len(sys.argv) != 2:
        raise SystemExit(
            "Penggunaan: python "
            "scripts/test_ai_dummy_180hari.py "
            "/lokasi/file.csv"
        )

    path = Path(sys.argv[1]).expanduser()

    if not path.is_file():
        raise SystemExit(
            f"File CSV tidak ditemukan: {path}"
        )

    groups = load_csv(path)

    total = sum(len(rows) for rows in groups.values())

    print("=== PENGUJIAN INTEGRASI AI SMARTBIN ===")
    print("Mode: PENGUJIAN SIMULASI")
    print("Jumlah tong:", len(groups))
    print("Total pembacaan:", total)
    print("Minimum interval valid:", MINIMUM_JAM, "jam")

    run_scenario(groups, accept_zero=True)
    run_scenario(groups, accept_zero=False)

    print("\n=== PENGUJIAN SELESAI ===")
    print("Tidak ada penulisan ke Supabase.")
    print("Tidak ada perubahan model AI.")


if __name__ == "__main__":
    main()
