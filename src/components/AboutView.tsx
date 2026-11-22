import type { PointerEvent } from 'react';
import { aboutContent, type AboutSection } from '../config/about';
import type { TownPostSummary } from '../scene/brick-town/types';
import { siteConfig } from '../config/site';
import { createSiteStats, formatWords } from '../lib/site-stats';
import '../styles/about.css';

type Props = { posts: TownPostSummary[]; totals?: { pageviews: number; visitors: number } };
const externalIcon = <svg aria-hidden="true" viewBox="0 0 24 24" className="icon"><path d="M14 5h5v5M19 5l-8 8M17 13v5H5V6h5" /></svg>;
const profileLinks = siteConfig.profile.links;

function AboutLinks() {
  const links = [...profileLinks, ...(profileLinks.some(link => link.id === 'rss') ? [] : [{ id: 'rss', label: 'RSS', url: '/rss.xml', logo: '/assets/links/rss.svg' }])];
  return <nav className="about-links about-profile-links" aria-label="相关网站与订阅">{links.map(link => <a key={link.id} href={link.url} aria-label={link.label} title={link.label} target={link.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener"><img className="profile-link-logo" src={link.logo} alt="" width="20" height="20" /></a>)}</nav>;
}

function AboutCard({ section, index }: { section: AboutSection; index: number }) {
  const move = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const style = event.currentTarget.style;
    style.setProperty('--pointer-x', String(x)); style.setProperty('--pointer-y', String(y));
    style.setProperty('--tilt-x', `${(y - .5) * -7}deg`); style.setProperty('--tilt-y', `${(x - .5) * 7}deg`);
    style.setProperty('--shadow-x', `${(x - .5) * -16}px`); style.setProperty('--shadow-y', `${(y - .5) * -8}px`);
  };
  const reset = (event: PointerEvent<HTMLElement>) => {
    for (const property of ['--pointer-x', '--pointer-y', '--tilt-x', '--tilt-y', '--shadow-x', '--shadow-y']) event.currentTarget.style.removeProperty(property);
  };
  return <section className="about-card" onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
    <div className="about-card-content"><span className="about-card-index">{String(index + 1).padStart(2, '0')}</span>{section.title && <h2>{section.title}</h2>}
      {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      {section.link && <a className="about-card-link" href={section.link.href} target="_blank" rel="noreferrer noopener">{section.link.label}{externalIcon}</a>}
    </div>
    <span className="about-card-ring" aria-hidden="true" />
  </section>;
}

export default function AboutView({ posts, totals }: Props) {
  const stats = createSiteStats(posts);
  return <article className="about-page">
    <header className="about-heading">
      <span className="about-eyebrow">TOWN RESIDENT · ABOUT</span>
      <h1>{siteConfig.profile.name}</h1>
      <p>{siteConfig.profile.headline}</p>
    </header>
    <section className="about-hero" aria-label="作者与站点概况">
      <div className="about-portrait"><img src={siteConfig.profile.avatar} alt={siteConfig.profile.name} width="164" height="164" /><span>{siteConfig.profile.name}</span></div>
      <div className="about-intro">
        {aboutContent.introduction && <p>{aboutContent.introduction}</p>}
        <dl className="about-stats">
          <div><dt>文章</dt><dd>{stats.posts}</dd></div>
          <div><dt>累计字数</dt><dd>{formatWords(stats.words)}</dd></div>
          {stats.days !== undefined && <div><dt>{siteConfig.launchDate ? '运行天数' : '记录天数'}</dt><dd>{stats.days}</dd></div>}
          <div><dt>访问量</dt><dd>{totals ? totals.pageviews.toLocaleString() : '—'}</dd></div>
          <div><dt>访问人数</dt><dd>{totals ? totals.visitors.toLocaleString() : '—'}</dd></div>
        </dl>
        <AboutLinks />
      </div>
    </section>
    <div className="about-grid">{aboutContent.sections.map((section, index) => <AboutCard key={section.id} section={section} index={index} />)}</div>
    <footer className="about-notes">
      {!siteConfig.launchDate && stats.since && <p>记录天数从首篇文章发布日（{stats.since.slice(0, 10)}）起计算。</p>}
      <p>访问统计由<a href="https://busuanzi.9420.ltd/" target="_blank" rel="noreferrer noopener">不蒜子</a>提供。{!totals && '当前统计暂不可用。'}</p>
    </footer>
  </article>;
}
