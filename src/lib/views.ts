import { siteConfig } from '../config/site';

export type ViewSnapshot = { readers: number; totals: { pageviews: number; visitors: number } };
const storagePrefix = 'town:views:dusays:';
const identityKey = `${storagePrefix}identity`;
const cache = new Map<string, ViewSnapshot>();
let identity: string | undefined;
let visitor: string | undefined;
let direct = false;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), method === 'POST' ? 6000 : 4500);
  try {
    try { identity ||= window.localStorage.getItem(identityKey) || undefined; } catch { /* Private browsing may block storage. */ }
    try { visitor ||= window.localStorage.getItem(`${storagePrefix}visitor`) || undefined; } catch { /* Storage is optional. */ }
    if (!visitor) {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
      visitor = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
        .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    }
    try { window.localStorage.setItem(`${storagePrefix}visitor`, visitor); } catch { /* Keep the visitor in memory. */ }
    const headers: Record<string, string> = direct
      ? { 'x-bsz-referer': new URL(path, siteConfig.siteUrl).href }
      : { 'x-town-visitor': visitor };
    if (identity) headers.Authorization = `Bearer ${identity}`;
    const response = await fetch(direct ? 'https://bsz.dusays.com/api' : `/api/views?path=${encodeURIComponent(path)}`, {
      method, headers, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
      signal: controller.signal,
    });
    // Static hosts without the optional Vercel function retain direct counting.
    if (!direct && (response.status === 404 || response.status === 405)) {
      direct = true;
      return requestView(path, method);
    }
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
  finally { clearTimeout(timeout); }
}

export function recordView(path: string): Promise<ViewSnapshot | undefined> {
  if (!viewsEnabled() || window.location.pathname !== path) return Promise.resolve(undefined);
  if (latest?.path === path) return latest.promise;
  // Each page counts independently; the signed token or browser ID identifies its visitor.
  const promise = requestView(path, 'POST').then(snapshot => snapshot ?? requestView(path, 'GET'));
  latest = { path, promise };
  // A timed-out POST may already have counted: retry only the read-only GET.
  void promise.then(snapshot => { if (!snapshot && latest?.promise === promise) latest = undefined; });
  return promise;
}

export function refreshView(path: string): Promise<ViewSnapshot | undefined> {
  if (!viewsEnabled() || window.location.pathname !== path) return Promise.resolve(undefined);
  return requestView(path, 'GET');
}
