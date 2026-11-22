import { siteConfig } from '../config/site';
import { buildPageJsonLd } from '../lib/page-jsonld';
import type { TownPostSummary } from '../scene/brick-town/types';
import type { MainSurface } from './useTownNavigation';

const findMeta = (attribute: 'name' | 'property', key: string) =>
  document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

const setMeta = (attribute: 'name' | 'property', key: string, content?: string) => {
  const existing = findMeta(attribute, key);
  if (!content) {
    existing?.remove();
    return;
  }
  const element = existing ?? document.createElement('meta');
  element.setAttribute(attribute, key);
  element.setAttribute('content', content);
  if (!existing) document.head.append(element);
};

const setMetaGroup = (attribute: 'name' | 'property', key: string, values: string[]) => {
  document.head.querySelectorAll(`meta[${attribute}="${key}"]`).forEach((element) => element.remove());
  values.forEach((content) => {
    const element = document.createElement('meta');
    element.setAttribute(attribute, key);
    element.setAttribute('content', content);
    document.head.append(element);
  });
};

const setCanonical = (href: string) => {
  const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (link) link.href = href;
};

const setMetaProperty = (key: string, content?: string) => setMeta('property', key, content);

const setJsonLd = (value: unknown) => {
  const script = document.getElementById('page-jsonld');
  if (script) script.textContent = JSON.stringify(value).replace(/</g, '\\u003c');
};

export function updatePageMeta(surface: MainSurface, selectedPost?: TownPostSummary) {
  if (typeof document === 'undefined') return;
  const isArticle = Boolean(selectedPost);
  const pageTitle = selectedPost
    ? `${selectedPost.title} · ${siteConfig.title}`
    : surface === 'archive'
      ? `全部文章 · ${siteConfig.title}`
      : surface === 'about' ? `关于 · ${siteConfig.title}` : siteConfig.title;
  const description = selectedPost?.description ?? siteConfig.description;
  const canonical = new URL(
    selectedPost ? `/posts/${encodeURIComponent(selectedPost.id)}/` : surface === 'archive' ? '/posts/' : surface === 'about' ? '/about/' : '/',
    siteConfig.siteUrl,
  ).href;
  const cover = new URL(selectedPost?.cover ?? siteConfig.logo, siteConfig.siteUrl).href;

  document.title = pageTitle;
  setMeta('name', 'description', description);
  setMeta('property', 'og:type', isArticle ? 'article' : 'website');
  setMeta('property', 'og:title', pageTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:image', cover);
  setMeta('property', 'og:image:alt', selectedPost?.coverAlt ?? siteConfig.title);
  setMeta('name', 'twitter:title', pageTitle);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', cover);
  setMetaProperty('article:published_time', selectedPost?.date);
  setMetaProperty('article:modified_time', selectedPost?.updatedAt ?? selectedPost?.date);
  setMeta('property', 'article:section', selectedPost?.category);
  setMetaGroup('property', 'article:tag', selectedPost?.tags ?? []);
  setCanonical(canonical);

  setJsonLd(buildPageJsonLd(selectedPost));
}
