import type { APIRoute } from 'astro';
import { siteConfig } from '../config/site';
import { getSiteData } from '../lib/site-data';

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (char) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
}[char]!));

export const GET: APIRoute = async () => {
  const { posts } = await getSiteData();
  const entries = [
    { loc: new URL('/', siteConfig.siteUrl).href, lastmod: undefined },
    { loc: new URL('/posts/', siteConfig.siteUrl).href, lastmod: posts[0]?.updatedAt ?? posts[0]?.date },
    ...posts.map((post) => ({
      loc: new URL(`/posts/${encodeURIComponent(post.id)}/`, siteConfig.siteUrl).href,
      lastmod: post.updatedAt ?? post.date,
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
