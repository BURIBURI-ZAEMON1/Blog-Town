/** A versioned, browser-local record keyed by the same permanent IDs as article URLs. */
export const READ_POSTS_STORAGE_KEY = 'town-blog:read-posts:v1';
export const TOWN_EXPLORED_STORAGE_KEY = 'town-blog:town-explored:v1';
export const NEW_POST_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function parseReadPostIds(raw: string | null): Set<string> {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0) : []);
  } catch {
    return new Set();
  }
}

export function getNewPostIds(posts: readonly { id: string; date: string }[], readIds: ReadonlySet<string>, now: number): string[] {
  return posts.filter((post) => {
    const age = now - Date.parse(post.date);
    return age >= 0 && age <= NEW_POST_WINDOW_MS && !readIds.has(post.id);
  }).map((post) => post.id);
}

export type PostNoticeKind = 'new' | 'guide';
export type PostNoticeAnchor = { postId: string; x: number; y: number; kind: PostNoticeKind };
export type PostNoticeFrame = { width: number; height: number; anchors: PostNoticeAnchor[] };
export type PostNoticePlacement = PostNoticeAnchor & { left: number; top: number; width: number; height: number; path: string };

/** CSS-pixel callouts fan out from article floors, including floors sharing a building. */
export function layoutPostNotices({ width, height, anchors }: PostNoticeFrame): PostNoticePlacement[] {
  const margin = 10, gap = 8;
  const sizeFor = (kind: PostNoticeKind) => kind === 'guide'
    ? { width: width < 720 ? 168 : 184, height: width < 720 ? 56 : 52 }
    : { width: 80, height: width < 720 ? 44 : 36 };
  const maxSize = sizeFor('guide');
  if (width < maxSize.width + margin * 2 || height < maxSize.height + margin * 2) return [];
  const placed: PostNoticePlacement[] = [];
  const overlaps = (candidate: { left: number; top: number; width: number; height: number }) => placed.some((other) =>
    candidate.left < other.left + other.width + gap && candidate.left + candidate.width + gap > other.left &&
    candidate.top < other.top + other.height + gap && candidate.top + candidate.height + gap > other.top);
  // The onboarding guide gets first choice of space; article notices fill around it.
  for (const anchor of [...anchors].sort((a, b) => (a.kind === 'guide' ? -1 : 1) - (b.kind === 'guide' ? -1 : 1) || a.y - b.y || a.postId.localeCompare(b.postId))) {
    const size = sizeFor(anchor.kind);
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || anchor.x < 0 || anchor.x > width || anchor.y < 0 || anchor.y > height) continue;
    // Keep the callout on one consistent side so panning does not make it
    // jump across the building and change the visual reading direction.
    let position: { left: number; top: number } | undefined;
    for (let offset = 0; offset < height && !position; offset += size.height + gap) {
      for (const direction of offset ? [-1, 1] : [-1]) {
        const left = anchor.x + 28;
        const top = anchor.y - (anchor.kind === 'guide' ? 68 : 56) + direction * offset;
        const candidate = { left, top, ...size };
        if (!overlaps(candidate)) { position = { left, top }; break; }
      }
    }
    if (!position) continue;
    const { left, top } = position;
    const dotX = left + 12, dotY = top + size.height / 2;
    const bendX = dotX + (anchor.x > dotX ? 12 : -12);
    placed.push({ ...anchor, left, top, ...size, path: `M ${anchor.x} ${anchor.y} L ${bendX} ${dotY} H ${dotX}` });
  }
  return placed;
}
