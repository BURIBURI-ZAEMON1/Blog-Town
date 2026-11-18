import type { APIRoute } from 'astro';
import { getSiteData } from '../../lib/site-data';

export const GET: APIRoute = async () => {
  const { searchIndex } = await getSiteData();
  return new Response(JSON.stringify(searchIndex), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
