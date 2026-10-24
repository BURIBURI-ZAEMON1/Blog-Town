import { useEffect, useMemo, useRef, useState } from 'react';
import { createTownLayout } from '../data/town-layout';
import { SEASON_PROFILES } from '../data/town-seasons';
import type { TownSceneProps } from '../scene/brick-town/types';
import type { mountBrickTown } from '../scene/brick-town/runtime';
import TownPostNotices from './TownPostNotices';
import type { PostNoticeFrame } from '../data/town-post-notices';
export type { TownPost, SceneAnchor } from '../scene/brick-town/types';

type TownSceneLifecycleProps = TownSceneProps & {
  onLoadingStart?: () => void;
  onFirstFrame?: (loadingMs: number) => void;
  onInitializationError?: () => void;
};

export default function TownScene(props: TownSceneLifecycleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<ReturnType<typeof mountBrickTown> | undefined>(undefined);
  const latest = useRef(props); latest.current = props;
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [noticeFrame, setNoticeFrame] = useState<PostNoticeFrame>();
  const fallback = useMemo(() => props.layout ?? createTownLayout('river-bend-demo-v2', props.posts), [props.layout, props.posts]);
  useEffect(() => {
    let cancelled = false;
    const loadingStartedAt = performance.now();
    const canvas = canvasRef.current; if (!canvas) return;
    setError(false); setReady(false); setNoticeFrame(undefined);
    latest.current.onLoadingStart?.();
    import('../scene/brick-town/runtime').then(({ mountBrickTown }) => {
      if (cancelled) return;
      runtimeRef.current = mountBrickTown(canvas, fallback, latest.current.posts, latest.current, () => ({ ...latest.current, onResolveNewPostAnchors: setNoticeFrame }), () => {
        if (cancelled) return;
        const loadingMs = Math.round(performance.now() - loadingStartedAt);
        canvas.dataset.loadingMs = String(loadingMs);
        setReady(true);
        latest.current.onFirstFrame?.(loadingMs);
      });
    }).catch((initializationError) => { if (!cancelled) { console.error('Brick town initialization failed', initializationError); setError(true); latest.current.onInitializationError?.(); } });
    return () => { cancelled = true; runtimeRef.current?.dispose(); runtimeRef.current = undefined; };
  }, [fallback, props.posts]);
  useEffect(() => { runtimeRef.current?.update(props); }, [props.season, props.colorMode, props.reducedMotion, props.hoveredPostId, props.activePostId, props.newPostIds, props.guidePostId, props.query, props.category, props.tag, ready]);
  return <div className="town-canvas-host brick-town-host" data-testid="town-canvas">
    <canvas ref={canvasRef} aria-label={`${SEASON_PROFILES[props.season].label}季积木小镇：桌面使用鼠标滚轮缩放，手机双指捏合缩放；点击建筑阅读文章；拖动移动地图`} />
    {ready && noticeFrame && <TownPostNotices posts={props.posts} newPostIds={props.newPostIds} frame={noticeFrame} reducedMotion={props.reducedMotion} onOpen={(id) => { latest.current.onTownExplored?.(); latest.current.onSelectPost(id); }} />}
    {error && <div className="brick-loading" role="status">当前设备无法绘制小镇，请通过顶部档案入口阅读。</div>}
  </div>;
}
