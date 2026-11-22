import { useEffect, useState } from 'react';
import { recordView, type ViewSnapshot } from '../lib/views';

export function usePageViews(path: string) {
  const [result, setResult] = useState<{ path: string; snapshot?: ViewSnapshot }>();
  useEffect(() => {
    let cancelled = false;
    void recordView(path).then(snapshot => {
      if (!cancelled) setResult({ path, snapshot });
    });
    return () => { cancelled = true; };
  }, [path]);
  return result?.path === path ? result.snapshot : undefined;
}
