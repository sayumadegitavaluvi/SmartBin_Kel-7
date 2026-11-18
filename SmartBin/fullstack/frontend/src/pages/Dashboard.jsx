import BinLocationMap from '../components/BinLocationMap';
import SidebarMenuIcon from '../components/SidebarMenuIcon';
import ClusteringPanel from '../components/ClusteringPanel';
import PublicClusteringSection from '../components/PublicClusteringSection';
import MonitoringPage from './MonitoringPage';
import HistoryPage from './HistoryPage';
import ReportPage from './ReportPage';
import LocationAnalysisPage from './LocationAnalysisPage';
import { useEffect, useState } from 'react';
import { getAllLatestBinsMonitoring } from '../services/monitoringService';
import { getMonitoringFreshness } from '../utils/monitoringFreshness';

const menuItems = [
  { icon: '▦', label: 'Dashboard' },
  { icon: '▤', label: 'Monitoring' },
  { icon: '▥', label: 'Riwayat Data' },
  { icon: '⌖', label: 'Analisis Lokasi' },
  { icon: '▧', label: 'Laporan' },
];

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

function Dashboard({ profile, onLogin, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [showAllBins, setShowAllBins] = useState(false);
  const [showAiTesting, setShowAiTesting] = useState(false);
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();

    async function loadMonitoring() {
      try {
        const results = await getAllLatestBinsMonitoring(
          controller.signal
        );

        if (!controller.signal.aborted) {
          setBins(results);
          setError('');
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || 'Gagal mengambil data monitoring.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadMonitoring();

    // Memeriksa pembaruan data setiap 60 detik.
    const intervalId = setInterval(loadMonitoring, 60000);
    const freshnessTimerId = setInterval(() => {
      setNowMs(Date.now());
    }, 60000);

    return () => {
      controller.abort();
      clearInterval(intervalId);
      clearInterval(freshnessTimerId);
    };
  }, []);

  const totalFisik = bins.filter(
    (bin) => bin.jenis_tong === 'fisik'
  ).length;

  const totalVirtual = bins.filter(
    (bin) => bin.jenis_tong === 'virtual'
  ).length;

  const totalMonitoring = bins.filter(
    (bin) => bin.monitoring !== null
  ).length;

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
              <span className="nav-icon"><SidebarMenuIcon name={item.label} /></span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-label">SISTEM</div>
          <div className="sidebar-system">
            SmartBin • Versi Pengembangan
          </div>
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <span>SmartBin / {activeMenu}</span>

          <div className="admin-profile">
              <span className="admin-avatar">
                {profile?.internal_role === 'admin'
                    ? 'A'
                    : profile?.internal_role === 'petugas'
                      ? 'P'
                      : profile?.internal_role === 'pengelola'
                        ? 'G'
                        : profile
                          ? 'I'
                          : 'P'}
              </span>

              <span>
                {profile?.internal_role === 'admin'
                    ? 'Admin SmartBin'
                    : profile?.internal_role === 'petugas'
                      ? 'Petugas SmartBin'
                      : profile?.internal_role === 'pengelola'
                        ? 'Pengelola SmartBin'
                        : profile
                          ? 'Pengguna Tanpa Role'
                          : 'Pengunjung'}
              </span>

              {profile ? (
                <button
                  type="button"
                  className="auth-header-button"
                  onClick={onLogout}
                >
                  Logout
                </button>
              ) : (
                <button
                  type="button"
                  className="auth-header-button"
                  onClick={onLogin}
                >
                  Login
                </button>
              )}
            </div>
        </div>

        <main className="dashboard-content">
          {activeMenu === 'Dashboard' ? (
            <>
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
              <strong>{loading ? '...' : bins.length}</strong>
              <small>Unit terdaftar di database</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon green-light">◉</div>
              <span className="stat-label">Tong Fisik</span>
              <strong>{loading ? '...' : totalFisik}</strong>
              <small>Perangkat monitoring fisik</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">▦</div>
              <span className="stat-label">Tong Virtual</span>
              <strong>{loading ? '...' : totalVirtual}</strong>
              <small>Titik monitoring simulasi</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon yellow">▥</div>
              <span className="stat-label">Data Monitoring</span>
              <strong>{loading ? '...' : totalMonitoring}</strong>
              <small>Tong yang memiliki pembacaan</small>
            </div>
          </div>

          <div className="content-grid dashboard-sections">
            <section className="panel monitoring-panel">
              <div className="panel-heading">
                <div>
                  <h2>Kondisi Tong Sampah</h2>
                  <p>Pembacaan kepenuhan terakhir setiap tong</p>
                </div>
                <div className="monitoring-actions">
                  <span className="panel-tag">
                    Fisik & Simulasi
                  </span>
                  {bins.length > 5 && (
                    <button
                      type="button"
                      className="monitoring-toggle"
                      onClick={() => setShowAllBins((value) => !value)}
                      aria-expanded={showAllBins}
                    >
                      {showAllBins
                        ? 'Tampilkan ringkasan'
                        : 'Lihat semua monitoring'}
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <p className="panel-note" role="alert">
                  Koneksi API bermasalah: {error}
                </p>
              )}

              {loading && (
                <p className="panel-note">
                  Mengambil data monitoring dari Django...
                </p>
              )}

              {!loading && bins.length === 0 && (
                <p className="panel-note">
                  Belum ada data tong yang tersedia.
                </p>
              )}

              <div className="bin-grid">
                {(showAllBins ? bins : bins.slice(0, 5)).map((bin) => {
                  const fullness =
                    bin.monitoring?.tingkat_kepenuhan;

                  const hasReading =
                    typeof fullness === 'number' &&
                    Number.isFinite(fullness);

                  const progress = hasReading
                    ? Math.min(100, Math.max(0, fullness))
                    : 0;

                  const freshness = getMonitoringFreshness(
                    bin,
                    nowMs
                  );

                  return (
                    <div className="bin-card" key={bin.id_tong}>
                      <strong>{bin.kode_tong}</strong>

                      <div
                        className="progress-ring"
                        style={{
                          '--progress': `${progress}%`,
                        }}
                        role="progressbar"
                        aria-label={`Kepenuhan ${bin.kode_tong}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={
                          hasReading ? progress : undefined
                        }
                      >
                        <span>
                          {formatPercent(fullness)}
                        </span>
                      </div>

                      <span className="bin-status">
                        {bin.jenis_tong === 'fisik'
                          ? 'Fisik · ESP32'
                          : 'Virtual · Simulasi'}
                      </span>

                      <small>
                        {bin.lokasi?.nama_lokasi ??
                          'Lokasi belum tersedia'}
                      </small>

                      <small>
                        {formatTime(
                          bin.monitoring?.waktu_pembacaan
                        )}
                      </small>

                      <div className="freshness-info">
                        <span className={`freshness-badge ${freshness.type}`}>
                          {freshness.label}
                        </span>
                        <small>{freshness.description}</small>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="panel-note">
                Data diambil dari Django REST API dan diperiksa
                kembali setiap 60 detik. Pembacaan simulasi
                bukan hasil sensor fisik.
              </p>
            </section>

            <section className="panel map-panel">
              <div className="panel-heading">
                <div>
                  <h2>Sebaran Lokasi Tong</h2>
                  <p>Penempatan tong di lingkungan kampus</p>
                </div>
              </div>

              <BinLocationMap bins={bins} />

              <div className="location-footer">
                <span>Lokasi monitoring terdaftar</span>
                <strong>{bins.length} titik</strong>
              </div>
            </section>
              <div className="ai-slot">
                  <PublicClusteringSection />
                <section className="ai-teaser">
                  <span className="ai-teaser-label">
                    MODE PENGUJIAN
                  </span>

                  <div className="ai-teaser-symbol" aria-hidden="true">
                    <span>✦</span>
                    <span>▥</span>
                    <span>⌁</span>
                  </div>

                  <h2>Analisis AI Clustering</h2>
                  <p>
                    Pengelompokan pola kepenuhan menggunakan
                    model AI berdasarkan histori sensor.
                  </p>

                  <div className="ai-teaser-status">
                    Hasil operasional belum tervalidasi
                  </div>

                  <button
                    type="button"
                    className="ai-teaser-button"
                    onClick={() => setShowAiTesting((value) => !value)}
                    aria-expanded={showAiTesting}
                  >
                    {showAiTesting
                      ? 'Tutup Pengujian AI'
                      : 'Buka Pengujian AI'}
                  </button>
                </section>

                {showAiTesting && <ClusteringPanel />}
              </div>
            </div>
                      </>
          ) : activeMenu === 'Laporan' ? (
            <ReportPage
              bins={bins}
              loading={loading}
              error={error}
              nowMs={nowMs}
            />
          ) : activeMenu === 'Riwayat Data' ? (
            <HistoryPage bins={bins} />
          ) : activeMenu === 'Monitoring' ? (
            <MonitoringPage
              bins={bins}
              loading={loading}
              error={error}
              nowMs={nowMs}
            />
          ) : activeMenu === 'Analisis Lokasi' ? (
            <LocationAnalysisPage
              bins={bins}
              loading={loading}
              error={error}
              nowMs={nowMs}
            />
          ) : (
            <section className="m-page">
              <header className="m-page-hero">
                <div>
                  <span className="m-page-eyebrow">
                    SMARTBIN · PENGEMBANGAN
                  </span>
                  <h1>{activeMenu}</h1>
                  <p>
                    Halaman ini sedang disiapkan sesuai kebutuhan
                    sistem dan pembagian hak akses SmartBin.
                  </p>
                </div>
              </header>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
