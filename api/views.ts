import { siteConfig } from '../src/config/site';

type RequestLike = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};
type ResponseLike = {
  status: (code: number) => ResponseLike;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};
const visitorPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9._-]{1,512}$/;

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'no-store');
  const production = new URL(siteConfig.siteUrl);
  if (process.env.VERCEL_ENV === 'preview' || request.headers.host !== production.host
    || (request.headers.origin !== undefined && request.headers.origin !== production.origin)
    || request.headers['sec-fetch-site'] === 'cross-site') {
    response.status(403).json({ success: false }); return;
  }
  if (request.method !== 'POST' && request.method !== 'GET') {
    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ success: false }); return;
  }
  const path = request.query.path;
  const visitor = request.headers['x-town-visitor'];
  const authorization = request.headers.authorization;
  if (typeof path !== 'string' || path.length > 512 || !/^(?:\/|\/about\/|\/posts\/|\/posts\/[A-Za-z0-9._~%!-]+\/)$/.test(path)
    || new URL(path, production).pathname !== path
    || typeof visitor !== 'string' || !visitorPattern.test(visitor)
    || (authorization !== undefined && (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._-]{1,512}$/.test(authorization)))) {
    response.status(400).json({ success: false }); return;
  }
  try {
    const headers: Record<string, string> = {
      'x-bsz-referer': new URL(path, production).href,
      // Proxy visitors must not collapse into the server's shared IP and user agent.
      'User-Agent': `TownBlog/1 ${visitor}`,
    };
    if (typeof authorization === 'string') headers.Authorization = authorization;
    const upstream = await fetch('https://bsz.dusays.com/api', {
      method: request.method, headers, cache: 'no-store',
      signal: AbortSignal.timeout(request.method === 'POST' ? 4000 : 3000),
    });
    if (!upstream.ok) throw new Error('Counter unavailable');
    const value = await upstream.json();
    const counts = value?.data;
    if (value?.success !== true || ![counts?.page_uv, counts?.site_pv, counts?.site_uv]
      .every(count => Number.isSafeInteger(count) && count >= 0)) throw new Error('Invalid counter response');
    const identity = upstream.headers.get('Set-Bsz-Identity');
    if (identity && tokenPattern.test(identity)) response.setHeader('Set-Bsz-Identity', identity);
    response.status(200).json({ success: true, data: { page_uv: counts.page_uv, site_pv: counts.site_pv, site_uv: counts.site_uv } });
  } catch {
    response.status(503).json({ success: false });
  }
}
