import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

/** Exposed horizontal surface in parent-local coordinates; world coordinates without a parent. */
export type SnowSurface = {
  x: number; y: number; z: number;
  width: number; depth: number;
  yaw?: number;
  parent?: TransformNode;
  postId?: string;
};

export class SnowSurfaces {
  readonly items: SnowSurface[] = [];
  private columns = new Map<string, number>();
  add(surface: SnowSurface) { this.items.push(surface); }
  column(surface: SnowSurface) {
    const key = `${surface.x.toFixed(4)}:${surface.z.toFixed(4)}`;
    const index = this.columns.get(key);
    if (index === undefined) { this.columns.set(key, this.items.length); this.add(surface); }
    else if (surface.y > this.items[index].y) this.items[index] = surface;
  }
}
