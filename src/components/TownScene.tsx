import { useEffect, useMemo, useRef, useState } from 'react';
import { createTownLayout } from '../data/town-layout';
import type { TownSceneProps } from '../scene/brick-town/types';
import type { mountBrickTown } from '../scene/brick-town/runtime';
import TownZoomOrb from './TownZoomOrb';
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
  const [zoom, setZoom] = useState(1.9);
  const fallback = useMemo(() => props.layout ?? createTownLayout('river-bend-demo-v2', props.posts), [props.layout, props.posts]);
  useEffect(() => {
    let cancelled = false;
    const loadingStartedAt = performance.now();
    const canvas = canvasRef.current; if (!canvas) return;
    setError(false); setReady(false);
    latest.current.onLoadingStart?.();
    import('../scene/brick-town/runtime').then(({ mountBrickTown }) => {
      if (cancelled) return;
      runtimeRef.current = mountBrickTown(canvas, fallback, latest.current.posts, latest.current, () => latest.current, () => {
        if (cancelled) return;
        const loadingMs = Math.round(performance.now() - loadingStartedAt);
        canvas.dataset.loadingMs = String(loadingMs);
        setReady(true);
        latest.current.onFirstFrame?.(loadingMs);
      }, (nextZoom) => setZoom(nextZoom));
    }).catch((initializationError) => { if (!cancelled) { console.error('Brick town initialization failed', initializationError); setError(true); latest.current.onInitializationError?.(); } });
    return () => { cancelled = true; runtimeRef.current?.dispose(); runtimeRef.current = undefined; };
  }, [fallback, props.posts]);
  useEffect(() => { runtimeRef.current?.update(props); }, [props.colorMode, props.reducedMotion, props.hoveredPostId, props.activePostId, props.query, props.category, props.tag, ready]);
  return <div className="town-canvas-host brick-town-host" data-testid="town-canvas">
    <canvas ref={canvasRef} aria-label="积木小镇：桌面滚轮或手机双指捏合缩放；触屏点击建筑预览，再次点击阅读；拖动移动地图" />
    {error && <div className="brick-loading" role="status">当前设备无法绘制小镇，请通过下方文章列表阅读。</div>}
    <TownZoomOrb zoom={zoom} minZoom={0.75} maxZoom={2.6} onZoom={(amount) => runtimeRef.current?.zoom(amount)} onReset={() => runtimeRef.current?.home()} />
  </div>;
}
