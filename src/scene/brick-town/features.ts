import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { TownDiaryBoard, TownDiaryMonthMarker, TownFeature, TownFriendHut } from '../../data/town-layout';
import { BrickKit, COLORS as C, COURSE as H, STUD as S } from './kit';
import { FLOOR_HEIGHT, GROUND_Y } from './buildings';

/**
 * The About landmark: a slender civic windmill tower. The silhouette follows a
 * lighthouse-like stepped profile (broad plinth, segmented shaft, pinched
 * waist, flared lantern room) while the four oversized sails stay mounted on
 * the front of the lantern so the windmill reads instantly from the diorama
 * camera.
 */
const SHAFT_WIDTHS = [5, 4, 4, 3, 3, 2, 3] as const;
const RING_FLOORS = new Set([1, 3, 5]);
const LANTERN_WIDTH = 4;

export function buildFeature(scene: Scene, feature: TownFeature, mobile = false) {
  return buildWindmill(scene, feature, mobile);
}

/**
 * The diary landmark: a small civic notice board. It reuses the town's palette
 * (pine posts, cream card, coral pins) so it reads as street furniture rather
 * than a second windmill, and its pinned notes glow at night like the lamps.
 */
export function buildDiaryBoard(scene: Scene, board: TownDiaryBoard, mobile = false) {
  const root = new TransformNode(`diary-board:${board.id}`, scene);
  root.position.set(board.x, GROUND_Y, board.z);
  root.rotation.set(board.tilt, board.rotation, 0);
  const kit = new BrickKit(scene, root, 'plastic', !mobile);
  const id = `diary-board:${board.id}`;
  // Civic-scale board: about one and a half times a house facade, so it reads
  // from the default diorama framing instead of disappearing at map scale.
  const scale = Math.max(1, Math.round((board.width / 1.1) * 10) / 10);
  root.scaling.setAll(scale);
  const aged = board.state === 'old' || board.state === 'archived';

  // Two-step footing so the board does not float on the ground.
  kit.brick(0, 0, 0, 3, 2, aged ? C.tan : C.roadLight, H / 3, false, id);
  kit.brick(0, H / 3, 0, 2, 1, aged ? C.brown : C.sand, H * 0.6, true, id);
  const postTop = H / 3 + H * 0.6;

  let anchorY = 0;
  if (board.state === 'archived') {
    anchorY = drawArchived(kit, id, postTop);
  } else if (board.state === 'old') {
    anchorY = drawAged(kit, id, postTop);
  } else if (board.state === 'mid') {
    anchorY = drawMid(kit, id, postTop, board);
  } else {
    anchorY = drawFresh(kit, id, postTop, board);
  }

  // Weeds and planters accumulate with age.
  const weeds = board.state === 'new' ? 0 : board.state === 'mid' ? 4 : 8;
  for (let index = 0; index < weeds; index += 1) {
    const angle = (index / weeds) * Math.PI * 2;
    const radius = 0.34 + (index % 2) * 0.06;
    kit.cylinder(Math.cos(angle) * radius, H / 3 + 0.1 + (index % 3) * 0.06, Math.sin(angle) * radius, 0.11, 0.12, index % 2 ? C.moss : C.leaf, id);
  }
  if (board.state === 'new' || board.state === 'mid') {
    for (const side of [-1, 1]) {
      kit.brick(side * 0.60, H / 3, 0.14, 1, 1, C.brown, H * 0.5, false, id);
      kit.cylinder(side * 0.60, H / 3 + H * 0.5 + 0.06, 0.14, 0.13, 0.10, C.leaf, id);
      if (board.state === 'new') {
        for (const offset of [-0.05, 0.05]) kit.cylinder(side * 0.60 + offset, H / 3 + H * 0.5 + 0.18, 0.14, 0.07, 0.06, offset < 0 ? C.coral : C.yellow, id);
      } else {
        kit.cylinder(side * 0.60, H / 3 + H * 0.5 + 0.18, 0.14, 0.07, 0.06, C.coral, id);
      }
    }
  }

  // A small lamp: bright while in use, dead once archived.
  const lampLit = board.state === 'new' || board.state === 'mid';
  kit.box(0, postTop + 2.02, 0.10, 0.10, 0.10, 0.14, C.black, 0, id);
  kit.box(0, postTop + 1.90, 0.15, 0.14, 0.16, 0.14, lampLit ? C.yellow : '#3a3a30', 0, id, lampLit);
  if (board.state === 'archived') {
    // The lamp has come off and lies in the grass.
    kit.cylinder(0.42, H / 3 + 0.06, 0.34, 0.14, 0.13, '#3a3a30', id);
  }

  const meshes = kit.flush(`diary-board:${board.id}`);
  for (const mesh of meshes) {
    mesh.metadata = { ...mesh.metadata, diaryId: board.id };
  }
  return { root, meshes, board, anchorY };
}

