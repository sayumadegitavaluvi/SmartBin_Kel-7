const CLUSTERING_ENDPOINT = '/api/clustering/predict/';

export async function predictClustering(
  records,
  { signal, csrfToken } = {}
) {
  if (
    !Array.isArray(records) ||
    records.length < 1 ||
    records.length > 100
  ) {
    throw new Error('Masukkan 1 sampai 100 data pengujian.');
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }

  const response = await fetch(CLUSTERING_ENDPOINT, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    signal,
    body: JSON.stringify({
      data: records,
    }),
  });

  const result = await response.json().catch(() => null);

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      'Akses AI memerlukan login yang terautentikasi.'
    );
  }

  if (!response.ok) {
    throw new Error(
      result?.detail ||
      `Gagal memproses AI Clustering (HTTP ${response.status}).`
    );
  }

  if (
    result?.mode !== 'pengujian' ||
    result?.operasional_tervalidasi !== false ||
    !Array.isArray(result?.results)
  ) {
    throw new Error('Format respons AI tidak sesuai.');
  }

  return result;
}
