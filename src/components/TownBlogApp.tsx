import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ElementType } from 'react';
import type { SceneAnchor, TownPost } from './TownScene';
import TownLoading from './TownLoading';
import { useNewPostIds } from './useNewPostIds';
import { useTownExploration } from './useTownExploration';
import type { TownSceneProps } from '../scene/brick-town/types';
import { friendLinks, siteConfig } from '../config/site';
import type { TownLayout } from '../data/town-layout';
import { createTownMapModel } from '../data/town-map';
import { getSeasonForDate, SEASON_ORDER, SEASON_PROFILES, type Season } from '../data/town-seasons';

type SidebarPanel = 'profile' | 'list' | 'categories' | 'category-posts' | 'tags' | 'tag-posts' | 'friends';
type MainSurface = 'town' | 'article' | 'archive';
type ColorMode = 'day' | 'night';
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Props = { posts: TownPost[]; layout: TownLayout; initialSurface?: MainSurface; initialPostId?: string };
const ARTICLE_HEADING_TAGS: Record<number, ElementType> = { 1: 'h2', 2: 'h3', 3: 'h4', 4: 'h5', 5: 'h6', 6: 'h6' };
type TownMapModel = ReturnType<typeof createTownMapModel>;

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
  touchPost?: TownPost;
  onCloseTouchPreview: () => void;
};