/** Fresh board: saturated paint, tidy notes, a clean cap. */
function drawFresh(kit: BrickKit, id: string, postTop: number, board: TownDiaryBoard): number {
  const paints = [C.coral, C.teal, C.yellow, C.blue];
  const paint = paints[board.accent % paints.length];
  for (const side of [-1, 1]) {
    kit.box(side * 0.44, postTop + 0.90, 0, 0.11, 1.86, 0.11, C.brown, 0, id);
    kit.box(side * 0.44, postTop + 1.86, 0, 0.15, 0.07, 0.15, paint, 0, id);
  }
  kit.box(0, postTop + 1.34, 0, 1.10, 0.70, 0.08, paint, 0, id);
  kit.box(0, postTop + 1.34, 0.05, 1.02, 0.62, 0.03, C.ivory, 0, id);
  kit.box(0, postTop + 1.70, 0, 1.14, 0.04, 0.06, C.ivory, 0, id);
  pinnedNotes(kit, id, postTop + 1.34, [
    { x: -0.27, y: 0.12, roll: -0.05, w: 0.30, h: 0.22, color: C.yellow },
    { x: 0.06, y: 0.15, roll: 0.03, w: 0.26, h: 0.26, color: C.ivory },
    { x: 0.30, y: 0.02, roll: -0.02, w: 0.24, h: 0.20, color: C.coral },
    { x: -0.02, y: -0.13, roll: 0.02, w: 0.34, h: 0.16, color: C.teal },
  ]);
  kit.box(0, postTop + 1.74, 0, 1.22, 0.06, 0.24, paint, 0, id);
  return postTop + 2.05;
}

/** Middle age: paint has gone chalky, the hood is gone and vines climb. */
function drawMid(kit: BrickKit, id: string, postTop: number, board: TownDiaryBoard): number {
  // No saturated paint: mid boards read as "faded", so the frame is a washed
  // sand tone rather than the fresh accent colour. That single change is what
  // separates new from mid at a glance.
  const faded = [C.sand, C.tan, C.cream, C.sand][board.accent % 4];
  for (const side of [-1, 1]) {
    kit.box(side * 0.44, postTop + 0.88, 0, 0.12, 1.82, 0.12, C.brown, 0, id);
    // Weathering climbs the posts in stacked bands.
    for (let band = 0; band < 3; band += 1) {
      kit.box(side * 0.44, postTop + 0.24 + band * 0.22, 0, 0.13, 0.16, 0.13, band % 2 ? C.moss : C.sand, 0, id);
    }
    kit.box(side * 0.44, postTop + 1.84, 0, 0.16, 0.07, 0.16, faded, 0, id);
  }
  // The hood is gone; only its fixing holes remain.
  kit.box(0, postTop + 1.78, 0, 1.02, 0.03, 0.06, C.brown, 0, id);
  kit.box(0, postTop + 1.32, 0, 1.10, 0.70, 0.08, faded, 0, id);
  // A wide chalky wash across the lower third.
  kit.box(0, postTop + 1.10, 0.045, 1.11, 0.26, 0.085, C.ivory, 0, id);
  kit.box(0, postTop + 1.32, 0.05, 1.02, 0.62, 0.03, C.cream, 0, id);
  // One corner of the panel has chipped away.
  kit.box(-0.46, postTop + 1.58, 0.055, 0.18, 0.20, 0.04, C.brown, 0, id);
  pinnedNotes(kit, id, postTop + 1.32, [
    { x: -0.26, y: 0.12, roll: -0.03, w: 0.28, h: 0.22, color: C.yellow },
    { x: 0.08, y: 0.14, roll: 0.18, w: 0.24, h: 0.24, color: C.ivory },
    { x: 0.28, y: -0.06, roll: -0.14, w: 0.22, h: 0.18, color: C.cream },
  ]);
  return postTop + 2.02;
}

