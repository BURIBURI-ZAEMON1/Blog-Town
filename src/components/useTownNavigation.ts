import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type MainSurface = 'town' | 'article' | 'archive';
export interface ReadingSnapshot {
  scrollTop: number;
  collapsed: string[];
  embeds: string[];
  details: boolean[];
}
export interface TownNavigation {
  surface: MainSurface;
  postId?: string;
  hash: string;
  revision: number;
  restore?: ReadingSnapshot;
}

function captureReading(root: HTMLElement | null): ReadingSnapshot {
  const article = root?.querySelector('.article-page');
  return {
    scrollTop: root?.scrollTop ?? 0,
    collapsed: Array.from(article?.querySelectorAll('.heading-toggle[aria-expanded="false"]') ?? [])
      .map((button) => button.previousElementSibling?.id).filter((id): id is string => Boolean(id)),
    embeds: Array.from(article?.querySelectorAll<HTMLElement>('[data-embed-key].is-collapsed') ?? [])
      .map((element) => element.dataset.embedKey!),
    details: Array.from(article?.querySelectorAll('details') ?? []).map((element) => element.open),
  };
}

// All article content is already present in the page data. Internal links can
// change views immediately, keeping the town/sidebar and their state mounted.
export function useTownNavigation(posts: { id: string }[], root: RefObject<HTMLElement | null>, initialSurface: MainSurface, initialPostId?: string) {
  const [navigation, setNavigation] = useState<TownNavigation>({ surface: initialSurface, postId: initialPostId, hash: '', revision: 0 });
  const currentKey = useRef('');
  const positions = useRef(new Map<string, ReadingSnapshot>());
  const remember = useCallback((persist = true) => {
    if (!currentKey.current) return;
    const snapshot = captureReading(root.current);
    positions.current.set(currentKey.current, snapshot);
    if (positions.current.size > 80) positions.current.delete(positions.current.keys().next().value!);
    if (persist) window.history.replaceState({ ...window.history.state, townNavigation: { key: currentKey.current, snapshot } }, '', window.location.href);
  }, [root]);
  const readRoute = useCallback((url: URL) => {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'posts') {
      if (!parts[1]) return { surface: 'archive' as const };
      let postId: string;
      try { postId = decodeURIComponent(parts[1]); } catch { return; }
      return posts.some((post) => post.id === postId) ? { surface: 'article' as const, postId } : undefined;
    }
    if (parts.length) return;
    // Keep legacy demo URLs readable; new navigation always uses static paths.
    const legacyPost = url.searchParams.get('post');
    if (url.searchParams.get('view') === 'article' && posts.some((post) => post.id === legacyPost)) return { surface: 'article' as const, postId: legacyPost! };
    return { surface: url.searchParams.get('view') === 'archive' ? 'archive' as const : 'town' as const };
  }, [posts]);
  const goTo = useCallback((url: URL) => {
    const route = readRoute(url);
    if (!route) return;
    remember();
    if (url.href !== window.location.href) {
      const key = window.crypto.randomUUID();
      window.history.pushState({ ...route, townNavigation: { key } }, '', url.href);
      currentKey.current = key;
    }
    setNavigation((previous) => ({ ...route, hash: url.hash, revision: previous.revision + 1 }));
  }, [readRoute, remember]);

  useEffect(() => {
    const oldRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const initial = window.history.state?.townNavigation;
    currentKey.current = initial?.key ?? window.crypto.randomUUID();
    window.history.replaceState({ ...window.history.state, townNavigation: { key: currentKey.current, snapshot: initial?.snapshot } }, '', window.location.href);
    const route = readRoute(new URL(window.location.href));
    if (route) setNavigation((previous) => ({ ...route, hash: window.location.hash, restore: initial?.snapshot, revision: previous.revision + 1 }));
    const onPopState = () => {
      // The browser has already activated the destination entry. Cache the
      // outgoing view without replacing the destination's history state.
      remember(false);
      const route = readRoute(new URL(window.location.href));
      if (!route) return;
      const entry = window.history.state?.townNavigation;
      currentKey.current = entry?.key ?? window.crypto.randomUUID();
      const restore = positions.current.get(currentKey.current) ?? entry?.snapshot;
      setNavigation((previous) => ({ ...route, hash: window.location.hash, restore, revision: previous.revision + 1 }));
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download') || link.hasAttribute('data-astro-reload')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.search || !readRoute(url)) return;
      event.preventDefault();
      goTo(url);
    };
    const onPageHide = () => remember();
    const element = root.current;
    element?.addEventListener('click', onClick);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      element?.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pagehide', onPageHide);
      window.history.scrollRestoration = oldRestoration;
    };
  }, [goTo, readRoute, remember, root]);

  useEffect(() => {
    if (navigation.surface !== 'article') root.current?.scrollTo({ top: navigation.restore?.scrollTop ?? 0, behavior: 'instant' });
  }, [navigation, root]);

  const navigate = (surface: MainSurface, postId?: string) => {
    const path = surface === 'article' && postId ? `/posts/${encodeURIComponent(postId)}/` : surface === 'archive' ? '/posts/' : '/';
    if (window.location.pathname === path && !window.location.search) return;
    goTo(new URL(path, window.location.origin));
  };
  return { navigation, navigate };
}
