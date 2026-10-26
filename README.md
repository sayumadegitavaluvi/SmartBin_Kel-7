# 🗑️ SmartBin

> Sistem monitoring kondisi tempat sampah berbasis IoT untuk memantau tingkat kepenuhan, lokasi, pola akumulasi sampah, serta mendukung pelaporan warga dan pencatatan pengangkutan.

---

## 🌱 Tentang SmartBin

SmartBin adalah sistem monitoring kondisi tempat sampah berbasis Internet of Things (IoT) yang dirancang untuk membantu pemantauan tingkat kepenuhan dan lokasi tempat sampah secara berkala.

Sistem menggunakan ESP32 DevKit sebagai mikrokontroler, sensor ultrasonik waterproof JSN-SR04T untuk membaca jarak permukaan sampah, serta modul GPS NEO-6M untuk memperoleh koordinat lokasi tong fisik.

Data hasil monitoring dikirim melalui jaringan Wi-Fi menggunakan HTTPS REST API dan disimpan pada Supabase PostgreSQL.

SmartBin juga menerapkan Artificial Intelligence (AI) menggunakan metode clustering untuk mengelompokkan pola historis akumulasi kepenuhan sampah serta menyediakan dashboard monitoring, pelaporan warga melalui QR Code, riwayat pengangkutan, dan notifikasi pengangkutan.

---

## ✨ Fitur Utama

🗑️ Monitoring tingkat kepenuhan tempat sampah
📍 Monitoring koordinat lokasi tempat sampah
📡 Pengiriman data IoT secara berkala
🗺️ Peta persebaran titik monitoring
🧠 Clustering pola akumulasi kepenuhan sampah
📊 Dashboard monitoring berbasis web
📱 Pelaporan warga melalui QR Code tanpa login
📷 Upload foto bukti secara opsional
📝 Riwayat dan status laporan warga
🚛 Konfirmasi dan riwayat pengangkutan
🔔 Notifikasi pengangkutan yang belum dikonfirmasi
👥 Hak akses pengguna berdasarkan peran

---

## ⚙️ Cara Kerja

🗑️ Tempat Sampah 50 L
↓
📏 JSN-SR04T + 📍 GPS NEO-6M
↓
⚙️ ESP32 DevKit
↓
📶 Wi-Fi
↓
🔗 HTTPS REST API
↓
🗄️ Supabase PostgreSQL
↓
🧠 Clustering
↓
📊 Dashboard SmartBin
↓
👥 Warga • Petugas Lapangan • Pengelola • Admin

Sensor JSN-SR04T membaca jarak antara sensor dan permukaan sampah sebagai dasar perhitungan persentase tingkat kepenuhan.

Modul GPS NEO-6M digunakan untuk memperoleh koordinat latitude dan longitude tong fisik.

Riwayat tingkat kepenuhan yang tersimpan kemudian dapat digunakan untuk menganalisis pola akumulasi sampah menggunakan metode clustering.

---

## 🔌 Perangkat IoT

⚙️ **ESP32 DevKit**
Berfungsi sebagai mikrokontroler utama untuk membaca data sensor, memproses data, menghubungkan perangkat ke Wi-Fi, dan mengirim data menuju backend.

📏 **JSN-SR04T Waterproof Ultrasonic Sensor**
Berfungsi mengukur jarak antara posisi sensor dan permukaan sampah. Nilai jarak digunakan sebagai dasar perhitungan persentase kepenuhan tong.

📍 **GPS NEO-6M**
Berfungsi memperoleh koordinat latitude dan longitude dari tempat sampah fisik.

🗑️ **Tong Sampah 50 Liter**
Digunakan sebagai prototipe fisik SmartBin untuk pemasangan perangkat IoT dan pengujian sistem.

🔌 **Breadboard dan Kabel Jumper**
Digunakan sebagai media perakitan dan penghubung antara ESP32 dengan sensor serta perangkat pendukung selama proses pengembangan dan pengujian.

---

## 🧠 Artificial Intelligence

SmartBin menggunakan metode clustering untuk mengelompokkan pola akumulasi kepenuhan sampah berdasarkan data historis.