/** Old: bare timber, board seams, one faded note hanging crooked. */
function drawAged(kit: BrickKit, id: string, postTop: number): number {
  for (const side of [-1, 1]) {
    kit.box(side * 0.44, postTop + 0.88, 0, 0.12, 1.82, 0.12, C.brown, 0, id);
    kit.box(side * 0.44, postTop + 1.84, 0, 0.16, 0.07, 0.16, C.tan, 0, id);
  }
  // Light weathered timber, not dark brown: at diorama distance a dark face
  // merges into a shapeless block, so the panel stays pale and high contrast.
  kit.box(0, postTop + 1.32, 0, 1.10, 0.70, 0.09, C.brown, 0, id);
  kit.box(0, postTop + 1.32, 0.055, 1.04, 0.64, 0.03, '#d8c6a2', 0, id);
  // Thin plank seams keep it reading as boards without darkening the face.
  for (const x of [-0.30, 0.02, 0.32]) {
    kit.box(x, postTop + 1.32, 0.078, 0.018, 0.64, 0.015, '#b09a74', 0, id);
  }
  // Two pale notes, clearly visible against the timber.
  pinnedNotes(kit, id, postTop + 1.32, [
    { x: -0.16, y: 0.10, roll: -0.19, w: 0.30, h: 0.23, color: C.ivory },
    { x: 0.20, y: -0.10, roll: 0.14, w: 0.26, h: 0.20, color: C.cream },
  ]);
  // Hood lost a slat and sags on one side.
  kit.box(-0.10, postTop + 1.70, 0, 0.92, 0.05, 0.22, C.tan, 0.04, id);
  return postTop + 2.0;
}

/** Archived: turned around, showing its frame and a paper tag. */
function drawArchived(kit: BrickKit, id: string, postTop: number): number {
  for (const side of [-1, 1]) {
    kit.box(side * 0.44, postTop + 0.88, 0, 0.12, 1.82, 0.12, C.brown, 0, id);
    kit.box(side * 0.44, postTop + 1.84, 0, 0.16, 0.07, 0.16, C.tan, 0, id);
  }
  // Back face: pale battens over a light backing, so the turned-away cluster
  // still reads as boards instead of dark slabs.
  kit.box(0, postTop + 1.32, -0.02, 1.08, 0.70, 0.05, '#cbb896', 0, id);
  for (const y of [1.04, 1.28, 1.52]) {
    kit.box(0, postTop + y, -0.06, 1.06, 0.13, 0.06, '#b6a27e', 0, id);
  }
  // A paper tag on a string identifies the file.
  kit.box(0.16, postTop + 1.14, -0.10, 0.34, 0.24, 0.02, C.ivory, 0.12, id);
  kit.box(0.16, postTop + 1.30, -0.11, 0.02, 0.14, 0.02, C.navy, 0, id);
  // Stacked crates at the foot.
  kit.box(-0.55, H / 3 + 0.16, 0.18, 0.42, 0.32, 0.38, C.tan, 0.2, id);
  kit.box(-0.52, H / 3 + 0.44, 0.20, 0.34, 0.26, 0.32, C.brown, -0.12, id);
  return postTop + 1.95;
}

function pinnedNotes(kit: BrickKit, id: string, centerY: number, notes: { x: number; y: number; roll: number; w: number; h: number; color: string }[]): void {
  for (const note of notes) {
    kit.rolledBox(note.x, centerY + note.y, 0.08, note.w, note.h, 0.012, note.roll, note.color, 0, id);
    kit.box(note.x, centerY + note.y + note.h / 2 - 0.025, 0.09, 0.05, 0.05, 0.02, C.red, 0, id);
  }
}

/** Brick month marker: two 2x4 digits stacked on a stone plinth. */
/**
 * Month divider: a small tree, not a sign. The town already speaks in trees and
 * seasons, so the month is told by colour rather than by text or digits:
 * spring pink, summer green, autumn amber, winter bare. The trunk keeps a
 * notch per month so the count is still readable up close.
 */
