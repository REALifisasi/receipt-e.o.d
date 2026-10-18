import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Endpoint sinkroni data lintas perangkat.
 * GET  /api/sync  -> { catalog, history } dari Redis (null jika belum ada)
 * POST /api/sync  -> body { catalog, history } -> disimpan ke Redis
 * Kredensial Upstash diambil dari env var yang diinject Vercel:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

const KEY_CATALOG = 'eod:receipt:catalog';
const KEY_HISTORY = 'eod:receipt:history';

type EnvMap = Record<string, string | undefined>;

const env = (): EnvMap => process.env as unknown as EnvMap;

/**
 * Baca-kredensial fleksibel: Upstash lex integrasi Vercel bisa memakai prefix
 * berbeda (UPSTASH_REDIS_REST_*, KV_REST_API_*, atau prefix custom seperti
 * STORAGE_URL/STORAGE_TOKEN — nama yang ditampilkan di dialog Connect).
 */
const upstashCredentials = (): { url: string; token: string } | null => {
  const e = env();
  const url = e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL || e.STORAGE_URL || e.STORAGE_REST_URL;
  const token =
    e.UPSTASH_REDIS_REST_TOKEN || e.KV_REST_API_TOKEN || e.STORAGE_TOKEN || e.STORAGE_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
};

const writeJson = (res: ServerResponse, status: number, data: unknown): void => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
};

/** Kirim satu batch pipeline Redis REST (tanpa dependensi @upstash/redis). */
const redisPipeline = async (commands: unknown[][]): Promise<unknown[]> => {
  const creds = upstashCredentials();
  if (!creds) {
    throw new Error('Konfigurasi Upstash untuk project ini belum ada (Storage belum dihubungkan).');
  }
  const res = await fetch(`${creds.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    throw new Error(`Upstash gagal (${res.status})`);
  }
  const data = (await res.json()) as { error?: string; result?: unknown } | Array<{ error?: string; result?: unknown }>;
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (item.error) throw new Error(item.error);
      return item.result;
    });
  }
  if (data.error) throw new Error(data.error);
  return [data.result];
};

const parseBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
    if (chunks.reduce((n, c) => n + c.length, 0) > 6_000_000) {
      throw new Error('Payload terlalu besar');
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Body bukan JSON valid');
  }
};

const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    if (req.method === 'GET') {
      const [catalog, history] = await redisPipeline([
        ['GET', KEY_CATALOG],
        ['GET', KEY_HISTORY],
      ]);
      writeJson(res, 200, {
        catalog: catalog ? JSON.parse(String(catalog)) : null,
        history: history ? JSON.parse(String(history)) : null,
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const commands: unknown[][] = [];
      if (body.catalog !== undefined) commands.push(['SET', KEY_CATALOG, JSON.stringify(body.catalog)]);
      if (body.history !== undefined) commands.push(['SET', KEY_HISTORY, JSON.stringify(body.history)]);
      if (commands.length === 0) {
        writeJson(res, 400, { error: 'Body kosong — kirim { catalog, history }.' });
        return;
      }
      await redisPipeline(commands);
      writeJson(res, 200, { ok: true });
      return;
    }

    writeJson(res, 405, { error: `Method ${req.method} tidak didukung.` });
  } catch (err) {
    writeJson(res, 500, { error: err instanceof Error ? err.message : 'Gagal sinkron' });
  }
};

export default handler;
