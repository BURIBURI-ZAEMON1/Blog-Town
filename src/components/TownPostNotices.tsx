import { useMemo } from 'react';
import { layoutPostNotices, type PostNoticeFrame } from '../data/town-post-notices';
import type { TownPost } from '../scene/brick-town/types';

type Props = {
  posts: TownPost[];
  newPostIds?: readonly string[];
  frame: PostNoticeFrame;
  reducedMotion: boolean;
  onOpen: (id: string) => void;
};

export default function TownPostNotices({ posts, newPostIds, frame, reducedMotion, onOpen }: Props) {
  const postMap = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const notices = useMemo(() => layoutPostNotices({ ...frame, anchors: frame.anchors.filter((anchor) => anchor.kind === 'guide' || newPostIds?.includes(anchor.postId)) }), [frame, newPostIds]);
  if (!notices.length) return null;
  return <div className="town-new-posts-overlay" data-reduced-motion={reducedMotion} role="group" aria-label="小镇新文章">
    <svg className="town-new-post-lines" width={frame.width} height={frame.height} viewBox={`0 0 ${frame.width} ${frame.height}`} aria-hidden="true">
      {notices.map((notice) => <g key={notice.postId}>
        <path d={notice.path} />
        <circle className={`town-new-post-anchor town-new-post-anchor-${notice.kind}`} cx={notice.x} cy={notice.y} r="2" />
        <circle className={`town-new-post-pulse town-new-post-pulse-${notice.kind}`} cx={notice.x} cy={notice.y} r="5" />
      </g>)}
    </svg>
    {notices.map((notice) => <button key={notice.postId} type="button" className={`town-new-post-label town-new-post-label-${notice.kind}`} data-post-id={notice.postId}
      style={{ left: notice.left, top: notice.top, width: notice.width, height: notice.height }}
      aria-label={notice.kind === 'guide' ? '建筑即文章，引导建筑阅读' : `新文章：${postMap.get(notice.postId)?.title ?? notice.postId}`} onClick={() => onOpen(notice.postId)}>
      {notice.kind === 'guide' ? <><strong>每栋建筑都是一篇文章</strong><span>点击建筑阅读</span></> : <><i className="town-new-post-dot" aria-hidden="true" /><span>新文章</span></>}
    </button>)}
  </div>;
}
