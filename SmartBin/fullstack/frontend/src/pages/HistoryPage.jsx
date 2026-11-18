import { useEffect, useRef, useState } from 'react';
import {
  getBinHistory,
  HistoryAccessError,
} from '../services/historyService';
import './HistoryPage.css';

function formatTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu tidak valid';

  return `${date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  })} WIB`;
}

function formatNumber(value, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return `${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(value)}${suffix}`;
}

function HistoryPage({ bins = [] }) {
  const [selectedBin, setSelectedBin] = useState('');
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(null);

  const controllerRef = useRef(null);
  const selectedCode = selectedBin || bins[0]?.kode_tong || '';

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  function changeBin(value) {
    controllerRef.current?.abort();
    setSelectedBin(value);
    setRows([]);
    setLoaded(false);
    setLoading(false);
    setAccessDenied(false);
    setError('');
    setHasMore(false);
    setNextOffset(null);
  }

  async function loadHistory(append = false) {
    if (!selectedCode || loading) return;

    const offset = append ? nextOffset : 0;
    if (offset === null) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError('');
    setAccessDenied(false);

    try {
      const data = await getBinHistory(selectedCode, {
        limit: 10,
        offset,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setRows((previous) =>
        append ? [...previous, ...data.results] : data.results
      );
      setHasMore(data.has_more);
      setNextOffset(data.next_offset);
      setLoaded(true);
    } catch (err) {
      if (controller.signal.aborted) return;

      if (err instanceof HistoryAccessError) {
        setAccessDenied(true);
        setRows([]);
        setLoaded(false);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat mengambil histori.'
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  return (
    <div className="hp-page">
      <header className="hp-hero">
        <span className="hp-eyebrow">
          SMARTBIN · RIWAYAT DATA
        </span>
        <h1>Riwayat Monitoring</h1>
        <p>
          Telusuri pembacaan sensor berdasarkan tong dan waktu
          untuk memahami histori kondisi tempat sampah.
        </p>
      </header>

      <section className="hp-panel">
        <div className="hp-panel-heading">
          <div>
            <h2>Histori Pembacaan Sensor</h2>
            <p>
              Data berasal dari Django REST API dan Supabase.
            </p>
          </div>
          <span className="hp-internal">Akses Internal</span>
        </div>

        <div className="hp-toolbar">
          <div className="hp-field">
            <label htmlFor="hp-bin">Pilih tong sampah</label>

            <select
              id="hp-bin"
              value={selectedCode}
              onChange={(event) => changeBin(event.target.value)}
            >
              {bins.length === 0 && (
                <option value="">Belum ada tong tersedia</option>
              )}

              {bins.map((bin) => (
                <option key={bin.id_tong} value={bin.kode_tong}>
                  {bin.kode_tong} — {bin.jenis_tong === 'fisik'
                    ? 'Fisik'
                    : 'Virtual'}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="hp-primary-button"
            disabled={!selectedCode || loading}
            onClick={() => loadHistory(false)}
          >
            {loading ? 'Memuat...' : 'Tampilkan Riwayat'}
          </button>
        </div>

        <p className="hp-access-note">
          Riwayat pembacaan sensor hanya tersedia bagi pengguna internal SmartBin yang telah terautentikasi dan memiliki hak akses sesuai perannya.
        </p>

        {accessDenied && (
          <div className="hp-access-denied" role="status">
            <strong>Akses riwayat dibatasi</strong>
            <p>
              Kamu belum memiliki sesi login atau izin
              yang diperlukan untuk melihat histori.
              Data tetap terlindungi oleh backend Django.
            </p>
          </div>
        )}

        {error && (
          <p className="hp-error" role="alert">{error}</p>
        )}

        {!loaded && !loading && !accessDenied && !error && (
          <p className="hp-empty">
            Pilih tong, kemudian klik Tampilkan Riwayat.
          </p>
        )}

        {loaded && rows.length === 0 && (
          <p className="hp-empty">
            Belum ada pembacaan untuk tong ini.
          </p>
        )}

        {rows.length > 0 && (
          <>
            <div className="hp-table-heading">
              <strong>Histori {selectedCode}</strong>
              <span>{rows.length} pembacaan ditampilkan</span>
            </div>

            <div className="hp-table-wrapper">
              <table className="hp-table">
                <thead>
                  <tr>
                    <th scope="col">Waktu Pembacaan</th>
                    <th scope="col">Kepenuhan</th>
                    <th scope="col">Jarak Sensor</th>
                    <th scope="col">Perangkat</th>
                    <th scope="col">Sumber</th>
                    <th scope="col">Validitas</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id_data}>
                      <td>{formatTime(row.waktu_pembacaan)}</td>
                      <td className="hp-fill">
                        {formatNumber(
                          row.tingkat_kepenuhan,
                          '%'
                        )}
                      </td>
                      <td>
                        {formatNumber(row.jarak_sensor, ' cm')}
                      </td>
                      <td>{row.id_perangkat || '—'}</td>
                      <td>
                        {row.sumber_data === 'fisik'
                          ? 'Sensor fisik'
                          : row.sumber_data === 'simulasi'
                            ? 'Simulasi'
                            : row.sumber_data || '—'}
                      </td>
                      <td>
                        <span className="hp-validation">
                          {row.validitas_sensor ===
                          'belum_diverifikasi'
                            ? 'Belum diverifikasi'
                            : row.validitas_sensor ||
                              'Tidak diketahui'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="hp-pagination">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => loadHistory(true)}
                >
                  {loading
                    ? 'Memuat...'
                    : 'Muat 10 pembacaan berikutnya'}
                </button>
              </div>
            )}
          </>
        )}

        <p className="hp-disclaimer">
          Pembacaan 0% tidak otomatis berarti sensor valid.
          Semua histori yang belum diverifikasi harus
          diperlakukan sebagai data yang belum tervalidasi.
        </p>
      </section>
    </div>
  );
}

export default HistoryPage;
