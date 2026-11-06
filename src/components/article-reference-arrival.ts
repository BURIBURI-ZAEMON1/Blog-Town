import type { TownPost } from './TownScene';

// A separate paint layer leaves authored mark, callout and syntax-highlighting
// colors intact. Its geometry follows the chapter while images/details resize.
export function showReferenceArrival(target: HTMLElement, body: HTMLElement, sections: TownPost['sections']) {
  const headingIndex = sections.findIndex((section) => section.heading?.id === target.id);
  let regions: Element[];
  if (headingIndex >= 0) {
    const level = sections[headingIndex].heading!.level;
    let end = headingIndex + 1;
    while (end < sections.length && (!sections[end].heading || sections[end].heading!.level > level)) end++;
    regions = Array.from(body.children).filter((element) => element.matches('.article-section')).slice(headingIndex, end);
  } else if (target.matches('h1, h2, h3, h4, h5, h6') || target.closest('h1, h2, h3, h4, h5, h6')) {
    const heading = target.matches('h1, h2, h3, h4, h5, h6') ? target : target.closest('h1, h2, h3, h4, h5, h6')!;
    const depth = Number(heading.tagName.slice(1));
    regions = [heading];
    for (let next = heading.nextElementSibling; next; next = next.nextElementSibling) {
      if (/^H[1-6]$/.test(next.tagName) && Number(next.tagName.slice(1)) <= depth) break;
      regions.push(next);
    }
  } else {
    let block: Element | null = target;
    if (target.matches('.article-reference-anchor')) {
      block = target.closest('h1, h2, h3, h4, h5, h6') ?? target.nextElementSibling;
      while (block?.matches('.article-reference-anchor')) block = block.nextElementSibling;
      block ??= target.parentElement;
    }
    regions = block ? [block] : [];
  }
  if (!regions.length) return () => {};
  const wash = document.createElement('div');
  wash.className = 'article-reference-wash';
  wash.setAttribute('aria-hidden', 'true');
  const updateGeometry = () => {
    const bounds = regions.filter((region) => region.getClientRects().length).map((region) => region.getBoundingClientRect());
    if (!bounds.length) { wash.hidden = true; return; }
    wash.hidden = false;
    const origin = body.getBoundingClientRect();
    const left = Math.min(...bounds.map((rect) => rect.left));
    const top = Math.min(...bounds.map((rect) => rect.top));
    const right = Math.max(...bounds.map((rect) => rect.right));
    const bottom = Math.max(...bounds.map((rect) => rect.bottom));
    Object.assign(wash.style, { left: `${left - origin.left - 8}px`, top: `${top - origin.top - 8}px`, width: `${right - left + 16}px`, height: `${bottom - top + 16}px` });
  };
  body.append(wash);
  updateGeometry();
  const observer = new ResizeObserver(updateGeometry);
  observer.observe(body);
  regions.forEach((region) => observer.observe(region));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation = wash.animate(reducedMotion ? [{ opacity: 1 }, { opacity: 1 }] : [
    { opacity: 1 }, { opacity: 1, offset: .55, easing: 'ease-out' }, { opacity: 0 },
  ], { id: 'reference-arrival', duration: 5000, easing: 'linear' });
  const dispose = () => { observer.disconnect(); animation.cancel(); wash.remove(); };
  animation.onfinish = dispose;
  return dispose;
}
