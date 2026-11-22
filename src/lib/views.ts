import { siteConfig } from '../config/site';

export type ViewSnapshot = { readers: number; totals: { pageviews: number; visitors: number } };
const identityKey = 'town:views:identity';
let identity: string | undefined;
let queue = Promise.resolve();
let latest: { path: string; promise: Promise<ViewSnapshot | undefined> } | undefined;

export const viewsEnabled = () => typeof window !== 'undefined'
  && new URL(siteConfig.siteUrl).origin === window.location.origin;

export function recordView(path: string): Promise<ViewSnapshot | undefined> {
  if (!viewsEnabled() || window.location.pathname !== path) return Promise.resolve(undefined);
  if (latest?.path === path) return latest.promise;
  // Serialize first visits so a fast route change cannot race the identity response.
  const promise = queue.then(async () => {
    try {
      try { identity ||= window.localStorage.getItem(identityKey) || undefined; } catch { /* Private browsing may block storage. */ }
      const headers: Record<string, string> = { 'x-bsz-referer': new URL(path, siteConfig.siteUrl).href };
      if (identity) headers.Authorization = `Bearer ${identity}`;
      const response = await fetch('https://busuanzi.9420.ltd/api', {
        method: 'POST', headers, credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return;
      const value = await response.json();
      const counts = value?.data;
      if (value?.success !== true || ![counts?.page_uv, counts?.site_pv, counts?.site_uv].every(count => Number.isSafeInteger(count) && count >= 0)) return;
      identity = response.headers.get('Set-Bsz-Identity') || identity;
      if (identity) try { window.localStorage.setItem(identityKey, identity); } catch { /* Keep the identity in memory when storage is unavailable. */ }
      return { readers: counts.page_uv, totals: { pageviews: counts.site_pv, visitors: counts.site_uv } };
    } catch { /* Counting must never interrupt reading. */ }
  });
  latest = { path, promise };
  queue = promise.then(snapshot => { if (!snapshot && latest?.promise === promise) latest = undefined; });
  return promise;
}
