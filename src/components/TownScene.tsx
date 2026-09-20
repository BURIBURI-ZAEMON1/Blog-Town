import { useEffect, useMemo, useRef, useState } from 'react';
import { createTownLayout } from '../data/town-layout';
import type { TownSceneProps } from '../scene/brick-town/types';
import type { mountBrickTown } from '../scene/brick-town/runtime';
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
      });
    }).catch((initializationError) => { if (!cancelled) { console.error('Brick town initialization failed', initializationError); setError(true); latest.current.onInitializationError?.(); } });
    return () => { cancelled = true; runtimeRef.current?.dispose(); runtimeRef.current = undefined; };
  }, [fallback, props.posts]);
  useEffect(() => { runtimeRef.current?.update(props); }, [props.colorMode, props.reducedMotion, props.hoveredPostId, props.activePostId, props.query, props.category, props.tag, ready]);
  return <div className="town-canvas-host brick-town-host" data-testid="town-canvas">
    <canvas ref={canvasRef} aria-label="积木小镇：点击建筑或楼层阅读文章" />
    {error && <div className="brick-loading" role="status">当前设备无法绘制小镇，请通过下方文章列表阅读。</div>}
    <div className="brick-controls" role="group" aria-label="小镇视野">
      <button onClick={() => runtimeRef.current?.zoom(-0.15)} aria-label="缩小小镇">−</button>
      <button onClick={() => runtimeRef.current?.home()} aria-label="恢复全景">⌂</button>
      <button onClick={() => runtimeRef.current?.zoom(0.15)} aria-label="放大小镇">+</button>
    </div>
  </div>;
}
