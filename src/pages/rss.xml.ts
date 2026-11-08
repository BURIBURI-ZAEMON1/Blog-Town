import rss from '@astrojs/rss';
import { siteConfig } from '../config/site';
import { getRssFeed } from '../lib/rss-feed';

export async function GET() {
  const { items } = await getRssFeed();
  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: siteConfig.siteUrl,
    items,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>${siteConfig.language}</language><atom:link href="${new URL('/rss.xml', siteConfig.siteUrl).href}" rel="self" type="application/rss+xml" />`,
  });
}
