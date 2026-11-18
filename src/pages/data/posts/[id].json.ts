import type { APIRoute } from 'astro';
import type { ArticleSection } from '../../../lib/markdown';
import { getSiteData } from '../../../lib/site-data';

export async function getStaticPaths() {
  const { contents } = await getSiteData();
  return Object.values(contents).map((content) => ({
    params: { id: content.id },
    props: { sections: content.sections },
  }));
}

export const GET: APIRoute = ({ props }) => new Response(
  JSON.stringify((props?.sections ?? []) as ArticleSection[]),
  { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
);
