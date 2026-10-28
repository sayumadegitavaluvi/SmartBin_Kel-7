# SmartBin

**Sistem Monitoring Kondisi Tempat Sampah Berbasis IoT**

SmartBin merupakan sistem berbasis Internet of Things (IoT) untuk memantau tingkat kepenuhan dan lokasi tempat sampah, menganalisis pola akumulasi sampah menggunakan *clustering*, serta mendukung pelaporan warga dan pengelolaan pengangkutan.

Proyek ini dikembangkan oleh Kelompok 7, Program Studi Teknologi Rekayasa Internet, Politeknik Negeri Lampung.

## Fitur Utama

- **Monitoring:** Menampilkan tingkat kepenuhan, lokasi, dan waktu pembaruan tempat sampah.
- **Peta Interaktif:** Menampilkan 9 titik monitoring, terdiri atas 1 tong fisik dan 8 titik virtual berbasis simulasi.
- **Clustering:** Mengelompokkan lokasi berdasarkan pola historis akumulasi kepenuhan sampah menggunakan K-Means.
- **Pelaporan Warga:** Melalui satu QR Code umum tanpa login, dengan lampiran maksimal satu foto opsional.
- **Pengangkutan:** Pencatatan konfirmasi, riwayat, dan notifikasi jika pengangkutan hari sebelumnya belum dikonfirmasi.
- **Hak Akses:** Pembatasan fitur berdasarkan peran pengguna (RBAC).

## Teknologi dan Alur Sistem

**IoT:** ESP32 DevKit, sensor JSN-SR04T, GPS NEO-6M.

**Komunikasi:** Wi-Fi, HTTPS REST API, JSON.

**Database:** Supabase PostgreSQL dan Supabase Storage.

**AI:** Python dan K-Means Clustering sebagai algoritma utama.

**Web:** React.js, Leaflet.js, OpenStreetMap.

Alur pemantauan:

`Sensor & GPS → ESP32 → Wi-Fi/REST API → Supabase → Dashboard Web`

Data historis diolah menggunakan K-Means dan hasil pengelompokannya ditampilkan pada dashboard.

## Pengguna Sistem

| Pengguna | Tanggung Jawab |
|---|---|
| **Warga**             | Melihat informasi publik dan membuat laporan tanpa login. |
| **Petugas Lapangan**  | Menangani laporan operasional, mengonfirmasi pengangkutan, dan menerima notifikasi. |
| **Pengelola**         | Memantau sistem, laporan, hasil clustering, serta menangani laporan kerusakan tong/IoT. |
| **Admin**             | Mengelola akun, data tong, lokasi, dan validasi administratif laporan. |

## Tim Pengembang

| Nama | Peran |
|---|---|
| Gadis Nirmala Sari       | Hardware Engineer |
| Sayu Made Gita Valuvi    | Firmware & Communication Engineer |
| Claudia Cyntia Bella     | Full Stack Engineer |
| Naila Khansa Salsabilla  | Project Manager |
| Yulia Roslina            | AI Engineer |

## Batasan Sistem

SmartBin merupakan prototipe dengan **1 tong fisik berkapasitas 50 liter dan 8 titik virtual**. Sistem tidak mencakup pengukuran berat sampah, identifikasi jenis sampah otomatis, pelacakan kendaraan real-time, maupun optimasi rute pengangkutan.

---

**SmartBin — Monitor Smarter, Manage Better.**
