import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { TownFeature, TownFriendHut } from '../../data/town-layout';
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
    mesh.metadata = { ...mesh.metadata, postId: undefined, friendId: hut.id };
  }
  return { root, meshes, hut, anchorY: roofBase + levels * H * 1.1 + H * 1.6 };
}

function buildWindmill(scene: Scene, feature: TownFeature, mobile = false) {
  const root = new TransformNode(`feature:${feature.id}`, scene);
  root.position.set(feature.x, GROUND_Y, feature.z);
  root.scaling.setAll(.62);
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

  const { rotor, meshes: rotorMeshes } = addRotor(scene, root, kit, id, lanternBaseY, coursesPerFloor, mobile);

  const signX = -w * 0.4;
  const signZ = d / 2 + 0.2;
  for (const post of [-1, 1]) kit.box(signX + post * 0.26, 0.73, signZ, 0.08, 1.3, 0.08, C.brown, 0, id);
  kit.box(signX, 1.35, signZ, 0.94, 0.56, 0.07, C.cream, 0, id);
  kit.box(signX, 1.35, signZ - 0.05, 0.68, 0.1, 0.025, C.red, 0, id);
  kit.box(signX, 1.51, signZ - 0.05, 0.42, 0.08, 0.025, C.yellow, 0, id);

  const meshes = [...kit.flush(`feature:${feature.id}`), ...rotorMeshes];
  for (const mesh of meshes) {
    mesh.metadata = { ...mesh.metadata, postId: undefined, featureId: feature.id };
  }
  return { root, rotor, meshes, feature, anchorY: (lanternBaseY + H * 2.5) * .62 };
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

function addRotor(scene: Scene, root: TransformNode, towerKit: BrickKit, id: string, lanternBaseY: number, coursesPerFloor: number, mobile: boolean) {
  const hubY = lanternBaseY + H * (coursesPerFloor * 1.1);
  const hubOut = LANTERN_WIDTH * S / 2 + 0.35;
  // Keep the axle fixed; the sails turn in the facade plane around its tip.
  towerKit.box(0, hubY, hubOut * 0.55, 0.22, 0.22, hubOut * 0.95, C.brown, 0, id);
  const rotor = new TransformNode(`windmill-rotor:${id}`, scene);
  rotor.parent = root;
  rotor.position.set(0, hubY, hubOut);
  const kit = new BrickKit(scene, rotor, 'plastic', !mobile);
  kit.box(0, 0, 0, 0.44, 0.44, 0.26, C.brown, 0, id);
  kit.box(0.07, 0, 0.15, 0.22, 0.22, 0.12, C.yellow, 0, id);

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
      kit.rolledBox(center.u, center.v, 0.05, length + 0.02, width + border * 2, 0.11, roll, C.coral, 0, id);
      kit.rolledBox(center.u, center.v, 0.095, length - 0.03, width, 0.05, roll, C.ivory, 0, id);

      // Thin dark spar keeps the sail readable without overpowering the frame.
      const spar = point((band.start + band.end) / 2, trailing + border + 0.035);
      kit.rolledBox(spar.u, spar.v, 0.14, length + 0.02, 0.045, 0.03, roll, C.navy, 0, id);
    }

    // Blunt red cap closes the outer end of the arm.
    const tip = point(3.62, (0.34 + trailing) / 2);
    kit.rolledBox(tip.u, tip.v, 0.06, 0.18, 0.34 + border * 2, 0.09, roll, C.red, 0, id);
  }
  return { rotor, meshes: kit.flush(`windmill-rotor:${id}`) };
}
