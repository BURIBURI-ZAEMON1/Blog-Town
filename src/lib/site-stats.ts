import { siteConfig } from '../config/site';
import type { TownPostSummary } from '../scene/brick-town/types';

export function createSiteStats(posts: TownPostSummary[], now = new Date()) {
  const since = siteConfig.launchDate ?? posts.map(post => post.date).sort()[0];
  const start = since ? new Date(since).getTime() : NaN;
  return {
    posts: posts.length,
    categories: new Set(posts.map(post => post.category)).size,
    tags: new Set(posts.flatMap(post => post.tags)).size,
    words: posts.reduce((sum, post) => sum + post.wordCount, 0),
    days: Number.isFinite(start) ? Math.max(1, Math.floor((now.getTime() - start) / 86_400_000) + 1) : undefined,
    since,
  };
}
export const formatWords = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)} 万` : value.toLocaleString();
