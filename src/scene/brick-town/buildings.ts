import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { TownBuildingStyle, TownPlot } from '../../data/town-layout';
import { BrickKit, COLORS as C, COURSE as H, STUD as S } from './kit';

export const FLOOR_HEIGHT = H * 7;
export const GROUND_Y = 0.10;

type BuildingPalette = { wall: string; trim: string; roof: string; accent: string };

const palettes: Record<TownBuildingStyle, BuildingPalette> = {
  cottage: { wall: C.cream, trim: C.ivory, roof: C.red, accent: C.darkRed },
  townhouse: { wall: '#d4a75d', trim: C.ivory, roof: C.navy, accent: C.blue },
  stonehouse: { wall: '#a6b8a4', trim: C.ivory, roof: C.coral, accent: C.darkRed },
  villa: { wall: '#e0c08e', trim: C.ivory, roof: C.teal, accent: C.navy },
  rowhouse: { wall: '#d8a37d', trim: C.cream, roof: C.blue, accent: C.red },
  workshop: { wall: '#9d9a8a', trim: C.cream, roof: C.dark, accent: C.yellow },
  shop: { wall: '#e2b36f', trim: C.ivory, roof: C.red, accent: C.blue },
  forge: { wall: '#888c86', trim: C.sand, roof: C.dark, accent: C.coral },
  inn: { wall: '#d99d66', trim: C.ivory, roof: C.navy, accent: C.yellow },
  watchtower: { wall: '#9ba99b', trim: C.ivory, roof: C.navy, accent: C.coral },
  chapel: { wall: '#e8d9b8', trim: C.ivory, roof: C.coral, accent: C.yellow },
  windmill: { wall: '#c79865', trim: C.cream, roof: C.red, accent: C.ivory },
  clocktower: { wall: '#858f8d', trim: C.ivory, roof: C.navy, accent: C.yellow },
};

const addFrontSign = (kit: BrickKit, id: string, z: number, y: number, color: string, width = S * 1.3) => {
  kit.box(0, y, z, width, H * 1.15, 0.05, color, 0, id);
  kit.box(0, y + H * 0.1, z + 0.035, width * 0.62, 0.035, 0.02, C.ivory, 0, id);
};

