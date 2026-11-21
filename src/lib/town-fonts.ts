let pending: Promise<void> | undefined;

/** Keep the original typefaces, without competing with a town's cold start. */
export function requestTownFonts() {
  pending ??= (async () => {
    if (document.documentElement.classList.contains('has-site-entry')) {
      await new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          if (document.documentElement.classList.contains('has-site-entry')) return;
          observer.disconnect();
          resolve();
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      });
    }
    window.dispatchEvent(new Event('town:load-fonts'));
    // ?inline prevents Astro from hoisting this stylesheet into the initial HTML.
    const { default: css } = await import('../styles/fonts.css?inline');
    const style = document.createElement('style');
    style.dataset.townFonts = 'true';
    // IBM's split font CSS defaults to blocking text while the font downloads.
    style.textContent = css.replace(/@font-face\s*\{/g, '@font-face{font-display:swap;');
    document.head.append(style);
  })().catch(() => {
    pending = undefined; // Native fallbacks remain usable; a later navigation can retry.
  });
  return pending;
}
