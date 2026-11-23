import { useEffect, useRef, useState } from 'react';
import './CitizenReportPage.css';

const kategoriLaporan = [
  { value: 'sampah_penuh', label: 'Sampah penuh', role: 'Petugas' },
  { value: 'belum_diangkut', label: 'Sampah belum diangkut', role: 'Petugas' },
  { value: 'berserakan', label: 'Sampah berserakan', role: 'Petugas' },
  { value: 'sensor_rusak', label: 'Sensor atau perangkat IoT rusak', role: 'Pengelola' },
  { value: 'tong_rusak', label: 'Tong sampah rusak atau pecah', role: 'Pengelola' },
  { value: 'masalah_aplikasi', label: 'Masalah data atau aplikasi SmartBin', role: 'Admin' },
  { value: 'lainnya', label: 'Laporan lainnya', role: 'Admin' },
];

function CitizenReportPage({ bins = [] }) {
  const [nama, setNama] = useState('');
  const [tong, setTong] = useState('');
  const [kategori, setKategori] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [foto, setFoto] = useState(null);
  const [fotoUrl, setFotoUrl] = useState('');
  const [kameraAktif, setKameraAktif] = useState(false);
  const [kameraError, setKameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  function tutupKamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setKameraAktif(false);
  }

  async function bukaKamera() {
    setKameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setKameraError('Browser tidak mendukung akses kamera langsung.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;
      setKameraAktif(true);
    } catch (error) {
      setKameraError(
        'Kamera gagal dibuka. Periksa izin kamera browser dan perangkat.'
      );
    }
  }

  useEffect(() => {
    if (kameraAktif && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {
        setKameraError('Pratinjau kamera tidak dapat diputar.');
      });
    }
  }, [kameraAktif]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function jepretFoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setKameraError('Kamera belum siap. Coba beberapa saat lagi.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) {
        setKameraError('Gagal mengambil foto.');
        return;
      }

      const file = new File(
        [blob],
        'smartbin-foto-' + Date.now() + '.jpg',
        { type: 'image/jpeg' }
      );
      setFoto(file);
      tutupKamera();
    }, 'image/jpeg', 0.85);
  }


  const pilihanKategori = kategoriLaporan.find(
    (item) => item.value === kategori
  );

  useEffect(() => {
    if (!foto) {
      setFotoUrl('');
      return;
    }

    const url = URL.createObjectURL(foto);
    setFotoUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [foto]);

  function handleFoto(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      window.alert('Gunakan foto JPG, PNG, atau WebP.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      window.alert('Ukuran foto maksimal 5 MB.');
      event.target.value = '';
      return;
    }

    setFoto(file);
  }

  function hapusFoto() {
    setFoto(null);
    const inputs = document.querySelectorAll(
      '.citizen-report input[type="file"]'
    );
    inputs.forEach((input) => { input.value = ''; });
  }

  return (
    <section className="citizen-report">
      <header>
        <p className="citizen-report-eyebrow">SMARTBIN | LAPORAN WARGA</p>
        <h1>Laporkan Masalah Tempat Sampah</h1>
        <p>
          Bantu menjaga kebersihan lingkungan dengan melaporkan
          masalah tempat sampah, pengangkutan, atau perangkat SmartBin.
        </p>
      </header>

      <form
        className="citizen-report-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <h2>Informasi Laporan</h2>
        <p className="cr-form-description">
          Lengkapi informasi berikut. Laporan dapat dibuat tanpa login.
        </p>

        <label htmlFor="cr-nama">Nama pelapor (opsional)</label>
        <input
          id="cr-nama"
          value={nama}
          onChange={(event) => setNama(event.target.value)}
          placeholder="Masukkan nama Anda"
          maxLength={100}
        />

        <label htmlFor="cr-tong">Tempat sampah</label>
        <select
          id="cr-tong"
          value={tong}
          onChange={(event) => setTong(event.target.value)}
        >
          <option value="">Pilih tempat sampah</option>
          {bins.map((bin) => (
            <option key={bin.id_tong} value={bin.id_tong}>
              {bin.kode_tong} - {bin.lokasi?.nama_lokasi || 'Lokasi belum tersedia'}
            </option>
          ))}
        </select>

        <label htmlFor="cr-kategori">Jenis masalah</label>
        <select
          id="cr-kategori"
          value={kategori}
          onChange={(event) => setKategori(event.target.value)}
        >
          <option value="">Pilih jenis masalah</option>
          {kategoriLaporan.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        {pilihanKategori && (
          <div className="cr-role-info" role="status">
            <strong>Tujuan laporan: {pilihanKategori.role}</strong>
            <span>
              Kategori ini direncanakan untuk ditangani oleh
              tim {pilihanKategori.role}.
            </span>
          </div>
        )}

        <label htmlFor="cr-deskripsi">Deskripsi masalah</label>
        <textarea
          id="cr-deskripsi"
          value={deskripsi}
          onChange={(event) => setDeskripsi(event.target.value)}
          placeholder="Jelaskan kondisi yang ingin dilaporkan..."
          rows={5}
          maxLength={1000}
        />

        <div className="cr-photo-section">
          <h3>Lampiran Foto (Opsional)</h3>
          <p>
            Sertakan foto kondisi di lapangan. Maksimal 5 MB,
            format JPG, PNG, atau WebP.
          </p>

          <div className="cr-photo-actions">
            <button
              type="button"
              className="cr-camera-trigger"
              onClick={bukaKamera}
            >
              Ambil Foto
            </button>

            <label className="cr-photo-button cr-photo-secondary" htmlFor="cr-galeri">
              Pilih dari Galeri
            </label>
            <input
              id="cr-galeri"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFoto}
            />
          </div>

          {kameraError && (
            <p className="cr-camera-error" role="alert">{kameraError}</p>
          )}

          {kameraAktif && (
            <div className="cr-camera-panel">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                aria-label="Pratinjau kamera"
              />
              <div className="cr-camera-controls">
                <button type="button" onClick={jepretFoto}>
                  Jepret Foto
                </button>
                <button type="button" onClick={tutupKamera}>
                  Tutup Kamera
                </button>
              </div>
            </div>
          )}

          {foto && fotoUrl && (
            <div className="cr-photo-preview">
              <img src={fotoUrl} alt="Pratinjau lampiran laporan warga" />
              <div>
                <span>{foto.name}</span>
                <button type="button" onClick={hapusFoto}>
                  Hapus Foto
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="cr-development-note" role="status">
          Formulir ini masih berupa kerangka Sprint 6.
          Laporan dan foto belum dikirim atau disimpan.
        </p>

        <button type="submit" disabled>
          Kirim Laporan (Segera Hadir)
        </button>
      </form>
    </section>
  );
}

export default CitizenReportPage;
