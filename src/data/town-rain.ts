import { createPrecipitationField, weatherIsPrecipitating, PRECIPITATION_PROBABILITY } from './town-weather';
export { createPrecipitationField, weatherIsPrecipitating };
export const RAIN_PROBABILITY = PRECIPITATION_PROBABILITY;
export const RAIN_BOTTOM = 0.08;
export const RAIN_SPAN = 21;
export const RAIN_WIND_X = 0.7;
export const RAIN_WIND_Z = 0.18;

export const weatherIsRainy = weatherIsPrecipitating;

const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

export const rainYAtTime = (topY: number, phase: number, speed: number, elapsed: number) =>
  positiveModulo(topY - elapsed * speed + phase * RAIN_SPAN - RAIN_BOTTOM, RAIN_SPAN) + RAIN_BOTTOM;

export const rainXAtTime = (x: number, elapsed: number) => positiveModulo(x + elapsed * RAIN_WIND_X + 34, 68) - 34;
export const rainZAtTime = (z: number, elapsed: number) => positiveModulo(z + elapsed * RAIN_WIND_Z + 30, 64) - 30;
