import { useEffect, useState } from 'react';
import { getCachedView, recordView, type ViewSnapshot } from '../lib/views';

export function usePageViews(path: string) {
  const [result, setResult] = useState<{ path: string; snapshot?: ViewSnapshot }>();
  useEffect(() => {
    let cancelled = false;
    setResult({ path, snapshot: getCachedView(path) });
    void recordView(path).then(snapshot => {
      if (!cancelled) setResult({ path, snapshot: snapshot ?? getCachedView(path) });
    });
    return () => { cancelled = true; };
  }, [path]);
  return result?.path === path ? result.snapshot : undefined;
}
