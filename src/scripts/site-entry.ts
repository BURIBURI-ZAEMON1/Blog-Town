import { ENTRY_STEP_MS, ENTRY_END_MS, ENTRY_CROSS_START_MS, getEntryCamera, getEntryDoorPose } from '../lib/entry-motion';

export function startSiteEntry() {
  const root = document.documentElement;
  const element = document.querySelector<HTMLElement>('.site-entry');
  if (!element || !root.classList.contains('has-site-entry')) return;
  const entry = element;
  const ground = entry.querySelector<HTMLElement>('.site-entry-ground')!;
  const veil = entry.querySelector<SVGPathElement>('.site-entry-veil path')!;
  const passage = entry.querySelector<HTMLElement>('.site-entry-passage')!;
  const caption = entry.querySelector<HTMLElement>('.site-entry-caption')!;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const doors = new Map<number, { frame: HTMLElement; leaf: HTMLElement }>();
  const shell = document.querySelector<HTMLElement>('.app-shell');
  let previousFrame = performance.now();
  let elapsed = 0;
  let finalDoor: number | undefined;
  let frame = 0;
  let finished = false;
  let coverScale = 1;
  let width = 0;
  let height = 0;
  let doorWidth = 0;
  let doorHeight = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    doorWidth = passage.clientWidth;
    doorHeight = passage.clientHeight;
    coverScale = Math.max(width / doorWidth, height / doorHeight) * 1.16;
    if (entry.dataset.phase !== 'crossing') veil.setAttribute('d', `M0 0H${width}V${height}H0Z`);
  }
  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    clearTimeout(watchdog);
    observer.disconnect();
    motion.removeEventListener('change', onReady);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', resize);
    root.classList.remove('has-site-entry');
    shell?.removeAttribute('inert');
    entry.remove();
    try { sessionStorage.setItem('town:entered', 'true'); } catch { /* Entry also works without browser storage. */ }
  }
  function onReady() {
    if (root.dataset.siteReady !== 'true') return;
    if (motion.matches) {
      entry.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).finished.then(finish);
    } else {
      // Choose the next unopened door; never replace or retime one already in motion.
      finalDoor ??= Math.floor(elapsed / ENTRY_STEP_MS) + 1;
      entry.dataset.finalDoor = String(finalDoor);
    }
  }
  function tick(now: number) {
    if (finished || document.hidden) return;
    // Shader compilation can block a frame; don't skip the passage when it resumes.
    elapsed += Math.min(40, now - previousFrame);
    previousFrame = now;
    const newest = Math.floor(elapsed / ENTRY_STEP_MS);
    const finalAge = finalDoor === undefined ? -1 : elapsed - finalDoor * ENTRY_STEP_MS;
    const camera = finalAge < 0 ? 1 : getEntryCamera(finalAge, coverScale);
    const crossing = finalAge >= ENTRY_CROSS_START_MS;
    entry.dataset.phase = crossing ? 'crossing' : finalDoor === undefined ? 'waiting' : 'settling';
    if (crossing) {
      ground.style.opacity = '0';
      caption.style.opacity = '0';
      const scale = getEntryDoorPose(finalAge).scale * camera;
      const left = width / 2 - doorWidth * scale / 2;
      const top = height * .44 - doorHeight * scale / 2;
      veil.setAttribute('d', `M0 0H${width}V${height}H0Z M${left} ${top}h${doorWidth * scale}v${doorHeight * scale}h${-doorWidth * scale}Z`);
    }
    if (!motion.matches) {
      for (let index = newest - 5; index <= Math.min(newest + 1, finalDoor ?? newest + 1); index++) {
        const age = elapsed - index * ENTRY_STEP_MS;
        const pose = getEntryDoorPose(age);
        if (!doors.has(index) && pose.opacity > 0) {
          const door = document.createElement('div');
          door.className = 'site-entry-door';
          door.dataset.door = String(index);
          door.innerHTML = '<div class="site-entry-leaf"><i></i></div>';
          passage.append(door);
          door.style.zIndex = String(100000 - index);
          doors.set(index, { frame: door, leaf: door.firstElementChild as HTMLElement });
        }
        const door = doors.get(index);
        if (!door) continue;
        door.frame.style.transform = `scale(${pose.scale * camera})`;
        door.frame.style.opacity = String(index === finalDoor ? 1 : pose.opacity);
        door.leaf.style.transform = `perspective(600px) rotateY(${pose.angle}deg)`;
        door.leaf.style.setProperty('--door-shade', String(.025 + Math.sin(-pose.angle * Math.PI / 180) * .065));
      }
      for (const [index, door] of doors) {
        if (elapsed - index * ENTRY_STEP_MS > 3250 && index !== finalDoor) {
          door.frame.remove();
          doors.delete(index);
        }
      }
    }
    if (finalAge >= ENTRY_END_MS) { finish(); return; }
    frame = requestAnimationFrame(tick);
  }
  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
    } else {
      previousFrame = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  const observer = new MutationObserver(onReady);
  observer.observe(root, { attributes: true, attributeFilter: ['data-site-ready'] });
  const watchdog = window.setTimeout(finish, 14000);
  motion.addEventListener('change', onReady);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', resize);
  resize();
  onReady();
  if (!document.hidden) frame = requestAnimationFrame(tick);
}