function TownStage({ hoveredPost, hoverAnchor, touchPost, onCloseTouchPreview, ...sceneProps }: TownStageProps) {
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
    {touchPost && <div className="town-touch-preview" role="region" aria-label="建筑文章预览">
      <button className="touch-preview-close" aria-label="关闭建筑预览" onClick={onCloseTouchPreview}>{icon('close')}</button>
      <div className="tooltip-meta"><span>{touchPost.category}</span><span>{touchPost.readingTime} min</span></div>
      <strong>{touchPost.title}</strong><p>{touchPost.description}</p>
      <button className="touch-preview-read" onClick={() => { sceneProps.onTownExplored?.(); sceneProps.onSelectPost(touchPost.id); }}>阅读文章 {icon('arrow')}</button>
    </div>}
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
    flower: 'M12 8c-4-7-9-1-4 2-7 2-3 9 2 5 0 7 8 6 6 0 7 2 8-6 2-6 4-6-3-9-6-1ZM12 15v6M8 20h4M10.5 11.5h3',
    leaf: 'M20 4C10 3 4 8 5 15c.5 4 5 5 8 3 5-3 6-9 7-14ZM4 21l10-11M9 16l-1-5M12 13h5',
    snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 4.5l3 3 3-3M9 19.5l3-3 3 3M4.5 11l4-1-1-4M16.5 18l-1-4 4-1M4.5 13l4 1-1 4M16.5 6l-1 4 4 1',
    arrow: 'M5 12h13M13 7l5 5-5 5',
    back: 'M19 12H6M11 6l-6 6 6 6',
    close: 'M6 6l12 12M18 6 6 18',
    menu: 'M4 7h16M4 12h16M4 17h16',
    toc: 'M5 6.5h.01M5 12h.01M5 17.5h.01M10 6.5h10M10 12h10M10 17.5h10',
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
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('profile');
  const [selectedPostId, setSelectedPostId] = useState<string | undefined>(initialPost?.id);
  const [hoveredPostId, setHoveredPostId] = useState<string>();
  const [hoverAnchor, setHoverAnchor] = useState<SceneAnchor>();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>();
  const [activeTag, setActiveTag] = useState<string>();
  const [sidebarCategory, setSidebarCategory] = useState<string>();
  const [sidebarTag, setSidebarTag] = useState<string>();
  const [previewCategory, setPreviewCategory] = useState<string>();
  const [previewTag, setPreviewTag] = useState<string>();
  const [colorMode, setColorMode] = useState<ColorMode>('day');
  const [season, setSeason] = useState<Season>('summer');
  const [automaticSeason, setAutomaticSeason] = useState(true);
  const [calendarSeason, setCalendarSeason] = useState<Season>('summer');
  useEffect(() => {
    const sync = () => {
      const current=getSeasonForDate();
      setCalendarSeason(current);
      if(automaticSeason)setSeason(current);
    };
    sync();
    const timer=window.setInterval(sync,60_000);
    document.addEventListener('visibilitychange',sync);
    return () => { window.clearInterval(timer);document.removeEventListener('visibilitychange',sync); };
  }, [automaticSeason]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [touchPostId, setTouchPostId] = useState<string>();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mainSurfaceRef = useRef<HTMLDivElement>(null);

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
  const newPostIds = useNewPostIds(posts, surface === 'article' ? selectedPost?.id : undefined);
  const { showGuide, markExplored } = useTownExploration();
  const guidePostId = showGuide ? sortedPosts[0]?.id : undefined;
  const hoveredPost = hoveredPostId ? postMap.get(hoveredPostId) : undefined;
  const touchPost = touchPostId ? postMap.get(touchPostId) : undefined;
  const sidebarModal = isMobile && mobileSidebarOpen;
  const highlightCategory = previewCategory ?? activeCategory;
  const highlightTag = previewTag ?? activeTag;
  const sidebarPosts = sidebarPanel === 'category-posts' ? sortedPosts.filter((post) => post.category === sidebarCategory) : sidebarPanel === 'tag-posts' ? sortedPosts.filter((post) => sidebarTag && post.tags.includes(sidebarTag)) : sortedPosts;

  useEffect(() => {
    if (surface !== 'article' || !selectedPostId) return;
    const frame = window.requestAnimationFrame(() => {
      mainSurfaceRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedPostId, surface]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMobileSidebarOpen(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!sidebarModal) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    sidebar.querySelector<HTMLButtonElement>('.mobile-sidebar-close')?.focus();
    // Keep keyboard focus in the mobile modal; off-canvas controls and the
    // background are inert so assistive technology cannot enter hidden UI.
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(sidebar.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]'))
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      menuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [sidebarModal]);

  useEffect(() => {
    const motionMedia=window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion=()=>setReducedMotion(motionMedia.matches);
    syncMotion();motionMedia.addEventListener('change',syncMotion);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (sidebarRef.current?.getAttribute('aria-modal') === 'true') return;
        setSearchOpen(true);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setHoveredPostId(undefined);
        setHoverAnchor(undefined);
        setMobileSidebarOpen(false);
        setTouchPostId(undefined);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown);motionMedia.removeEventListener('change',syncMotion); };
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
    setSidebarPanel('profile');

    const onPopState = () => {
      const next = readLocation();
      setSurface(next.surface);
      setSelectedPostId(next.postId);
      setTouchPostId(undefined);
      setSearchOpen(false);
      setMobileSidebarOpen(false);
      window.setTimeout(() => mainSurfaceRef.current?.scrollTo({ top: 0, behavior: 'auto' }), 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [posts]);

  const navigate = (nextSurface: MainSurface, postId?: string) => {
    setMobileSidebarOpen(false);
    setTouchPostId(undefined);
    setSearchOpen(false);
    inputRef.current?.blur();
    setSurface(nextSurface);
    setSelectedPostId(postId);
    const path = nextSurface === 'article' && postId
      ? `/posts/${encodeURIComponent(postId)}/`
      : nextSurface === 'archive' ? '/posts/' : '/';
    // A visible entry can point back to the page that is already open (for
    // example, the current item in a series drawer). Do not create a second
    // browser-history entry for the same canonical route.
    if (window.location.pathname === path && !window.location.search) return;
    window.history.pushState({ surface: nextSurface, postId }, '', path);
  };

  const openArticle = (id: string) => {
    navigate('article', id);
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
  };

  const chooseCategory = (category?: string) => {
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setTouchPostId(undefined);
    setActiveCategory(category);
    setActiveTag(undefined);
    setSidebarCategory(category);
    setSidebarTag(undefined);
    setSidebarPanel(category ? 'category-posts' : 'categories');
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
  };
  const chooseTag = (tag?: string) => {
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setTouchPostId(undefined);
    setActiveTag(tag);
    setActiveCategory(undefined);
    setSidebarTag(tag);
    setSidebarCategory(undefined);
    setSidebarPanel(tag ? 'tag-posts' : 'tags');
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
  };
  const clearFilters = () => {
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setQuery('');
    setActiveCategory(undefined);
    setActiveTag(undefined);
    setSidebarCategory(undefined);
    setSidebarTag(undefined);
    setSearchOpen(false);
  };
  const onHoverPost = (id?: string, anchor?: SceneAnchor) => {
    setHoveredPostId(id);
    setHoverAnchor(anchor);
    if (!id) {
      setTouchPostId(undefined);
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
  const openExplore = (panel: 'categories' | 'tags' | 'friends') => {
    setTouchPostId(undefined);
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
    if (panel === 'categories') setSidebarPanel(sidebarCategory ? 'category-posts' : 'categories');
    if (panel === 'tags') setSidebarPanel(sidebarTag ? 'tag-posts' : 'tags');
    if (panel === 'friends') setSidebarPanel('friends');
  };
  const selectScenePost = (id: string, pointerType?: string) => {
    if (pointerType === 'touch' && touchPostId !== id) {
      setTouchPostId(id);
      setHoveredPostId(undefined);
      setHoverAnchor(undefined);
    } else {
      markExplored();
      openArticle(id);
    }
  };
  const openMobileSidebar = () => {
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
    setTouchPostId(undefined);
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setSearchOpen(false);
    inputRef.current?.blur();
    setMobileSidebarOpen(true);
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
    <div className={`app-shell ${colorMode === 'night' ? 'mode-night' : ''} ${sidebarModal ? 'has-mobile-sidebar' : ''}`}>
      {sidebarModal && <button className="mobile-sidebar-backdrop" type="button" tabIndex={-1} aria-label="关闭侧边栏" onClick={() => setMobileSidebarOpen(false)} />}
      <aside id="site-sidebar" ref={sidebarRef} role={sidebarModal ? 'dialog' : undefined} aria-modal={sidebarModal ? true : undefined} inert={isMobile && !mobileSidebarOpen} className={`sidebar ${mobileSidebarOpen ? 'is-mobile-open' : ''}`} aria-label={`${siteConfig.title} 侧边栏`}>
        <div className="sidebar-scroll">
          <div className="sidebar-fixed-head">
            <div className="brand-block"><div className="brand-mark brand-image"><img src={siteConfig.logo} alt="" /></div><div><div className="brand-name">{siteConfig.title}</div><div className="brand-subtitle">{siteConfig.tagline}</div></div><button className="mobile-sidebar-close" type="button" aria-label="关闭侧边栏" onClick={() => setMobileSidebarOpen(false)}>{icon('close')}</button></div>
            <div className="sidebar-rule" />
            <nav className="desktop-sidebar-nav" aria-label="侧边栏入口">
              <button className={`nav-item ${sidebarPanel === 'profile' ? 'is-active' : ''}`} onClick={() => { setSidebarPanel('profile'); setActiveCategory(undefined); setActiveTag(undefined); setSidebarCategory(undefined); setSidebarTag(undefined); }}>{icon('home')}<span>名片</span></button>
              <button className={`nav-item ${sidebarPanel === 'list' ? 'is-active' : ''}`} onClick={() => { setSidebarPanel('list'); }}>{icon('archive')}<span>列表</span><span className="nav-count">{String(posts.length).padStart(2, '0')}</span></button>
              <button className={`nav-item ${sidebarPanel === 'categories' || sidebarPanel === 'category-posts' ? 'is-active' : ''}`} onClick={() => openExplore('categories')}>{icon('category')}<span>分类</span><span className="nav-count">{String(categories.length).padStart(2, '0')}</span></button>
              <button className={`nav-item ${sidebarPanel === 'tags' || sidebarPanel === 'tag-posts' ? 'is-active' : ''}`} onClick={() => openExplore('tags')}>{icon('tag')}<span>标签</span><span className="nav-count">{String(tags.length).padStart(2, '0')}</span></button>
              <button className={`nav-item ${sidebarPanel === 'friends' ? 'is-active' : ''}`} onClick={() => openExplore('friends')}>{icon('friends')}<span>友邻</span><span className="nav-count">{String(friendLinks.length).padStart(2, '0')}</span></button>
            </nav>
            <div className="mobile-sidebar-nav">
              <nav className="primary-nav">
                <button className={`nav-item ${surface === 'town' && sidebarPanel === 'profile' ? 'is-active' : ''}`} onClick={() => navigate('town')}>{icon('home')}<span>小镇首页</span><span className="nav-count">01</span></button>
                <button className={`nav-item ${surface === 'archive' ? 'is-active' : ''}`} onClick={() => { setQuery(''); setActiveCategory(undefined); setActiveTag(undefined); navigate('archive'); }}>{icon('archive')}<span>全部文章</span><span className="nav-count">{String(posts.length).padStart(2, '0')}</span></button>
              </nav>
              <div className="sidebar-section-label">探索</div>
              <nav className="secondary-nav">
                <button className={`nav-item ${sidebarPanel === 'profile' ? 'is-active' : ''}`} onClick={() => { setSidebarPanel('profile'); setActiveCategory(undefined); setActiveTag(undefined); setSidebarCategory(undefined); setSidebarTag(undefined); }}>{icon('home')}<span>名片</span></button>
                <button className={`nav-item ${sidebarPanel === 'categories' || sidebarPanel === 'category-posts' ? 'is-active' : ''}`} onClick={() => openExplore('categories')}>{icon('category')}<span>分类</span><span className="nav-count">{String(categories.length).padStart(2, '0')}</span></button>
                <button className={`nav-item ${sidebarPanel === 'tags' || sidebarPanel === 'tag-posts' ? 'is-active' : ''}`} onClick={() => openExplore('tags')}>{icon('tag')}<span>标签</span><span className="nav-count">{String(tags.length).padStart(2, '0')}</span></button>
                <button className={`nav-item ${sidebarPanel === 'friends' ? 'is-active' : ''}`} onClick={() => openExplore('friends')}>{icon('friends')}<span>友邻</span><span className="nav-count">{String(friendLinks.length).padStart(2, '0')}</span></button>
              </nav>
            </div>
          </div>
          <div className={`sidebar-content-scroll ${sidebarPanel === 'profile' ? 'is-profile' : ''}`}>
            <SidebarContent panel={sidebarPanel} posts={sidebarPosts} categories={categories} tags={tags} activeCategory={sidebarCategory} activeTag={sidebarTag} hoveredPostId={hoveredPostId} onHover={onSidebarPostHover} onCategoryPreview={onCategoryPreview} onTagPreview={onTagPreview} onCategory={chooseCategory} onTag={chooseTag} onOpenArticle={openArticle} onBack={() => { setPreviewCategory(undefined); setPreviewTag(undefined); setSidebarPanel(sidebarCategory ? 'categories' : sidebarTag ? 'tags' : 'profile'); setSidebarCategory(undefined); setSidebarTag(undefined); setActiveCategory(undefined); setActiveTag(undefined); }} />
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-footer-main"><span>{siteConfig.copyright}</span></div>
          <div className="sidebar-powered">Powered by <a className="sidebar-powered-link" href="https://github.com/BURIBURI-ZAEMON1/Blog-Town" target="_blank" rel="noreferrer noopener">Blog-Town</a></div>
        </div>
      </aside>

      <main className="main-surface" inert={sidebarModal}>
        <header className={`topnav ${searchOpen ? 'is-search-open' : ''}`}>
          <button ref={menuButtonRef} className="mobile-sidebar-toggle" type="button" aria-label={mobileSidebarOpen ? '关闭侧边栏' : '打开侧边栏'} aria-expanded={mobileSidebarOpen} aria-controls="site-sidebar" onClick={openMobileSidebar}>{icon(mobileSidebarOpen ? 'close' : 'menu')}</button>
          <a className="top-wordmark" href="https://github.com/BURIBURI-ZAEMON1/Blog-Town" target="_blank" rel="noreferrer noopener" aria-label="Blog Town GitHub 仓库"><span>Blog</span> <strong>Town</strong>{icon('external')}</a>
          <nav className="desktop-top-links" aria-label="主导航"><button className={`topnav-link ${surface === 'town' ? 'is-active' : ''}`} onClick={() => navigate('town')}><span>小镇</span></button><button className={`topnav-link ${surface === 'archive' ? 'is-active' : ''}`} onClick={() => { setQuery(''); setActiveCategory(undefined); setActiveTag(undefined); navigate('archive'); }}><span>档案</span></button></nav>
          <div className="topnav-center"><div className="top-search"><span>{icon('search')}</span><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); setSearchIndex(0); }} onFocus={() => setSearchOpen(true)} onKeyDown={onSearchKeyDown} placeholder="寻找一篇笔记…" aria-label="搜索文章" /><kbd>⌘ K</kbd>{searchOpen && query && <SearchDropdown results={searchResults} activeIndex={searchIndex} onHover={onSidebarPostHover} onOpen={openArticle} onArchive={() => { setSearchOpen(false); navigate('archive'); }} />}</div></div>
          <div className="topnav-actions"><button className="mobile-search-toggle" aria-label={searchOpen ? '关闭搜索' : '打开搜索'} aria-expanded={searchOpen} onClick={() => { if (searchOpen) { setSearchOpen(false); inputRef.current?.blur(); } else { setSearchOpen(true); window.requestAnimationFrame(() => inputRef.current?.focus()); } }}>{icon(searchOpen ? 'close' : 'search')}</button><button className="mode-button" onClick={() => setColorMode((mode) => mode === 'day' ? 'night' : 'day')} aria-label="切换昼夜模式">{colorMode === 'day' ? icon('moon') : icon('sun')}<span>{colorMode === 'day' ? '夜间' : '日间'}</span></button><label className="season-control" title={SEASON_PROFILES[season].description}>
            <span className="visually-hidden">小镇季节</span>{icon(SEASON_PROFILES[season].glyph)}
            <select aria-label="小镇季节" value={automaticSeason ? 'auto' : season} onChange={(event) => {
              const value=event.target.value;
              setAutomaticSeason(value==='auto');
              setSeason(value==='auto' ? calendarSeason : value as Season);
            }}>
              <option value="auto">当季 · {SEASON_PROFILES[calendarSeason].label}</option>
              {SEASON_ORDER.map(value=><option key={value} value={value}>{SEASON_PROFILES[value].label}季</option>)}
            </select>{icon('chevron')}
          </label></div>
        </header>

        {surface === 'archive' && <ArchiveHeading postCount={posts.length} />}
        <div className="main-scroll" ref={mainSurfaceRef}>
        {surface === 'town' && <section className="town-home">
          <TownStage posts={posts} layout={layout} newPostIds={newPostIds} guidePostId={guidePostId} onTownExplored={markExplored} season={season} activePostId={selectedPostId} hoveredPostId={touchPostId ?? hoveredPostId} query={query} category={highlightCategory} tag={highlightTag} categoryPreview={Boolean(previewCategory)} tagPreview={Boolean(previewTag)} colorMode={colorMode} reducedMotion={reducedMotion} onHoverPost={onHoverPost} onResolvePostAnchor={onResolvePostAnchor} onSelectPost={selectScenePost} hoveredPost={hoveredPost} hoverAnchor={hoverAnchor} touchPost={touchPost} onCloseTouchPreview={() => setTouchPostId(undefined)} />
          <p className="mobile-town-hint">点击建筑预览，再次点击或选择「阅读文章」打开；横向拖动地图，纵向滑动页面。</p>
          <div className="town-mobile-support">
            <div className="town-caption"><span><i className="caption-dot" /> {siteConfig.title} · {SEASON_PROFILES[season].label}季小镇</span><span>建筑即文章 / {layout.plots.length} buildings / {posts.length} article floors</span><span className="caption-spacer" /><button onClick={() => navigate('archive')}>打开完整档案 {icon('arrow')}</button></div>
            <RecentPosts posts={filteredPosts.slice(0, 5)} hasFilter={Boolean(query || activeCategory || activeTag)} onOpen={openArticle} onClear={clearFilters} />
          </div>
        </section>}
        {surface === 'archive' && <ArchiveView posts={filteredPosts} onOpen={openArticle} />}
        {surface === 'article' && selectedPost && <ArticleView post={selectedPost} layout={layout} scrollRoot={mainSurfaceRef} onOpen={openArticle} seriesPosts={selectedPost.series ? sortedPosts.filter((post) => post.series === selectedPost.series).sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0)) : []} />}
        {surface === 'article' && !selectedPost && <EmptyView title="还没有选择文章" copy="从小镇或侧边栏打开一篇笔记吧。" action="回到小镇" onAction={() => navigate('town')} />}
        </div>
      </main>
    </div>
  );
}

function SidebarContent({ panel, posts, categories, tags, activeCategory, activeTag, hoveredPostId, onHover, onCategoryPreview, onTagPreview, onCategory, onTag, onOpenArticle, onBack }: { panel: SidebarPanel; posts: TownPost[]; categories: string[]; tags: string[]; activeCategory?: string; activeTag?: string; hoveredPostId?: string; onHover: (id?: string) => void; onCategoryPreview: (value?: string) => void; onTagPreview: (value?: string) => void; onCategory: (value?: string) => void; onTag: (value?: string) => void; onOpenArticle: (id: string) => void; onBack: () => void }) {
  if (panel === 'categories' || panel === 'category-posts') return <div className="sidebar-panel"><SidebarPanelHeader title={panel === 'category-posts' ? activeCategory ?? '分类文章' : '分类'} eyebrow="CATEGORIES" onBack={panel === 'category-posts' ? onBack : undefined} />{panel === 'categories' ? <div className="sidebar-taxonomy">{categories.map((category) => <button key={category} className={activeCategory === category ? 'is-selected' : ''} onPointerEnter={(event) => { if (event.pointerType === 'mouse') onCategoryPreview(category); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') onCategoryPreview(undefined); }} onClick={() => onCategory(category)}><span>{category}</span><b>{posts.filter((post) => post.category === category).length}</b></button>)}</div> : <SidebarPostList posts={posts} hoveredPostId={hoveredPostId} onHover={onHover} onOpenArticle={onOpenArticle} />}</div>;
  if (panel === 'tags' || panel === 'tag-posts') return <div className="sidebar-panel"><SidebarPanelHeader title={panel === 'tag-posts' ? `#${activeTag ?? '标签'}` : '标签'} eyebrow="TAGS" onBack={panel === 'tag-posts' ? onBack : undefined} />{panel === 'tags' ? <div className="sidebar-tags">{tags.map((tag) => <button key={tag} className={activeTag === tag ? 'is-selected' : ''} onPointerEnter={(event) => { if (event.pointerType === 'mouse') onTagPreview(tag); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') onTagPreview(undefined); }} onClick={() => onTag(tag)}>#{tag}</button>)}</div> : <SidebarPostList posts={posts} hoveredPostId={hoveredPostId} onHover={onHover} onOpenArticle={onOpenArticle} />}</div>;
  if (panel === 'friends') return <div className="sidebar-panel"><SidebarPanelHeader title="友邻" eyebrow="FRIEND LINKS" />{friendLinks.length ? <div className="friends-list">{friendLinks.map((friend) => <a className="friend-row" href={friend.url} target="_blank" rel="noreferrer noopener" key={friend.id}><span className="friend-avatar"><img src={friend.avatar} alt="" loading="lazy" /></span><span><strong>{friend.nickname}</strong>{friend.description && <small>{friend.description}</small>}</span>{icon('external')}</a>)}</div> : <div className="sidebar-empty">还没有友邻，等一封新信。</div>}</div>;
  if (panel === 'list') return <div className="sidebar-panel list-panel"><SidebarPanelHeader title="文章列表" eyebrow="ALL NOTES" /><SidebarPostList posts={posts} hoveredPostId={hoveredPostId} onHover={onHover} onOpenArticle={onOpenArticle} /></div>;
  return <div className="profile-panel"><img className="profile-avatar" src={siteConfig.profile.avatar} alt={siteConfig.profile.name} /><span className="panel-eyebrow">ABOUT ME</span><h2>{siteConfig.profile.name}</h2><strong className="profile-headline">{siteConfig.profile.headline}</strong><p>{siteConfig.profile.bio}</p>{siteConfig.profile.links.length > 0 && <div className="profile-links">{siteConfig.profile.links.map((link) => <a key={link.id} href={link.url} aria-label={link.label} title={link.label} target={link.url.startsWith('http') ? '_blank' : undefined} rel={link.url.startsWith('http') ? 'noreferrer noopener' : undefined}><img className="profile-link-logo" src={link.logo} alt="" loading="lazy" /><span className="visually-hidden">{link.label}</span></a>)}</div>}</div>;
}

function SidebarPanelHeader({ title, eyebrow, onBack }: { title: string; eyebrow: string; onBack?: () => void }) { return <div className="sidebar-panel-header">{onBack && <button onClick={onBack} aria-label="返回面板">{icon('back')}</button>}<div><span>{eyebrow}</span><strong>{title}</strong></div></div>; }
function SidebarPostList({ posts, hoveredPostId, onHover, onOpenArticle }: { posts: TownPost[]; hoveredPostId?: string; onHover: (id?: string) => void; onOpenArticle: (id: string) => void }) { return <div className="sidebar-posts">{posts.map((post, index) => <button key={post.id} className={`sidebar-post ${hoveredPostId === post.id ? 'is-hovered' : ''}`} onPointerEnter={(event) => { if (event.pointerType === 'mouse') onHover(post.id); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') onHover(undefined); }} onClick={() => onOpenArticle(post.id)}><span className="sidebar-post-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{post.title}</strong><small>{post.category} · {formatDate(post.date)}</small></span>{icon('chevron')}</button>)}</div>; }

function SearchDropdown({ results, activeIndex, onHover, onOpen, onArchive }: { results: TownPost[]; activeIndex: number; onHover: (id?: string) => void; onOpen: (id: string) => void; onArchive: () => void }) { return <div className="search-dropdown"><span className="dropdown-label">SEARCHING THE TOWN · {results.length}</span>{results.length ? results.map((post, index) => <button key={post.id} className={`search-result ${index === activeIndex ? 'is-highlighted' : ''}`} onPointerEnter={(event) => { if (event.pointerType === 'mouse') onHover(post.id); }} onClick={() => onOpen(post.id)}><span className="search-result-index">0{index + 1}</span><span><strong>{post.title}</strong><small>{post.category} · {post.readingTime} min</small></span>{icon('arrow')}</button>) : <div className="empty-search">没有找到相关笔记。</div>}{results.length > 0 && <button className="dropdown-full" onClick={onArchive}>查看全部结果 {icon('arrow')}</button>}</div>; }

function TownTooltip({ post, anchor }: { post?: TownPost; anchor?: SceneAnchor }) { if (!post || !anchor) return null; const position = anchor; return <div className="town-tooltip" style={{ left: position.x, top: position.y }}><div className="tooltip-meta"><span>{post.category}</span><span>{post.readingTime} min</span></div><strong>{post.title}</strong><p>{post.description}</p><div className="tooltip-tags">{post.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div></div>; }

function RecentPosts({ posts, hasFilter, onOpen, onClear }: { posts: TownPost[]; hasFilter: boolean; onOpen: (id: string) => void; onClear: () => void }) { return <section className="recent-posts"><header><div><span className="section-eyebrow">RECENT NOTES</span><h2>{hasFilter ? '当前筛选下的最近笔记' : '最近写下的几件事'}</h2></div><span className="recent-count">{String(posts.length).padStart(2, '0')} / notes</span></header>{posts.length ? <div className="recent-grid">{posts.map((post) => <button key={post.id} className="recent-card" onClick={() => onOpen(post.id)}><span className="card-top"><span>{post.category}</span><span>{formatDate(post.date)}</span></span><strong>{post.title}</strong><p>{post.description}</p><span className="card-bottom">#{post.tags[0]} <i /> 阅读 {post.readingTime} 分钟 {icon('arrow')}</span></button>)}</div> : <EmptyView title="这条路暂时没有笔记" copy="换一个筛选条件，或者回到地图看看别的房子。" action="清除筛选" onAction={onClear} />}</section>; }

function ArchiveHeading({ postCount }: { postCount: number }) {
  return <header className="archive-heading archive-shell-heading"><div><span className="section-eyebrow">THE ARCHIVE · {String(postCount).padStart(2, '0')} NOTES</span><h1>文章档案</h1></div></header>;
}

function ArchiveView({ posts, onOpen }: { posts: TownPost[]; onOpen: (id: string) => void }) {
  return <section className="archive-page">
    <div className="archive-list" aria-live="polite">{posts.map((post, index) => <button key={post.id} className={`archive-row ${post.cover ? 'has-cover' : ''}`} onClick={() => onOpen(post.id)}>{post.cover ? <span className="archive-cover"><img src={post.cover} alt="" loading="lazy" /></span> : <span className="archive-index">{String(index + 1).padStart(2, '0')}</span>}<span className="archive-copy"><strong>{post.title}</strong><small>{post.description}</small><em>{post.category} · {post.tags.slice(0, 2).map((tag) => `#${tag}`).join('  ')}</em></span><time>{formatDate(post.date)}</time>{icon('arrow')}</button>)}</div>
    {!posts.length && <div className="archive-empty"><h2>这里暂时没有文章</h2><p>再次点击当前选项即可取消筛选，或者选择上方的其他分类与标签。</p></div>}
  </section>;
}

type ArticleHeading = NonNullable<TownPost['sections'][number]['heading']>;

function ArticleView({ post, layout, seriesPosts, scrollRoot, onOpen }: { post: TownPost; layout: TownLayout; seriesPosts: TownPost[]; scrollRoot: React.RefObject<HTMLElement | null>; onOpen: (id: string) => void }) {
  const headings = useMemo(() => post.sections.flatMap((section) => section.heading ? [section.heading] : []), [post.sections]);
  const townMap = useMemo(() => createTownMapModel(layout, post.id), [layout, post.id]);
  const seriesIndex = seriesPosts.findIndex((item) => item.id === post.id);
  const previousSeriesPost = seriesIndex > 0 ? seriesPosts[seriesIndex - 1] : undefined;
  const nextSeriesPost = seriesIndex >= 0 && seriesIndex < seriesPosts.length - 1 ? seriesPosts[seriesIndex + 1] : undefined;
  const headingKey = useMemo(() => headings.map((heading) => heading.id).join('|'), [headings]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(headings[0]?.id);
  const [readingProgress, setReadingProgress] = useState(0);
  const collapsedEmbeds = useRef(new Set<string>());
  useEffect(() => {
    setCollapsed({});
    collapsedEmbeds.current.clear();
    setActiveHeadingId(headings[0]?.id);
    setReadingProgress(0);
  }, [post.id]);
  useIsomorphicLayoutEffect(() => {
    const article = document.querySelector<HTMLElement>('.article-page');
    if (!article) return;
    article.querySelectorAll<HTMLElement>('[data-embed-key]').forEach((container) => {
      const key = container.dataset.embedKey;
      const collapsed = Boolean(key && collapsedEmbeds.current.has(key));
      container.classList.toggle('is-collapsed', collapsed);
      container.querySelector<HTMLElement>(':scope > .embed-note-summary, :scope > .embed-file-summary')?.setAttribute('aria-expanded', String(!collapsed));
    });
  });
  useEffect(() => {
    const root = scrollRoot.current;
    const article = document.querySelector<HTMLElement>('.article-page');
    if (!root || !article) return;
    let restoreFrame: number | undefined;
    const getSummary = (event: Event) => {
      const target = event.target as Element | null;
      return target?.closest<HTMLElement>('.article-embed-note > .embed-note-summary, .article-file-embed > .embed-file-summary');
    };
    const toggleEmbed = (summary: HTMLElement, event: Event) => {
      if ((event.target as Element | null)?.closest('a')) return;
      const container = summary.parentElement;
      if (!container) return;
      event.preventDefault();
      event.stopPropagation();
      const rootTop = root.scrollTop;
      const summaryTop = summary.getBoundingClientRect().top;
      const aside = article.querySelector<HTMLElement>('.article-aside');
      const asideTop = aside?.scrollTop ?? 0;
      const previousAnchor = root.style.overflowAnchor;
      const collapsed = container.classList.toggle('is-collapsed');
      const key = container.dataset.embedKey;
      if (key) {
        if (collapsed) collapsedEmbeds.current.add(key);
        else collapsedEmbeds.current.delete(key);
      }
      summary.setAttribute('aria-expanded', String(!collapsed));
      root.style.overflowAnchor = 'none';
      const restore = () => {
        const currentSummaryTop = summary.getBoundingClientRect().top;
        const anchorDelta = currentSummaryTop - summaryTop;
        root.scrollTop = Math.max(0, root.scrollTop + anchorDelta);
        // Keep the original position when the new document height allows it;
        // otherwise the browser's maximum is the only valid scroll position.
        if (Math.abs(anchorDelta) < 1) root.scrollTop = Math.min(rootTop, root.scrollHeight - root.clientHeight);
        if (aside) aside.scrollTop = asideTop;
      };
      restore();
      if (restoreFrame !== undefined) window.cancelAnimationFrame(restoreFrame);
      restoreFrame = window.requestAnimationFrame(() => {
        restore();
        restoreFrame = window.requestAnimationFrame(() => {
          restore();
          root.style.overflowAnchor = previousAnchor;
          restoreFrame = undefined;
        });
      });
    };
    const onClick = (event: MouseEvent) => {
      const summary = getSummary(event);
      if (summary) toggleEmbed(summary, event);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const summary = getSummary(event);
      if (summary) toggleEmbed(summary, event);
    };
    article.addEventListener('click', onClick, true);
    article.addEventListener('keydown', onKeyDown, true);
    return () => {
      article.removeEventListener('click', onClick, true);
      article.removeEventListener('keydown', onKeyDown, true);
      if (restoreFrame !== undefined) window.cancelAnimationFrame(restoreFrame);
    };
  }, [post.id, scrollRoot]);
  useEffect(() => {
    const root = scrollRoot.current;
    if (!root) return;
    let frame: number | undefined;
    const updateReadingState = () => {
      frame = undefined;
      const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
      const progress = maxScroll === 0 ? 0 : Math.min(1, Math.max(0, root.scrollTop / maxScroll));
      setReadingProgress(Math.round(progress * 100));
      if (!headings.length) return;
      const rootTop = root.getBoundingClientRect().top;
      const readingLine = rootTop + 118;
      const headingElements = headings.map((heading) => document.getElementById(heading.id));
      let next = headings[0]?.id;
      for (let index = 0; index < headings.length; index += 1) {
        const element = headingElements[index];
        if (!element || element.offsetParent === null) continue;
        if (element.getBoundingClientRect().top <= readingLine) next = headings[index].id;
        else break;
      }
      setActiveHeadingId((current) => current === next ? current : next);
    };
    const requestUpdate = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(updateReadingState);
    };
    updateReadingState();
    root.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      root.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [collapsed, headingKey, headings.length, scrollRoot]);

  const hiddenSections = useMemo(() => {
    const collapsedLevels: number[] = [];
    return post.sections.map((section) => {
      const level = section.heading?.level;
      if (level) {
        while (collapsedLevels.length && collapsedLevels[collapsedLevels.length - 1] >= level) collapsedLevels.pop();
      }
      const hidden = collapsedLevels.length > 0;
      if (section.heading && collapsed[section.heading.id]) collapsedLevels.push(section.heading.level);
      return hidden;
    });
  }, [collapsed, post.sections]);

  return <section className="article-page"><div className="article-layout"><article><span className="section-eyebrow">FIELD NOTE · {formatDate(post.date).toUpperCase()}</span><h1>{post.title}</h1><p className="article-dek">{post.description}</p><div className="article-meta"><span>{post.category}</span><span>·</span><span>{post.readingTime} 分钟阅读</span><span>·</span><span>{post.wordCount} 字</span>{post.series && <><span>·</span><span>{post.series} / {(post.seriesIndex ?? 0) + 1}</span></>}</div>{seriesPosts.length > 1 && <SeriesDrawer posts={seriesPosts} selectedPostId={post.id} onOpenArticle={onOpen} />}{post.cover && <figure className="article-cover"><img src={post.cover} alt={post.coverAlt ?? post.title} /></figure>}<div className="article-rule" /><div className="article-body">{post.sections.map((section, index) => {
    const ancestorHidden = hiddenSections[index];
    const ownCollapsed = section.heading ? Boolean(collapsed[section.heading.id]) : false;
    const Heading = section.heading ? ARTICLE_HEADING_TAGS[Math.min(section.heading.level, 6)] : undefined;
    return <section className={`article-section ${ancestorHidden ? 'is-hidden' : ''}`} key={section.heading?.id ?? `preamble-${index}`}>{section.heading && Heading && <div className={`article-heading-row level-${section.heading.level}`}><Heading id={section.heading.id} {...(section.heading.html ? { dangerouslySetInnerHTML: { __html: section.heading.html } } : { children: section.heading.text })} /><button className="heading-toggle" aria-label={ownCollapsed ? `展开 ${section.heading.text}` : `收起 ${section.heading.text}`} aria-expanded={!ownCollapsed} onClick={() => setCollapsed((state) => ({ ...state, [section.heading!.id]: !state[section.heading!.id] }))} /></div>}{!ancestorHidden && !ownCollapsed && section.html && <div className="article-section-content" dangerouslySetInnerHTML={{ __html: section.html }} />}</section>;
  })}</div><div className="article-footer"><span>townId · {post.id}</span><span>／</span><span>{siteConfig.shortTitle} · map 01</span></div>{(previousSeriesPost || nextSeriesPost) && <div className="related-posts series-neighbors"><span>继续阅读 · {post.series}</span><div className="series-neighbor-grid">{previousSeriesPost ? <button onClick={() => onOpen(previousSeriesPost.id)}><small>上一篇</small><strong>{previousSeriesPost.title}</strong></button> : <span />}{nextSeriesPost ? <button onClick={() => onOpen(nextSeriesPost.id)}><small>下一篇</small><strong>{nextSeriesPost.title}</strong></button> : <span />}</div></div>}</article><aside className="article-aside"><span className="aside-eyebrow">ON THE MAP</span><MiniTownMap post={post} map={townMap} />{headings.length > 0 && <ArticleContents headings={headings} activeHeadingId={activeHeadingId} readingProgress={readingProgress} />}</aside></div></section>;
}

function SeriesDrawer({ posts, selectedPostId, onOpenArticle }: { posts: TownPost[]; selectedPostId: string; onOpenArticle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className={`series-drawer ${open ? 'is-open' : ''}`}>
    <button className="series-drawer-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span><small>文章系列</small><strong>此篇文章属于「{posts[0]?.series}」</strong></span><span className="series-drawer-count">{posts.length} 篇 {icon('chevron')}</span>
    </button>
    <div className="series-drawer-list"><div>{posts.map((item, index) => <button key={item.id} className={item.id === selectedPostId ? 'is-current' : ''} onClick={() => onOpenArticle(item.id)}><b>{String(index + 1).padStart(2, '0')}</b><span>{item.title}</span>{item.id === selectedPostId && <em>正在阅读</em>}</button>)}</div></div>
  </div>;
}

type ArticleContentsProps = { headings: ArticleHeading[]; activeHeadingId?: string; readingProgress: number };

function ArticleContents({ headings, activeHeadingId, readingProgress }: ArticleContentsProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const contentsId = useId();
  const [mobileOpen, setMobileOpen] = useState(false);
  const jumpTo = (id: string) => {
    const element = document.getElementById(id);
    const root = document.querySelector<HTMLElement>('.main-scroll');
    if (element && root) {
      const rootTop = root.getBoundingClientRect().top;
      const target = root.scrollTop + element.getBoundingClientRect().top - rootTop - 104;
      const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
      root.scrollTo({ top: Math.min(maxScroll, Math.max(0, target)), behavior: 'smooth' });
    }
    setMobileOpen(false);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    const button = activeHeadingId ? buttonRefs.current.get(activeHeadingId) : undefined;
    if (!viewport || !button) return;
    const target = button.offsetTop - viewport.clientHeight / 2 + button.offsetHeight / 2;
    viewport.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeHeadingId]);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const toggleMobileContents = () => {
    if (window.matchMedia('(max-width: 720px)').matches) setMobileOpen((open) => !open);
  };

  return <div className={`article-contents-block ${mobileOpen ? 'is-mobile-open' : ''}`}>
    <div id={contentsId} className="article-contents-shell">
      <nav ref={viewportRef} className="article-contents-viewport" aria-label="文章目录">
        <div className="article-contents-list">{headings.map((heading) => <button ref={(element) => { if (element) buttonRefs.current.set(heading.id, element); else buttonRefs.current.delete(heading.id); }} key={heading.id} aria-current={heading.id === activeHeadingId ? 'location' : undefined} className={`toc-level-${heading.level} ${heading.id === activeHeadingId ? 'is-active' : ''}`} onClick={() => jumpTo(heading.id)}><span className="toc-node" aria-hidden="true" /><span className="toc-label">{heading.text}</span></button>)}</div>
      </nav>
    </div>
    <button type="button" className="reading-progress" aria-label={`${mobileOpen ? '关闭' : '打开'}文章目录，阅读进度 ${readingProgress}%`} aria-expanded={mobileOpen} aria-controls={contentsId} onClick={toggleMobileContents}>
      <svg viewBox="0 0 48 48" aria-hidden="true"><circle className="reading-progress-track" cx="24" cy="24" r="19" /><circle className="reading-progress-value" cx="24" cy="24" r="19" pathLength="100" style={{ strokeDashoffset: 100 - readingProgress }} /></svg>
      <span className="reading-progress-directory-icon" aria-hidden="true">{icon('toc')}</span>
      <span><strong>{readingProgress}</strong><small>%</small></span>
      <em>阅读进度</em>
    </button>
  </div>;
}


function MiniTownMap({ post, map }: { post: TownPost; map: TownMapModel }) {
  const path = (points: { x: number; z: number }[]) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.z}`).join(' ');
  const polygonFor = (building: typeof map.buildings[number]) => building.points?.map((point) => `${point.x},${point.z}`).join(' ') ?? '';
  return <div className="article-location" aria-label={`文章建筑在小镇中的位置：${post.title}`}>
    <div className="article-location-header"><span>ARTICLE LOCATION</span><span>{post.series ? `FLOOR ${String((post.seriesIndex ?? 0) + 1).padStart(2, '0')}` : 'PLOT 01'}</span></div>
    <div className="article-location-map">
      <svg className="pixel-town-map" viewBox={`${map.bounds.minX} ${map.bounds.minZ} ${map.bounds.maxX - map.bounds.minX} ${map.bounds.maxZ - map.bounds.minZ}`} preserveAspectRatio="none" shapeRendering="crispEdges" role="img" aria-hidden="true">
        <rect className="mini-map-ground" x={map.bounds.minX} y={map.bounds.minZ} width={map.bounds.maxX - map.bounds.minX} height={map.bounds.maxZ - map.bounds.minZ} />
        <path className="mini-map-water" d={path(map.river.points)} style={{ strokeWidth: map.river.width }} />
        {map.roads.map((road, index) => <path className="mini-map-road" d={path(road.points)} style={{ strokeWidth: road.width }} key={`road-${index}`} />)}
        <path className="mini-map-road mini-map-center-ring" d={path(map.centerRing.points)} style={{ strokeWidth: map.centerRing.width }} />
        {map.centerConnectors.map((connector, index) => <path className="mini-map-road mini-map-center-connector" d={path(connector.points)} style={{ strokeWidth: connector.width }} key={`connector-${index}`} />)}
        {map.buildings.map((building) => <polygon className={`mini-map-building ${building === map.selected ? 'is-selected' : ''}`} key={building.id} points={polygonFor(building)} />)}
        {map.selected && <><circle className="mini-map-marker-halo" cx={map.selected.x} cy={map.selected.z} r="4.3" /><circle className="mini-map-marker" cx={map.selected.x} cy={map.selected.z} r="1.8" /></>}
      </svg>
    </div>
    <div className="article-location-caption"><span className="article-location-pin" aria-hidden="true" /><span><small>文章建筑</small><strong>{post.title}</strong></span></div>
  </div>;
}

function EmptyView({ title, copy, action, onAction }: { title: string; copy: string; action: string; onAction: () => void }) { return <div className="empty-view"><h2>{title}</h2><p>{copy}</p><button onClick={onAction}>{action} {icon('arrow')}</button></div>; }
