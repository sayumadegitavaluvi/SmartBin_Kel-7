export async function getLatestBinMonitoring(binIdentifier, signal) {
  const response = await fetch(
    `/api/bins/${encodeURIComponent(binIdentifier)}/latest/`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil monitoring tong (HTTP ${response.status})`
    );
  }

  return response.json();
}

export async function getAllLatestBinsMonitoring(signal) {
  const response = await fetch('/api/bins/latest/', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil monitoring seluruh tong (HTTP ${response.status})`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data.results)) {
    throw new Error('Format data monitoring tidak sesuai.');
  }

  return data.results;
}
