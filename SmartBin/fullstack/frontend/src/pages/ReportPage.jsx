import { useState } from 'react';
import { getMonitoringFreshness } from '../utils/monitoringFreshness';
import './ReportPage.css';

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

function csvCell(value) {
  const text = String(value ?? '');

  // Mencegah teks database dibaca sebagai formula spreadsheet.
  const safe = /^[\s]*[=+\-@]/u.test(text)
    ? `'${text}`
    : text;

  return `"${safe.replace(/"/g, '""')}"`;
}

function ReportPage({
  bins = [],
  loading = false,
  error = '',
  nowMs: providedNowMs,
}) {
  const [initialNowMs] = useState(() => Date.now());
  const nowMs = providedNowMs ?? initialNowMs;

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('semua');
  const [sortBy, setSortBy] = useState('kode');

  const physicalCount = bins.filter(
    (bin) => bin.jenis_tong === 'fisik'
  ).length;

  const virtualCount = bins.filter(
    (bin) => bin.jenis_tong === 'virtual'
  ).length;

  const readingCount = bins.filter(
    (bin) => bin.monitoring != null
  ).length;

  const keyword = search.trim().toLowerCase();

  const visibleBins = bins
    .filter((bin) => {
      const matchesType =
        filter === 'semua' || bin.jenis_tong === filter;

      const matchesSearch = [
        bin.kode_tong,
        bin.lokasi?.nama_lokasi,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);

      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'kepenuhan') {
        const getFill = (bin) => {
          const value = bin.monitoring?.tingkat_kepenuhan;
          return typeof value === 'number' &&
            Number.isFinite(value)
            ? value
            : -1;
        };

        return getFill(b) - getFill(a);
      }

      return String(a.kode_tong).localeCompare(
        String(b.kode_tong),
        'id'
      );
    });

  function downloadCsv() {
    if (loading || error || visibleBins.length === 0) return;

    const headers = [
      'Kode Tong',
      'Jenis Tong',
      'Lokasi',
      'Kepenuhan (%)',
      'Waktu Pembacaan',
      'Sumber Data',
      'Status Keterbaruan',
      'Keterangan',
    ];

    const dataRows = visibleBins.map((bin) => {
      const monitoring = bin.monitoring;
      const freshness = getMonitoringFreshness(bin, nowMs);

      return [
        bin.kode_tong,
        bin.jenis_tong,
        bin.lokasi?.nama_lokasi ?? '',
        monitoring?.tingkat_kepenuhan ?? '',
        monitoring?.waktu_pembacaan ?? '',
        monitoring?.sumber_data ?? '',
        freshness.label,
        freshness.description,
      ];
    });

    const csv = '\uFEFF' + [headers, ...dataRows]
      .map((row) => row.map(csvCell).join(';'))
      .join('\r\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
      `smartbin-monitoring-terbaru-${new Date()
        .toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="rp-page">
      <header className="rp-hero">
        <span className="rp-eyebrow">
          SMARTBIN · LAPORAN
        </span>

        <h1>Laporan Monitoring SmartBin</h1>

        <p>
          Ringkasan pembacaan terakhir setiap tong sampah
          berdasarkan data yang tersedia pada sistem.
        </p>

        <span className="rp-hero-tag">
          Ringkasan Monitoring Terbaru
        </span>
      </header>

      <div className="rp-stats">
        {[
          ['Total Tong', bins.length, 'Terdaftar'],
          ['Tong Fisik', physicalCount, 'Perangkat fisik'],
          ['Tong Virtual', virtualCount, 'Data simulasi'],
          ['Ada Pembacaan', readingCount, 'Tong dengan data'],
        ].map(([label, value, description]) => (
          <div className="rp-stat" key={label}>
            <span>{label}</span>
            <strong>{loading ? '...' : value}</strong>
            <small>{description}</small>
          </div>
        ))}
      </div>

      <section className="rp-panel">
        <div className="rp-heading">
          <div>
            <h2>Ringkasan Kondisi Tong</h2>
            <p>
              Satu pembacaan terakhir per tong, bukan
              rekapitulasi histori harian atau bulanan.
            </p>
          </div>

          <span className="rp-count">
            {visibleBins.length} tong
          </span>
        </div>

        <div className="rp-toolbar">
          <div className="rp-search">
            <label htmlFor="rp-search-input">
              Cari tong atau lokasi
            </label>

            <input
              id="rp-search-input"
              type="search"
              placeholder="Contoh: SB-F001 atau GKB"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="rp-field">
            <label htmlFor="rp-type-filter">
              Jenis tong
            </label>

            <select
              id="rp-type-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="semua">Semua</option>
              <option value="fisik">Fisik</option>
              <option value="virtual">Virtual</option>
            </select>
          </div>

          <div className="rp-field">
            <label htmlFor="rp-sort">
              Urutkan
            </label>

            <select
              id="rp-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="kode">Kode tong</option>
              <option value="kepenuhan">
                Kepenuhan tertinggi
              </option>
            </select>
          </div>
        </div>

        <div className="rp-actions">
          <span>
            Status pembacaan diperiksa setiap 60 detik.
          </span>

          <button
            type="button"
            onClick={downloadCsv}
            disabled={
              loading ||
              Boolean(error) ||
              visibleBins.length === 0
            }
          >
            Unduh Ringkasan CSV
          </button>
        </div>

        {error && (
          <p className="rp-error" role="alert">
            Data tidak dapat diperbarui: {error}
          </p>
        )}

        {loading && (
          <p className="rp-empty">
            Mengambil data monitoring...
          </p>
        )}

        {!loading && visibleBins.length === 0 && (
          <p className="rp-empty">
            Tidak ada tong yang sesuai dengan filter.
          </p>
        )}

        {!loading && visibleBins.length > 0 && (
          <div className="rp-table-wrapper">
            <table className="rp-table">
              <thead>
                <tr>
                  <th scope="col">Kode Tong</th>
                  <th scope="col">Jenis</th>
                  <th scope="col">Lokasi</th>
                  <th scope="col">Kepenuhan</th>
                  <th scope="col">Waktu Pembacaan</th>
                  <th scope="col">Sumber</th>
                  <th scope="col">Keterbaruan</th>
                </tr>
              </thead>

              <tbody>
                {visibleBins.map((bin) => {
                  const freshness = getMonitoringFreshness(
                    bin,
                    nowMs
                  );

                  const fill =
                    bin.monitoring?.tingkat_kepenuhan;

                  return (
                    <tr key={bin.id_tong}>
                      <th scope="row">
                        {bin.kode_tong}
                      </th>

                      <td>
                        {bin.jenis_tong === 'fisik'
                          ? 'Fisik'
                          : 'Virtual'}
                      </td>

                      <td>
                        {bin.lokasi?.nama_lokasi ??
                          'Belum tersedia'}
                      </td>

                      <td>
                        <strong className="rp-fill">
                          {formatPercent(fill)}
                        </strong>
                      </td>

                      <td>
                        {formatTime(
                          bin.monitoring?.waktu_pembacaan
                        )}
                      </td>

                      <td>
                        {bin.monitoring?.sumber_data === 'fisik'
                          ? 'Sensor fisik'
                          : bin.monitoring?.sumber_data ===
                              'simulasi'
                            ? 'Simulasi'
                            : bin.monitoring?.sumber_data ??
                              'Belum ada'}
                      </td>

                      <td>
                        <span className="rp-status">
                          {freshness.label}
                        </span>

                        <small>
                          {freshness.description}
                        </small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="rp-note">
          Ringkasan ini mencampurkan tong fisik dan virtual
          dengan label sumber yang berbeda. Data lama
          tidak dianggap real-time. CSV hanya memuat
          pembacaan terakhir dari tong hasil filter;
          bukan histori lengkap atau hasil AI tervalidasi.
        </p>
      </section>
    </div>
  );
}

export default ReportPage;
