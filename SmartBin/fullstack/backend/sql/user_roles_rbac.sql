-- SMARTBIN S6-51
-- Struktur tabel role internal pengguna SmartBin.
-- Jalankan di Supabase SQL Editor pada proyek yang sesuai.
-- Tidak berisi data pengguna atau kredensial.

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    role TEXT NOT NULL
        CONSTRAINT user_roles_role_check
        CHECK (role IN ('admin', 'petugas', 'pengelola')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_roles IS
    'Role internal pengguna SmartBin untuk otorisasi RBAC.';
