const PUBLIC_CLUSTERING_ENDPOINT =
  '/api/clustering/public-overview/';

export async function getPublicClusteringOverview(options = {}) {
  const response = await fetch(PUBLIC_CLUSTERING_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'omit',
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil ringkasan clustering (HTTP ${response.status}).`
    );
  }

  const data = await response.json();

  if (
    data?.mode !== 'ringkasan_publik' ||
    !Array.isArray(data.results) ||
    typeof data.jumlah_tong !== 'number'
  ) {
    throw new Error(
      'Format respons clustering publik tidak sesuai.'
    );
  }

  return data;
}
