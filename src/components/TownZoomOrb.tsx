import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

type Props = {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoom: (amount: number) => void;
  onReset: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const SCALE_TICKS = Array.from({ length: 13 }, (_, index) => index);
const TICK_STYLES = SCALE_TICKS.map((index) => ({ '--tick-index': index }) as CSSProperties);

export default function TownZoomOrb({ zoom, minZoom, maxZoom, onZoom, onReset }: Props) {
  const controlRef = useRef<HTMLDivElement>(null);
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  const progress = clamp((zoom - minZoom) / (maxZoom - minZoom), 0, 1);
  useEffect(() => {
    const control = controlRef.current;
    if (!control) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onZoomRef.current(-event.deltaY * 0.0015);
    };
    control.addEventListener('wheel', onWheel, { passive: false });
    return () => control.removeEventListener('wheel', onWheel);
  }, []);

  return <div
    ref={controlRef}
    className="town-zoom-control"
    role="slider"
    tabIndex={0}
    aria-label="小镇视角缩放"
    aria-valuemin={minZoom}
    aria-valuemax={maxZoom}
    aria-valuenow={Number(zoom.toFixed(2))}
    aria-valuetext={`${zoom.toFixed(2)} 倍`}
    title="在这里滚动鼠标滚轮缩放小镇"
    onKeyDown={(event) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        event.preventDefault();
        onZoom(0.08);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        event.preventDefault();
        onZoom(-0.08);
      } else if (event.key === 'Home') {
        event.preventDefault();
        onReset();
      }
    }}
  >
    <div className="town-zoom-control-readout" aria-live="off">
      <span>ZOOM</span>
      <output>{Math.round(progress * 100)}%</output>
    </div>
    <div className="town-zoom-lens" style={{ '--zoom-progress': progress } as CSSProperties}>
      <span className="town-zoom-end town-zoom-in" aria-hidden="true">+</span>
      <div className="town-zoom-scale" aria-hidden="true">
        {TICK_STYLES.map((style, index) => <i key={index} className={index / (SCALE_TICKS.length - 1) <= progress ? 'is-active' : ''} style={style} />)}
        <span className="town-zoom-scale-pointer" />
      </div>
      <button className="town-zoom-reset" type="button" aria-label="恢复默认视角" title="恢复默认视角" onClick={onReset}>
        <span className="town-zoom-glass" aria-hidden="true">
          <span className="town-zoom-townmark">
            <i /><i /><i />
          </span>
          <span className="town-zoom-glass-glint" />
        </span>
      </button>
      <span className="town-zoom-end town-zoom-out" aria-hidden="true">−</span>
      <span className="visually-hidden">滚轮缩放；当前缩放 {Math.round(progress * 100)}%</span>
    </div>
  </div>;
}
