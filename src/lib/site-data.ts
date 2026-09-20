import { getCollection } from 'astro:content';
import { createTownLayout } from '../data/town-layout';
import { siteConfig } from '../config/site';
import { renderArticleMarkdown } from './markdown';

const buildSiteData = async () => {
  const now = new Date();
  const allEntries = await getCollection('posts');
  const entries = allEntries.filter((entry) => !entry.data.draft && entry.data.date <= now);

  const seenTownIds = new Map<string, string>();
  for (const entry of allEntries) {
    const previous = seenTownIds.get(entry.data.townId);
    if (previous) {
      throw new Error(`Duplicate townId "${entry.data.townId}" in ${previous} and ${entry.id}. townId values must be globally unique.`);
    }
    seenTownIds.set(entry.data.townId, entry.id);
  }


  const seriesOrders = new Map<string, Map<number, string>>();
  for (const entry of allEntries) {
    if (!entry.data.series || entry.data.seriesIndex === undefined) continue;
    const orders = seriesOrders.get(entry.data.series) ?? new Map<number, string>();
    const previous = orders.get(entry.data.seriesIndex);
    if (previous) {
      throw new Error(`Duplicate seriesIndex ${entry.data.seriesIndex} in series "${entry.data.series}" for ${previous} and ${entry.id}.`);
    }
    orders.set(entry.data.seriesIndex, entry.id);
    seriesOrders.set(entry.data.series, orders);
  }

  const posts = entries
    .map((entry) => {
      const rendered = renderArticleMarkdown(entry.body ?? '');
      return {
        id: entry.data.townId,
        townId: entry.data.townId,
        title: entry.data.title,
        category: entry.data.category,
        tags: entry.data.tags,
        series: entry.data.series,
        seriesIndex: entry.data.seriesIndex,
        description: entry.data.description,
        date: entry.data.date.toISOString(),
        updatedAt: entry.data.updatedAt?.toISOString(),
        readingTime: rendered.readingTime,
        wordCount: rendered.wordCount,
        cover: entry.data.cover,
        coverAlt: entry.data.coverAlt ?? entry.data.title,
        sections: rendered.sections,
        searchText: rendered.searchText,
      };
    })
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return {
    posts,
    layout: createTownLayout(siteConfig.townSeed, posts),
  };
};

let siteDataPromise: ReturnType<typeof buildSiteData> | undefined;
export const getSiteData = () => {
  // Astro's dev content loader can invalidate Markdown entries while this
  // module stays warm. Do not hold the first layout promise in dev, otherwise
  // a newly-added draft=false post never reaches the town layout until the
  // server is restarted. Static builds keep the safe per-process memoization.
  if (import.meta.env.DEV) return buildSiteData();
  siteDataPromise ??= buildSiteData();
  return siteDataPromise;
};
