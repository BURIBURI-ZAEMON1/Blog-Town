export type Precipitation = 'rain' | 'snow';
export type WeatherDrop = { x: number; z: number; y: number; speed: number };

export const PRECIPITATION_PROBABILITY = 0.3;
const hash = (value: string) => [...value].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);

export const weatherIsPrecipitating = (seed: string, slot: number) => {
  let state = hash(`${seed}:weather:${slot}`);
  // Avalanche adjacent slots too: a single LCG step over a string hash can
  // otherwise produce long correlated runs for a site's particular seed.
  state = Math.imul(state ^ (state >>> 16), 0x7feb352d);
  state = Math.imul(state ^ (state >>> 15), 0x846ca68b);
  state = (state ^ (state >>> 16)) >>> 0;
  return state / 4294967296 < PRECIPITATION_PROBABILITY;
};

export const createPrecipitationField = (random: () => number, count: number, board: { minX: number; maxX: number; minZ: number; maxZ: number }, kind: Precipitation, margin = 1.8): WeatherDrop[] => {
  const minX = board.minX - margin, maxX = board.maxX + margin, minZ = board.minZ - margin, maxZ = board.maxZ + margin;
  return Array.from({ length: count }, () => ({
    x: minX + random() * (maxX - minX), z: minZ + random() * (maxZ - minZ), y: 1 + random() * 13,
    speed: kind === 'snow' ? 1.6 + random() * 1.8 : 6 + random() * 4,
  }));
};

