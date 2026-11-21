import { siteConfig } from '../config/site';
import type { TownPostSummary } from '../scene/brick-town/types';

export type SiteStats = {
  posts: number;
  words: number;
  days: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build-time figures that must never be wrong. Anything that depends on a
 * remote counter is handled separately so a network failure can hide it
 * instead of showing a plausible-looking but false number.
 */
export const createSiteStats = (posts: TownPostSummary[], now = new Date()): SiteStats => {
  const launch = new Date(siteConfig.launchDate);
  const days = Number.isFinite(launch.getTime())
    ? Math.max(1, Math.floor((now.getTime() - launch.getTime()) / DAY_MS) + 1)
    : 1;
  return {
    posts: posts.length,
    words: posts.reduce((sum, post) => sum + post.wordCount, 0),
    days,
  };
};

export const formatWords = (value: number) => (value >= 10000 ? `${(value / 10000).toFixed(1)} 万` : String(value));