const MONTH_LEAF: Record<number, string> = {
  1: '#8fa58c', 2: '#8fa58c', 3: '#e7b3c4', 4: '#e7b3c4', 5: '#e7b3c4',
  6: '#739546', 7: '#739546', 8: '#739546',
  9: '#d08a3e', 10: '#c4692f', 11: '#b06a3a', 12: '#9aa79b',
};

export function buildDiaryMonthMarker(scene: Scene, marker: TownDiaryMonthMarker, mobile = false) {
  const root = new TransformNode(`diary-month:${marker.key}`, scene);
  root.position.set(marker.x, GROUND_Y, marker.z);
  root.rotation.y = marker.rotation;
  const kit = new BrickKit(scene, root, 'plastic', !mobile);
  const id = `diary-month:${marker.key}`;
  const leaf = MONTH_LEAF[Math.max(1, Math.min(12, marker.month))] ?? C.leaf;
  const bare = marker.month === 12 || marker.month === 1 || marker.month === 2;

  // A little planted tree, matching the town's own trees: stone bed, short
  // trunk, wide low crown. Colour carries the season; the trunk notches carry
  // the month count up close.
  kit.brick(0, 0, 0, 2, 2, C.roadLight, H / 3, false, id);
  kit.brick(0, H / 3, 0, 2, 2, C.moss, H * 0.35, false, id);
  const baseY = H / 3 + H * 0.35;
  const trunk = Math.min(4, Math.max(2, Math.ceil(marker.month / 4)));
  for (let index = 0; index < trunk; index += 1) {
    kit.brick(0, baseY + index * H * 0.85, 0, 1, 1, C.brown, H * 0.85, false, id);
  }
  const crownY = baseY + trunk * H * 0.85;

  if (bare) {
    // Winter: a bare fork, no canopy.
    for (const [dx, dz] of [[-0.2, 0], [0.2, 0], [0, -0.2], [0, 0.2]]) {
      kit.brick(dx, crownY, dz, 1, 1, C.brown, H * 0.8, false, id);
    }
    kit.brick(0, crownY + H * 0.8, 0, 1, 1, '#c3c9b8', H * 0.45, true, id);
  } else {
    // Wide, squat canopy so it reads as a shrub at map scale, not a post.
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        kit.brick(dx * 0.24, crownY, dz * 0.24, 1, 1, leaf, H * 1.15, true, id);
      }
    }
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
        kit.brick(dx * 0.18, crownY + H * 1.15, dz * 0.18, 1, 1, leaf, H * 1.0, true, id);
      }
    }
    kit.brick(0, crownY + H * 2.15, 0, 1, 1, leaf, H * 0.6, true, id);
  }

  const meshes = kit.flush(`diary-month:${marker.key}`);
  for (const mesh of meshes) {
    mesh.metadata = { ...mesh.metadata, diaryMonth: marker.key };
  }
  return { root, meshes, marker, anchorY: crownY + H * 2.4 };
}

/**
 * One friend's house in the outlying hamlet. Deliberately simpler than an
 * article building: a single lit floor, a coloured gable roof, a mailbox and a
 * porch lamp. The name is rendered as a DOM label, never as 3D text.
 */
