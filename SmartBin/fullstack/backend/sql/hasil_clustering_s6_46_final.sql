-- SMARTBIN S6-46
-- FINAL CANDIDATE: HASIL CLUSTERING
-- Review sebelum menjalankan di Supabase.
-- Tidak memasukkan data sensor atau hasil dummy.

BEGIN;

CREATE TABLE public.hasil_clustering (
    id_hasil bigint
        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    id_tong bigint NOT NULL
        REFERENCES public.tong_sampah(id_tong),

    cluster integer
        CHECK (cluster IN (0, 1, 2)),

    profil_cluster text,
    interpretasi text,

    fitur jsonb
        CHECK (
            fitur IS NULL OR
            jsonb_typeof(fitur) = 'object'
        ),

    jumlah_pembacaan integer NOT NULL DEFAULT 0
        CHECK (jumlah_pembacaan >= 0),

    jumlah_interval_valid integer NOT NULL DEFAULT 0
        CHECK (jumlah_interval_valid >= 0),

    durasi_valid_jam numeric NOT NULL DEFAULT 0
        CHECK (durasi_valid_jam >= 0),

    periode_awal timestamptz,
    periode_akhir timestamptz,

    sumber_input text NOT NULL
        CHECK (
            sumber_input IN (
                'histori_fisik',
                'histori_simulasi'
            )
        ),

    versi_model text,

    mode text NOT NULL DEFAULT 'pengujian'
        CHECK (mode IN ('pengujian', 'operasional')),

    operasional_tervalidasi boolean
        NOT NULL DEFAULT false,

    waktu_analisis timestamptz
        NOT NULL DEFAULT now(),

    CONSTRAINT chk_periode_clustering
        CHECK (
            (
                periode_awal IS NULL
                AND periode_akhir IS NULL
            )
            OR (
                periode_awal IS NOT NULL
                AND periode_akhir IS NOT NULL
                AND periode_akhir >= periode_awal
            )
        ),

    CONSTRAINT chk_interval_clustering
        CHECK (
            jumlah_interval_valid <=
            GREATEST(jumlah_pembacaan - 1, 0)
        ),

    CONSTRAINT chk_mode_clustering
        CHECK (
            mode <> 'operasional'
            OR sumber_input = 'histori_fisik'
        ),

    CONSTRAINT chk_operasional_clustering
        CHECK (
            operasional_tervalidasi = false
            OR (
                mode = 'operasional'
                AND sumber_input = 'histori_fisik'
                AND durasi_valid_jam >= 4320
                AND cluster IS NOT NULL
                AND fitur IS NOT NULL
                AND versi_model IS NOT NULL
                AND periode_awal IS NOT NULL
                AND periode_akhir IS NOT NULL
            )
        )
);

CREATE INDEX idx_hasil_clustering_tong_waktu
ON public.hasil_clustering (
    id_tong,
    waktu_analisis DESC
);

ALTER TABLE public.hasil_clustering
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hasil_clustering
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
