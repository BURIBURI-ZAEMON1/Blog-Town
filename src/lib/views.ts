import { siteConfig } from '../config/site';

export type ViewSnapshot = { readers: number; totals: { pageviews: number; visitors: number } };
const storagePrefix = 'town:views:dusays:';
const identityKey = `${storagePrefix}identity`;
const cache = new Map<string, ViewSnapshot>();
let identity: string | undefined;
let latest: { path: string; promise: Promise<ViewSnapshot | undefined> } | undefined;

export const viewsEnabled = () => typeof window !== 'undefined'
  && new URL(siteConfig.siteUrl).origin === window.location.origin;

function validSnapshot(value: unknown): value is ViewSnapshot {
  const snapshot = value as ViewSnapshot | undefined;
  return [snapshot?.readers, snapshot?.totals?.pageviews, snapshot?.totals?.visitors]
    .every(count => Number.isSafeInteger(count) && count! >= 0);
}

export function getCachedView(path: string): ViewSnapshot | undefined {
  if (!viewsEnabled()) return;
  if (cache.has(path)) return cache.get(path);
  try {
    const snapshot = JSON.parse(window.sessionStorage.getItem(`${storagePrefix}${path}`) || 'null');
    if (validSnapshot(snapshot)) { cache.set(path, snapshot); return snapshot; }
  } catch { /* A missing or invalid cache must not block a fresh request. */ }
}

async function requestView(path: string, method: 'POST' | 'GET'): Promise<ViewSnapshot | undefined> {
  try {
    try { identity ||= window.localStorage.getItem(identityKey) || undefined; } catch { /* Private browsing may block storage. */ }
    const headers: Record<string, string> = { 'x-bsz-referer': new URL(path, siteConfig.siteUrl).href };
    if (identity) headers.Authorization = `Bearer ${identity}`;
    const response = await fetch('https://bsz.dusays.com/api', {
      method, headers, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
      signal: AbortSignal.timeout(method === 'POST' ? 3500 : 2000),
    });
    if (!response.ok) return;
    const value = await response.json();
    const counts = value?.data;
    const snapshot = { readers: counts?.page_uv, totals: { pageviews: counts?.site_pv, visitors: counts?.site_uv } };
    if (value?.success !== true || !validSnapshot(snapshot)) return;
    identity = response.headers.get('Set-Bsz-Identity') || identity;
    if (identity) try { window.localStorage.setItem(identityKey, identity); } catch { /* Keep the identity in memory when storage is unavailable. */ }
    cache.set(path, snapshot);
    try { window.sessionStorage.setItem(`${storagePrefix}${path}`, JSON.stringify(snapshot)); } catch { /* The in-memory cache still works. */ }
    return snapshot;
  } catch { /* Counting must never interrupt reading. */ }
}

export function recordView(path: string): Promise<ViewSnapshot | undefined> {
  if (!viewsEnabled() || window.location.pathname !== path) return Promise.resolve(undefined);
  if (latest?.path === path) return latest.promise;
  // A slow page must not block the current one; initial identity also derives from IP/UA.
  const promise = requestView(path, 'POST').then(snapshot => snapshot ?? requestView(path, 'GET'));
  latest = { path, promise };
  // A timed-out POST may already have counted: retry only the read-only GET.
  void promise.then(snapshot => { if (!snapshot && latest?.promise === promise) latest = undefined; });
  return promise;
}
