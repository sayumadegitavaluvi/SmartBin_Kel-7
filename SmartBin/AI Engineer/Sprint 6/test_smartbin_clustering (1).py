"""
Contoh pengujian modul inferensi SmartBin.

Jalankan dari direktori yang berisi:
- smartbin_clustering.py
- smartbin_kmeans_model.pkl

Perintah:
    python test_smartbin_clustering.py
"""

from smartbin_clustering import predict_clustering

data_contoh = [
    {
        "Container_ID": "CONTOH-MENENGAH",
        "Rata_rata_Fill_Waktu": 33.64,
        "Persen_Waktu_GE80": 4.68,
        "Persen_Waktu_LE20": 33.35,
    },
    {
        "Container_ID": "CONTOH-TINGGI",
        "Rata_rata_Fill_Waktu": 45.81,
        "Persen_Waktu_GE80": 13.51,
        "Persen_Waktu_LE20": 23.45,
    },
    {
        "Container_ID": "CONTOH-RENDAH",
        "Rata_rata_Fill_Waktu": 25.74,
        "Persen_Waktu_GE80": 1.67,
        "Persen_Waktu_LE20": 44.63,
    },
]

hasil = predict_clustering(data_contoh)

print("Jumlah data diproses:", len(hasil))
print("\nHasil inferensi:")
for item in hasil:
    print(item)

assert len(hasil) == len(data_contoh)
assert all("cluster" in item for item in hasil)
assert all("profil_cluster" in item for item in hasil)

print("\nPengujian struktur output berhasil.")