const addSpecialDetails = (kit: BrickKit, style: TownBuildingStyle, id: string, w: number, d: number, roofBase: number, palette: BuildingPalette) => {
  const front = d / 2 - 0.055;
  const back = -d / 2 + 0.08;
  const featureY = roofBase + H * 1.45;

  switch (style) {
    case 'shop':
      addFrontSign(kit, id, front, roofBase - H * 0.15, palette.accent, S * 1.55);
      kit.box(0, roofBase - H * 0.6, front - 0.01, w * 0.78, 0.10, 0.18, palette.roof, 0, id);
      for (const x of [-w * 0.30, 0, w * 0.30]) kit.brick(x, H / 3, front - 0.04, 1, 1, x === 0 ? C.yellow : C.coral, H / 3, true, id);
      break;
    case 'forge':
      // A dark chimney, furnace mouth and orange coal bed make this read as a
      // workshop rather than another generic gabled house.
      for (let level = 0; level < 4; level++) kit.brick(-w * 0.28, roofBase + level * H * 0.82, back + 0.16, 1, 1, C.dark, H, false, id);
      kit.box(w * 0.23, H * 0.78, front, S * 1.05, H * 1.05, 0.08, C.dark, 0, id);
      kit.box(w * 0.23, H * 0.82, front - 0.01, S * 0.52, H * 0.50, 0.035, C.coral, 0, id);
      kit.cylinder(w * 0.23, H * 1.20, front - 0.01, 0.12, 0.07, C.yellow, id);
      kit.box(-w * 0.18, H * 0.28, front - 0.04, S * 1.2, 0.12, S * 0.58, C.brown, 0, id);
      break;
    case 'inn':
      addFrontSign(kit, id, front, featureY, palette.accent, S * 1.65);
      kit.box(0, roofBase - H * 0.15, front - 0.01, w * 0.72, 0.08, 0.42, C.brown, 0, id);
      for (const x of [-w * 0.34, w * 0.34]) kit.box(x, roofBase - H * 0.05, front - 0.02, 0.07, H * 1.15, 0.08, C.ivory, 0, id);
      for (const x of [-w * 0.42, -w * 0.14, w * 0.14, w * 0.42]) kit.cylinder(x, roofBase - H * 0.35, front + 0.09, 0.10, 0.12, C.leaf, id);
      break;
    case 'watchtower':
      for (const x of [-w * 0.34, w * 0.34]) for (const z of [front - 0.05, back]) kit.brick(x, roofBase, z, 1, 1, palette.accent, H, true, id);
      for (const x of [-w * 0.38, w * 0.38]) kit.box(x, featureY, front, 0.18, H * 0.9, 0.18, palette.trim, 0, id);
      kit.box(0, roofBase + H * 0.76, back, 0.06, H * 2.8, 0.06, C.brown, 0, id);
      kit.brick(0, roofBase + H * 2.25, back, 1, 1, C.red, H, true, id);
      break;
    case 'chapel':
      kit.box(0, featureY, front, 0.10, H * 2.4, 0.06, palette.accent, 0, id);
      kit.box(0, featureY + H * 0.42, front, S * 0.95, 0.10, 0.06, palette.accent, 0, id);
      kit.cylinder(0, roofBase + H * 0.7, front + 0.06, S * 0.78, 0.05, C.blue, id);
      for (const x of [-w * 0.37, w * 0.37]) kit.brick(x, roofBase + H * 0.12, back, 1, 1, palette.trim, H, true, id);
      break;
    case 'windmill':
      kit.box(0, featureY, back, 0.10, H * 2.5, 0.10, C.brown, 0, id);
      kit.cylinder(0, featureY + H * 0.18, back - 0.08, 0.22, 0.10, C.ivory, id);
      // The four contrasting vanes are kept inside the plot envelope.
      kit.box(0, featureY + H * 0.18, back + 0.08, 0.07, 0.08, d * 0.18, palette.accent, 0, id);
      kit.box(0, featureY + H * 0.18, back + 0.04, w * 0.34, 0.08, 0.07, palette.accent, 0, id);
      kit.box(0, featureY + H * 0.18, back + 0.08, 0.04, 0.06, d * 0.16, C.ivory, 0, id);
      kit.box(0, featureY + H * 0.18, back + 0.05, w * 0.25, 0.06, 0.04, C.ivory, 0, id);
      break;
    case 'clocktower':
      kit.box(0, featureY, front, S * 1.25, H * 1.1, 0.06, C.navy, 0, id);
      kit.box(0, featureY, front + 0.04, S * 0.86, H * 0.76, 0.025, C.yellow, 0, id);
      kit.box(0, featureY, front + 0.065, 0.035, H * 0.52, 0.025, C.dark, 0, id);
      kit.box(0, featureY, front + 0.065, H * 1.1, 0.035, 0.025, C.dark, 0, id);
      for (const x of [-w * 0.38, w * 0.38]) kit.brick(x, roofBase + H * 0.3, back, 1, 1, palette.trim, H, true, id);
      kit.brick(0, roofBase + H * 1.8, back + 0.16, 1, 1, palette.roof, H, true, id);
      break;
    case 'townhouse':
      break;
    case 'stonehouse':
      for (const x of [-w * 0.40, w * 0.40]) for (const z of [front, back]) kit.box(x, roofBase / 2, z, 0.08, roofBase * 0.72, 0.08, palette.trim, 0, id);
      break;
    case 'villa':
      kit.box(0, roofBase - H * 0.15, front + 0.02, w * 0.70, 0.08, 0.16, C.brown, 0, id);
      for (const x of [-w * 0.30, 0, w * 0.30]) kit.box(x, roofBase - H * 0.05, front - 0.02, 0.07, H * 1.0, 0.07, palette.trim, 0, id);
      break;
    case 'rowhouse':
      for (const x of [-w * 0.34, w * 0.34]) kit.brick(x, roofBase, front - 0.10, 1, 1, palette.accent, H, true, id);
      break;
    case 'workshop':
      for (let level = 0; level < 3; level++) kit.brick(w * 0.28, roofBase + level * H * 0.7, back + 0.16, 1, 1, C.dark, H, false, id);
      kit.box(-w * 0.24, H * 0.85, front + 0.06, S * 1.25, H * 1.2, 0.05, palette.accent, 0, id);
      break;
    case 'cottage':
    default:
      break;
  }
};

