import { useEffect, useState, type CSSProperties } from 'react';
import { getTownLoadingProfile, TOWN_LOADING_THRESHOLDS } from '../scene/brick-town/loading';

type LoaderBrick = {
  x: number;
  y: number;
  tone: 'grass' | 'water' | 'path' | 'red' | 'yellow' | 'cream';
};

const loaderBricks: LoaderBrick[] = [
  { x: 0, y: 0, tone: 'grass' }, { x: 1, y: 0, tone: 'grass' }, { x: 2, y: 0, tone: 'water' }, { x: 3, y: 0, tone: 'cream' }, { x: 4, y: 0, tone: 'grass' },
  { x: 0, y: 1, tone: 'grass' }, { x: 1, y: 1, tone: 'path' }, { x: 2, y: 1, tone: 'water' }, { x: 3, y: 1, tone: 'red' }, { x: 4, y: 1, tone: 'grass' },
  { x: 0, y: 2, tone: 'cream' }, { x: 1, y: 2, tone: 'path' }, { x: 2, y: 2, tone: 'water' }, { x: 3, y: 2, tone: 'yellow' }, { x: 4, y: 2, tone: 'grass' },
  { x: 0, y: 3, tone: 'grass' }, { x: 1, y: 3, tone: 'path' }, { x: 2, y: 3, tone: 'water' }, { x: 3, y: 3, tone: 'grass' }, { x: 4, y: 3, tone: 'grass' },
];

const orderedBricks = loaderBricks
  .map((brick, index) => ({ ...brick, index, distance: Math.hypot(brick.x - 2, brick.y - 1.5) }))
  .sort((a, b) => a.distance - b.distance);

export default function TownLoading({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timers = [
      TOWN_LOADING_THRESHOLDS.reveal,
      TOWN_LOADING_THRESHOLDS.label,
      TOWN_LOADING_THRESHOLDS.patient,
    ].map((delay) => window.setTimeout(() => setElapsed(delay), delay));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const profile = getTownLoadingProfile(elapsed);
  const style = {
    '--loader-cycle': `${profile.cycleMs}ms`,
    '--loader-stagger': `${profile.staggerMs}ms`,
  } as CSSProperties;

  return <div
    className="brick-town-loader"
    data-phase={profile.phase}
    data-reduced-motion={reducedMotion ? 'true' : 'false'}
    style={style}
    role="status"
    aria-label="正在拼合积木小镇"
  >
    <div className="brick-loader-content">
      <div className="brick-loader-board" aria-hidden="true">
        {orderedBricks.map((brick, order) => <i
          key={brick.index}
          className={`brick-loader-piece is-${brick.tone}`}
          style={{ '--column': brick.x, '--row': brick.y, '--order': order } as CSSProperties}
        />)}
      </div>
      <span>正在拼合小镇</span>
    </div>
  </div>;
}
