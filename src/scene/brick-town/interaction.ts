import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TownTarget } from './types';

export const targetKey = (target: TownTarget) => `${target.kind}:${target.id}`;

export type TownInteractiveBuilding = {
  targets: TownTarget[];
  x: number;
  z: number;
  focusY: number;
  anchorY: (target: TownTarget) => number;
  meshes: Mesh[];
};

export type TownInteractiveTarget = {
  target: TownTarget;
  building: TownInteractiveBuilding;
  meshes: Mesh[];
  glass: number;
  glassTarget: number;
};

export function targetVisualState(item: TownTarget, target?: TownTarget, matchingPostIds?: ReadonlySet<string>) {
  const direct = Boolean(target && targetKey(item) === targetKey(target));
  const matches = item.kind === 'post' && Boolean(matchingPostIds?.has(item.id));
  return { direct, matches, glass: Boolean(target || matchingPostIds) && !direct && !matches };
}

export function stepGlass(current: number, target: number, dt: number, reducedMotion: boolean) {
  if (reducedMotion) return target;
  const next = current + (target - current) * (1 - Math.exp(-dt / (target < current ? .085 : .055)));
  return Math.abs(next - target) < .004 ? target : next;
}
