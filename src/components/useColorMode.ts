import { useEffect, useLayoutEffect, useState } from 'react';

type ColorMode = 'day' | 'night';
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useColorMode() {
  const [systemMode, setSystemMode] = useState<ColorMode>('day');
  // A manual choice lasts for this visit; a fresh visit follows the system again.
  const [override, setOverride] = useState<ColorMode>();
  const colorMode = override ?? systemMode;

  useClientLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemMode(media.matches ? 'night' : 'day');
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useClientLayoutEffect(() => {
    document.documentElement.classList.toggle('mode-night', colorMode === 'night');
    document.documentElement.style.colorScheme = colorMode === 'night' ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colorMode === 'night' ? '#0b1220' : '#ffffff');
  }, [colorMode]);

  return { colorMode, toggleColorMode: () => setOverride(colorMode === 'day' ? 'night' : 'day') };
}
