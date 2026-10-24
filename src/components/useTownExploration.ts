import { useCallback, useEffect, useState } from 'react';
import { TOWN_EXPLORED_STORAGE_KEY } from '../data/town-post-notices';

export function useTownExploration() {
  const [explored, setExplored] = useState<boolean>();
  useEffect(() => {
    try { setExplored(window.localStorage.getItem(TOWN_EXPLORED_STORAGE_KEY) === 'true'); }
    catch { setExplored(false); }
  }, []);
  const markExplored = useCallback(() => {
    setExplored(true);
    try { window.localStorage.setItem(TOWN_EXPLORED_STORAGE_KEY, 'true'); }
    catch { /* Keep the state for the current session when storage is unavailable. */ }
  }, []);
  return { showGuide: explored === false, markExplored };
}
