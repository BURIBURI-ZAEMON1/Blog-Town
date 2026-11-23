import { siteConfig } from '../config/site.js';

// Both public hostnames count against siteUrl; preview hosts remain excluded.
export function isSiteOrigin(value: string): boolean {
  try {
    const actual = new URL(value), production = new URL(siteConfig.siteUrl);
    return actual.protocol === production.protocol && actual.port === production.port
      && actual.hostname.replace(/^www\./, '') === production.hostname.replace(/^www\./, '')
      && actual.username === '' && actual.password === '';
  } catch { return false; }
}
