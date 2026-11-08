let pending: Promise<void> | undefined;

/** Keep the original typefaces, without competing with a town's cold start. */
export function requestTownFonts() {
  pending ??= (async () => {
    window.dispatchEvent(new Event('town:load-fonts'));
    // ?inline prevents Astro from hoisting this stylesheet into the initial HTML.
    const { default: css } = await import('../styles/fonts.css?inline');
    const style = document.createElement('style');
    style.dataset.townFonts = 'true';
    style.textContent = css;
    document.head.append(style);
  })().catch(() => {
    pending = undefined; // Native fallbacks remain usable; a later navigation can retry.
  });
  return pending;
}
