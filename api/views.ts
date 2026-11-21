/**
 * Lightweight page-view counter for the static town site.
 *
 * Vercel runs this file as a Node function because the project keeps
 * `output: 'static'`. Storage is Upstash Redis over its REST API, so the
 * function stays dependency-free and works on the free tier.
 *
 * Semantics:
 * - `POST /api/views` with `{ path }` increments the view counter once per
 *   visitor per path inside a 30 minute window.
 * - `GET /api/views?paths=/posts/a/,/posts/b/` returns the totals in one round
 *   trip so an article switch does not fan out requests.
 *
 * When Upstash is not configured the endpoint reports `enabled: false` and the
 * UI falls back to hiding the number instead of showing a fake zero.
 */

type RequestLike = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
};

const DEDUPE_SECONDS = 30 * 60;
const ALLOWED_PREFIX = '/';
const MAX_PATHS = 40;

const redisConfig = () => {
  // Vercel's Upstash marketplace integration exports KV_REST_API_*; a manually
  // created Upstash database exports UPSTASH_REDIS_REST_*. Accept either so the
  // counter works no matter how the database was provisioned.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : undefined;
};

const redis = async (command: (string | number)[]) => {
  const config = redisConfig();
  if (!config) throw new Error('Upstash is not configured');
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Upstash ${response.status}`);
  const payload = (await response.json()) as { result?: unknown };
  return payload.result;
};

const normalizePath = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  // Only same-site article/archive paths are counted; query strings and
  // protocol-relative input are rejected so keys stay bounded and predictable.
  if (!trimmed.startsWith(ALLOWED_PREFIX) || trimmed.startsWith('//')) return undefined;
  if (trimmed.length > 200) return undefined;
  const [path] = trimmed.split('?');
  return path || undefined;
};

const visitorId = (headers: RequestLike['headers']) => {
  const forwarded = headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = raw?.split(',')[0]?.trim() ?? 'unknown';
  const agent = (headers['user-agent'] as string | undefined) ?? '';
  // A stable, non-reversible key: we never store the raw IP or agent.
  return `${ip}|${agent}`.slice(0, 240);
};

const hash = (value: string) => {
  let state = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    state = (state * 31 + value.charCodeAt(index)) >>> 0;
  }
  return state.toString(36);
};

const keyFor = (path: string) => `views:total:${path}`;
const visitorKeyFor = (path: string, visitor: string) => `views:seen:${path}:${hash(visitor)}`;
const SITE_VIEWS_KEY = 'views:site:pageviews';
const SITE_VISITORS_KEY = 'views:site:visitors';

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'no-store');

  if (!redisConfig()) {
    response.status(200).json({ enabled: false, views: {} });
    return;
  }

  try {
    if (request.method === 'GET') {
      const raw = request.query.paths;
      const list = (Array.isArray(raw) ? raw.join(',') : raw ?? '')
        .split(',')
        .map(normalizePath)
        .filter((path): path is string => Boolean(path))
        .slice(0, MAX_PATHS);
      const wantsTotals = request.query.totals === '1';
      if (!list.length && !wantsTotals) {
        response.status(200).json({ enabled: true, views: {} });
        return;
      }
      const values = list.length ? (await redis(['MGET', ...list.map(keyFor)])) as (string | null)[] | null : null;
      const views: Record<string, number> = {};
      list.forEach((path, index) => {
        const value = Number(values?.[index] ?? 0);
        views[path] = Number.isFinite(value) ? value : 0;
      });
      let totals: { pageviews: number; visitors: number } | undefined;
      if (wantsTotals) {
        const [pageviews, visitors] = await Promise.all([
          redis(['GET', SITE_VIEWS_KEY]),
          redis(['SCARD', SITE_VISITORS_KEY]),
        ]);
        totals = {
          pageviews: Number(pageviews ?? 0) || 0,
          visitors: Number(visitors ?? 0) || 0,
        };
      }
      response.status(200).json({ enabled: true, views, totals });
      return;
    }

    if (request.method === 'POST') {
      const body = (typeof request.body === 'string' ? safeParse(request.body) : request.body) as { path?: unknown } | undefined;
      const path = normalizePath(body?.path);
      if (!path) {
        response.status(400).json({ enabled: true, error: 'invalid path' });
        return;
      }
      // SET NX keeps the increment idempotent for one visitor inside the
      // window without a read-modify-write race between concurrent requests.
      const visitor = visitorId(request.headers);
      const fresh = await redis(['SET', visitorKeyFor(path, visitor), '1', 'NX', 'EX', DEDUPE_SECONDS]);
      // Site-wide totals count every read, including the deduped ones, so the
      // number reflects accumulated traffic rather than unique visitors.
      const siteView = await redis(['INCR', SITE_VIEWS_KEY]);
      await redis(['SADD', SITE_VISITORS_KEY, hash(visitor)]);
      const total = fresh === 'OK'
        ? Number(await redis(['INCR', keyFor(path)]))
        : Number((await redis(['GET', keyFor(path)])) ?? 0);
      response.status(200).json({ enabled: true, path, views: Number.isFinite(total) ? total : 0, siteViews: Number(siteView ?? 0) || 0 });
      return;
    }

    response.status(405).json({ enabled: true, error: 'method not allowed' });
  } catch {
    // A statistics outage must never break reading. The client treats a
    // non-200 as "unknown" and hides the number.
    response.status(503).json({ enabled: false, views: {} });
  }
}

const safeParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};
