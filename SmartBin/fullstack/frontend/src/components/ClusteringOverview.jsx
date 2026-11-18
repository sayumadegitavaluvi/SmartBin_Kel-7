import './ClusteringOverview.css';

const statusLabels = {
  belum_ada_interval_valid: 'Belum ada interval valid',
  menunggu_verifikasi_sensor: 'Menunggu verifikasi sensor',
  histori_belum_cukup: 'Histori belum cukup',
  histori_fisik_tidak_tersedia: 'Histori fisik tidak tersedia',
  data_simulasi: 'Data simulasi',
  menunggu_validasi_operasional: 'Menunggu validasi operasional',
  hasil_operasional_tersedia: 'Hasil operasional tersedia',
  menunggu_ketentuan_operasional: 'Menunggu ketentuan operasional',
};

const clusterLabels = {
  0: 'Keterisian menengah',
  1: 'Keterisian tinggi',
  2: 'Keterisian rendah',
};

function formatAnalysisTime(value) {
  if (!value) return 'Belum tersedia';

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

function getPrediction(item) {
  const result = item.hasil_clustering;

  if (result == null) return null;

  const prediction =
    typeof result === 'object' && !Array.isArray(result)
      ? result
      : { cluster: result };

  const cluster = prediction.cluster;

  if (
    !Number.isInteger(cluster) ||
    !Object.prototype.hasOwnProperty.call(clusterLabels, cluster)
  ) {
    return null;
  }

  return {
    cluster,
    profil:
      prediction.profil_cluster || clusterLabels[cluster],
    interpretasi:
      prediction.interpretasi || 'Interpretasi belum tersedia.',
  };
}

function ClusteringOverview({ overview = null }) {
  const results = Array.isArray(overview?.results)
    ? overview.results
    : [];

  return (
    <section
      className="clustering-overview"
      aria-labelledby="clustering-overview-title"
    >
      <div className="clustering-overview-heading">
        <div>
          <h2 id="clustering-overview-title">
            Ringkasan AI Clustering
          </h2>
          <p>
            Status kesiapan dan hasil analisis setiap tong.
          </p>
        </div>

        <span className="clustering-overview-mode">
          Pemeriksaan Kesiapan
        </span>
      </div>

      <p className="clustering-overview-notice">
        Kategori clustering hanya ditampilkan jika hasil
        prediksi tersedia. Prediksi pengujian tidak boleh
        dianggap sebagai keputusan operasional.
      </p>

      {!overview ? (
        <p className="clustering-overview-empty">
          Data ringkasan publik belum dimuat.
        </p>
      ) : results.length === 0 ? (
        <p className="clustering-overview-empty">
          Belum ada data tong untuk ditampilkan.
        </p>
      ) : (
        <div className="clustering-overview-table-wrapper">
          <table className="clustering-overview-table">
            <thead>
              <tr>
                <th scope="col">Kode Tong</th>
                <th scope="col">Jenis</th>
                <th scope="col">Histori</th>
                <th scope="col">Status Kesiapan</th>
                <th scope="col">Kategori Cluster</th>
                <th scope="col">Profil Keterisian</th>
                <th scope="col">Interpretasi AI</th>
                <th scope="col">Analisis Terakhir</th>
              </tr>
            </thead>

            <tbody>
              {results.map((item) => {
                const prediction =
                  overview.operasional_tervalidasi === true &&
                  item.operasional_tervalidasi === true &&
                  item.jenis_tong === 'fisik'
                    ? getPrediction(item)
                    : null;

                const validated =
                  overview.operasional_tervalidasi === true &&
                  item.operasional_tervalidasi === true;

                return (
                  <tr key={item.id_tong}>
                    <td>{item.kode_tong}</td>

                    <td>
                      {item.jenis_tong === 'fisik'
                        ? 'Fisik'
                        : 'Virtual'}
                    </td>

                    <td>{item.jumlah_pembacaan}</td>

                    <td>
                      {statusLabels[item.status_kesiapan] ??
                        'Status belum diketahui'}
                    </td>

                    <td>
                      {prediction
                        ? `Cluster ${prediction.cluster}${
                            validated ? '' : ' (Pengujian)'
                          }`
                        : 'Belum tersedia'}
                    </td>

                    <td>
                      {prediction
                        ? prediction.profil
                        : 'Belum tersedia'}
                    </td>

                    <td>
                      {prediction
                        ? prediction.interpretasi
                        : 'Belum tersedia'}
                    </td>

                    <td>
                      {prediction
                        ? formatAnalysisTime(item.waktu_analisis)
                        : 'Belum tersedia'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="clustering-overview-footer">
        Status kesiapan bukan hasil prediksi KMeans.
        Analisis yang belum tervalidasi tidak digunakan
        sebagai keputusan pengangkutan sampah otomatis.
      </p>
    </section>
  );
}

export default ClusteringOverview;
