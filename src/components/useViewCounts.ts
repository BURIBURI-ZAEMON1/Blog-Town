import { useEffect, useState } from 'react';
import { getCachedView, recordView, refreshView, type ViewSnapshot } from '../lib/views';

export function usePageViews(path: string) {
  const [result, setResult] = useState<{ path: string; snapshot?: ViewSnapshot }>();
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const recover = () => { void refreshView(path).then(snapshot => {
      if (!cancelled && snapshot) setResult({ path, snapshot });
    }); };
    window.addEventListener('online', recover);
    setResult({ path, snapshot: getCachedView(path) });
    void recordView(path).then(snapshot => {
      if (cancelled) return;
      setResult({ path, snapshot: snapshot ?? getCachedView(path) });
      if (!snapshot) retry = setTimeout(recover, 5000);
    });
    return () => { cancelled = true; clearTimeout(retry); window.removeEventListener('online', recover); };
  }, [path]);
  return result?.path === path ? result.snapshot : undefined;
}
