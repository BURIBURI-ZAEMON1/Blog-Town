export const ENTRY_STEP_MS = 620;
export const ENTRY_OPEN_MS = 1060;
export const ENTRY_CROSS_START_MS = 300;
export const ENTRY_CROSS_MS = 1140;
export const ENTRY_END_MS = ENTRY_CROSS_START_MS + ENTRY_CROSS_MS;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

export function getEntryDoorPose(ageMs: number) {
  const opening = smooth(clamp(ageMs / ENTRY_OPEN_MS));
  return {
    scale: .42 * Math.exp(ageMs / 1700),
    angle: -104 * opening,
    opacity: 1 - smooth(clamp((ageMs - 2600) / 650)),
  };
}

export function getEntryCamera(ageMs: number, coverScale: number) {
  const progress = smooth(clamp((ageMs - ENTRY_CROSS_START_MS) / ENTRY_CROSS_MS));
  return Math.exp(Math.log(Math.max(1, coverScale / getEntryDoorPose(ENTRY_END_MS).scale)) * progress);
}
