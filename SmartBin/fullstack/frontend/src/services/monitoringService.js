export async function getLatestBinMonitoring(binIdentifier, signal) {
  const response = await fetch(
    `/api/bins/${encodeURIComponent(binIdentifier)}/latest/`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil data monitoring (HTTP ${response.status})`
    );
  }

  return response.json();
}