export function buildFriendHut(scene: Scene, hut: TownFriendHut, mobile = false) {
  const root = new TransformNode(`friend-hut:${hut.id}`, scene);
  root.position.set(hut.x, GROUND_Y, hut.z);
  root.rotation.y = hut.rotation;
  const kit = new BrickKit(scene, root, 'plastic', !mobile);
  const id = `friend-hut:${hut.id}`;
  const nx = Math.max(4, Math.round(hut.width / S));
  const nz = Math.max(3, Math.round(hut.depth / S));
  const w = nx * S;
  const d = nz * S;
  const roofColors = [C.coral, C.teal, C.yellow, C.pine, C.blue];
  const roof = roofColors[hut.accent % roofColors.length];
  const wall = hut.accent % 2 ? C.cream : C.ivory;

  kit.brick(0, 0, 0, nx, nz, C.roadLight, H / 3, false, id);

  const courses = 6;
  for (let course = 0; course < courses; course++) {
    const y = H / 3 + course * H;
    for (const side of [-1, 1]) {
      for (let col = 0; col < nx; col++) {
        const x = (col - (nx - 1) / 2) * S;
        const isWindow = (col === 1 || col === nx - 2) && course >= 2 && course <= 4;
        const isDoor = side === 1 && col === Math.floor(nx / 2) && course <= 2;
        if (!isWindow && !isDoor) kit.brick(x, y, side * (d - S) / 2, 1, 1, course === 0 ? C.sand : wall, H, course === courses - 1, id);
      }
      for (let row = 1; row < nz - 1; row++) {
        const isWindow = row === 1 && course >= 2 && course <= 4;
        if (!isWindow) kit.brick(side * (w - S) / 2, y, (row - (nz - 1) / 2) * S, 1, 1, course === 0 ? C.sand : wall, H, course === courses - 1, id);
      }
    }
  }

  // Front door with a warm pane and a step.
  const doorZ = d / 2 - 0.02;
  kit.box(0, H / 3 + H * 1.5, doorZ, S * 0.8, H * 2.9, 0.05, C.brown, 0, id);
  kit.box(0, H / 3 + H * 1.8, doorZ + 0.03, S * 0.4, H * 1.2, 0.02, '#5e97a4', 0, id, true);
  kit.box(0, H / 3 + H * 0.12, doorZ + 0.14, S * 1.2, H * 0.24, 0.22, C.sand, 0, id);

  // Two lit front windows: the glow reads as "someone is home".
  for (const side of [-1, 1]) {
    const x = side * (nx - 2) * S / 2;
    kit.box(x, H / 3 + H * 3.1, doorZ + 0.01, S * 0.9, H * 1.9, 0.04, '#5e97a4', 0, id, true);
    kit.box(x, H / 3 + H * 3.1, doorZ + 0.05, 0.03, H * 2.0, 0.05, C.ivory, 0, id);
    kit.box(x, H / 3 + H * 2.05, doorZ + 0.07, S * 1.15, 0.05, 0.10, C.ivory, 0, id);
  }

  // Gable roof in the hut's accent colour, with a stepped ridge.
  const roofBase = H / 3 + courses * H;
  const levels = Math.max(1, Math.ceil(nz / 2));
  for (let level = 0; level < levels; level++) {
    const rw = Math.max(1, nx - level * 2);
    const rd = Math.max(1, nz - level * 2);
    for (let col = 0; col < rw; col++) for (let row = 0; row < rd; row++) {
      kit.brick((col - (rw - 1) / 2) * S, roofBase + level * H * 1.1, (row - (rd - 1) / 2) * S, 1, 1, (row + col) % 5 === 0 ? C.ivory : roof, H * 1.1, true, id);
    }
  }
  kit.brick(0, roofBase + levels * H * 1.1, 0, 1, 1, C.navy, H * 0.7, false, id);

  // Porch lamp on the front-right corner and a mailbox by the path.
  kit.box(w / 2 - S * 0.4, H / 3 + H * 3.6, d / 2 + 0.05, 0.07, 0.07, 0.10, C.black, 0, id);
  kit.box(w / 2 - S * 0.4, H / 3 + H * 3.4, d / 2 + 0.10, 0.12, 0.14, 0.12, C.yellow, 0, id, true);
  kit.box(-w / 2 - 0.12, H / 3 + H * 0.8, d / 2 + 0.12, 0.06, 0.62, 0.06, C.brown, 0, id);
  kit.box(-w / 2 - 0.12, H / 3 + H * 1.2, d / 2 + 0.12, 0.16, 0.13, 0.16, C.red, 0, id);

  // A blank nameplate above the door. The name itself is DOM text projected
  // above the hut, so the plate only needs to read as a sign at map scale.
  kit.box(0, H / 3 + H * 4.55, d / 2 + 0.03, S * 1.35, H * 0.85, 0.04, C.ivory, 0, id);
  kit.box(0, H / 3 + H * 4.55, d / 2 + 0.055, S * 1.05, H * 0.16, 0.02, roof, 0, id);

  // Two window boxes under the front windows add colour without extra glass.
  for (const side of [-1, 1]) {
    const x = side * (nx - 2) * S / 2;
    kit.box(x, H / 3 + H * 1.95, d / 2 + 0.09, S * 0.95, H * 0.35, 0.12, C.brown, 0, id);
    for (const offset of [-S * 0.28, 0, S * 0.28]) {
      kit.cylinder(x + offset, H / 3 + H * 2.2, d / 2 + 0.09, 0.09, 0.08, offset === 0 ? C.yellow : C.coral, id);
    }
  }

  const meshes = kit.flush(`friend-hut:${hut.id}`);
  for (const mesh of meshes) {
    mesh.metadata = { ...mesh.metadata, friendId: hut.id };
  }
  return { root, meshes, hut, anchorY: roofBase + levels * H * 1.1 + H * 1.6 };
}

