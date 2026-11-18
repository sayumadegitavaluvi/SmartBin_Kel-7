export const FRESHNESS_LIMIT_MINUTES = 15;

export function getMonitoringFreshness(bin, now = Date.now()) {
  const monitoring = bin.monitoring;

  if (!monitoring) {
    return {
      type: 'empty',
      label: 'Belum ada data',
      description: 'Belum ada pembacaan monitoring',
    };
  }

  if (
    bin.jenis_tong === 'virtual' ||
    monitoring.sumber_data === 'simulasi'
  ) {
    return {
      type: 'simulation',
      label: 'Simulasi',
      description: 'Data uji, bukan sensor fisik',
    };
  }

  const timestamp = Date.parse(
    monitoring.waktu_pembacaan ?? ''
  );

  const ageMs = now - timestamp;

  if (!Number.isFinite(timestamp) || ageMs < 0) {
    return {
      type: 'unknown',
      label: 'Waktu tidak valid',
      description: 'Periksa waktu pembacaan sensor',
    };
  }

  const ageMinutes = Math.floor(ageMs / 60000);
  const freshnessLimitMs = FRESHNESS_LIMIT_MINUTES * 60000;

  if (ageMs <= freshnessLimitMs) {
    return {
      type: 'fresh',
      label: 'Data terbaru',
      description: `Usia data ${ageMinutes} menit`,
    };
  }

  return {
    type: 'stale',
    label: 'Data tidak terbaru',
    description: `Usia data ${ageMinutes} menit`,
  };
}
