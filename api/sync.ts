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

const writeJson = (res: ServerResponse, status: number, data: unknown): void => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
};

/** Kirim satu batch pipeline Redis REST (tanpa dependensi @upstash/redis). */
const redisPipeline = async (commands: unknown[][]): Promise<unknown[]> => {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = env();
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Konfigurasi Upstash untuk project ini belum ada (Storage belum dihubungkan).');
  }
  const base = UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
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