function buildWindmill(scene: Scene, feature: TownFeature, mobile = false) {
  const root = new TransformNode(`feature:${feature.id}`, scene);
  root.position.set(feature.x, GROUND_Y, feature.z);
  const kit = new BrickKit(scene, root, 'plastic', !mobile);
  const id = feature.id;
  const nx = Math.max(6, Math.round(feature.width / S));
  const nz = Math.max(6, Math.round(feature.depth / S));
  const w = nx * S;
  const d = nz * S;
  const baseY = H / 3;
  const coursesPerFloor = Math.round(FLOOR_HEIGHT / H);

  // Two-step plinth keeps the landmark grounded without widening the shaft.
  kit.brick(0, 0, 0, nx, nz, C.roadLight, H / 3, false, id);
  kit.brick(0, baseY, 0, 6, 6, C.sand, H * 0.85, true, id);
  kit.brick(0, baseY + H * 0.85, 0, 5, 5, C.cream, H * 0.85, true, id);
  let y = baseY + H * 1.7;

  for (let floor = 0; floor < SHAFT_WIDTHS.length; floor++) {
    const size = SHAFT_WIDTHS[floor];
    const floorBase = y;

    for (let course = 0; course < coursesPerFloor; course++) {
      const color = floor === 5 ? C.ivory
        : course === 0 && floor === 0 ? C.sand : C.cream;
      kit.brick(0, y, 0, size, size, color, H, course === coursesPerFloor - 1, id);
      y += H;
    }

    // Coral belt courses give the shaft the segmented lighthouse rhythm from
    // the reference while keeping the footprint compact.
    if (RING_FLOORS.has(floor)) {
      kit.brick(0, floorBase + H * 0.1, 0, size + 1, size + 1, C.coral, H * 0.42, true, id);
    }

    if (floor > 0 && size >= 2) {
      addShaftWindow(kit, id, size, floorBase);
    }
  }

  // Two-course-tall lantern room so the glass stays readable behind the sails.
  const lanternBaseY = y;
  const lanternCourses = coursesPerFloor * 2;
  for (let course = 0; course < lanternCourses; course++) {
    kit.brick(0, y, 0, LANTERN_WIDTH, LANTERN_WIDTH, C.cream, H, course === lanternCourses - 1, id);
    y += H;
  }
  addLanternWindows(kit, id, LANTERN_WIDTH, lanternBaseY, lanternCourses);

  // Balcony ring and railing under the lantern.
  kit.brick(0, lanternBaseY - H * 0.1, 0, LANTERN_WIDTH + 1, LANTERN_WIDTH + 1, C.coral, H * 0.45, true, id);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.box(sx * S * 2.05, lanternBaseY + H * 1.15, sz * S * 2.05, 0.075, H * 1.4, 0.075, C.navy, 0, id);
    }
  }
  for (const side of [-1, 1]) {
    kit.box(0, lanternBaseY + H * 1.82, side * S * 2.05, S * 4.1, 0.055, 0.06, C.navy, 0, id);
    kit.box(side * S * 2.05, lanternBaseY + H * 1.82, 0, 0.06, 0.055, S * 4.1, C.navy, 0, id);
  }

  // Stepped cap and beacon.
  kit.brick(0, y, 0, 5, 5, C.coral, H * 0.55, true, id);
  y += H * 0.55;
  kit.brick(0, y, 0, 4, 4, C.red, H * 0.75, true, id);
  y += H * 0.75;
  kit.brick(0, y, 0, 3, 3, C.red, H * 0.7, true, id);
  y += H * 0.7;
  kit.brick(0, y, 0, 1, 1, C.navy, H * 0.8, false, id);
  y += H * 0.8;
  kit.box(0, y + H * 0.42, 0, 0.2, H * 0.85, 0.2, C.yellow, 0, id, true);
  y += H * 1.1;

  // Arched entrance at the base.
  const doorZ = 5 * S / 2 + 0.02;
  const doorY = H * 1.75;
  kit.box(0, doorY, doorZ, S * 1.3, H * 3.4, 0.06, C.brown, 0, id);
  kit.box(0, doorY + H * 0.55, doorZ + 0.04, S * 0.8, H * 1.5, 0.035, '#5e97a4', 0, id, true);
  kit.box(0, doorY + H * 1.52, doorZ + 0.08, S * 0.48, H * 0.24, 0.04, C.yellow, 0, id);
  for (let step = 0; step < 3; step++) {
    kit.box(0, H * 0.11 + step * H * 0.2, doorZ + 0.3 - step * 0.12, S * 1.7 + step * 0.22, H * 0.22, 0.22, C.sand, 0, id);
  }

  addRotor(kit, id, lanternBaseY, coursesPerFloor);

  const signX = -w * 0.4;
  const signZ = d / 2 + 0.2;
  for (const post of [-1, 1]) kit.box(signX + post * 0.26, 0.73, signZ, 0.08, 1.3, 0.08, C.brown, 0, id);
  kit.box(signX, 1.35, signZ, 0.94, 0.56, 0.07, C.cream, 0, id);
  kit.box(signX, 1.35, signZ - 0.05, 0.68, 0.1, 0.025, C.red, 0, id);
  kit.box(signX, 1.51, signZ - 0.05, 0.42, 0.08, 0.025, C.yellow, 0, id);

  const meshes = kit.flush(`feature:${feature.id}`);
  for (const mesh of meshes) {
    mesh.metadata = { ...mesh.metadata, featureId: feature.id };
  }
  return { root, meshes, feature, anchorY: lanternBaseY + H * 2.5 };
}

