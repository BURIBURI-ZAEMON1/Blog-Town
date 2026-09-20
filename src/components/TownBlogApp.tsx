import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ElementType } from 'react';
import type { SceneAnchor, TownPost } from './TownScene';
import TownLoading from './TownLoading';
import type { TownSceneProps } from '../scene/brick-town/types';
import { friendLinks, siteConfig } from '../config/site';
import type { TownLayout } from '../data/town-layout';
import { createTownMapModel } from '../data/town-map';

type SidebarPanel = 'profile' | 'series' | 'categories' | 'category-posts' | 'tags' | 'tag-posts' | 'friends';
type MainSurface = 'town' | 'article' | 'archive';
type ColorMode = 'day' | 'night';
type ExplorePanel = 'categories' | 'tags' | 'friends';

type ReturnContext = {
  surface: MainSurface;
  sidebarPanel: SidebarPanel;
  category?: string;
  tag?: string;
  query: string;
  scrollY: number;
};

type Props = { posts: TownPost[]; layout: TownLayout; initialSurface?: MainSurface; initialPostId?: string };

const TownScene = lazy(async () => {
  // Fetch the large Babylon runtime in parallel with the React scene wrapper,
  // avoiding a second network waterfall after the wrapper mounts.
  const [component] = await Promise.all([
    import('./TownScene'),
    import('../scene/brick-town/runtime'),
  ]);
  return component;
});

type TownStageProps = TownSceneProps & {
  hoveredPost?: TownPost;
  hoverAnchor?: SceneAnchor;
};

function TownStage({ hoveredPost, hoverAnchor, ...sceneProps }: TownStageProps) {
  const [settled, setSettled] = useState(false);
  return <div className="town-stage-wrap">
    <Suspense fallback={null}>
      <TownScene
        {...sceneProps}
        onLoadingStart={() => setSettled(false)}
        onFirstFrame={() => setSettled(true)}
        onInitializationError={() => setSettled(true)}
      />
    </Suspense>
    {!settled && <TownLoading reducedMotion={sceneProps.reducedMotion} />}
    <TownTooltip post={hoveredPost} anchor={hoverAnchor} />
  </div>;
}

const icon = (name: string) => {
  const paths: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9 20v-5h6v5',
    archive: 'M4 5.5h16v3H4zM5.5 8.5V20h13V8.5M8 12h8M8 15.5h6',
    category: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z',
    tag: 'M5 5h6l8 8-6 6-8-8V5zM8 8.5h.01',
    friends: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 12a2.5 2.5 0 1 0 0-5M3.5 19c.3-3 2.1-4.5 4.5-4.5s4.2 1.5 4.5 4.5M14 15c2.5-.2 4.1 1.1 4.5 4',
    search: 'm20 20-4.6-4.6M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z',
    sun: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z',
    moon: 'M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z',
    arrow: 'M5 12h13M13 7l5 5-5 5',
    back: 'M19 12H6M11 6l-6 6 6 6',
    close: 'M6 6l12 12M18 6 6 18',
    external: 'M14 5h5v5M19 5l-8 8M17 13v5H5V6h5',
    chevron: 'm9 6 6 6-6 6',
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon"><path d={paths[name] ?? paths.home} /></svg>;
};

const formatDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1].slice(2)}-${match[2]}-${match[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return `${String(date.getFullYear()).slice(-2)}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const getScore = (post: TownPost, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  let score = 0;
  if (post.title.toLowerCase().includes(needle)) score += 100;
  if (post.category.toLowerCase().includes(needle)) score += 44;
  if (post.tags.join(' ').toLowerCase().includes(needle)) score += 34;
  if (post.series?.toLowerCase().includes(needle)) score += 30;
  if (post.description.toLowerCase().includes(needle)) score += 15;
  if (post.searchText.toLowerCase().includes(needle)) score += 8;
  return score;
};

export default function TownBlogApp({ posts, layout, initialSurface = 'town', initialPostId }: Props) {
  const [surface, setSurface] = useState<MainSurface>(initialSurface);
  const initialPost = initialPostId ? posts.find((post) => post.id === initialPostId) : undefined;
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>(initialPost?.series ? 'series' : 'profile');
  const [selectedPostId, setSelectedPostId] = useState<string | undefined>(initialPost?.id);
  const [hoveredPostId, setHoveredPostId] = useState<string>();
  const [hoverAnchor, setHoverAnchor] = useState<SceneAnchor>();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>();
  const [activeTag, setActiveTag] = useState<string>();
  const [previewCategory, setPreviewCategory] = useState<string>();
  const [previewTag, setPreviewTag] = useState<string>();
  const [colorMode, setColorMode] = useState<ColorMode>('day');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [explorePanel, setExplorePanel] = useState<ExplorePanel>();
  const inputRef = useRef<HTMLInputElement>(null);
  const returnContextRef = useRef<ReturnContext | undefined>(undefined);
  const recentRef = useRef<HTMLElement>(null);
  const mainSurfaceRef = useRef<HTMLElement>(null);

  const postMap = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const sortedPosts = useMemo(() => [...posts].sort((a, b) => +new Date(b.date) - +new Date(a.date)), [posts]);
  const categories = useMemo(() => [...new Set(posts.map((post) => post.category))], [posts]);
  const tags = useMemo(() => [...new Set(posts.flatMap((post) => post.tags))], [posts]);
  const filteredPosts = useMemo(() => sortedPosts.filter((post) => {
    const matchesQuery = !query || getScore(post, query) > 0;
    const matchesCategory = !activeCategory || post.category === activeCategory;
    const matchesTag = !activeTag || post.tags.includes(activeTag);
    return matchesQuery && matchesCategory && matchesTag;
  }), [activeCategory, activeTag, query, sortedPosts]);
  const searchResults = useMemo(() => sortedPosts
    .map((post) => ({ post, score: getScore(post, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((result) => result.post), [query, sortedPosts]);
  const selectedPost = selectedPostId ? postMap.get(selectedPostId) : undefined;
  const hoveredPost = hoveredPostId ? postMap.get(hoveredPostId) : undefined;
  const highlightCategory = previewCategory ?? activeCategory;
  const highlightTag = previewTag ?? activeTag;
  const sidebarPosts = sidebarPanel === 'category-posts' ? sortedPosts.filter((post) => post.category === activeCategory) : sidebarPanel === 'tag-posts' ? sortedPosts.filter((post) => activeTag && post.tags.includes(activeTag)) : sortedPosts;
  const currentSeriesPosts = useMemo(() => selectedPost?.series ? sortedPosts.filter((post) => post.series === selectedPost.series).sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0)) : [], [selectedPost, sortedPosts]);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setHoveredPostId(undefined);
        setHoverAnchor(undefined);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const readLocation = () => {
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts[0] === 'posts' && parts[1]) {
        const postId = decodeURIComponent(parts[1]);
        return posts.some((post) => post.id === postId)
          ? { surface: 'article' as const, postId }
          : { surface: 'archive' as const, postId: undefined };
      }
      if (parts[0] === 'posts') return { surface: 'archive' as const, postId: undefined };

      // Preserve old demo query links while canonical navigation uses real static paths.
      const params = new URLSearchParams(window.location.search);
      const legacyPost = params.get('post');
      if (params.get('view') === 'article' && legacyPost && posts.some((post) => post.id === legacyPost)) {
        return { surface: 'article' as const, postId: legacyPost };
      }
      if (params.get('view') === 'archive') return { surface: 'archive' as const, postId: undefined };
      return { surface: 'town' as const, postId: undefined };
    };

    const initial = readLocation();
    window.history.replaceState({ surface: initial.surface, postId: initial.postId, ...(window.history.state ?? {}) }, '', window.location.href);
    setSurface(initial.surface);
    setSelectedPostId(initial.postId);
    if (initial.surface === 'article') {
      const article = posts.find((post) => post.id === initial.postId);
      setSidebarPanel(article?.series ? 'series' : 'profile');
    } else {
      setSidebarPanel('profile');
    }

    const onPopState = () => {
      const next = readLocation();
      const context = returnContextRef.current ?? (window.history.state?.returnContext as ReturnContext | undefined);
      if (context && next.surface !== 'article') {
        setSurface(context.surface);
        setSidebarPanel(context.sidebarPanel);
        setActiveCategory(context.category);
        setActiveTag(context.tag);
        setQuery(context.query);
        setSelectedPostId(undefined);
        setHoveredPostId(undefined);
        setHoverAnchor(undefined);
        returnContextRef.current = undefined;
        window.setTimeout(() => mainSurfaceRef.current?.scrollTo({ top: context.scrollY, behavior: 'auto' }), 0);
        return;
      }
      setSurface(next.surface);
      setSelectedPostId(next.postId);
      if (next.surface === 'article') {
        const nextArticle = posts.find((item) => item.id === next.postId);
        setSidebarPanel(nextArticle?.series ? 'series' : 'profile');
      } else {
        setSidebarPanel('profile');
        returnContextRef.current = undefined;
      }
      window.setTimeout(() => mainSurfaceRef.current?.scrollTo({ top: 0, behavior: 'auto' }), 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [posts]);

  const navigate = (nextSurface: MainSurface, postId?: string, state: Record<string, unknown> = {}) => {
    setSurface(nextSurface);
    setSelectedPostId(postId);
    const path = nextSurface === 'article' && postId
      ? `/posts/${encodeURIComponent(postId)}/`
      : nextSurface === 'archive' ? '/posts/' : '/';
    window.history.pushState({ surface: nextSurface, postId, ...state }, '', path);
  };

  const openArticle = (id: string) => {
    // Keep one return checkpoint for the original town/archive entry. When an
    // article links to another article, add a history entry without replacing
    // that checkpoint so repeated Back actions eventually restore the origin.
    const enteringArticle = surface !== 'article';
    const returnContext: ReturnContext = { surface, sidebarPanel, category: activeCategory, tag: activeTag, query, scrollY: mainSurfaceRef.current?.scrollTop ?? 0 };
    if (enteringArticle) returnContextRef.current = returnContext;
    navigate('article', id, enteringArticle ? { returnContext } : {});
    const nextArticle = posts.find((post) => post.id === id);
    setSidebarPanel(nextArticle?.series ? 'series' : 'profile');
    setExplorePanel(undefined);
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
    mainSurfaceRef.current?.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const returnFromArticle = () => {
    const context = returnContextRef.current;
    if (!context) return navigate('town');
    window.history.back();
  };

  const chooseCategory = (category?: string) => {
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setActiveCategory(category);
    setActiveTag(undefined);
    setSidebarPanel(category ? 'category-posts' : 'categories');
    setExplorePanel(undefined);
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
  };
  const chooseTag = (tag?: string) => {
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setActiveTag(tag);
    setActiveCategory(undefined);
    setSidebarPanel(tag ? 'tag-posts' : 'tags');
    setExplorePanel(undefined);
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
  };
  const clearFilters = () => {
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setQuery('');
    setActiveCategory(undefined);
    setActiveTag(undefined);
    setSidebarPanel('profile');
    setExplorePanel(undefined);
    setSearchOpen(false);
  };
  const onHoverPost = (id?: string, anchor?: SceneAnchor) => {
    setHoveredPostId(id);
    setHoverAnchor(anchor);
    if (!id) {
      setPreviewCategory(undefined);
      setPreviewTag(undefined);
    }
  };
  const onSidebarPostHover = (id?: string) => {
    setHoveredPostId(id);
    setHoverAnchor(undefined);
  };
  const onCategoryPreview = (category?: string) => {
    setPreviewCategory(category);
    setPreviewTag(undefined);
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
  };
  const onTagPreview = (tag?: string) => {
    setPreviewTag(tag);
    setPreviewCategory(undefined);
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
  };
  const onResolvePostAnchor = (id: string, anchor: SceneAnchor) => {
    if (hoveredPostId === id) setHoverAnchor(anchor);
  };
  const openExplore = (panel: ExplorePanel) => {
    if (surface === 'town') {
      if (panel === 'categories') setSidebarPanel(activeCategory ? 'category-posts' : 'categories');
      if (panel === 'tags') setSidebarPanel(activeTag ? 'tag-posts' : 'tags');
      if (panel === 'friends') setSidebarPanel('friends');
      setExplorePanel(undefined);
      return;
    }
    if (panel === 'categories') {
      setActiveTag(undefined);
      setQuery('');
    } else if (panel === 'tags') {
      setActiveCategory(undefined);
      setQuery('');
    }
    setExplorePanel(panel);
  };
  const chooseMainCategory = (category: string) => {
    setActiveCategory((current) => current === category ? undefined : category);
    setActiveTag(undefined);
    setQuery('');
    setExplorePanel('categories');
    if (surface === 'article') navigate('archive');
  };
  const chooseMainTag = (tag: string) => {
    setActiveTag((current) => current === tag ? undefined : tag);
    setActiveCategory(undefined);
    setQuery('');
    setExplorePanel('tags');
    if (surface === 'article') navigate('archive');
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchIndex((index) => Math.min(index + 1, Math.max(0, searchResults.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && searchResults[searchIndex]) {
      openArticle(searchResults[searchIndex].id);
      setSearchOpen(false);
    }
  };

  return (
    <div className={`app-shell ${colorMode === 'night' ? 'mode-night' : ''}`}>
      <aside className="sidebar" aria-label={`${siteConfig.title} 侧边栏`}>
        <div className="sidebar-scroll">
          <div className="brand-block"><div className="brand-mark brand-image"><img src={siteConfig.logo} alt="" /></div><div><div className="brand-name">{siteConfig.title}</div><div className="brand-subtitle">{siteConfig.tagline}</div></div></div>
          <div className="sidebar-rule" />
          <nav className="primary-nav">
            <button className={`nav-item ${surface === 'town' && sidebarPanel === 'profile' ? 'is-active' : ''}`} onClick={() => { setSidebarPanel('profile'); setActiveCategory(undefined); setActiveTag(undefined); setExplorePanel(undefined); navigate('town'); }}>{icon('home')}<span>小镇首页</span><span className="nav-count">01</span></button>
            <button className={`nav-item ${surface === 'archive' ? 'is-active' : ''}`} onClick={() => { setSidebarPanel('profile'); setQuery(''); setActiveCategory(undefined); setActiveTag(undefined); setExplorePanel(undefined); navigate('archive'); }}>{icon('archive')}<span>全部文章</span><span className="nav-count">{String(posts.length).padStart(2, '0')}</span></button>
          </nav>
          <div className="sidebar-section-label">探索</div>
          <nav className="secondary-nav">
            <button className={`nav-item ${(surface !== 'town' && explorePanel === 'categories') || (surface === 'town' && (sidebarPanel === 'categories' || sidebarPanel === 'category-posts')) ? 'is-active' : ''}`} onClick={() => openExplore('categories')}>{icon('category')}<span>分类</span><span className="nav-count">{String(categories.length).padStart(2, '0')}</span></button>
            <button className={`nav-item ${(surface !== 'town' && explorePanel === 'tags') || (surface === 'town' && (sidebarPanel === 'tags' || sidebarPanel === 'tag-posts')) ? 'is-active' : ''}`} onClick={() => openExplore('tags')}>{icon('tag')}<span>标签</span><span className="nav-count">{String(tags.length).padStart(2, '0')}</span></button>
            <button className={`nav-item ${(surface !== 'town' && explorePanel === 'friends') || (surface === 'town' && sidebarPanel === 'friends') ? 'is-active' : ''}`} onClick={() => openExplore('friends')}>{icon('friends')}<span>友邻</span><span className="nav-count">{String(friendLinks.length).padStart(2, '0')}</span></button>
          </nav>
          <div className="sidebar-spacer" />
          <SidebarContent panel={sidebarPanel} posts={sidebarPosts} categories={categories} tags={tags} activeCategory={activeCategory} activeTag={activeTag} currentSeriesPosts={surface === 'article' ? currentSeriesPosts : []} selectedPostId={selectedPostId} hoveredPostId={hoveredPostId} onHover={onSidebarPostHover} onCategoryPreview={onCategoryPreview} onTagPreview={onTagPreview} onCategory={chooseCategory} onTag={chooseTag} onOpenArticle={openArticle} onBack={() => { setPreviewCategory(undefined); setPreviewTag(undefined); setSidebarPanel(activeCategory ? 'categories' : activeTag ? 'tags' : 'profile'); setActiveCategory(undefined); setActiveTag(undefined); }} />
        </div>
        <div className="sidebar-footer"><span>{siteConfig.copyright}</span><a href={siteConfig.siteUrl}>{new URL(siteConfig.siteUrl).hostname}</a></div>
      </aside>

      <main className="main-surface" ref={mainSurfaceRef}>
        <header className="topnav">
          <button className="top-logo" onClick={() => { setSidebarPanel('profile'); navigate('town'); }}><span className="top-logo-mark top-logo-image"><img src={siteConfig.logo} alt="" /></span><span>{siteConfig.shortTitle}</span></button>
          <div className="topnav-center"><div className="top-search"><span>{icon('search')}</span><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); setSearchIndex(0); }} onFocus={() => setSearchOpen(true)} onKeyDown={onSearchKeyDown} placeholder="在小镇里寻找一篇笔记…" aria-label="搜索文章" /><kbd>⌘ K</kbd>{searchOpen && query && <SearchDropdown results={searchResults} activeIndex={searchIndex} onHover={onSidebarPostHover} onOpen={openArticle} onArchive={() => { setSidebarPanel('profile'); setSearchOpen(false); navigate('archive'); }} />}</div></div>
          <div className="topnav-actions"><button className="mode-button" onClick={() => setColorMode((mode) => mode === 'day' ? 'night' : 'day')} aria-label="切换昼夜模式">{colorMode === 'day' ? icon('moon') : icon('sun')}<span>{colorMode === 'day' ? '夜间' : '日间'}</span></button><span className="top-live"><i /> LIVE MAP</span><span className="avatar-mini"><img src={siteConfig.profile.avatar} alt={siteConfig.profile.name} /></span></div>
        </header>

        {surface === 'town' && <section className="town-home">
          <TownStage posts={posts} layout={layout} activePostId={selectedPostId} hoveredPostId={hoveredPostId} query={query} category={highlightCategory} tag={highlightTag} categoryPreview={Boolean(previewCategory)} tagPreview={Boolean(previewTag)} colorMode={colorMode} reducedMotion={reducedMotion} onHoverPost={onHoverPost} onResolvePostAnchor={onResolvePostAnchor} onSelectPost={openArticle} hoveredPost={hoveredPost} hoverAnchor={hoverAnchor} />
          <div className="town-caption"><span><i className="caption-dot" /> {siteConfig.title} · 小镇地图</span><span>文章建筑 / {layout.plots.length} buildings / {posts.length} article floors</span><span className="caption-spacer" /><button onClick={() => { setSidebarPanel('profile'); navigate('archive'); }}>打开完整档案 {icon('arrow')}</button></div>
          <RecentPosts posts={filteredPosts.slice(0, 5)} hasFilter={Boolean(query || activeCategory || activeTag)} onOpen={openArticle} onClear={clearFilters} sectionRef={recentRef} />
        </section>}
        {surface !== 'town' && explorePanel && <ExplorePanel panel={explorePanel} categories={categories} tags={tags} posts={posts} activeCategory={activeCategory} activeTag={activeTag} onCategory={chooseMainCategory} onTag={chooseMainTag} />}
        {surface === 'archive' && !explorePanel && <ArchiveView posts={filteredPosts} allPosts={posts} query={query} activeCategory={activeCategory} activeTag={activeTag} compact={false} onOpen={openArticle} />}
        {surface !== 'town' && explorePanel && explorePanel !== 'friends' && <ArchiveView posts={filteredPosts} allPosts={posts} query={query} activeCategory={activeCategory} activeTag={activeTag} compact onOpen={openArticle} />}
        {surface === 'article' && !explorePanel && selectedPost && <ArticleView post={selectedPost} layout={layout} scrollRoot={mainSurfaceRef} onBack={returnFromArticle} onOpen={openArticle} related={posts.filter((post) => post.id !== selectedPost.id && (post.category === selectedPost.category || Boolean(selectedPost.series && post.series === selectedPost.series))).slice(0, 3)} />}
        {surface === 'article' && !explorePanel && !selectedPost && <EmptyView title="还没有选择文章" copy="从小镇或侧边栏打开一篇笔记吧。" action="回到小镇" onAction={() => navigate('town')} />}
      </main>
    </div>
  );
}

function SidebarContent({ panel, posts, categories, tags, activeCategory, activeTag, currentSeriesPosts, selectedPostId, hoveredPostId, onHover, onCategoryPreview, onTagPreview, onCategory, onTag, onOpenArticle, onBack }: { panel: SidebarPanel; posts: TownPost[]; categories: string[]; tags: string[]; activeCategory?: string; activeTag?: string; currentSeriesPosts: TownPost[]; selectedPostId?: string; hoveredPostId?: string; onHover: (id?: string) => void; onCategoryPreview: (value?: string) => void; onTagPreview: (value?: string) => void; onCategory: (value?: string) => void; onTag: (value?: string) => void; onOpenArticle: (id: string) => void; onBack: () => void }) {
  if (panel === 'categories' || panel === 'category-posts') return <div className="sidebar-panel"><SidebarPanelHeader title={panel === 'category-posts' ? activeCategory ?? '分类文章' : '分类'} eyebrow="CATEGORIES" onBack={panel === 'category-posts' ? onBack : undefined} />{panel === 'categories' ? <div className="sidebar-taxonomy">{categories.map((category) => <button key={category} className={activeCategory === category ? 'is-selected' : ''} onMouseEnter={() => onCategoryPreview(category)} onMouseLeave={() => onCategoryPreview(undefined)} onClick={() => onCategory(category)}><span>{category}</span><b>{posts.filter((post) => post.category === category).length}</b></button>)}</div> : <SidebarPostList posts={posts} hoveredPostId={hoveredPostId} onHover={onHover} onOpenArticle={onOpenArticle} />}</div>;
  if (panel === 'tags' || panel === 'tag-posts') return <div className="sidebar-panel"><SidebarPanelHeader title={panel === 'tag-posts' ? `#${activeTag ?? '标签'}` : '标签'} eyebrow="TAGS" onBack={panel === 'tag-posts' ? onBack : undefined} />{panel === 'tags' ? <div className="sidebar-tags">{tags.map((tag) => <button key={tag} className={activeTag === tag ? 'is-selected' : ''} onMouseEnter={() => onTagPreview(tag)} onMouseLeave={() => onTagPreview(undefined)} onClick={() => onTag(tag)}>#{tag}</button>)}</div> : <SidebarPostList posts={posts} hoveredPostId={hoveredPostId} onHover={onHover} onOpenArticle={onOpenArticle} />}</div>;
  if (panel === 'friends') return <div className="sidebar-panel"><SidebarPanelHeader title="友邻" eyebrow="FRIEND LINKS" />{friendLinks.length ? <div className="friends-list">{friendLinks.map((friend) => <a className="friend-row" href={friend.url} target="_blank" rel="noreferrer noopener" key={friend.id}><span className="friend-avatar"><img src={friend.avatar} alt="" loading="lazy" /></span><span><strong>{friend.nickname}</strong>{friend.description && <small>{friend.description}</small>}</span>{icon('external')}</a>)}</div> : <div className="sidebar-empty">还没有友邻，等一封新信。</div>}</div>;
  if (panel === 'series') {
    if (!currentSeriesPosts.length) return null;
    return <div className="sidebar-panel series-panel"><SidebarPanelHeader title={currentSeriesPosts[0]?.series ?? '当前系列'} eyebrow="SERIES" /><SeriesDirectory posts={currentSeriesPosts} selectedPostId={selectedPostId} onOpenArticle={onOpenArticle} /></div>;
  }
  return <div className="profile-panel"><img className="profile-avatar" src={siteConfig.profile.avatar} alt={siteConfig.profile.name} /><span className="panel-eyebrow">ABOUT ME</span><h2>{siteConfig.profile.name}</h2><strong className="profile-headline">{siteConfig.profile.headline}</strong><p>{siteConfig.profile.bio}</p>{siteConfig.profile.links.length > 0 && <div className="profile-links">{siteConfig.profile.links.map((link) => <a key={link.id} href={link.url} aria-label={link.label} title={link.label} target={link.url.startsWith('http') ? '_blank' : undefined} rel={link.url.startsWith('http') ? 'noreferrer noopener' : undefined}><img className="profile-link-logo" src={link.logo} alt="" loading="lazy" /><span className="visually-hidden">{link.label}</span></a>)}</div>}</div>;
}

function SidebarPanelHeader({ title, eyebrow, onBack }: { title: string; eyebrow: string; onBack?: () => void }) { return <div className="sidebar-panel-header">{onBack && <button onClick={onBack} aria-label="返回面板">{icon('back')}</button>}<div><span>{eyebrow}</span><strong>{title}</strong></div></div>; }
function SidebarPostList({ posts, hoveredPostId, onHover, onOpenArticle }: { posts: TownPost[]; hoveredPostId?: string; onHover: (id?: string) => void; onOpenArticle: (id: string) => void }) { return <div className="sidebar-posts">{posts.map((post, index) => <button key={post.id} className={`sidebar-post ${hoveredPostId === post.id ? 'is-hovered' : ''}`} onMouseEnter={() => onHover(post.id)} onMouseLeave={() => onHover(undefined)} onClick={() => onOpenArticle(post.id)}><span className="sidebar-post-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{post.title}</strong><small>{post.category} · {formatDate(post.date)}</small></span>{icon('chevron')}</button>)}</div>; }

function SearchDropdown({ results, activeIndex, onHover, onOpen, onArchive }: { results: TownPost[]; activeIndex: number; onHover: (id?: string) => void; onOpen: (id: string) => void; onArchive: () => void }) { return <div className="search-dropdown"><span className="dropdown-label">SEARCHING THE TOWN · {results.length}</span>{results.length ? results.map((post, index) => <button key={post.id} className={`search-result ${index === activeIndex ? 'is-highlighted' : ''}`} onMouseEnter={() => onHover(post.id)} onClick={() => onOpen(post.id)}><span className="search-result-index">0{index + 1}</span><span><strong>{post.title}</strong><small>{post.category} · {post.readingTime} min</small></span>{icon('arrow')}</button>) : <div className="empty-search">没有找到相关笔记。</div>}{results.length > 0 && <button className="dropdown-full" onClick={onArchive}>查看全部结果 {icon('arrow')}</button>}</div>; }

function TownTooltip({ post, anchor }: { post?: TownPost; anchor?: SceneAnchor }) { if (!post || !anchor) return null; const position = anchor; return <div className="town-tooltip" style={{ left: position.x, top: position.y }}><div className="tooltip-meta"><span>{post.category}</span><span>{post.readingTime} min</span></div><strong>{post.title}</strong><p>{post.description}</p><div className="tooltip-tags">{post.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div></div>; }

function RecentPosts({ posts, hasFilter, onOpen, onClear, sectionRef }: { posts: TownPost[]; hasFilter: boolean; onOpen: (id: string) => void; onClear: () => void; sectionRef: React.RefObject<HTMLElement | null> }) { return <section className="recent-posts" ref={sectionRef}><header><div><span className="section-eyebrow">RECENT NOTES</span><h2>{hasFilter ? '当前筛选下的最近笔记' : '最近写下的几件事'}</h2></div><span className="recent-count">{String(posts.length).padStart(2, '0')} / notes</span></header>{posts.length ? <div className="recent-grid">{posts.map((post, index) => <button key={post.id} className={`recent-card card-${index % 4}`} onClick={() => onOpen(post.id)}><span className="card-top"><span>{post.category}</span><span>{formatDate(post.date)}</span></span><strong>{post.title}</strong><p>{post.description}</p><span className="card-bottom">#{post.tags[0]} <i /> 阅读 {post.readingTime} 分钟 {icon('arrow')}</span></button>)}</div> : <EmptyView title="这条路暂时没有笔记" copy="换一个筛选条件，或者回到地图看看别的房子。" action="清除筛选" onAction={onClear} />}</section>; }

function ArchiveView({ posts, allPosts, query, activeCategory, activeTag, compact, onOpen }: { posts: TownPost[]; allPosts: TownPost[]; query: string; activeCategory?: string; activeTag?: string; compact: boolean; onOpen: (id: string) => void }) {
  return <section className={`archive-page ${compact ? 'is-filtered-view' : ''}`}>
    {!compact && <><div className="archive-heading"><div><span className="section-eyebrow">THE ARCHIVE · {String(allPosts.length).padStart(2, '0')} NOTES</span><h1>文章档案</h1></div><div className="archive-mark">MAP<br /><b>01</b></div></div><div className="archive-toolbar"><div>{query && <span>搜索 · {query}</span>}{activeCategory && <span>分类 · {activeCategory}</span>}{activeTag && <span>标签 · {activeTag}</span>}</div><small>{String(posts.length).padStart(2, '0')} results</small></div></>}
    <div className="archive-list" aria-live="polite">{posts.map((post, index) => <button key={post.id} className={`archive-row ${post.cover ? 'has-cover' : ''}`} onClick={() => onOpen(post.id)}>{post.cover ? <span className="archive-cover"><img src={post.cover} alt="" loading="lazy" /></span> : <span className="archive-index">{String(index + 1).padStart(2, '0')}</span>}<span className="archive-copy"><strong>{post.title}</strong><small>{post.description}</small><em>{post.category} · {post.tags.slice(0, 2).map((tag) => `#${tag}`).join('  ')}</em></span><time>{formatDate(post.date)}</time>{icon('arrow')}</button>)}</div>
    {!posts.length && <div className="archive-empty"><h2>这里暂时没有文章</h2><p>再次点击当前选项即可取消筛选，或者选择上方的其他分类与标签。</p></div>}
  </section>;
}

type ArticleHeading = NonNullable<TownPost['sections'][number]['heading']>;

function ArticleView({ post, layout, related, scrollRoot, onBack, onOpen }: { post: TownPost; layout: TownLayout; related: TownPost[]; scrollRoot: React.RefObject<HTMLElement | null>; onBack: () => void; onOpen: (id: string) => void }) {
  const headings = post.sections.flatMap((section) => section.heading ? [section.heading] : []);
  const headingKey = headings.map((heading) => heading.id).join('|');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(headings[0]?.id);
  useEffect(() => {
    setCollapsed({});
    setActiveHeadingId(headings[0]?.id);
  }, [post.id]);
  useEffect(() => {
    const root = scrollRoot.current;
    if (!root || !headings.length) return;
    let frame: number | undefined;
    const updateActiveHeading = () => {
      frame = undefined;
      const rootTop = root.getBoundingClientRect().top;
      const readingLine = rootTop + 118;
      let next = headings[0]?.id;
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (!element || element.offsetParent === null) continue;
        if (element.getBoundingClientRect().top <= readingLine) next = heading.id;
        else break;
      }
      setActiveHeadingId((current) => current === next ? current : next);
    };
    const requestUpdate = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(updateActiveHeading);
    };
    updateActiveHeading();
    root.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      root.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [collapsed, headingKey, headings.length, scrollRoot]);

  const hiddenByCollapsedAncestor = (index: number) => {
    const currentLevel = post.sections[index].heading?.level;
    const activeLevels: number[] = [];
    for (let cursor = 0; cursor < index; cursor += 1) {
      const heading = post.sections[cursor].heading;
      if (!heading) continue;
      while (activeLevels.length && activeLevels[activeLevels.length - 1] >= heading.level) activeLevels.pop();
      if (collapsed[heading.id]) activeLevels.push(heading.level);
    }
    if (currentLevel) {
      while (activeLevels.length && activeLevels[activeLevels.length - 1] >= currentLevel) activeLevels.pop();
    }
    return activeLevels.length > 0;
  };

  return <section className="article-page"><button className="article-back" onClick={onBack}>{icon('back')} 返回原来的位置</button><div className="article-layout"><article><span className="section-eyebrow">FIELD NOTE · {formatDate(post.date).toUpperCase()}</span><h1>{post.title}</h1><p className="article-dek">{post.description}</p><div className="article-meta"><span>{post.category}</span><span>·</span><span>{post.readingTime} 分钟阅读</span><span>·</span><span>{post.wordCount} 字</span>{post.series && <><span>·</span><span>{post.series} / {(post.seriesIndex ?? 0) + 1}</span></>}</div>{post.cover && <figure className="article-cover"><img src={post.cover} alt={post.coverAlt ?? post.title} /></figure>}<div className="article-rule" /><div className="article-body">{post.sections.map((section, index) => {
    const ancestorHidden = hiddenByCollapsedAncestor(index);
    const ownCollapsed = section.heading ? Boolean(collapsed[section.heading.id]) : false;
    const headingTags: Record<number, ElementType> = { 1: 'h2', 2: 'h3', 3: 'h4', 4: 'h5', 5: 'h6', 6: 'h6' };
    const Heading = section.heading ? headingTags[Math.min(section.heading.level, 6)] : undefined;
    return <section className={`article-section ${ancestorHidden ? 'is-hidden' : ''}`} key={section.heading?.id ?? `preamble-${index}`}>{section.heading && Heading && <div className={`article-heading-row level-${section.heading.level}`}><Heading id={section.heading.id}>{section.heading.text}</Heading><button className="heading-toggle" aria-label={ownCollapsed ? `展开 ${section.heading.text}` : `收起 ${section.heading.text}`} aria-expanded={!ownCollapsed} onClick={() => setCollapsed((state) => ({ ...state, [section.heading!.id]: !state[section.heading!.id] }))} /></div>}{!ancestorHidden && !ownCollapsed && section.html && <div className="article-section-content" dangerouslySetInnerHTML={{ __html: section.html }} />}</section>;
  })}</div><div className="article-footer"><span>townId · {post.id}</span><span>／</span><span>{siteConfig.shortTitle} · map 01</span></div></article><aside className="article-aside"><span className="aside-eyebrow">ON THE MAP</span><MiniTownMap post={post} layout={layout} />{headings.length > 0 && <ArticleContents headings={headings} activeHeadingId={activeHeadingId} />}{related.length > 0 && <div className="related-posts"><span>继续阅读</span>{related.map((item) => <button key={item.id} onClick={() => onOpen(item.id)}><small>{item.category}</small><strong>{item.title}</strong></button>)}</div>}</aside></div></section>;
}

function ArticleContents({ headings, activeHeadingId }: { headings: ArticleHeading[]; activeHeadingId?: string }) {
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return <nav className="article-contents" aria-label="文章目录"> <span>文章目录</span>{headings.map((heading) => <button key={heading.id} aria-current={heading.id === activeHeadingId ? 'location' : undefined} className={`toc-level-${heading.level} ${heading.id === activeHeadingId ? 'is-active' : ''}`} onClick={() => jumpTo(heading.id)}>{heading.text}</button>)}</nav>;
}

function SeriesDirectory({ posts, selectedPostId, onOpenArticle }: { posts: TownPost[]; selectedPostId?: string; onOpenArticle: (id: string) => void }) { return <div className="series-directory"><span className="series-directory-label">当前系列 · {posts[0]?.series}</span>{posts.map((post, index) => <button key={post.id} className={post.id === selectedPostId ? 'is-current' : ''} onClick={() => onOpenArticle(post.id)}><b>{index + 1}:</b><span>{post.title}</span></button>)}</div>; }

function ExplorePanel({ panel, categories, tags, posts, activeCategory, activeTag, onCategory, onTag }: { panel: ExplorePanel; categories: string[]; tags: string[]; posts: TownPost[]; activeCategory?: string; activeTag?: string; onCategory: (value: string) => void; onTag: (value: string) => void }) {
  if (panel === 'friends') return <section className="main-explore-panel friends-explore"><div className="friends-explore-heading"><div><span className="section-eyebrow">FRIEND LINKS</span><h2>友邻</h2></div><div className="friends-ornament" aria-hidden="true"><i /><i /><i /><span>VISIT<br />THEIR<br />TOWNS</span></div></div>{friendLinks.length > 0 ? <div className="main-friends-list">{friendLinks.map((friend) => <a className="main-friend-row" href={friend.url} target="_blank" rel="noreferrer noopener" key={friend.id}><span className="friend-avatar"><img src={friend.avatar} alt="" loading="lazy" /></span><span><strong>{friend.nickname}</strong>{friend.description && <small>{friend.description}</small>}<em>{new URL(friend.url).hostname}</em></span>{icon('external')}</a>)}</div> : <div className="sidebar-empty">尚未配置友链。</div>}</section>;
  if (panel === 'categories') return <section className="main-explore-panel"><span className="section-eyebrow">CATEGORIES</span><h2>分类</h2><div className="main-taxonomy">{categories.map((category) => <button key={category} className={activeCategory === category ? 'is-selected' : ''} aria-pressed={activeCategory === category} onClick={() => onCategory(category)}><span>{category}</span><b>{posts.filter((post) => post.category === category).length}</b>{icon('arrow')}</button>)}</div></section>;
  return <section className="main-explore-panel"><span className="section-eyebrow">TAGS</span><h2>标签</h2><div className="main-tags">{tags.map((tag) => <button key={tag} className={activeTag === tag ? 'is-selected' : ''} aria-pressed={activeTag === tag} onClick={() => onTag(tag)}>#{tag}</button>)}</div></section>;
}

function MiniTownMap({ post, layout }: { post: TownPost; layout: TownLayout }) {
  const map = createTownMapModel(layout, post.id);
  const path = (points: { x: number; z: number }[]) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.z}`).join(' ');
  const polygonFor = (building: typeof map.buildings[number]) => building.points?.map((point) => `${point.x},${point.z}`).join(' ') ?? '';
  return <div className="article-location" aria-label={`文章建筑在小镇中的位置：${post.title}`}>
    <svg className="pixel-town-map" viewBox={`${map.bounds.minX} ${map.bounds.minZ} ${map.bounds.maxX - map.bounds.minX} ${map.bounds.maxZ - map.bounds.minZ}`} shapeRendering="crispEdges" role="img" aria-hidden="true">
      <rect className="mini-map-ground" x={map.bounds.minX} y={map.bounds.minZ} width={map.bounds.maxX - map.bounds.minX} height={map.bounds.maxZ - map.bounds.minZ} />
      <path className="mini-map-water" d={path(map.river.points)} style={{ strokeWidth: map.river.width }} />
      {map.roads.map((road, index) => <path className="mini-map-road" d={path(road.points)} style={{ strokeWidth: road.width }} key={`road-${index}`} />)}
      <path className="mini-map-road mini-map-center-ring" d={path(map.centerRing.points)} style={{ strokeWidth: map.centerRing.width }} />
      {map.centerConnectors.map((connector, index) => <path className="mini-map-road mini-map-center-connector" d={path(connector.points)} style={{ strokeWidth: connector.width }} key={`connector-${index}`} />)}
      {map.buildings.map((building) => <polygon className={`mini-map-building ${building === map.selected ? 'is-selected' : ''}`} key={building.id} points={polygonFor(building)} />)}
      {map.selected && <circle className="mini-map-marker" cx={map.selected.x} cy={map.selected.z} r="1.8" />}
    </svg>
  </div>;
}

function EmptyView({ title, copy, action, onAction }: { title: string; copy: string; action: string; onAction: () => void }) { return <div className="empty-view"><h2>{title}</h2><p>{copy}</p><button onClick={onAction}>{action} {icon('arrow')}</button></div>; }