Pada tahap pengembangan dilakukan pengujian terhadap tiga kandidat algoritma:

🔵 K-Means
🟣 K-Medoids
🟠 DBSCAN

Berdasarkan hasil evaluasi, K-Means dipilih sebagai algoritma utama karena menghasilkan pengelompokan yang stabil, seluruh data dapat dikelompokkan, dan hasil cluster mudah diinterpretasikan.

---

## 🗑️ Titik Monitoring

SmartBin memiliki 9 titik monitoring, terdiri dari:

🟢 **1 tempat sampah fisik**
Menggunakan ESP32 DevKit, sensor ultrasonik AJ-SR04M, dan GPS NEO-6M untuk memperoleh data monitoring secara langsung.

🟠 **8 titik tempat sampah virtual**
Menggunakan data simulasi untuk mendukung pengujian sistem, clustering, dan visualisasi dashboard.

Data fisik dan data virtual dibedakan agar tidak tercampur dalam proses monitoring dan analisis.

---

## 🛠️ Tech Stack

🔌 **IoT Hardware**
ESP32 DevKit • JSN-SR04T • GPS NEO-6M • Tong Sampah 50 L

📡 **Communication**
Wi-Fi • HTTPS • REST API • JSON

🗄️ **Database & Storage**
Supabase • PostgreSQL • Supabase Storage

🧠 **Artificial Intelligence**
Python • Clustering

🖥️ **Web Dashboard**
React.js

🗺️ **Mapping**
Leaflet.js • OpenStreetMap

---

## 📱 Pelaporan Warga

Warga dapat menyampaikan laporan kondisi tempat sampah melalui satu QR Code umum SmartBin tanpa login.

Warga dapat memilih ID tempat sampah, menentukan jenis laporan, menambahkan keterangan, serta mengunggah maksimal satu foto bukti secara opsional.

Status laporan dapat dipantau melalui halaman publik tanpa menampilkan foto bukti maupun catatan internal.

---

## 🚛 Pengangkutan Sampah

Petugas Lapangan dapat mencatat konfirmasi setelah proses pengangkutan selesai.

SmartBin menyimpan riwayat pengangkutan dan memberikan notifikasi apabila pengangkutan pada hari sebelumnya belum memiliki konfirmasi sesuai jadwal operasional.

Notifikasi digunakan sebagai pengingat untuk melakukan pemeriksaan dan tindak lanjut, bukan sebagai bukti otomatis bahwa pengangkutan tidak dilakukan.

---

## 👥 Pengguna Sistem

👨‍👩‍👧 **Warga**
Memantau informasi publik dan menyampaikan laporan tanpa login.

👷 **Petugas Lapangan**
Menangani laporan operasional, mengonfirmasi pengangkutan, dan memeriksa notifikasi.

🧑‍💼 **Pengelola**
Memantau kondisi tempat sampah, hasil clustering, laporan warga, dan kegiatan pengangkutan.

🛠️ **Admin**
Mengelola pengguna internal, data tempat sampah, lokasi, titik virtual, dan validasi laporan.

---

## 👥 Anggota Kelompok

1. Gadis Nirmala Sari — 24782010 — Hardware Engineer
2. Sayu Made Gita Valuvi — 24782030 — Firmware & Communication Engineer
3. Claudia Cyntia Bella — 24782040 — Full Stack Engineer
4. Naila Khansa Salsabilla — 24782056 — Project Manager
5. Yulia Roslina — 24782065 — AI Engineer

---

## ⚠️ Batasan Sistem

SmartBin dikembangkan sebagai prototipe monitoring tempat sampah dengan satu tong fisik berkapasitas 50 liter dan delapan titik virtual.

Sistem tidak digunakan untuk mengukur berat sampah, mengenali jenis sampah secara otomatis, melakukan pelacakan kendaraan secara real-time, maupun menentukan rute pengangkutan.

Hasil clustering digunakan sebagai informasi pendukung monitoring dan evaluasi, bukan sebagai penentu otomatis prioritas pengangkutan.

---

**SmartBin — Monitor Smarter, Manage Better.**
