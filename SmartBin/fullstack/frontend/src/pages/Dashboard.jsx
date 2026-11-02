
import { useEffect, useState } from 'react';
import { getLatestBinMonitoring } from '../services/monitoringService';

const menuItems = [
  { icon: '▦', label: 'Dashboard' },
  { icon: '▤', label: 'Monitoring' },
  { icon: '▥', label: 'Riwayat Data' },
  { icon: '⌖', label: 'Analisis Lokasi' },
  { icon: '▧', label: 'Laporan' },
];

function Dashboard() {
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [binData, setBinData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadMonitoring() {
      try {
        const data = await getLatestBinMonitoring(
          'SB-F001',
          controller.signal
        );
        setBinData(data);
        setError('');
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadMonitoring();

    return () => controller.abort();
  }, []);

  const fullness = binData?.monitoring?.tingkat_kepenuhan;
  const fullnessText =
    typeof fullness === 'number' ? `${fullness}%` : '—';
  const progress =
    typeof fullness === 'number'
      ? `${Math.min(100, Math.max(0, fullness))}%`
      : '0%';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">♻</div>
          <div>
            <h2>SmartBin</h2>
            <span>IoT Monitoring System</span>
          </div>
        </div>

        <div className="sidebar-label">MENU UTAMA</div>

        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${
                activeMenu === item.label ? 'active' : ''
              }`}
              onClick={() => setActiveMenu(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-label">SISTEM</div>
          <div className="sidebar-system">SmartBin • Versi Pengembangan</div>
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <span>SmartBin / {activeMenu}</span>
          <div className="admin-profile">
            <span className="admin-avatar">A</span>
            <span>Admin</span>
          </div>
        </div>

        <main className="dashboard-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">OVERVIEW SISTEM</span>
              <h1>Dashboard SmartBin</h1>
              <p>
                Sistem Monitoring Kondisi Tempat Sampah Berbasis IoT
              </p>
            </div>
            <span className="demo-badge">Mode Pratinjau</span>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon green">▤</div>
              <span className="stat-label">Total Tong</span>
              <strong>1</strong>
              <small>Unit terdaftar (data awal)</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon green-light">◉</div>
              <span className="stat-label">Koneksi Perangkat</span>
              <strong>—</strong>
              <small>Menunggu pengujian ESP32</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">!</div>
              <span className="stat-label">Perlu Perhatian</span>
              <strong>—</strong>
              <small>Ambang batas belum ditetapkan</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon yellow">▥</div>
              <span className="stat-label">Data Hari Ini</span>
              <strong>—</strong>
              <small>Belum terhubung ke Supabase</small>
            </div>
          </div>

          <div className="content-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Kondisi Tong Sampah</h2>
                  <p>Pembacaan kepenuhan terakhir</p>
                </div>
                <span className="panel-tag">Data Uji</span>
              </div>

              <div className="bin-grid">
                <div className="bin-card">
                  <strong>{binData?.kode_tong ?? 'SB-F001'}</strong>
                  <div
                    className="progress-ring"
                    style={{ '--progress': progress }}
                  >
                    <span>{loading ? '...' : fullnessText}</span>
                  </div>
                  <span className="bin-status">
                    {loading
                      ? 'Memuat data...'
                      : error
                        ? 'Gagal mengambil data'
                        : binData?.monitoring
                          ? 'Data monitoring aktual'
                          : 'Belum ada pembacaan sensor'}
                  </span>
                  <small>{binData?.nama_lokasi ?? 'Lokasi belum tersedia'}</small>
                </div>
              </div>

              <p className="panel-note">
                {error
                  ? `Koneksi monitoring bermasalah: ${error}`
                  : binData?.monitoring
                    ? `Pembacaan terakhir: ${new Date(
                        binData.monitoring.waktu_pembacaan
                      ).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })} WIB`
                    : loading
                      ? 'Mengambil data dari Django REST API...'
                      : 'Belum ada data pembacaan sensor.'}
              </p>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Sebaran Lokasi Tong</h2>
                  <p>Penempatan tong di lingkungan kampus</p>
                </div>
              </div>

              <div className="location-placeholder">
                <div className="location-marker">⌖</div>
                <strong>Peta lokasi belum tersedia</strong>
                <p>
                  Koordinat titik penempatan akan ditampilkan
                  setelah data lokasi kampus dikonfirmasi.
                </p>
              </div>

              <div className="location-footer">
                <span>Lokasi terdaftar</span>
                <strong>Lokasi Uji SmartBin</strong>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
