import { siteConfig } from '../config/site';

export type ViewSnapshot = { views: number; totals: { pageviews: number; visitors: number } };
let requestId = 0;

export const viewsEnabled = () => typeof window !== 'undefined'
  && new URL(siteConfig.siteUrl).origin === window.location.origin;

export async function recordView(path: string): Promise<ViewSnapshot | undefined> {
  if (!viewsEnabled() || window.location.pathname !== path) return;
  return new Promise(resolve => {
    const callback = `TownViews_${Date.now()}_${requestId++}`;
    const callbacks = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    let settled = false;
    const finish = (snapshot?: ViewSnapshot) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.remove();
      // A response arriving after timeout must not call a missing global function.
      callbacks[callback] = () => {};
      window.setTimeout(() => { delete callbacks[callback]; }, 60_000);
      resolve(snapshot);
    };
    callbacks[callback] = (value: { page_pv?: number; site_pv?: number; site_uv?: number } | null) => {
      if (!value || ![value.page_pv, value.site_pv, value.site_uv].every(count => Number.isSafeInteger(count) && count! >= 0)) { finish(); return; }
      finish({ views: value.page_pv!, totals: { pageviews: value.site_pv!, visitors: value.site_uv! } });
    };
    script.src = `https://busuanzi.ibruce.info/busuanzi?jsonpCallback=${callback}`;
    // The official counter identifies individual articles from the full referrer.
    script.referrerPolicy = 'no-referrer-when-downgrade';
    script.async = true;
    script.onerror = () => finish();
    script.onload = () => finish();
    const timer = window.setTimeout(() => finish(), 8000);
    document.head.appendChild(script);
  });
}