function addShaftWindow(kit: BrickKit, id: string, size: number, floorBase: number) {
  const face = size * S / 2;
  const paneY = floorBase + H * 3.6;
  const paneWidth = size >= 4 ? S * 0.74 : S * 0.62;
  const paneHeight = H * 2.5;
  const offset = size >= 4 ? S * 0.5 : 0;

  for (const side of [-1, 1]) {
    kit.box(offset, paneY, side * (face + 0.012), paneWidth, paneHeight, 0.04, '#5e97a4', 0, id, true);
    kit.box(offset, paneY - paneHeight * 0.62, side * (face + 0.04), paneWidth + 0.1, 0.07, 0.08, C.ivory, 0, id);
    kit.box(offset, paneY, side * (face + 0.045), 0.025, paneHeight, 0.06, C.ivory, 0, id);
    kit.box(side * (face + 0.012), paneY, offset, 0.04, paneHeight, paneWidth, '#5e97a4', 0, id, true);
    kit.box(side * (face + 0.04), paneY - paneHeight * 0.62, offset, 0.08, 0.07, paneWidth + 0.1, C.ivory, 0, id);
    kit.box(side * (face + 0.045), paneY, offset, 0.06, paneHeight, 0.025, C.ivory, 0, id);
  }
}

function addLanternWindows(kit: BrickKit, id: string, size: number, floorBase: number, courses: number) {
  const face = size * S / 2;
  const paneHeight = H * (courses - 1.6);
  const paneY = floorBase + H * (courses / 2 + 0.1);
  const paneWidth = S * 1.02;

  for (const side of [-1, 1]) {
    for (const offset of [-S * 0.52, S * 0.52]) {
      kit.box(offset, paneY, side * (face + 0.012), paneWidth, paneHeight, 0.04, C.yellow, 0, id, true);
      kit.box(side * (face + 0.012), paneY, offset, 0.04, paneHeight, paneWidth, C.yellow, 0, id, true);
    }
    for (const level of [-0.5, 0, 0.5]) {
      kit.box(0, paneY + paneHeight * level, side * (face + 0.04), S * 2.3, 0.055, 0.06, C.navy, 0, id);
      kit.box(side * (face + 0.04), paneY + paneHeight * level, 0, 0.06, 0.055, S * 2.3, C.navy, 0, id);
    }
    for (const offset of [-S * 1.02, -S * 0.34, S * 0.34, S * 1.02]) {
      kit.box(offset, paneY, side * (face + 0.045), 0.055, paneHeight, 0.06, C.navy, 0, id);
      kit.box(side * (face + 0.045), paneY, offset, 0.06, paneHeight, 0.055, C.navy, 0, id);
    }
    kit.box(0, paneY - paneHeight * 0.52, side * (face + 0.06), S * 2.5, 0.08, 0.1, C.coral, 0, id);
    kit.box(side * (face + 0.06), paneY - paneHeight * 0.52, 0, 0.1, 0.08, S * 2.5, C.coral, 0, id);
  }
}

