import { siteConfig } from '../config/site';
import type { TownPostSummary } from '../scene/brick-town/types';

export function buildPageJsonLd(post?: TownPostSummary) {
  if (post) {
    const canonical = new URL(`/posts/${encodeURIComponent(post.id)}/`, siteConfig.siteUrl).href;
    const cover = new URL(post.cover ?? siteConfig.logo, siteConfig.siteUrl).href;
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updatedAt ?? post.date,
      author: { '@type': 'Person', name: siteConfig.profile.name, url: siteConfig.siteUrl },
      image: cover,
      mainEntityOfPage: canonical,
      articleSection: post.category,
      keywords: post.tags.join(', '),
      wordCount: post.wordCount,
      timeRequired: `PT${post.readingTime}M`,
      inLanguage: siteConfig.language,
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.title,
    alternateName: siteConfig.shortTitle,
    url: siteConfig.siteUrl,
    description: siteConfig.description,
    inLanguage: siteConfig.language,
    author: { '@type': 'Person', name: siteConfig.profile.name, url: siteConfig.siteUrl },
  };
}
