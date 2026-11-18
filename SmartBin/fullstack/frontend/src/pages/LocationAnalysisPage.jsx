import { useState } from 'react';
import BinLocationMap from '../components/BinLocationMap';
import { getMonitoringFreshness } from '../utils/monitoringFreshness';
import './LocationAnalysisPage.css';

function hasCoordinates(bin) {
  const rawLat = bin.lokasi?.latitude;
  const rawLng = bin.lokasi?.longitude;

  if (
    rawLat == null ||
    rawLng == null ||
    rawLat === '' ||
    rawLng === ''
  ) {
    return false;
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function formatPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Belum tersedia';
  }

  return `${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function LocationAnalysisPage({
  bins = [],
  loading = false,
  error = '',
  nowMs,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('semua');
  const [selectedId, setSelectedId] = useState(null);

  const keyword = search.trim().toLowerCase();

  const visibleBins = bins.filter((bin) => {
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
  });

  const selectedBin = visibleBins.find(
    (bin) => String(bin.id_tong) === selectedId
  ) ?? null;

  const mapBins = selectedBin ? [selectedBin] : visibleBins;

  const physicalCount = bins.filter(
    (bin) => bin.jenis_tong === 'fisik'
  ).length;

  const virtualCount = bins.filter(
    (bin) => bin.jenis_tong === 'virtual'
  ).length;

  const mappedCount = visibleBins.filter(
    hasCoordinates
  ).length;

  const selectedFreshness = selectedBin
    ? getMonitoringFreshness(selectedBin, nowMs)
    : null;

  function toggleSelection(bin) {
    const id = String(bin.id_tong);

    setSelectedId((previous) =>
      previous === id ? null : id
    );
  }

  return (
    <div className="la-page">
      <header className="la-hero">
        <div>
          <span className="la-eyebrow">
            SMARTBIN · ANALISIS LOKASI
          </span>

          <h1>Analisis Lokasi Tong Sampah</h1>

          <p>
            Jelajahi persebaran tong, temukan lokasi tertentu,
            dan periksa informasi monitoring setiap titik.
          </p>
        </div>

        <div className="la-hero-decoration" aria-hidden="true">
          <span>⌖</span>
        </div>
      </header>

      <div className="la-stats">
        <div>
          <span>Total Tong</span>
          <strong>{loading ? '...' : bins.length}</strong>
          <small>Unit terdaftar</small>
        </div>

        <div>
          <span>Tong Fisik</span>
          <strong>{loading ? '...' : physicalCount}</strong>
          <small>Perangkat fisik</small>
        </div>

        <div>
          <span>Tong Virtual</span>
          <strong>{loading ? '...' : virtualCount}</strong>
          <small>Data simulasi</small>
        </div>

        <div>
          <span>Titik Hasil Filter</span>
          <strong>{loading ? '...' : mappedCount}</strong>
          <small>Memiliki koordinat</small>
        </div>
      </div>

      <section className="la-workspace">
        <div className="la-workspace-header">
          <div>
            <h2>Peta dan Daftar Lokasi</h2>
            <p>
              Gunakan pencarian atau pilih tong untuk
              memfokuskan tampilan peta.
            </p>
          </div>
        </div>

        <div className="la-toolbar">
          <label htmlFor="la-search">
            Cari lokasi
          </label>

          <input
            id="la-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode tong atau lokasi..."
          />

          <div className="la-filters" aria-label="Jenis tong">
            {[
              ['semua', 'Semua'],
              ['fisik', 'Fisik'],
              ['virtual', 'Virtual'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'active' : ''}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="la-message" role="alert">
            Koneksi monitoring bermasalah: {error}
          </p>
        )}

        {loading && (
          <p className="la-message">
            Mengambil data lokasi dari Django...
          </p>
        )}

        <div className="la-content">
          <div className="la-list-panel">
            <div className="la-list-heading">
              <h3>Daftar Tong</h3>
              <span>{visibleBins.length} tong</span>
            </div>

            {selectedBin && (
              <button
                type="button"
                className="la-reset"
                onClick={() => setSelectedId(null)}
              >
                ← Kembali ke semua titik
              </button>
            )}

            {!loading && visibleBins.length === 0 && (
              <p className="la-message">
                Tidak ada lokasi yang sesuai pencarian.
              </p>
            )}

            <div className="la-list">
              {visibleBins.map((bin) => {
                const selected =
                  selectedBin?.id_tong === bin.id_tong;

                const available = hasCoordinates(bin);

                return (
                  <article
                    key={bin.id_tong}
                    className={`la-location-item ${
                      selected ? 'selected' : ''
                    }`}
                  >
                    <div className="la-item-top">
                      <strong>{bin.kode_tong}</strong>

                      <span
                        className={
                          bin.jenis_tong === 'fisik'
                            ? 'la-type physical'
                            : 'la-type virtual'
                        }
                      >
                        {bin.jenis_tong === 'fisik'
                          ? 'Fisik'
                          : 'Simulasi'}
                      </span>
                    </div>

                    <p>
                      {bin.lokasi?.nama_lokasi ??
                        'Lokasi belum tersedia'}
                    </p>

                    <div className="la-item-bottom">
                      <span>
                        {formatPercent(
                          bin.monitoring?.tingkat_kepenuhan
                        )}
                      </span>

                      <button
                        type="button"
                        disabled={!available}
                        aria-pressed={selected}
                        onClick={() => toggleSelection(bin)}
                      >
                        {!available
                          ? 'Tanpa koordinat'
                          : selected
                            ? 'Dipilih'
                            : 'Fokus titik'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="la-map-panel">
            <div className="la-map-heading">
              <div>
                <h3>
                  {selectedBin
                    ? `Lokasi ${selectedBin.kode_tong}`
                    : 'Sebaran Lokasi Tong'}
                </h3>

                <p>
                  {selectedBin
                    ? 'Menampilkan titik yang dipilih'
                    : `${mappedCount} titik memiliki koordinat`}
                </p>
              </div>
            </div>

            <BinLocationMap bins={mapBins} />

            {selectedBin && (
              <div className="la-selected-info">
                <h3>Detail Tong Terpilih</h3>

                <div>
                  <span>Kode tong</span>
                  <strong>{selectedBin.kode_tong}</strong>
                </div>

                <div>
                  <span>Kepenuhan terakhir</span>
                  <strong>
                    {formatPercent(
                      selectedBin.monitoring?.tingkat_kepenuhan
                    )}
                  </strong>
                </div>

                <div>
                  <span>Keterbaruan data</span>
                  <strong>
                    {selectedFreshness?.label ??
                      'Belum diketahui'}
                  </strong>
                </div>

                <p>
                  {selectedFreshness?.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="la-disclaimer">
          Titik virtual menggunakan koordinat penempatan
          simulasi. Sumber koordinat fisik masih perlu
          diverifikasi melalui pengujian GPS perangkat.
          Pembacaan sensor yang sudah lama tidak dianggap
          sebagai kondisi real-time.
        </p>
      </section>
    </div>
  );
}

export default LocationAnalysisPage;