export function buildHouse(scene: Scene, plot: TownPlot) {
  const root = new TransformNode(`house:${plot.id}`, scene);
  root.position.set(plot.x, GROUND_Y, plot.z);
  const kit = new BrickKit(scene, root);
  const ids = plot.seriesPostIds ?? [plot.postId!];
  const style = palettes[plot.style ?? 'cottage'];
  // Six by five studs. Footprint is exactly the layout footprint, no root scaling.
  const nx = Math.round(plot.width / S), nz = Math.round(plot.depth / S);
  const w = nx * S, d = nz * S;
  kit.brick(0, 0, 0, nx, nz, C.roadLight, H / 3, false, ids[0]);
  ids.forEach((id, floor) => {
    const base = H / 3 + floor * FLOOR_HEIGHT;
    for (let course = 0; course < 7; course++) {
      const y = base + course * H;
      // Each wall is individually moulded bricks with alternating mortar joints.
      for (const side of [-1, 1]) {
        for (let col = 0; col < nx; col++) {
          const x = (col - (nx - 1) / 2) * S;
          const isWindow = (col === 1 || col === nx - 2) && course >= 3 && course <= 5;
          const isDoor = side === 1 && (col === 2 || col === 3) && course <= 3;
          if (!isWindow && !isDoor) kit.brick(x, y, side * (d - S) / 2, 1, 1, course === 0 ? C.sand : style.wall, H, course === 6, id);
        }
        for (let row = 1; row < nz - 1; row++) {
          const isWindow = row === 2 && course >= 3 && course <= 5;
          if (!isWindow) kit.brick(side * (w - S) / 2, y, (row - (nz - 1) / 2) * S, 1, 1, course === 0 ? C.sand : style.wall, H, course === 6, id);
        }
      }
      if (course === 0 || course === 6) kit.box(0, y + H * 0.78, d / 2 - 0.02, w, H * 0.18, 0.06, style.trim, 0, id);
    }
    // Inset panes + raised sills + separate mullions on all visible facades.
    for (const facade of [-1, 1]) for (const side of [-1, 1]) {
      const x = side * (nx - 3) * S / 2, z = facade * (d / 2 - 0.06), wy = base + H * 4.5;
      kit.box(x, wy, z, S * 0.9, H * 2.9, 0.045, '#5e97a4', 0, id, true);
      for (const edge of [-1, 1]) kit.box(x + edge * S * 0.48, wy, z + facade * 0.055, 0.045, H * 3.2, 0.07, C.ivory, 0, id);
      for (const edge of [-1, 0, 1]) kit.box(x, wy + edge * H * 1.5, z + facade * 0.055, S * 1.08, 0.042, 0.07, C.ivory, 0, id);
      kit.box(x, wy, z + facade * 0.06, 0.025, H * 3, 0.07, C.ivory, 0, id);
      kit.box(x, base + H * 2.82, z + facade * 0.08, S * 1.3, 0.07, 0.16, C.sand, 0, id);
      if (facade === 1) {
        kit.box(x, base + H * 2.4, d / 2 - 0.04, S * 1.2, 0.12, 0.14, C.brown, 0, id);
        for (const off of [-0.1, 0, 0.1]) {
          kit.cylinder(x + off, base + H * 2.7, d / 2 - 0.04, 0.11, 0.1, C.leaf, id);
          kit.cylinder(x + off, base + H * 2.96, d / 2 - 0.04, 0.085, 0.06, side === 1 ? C.yellow : C.coral, id);
        }
      }
    }
    for (const side of [-1, 1]) {
      const wy = base + H * 4.5, x = side * (w / 2 - 0.07);
      kit.box(x, wy, 0, 0.06, H * 2.9, S * 0.88, '#5e97a4', 0, id, true);
      for (const t of [-1, 1]) kit.box(x + side * 0.045, wy, t * S * 0.48, 0.07, H * 3.2, 0.035, C.ivory, 0, id);
      for (const t of [-1, 0, 1]) kit.box(x + side * 0.045, wy + t * H * 1.5, 0, 0.07, 0.035, S, C.ivory, 0, id);
    }
    const dy = base + H * 2;
    kit.box(0, dy, d / 2 - 0.07, S * 1.82, H * 3.8, 0.08, style.accent, 0, id);
    kit.box(0, dy + H * 0.7, d / 2 - 0.018, S * 1.25, H * 1.5, 0.035, '#74a8ac', 0, id, true);
    kit.cylinder(S * 0.55, dy - H * 0.4, d / 2 - 0.005, 0.055, 0.05, C.yellow, id);
    for (let col = 0; col < 4; col++) kit.box((col - 1.5) * S * 0.5, base + H * 4.1, d / 2 - 0.04, S * 0.5 - 0.012, 0.10, 0.28, col % 2 ? C.ivory : style.roof, 0, id);
  });
  const roofBase = H / 3 + ids.length * FLOOR_HEIGHT;
  const topId = ids.at(-1)!;
  if (plot.roof === 'flat') {
    kit.brick(0, roofBase, 0, nx, nz, style.roof, H * 1.1, true, topId);
    for (const x of [-w / 2 + S / 2, w / 2 - S / 2]) for (const z of [-d / 2 + S / 2, d / 2 - S / 2]) kit.brick(x, roofBase + H * 1.1, z, 1, 1, style.trim, H, true, topId);
  } else {
    // Gable and hip roofs use different silhouettes while keeping all bricks
    // within the reserved plot envelope.
    const levels = Math.max(1, Math.ceil(Math.max(nx, nz) / 2));
    for (let level = 0; level < levels; level++) {
      const rw = plot.roof === 'hip' ? Math.max(1, nx - level * 2) : Math.max(1, nx - level * 2);
      const rd = plot.roof === 'hip' ? Math.max(1, nz - level * 2) : nz;
      for (let col = 0; col < rw; col++) for (let row = 0; row < rd; row++) {
        kit.brick((col - (rw - 1) / 2) * S, roofBase + level * H * 1.1, (row - (rd - 1) / 2) * S, 1, 1, (row + col) % 5 === 0 ? style.accent : style.roof, H * 1.1, true, topId);
      }
    }
  }
  for (let i = 0; i < 4; i++) kit.brick(w * 0.25, roofBase + i * H, -d * 0.25, 1, 1, C.sand, H, i === 3, topId);
  kit.brick(w * 0.25, roofBase + H * 4, -d * 0.25, 1, 1, C.ivory, H / 3, false, topId);
  addSpecialDetails(kit, plot.style ?? 'cottage', topId, w, d, roofBase, style);
  const meshes = kit.flush(`house:${plot.id}`);
  return { root, meshes, plot, ids, roofY: roofBase + H * 4 };
}
