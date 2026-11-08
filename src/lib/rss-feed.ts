import { siteConfig } from '../config/site';
import { getSiteData } from './site-data';
import { createRssContentRenderer } from './rss-content';

async function buildRssFeed() {
  // getSiteData already enforces the same draft/date visibility as the website.
  // Reuse its rendered sections, including resolved published-article embeds.
  const { posts } = await getSiteData();
  const renderer = createRssContentRenderer(siteConfig.siteUrl);
  const items = [];
  for (const post of posts) {
    const link = new URL(`/posts/${encodeURIComponent(post.id)}/`, siteConfig.siteUrl).href;
    const content = await renderer.renderSections(post.sections, link);
    items.push({
      title: post.title, description: post.description, pubDate: new Date(post.date),
      link, categories: [...new Set([post.category, ...post.tags])],
      content: `${content}<p><a href="${link}">在网站中阅读原文</a></p>`,
    });
  }
  return { items, images: [...renderer.images.values()] };
}

let feedPromise: ReturnType<typeof buildRssFeed> | undefined;
export function getRssFeed() {
  if (import.meta.env.DEV) return buildRssFeed();
  return feedPromise ??= buildRssFeed();
}
