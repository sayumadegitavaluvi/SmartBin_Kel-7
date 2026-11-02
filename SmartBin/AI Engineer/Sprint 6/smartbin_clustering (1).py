
"""
Modul Inferensi Clustering SmartBin

Input:
    Satu dictionary atau list dictionary berisi fitur kontainer.
    Nilai fitur harus dalam skala asli (belum distandardisasi).

Output:
    Dictionary atau list dictionary berisi Container_ID (jika ada),
    label cluster, nama profil, dan interpretasi.
"""

from pathlib import Path
import math
import joblib
import pandas as pd


FITUR_MODEL = [
    "Rata_rata_Fill_Waktu",
    "Persen_Waktu_GE80",
    "Persen_Waktu_LE20",
]


PROFIL_CLUSTER = {
    0: {
        "nama": "Keterisian menengah",
        "interpretasi": (
            "Rata-rata Fill relatif menengah; pola keterisian tinggi "
            "tidak dominan."
        ),
    },
    1: {
        "nama": "Keterisian tinggi",
        "interpretasi": (
            "Rata-rata Fill paling tinggi dan proporsi waktu Fill >= 80% "
            "paling besar di antara ketiga cluster."
        ),
    },
    2: {
        "nama": "Keterisian rendah",
        "interpretasi": (
            "Rata-rata Fill paling rendah dan proporsi waktu Fill <= 20% "
            "paling besar di antara ketiga cluster."
        ),
    },
}


def load_model(model_path=None):
    """Memuat model K-Means, scaler, dan metadata."""

    if model_path is None:
        model_path = Path(__file__).with_name(
            "smartbin_kmeans_model.pkl"
        )
    else:
        model_path = Path(model_path)

    if not model_path.is_file():
        raise FileNotFoundError(
            f"File model tidak ditemukan: {model_path}"
        )

    paket = joblib.load(model_path)

    for komponen in ("model", "scaler", "metadata"):
        if komponen not in paket:
            raise ValueError(
                f"Paket model tidak memiliki komponen '{komponen}'."
            )

    metadata = paket["metadata"]

    if metadata.get("fitur") != FITUR_MODEL:
        raise ValueError(
            "Nama atau urutan fitur tidak sesuai dengan model."
        )

    if paket["model"].n_features_in_ != len(FITUR_MODEL):
        raise ValueError("Jumlah fitur model tidak sesuai.")

    if paket["scaler"].n_features_in_ != len(FITUR_MODEL):
        raise ValueError("Jumlah fitur scaler tidak sesuai.")

    return paket


def predict_clustering(data, model_path=None):
    """
    Melakukan prediksi cluster untuk satu atau beberapa kontainer.
    """

    satu_data = isinstance(data, dict)
    records = [data] if satu_data else data

    if not isinstance(records, list) or len(records) == 0:
        raise ValueError(
            "Input harus berupa dictionary atau list "
            "dictionary yang tidak kosong."
        )

    matriks_fitur = []

    for indeks, record in enumerate(records):

        if not isinstance(record, dict):
            raise TypeError(
                f"Data ke-{indeks} harus berupa dictionary."
            )

        nilai_fitur = []

        for nama_fitur in FITUR_MODEL:

            if nama_fitur not in record:
                raise ValueError(
                    f"Data ke-{indeks} tidak memiliki fitur "
                    f"'{nama_fitur}'."
                )

            try:
                nilai = float(record[nama_fitur])
            except (TypeError, ValueError):
                raise ValueError(
                    f"Fitur '{nama_fitur}' harus bernilai numerik."
                )

            if not math.isfinite(nilai):
                raise ValueError(
                    f"Fitur '{nama_fitur}' harus bernilai finite."
                )

            nilai_fitur.append(nilai)

        matriks_fitur.append(nilai_fitur)

    # Memuat model dan scaler
    paket = load_model(model_path)

    # Menggunakan DataFrame agar nama fitur tetap dikenali scaler
    X = pd.DataFrame(
        matriks_fitur,
        columns=FITUR_MODEL
    )

    # Standardisasi dan prediksi
    X_scaled = paket["scaler"].transform(X)
    labels = paket["model"].predict(X_scaled)

    # Menyusun hasil prediksi
    hasil = []

    for record, label in zip(records, labels):

        label = int(label)

        profil = PROFIL_CLUSTER.get(
            label,
            {
                "nama": f"Cluster {label}",
                "interpretasi": (
                    "Profil cluster belum didefinisikan."
                ),
            }
        )

        output = {
            "cluster": label,
            "profil_cluster": profil["nama"],
            "interpretasi": profil["interpretasi"],
        }

        if "Container_ID" in record:
            output["Container_ID"] = record["Container_ID"]

        hasil.append(output)

    return hasil[0] if satu_data else hasil
