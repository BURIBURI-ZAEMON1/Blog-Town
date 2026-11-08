import type { APIRoute } from 'astro';
import { getRssFeed } from '../../lib/rss-feed';

export async function getStaticPaths() {
  const { images } = await getRssFeed();
  return images.map(image => ({ params: { hash: image.hash }, props: { png: image.png } }));
}

export const GET: APIRoute = ({ props }) => new Response(new Uint8Array(props.png), {
  headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
});
