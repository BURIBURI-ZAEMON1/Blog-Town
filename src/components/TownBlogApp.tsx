import { lazy, memo, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ElementType } from 'react';
import type { SceneAnchor, TownPostSummary } from './TownScene';
import type { SearchEntry } from '../scene/brick-town/types';
import type { ArticleSection } from '../lib/markdown';
import TownLoading from './TownLoading';
import SidebarImage from './SidebarImage';
import { requestTownFonts } from '../lib/town-fonts';
import { commentConfig } from '../config/comments';
import { showReferenceArrival } from './article-reference-arrival';
import { updatePageMeta } from './page-meta';
import { useTownNavigation, type MainSurface, type TownNavigation } from './useTownNavigation';
import { useNewPostIds } from './useNewPostIds';
import { useTownExploration } from './useTownExploration';
import { useColorMode } from './useColorMode';
import type { TownSceneProps } from '../scene/brick-town/types';
import { friendLinks, siteConfig, type FriendLink } from '../config/site';
import type { TownFeature, TownLayout } from '../data/town-layout';
import { createTownMapModel } from '../data/town-map';
import { getSeasonForDate, SEASON_ORDER, SEASON_PROFILES, type Season } from '../data/town-seasons';
import { diaryEntries, groupDiaryByMonth, sortedDiaryEntries, type DiaryEntry } from '../data/town-diary';
import { createSiteStats, formatWords } from '../lib/site-stats';
import { formatViews, readSiteTotals } from '../lib/views';
import { useArticleViews } from './useViewCounts';

type SidebarPanel = 'profile' | 'list' | 'categories' | 'category-posts' | 'tags' | 'tag-posts' | 'friends';
type ColorMode = 'day' | 'night';
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Props = {
  posts: TownPostSummary[];
  layout?: TownLayout;
  initialSurface?: MainSurface;
  initialPostId?: string;
  initialPostContent?: ArticleSection[];
};
const ARTICLE_HEADING_TAGS: Record<number, ElementType> = { 1: 'h2', 2: 'h3', 3: 'h4', 4: 'h5', 5: 'h6', 6: 'h6' };
type TownMapModel = ReturnType<typeof createTownMapModel>;

const ArticleComments = lazy(() => import('./ArticleComments'));

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
  hoveredPost?: TownPostSummary;
  hoverAnchor?: SceneAnchor;
  hoveredFeature?: TownFeature;
  featureAnchor?: SceneAnchor;
  selectedFriend?: FriendLink;
  friendAnchor?: SceneAnchor;
  hoveredDiary?: DiaryEntry;
  diaryAnchor?: SceneAnchor;
  diarySingle?: boolean;
  touchPost?: TownPostSummary;
  onCloseTouchPreview: () => void;
};

function TownStage({ hoveredPost, hoverAnchor, hoveredFeature, featureAnchor, selectedFriend, friendAnchor, hoveredDiary, diaryAnchor, diarySingle, touchPost, onCloseTouchPreview, ...sceneProps }: TownStageProps) {
  const [settled, setSettled] = useState(false);
  return <div className="town-stage-wrap">
    <Suspense fallback={null}>
      <TownScene
        {...sceneProps}
        onLoadingStart={() => setSettled(false)}
        onFirstFrame={() => { setSettled(true); void requestTownFonts(); }}
        onInitializationError={() => { setSettled(true); void requestTownFonts(); }}
      />
    </Suspense>
    {!settled && <TownLoading reducedMotion={sceneProps.reducedMotion} />}
    <TownTooltip post={hoveredPost} anchor={hoverAnchor} />
    <FeatureTooltip feature={hoveredFeature} anchor={featureAnchor} />
    <FriendTag friend={selectedFriend} anchor={friendAnchor} />
    <DiaryTag entry={hoveredDiary} anchor={diaryAnchor} single={diarySingle} count={diaryEntries.length} />
    {touchPost && <div className="town-touch-preview" role="region" aria-label="建筑文章预览">
      <button className="touch-preview-close" aria-label="关闭建筑预览" onClick={onCloseTouchPreview}>{icon('close')}</button>
      <div className="tooltip-meta"><span>{touchPost.category}</span><span>{touchPost.readingTime} min</span></div>
      <strong>{touchPost.title}</strong><p>{touchPost.description}</p>
      <a className="touch-preview-read" href={`/posts/${encodeURIComponent(touchPost.id)}/`} onClick={(event) => handleInternalClick(event, () => { sceneProps.onTownExplored?.(); sceneProps.onSelectPost(touchPost.id); })}>阅读文章 {icon('arrow')}</a>
    </div>}
  </div>;
}

const icon = (name: string) => {
  const paths: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9 20v-5h6v5',
    about: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM12 11v6M12 7.5h.01',
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

const handleInternalClick = (event: React.MouseEvent<HTMLAnchorElement>, action: () => void) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  action();
};

const formatDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1].slice(2)}-${match[2]}-${match[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return `${String(date.getFullYear()).slice(-2)}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const getScore = (post: TownPostSummary, query: string, searchText = '') => {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  let score = 0;
  if (post.title.toLowerCase().includes(needle)) score += 100;
  if (post.category.toLowerCase().includes(needle)) score += 44;
  if (post.tags.join(' ').toLowerCase().includes(needle)) score += 34;
  if (post.series?.toLowerCase().includes(needle)) score += 30;
  if (post.description.toLowerCase().includes(needle)) score += 15;
  if (searchText.toLowerCase().includes(needle)) score += 8;
  return score;
};

export default function TownBlogApp({ posts, layout, initialSurface = 'town', initialPostId, initialPostContent }: Props) {
  const initialPost = initialPostId ? posts.find((post) => post.id === initialPostId) : undefined;
  const [contentById, setContentById] = useState<Record<string, ArticleSection[]>>(() =>
    initialPostId && initialPostContent ? { [initialPostId]: initialPostContent } : {},
  );
  const [contentError, setContentError] = useState<string>();
  const [contentRetry, setContentRetry] = useState(0);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('profile');
  const [hoveredPostId, setHoveredPostId] = useState<string>();
  const [hoverAnchor, setHoverAnchor] = useState<SceneAnchor>();
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string>();
  const [hoverFeatureAnchor, setHoverFeatureAnchor] = useState<SceneAnchor>();
  const [hoveredFriendId, setHoveredFriendId] = useState<string>();
  const [hoveredDiaryId, setHoveredDiaryId] = useState<string>();
  const [diaryAnchor, setDiaryAnchor] = useState<SceneAnchor>();
  const [focusedDiaryId, setFocusedDiaryId] = useState<string>();
  // The reading card floats over the scene; null means closed.
  const [openDiaryId, setOpenDiaryId] = useState<string>();
  // The reading card keeps its own anchor: hovering away must not move it.
  const [cardAnchor, setCardAnchor] = useState<SceneAnchor>();
  // Paging bumps this so the camera re-focuses even on a repeat visit.
  const [diaryFocusRevision, setDiaryFocusRevision] = useState(0);
  // Selecting a neighbour keeps the list open while the camera travels out to
  // their hut, so the two states are tracked separately from hover.
  const [selectedFriendId, setSelectedFriendId] = useState<string>();
  const [focusedFriendId, setFocusedFriendId] = useState<string>();
  const [friendAnchor, setFriendAnchor] = useState<SceneAnchor>();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>();
  const [activeTag, setActiveTag] = useState<string>();
  const [sidebarCategory, setSidebarCategory] = useState<string>();
  const [sidebarTag, setSidebarTag] = useState<string>();
  const [previewCategory, setPreviewCategory] = useState<string>();
  const [previewTag, setPreviewTag] = useState<string>();
  const { colorMode, toggleColorMode } = useColorMode();
  const [season, setSeason] = useState<Season>('summer');
  const [automaticSeason, setAutomaticSeason] = useState(true);
  const [calendarSeason, setCalendarSeason] = useState<Season>('summer');
  // Visitors can switch how short notes appear. The choice is remembered so
  // the town keeps their preferred shape on the next visit.
  const [diaryMode, setDiaryMode] = useState<'district' | 'single'>(siteConfig.diaryLayout);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('town:diary-layout');
      if (saved === 'district' || saved === 'single') setDiaryMode(saved);
    } catch { /* Private mode: keep the configured default. */ }
  }, []);
  const chooseDiaryMode = (mode: 'district' | 'single') => {
    setDiaryMode(mode);
    try { window.localStorage.setItem('town:diary-layout', mode); } catch { /* ignore */ }
  };
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
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>();
  const [searchIndexStatus, setSearchIndexStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [searchRetry, setSearchRetry] = useState(0);
  const searchIndexRequested = useRef(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [touchPostId, setTouchPostId] = useState<string>();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchIme = useRef({ composing: false, endedAt: -Infinity });
  const mainSurfaceRef = useRef<HTMLDivElement>(null);
  const { navigation, navigate: navigateTo } = useTownNavigation(posts, mainSurfaceRef, initialSurface, initialPost?.id);
  const { surface, postId: selectedPostId } = navigation;
  useEffect(() => {
    if (surface !== 'town') void requestTownFonts();
  }, [surface]);

  const postMap = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const sortedPosts = useMemo(() => [...posts].sort((a, b) => +new Date(b.date) - +new Date(a.date)), [posts]);
  const searchTextByPost = useMemo(() => new Map((searchEntries ?? []).map((entry) => [entry.id, entry.searchText])), [searchEntries]);
  const categories = useMemo(() => [...new Set(posts.map((post) => post.category))], [posts]);
  const tags = useMemo(() => [...new Set(posts.flatMap((post) => post.tags))], [posts]);
  // Build-time figures are deterministic, so they can be computed once per post set.
  const siteStats = useMemo(() => createSiteStats(posts), [posts]);
  const [siteTotals, setSiteTotals] = useState<{ pageviews: number; visitors: number }>();
  useEffect(() => {
    // The sidebar ledger is always visible, so load the totals on mount rather
    // than waiting for the About or town surface.
    let cancelled = false;
    // Never a single page's hit count: the API's `totals` is site-wide.
    void readSiteTotals().then((totals) => {
      if (cancelled || !totals) return;
      setSiteTotals(totals);
    });
    return () => { cancelled = true; };
  }, []);
  const filteredPosts = useMemo(() => sortedPosts.filter((post) => {
    const matchesQuery = !query || getScore(post, query, searchTextByPost.get(post.id)) > 0;
    const matchesCategory = !activeCategory || post.category === activeCategory;
    const matchesTag = !activeTag || post.tags.includes(activeTag);
    return matchesQuery && matchesCategory && matchesTag;
  }), [activeCategory, activeTag, query, searchTextByPost, sortedPosts]);
  const searchResults = useMemo(() => sortedPosts
    .map((post) => ({ post, score: getScore(post, query, searchTextByPost.get(post.id)) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((result) => result.post), [query, searchTextByPost, sortedPosts]);
  const selectedPost = selectedPostId ? postMap.get(selectedPostId) : undefined;
  const selectedSections = selectedPostId ? contentById[selectedPostId] : undefined;
  useEffect(() => {
    if (surface !== 'article' || !selectedPostId || contentById[selectedPostId]) {
      setContentError(undefined);
      return;
    }
    let cancelled = false;
    setContentError(undefined);
    fetch(`/data/posts/${encodeURIComponent(selectedPostId)}.json`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid article payload');
        return data as ArticleSection[];
      })
      .then((sections) => {
        if (cancelled) return;
        setContentById((current) => ({ ...current, [selectedPostId]: sections }));
      })
      .catch(() => {
        if (!cancelled) setContentError(selectedPostId);
      });
    return () => { cancelled = true; };
  }, [contentById, contentRetry, selectedPostId, surface]);
  useEffect(() => {
    if (!(searchOpen || query.trim()) || searchEntries || searchIndexRequested.current) return;
    searchIndexRequested.current = true;
    setSearchIndexStatus('loading');
    fetch('/data/search-index.json')
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid search payload');
        return data as SearchEntry[];
      })
      .then((entries) => { setSearchEntries(entries); setSearchIndexStatus('idle'); })
      .catch(() => {
        // Summary fields still provide a usable search; allow a later retry.
        searchIndexRequested.current = false;
        setSearchIndexStatus('error');
      });
  }, [query, searchEntries, searchOpen, searchRetry]);
  useEffect(() => {
    updatePageMeta(surface, selectedPost);
  }, [selectedPost, surface]);
  const newPostIds = useNewPostIds(posts, surface === 'article' ? selectedPost?.id : undefined);
  const { showGuide, markExplored } = useTownExploration();
  const guidePostId = showGuide ? sortedPosts[0]?.id : undefined;
  const hoveredPost = hoveredPostId ? postMap.get(hoveredPostId) : undefined;
  const hoveredFeature = hoveredFeatureId ? layout?.features.find((feature) => feature.id === hoveredFeatureId) : undefined;
  const selectedFriend = selectedFriendId ? friendLinks.find((friend) => friend.id === selectedFriendId) : undefined;
  // Hovering a hut in the hamlet should preview its card before any selection.
  const hoveredFriend = hoveredFriendId ? friendLinks.find((friend) => friend.id === hoveredFriendId) : undefined;
  // Hover wins while the pointer is over a hut; otherwise the selected
  // neighbour keeps its card pinned to the hut the camera travelled to.
  const activeFriend = hoveredFriend ?? selectedFriend;
  const activeDiaryEntry = hoveredDiaryId ? diaryEntries.find((entry) => entry.id === hoveredDiaryId) : undefined;
  // `single` mode uses one board for the whole diary, so its preview is a
  // summary card rather than a specific note.
  const diaryBoardSummary = hoveredDiaryId === 'diary-all';
  const touchPost = touchPostId ? postMap.get(touchPostId) : undefined;
  const sidebarModal = isMobile && mobileSidebarOpen;
  const highlightCategory = previewCategory ?? activeCategory;
  const highlightTag = previewTag ?? activeTag;
  const sidebarPosts = sidebarPanel === 'category-posts' ? sortedPosts.filter((post) => post.category === sidebarCategory) : sidebarPanel === 'tag-posts' ? sortedPosts.filter((post) => sidebarTag && post.tags.includes(sidebarTag)) : sortedPosts;

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
    if (!isMobile || !searchOpen) return;
    const dismissSearch = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.topnav-center, .mobile-search-toggle')) return;
      setSearchOpen(false);
      inputRef.current?.blur();
    };
    document.addEventListener('pointerdown', dismissSearch);
    return () => document.removeEventListener('pointerdown', dismissSearch);
  }, [isMobile, searchOpen]);

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
        window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        inputRef.current?.blur();
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
    setMobileSidebarOpen(false);
    setTouchPostId(undefined);
    setSearchOpen(false);
    inputRef.current?.blur();
    setPreviewCategory(undefined);
    setPreviewTag(undefined);
    setHoveredPostId(undefined);
    setHoverAnchor(undefined);
    setHoveredFeatureId(undefined);
    setHoverFeatureAnchor(undefined);
    setSelectedFriendId(undefined);
    setFocusedFriendId(undefined);
    setFriendAnchor(undefined);
  }, [navigation]);

  const navigate = (nextSurface: MainSurface, postId?: string) => {
    setMobileSidebarOpen(false);
    setTouchPostId(undefined);
    setSearchOpen(false);
    inputRef.current?.blur();
    navigateTo(nextSurface, postId);
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
    if (id) {
      setHoveredFeatureId(undefined);
      setHoverFeatureAnchor(undefined);
    }
    if (!id) {
      setTouchPostId(undefined);
      setPreviewCategory(undefined);
      setPreviewTag(undefined);
    }
  };
  const onHoverFeature = (id?: string, anchor?: SceneAnchor) => {
    setHoveredFeatureId(id);
    setHoverFeatureAnchor(anchor);
    if (id) {
      setHoveredPostId(undefined);
      setHoverAnchor(undefined);
    }
  };
  const onResolveFeatureAnchor = (id: string, anchor: SceneAnchor) => {
    if (hoveredFeatureId === id) setHoverFeatureAnchor(anchor);
  };
  const openFeature = (id: string) => {
    const feature = layout?.features.find((item) => item.id === id);
    if (!feature?.href) return;
    if (feature.href === '/about/') { navigate('about'); return; }
    window.location.assign(feature.href);
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
    // Re-opening the neighbour list should always start from a fresh overview.
    setSelectedFriendId(undefined);
    setFocusedFriendId(undefined);
    setFriendAnchor(undefined);
    if (panel === 'categories') setSidebarPanel(sidebarCategory ? 'category-posts' : 'categories');
    if (panel === 'tags') setSidebarPanel(sidebarTag ? 'tag-posts' : 'tags');
    if (panel === 'friends') setSidebarPanel('friends');
  };
  const selectFriend = (id: string) => {
    setSidebarPanel('friends');
    setSelectedFriendId(id);
    setFocusedFriendId(id);
  };
  // Clicking a hut keeps the visitor in town: it pins that neighbour's card,
  // and the card carries the "visit" button. Only the list arrow opens a link.
  const openFriendCard = (id: string) => {
    // First click pins the card; clicking the same hut again opens the site.
    if (selectedFriendId === id) {
      const friend = friendLinks.find((item) => item.id === id);
      if (friend) window.open(friend.url, '_blank', 'noopener');
      return;
    }
    setSidebarPanel('friends');
    setSelectedFriendId(id);
    setHoveredFriendId(undefined);
    setFocusedFriendId(id);
  };
  // Clicking anywhere outside the pinned card dismisses it.
  useEffect(() => {
    if (!selectedFriendId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('.town-friend-tag') || target?.closest('.friend-row')) return;
      setSelectedFriendId(undefined);
      setFocusedFriendId(undefined);
      setFriendAnchor(undefined);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [selectedFriendId]);
  const onHoverFriend = (id?: string, anchor?: SceneAnchor) => {
    setHoveredFriendId(id);
    // Hover always previews the hut under the pointer; releasing the pointer
    // restores the selected neighbour's pinned card.
    if (id) setFriendAnchor(anchor);
  };
  const onResolveFriendAnchor = (id: string, anchor: SceneAnchor) => {
    // Keep the card glued to the hut for both hover previews and selections,
    // otherwise the hover card would stay at the raw pointer coordinates.
    if (selectedFriendId === id || hoveredFriendId === id) setFriendAnchor(anchor);
  };
  const onHoverDiary = (id?: string, anchor?: SceneAnchor) => {
    setHoveredDiaryId(id);
    setDiaryAnchor(anchor);
  };
  const onResolveDiaryAnchor = (id: string, anchor: SceneAnchor) => {
    if (hoveredDiaryId === id) setDiaryAnchor(anchor);
    // The open card follows the board while the camera travels to it.
    if (openDiaryId === id) setCardAnchor(anchor);
  };
  // Reading-card paging: move the camera to the matching board as well, so
  // the card and the scene stay in sync while flipping through notes.
  const diaryOrder = useMemo(() => sortedDiaryEntries(), []);
  const openDiaryIndex = openDiaryId ? diaryOrder.findIndex((entry) => entry.id === openDiaryId) : -1;
  const openDiaryEntryData = openDiaryIndex >= 0 ? diaryOrder[openDiaryIndex] : undefined;
  const stepDiary = (delta: number) => {
    const next = diaryOrder[openDiaryIndex + delta];
    if (!next) return;
    setOpenDiaryId(next.id);
    setFocusedDiaryId(next.id);
    setDiaryFocusRevision((value) => value + 1);
  };
  const openDiaryEntry = (id: string) => {
    // The compact board opens the diary page; each lane board opens a
    // reading card first, and that card can take the visitor to the page.
    if (id === 'diary-all') { navigate('diary'); return; }
    setFocusedDiaryId(id);
    setDiaryFocusRevision((value) => value + 1);
    setCardAnchor(diaryAnchor);
    setOpenDiaryId(id);
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
    // Safari may send a plain Enter just after the candidate-selection composition ends.
    const imeKey = (event.nativeEvent as { keyCode: number }).keyCode === 229;
    if (searchIme.current.composing || event.nativeEvent.isComposing || imeKey || (event.key === 'Enter' && performance.now() - searchIme.current.endedAt < 250)) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchResultIndex((index) => Math.min(index + 1, Math.max(0, searchResults.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchResultIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && searchResults[searchResultIndex]) {
      openArticle(searchResults[searchResultIndex].id);
      setSearchOpen(false);
    }
  };

  return (
    <div className={`app-shell ${colorMode === 'night' ? 'mode-night' : ''} ${sidebarModal ? 'has-mobile-sidebar' : ''}`}>
      {sidebarModal && <button className="mobile-sidebar-backdrop" type="button" tabIndex={-1} aria-label="关闭侧边栏" onClick={() => setMobileSidebarOpen(false)} />}
      <aside id="site-sidebar" ref={sidebarRef} role={sidebarModal ? 'dialog' : undefined} aria-modal={sidebarModal ? true : undefined} inert={isMobile && !mobileSidebarOpen} className={`sidebar ${mobileSidebarOpen ? 'is-mobile-open' : ''}`} aria-label={`${siteConfig.title} 侧边栏`}>
        <div className="sidebar-scroll">
          <div className="sidebar-fixed-head">
            <div className="brand-block"><div className="brand-mark brand-image"><SidebarImage src={siteConfig.logo} alt="" mobileOpen={mobileSidebarOpen} /></div><div><div className="brand-name">{siteConfig.title}</div><div className="brand-subtitle">{siteConfig.tagline}</div></div><button className="mobile-sidebar-close" type="button" aria-label="关闭侧边栏" onClick={() => setMobileSidebarOpen(false)}>{icon('close')}</button></div>
            <div className="sidebar-rule" />
            <nav className="desktop-sidebar-nav" aria-label="侧边栏入口">
              <a className={`nav-item ${surface === 'town' && sidebarPanel === 'profile' ? 'is-active' : ''}`} href="/" onClick={(event) => handleInternalClick(event, () => { setSidebarPanel('profile'); setSidebarCategory(undefined); setSidebarTag(undefined); navigate('town'); })}>{icon('home')}<span>名片</span></a>
              <button className={`nav-item ${sidebarPanel === 'list' ? 'is-active' : ''}`} onClick={() => { setSidebarPanel('list'); }}>{icon('archive')}<span>列表</span><span className="nav-count">{String(posts.length).padStart(2, '0')}</span></button>
              <button className={`nav-item ${sidebarPanel === 'categories' || sidebarPanel === 'category-posts' ? 'is-active' : ''}`} onClick={() => openExplore('categories')}>{icon('category')}<span>分类</span><span className="nav-count">{String(categories.length).padStart(2, '0')}</span></button>
              <button className={`nav-item ${sidebarPanel === 'tags' || sidebarPanel === 'tag-posts' ? 'is-active' : ''}`} onClick={() => openExplore('tags')}>{icon('tag')}<span>标签</span><span className="nav-count">{String(tags.length).padStart(2, '0')}</span></button>
              <button className={`nav-item ${sidebarPanel === 'friends' ? 'is-active' : ''}`} onClick={() => openExplore('friends')}>{icon('friends')}<span>友邻</span><span className="nav-count">{String(friendLinks.length).padStart(2, '0')}</span></button>
            </nav>
            <div className="mobile-sidebar-nav">
              <nav className="primary-nav">
                <a className={`nav-item ${surface === 'town' && sidebarPanel === 'profile' ? 'is-active' : ''}`} href="/" onClick={(event) => handleInternalClick(event, () => navigate('town'))}>{icon('home')}<span>小镇首页</span><span className="nav-count">01</span></a>
                <a className={`nav-item ${surface === 'archive' ? 'is-active' : ''}`} href="/posts/" onClick={(event) => handleInternalClick(event, () => { setQuery(''); setActiveCategory(undefined); setActiveTag(undefined); navigate('archive'); })}>{icon('archive')}<span>全部文章</span><span className="nav-count">{String(posts.length).padStart(2, '0')}</span></a>
              </nav>
              <div className="sidebar-section-label">探索</div>
              <nav className="secondary-nav">
                <a className={`nav-item ${surface === 'town' && sidebarPanel === 'profile' ? 'is-active' : ''}`} href="/" onClick={(event) => handleInternalClick(event, () => { setSidebarPanel('profile'); setSidebarCategory(undefined); setSidebarTag(undefined); navigate('town'); })}>{icon('home')}<span>名片</span></a>
                <a className={`nav-item ${surface === 'about' ? 'is-active' : ''}`} href="/about/" onClick={(event) => handleInternalClick(event, () => navigate('about'))}>{icon('about')}<span>关于</span></a>
                <a className={`nav-item ${surface === 'diary' ? 'is-active' : ''}`} href="/diary/" onClick={(event) => handleInternalClick(event, () => navigate('diary'))}>{icon('flower')}<span>短日记</span></a>
                <button className={`nav-item ${sidebarPanel === 'categories' || sidebarPanel === 'category-posts' ? 'is-active' : ''}`} onClick={() => openExplore('categories')}>{icon('category')}<span>分类</span><span className="nav-count">{String(categories.length).padStart(2, '0')}</span></button>
                <button className={`nav-item ${sidebarPanel === 'tags' || sidebarPanel === 'tag-posts' ? 'is-active' : ''}`} onClick={() => openExplore('tags')}>{icon('tag')}<span>标签</span><span className="nav-count">{String(tags.length).padStart(2, '0')}</span></button>
                <button className={`nav-item ${sidebarPanel === 'friends' ? 'is-active' : ''}`} onClick={() => openExplore('friends')}>{icon('friends')}<span>友邻</span><span className="nav-count">{String(friendLinks.length).padStart(2, '0')}</span></button>
              </nav>
            </div>
          </div>
          <div className={`sidebar-content-scroll ${sidebarPanel === 'profile' ? 'is-profile' : ''}`}>
            <SidebarContent mobileOpen={mobileSidebarOpen} panel={sidebarPanel} posts={sidebarPosts} categories={categories} tags={tags} activeCategory={sidebarCategory} activeTag={sidebarTag} hoveredPostId={hoveredPostId} onHover={onSidebarPostHover} onHoverFeature={onHoverFeature} selectedFriendId={selectedFriendId} onHoverFriend={(id) => setHoveredFriendId(id)} onSelectFriend={openFriendCard} onCategoryPreview={onCategoryPreview} onTagPreview={onTagPreview} onCategory={chooseCategory} onTag={chooseTag} onOpenArticle={openArticle} onBack={() => { setPreviewCategory(undefined); setPreviewTag(undefined); setSidebarPanel(sidebarCategory ? 'categories' : sidebarTag ? 'tags' : 'profile'); setSidebarCategory(undefined); setSidebarTag(undefined); setActiveCategory(undefined); setActiveTag(undefined); }} />
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-ledger" aria-label="站点数据">
            <div><span>访问量</span><strong>{siteTotals ? formatViews(siteTotals.pageviews) : '—'}</strong></div>
            <div><span>访问人数</span><strong>{siteTotals ? formatViews(siteTotals.visitors) : '—'}</strong></div>
            <div><span>总字数</span><strong>{formatWords(siteStats.words)}</strong></div>
          </div>
          <div className="sidebar-footer-main"><span>{siteConfig.copyright}</span></div>
          <div className="sidebar-powered">Powered by <a className="sidebar-powered-link" href="https://github.com/BURIBURI-ZAEMON1/Blog-Town" target="_blank" rel="noreferrer noopener">Blog-Town</a></div>
        </div>
      </aside>

      <main className="main-surface" inert={sidebarModal}>
        <header className={`topnav ${searchOpen ? 'is-search-open' : ''}`}>
          <button ref={menuButtonRef} className="mobile-sidebar-toggle" type="button" aria-label={mobileSidebarOpen ? '关闭侧边栏' : '打开侧边栏'} aria-expanded={mobileSidebarOpen} aria-controls="site-sidebar" onClick={openMobileSidebar}>{icon(mobileSidebarOpen ? 'close' : 'menu')}</button>
          <a className="top-wordmark" href="https://github.com/BURIBURI-ZAEMON1/Blog-Town" target="_blank" rel="noreferrer noopener" aria-label="Blog Town GitHub 仓库"><span>Blog</span> <strong>Town</strong>{icon('external')}</a>
<nav className="desktop-top-links" aria-label="主导航"><a className={`topnav-link ${surface === 'town' ? 'is-active' : ''}`} href="/" onClick={(event) => handleInternalClick(event, () => navigate('town'))}><span>小镇</span></a><a className={`topnav-link ${surface === 'about' ? 'is-active' : ''}`} href="/about/" onClick={(event) => handleInternalClick(event, () => navigate('about'))}><span>关于</span></a><a className={`topnav-link ${surface === 'diary' ? 'is-active' : ''}`} href="/diary/" onClick={(event) => handleInternalClick(event, () => navigate('diary'))}><span>短日记</span></a><a className={`topnav-link ${surface === 'archive' ? 'is-active' : ''}`} href="/posts/" onClick={(event) => handleInternalClick(event, () => { setQuery(''); setActiveCategory(undefined); setActiveTag(undefined); navigate('archive'); })}><span>档案</span></a></nav>
          <div className="topnav-center" id="topnav-search"><div className="top-search"><span>{icon('search')}</span><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); setSearchResultIndex(0); }} onFocus={() => setSearchOpen(true)} onCompositionStart={() => { searchIme.current.composing = true; }} onCompositionEnd={() => { searchIme.current.composing = false; searchIme.current.endedAt = performance.now(); }} onKeyDown={onSearchKeyDown} placeholder="寻找一篇笔记…" aria-label="搜索文章" /><kbd>⌘ K</kbd>{searchOpen && query && <SearchDropdown results={searchResults} activeIndex={searchResultIndex} onHover={onSidebarPostHover} onOpen={openArticle} onArchive={() => { setSearchOpen(false); navigate('archive'); }} status={searchIndexStatus} onRetry={() => { searchIndexRequested.current = false; setSearchIndexStatus('idle'); setSearchRetry((value) => value + 1); }} />}</div></div>
          <div className="topnav-actions"><button className="mobile-search-toggle" aria-controls="topnav-search" aria-label={searchOpen ? '关闭搜索' : '打开搜索'} aria-expanded={searchOpen} onClick={() => { if (searchOpen) { setSearchOpen(false); inputRef.current?.blur(); } else { setSearchOpen(true); window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); } }}>{icon(searchOpen ? 'close' : 'search')}</button><button className="mode-button" onClick={toggleColorMode} aria-label="切换昼夜模式">{colorMode === 'day' ? icon('moon') : icon('sun')}<span>{colorMode === 'day' ? '夜间' : '日间'}</span></button><label className="season-control" title={SEASON_PROFILES[season].description}>
            <span className="visually-hidden">小镇季节</span>{icon(SEASON_PROFILES[season].glyph)}
            <select aria-label="小镇季节" value={automaticSeason ? 'auto' : season} onChange={(event) => {
              const value=event.target.value;
              setAutomaticSeason(value==='auto');
              setSeason(value==='auto' ? calendarSeason : value as Season);
            }}>
              <option value="auto">当季 · {SEASON_PROFILES[calendarSeason].label}</option>
              {SEASON_ORDER.map(value=><option key={value} value={value}>{SEASON_PROFILES[value].label}季</option>)}
            </select>{icon('chevron')}
          </label>
          </div>
        </header>

        {surface === 'archive' && <ArchiveHeading postCount={posts.length} />}
        <div className="main-scroll" ref={mainSurfaceRef}>
        {surface === 'town' && <section className="town-home">
          <h1 className="visually-hidden">{siteConfig.title} — {siteConfig.tagline}</h1>
          <TownStage posts={posts} layout={layout} newPostIds={newPostIds} guidePostId={guidePostId} onTownExplored={markExplored} season={season} activePostId={selectedPostId} hoveredPostId={touchPostId ?? hoveredPostId} hoveredFeatureId={hoveredFeatureId} hoveredFriendId={hoveredFriendId} selectedFriendId={selectedFriendId} focusedFriendId={focusedFriendId} hoveredDiaryId={hoveredDiaryId} focusedDiaryId={focusedDiaryId} diaryFocusRevision={diaryFocusRevision} diaryMode={diaryMode} query={query} category={highlightCategory} tag={highlightTag} categoryPreview={Boolean(previewCategory)} tagPreview={Boolean(previewTag)} colorMode={colorMode} reducedMotion={reducedMotion} onHoverPost={onHoverPost} onHoverFeature={onHoverFeature} onHoverFriend={onHoverFriend} onHoverDiary={onHoverDiary} onResolvePostAnchor={onResolvePostAnchor} onResolveFeatureAnchor={onResolveFeatureAnchor} onResolveFriendAnchor={onResolveFriendAnchor} onResolveDiaryAnchor={onResolveDiaryAnchor} onSelectPost={selectScenePost} onOpenFeature={openFeature} onSelectFriend={selectFriend} onSelectDiary={openDiaryEntry} hoveredPost={hoveredPost} hoverAnchor={hoverAnchor} hoveredFeature={hoveredFeature} featureAnchor={hoverFeatureAnchor} selectedFriend={activeFriend} friendAnchor={friendAnchor} hoveredDiary={activeDiaryEntry} diaryAnchor={diaryAnchor} diarySingle={diaryBoardSummary} touchPost={touchPost} onCloseTouchPreview={() => setTouchPostId(undefined)} />
          <p className="mobile-town-hint">点击建筑预览，再次点击或选择「阅读文章」打开；单指任意方向拖动小镇，双指捏合缩放。在小镇外滑动可浏览页面。</p>
          {openDiaryEntryData && <DiaryReadingCard entry={openDiaryEntryData} index={openDiaryIndex} total={diaryOrder.length} anchor={cardAnchor} onPrev={() => stepDiary(-1)} onNext={() => stepDiary(1)} onClose={() => setOpenDiaryId(undefined)} />}
          <TownStatStrip stats={siteStats} totals={siteTotals} onAbout={() => navigate('about')} />
          <div className="town-mobile-support">
            <div className="town-caption"><span><i className="caption-dot" /> {siteConfig.title} · {SEASON_PROFILES[season].label}季小镇</span><span>建筑即文章 / {layout?.plots.length ?? 0} buildings / {posts.length} article floors</span><span className="caption-spacer" /><a href="/posts/" onClick={(event) => handleInternalClick(event, () => navigate('archive'))}>打开完整档案 {icon('arrow')}</a></div>
            <RecentPosts posts={filteredPosts.slice(0, 5)} hasFilter={Boolean(query || activeCategory || activeTag)} onOpen={openArticle} onClear={clearFilters} />
          </div>
        </section>}
        {surface === 'archive' && <ArchiveView posts={filteredPosts} onOpen={openArticle} />}
        {surface === 'about' && <AboutView counts={{ posts: posts.length, categories: categories.length, tags: tags.length, words: siteStats.words, days: siteStats.days }} totals={siteTotals} />}
        {surface === 'diary' && <DiaryView hash={navigation.hash} diaryMode={diaryMode} onChooseMode={chooseDiaryMode} />}
        {surface === 'article' && selectedPost && selectedSections && layout && <ArticleView colorMode={colorMode} navigation={navigation} post={selectedPost} sections={selectedSections} layout={layout} scrollRoot={mainSurfaceRef} onOpen={openArticle} seriesPosts={selectedPost.series ? sortedPosts.filter((post) => post.series === selectedPost.series).sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0)) : []} />}
        {surface === 'article' && selectedPost && !selectedSections && <ArticleLoading post={selectedPost} error={contentError === selectedPost.id} onRetry={() => { setContentError(undefined); setContentRetry((value) => value + 1); }} />}
        {surface === 'article' && !selectedPost && <EmptyView title="还没有选择文章" copy="从小镇或侧边栏打开一篇笔记吧。" action="回到小镇" onAction={() => navigate('town')} />}
        </div>
      </main>
    </div>
  );
}

function SidebarContent({ mobileOpen, panel, posts, categories, tags, activeCategory, activeTag, hoveredPostId, onHover, onHoverFeature, selectedFriendId, onHoverFriend, onSelectFriend, onCategoryPreview, onTagPreview, onCategory, onTag, onOpenArticle, onBack }: { mobileOpen: boolean; panel: SidebarPanel; posts: TownPostSummary[]; categories: string[]; tags: string[]; activeCategory?: string; activeTag?: string; hoveredPostId?: string; onHover: (id?: string) => void; onHoverFeature: (id?: string) => void; selectedFriendId?: string; onHoverFriend: (id?: string) => void; onSelectFriend: (id: string) => void; onCategoryPreview: (value?: string) => void; onTagPreview: (value?: string) => void; onCategory: (value?: string) => void; onTag: (value?: string) => void; onOpenArticle: (id: string) => void; onBack: () => void }) {
  if (panel === 'categories' || panel === 'category-posts') return <div className="sidebar-panel"><SidebarPanelHeader title={panel === 'category-posts' ? activeCategory ?? '分类文章' : '分类'} eyebrow="CATEGORIES" onBack={panel === 'category-posts' ? onBack : undefined} />{panel === 'categories' ? <div className="sidebar-taxonomy">{categories.map((category) => <button key={category} className={activeCategory === category ? 'is-selected' : ''} onPointerEnter={(event) => { if (event.pointerType === 'mouse') onCategoryPreview(category); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') onCategoryPreview(undefined); }} onClick={() => onCategory(category)}><span>{category}</span><b>{posts.filter((post) => post.category === category).length}</b></button>)}</div> : <SidebarPostList posts={posts} hoveredPostId={hoveredPostId} onHover={onHover} onOpenArticle={onOpenArticle} />}</div>;
  if (panel === 'tags' || panel === 'tag-posts') return <div className="sidebar-panel"><SidebarPanelHeader title={panel === 'tag-posts' ? `#${activeTag ?? '标签'}` : '标签'} eyebrow="TAGS" onBack={panel === 'tag-posts' ? onBack : undefined} />{panel === 'tags' ? <div className="sidebar-tags">{tags.map((tag) => <button key={tag} className={activeTag === tag ? 'is-selected' : ''} onPointerEnter={(event) => { if (event.pointerType === 'mouse') onTagPreview(tag); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') onTagPreview(undefined); }} onClick={() => onTag(tag)}>#{tag}</button>)}</div> : <SidebarPostList posts={posts} hoveredPostId={hoveredPostId} onHover={onHover} onOpenArticle={onOpenArticle} />}</div>;
  if (panel === 'friends') return <div className="sidebar-panel"><SidebarPanelHeader title="友邻" eyebrow="FRIEND LINKS" />{friendLinks.length ? <div className="friends-list">{friendLinks.map((friend) => <div className={`friend-row ${selectedFriendId === friend.id ? 'is-selected' : ''}`} key={friend.id} onPointerEnter={(event) => { if (event.pointerType === 'mouse') onHoverFriend(friend.id); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') onHoverFriend(undefined); }}><button type="button" className="friend-pick" onClick={() => onSelectFriend(friend.id)} aria-pressed={selectedFriendId === friend.id}><span className="friend-avatar"><img src={friend.avatar} alt="" loading="lazy" /></span><span><strong>{friend.nickname}</strong>{friend.description && <small>{friend.description}</small>}</span></button><a className="friend-visit" href={friend.url} target="_blank" rel="noreferrer noopener" aria-label={`访问 ${friend.nickname} 的网站`}>{icon('external')}</a></div>)}</div> : <div className="sidebar-empty">还没有友邻，等一封新信。</div>}</div>;
  if (panel === 'list') return <div className="sidebar-panel list-panel"><SidebarPanelHeader title="文章列表" eyebrow="ALL NOTES" /><SidebarPostList posts={posts} hoveredPostId={hoveredPostId} onHover={onHover} onOpenArticle={onOpenArticle} /></div>;
  return <div className="profile-panel" onPointerEnter={(event) => { if (event.pointerType === 'mouse') onHoverFeature('about'); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') onHoverFeature(undefined); }}><SidebarImage className="profile-avatar" src={siteConfig.profile.avatar} alt={siteConfig.profile.name} mobileOpen={mobileOpen} /><span className="panel-eyebrow">ABOUT ME</span><h2>{siteConfig.profile.name}</h2><strong className="profile-headline">{siteConfig.profile.headline}</strong><p>{siteConfig.profile.bio}</p>{siteConfig.profile.links.length > 0 && <div className="profile-links">{siteConfig.profile.links.map((link) => <a key={link.id} href={link.url} aria-label={link.label} title={link.label} target={link.url.startsWith('http') ? '_blank' : undefined} rel={link.url.startsWith('http') ? 'noreferrer noopener' : undefined}><img className="profile-link-logo" src={link.logo} alt="" loading="lazy" /><span className="visually-hidden">{link.label}</span></a>)}</div>}<a className="profile-about-link" href="/about/">阅读完整介绍 {icon('arrow')}</a></div>;
}

function SidebarPanelHeader({ title, eyebrow, onBack }: { title: string; eyebrow: string; onBack?: () => void }) { return <div className="sidebar-panel-header">{onBack && <button onClick={onBack} aria-label="返回面板">{icon('back')}</button>}<div><span>{eyebrow}</span><strong>{title}</strong></div></div>; }
function SidebarPostList({ posts, hoveredPostId, onHover, onOpenArticle }: { posts: TownPostSummary[]; hoveredPostId?: string; onHover: (id?: string) => void; onOpenArticle: (id: string) => void }) { return <div className="sidebar-posts">{posts.map((post, index) => <a key={post.id} href={`/posts/${encodeURIComponent(post.id)}/`} className={`sidebar-post ${hoveredPostId === post.id ? 'is-hovered' : ''}`} onPointerEnter={(event) => { if (event.pointerType === 'mouse') onHover(post.id); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') onHover(undefined); }} onClick={(event) => handleInternalClick(event, () => onOpenArticle(post.id))}><span className="sidebar-post-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{post.title}</strong><small>{post.category} · {formatDate(post.date)}</small></span>{icon('chevron')}</a>)}</div>; }

function SearchDropdown({ results, activeIndex, onHover, onOpen, onArchive, status, onRetry }: { results: TownPostSummary[]; activeIndex: number; onHover: (id?: string) => void; onOpen: (id: string) => void; onArchive: () => void; status: 'idle' | 'loading' | 'error'; onRetry: () => void }) { return <div className="search-dropdown"><span className="dropdown-label">SEARCHING THE TOWN · {status === 'loading' ? '…' : results.length}</span>{status === 'loading' ? <div className="empty-search" role="status" aria-live="polite">正在搜索全文…</div> : status === 'error' ? <div className="empty-search" role="alert">全文搜索暂时不可用。<button type="button" onClick={onRetry}>重新载入</button></div> : results.length ? results.map((post, index) => <a key={post.id} href={`/posts/${encodeURIComponent(post.id)}/`} className={`search-result ${index === activeIndex ? 'is-highlighted' : ''}`} onPointerEnter={(event) => { if (event.pointerType === 'mouse') onHover(post.id); }} onClick={(event) => handleInternalClick(event, () => onOpen(post.id))}><span className="search-result-index">0{index + 1}</span><span><strong>{post.title}</strong><small>{post.category} · {post.readingTime} min</small></span>{icon('arrow')}</a>) : <div className="empty-search">没有找到相关笔记。</div>}{status === 'idle' && results.length > 0 && <a className="dropdown-full" href="/posts/" onClick={(event) => handleInternalClick(event, onArchive)}>查看全部结果 {icon('arrow')}</a>}</div>; }

const isUsableAnchor = (anchor?: SceneAnchor): anchor is SceneAnchor =>
  !!anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y);

const clampAnchor = (anchor: SceneAnchor): SceneAnchor => ({
  x: Math.min(Math.max(anchor.x, 12), window.innerWidth - 12),
  y: Math.min(Math.max(anchor.y, 12), window.innerHeight - 12),
});

function TownTooltip({ post, anchor }: { post?: TownPostSummary; anchor?: SceneAnchor }) {
  if (!post || !anchor) return null;
  // The tooltip is fixed-positioned and 236px wide. When the anchor sits near
  // the right edge it must flip to the other side, otherwise the card is
  // clipped by the viewport and reads as a broken hover.
  const width = 236;
  const flip = anchor.x + width + 15 > window.innerWidth;
  return <div className={`town-tooltip ${flip ? 'is-flipped' : ''}`} style={{ left: anchor.x, top: anchor.y }}>
    <div className="tooltip-meta"><span>{post.category}</span><span>{post.readingTime} min</span></div>
    <strong>{post.title}</strong><p>{post.description}</p>
    <div className="tooltip-tags">{post.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div>
  </div>;
}

function FeatureTooltip({ feature, anchor: rawAnchor }: { feature?: TownFeature; anchor?: SceneAnchor }) {
  if (!feature || !isUsableAnchor(rawAnchor)) return null;
  const anchor = clampAnchor(rawAnchor);
  const flip = anchor.x + 236 + 15 > window.innerWidth;
  return <div className={`town-tooltip town-feature-tooltip ${flip ? 'is-flipped' : ''}`} style={{ left: anchor.x, top: anchor.y }}><div className="tooltip-meta"><span>{feature.kind === 'about' ? 'LANDMARK' : 'PLACE'}</span><span>点击进入</span></div><strong>{feature.title}</strong><p>{feature.summary}</p></div>; }

function FriendTag({ friend, anchor: rawAnchor }: { friend?: FriendLink; anchor?: SceneAnchor }) {
  if (!friend || !isUsableAnchor(rawAnchor)) return null;
  const anchor = clampAnchor(rawAnchor);
  const flip = anchor.x + 186 + 15 > window.innerWidth;
  return <div className={`town-tooltip town-friend-tag ${flip ? 'is-flipped' : ''}`} style={{ left: anchor.x, top: anchor.y }}>
    <div className="friend-tag-head"><span className="friend-tag-avatar"><img src={friend.avatar} alt="" loading="lazy" /></span><strong>{friend.nickname}</strong></div>
    {friend.description && <p>{friend.description}</p>}
    <a className="friend-tag-visit" href={friend.url} target="_blank" rel="noreferrer noopener">去串门 {icon('external')}</a>
  </div>;
}

function TownStatStrip({ stats, totals, onAbout }: { stats: ReturnType<typeof createSiteStats>; totals?: { pageviews: number; visitors: number }; onAbout: () => void }) {
  const items = [
    { key: 'words', value: formatWords(stats.words), label: '累计字数' },
    { key: 'posts', value: String(stats.posts), label: '篇文章' },
    { key: 'days', value: String(stats.days), label: '运行天数' },
    { key: 'pageviews', value: totals ? formatViews(totals.pageviews) : '—', label: '访问量' },
    { key: 'visitors', value: totals ? formatViews(totals.visitors) : '—', label: '访问人数' },
  ];
  return <section className="town-stat-strip" aria-label="站点累计数据">
    <div className="town-stat-strip-head">
      <span className="section-eyebrow">SINCE 2025 · TOWN LEDGER</span>
      <button type="button" onClick={onAbout}>关于这座小镇 {icon('arrow')}</button>
    </div>
    <div className="town-stat-strip-grid">
      {items.map((item) => <div className="town-stat-strip-cell" key={item.key}>
        <strong>{item.value}</strong>
        <span>{item.label}</span>
      </div>)}
    </div>
  </section>;
}

function RecentPosts({ posts, hasFilter, onOpen, onClear }: { posts: TownPostSummary[]; hasFilter: boolean; onOpen: (id: string) => void; onClear: () => void }) { return <section className="recent-posts"><header><div><span className="section-eyebrow">RECENT NOTES</span><h2>{hasFilter ? '当前筛选下的最近笔记' : '最近写下的几件事'}</h2></div><span className="recent-count">{String(posts.length).padStart(2, '0')} / notes</span></header>{posts.length ? <div className="recent-grid">{posts.map((post) => <a key={post.id} className="recent-card" href={`/posts/${encodeURIComponent(post.id)}/`} onClick={(event) => handleInternalClick(event, () => onOpen(post.id))}><span className="card-top"><span>{post.category}</span><span>{formatDate(post.date)}</span></span><strong>{post.title}</strong><p>{post.description}</p><span className="card-bottom">#{post.tags[0]} <i /> 阅读 {post.readingTime} 分钟 {icon('arrow')}</span></a>)}</div> : <EmptyView title="这条路暂时没有笔记" copy="换一个筛选条件，或者回到地图看看别的房子。" action="清除筛选" onAction={onClear} />}</section>; }

function ArchiveHeading({ postCount }: { postCount: number }) {
  return <header className="archive-heading archive-shell-heading"><div><span className="section-eyebrow">THE ARCHIVE · {String(postCount).padStart(2, '0')} NOTES</span><h1>文章档案</h1></div></header>;
}

function ArchiveView({ posts, onOpen }: { posts: TownPostSummary[]; onOpen: (id: string) => void }) {
  return <section className="archive-page">
    <div className="archive-list" aria-live="polite">{posts.map((post, index) => <a key={post.id} href={`/posts/${encodeURIComponent(post.id)}/`} className={`archive-row ${post.cover ? 'has-cover' : ''}`} onClick={(event) => handleInternalClick(event, () => onOpen(post.id))}>{post.cover ? <span className="archive-cover"><img src={post.cover} alt="" loading="lazy" /></span> : <span className="archive-index">{String(index + 1).padStart(2, '0')}</span>}<span className="archive-copy"><strong>{post.title}</strong><small>{post.description}</small><em>{post.category} · {post.tags.slice(0, 2).map((tag) => `#${tag}`).join('  ')}</em></span><time>{formatDate(post.date)}</time>{icon('arrow')}</a>)}</div>
    {!posts.length && <div className="archive-empty"><h2>这里暂时没有文章</h2><p>再次点击当前选项即可取消筛选，或者选择上方的其他分类与标签。</p></div>}
  </section>;
}

// Native details/media state belongs to this DOM subtree. Unrelated reading,
// hover, or theme updates must not write the authored HTML back into it.
const ArticleSectionContent = memo(function ArticleSectionContent({ html }: { html: string }) {
  return <div className="article-section-content" dangerouslySetInnerHTML={{ __html: html }} />;
});

type ArticleHeading = NonNullable<ArticleSection['heading']>;

function ArticleView({ post, sections, layout, seriesPosts, scrollRoot, onOpen, navigation, colorMode }: { colorMode: ColorMode; navigation: TownNavigation; post: TownPostSummary; sections: ArticleSection[]; layout: TownLayout; seriesPosts: TownPostSummary[]; scrollRoot: React.RefObject<HTMLElement | null>; onOpen: (id: string) => void }) {
  const headings = useMemo(() => sections.flatMap((section) => section.heading ? [section.heading] : []), [sections]);
  const townMap = useMemo(() => createTownMapModel(layout, post.id), [layout, post.id]);
  const seriesIndex = seriesPosts.findIndex((item) => item.id === post.id);
  const previousSeriesPost = seriesIndex > 0 ? seriesPosts[seriesIndex - 1] : undefined;
  const nextSeriesPost = seriesIndex >= 0 && seriesIndex < seriesPosts.length - 1 ? seriesPosts[seriesIndex + 1] : undefined;
  const headingKey = useMemo(() => headings.map((heading) => heading.id).join('|'), [headings]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(headings[0]?.id);
  const [readingProgress, setReadingProgress] = useState(0);
  // Reading count for this article. The hook drops stale responses, so a fast
  // previous/next switch can never paint the other article's number.
  const { count: viewCount } = useArticleViews(post.id);
  const collapsedEmbeds = useRef(new Set<string>());
  const previousPostId = useRef<string | undefined>(undefined);
  useIsomorphicLayoutEffect(() => {
    const changedPost = previousPostId.current !== post.id;
    previousPostId.current = post.id;
    if (navigation.restore || changedPost) {
      setCollapsed(Object.fromEntries((navigation.restore?.collapsed ?? []).map((id) => [id, true])));
      collapsedEmbeds.current = new Set(navigation.restore?.embeds ?? []);
    } else if (navigation.hash) setCollapsed({});
    setActiveHeadingId(headings[0]?.id);
    setReadingProgress(0);
    let clearArrival: (() => void) | undefined;
    const frame = window.requestAnimationFrame(() => {
      const root = scrollRoot.current;
      const article = root?.querySelector('.article-page');
      if (!root || !article) return;
      if (navigation.restore) {
        article.querySelectorAll('details').forEach((detail, index) => {
          const open = navigation.restore!.details[index];
          if (open !== undefined) detail.open = open;
        });
        root.scrollTo({ top: navigation.restore.scrollTop, behavior: 'instant' });
        return;
      }
      let target: HTMLElement | null = null;
      try { target = navigation.hash ? document.getElementById(decodeURIComponent(navigation.hash.slice(1))) : null; } catch { /* Malformed fragments fall back to the article start. */ }
      if (!target || (!target.closest('.article-body') && target.id !== 'article-comments')) {
        root.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
      for (let parent = target.parentElement; parent && parent !== root; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        if (parent.classList.contains('is-collapsed')) {
          parent.classList.remove('is-collapsed');
          const key = parent.dataset.embedKey;
          if (key) collapsedEmbeds.current.delete(key);
          parent.querySelector(':scope > [aria-expanded]')?.setAttribute('aria-expanded', 'true');
        }
      }
      const top = root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - 136;
      root.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      const body = article.querySelector<HTMLElement>('.article-body');
      if (body?.contains(target)) clearArrival = showReferenceArrival(target, body, sections);
    });
    return () => { window.cancelAnimationFrame(frame); clearArrival?.(); };
  }, [navigation, post.id, scrollRoot]);
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
      const body = root.querySelector('.article-body');
      const rootTop = root.getBoundingClientRect().top;
      // Comments and series links are outside the article's reading range.
      const readingEnd = Math.max(0, body ? root.scrollTop + body.getBoundingClientRect().bottom - rootTop - root.clientHeight : root.scrollHeight - root.clientHeight);
      const progress = readingEnd === 0 ? Number(root.scrollTop > 0) : Math.min(1, Math.max(0, root.scrollTop / readingEnd));
      setReadingProgress(Math.round(progress * 100));
      if (!headings.length) return;
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
    const resizeObserver = new ResizeObserver(requestUpdate);
    const body = root.querySelector('.article-body');
    if (body) resizeObserver.observe(body);
    return () => {
      resizeObserver.disconnect();
      root.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [collapsed, headingKey, headings.length, post.id, scrollRoot]);

  const hiddenSections = useMemo(() => {
    const collapsedLevels: number[] = [];
    return sections.map((section) => {
      const level = section.heading?.level;
      if (level) {
        while (collapsedLevels.length && collapsedLevels[collapsedLevels.length - 1] >= level) collapsedLevels.pop();
      }
      const hidden = collapsedLevels.length > 0;
      if (section.heading && collapsed[section.heading.id]) collapsedLevels.push(section.heading.level);
      return hidden;
    });
  }, [collapsed, sections]);

  // Keep the comment anchor available during lazy loading for sign-in return links.
  return <section className="article-page"><div className="article-layout"><article><span className="section-eyebrow">FIELD NOTE · {formatDate(post.date).toUpperCase()}</span><h1>{post.title}</h1><p className="article-dek">{post.description}</p><div className="article-meta"><span>{post.category}</span><span>·</span><span>{post.readingTime} 分钟阅读</span><span>·</span><span>{post.wordCount} 字</span>{viewCount !== undefined && <><span>·</span><span className="article-view-count">{formatViews(viewCount)} 次阅读</span></>}{post.series && <><span>·</span><span>{post.series} / {(post.seriesIndex ?? 0) + 1}</span></>}</div>{seriesPosts.length > 1 && <SeriesDrawer posts={seriesPosts} selectedPostId={post.id} onOpenArticle={onOpen} />}{post.cover && <figure className="article-cover"><img src={post.cover} alt={post.coverAlt ?? post.title} /></figure>}<div className="article-body">{sections.map((section, index) => {
    const ancestorHidden = hiddenSections[index];
    const ownCollapsed = section.heading ? Boolean(collapsed[section.heading.id]) : false;
    const Heading = section.heading ? ARTICLE_HEADING_TAGS[Math.min(section.heading.level, 6)] : undefined;
    return <section className={`article-section ${ancestorHidden ? 'is-hidden' : ''}`} key={section.heading?.id ?? `preamble-${index}`}>{section.heading && Heading && <div className={`article-heading-row level-${section.heading.level}`}><Heading id={section.heading.id} {...(section.heading.html ? { dangerouslySetInnerHTML: { __html: section.heading.html } } : { children: section.heading.text })} /><span className="heading-level-marker" aria-hidden="true">{'#'.repeat(section.heading.level)}</span><button className="heading-toggle" aria-label={ownCollapsed ? `展开 ${section.heading.text}` : `收起 ${section.heading.text}`} aria-expanded={!ownCollapsed} onClick={() => setCollapsed((state) => ({ ...state, [section.heading!.id]: !state[section.heading!.id] }))} /></div>}{!ancestorHidden && !ownCollapsed && section.html && <ArticleSectionContent html={section.html} />}</section>;
  })}</div>{(previousSeriesPost || nextSeriesPost) && <div className="related-posts series-neighbors"><span>继续阅读 · {post.series}</span><div className="series-neighbor-grid">{previousSeriesPost ? <a href={`/posts/${encodeURIComponent(previousSeriesPost.id)}/`} onClick={(event) => handleInternalClick(event, () => onOpen(previousSeriesPost.id))}><small>上一篇</small><strong>{previousSeriesPost.title}</strong></a> : <span />}{nextSeriesPost ? <a href={`/posts/${encodeURIComponent(nextSeriesPost.id)}/`} onClick={(event) => handleInternalClick(event, () => onOpen(nextSeriesPost.id))}><small>下一篇</small><strong>{nextSeriesPost.title}</strong></a> : <span />}</div></div>}{commentConfig.enabled && <Suspense fallback={<section id="article-comments" className="article-comments" aria-label="正在加载评论" />}><ArticleComments key={post.id} postId={post.id} title={post.title} colorMode={colorMode} scrollRoot={scrollRoot} /></Suspense>}</article><aside className="article-aside"><span className="aside-eyebrow">ON THE MAP</span><MiniTownMap post={post} map={townMap} />{headings.length > 0 && <ArticleContents headings={headings} activeHeadingId={activeHeadingId} readingProgress={readingProgress} />}</aside></div></section>;
}

function SeriesDrawer({ posts, selectedPostId, onOpenArticle }: { posts: TownPostSummary[]; selectedPostId: string; onOpenArticle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className={`series-drawer ${open ? 'is-open' : ''}`}>
    <button className="series-drawer-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span><small>文章系列</small><strong>此篇文章属于「{posts[0]?.series}」</strong></span><span className="series-drawer-count">{posts.length} 篇 {icon('chevron')}</span>
    </button>
    <div className="series-drawer-list"><div>{posts.map((item, index) => <a key={item.id} href={`/posts/${encodeURIComponent(item.id)}/`} className={item.id === selectedPostId ? 'is-current' : ''} onClick={(event) => handleInternalClick(event, () => onOpenArticle(item.id))}><b>{String(index + 1).padStart(2, '0')}</b><span>{item.title}</span>{item.id === selectedPostId && <em>正在阅读</em>}</a>)}</div></div>
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


const ABOUT_SECTIONS = [
  {
    id: 'about-town',
    title: '这座小镇',
    paragraphs: [
      '这座小镇就是博客的地图：一栋楼是一篇文章，楼层多少对应篇幅长短，街区对应分类和标签。',
      '可以拖动、缩放，沿着路走，看看最近写下的东西；点开任意一栋楼，就能进入那篇笔记。',
      '友邻聚落和中心地标把不同入口放在同一张地图上，让浏览不再是列表的替代品。',
    ],
  },
  {
    id: 'about-map',
    title: '地图怎么读',
    paragraphs: [
      '建筑、友邻小屋和公告牌各自使用不同的模型与交互，但都共享同一套世界坐标和碰撞规则。',
      '悬停侧边栏的简介卡会高亮中心地标；短日记在镇外沿路排开，点击可以展开阅读卡。',
      '所有位置都由种子稳定生成，新增文章不会让已有建筑重新洗牌。',
    ],
  },
  {
    id: 'about-notes',
    title: '文章与短日记',
    paragraphs: [
      '文章进入档案、搜索和 RSS；短日记只存在于小镇与日记页，不占用建筑地块。',
      '系列文章会合并成同一栋楼的多层，避免一个主题在镇上被拆成许多孤立的小屋。',
      '这套框架的目标是让内容先成立，再让空间成为阅读的入口。',
    ],
  },
];

function DiaryTag({ entry, anchor: rawAnchor, single, count }: { entry?: DiaryEntry; anchor?: SceneAnchor; single?: boolean; count: number }) {
  if (!isUsableAnchor(rawAnchor)) return null;
  const anchor = clampAnchor(rawAnchor);
  if (!entry && !single) return null;
  const flip = anchor.x + 236 + 15 > window.innerWidth;
  return <div className={`town-tooltip town-diary-tag ${flip ? 'is-flipped' : ''}`} style={{ left: anchor.x, top: anchor.y }}>
    {single
      ? <>
        <div className="tooltip-meta"><span>NOTICE BOARD</span><span>{String(count).padStart(2, '0')} NOTES</span></div>
        <strong>小镇布告栏</strong>
        <p>几句话记录当下。点开看看最近写了什么。</p>
        <a href="/diary/" onClick={(event) => handleInternalClick(event, () => window.location.assign('/diary/'))}>进入短日记 {icon('arrow')}</a>
      </>
      : <>
        <div className="tooltip-meta"><span>{formatDate(entry!.date)}</span><span>{entry!.mood ?? '短日记'}</span></div>
        <strong>{entry!.content}</strong>
        <a href={`/diary/#${entry!.id}`} onClick={(event) => handleInternalClick(event, () => window.location.assign(`/diary/#${entry!.id}`))}>打开这条日记 {icon('arrow')}</a>
      </>}
  </div>;
}

/**
 * Reading card for one short note. It floats over the scene without taking the
 * town away, so the visitor can keep panning while they read, and clicking
 * anywhere outside it closes the card.
 */
function DiaryReadingCard({ entry, index, total, anchor, onPrev, onNext, onClose }: { entry: DiaryEntry; index: number; total: number; anchor?: SceneAnchor; onPrev: () => void; onNext: () => void; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(performance.now());
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key === 'ArrowLeft') onPrev();
      if (event.key === 'ArrowRight') onNext();
    };
    const onPointerDown = (event: PointerEvent) => {
      // Ignore the very click that opened the card.
      if (performance.now() - mountedAt.current < 250) return;
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    // The sidebar sits in a fixed layer and can swallow pointerdown before it
    // reaches window, so listen for both pointerdown and click.
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('mousedown', onPointerDown as unknown as (event: MouseEvent) => void);
    window.addEventListener('click', onPointerDown as unknown as (event: MouseEvent) => void);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('mousedown', onPointerDown as unknown as (event: MouseEvent) => void);
      window.removeEventListener('click', onPointerDown as unknown as (event: MouseEvent) => void);
    };
  }, [onClose, onPrev, onNext]);
  // Sit above the board it belongs to, flipping below when there is no room.
  // With no usable anchor the card stays centred rather than collapsing into
  // the stage corner.
  const cardWidth = 420;
  const usable = isUsableAnchor(anchor);
  const safeAnchor = usable ? clampAnchor(anchor) : undefined;
  const left = safeAnchor ? Math.min(Math.max(safeAnchor.x, cardWidth / 2 + 12), window.innerWidth - cardWidth / 2 - 12) : window.innerWidth / 2;
  // Prefer above the board, but only if the whole card fits; otherwise place
  // it below, and clamp so it never rides up under the top bar.
  const cardHeight = 300;
  const spaceAbove = safeAnchor ? safeAnchor.y - 60 : 0;
  const above = safeAnchor ? spaceAbove > cardHeight + 40 : true;
  const top = safeAnchor
    ? (above
      ? Math.max(70, safeAnchor.y - 18)
      : Math.min(window.innerHeight - 40, safeAnchor.y + 18))
    : undefined;
  return <div className={`diary-reading-card ${above ? 'is-above' : 'is-below'}`} ref={panelRef} role="dialog" aria-modal="false" aria-label="短日记内容" style={safeAnchor ? { left, top } : undefined}>
    <div className="diary-reading-head">
      <div className="diary-reading-meta"><span>{formatDate(entry.date)}</span>{entry.location && <span>{entry.location}</span>}{entry.mood && <em>{entry.mood}</em>}</div>
      <button type="button" className="diary-reading-close" aria-label="关闭" onClick={onClose}>{icon('close')}</button>
    </div>
    <p className="diary-reading-text">{entry.content}</p>
    {entry.images?.length ? <div className="diary-reading-images">
      {entry.images.map((image) => <a key={image.src} href={image.src} target="_blank" rel="noreferrer noopener"><img src={image.src} alt={image.alt} loading="lazy" decoding="async" width={image.width} height={image.height} /></a>)}
    </div> : null}
    <div className="diary-reading-actions">
      <button type="button" onClick={onPrev} disabled={index <= 0} aria-label="上一条">{icon('back')}<span>上一条</span></button>
      <span className="diary-reading-count">{index + 1} / {total}</span>
      <button type="button" onClick={onNext} disabled={index >= total - 1} aria-label="下一条"><span>下一条</span>{icon('arrow')}</button>
    </div>
    <a className="diary-reading-open" href={`/diary/#${entry.id}`} onClick={(event) => handleInternalClick(event, () => window.location.assign(`/diary/#${entry.id}`))}>打开日记页 {icon('arrow')}</a>
  </div>;
}

function DiaryView({ hash, diaryMode, onChooseMode }: { hash?: string; diaryMode: 'district' | 'single'; onChooseMode: (mode: 'district' | 'single') => void }) {
  const entries = useMemo(() => sortedDiaryEntries(), []);
  const groups = useMemo(() => groupDiaryByMonth(entries), [entries]);
  // Boards in the town deep-link to a single note, so honour the hash once the
  // list has painted instead of relying on the browser's pre-hydration jump.
  useEffect(() => {
    const id = (hash ?? window.location.hash).replace('#', '');
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(id);
      const root = document.querySelector<HTMLElement>('.main-scroll');
      if (!element || !root) return;
      const top = root.scrollTop + element.getBoundingClientRect().top - root.getBoundingClientRect().top - 104;
      root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash]);
  return <section className="diary-page">
    <header className="diary-head">
      <div className="diary-mode-row">
        <span className="diary-mode-label">小镇里的样子</span>
        <div className="diary-mode-switch" role="group" aria-label="短日记在镇上的显示方式">
          <button type="button" className={diaryMode === 'district' ? 'is-active' : ''} aria-pressed={diaryMode === 'district'} onClick={() => onChooseMode('district')}>街区</button>
          <button type="button" className={diaryMode === 'single' ? 'is-active' : ''} aria-pressed={diaryMode === 'single'} onClick={() => onChooseMode('single')}>单板</button>
        </div>
      </div>
      <span className="section-eyebrow">TOWN NOTICE BOARD · {String(entries.length).padStart(2, '0')} NOTES</span>
      <h1>短日记</h1>
      <p>几句话记录当下。它们不占文章建筑，也不会出现在档案和 RSS 里。</p>
    </header>
    <div className="diary-layout">
      <nav className="diary-months" aria-label="按月份浏览">
        {groups.map((group) => <a key={group.key} href={`#diary-${group.key}`} onClick={(event) => handleInternalClick(event, () => {
          const element = document.getElementById(`diary-${group.key}`);
          const root = document.querySelector<HTMLElement>('.main-scroll');
          if (!element || !root) return;
          const top = root.scrollTop + element.getBoundingClientRect().top - root.getBoundingClientRect().top - 104;
          root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        })}><span>{group.label}</span><b>{String(group.entries.length).padStart(2, '0')}</b></a>)}
      </nav>
      <div className="diary-timeline">
        {groups.map((group) => <section className="diary-month" id={`diary-${group.key}`} key={group.key}>
          <h2>{group.label}</h2>
        {group.entries.map((entry) => <article className="diary-card" id={entry.id} key={entry.id}>
            <span className="diary-tape" aria-hidden="true" />
            <div className="diary-meta">
              <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              {entry.location && <span>{entry.location}</span>}
              {entry.mood && <em>{entry.mood}</em>}
            </div>
            <p>{entry.content}</p>
            {entry.images?.length ? <div className={`diary-images count-${Math.min(entry.images.length, 3)}`}>
              {entry.images.map((image) => <a key={image.src} href={image.src} target="_blank" rel="noreferrer noopener"><img src={image.src} alt={image.alt} loading="lazy" decoding="async" width={image.width} height={image.height} /></a>)}
            </div> : null}
          </article>)}
        </section>)}
      </div>
    </div>
  </section>;
}

function AboutView({ counts, totals }: { counts: { posts: number; categories: number; tags: number; words: number; days: number }; totals?: { pageviews: number; visitors: number } }) {
  const activeSection = ABOUT_SECTIONS[0].id;
  return <section className="about-inapp">
    <div className="about-inapp-main">
      <header className="about-inapp-head">
        <span className="about-inapp-eyebrow">TOWN RESIDENT · ABOUT</span>
        <h1>{siteConfig.profile.name}</h1>
        <p className="about-inapp-headline">{siteConfig.profile.headline}</p>
      </header>
      <section className="about-inapp-hero">
        <div className="about-inapp-portrait">
          <img src={siteConfig.profile.avatar} alt={siteConfig.profile.name} />
          <span className="about-inapp-badge">{siteConfig.shortTitle.toUpperCase()}</span>
        </div>
        <div className="about-inapp-intro">
          <p>{siteConfig.profile.bio}</p>
          <div className="about-inapp-stats">
            <div><strong>{counts.posts}</strong><span>文章</span></div>
            <div><strong>{formatWords(counts.words)}</strong><span>累计字数</span></div>
            <div><strong>{counts.days}</strong><span>运行天数</span></div>
            <div><strong>{totals ? formatViews(totals.pageviews) : '—'}</strong><span>访问量</span></div>
            <div><strong>{totals ? formatViews(totals.visitors) : '—'}</strong><span>访问人数</span></div>
          </div>
          <div className="about-inapp-links">
            {siteConfig.profile.links.map((link) => <a key={link.id} href={link.url} target={link.url.startsWith('http') ? '_blank' : undefined} rel={link.url.startsWith('http') ? 'noreferrer noopener' : undefined}>{link.label} ↗</a>)}
          </div>
        </div>
      </section>
      <div className="about-inapp-grid">
        {ABOUT_SECTIONS.map((section, index) => <section className={`about-inapp-card ${index === 1 ? 'is-accent' : ''}`} key={section.id} id={section.id}>
          <span className="about-inapp-card-index">{String(index + 1).padStart(2, '0')}</span>
          <h2>{section.title}</h2>
          {section.paragraphs.map((text, paragraphIndex) => <p key={paragraphIndex}>{text}</p>)}
          {index === 1 && <span className="about-inapp-card-ring" aria-hidden="true" />}
        </section>)}
        <section className="about-inapp-card" id="about-links">
          <span className="about-inapp-card-index">04</span>
          <h2>找到我</h2>
          <p>有想法、有问题、发现写错了，都可以从这里开始。</p>
          <div className="about-inapp-links">
            {siteConfig.profile.links.map((link) => <a key={link.id} href={link.url} target={link.url.startsWith('http') ? '_blank' : undefined} rel={link.url.startsWith('http') ? 'noreferrer noopener' : undefined}>{link.label}{icon('external')}</a>)}
          </div>
        </section>
      </div>
    </div>
    <aside className="about-inapp-aside">
      <span className="aside-eyebrow">ON THIS PAGE</span>
      <AboutContents activeId={activeSection} />
    </aside>
  </section>;
}

function AboutContents({ activeId }: { activeId: string }) {
  const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    handleInternalClick(event, () => {
      const element = document.getElementById(id);
      const root = document.querySelector<HTMLElement>('.main-scroll');
      if (!element || !root) return;
      const target = root.scrollTop + element.getBoundingClientRect().top - root.getBoundingClientRect().top - 104;
      root.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    });
  };
  return <nav className="article-contents about-contents" aria-label="关于页面目录">
    <span className="aside-eyebrow">CONTENTS</span>
    <div className="article-contents-viewport">
      {[...ABOUT_SECTIONS, { id: 'about-links', title: '找到我' }].map((section) => <a key={section.id} href={`#${section.id}`} className={`toc-level-1 ${section.id === activeId ? 'is-active' : ''}`} onClick={(event) => jumpTo(event, section.id)}>{section.title}</a>)}
    </div>
  </nav>;
}

function MiniTownMap({ post, map }: { post: TownPostSummary; map: TownMapModel }) {
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

function ArticleLoading({ post, error, onRetry }: { post: TownPostSummary; error: boolean; onRetry: () => void }) {
  return <div className="empty-view" role="status" aria-live="polite">
    <h2>{error ? '文章暂时无法载入' : `正在打开「${post.title}」`}</h2>
    <p>{error ? '正文请求失败，请检查网络后重试。' : '正在载入正文…'}</p>
    {error && <button onClick={onRetry}>重新载入 {icon('arrow')}</button>}
  </div>;
}
