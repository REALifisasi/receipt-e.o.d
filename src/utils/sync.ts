/**
 * Sinkroni lintas perangkat via /api/sync (Upstash Redis di server).
 * Gagal jaringan tidak membunuh aplikasi — localStorage tetap jadi dundangan.
 */

const SYNC_ENDPOINT = '/api/sync';

export interface SyncData {
  catalog?: unknown | null;
  history?: unknown | null;
}

/** Ambil data terbaru dari server. */
export const fetchSync = async (): Promise<SyncData> => {
  const res = await fetch(SYNC_ENDPOINT, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Sync gagal (${res.status})`);
  return (await res.json()) as SyncData;
};

/**
 * Kirim data ke server. Jika payload lepas batas 4.5 MB serverless
 * (karena gambar), snapshot thumbnail riwayat dibuang lalu coba sekali lagi.
 */
export const pushSync = async (catalog: unknown, history: unknown): Promise<void> => {
  const entries = Array.isArray(history) ? (history as Array<{ snapshot?: unknown }>) : [];
  let body = JSON.stringify({ catalog, history: entries });

  if (body.length > 3_500_000) {
    const slim = entries.map(({ snapshot: _s, ...rest }) => {
      void _s;
      return rest;
    });
    body = JSON.stringify({ catalog, history: slim });
  }

  const res = await fetch(SYNC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`Sync gagal (${res.status})`);
};
