import { siteConfig } from '../config/site';

export type ViewSnapshot = {
  /** False when the counter is not configured or the request failed. */
  enabled: boolean;
  views: Record<string, number>;
  totals?: { pageviews: number; visitors: number };
};

const EMPTY: ViewSnapshot = { enabled: false, views: {} };
const REQUEST_TIMEOUT = 4000;
const CACHE_TTL = 60 * 1000;
const cache = new Map<string, { at: number; value: number }>();

/** Production hostnames only: preview deployments must not pollute the count. */
export const viewsEnabled = () => {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(siteConfig.siteUrl).hostname === window.location.hostname;
  } catch {
    return false;
  }
};

const read = async (paths: string[]): Promise<ViewSnapshot> => {
  if (!paths.length) return { enabled: true, views: {} };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(`/api/views?paths=${encodeURIComponent(paths.join(','))}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return EMPTY;
    const payload = (await response.json()) as Partial<ViewSnapshot>;
    if (!payload || payload.enabled === false) return EMPTY;
    return { enabled: true, views: payload.views ?? {} };
  } catch {
    return EMPTY;
  } finally {
    window.clearTimeout(timer);
  }
};

/**
 * Records one read for `path`. The server dedupes within a 30 minute window,
 * so calling this on every article open is safe and does not inflate counts.
 * Returns the updated total, or undefined when counting is unavailable.
 */
export const recordView = async (path: string): Promise<number | undefined> => {
  if (!viewsEnabled()) return undefined;
  try {
    const response = await fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { enabled?: boolean; views?: number };
    if (!payload?.enabled || typeof payload.views !== 'number') return undefined;
    cache.set(path, { at: Date.now(), value: payload.views });
    return payload.views;
  } catch {
    return undefined;
  }
};

/** Batched read used by list surfaces (About stats, archive rows). */
export const readViews = async (paths: string[]): Promise<ViewSnapshot> => {
  if (!viewsEnabled() || !paths.length) return EMPTY;
  const now = Date.now();
  const fresh: Record<string, number> = {};
  const stale: string[] = [];
  for (const path of paths) {
    const hit = cache.get(path);
    if (hit && now - hit.at < CACHE_TTL) fresh[path] = hit.value;
    else stale.push(path);
  }
  if (!stale.length) return { enabled: true, views: fresh };
  const snapshot = await read(stale);
  if (snapshot.enabled) {
    for (const [path, value] of Object.entries(snapshot.views)) cache.set(path, { at: now, value });
  }
  return { enabled: snapshot.enabled, views: { ...fresh, ...snapshot.views } };
};

/** Site-wide accumulated traffic for the About stat card. */
export const readSiteTotals = async (): Promise<{ pageviews: number; visitors: number } | undefined> => {
  if (!viewsEnabled()) return undefined;
  try {
    const response = await fetch('/api/views?totals=1', { headers: { Accept: 'application/json' } });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { enabled?: boolean; totals?: { pageviews: number; visitors: number } };
    if (!payload?.enabled || !payload.totals) return undefined;
    return payload.totals;
  } catch {
    return undefined;
  }
};

export const articlePath = (postId: string) => `/posts/${encodeURIComponent(postId)}/`;

export const formatViews = (value: number | undefined) => {
  if (value === undefined) return '—';
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value / 1000)}k`;
};
