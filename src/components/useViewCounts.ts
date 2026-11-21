import { useEffect, useRef, useState } from 'react';
import { articlePath, readViews, recordView } from '../lib/views';

/**
 * Reads a batch of view totals once on mount. Stale responses are ignored when
 * the requested path set changes, so a fast article switch can never paint the
 * previous article's number.
 */
export function useViewCounts(paths: string[]) {
  const [views, setViews] = useState<Record<string, number>>({});
  const [enabled, setEnabled] = useState(false);
  const signature = paths.join('|');
  const latest = useRef(signature);
  latest.current = signature;

  useEffect(() => {
    if (!signature) return;
    let cancelled = false;
    void readViews(paths).then((snapshot) => {
      if (cancelled || latest.current !== signature) return;
      setEnabled(snapshot.enabled);
      setViews(snapshot.views);
    });
    return () => { cancelled = true; };
    // `signature` captures the full path list; `paths` is re-created per render.
  }, [signature]);

  return { views, enabled };
}

/**
 * Records a single article read and exposes its running total. Returning
 * `undefined` means "unknown", which the UI renders as a dash rather than 0.
 */
export function useArticleViews(postId: string | undefined) {
  const [count, setCount] = useState<number | undefined>(undefined);
  const [enabled, setEnabled] = useState(false);
  const latest = useRef(postId);
  latest.current = postId;

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    const path = articlePath(postId);
    void recordView(path).then((value) => {
      if (cancelled || latest.current !== postId) return;
      setEnabled(value !== undefined);
      setCount(value);
    });
    return () => { cancelled = true; };
  }, [postId]);

  return { count, enabled };
}
