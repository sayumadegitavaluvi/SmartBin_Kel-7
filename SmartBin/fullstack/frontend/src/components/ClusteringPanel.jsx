import { useState } from 'react';
import { predictClustering } from '../services/clusteringService';
import './ClusteringPanel.css';

const fields = [
  {
    key: 'Rata_rata_Fill_Waktu',
    label: 'Rata-rata Fill Waktu (%)',
  },
  {
    key: 'Persen_Waktu_GE80',
    label: 'Persentase Waktu ≥80% (%)',
  },
  {
    key: 'Persen_Waktu_LE20',
    label: 'Persentase Waktu ≤20% (%)',
  },
];

function ClusteringPanel() {
  const [form, setForm] = useState({
    Container_ID: 'SB-F001',
    Rata_rata_Fill_Waktu: '',
    Persen_Waktu_GE80: '',
    Persen_Waktu_LE20: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setResult(null);

    const containerId = form.Container_ID.trim();
    const rawValues = fields.map((field) => form[field.key]);

    if (!containerId || containerId.length > 100) {
      setError('Container ID tidak valid.');
      return;
    }

    if (rawValues.some((value) => value.trim() === '')) {
      setError('Semua fitur numerik wajib diisi.');
      return;
    }

    const values = rawValues.map(Number);

    if (
      values.some(
        (value) =>
          !Number.isFinite(value) ||
          value < 0 ||
          value > 100
      )
    ) {
      setError('Nilai setiap fitur harus berada pada 0–100.');
      return;
    }

    if (values[1] + values[2] > 100.000001) {
      setError(
        'Total persentase waktu ≥80% dan ≤20% tidak boleh melebihi 100%.'
      );
      return;
    }

    const payload = {
      Container_ID: containerId,
      Rata_rata_Fill_Waktu: values[0],
      Persen_Waktu_GE80: values[1],
      Persen_Waktu_LE20: values[2],
    };

    setLoading(true);

    try {
      const response = await predictClustering([payload]);
      const prediction = response.results[0];

      if (!prediction) {
        throw new Error('Hasil prediksi AI tidak tersedia.');
      }

      setResult(prediction);
    } catch (err) {
      setError(err.message || 'Pengujian AI gagal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-panel" aria-labelledby="ai-title">
      <div className="ai-panel-heading">
        <div>
          <h2 id="ai-title">Analisis AI Clustering</h2>
          <p>
            Pengujian model AI berdasarkan tiga fitur kepenuhan.
          </p>
        </div>

        <span className="ai-mode">Mode Pengujian</span>
      </div>

      <p className="ai-notice">
        Fitur ini belum digunakan untuk keputusan operasional.
        Prediksi memerlukan pengguna yang terautentikasi.
      </p>

      <form className="ai-form" onSubmit={handleSubmit}>
        <label>
          Container ID
          <input
            type="text"
            name="Container_ID"
            value={form.Container_ID}
            onChange={handleChange}
            maxLength={100}
            required
          />
        </label>

        {fields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              type="number"
              name={field.key}
              value={form[field.key]}
              onChange={handleChange}
              min="0"
              max="100"
              step="any"
              placeholder="0–100"
              required
            />
          </label>
        ))}

        <button type="submit" disabled={loading}>
          {loading ? 'Memproses...' : 'Jalankan Pengujian AI'}
        </button>
      </form>

      {error && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="ai-result">
          <h3>Hasil Clustering</h3>

          <p>
            Cluster: <strong>{String(result.cluster ?? '—')}</strong>
          </p>

          <p>
            Profil: <strong>{result.profil_cluster ?? '—'}</strong>
          </p>

          <p>
            Interpretasi: {result.interpretasi ?? 'Belum tersedia'}
          </p>

          <small>
            Hasil pengujian model, bukan klasifikasi
            operasional tervalidasi.
          </small>
        </div>
      )}
    </section>
  );
}

export default ClusteringPanel;
