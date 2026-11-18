import zcoolWoffUrl from '@fontsource/zcool-qingke-huangyou/files/zcool-qingke-huangyou-chinese-simplified-400-normal.woff?url';

let pending: Promise<void> | undefined;

/** Keep the original typefaces, without competing with a town's cold start. */
export function requestTownFonts() {
  pending ??= (async () => {
    window.dispatchEvent(new Event('town:load-fonts'));
    // ?inline prevents Astro from hoisting this stylesheet into the initial HTML.
    const { default: css } = await import('../styles/fonts.css?inline');
    const style = document.createElement('style');
    style.dataset.townFonts = 'true';
    // The inlined fontsource CSS keeps relative URLs from its package, which
    // resolve against the page instead of the emitted asset. Import the WOFF
    // explicitly so the display font has a stable, build-time URL.
    style.textContent = `${css}\n@font-face{font-family:'ZCOOL QingKe HuangYou';font-style:normal;font-display:swap;font-weight:400;src:url("${zcoolWoffUrl}") format("woff");}`;
    document.head.append(style);
  })().catch(() => {
    pending = undefined; // Native fallbacks remain usable; a later navigation can retry.
  });
  return pending;
}
