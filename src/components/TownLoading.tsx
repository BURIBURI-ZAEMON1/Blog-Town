import { useEffect, useState } from 'react';
import { getTownLoadingProfile, TOWN_LOADING_THRESHOLDS } from '../scene/brick-town/loading';

export default function TownLoading({ ready = false, reducedMotion = false }: { ready?: boolean; reducedMotion?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (ready) return;
    setElapsed(0);
    const timers = [
      TOWN_LOADING_THRESHOLDS.reveal,
      TOWN_LOADING_THRESHOLDS.label,
      TOWN_LOADING_THRESHOLDS.patient,
    ].map((delay) => window.setTimeout(() => setElapsed(delay), delay));
    return () => timers.forEach(window.clearTimeout);
  }, [ready]);

  if (ready) return null;

  return <div
    className="brick-town-loader"
    data-phase={getTownLoadingProfile(elapsed).phase}
    data-reduced-motion={reducedMotion ? 'true' : 'false'}
    role="status"
    aria-label="正在载入小镇"
  >
    <div className="brick-loader-content">
      <div className="brick-loader-mark" aria-hidden="true"><i /><i /><i /></div>
      <span>小镇即将浮现</span>
    </div>
  </div>;
}
