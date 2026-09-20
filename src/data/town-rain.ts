export const RAIN_BOTTOM = 0.08;
export const RAIN_SPAN = 21;
export const RAIN_WIND_X = 0.7;
export const RAIN_WIND_Z = 0.18;
export const RAIN_PROBABILITY = 0.3;

const hash = (value: string) => [...value].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);

export const weatherIsRainy = (seed: string, slot: number) => {
  let state = hash(`${seed}:weather:${slot}`);
  state = (1664525 * state + 1013904223) >>> 0;
  return state / 4294967296 < RAIN_PROBABILITY;
};

const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

export const rainYAtTime = (topY: number, phase: number, speed: number, elapsed: number) =>
  positiveModulo(topY - elapsed * speed + phase * RAIN_SPAN - RAIN_BOTTOM, RAIN_SPAN) + RAIN_BOTTOM;

export const rainXAtTime = (x: number, elapsed: number) => positiveModulo(x + elapsed * RAIN_WIND_X + 34, 68) - 34;
export const rainZAtTime = (z: number, elapsed: number) => positiveModulo(z + elapsed * RAIN_WIND_Z + 30, 64) - 30;