function addRotor(kit: BrickKit, id: string, lanternBaseY: number, coursesPerFloor: number) {
  // The sail plane stays parallel to the tower's front facade: the rotor axis
  // points straight out of the masonry, the way a real windmill is mounted.
  const rotorYaw = 0;
  const rotorSin = Math.sin(rotorYaw);
  const rotorCos = Math.cos(rotorYaw);
  const rotorNormalX = Math.sin(rotorYaw);
  const rotorNormalZ = Math.cos(rotorYaw);
  const hubY = lanternBaseY + H * (coursesPerFloor * 1.1);
  const hubOut = LANTERN_WIDTH * S / 2 + 0.35;
  const hub = { x: rotorNormalX * hubOut, y: hubY, z: rotorNormalZ * hubOut };
  const rotorX = (u: number, front = 0) => hub.x + u * rotorCos + rotorNormalX * front;
  const rotorZ = (u: number, front = 0) => hub.z - u * rotorSin + rotorNormalZ * front;

  // Short axle ties the hub back into the lantern face.
  kit.box(hub.x * 0.55, hub.y, hub.z * 0.55, 0.22, 0.22, hubOut * 0.95, C.brown, rotorYaw, id);
  kit.box(hub.x, hub.y, hub.z, 0.44, 0.44, 0.26, C.brown, rotorYaw, id);
  kit.box(hub.x + 0.07, hub.y, hub.z + 0.15, 0.22, 0.22, 0.12, C.yellow, rotorYaw, id);

  // Pixel-stepped sail: three bands along the arm, the middle one kicked out
  // sideways so the outline breaks into a hard stair instead of a curve.
  const trailing = -0.30;
  const border = 0.15;
  const bands = [
    { start: 0.52, end: 1.46, leading: 0.34 },
    { start: 1.46, end: 2.56, leading: 0.78 },
    { start: 2.56, end: 3.56, leading: 0.34 },
  ];

  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const roll = Math.PI / 4 + quadrant * Math.PI / 2;
    const sa = Math.sin(roll);
    const ca = Math.cos(roll);
    const point = (distance: number, lateral: number) => ({
      u: ca * distance - sa * lateral,
      v: sa * distance + ca * lateral,
    });

    for (const band of bands) {
      const length = band.end - band.start;
      const width = band.leading - trailing;
      const center = point((band.start + band.end) / 2, (band.leading + trailing) / 2);

      // Thick red frame, then the ivory sail cloth inset inside it.
      kit.rolledBox(rotorX(center.u, 0.05), hub.y + center.v, rotorZ(center.u, 0.05), length + 0.02, width + border * 2, 0.11, roll, C.coral, rotorYaw, id);
      kit.rolledBox(rotorX(center.u, 0.095), hub.y + center.v, rotorZ(center.u, 0.095), length - 0.03, width, 0.05, roll, C.ivory, rotorYaw, id);

      // Thin dark spar keeps the sail readable without overpowering the frame.
      const spar = point((band.start + band.end) / 2, trailing + border + 0.035);
      kit.rolledBox(rotorX(spar.u, 0.14), hub.y + spar.v, rotorZ(spar.u, 0.14), length + 0.02, 0.045, 0.03, roll, C.navy, rotorYaw, id);
    }

    // Blunt red cap closes the outer end of the arm.
    const tip = point(3.62, (0.34 + trailing) / 2);
    kit.rolledBox(rotorX(tip.u, 0.06), hub.y + tip.v, rotorZ(tip.u, 0.06), 0.18, 0.34 + border * 2, 0.09, roll, C.red, rotorYaw, id);
  }
}
