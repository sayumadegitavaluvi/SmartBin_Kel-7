# 🗑️ SmartBin

> Sistem monitoring kondisi tempat sampah berbasis IoT untuk memantau tingkat kepenuhan, lokasi, pola akumulasi sampah, serta mendukung pelaporan warga dan pencatatan pengangkutan.

---

## 🌱 Tentang SmartBin

SmartBin adalah sistem monitoring tempat sampah berbasis Internet of Things (IoT) yang menggunakan ESP32 DevKit, sensor ultrasonik waterproof JSN-SR04T, dan GPS NEO-6M untuk memantau tingkat kepenuhan dan lokasi tempat sampah.

Data dikirim melalui Wi-Fi dan HTTPS REST API, disimpan pada Supabase PostgreSQL, kemudian ditampilkan melalui dashboard berbasis web.

SmartBin juga menerapkan clustering untuk mengelompokkan pola historis akumulasi kepenuhan sampah.

---

## ✨ Fitur Utama

🗑️ Monitoring tingkat kepenuhan tempat sampah  
📍 Monitoring lokasi tempat sampah  
🗺️ Peta 9 titik monitoring: 1 fisik dan 8 virtual  
🧠 Clustering pola akumulasi kepenuhan sampah  
📱 Pelaporan warga melalui QR Code tanpa login  
🚛 Konfirmasi dan riwayat pengangkutan  
🔔 Notifikasi pengangkutan yang belum dikonfirmasi  
👥 Hak akses berdasarkan peran  

---

## ⚙️ Cara Kerja

**Tempat Sampah 50 L**  
↓  
**JSN-SR04T + GPS NEO-6M**  
↓  
**ESP32 DevKit**  
↓  
**Wi-Fi + HTTPS REST API**  
↓  
**Supabase PostgreSQL**  
↓  
**Clustering**  
↓  
**Dashboard SmartBin**

Sensor JSN-SR04T digunakan untuk membaca jarak permukaan sampah sebagai dasar perhitungan tingkat kepenuhan, sedangkan GPS NEO-6M digunakan untuk memperoleh koordinat tong fisik.

---

## 🧠 Artificial Intelligence

SmartBin menguji tiga algoritma clustering:

🔵 **K-Means**  
🟣 **K-Medoids**  
🟠 **DBSCAN**

Berdasarkan hasil evaluasi, K-Means dipilih sebagai algoritma utama karena menghasilkan pengelompokan yang stabil dan mudah diinterpretasikan.

---

## 🛠️ Tech Stack

🔌 **IoT Hardware:** ESP32 DevKit • JSN-SR04T • GPS NEO-6M • Tong Sampah 50 L  
📡 **Communication:** Wi-Fi • HTTPS • REST API • JSON  
🗄️ **Database & Storage:** Supabase • PostgreSQL • Supabase Storage  
🧠 **Artificial Intelligence:** Python • K-Means Clustering  
🖥️ **Web Dashboard:** React.js  
🗺️ **Mapping:** Leaflet.js • OpenStreetMap  

---

## 👥 Pengguna Sistem

👨‍👩‍👧 **Warga** — memantau informasi publik dan menyampaikan laporan tanpa login.  
👷 **Petugas Lapangan** — menangani laporan dan mengonfirmasi pengangkutan.  
🧑‍💼 **Pengelola** — memantau kondisi tempat sampah, clustering, laporan, dan pengangkutan.  
🛠️ **Admin** — mengelola pengguna dan data sistem.

---

## 👥 Anggota Kelompok

1. Gadis Nirmala Sari — 24782010 — Hardware Engineer
2. Sayu Made Gita Valuvi — 24782030 — Firmware & Communication Engineer
3. Claudia Cyntia Bella — 24782040 — Full Stack Engineer
4. Naila Khansa Salsabilla — 24782056 — Project Manager
5. Yulia Roslina — 24782065 — AI Engineer

---

## ⚠️ Batasan Sistem

SmartBin dikembangkan sebagai prototipe dengan 1 tong fisik berkapasitas 50 liter dan 8 titik virtual.

Sistem berfokus pada monitoring kondisi tempat sampah dan tidak mencakup pengukuran berat, pengenalan jenis sampah, pelacakan kendaraan secara real-time, maupun optimasi rute pengangkutan.

---

**SmartBin — Monitor Smarter, Manage Better.**
