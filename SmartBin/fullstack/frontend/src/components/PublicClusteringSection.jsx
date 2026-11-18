import { useEffect, useState } from 'react';

import ClusteringOverview from './ClusteringOverview';

import { getPublicClusteringOverview } from
  '../services/clusteringPublicService';

function PublicClusteringSection() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function refreshClustering() {
      try {
        const result = await getPublicClusteringOverview({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setOverview(result);
          setError('');
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message || 'Gagal mengambil ringkasan AI.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    refreshClustering();

    const intervalId = setInterval(
      refreshClustering,
      60000
    );

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="public-clustering-section">
      {loading && (
        <p role="status">
          Mengambil ringkasan AI Clustering...
        </p>
      )}

      {error && (
        <p role="alert">
          Koneksi API Clustering bermasalah: {error}
        </p>
      )}

      {overview && (
        <ClusteringOverview overview={overview} />
      )}
    </div>
  );
}

export default PublicClusteringSection;
