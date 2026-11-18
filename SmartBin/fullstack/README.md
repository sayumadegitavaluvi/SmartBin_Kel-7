# SmartBin — Fullstack

Repository pengembangan aplikasi SmartBin untuk Sprint 5 dan Sprint 6.

## Teknologi
- Backend: Django REST Framework
- Frontend: React + Vite
- Database: PostgreSQL (Supabase)
- Autentikasi: Supabase Auth (JWT)
- AI: K-Means Clustering

## Struktur Proyek
- `backend/` — API Django, pengujian, dan modul AI
- `backend/sql/` — skrip struktur database tambahan
- `frontend/` — dashboard React

## Menjalankan Backend

Buka terminal di folder `fullstack`:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Buat file `backend/.env` dan isi konfigurasi yang diperlukan:

```dotenv
DJANGO_SECRET_KEY=isi_dengan_secret_key_lokal
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
SUPABASE_SESSION_DATABASE_URL=isi_dengan_connection_string_supabase
```

Jangan commit file `.env` atau membagikan kredensial melalui GitHub.

Jalankan pemeriksaan:

```bash
python3 manage.py check
python3 manage.py test monitoring ai_clustering
python3 manage.py runserver
```

Backend berjalan di `http://127.0.0.1:8000/`.

## Menjalankan Frontend

Buka terminal kedua dari folder `fullstack`:

```bash
cd frontend
npm ci
```

Salin konfigurasi contoh:

```bash
cp .env.example .env.local
```

Isi `frontend/.env.local` dengan konfigurasi Supabase yang sesuai.

```bash
npm run dev
```

Buka URL lokal yang ditampilkan oleh Vite.

## Database dan Role

Gunakan proyek Supabase yang sudah disepakati bersama tim.

Skrip yang tersedia:
- `backend/sql/user_roles_rbac.sql`
- `backend/sql/hasil_clustering_s6_46_final.sql`

Catatan:
- Skrip SQL tidak otomatis dijalankan saat clone.
- Periksa kondisi database sebelum menjalankan skrip SQL.
- Akun Supabase Auth dan data pengguna tidak tersimpan dalam Git.
- Role internal yang digunakan: `admin`, `petugas`, dan `pengelola`.

## Catatan Pengembangan

Sprint 5–6 mencakup implementasi monitoring, dashboard,
integrasi AI Clustering, autentikasi, dan pembatasan akses RBAC.

Beberapa fitur lanjutan masih dalam pengembangan.
Keberhasilan build tidak menjamin semua fitur sudah selesai.

## Keamanan

- Jangan membagikan service role key, password, atau token.
- Jangan menempatkan secret di frontend.
- File environment lokal harus tetap berada di luar repository.
