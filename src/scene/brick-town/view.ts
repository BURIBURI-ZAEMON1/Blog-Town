import { createPrecipitationField } from '../../data/town-weather';
import type { TownCameraPose } from './types';

export type BoardBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type PanBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export type RainDrop = { x: number; z: number; y: number; speed: number };

export const ARTICLE_FOCUS_MS = 760;
export const ARTICLE_FOCUS_ZOOM = 2.35;
const easeFocus = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));

export function getArticleFocusPose(from: TownCameraPose, to: Omit<TownCameraPose, 'zoom'>, elapsedMs: number): TownCameraPose {
  const t = Math.max(0, Math.min(1, elapsedMs / ARTICLE_FOCUS_MS));
  const endZoom = Math.max(from.zoom, ARTICLE_FOCUS_ZOOM);
  if (t === 0) return { ...from };
  if (t === 1) return { x: to.x, y: to.y, z: to.z, zoom: endZoom };
  const progress = easeFocus(t);
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const closeView = Math.max(0, Math.min(1, (from.zoom - 1.5) / .85));
  const startSpan = 1 / from.zoom, endSpan = 1 / endZoom;
  const travelSpan = Math.min(1 / .95, startSpan + Math.max(0, distance - 8) * .014 * closeView);
  const span = t < .32
    ? startSpan + (travelSpan - startSpan) * easeFocus(t / .32)
    : travelSpan + (endSpan - travelSpan) * easeFocus((t - .32) / .68);
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    z: from.z + (to.z - from.z) * progress,
    zoom: 1 / (travelSpan > startSpan ? span : startSpan + (endSpan - startSpan) * progress ** 1.35),
  };
}

export const createRainField = (
  random: () => number,
  count: number,
  board: BoardBounds,
  margin = 1.8,
): RainDrop[] => createPrecipitationField(random, count, board, 'rain', margin);

export const getCameraPanBounds = (
  board: BoardBounds,
  _alpha: number,
  _beta: number,
  _orthoWidth: number,
  _orthoHeight: number,
  edgeReveal = 6.5,
): PanBounds => {
  // In an orthographic diorama the target is a navigation point, not the
  // visible rectangle. The old clamp stopped at the town core; this keeps a
  // small safety inset from the raised board wall while still making every
  // outer district reachable at close zoom.
  const inset = Math.min(edgeReveal, (board.maxX - board.minX) * 0.18, (board.maxZ - board.minZ) * 0.18);
  return {
    minX: board.minX + inset,
    maxX: board.maxX - inset,
    minZ: board.minZ + inset,
    maxZ: board.maxZ - inset,
  };
};

export const clampToPanBounds = (point: { x: number; z: number }, bounds: PanBounds) => ({
  x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
  z: Math.max(bounds.minZ, Math.min(bounds.maxZ, point.z)),
});

export const getDragPanDelta = (
  alpha: number,
  beta: number,
  deltaX: number,
  deltaY: number,
  worldUnitsPerPixel: number,
) => {
  // Camera-style panning: dragging toward a screen edge moves the viewed area
  // toward that edge. This is the inverse of the old "grab the map" motion.
  const horizontal = deltaX * worldUnitsPerPixel;
  const vertical = -deltaY * worldUnitsPerPixel / Math.max(0.001, Math.cos(beta));
  return {
    x: Math.sin(alpha) * horizontal + Math.cos(alpha) * vertical,
    z: -Math.cos(alpha) * horizontal + Math.sin(alpha) * vertical,
  };
};
