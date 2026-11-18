import { supabase } from '../lib/supabase';

export class HistoryAccessError extends Error {
  constructor() {
    super('Riwayat data memerlukan login dan hak akses yang sesuai.');
    this.name = 'HistoryAccessError';
  }
}

export async function getBinHistory(
  binCode,
  { limit = 10, offset = 0, signal } = {}
) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const url =
    `/api/bins/${encodeURIComponent(binCode)}/history/?${params}`;

  const { data: sessionData, error } = await supabase.auth.getSession();

  if (error) {
    throw new HistoryAccessError();
  }

  const token = sessionData.session?.access_token;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
    signal,
  });

  if (response.status === 401 || response.status === 403) {
    throw new HistoryAccessError();
  }

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil histori (HTTP ${response.status}).`
    );
  }

  const data = await response.json();

  if (
    !data ||
    !Array.isArray(data.results) ||
    typeof data.has_more !== 'boolean'
  ) {
    throw new Error('Format respons histori tidak sesuai.');
  }

  return data;
}
