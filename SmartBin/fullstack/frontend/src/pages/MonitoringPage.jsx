import { useState } from 'react';
import { getMonitoringFreshness } from '../utils/monitoringFreshness';
import './MonitoringPage.css';

function formatPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return `${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatTime(value) {
  if (!value) return 'Belum ada pembacaan';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Waktu tidak valid';
  }

  return `${date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  })} WIB`;
}

function MonitoringPage({ bins, loading, error, nowMs }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('semua');

  const filteredBins = bins.filter((bin) => {
    const matchesType =
      filter === 'semua' || bin.jenis_tong === filter;

    const keyword = search.toLowerCase().trim();
    const searchableText = [
      bin.kode_tong,
      bin.lokasi?.nama_lokasi,
    ].filter(Boolean).join(' ').toLowerCase();

    return matchesType && searchableText.includes(keyword);
  });

  const totalFisik = bins.filter(
    (bin) => bin.jenis_tong === 'fisik'
  ).length;

  const totalVirtual = bins.filter(
    (bin) => bin.jenis_tong === 'virtual'
  ).length;

  return (
    <div className="m-page">
      <header className="m-page-hero">
        <div>
          <span className="m-page-eyebrow">
            SMARTBIN · MONITORING
          </span>
          <h1>Monitoring Tong Sampah</h1>
          <p>
            Pantau kondisi kepenuhan dan pembacaan terakhir
            setiap tong sampah yang terdaftar.
          </p>
        </div>
        <div className="m-page-hero-deco" aria-hidden="true">
          <span>✦</span>
          <span>♻</span>
        </div>
      </header>

      <div className="m-summary">
        <div className="m-summary-card">
          <span>Total Tong</span>
          <strong>{bins.length}</strong>
          <small>Unit terdaftar</small>
        </div>

        <div className="m-summary-card">
          <span>Tong Fisik</span>
          <strong>{totalFisik}</strong>
          <small>Perangkat fisik</small>
        </div>

        <div className="m-summary-card">
          <span>Tong Virtual</span>
          <strong>{totalVirtual}</strong>
          <small>Data simulasi</small>
        </div>
      </div>

      <section className="m-results">
        <div className="m-results-heading">
          <div>
            <h2>Daftar Monitoring</h2>
            <p>
              Cari berdasarkan kode tong atau nama lokasi.
            </p>
          </div>
          <span className="m-results-count">
            {filteredBins.length} tong
          </span>
        </div>

        <div className="m-toolbar">
          <input
            type="search"
            aria-label="Cari tong atau lokasi"
            placeholder="Cari kode tong atau lokasi..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="m-filter" aria-label="Filter jenis tong">
            {[
              ['semua', 'Semua'],
              ['fisik', 'Fisik'],
              ['virtual', 'Virtual'],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={filter === value ? 'selected' : ''}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="m-message" role="alert">{error}</p>}
        {loading && <p className="m-message">Memuat monitoring...</p>}

        {!loading && filteredBins.length === 0 && (
          <p className="m-message">
            Tidak ada tong yang sesuai dengan pencarian.
          </p>
        )}

        <div className="m-card-grid">
          {filteredBins.map((bin) => {
            const fill = bin.monitoring?.tingkat_kepenuhan;
            const hasFill =
              typeof fill === 'number' && Number.isFinite(fill);

            const percent = hasFill
              ? Math.min(100, Math.max(0, fill))
              : 0;

            const freshness = getMonitoringFreshness(bin, nowMs);

            const tone = !hasFill
              ? 'unknown'
              : percent >= 80
                ? 'high'
                : percent >= 50
                  ? 'medium'
                  : 'low';

            return (
              <article className="m-bin-card" key={bin.id_tong}>
                <div className="m-bin-heading">
                  <strong>{bin.kode_tong}</strong>
                  <span className={
                    bin.jenis_tong === 'fisik'
                      ? 'm-source physical'
                      : 'm-source virtual'
                  }>
                    {bin.jenis_tong === 'fisik'
                      ? 'Fisik'
                      : 'Simulasi'}
                  </span>
                </div>

                <div className="m-bin-reading">
                  <strong className={`m-value ${tone}`}>
                    {formatPercent(fill)}
                  </strong>
                  <span>Tingkat kepenuhan terakhir</span>

                  <div
                    className={`m-level-track ${tone}`}
                    role="progressbar"
                    aria-label={`Kepenuhan ${bin.kode_tong}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={hasFill ? percent : undefined}
                  >
                    <div style={{ width: `${percent}%` }} />
                  </div>
                </div>

                <div className="m-bin-details">
                  <span>Lokasi</span>
                  <strong>
                    {bin.lokasi?.nama_lokasi ??
                      'Lokasi belum tersedia'}
                  </strong>

                  <span>Pembacaan terakhir</span>
                  <strong>
                    {formatTime(
                      bin.monitoring?.waktu_pembacaan
                    )}
                  </strong>
                </div>

                <div className="m-bin-footer">
                  <strong>{freshness.label}</strong>
                  <small>{freshness.description}</small>
                </div>
              </article>
            );
          })}
        </div>

        <p className="m-disclaimer">
          Data diperiksa kembali setiap 60 detik. Data simulasi
          bukan pembacaan perangkat fisik. Informasi kepenuhan
          tidak selalu menunjukkan kondisi sensor saat ini.
        </p>
      </section>
    </div>
  );
}

export default MonitoringPage;
