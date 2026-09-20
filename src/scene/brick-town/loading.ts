export type TownLoadingPhase = 'quiet' | 'quick' | 'steady' | 'patient';

export type TownLoadingProfile = {
  phase: TownLoadingPhase;
  cycleMs: number;
  staggerMs: number;
};

export const TOWN_LOADING_THRESHOLDS = {
  reveal: 90,
  label: 460,
  patient: 1200,
} as const;

export const getTownLoadingProfile = (elapsedMs: number): TownLoadingProfile => {
  if (elapsedMs < TOWN_LOADING_THRESHOLDS.reveal) {
    return { phase: 'quiet', cycleMs: 360, staggerMs: 10 };
  }
  if (elapsedMs < TOWN_LOADING_THRESHOLDS.label) {
    return { phase: 'quick', cycleMs: 460, staggerMs: 13 };
  }
  if (elapsedMs < TOWN_LOADING_THRESHOLDS.patient) {
    return { phase: 'steady', cycleMs: 760, staggerMs: 22 };
  }
  return { phase: 'patient', cycleMs: 1120, staggerMs: 32 };
};
