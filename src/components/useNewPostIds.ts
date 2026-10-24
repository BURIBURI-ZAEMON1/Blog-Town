import { useEffect, useMemo, useRef, useState } from 'react';
import { getNewPostIds, parseReadPostIds, READ_POSTS_STORAGE_KEY } from '../data/town-post-notices';

type PostDate = { id: string; date: string };
const NO_POST_IDS: readonly string[] = [];

function readStoredIds(): Set<string> {
  try { return parseReadPostIds(window.localStorage.getItem(READ_POSTS_STORAGE_KEY)); }
  catch { return new Set(); }
}

/** Only an actual article view marks a post read; hover and touch previews never do. */
export function useNewPostIds(posts: readonly PostDate[], openedPostId?: string): readonly string[] {
  const memory = useRef(new Set<string>());
  const [activity, setActivity] = useState<{ now: number; readIds: ReadonlySet<string> }>();

  useEffect(() => {
    const refresh = () => {
      for (const id of readStoredIds()) memory.current.add(id);
      setActivity({ now: Date.now(), readIds: new Set(memory.current) });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === READ_POSTS_STORAGE_KEY || event.key === null) {
        memory.current = parseReadPostIds(event.key === null ? null : event.newValue);
        refresh();
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!openedPostId) return;
    const merged = new Set([...readStoredIds(), ...memory.current, openedPostId]);
    memory.current = merged;
    setActivity({ now: Date.now(), readIds: merged });
    try { window.localStorage.setItem(READ_POSTS_STORAGE_KEY, JSON.stringify([...merged])); }
    catch { /* Keep the in-memory record when browser storage is unavailable. */ }
  }, [openedPostId]);

  return useMemo(() => activity ? getNewPostIds(posts, activity.readIds, activity.now) : NO_POST_IDS, [activity, posts]);
}
