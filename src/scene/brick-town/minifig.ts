import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { TownPersonRole } from '../../data/town-life';
import { roundedBox } from './kit';
import { atlasUV, ink, minifigMaterial } from './minifig-print';
import type { Citizen } from './life';

type Shape = { positions: number[]; normals: number[]; indices: number[] };
type UV = (vertex: number, x: number, y: number, z: number) => number[];
class Mold {
  private shape: Shape = { positions: [], normals: [], indices: [] };
  private uvs: number[] = [];
  constructor(private readonly node: TransformNode, private readonly plastic: ReturnType<typeof minifigMaterial>) {}

  private append(shape: Shape, x: number, y: number, z: number, tile: number, uv?: UV, roll = 0, taper = 0) {
    const base = this.shape.positions.length / 3, cos = Math.cos(roll), sin = Math.sin(roll);
    const solid = atlasUV(tile, .08, .08);
    for (let index = 0; index < shape.positions.length; index += 3) {
      const [px, py, pz] = [shape.positions[index], shape.positions[index + 1], shape.positions[index + 2]];
      const scale = 1 + py * taper;
      const [nx, ny, nz] = [shape.normals[index] / scale, shape.normals[index + 1] - shape.normals[index] * px * taper, shape.normals[index + 2]];
      const length = Math.hypot(nx, ny, nz) || 1;
      this.shape.positions.push(x + px * scale * cos - py * sin, y + px * scale * sin + py * cos, z + pz);
      this.shape.normals.push((nx * cos - ny * sin) / length, (nx * sin + ny * cos) / length, nz / length);
      this.uvs.push(...(uv?.(index / 3, px, py, pz) ?? solid));
    }
    for (const index of shape.indices) this.shape.indices.push(base + index);
  }

  box(x: number, y: number, z: number, width: number, height: number, depth: number, tile: number, options: { print?: boolean; roll?: number; taper?: number; bevel?: number } = {}) {
    this.append(roundedBox(width, height, depth, options.bevel ?? .015), x, y, z, tile, options.print ? (vertex, px, py) =>
      vertex >= 80 ? atlasUV(tile, .5 - px / width, .5 - py / height) : atlasUV(tile, .08, .08) : undefined, options.roll, options.taper);
  }

  profile(x: number, y: number, z: number, rings: readonly (readonly [number, number])[], tile: number,
    options: { detail?: number; depth?: number; print?: boolean; roll?: number; gap?: number; hairline?: boolean; bend?: number } = {}) {
    const detail = options.detail ?? 18, depth = options.depth ?? 1, gap = options.gap ?? 0;
    const shape: Shape = { positions: [], normals: [], indices: [] };
    rings.forEach(([height, radius], row) => {
      const before = rings[Math.max(0, row - 1)], after = rings[Math.min(rings.length - 1, row + 1)];
      for (let index = 0; index <= detail; index++) {
        const angle = (gap ? gap : -Math.PI) + index / detail * (Math.PI * 2 - gap * 2);
        const sin = Math.sin(angle), cos = Math.cos(angle);
        const hair = options.hairline ? Math.max(0, .067 * cos + .025 * Math.sin(angle * 2)) * Math.max(0, 1 - row / 4) : 0;
        shape.positions.push(radius * sin, height + hair, radius * cos * depth + (options.bend ?? 0) * Math.max(0, -.07 - height));
        shape.normals.push(sin * (after[0] - before[0]), before[1] - after[1], cos * (after[0] - before[0]) / depth);
        if (index > 0 && row > 0) {
          const top = row * (detail + 1) + index, bottom = top - detail - 1;
          shape.indices.push(bottom - 1, top - 1, bottom, bottom, top - 1, top);
        }
      }
    });
    if (gap) {
      for (const [edge, reverse] of [[0, false], [detail, true]] as const) {
        const vertices = [0, 2, 5, 7].map(row => row * (detail + 1) + edge);
        const start = shape.positions.length / 3;
        const angle = edge ? Math.PI * 2 - gap : gap;
        for (const vertex of vertices) {
          shape.positions.push(...shape.positions.slice(vertex * 3, vertex * 3 + 3));
          shape.normals.push(reverse ? Math.cos(angle) : -Math.cos(angle), 0, reverse ? -Math.sin(angle) : Math.sin(angle));
        }
        shape.indices.push(...(reverse ? [start, start + 2, start + 1, start, start + 3, start + 2] : [start, start + 1, start + 2, start, start + 2, start + 3]));
      }
    }
    this.append(shape, x, y, z, tile, options.print ? (index, _px, py) =>
      atlasUV(tile, 1 - (index % (detail + 1)) / detail, 1 - (py - rings[0][0]) / (rings.at(-1)![0] - rings[0][0])) : undefined, options.roll);
  }

  finish(name: string) {
    const scene = this.node.getScene(), mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = this.shape.positions; data.normals = this.shape.normals;
    data.indices = this.shape.indices; data.uvs = this.uvs; data.applyToMesh(mesh);
    mesh.material = this.plastic; mesh.parent = this.node;
    return mesh;
  }
}

const cylinder = (radius: number, height: number, bevel = .01) => [
  [-height / 2, 0], [-height / 2, radius - bevel], [-height / 2 + bevel, radius],
  [height / 2 - bevel, radius], [height / 2, radius - bevel], [height / 2, 0],
] as const;
const claw = [[-.041, .062], [-.032, .076], [.032, .076], [.041, .062], [.041, .049], [.029, .042], [-.029, .042], [-.041, .049], [-.041, .062]] as const;

export function buildMinifig(scene: Scene, role: TownPersonRole, index: number, mobile: boolean) {
  const joint = (name: string, parent?: TransformNode) => {
    const node = new TransformNode(`${name}:${index}`, scene); if (parent) node.parent = parent; return node;
  };
  const root = joint('citizen'); root.scaling.setAll(.70);
  const hips = joint('pelvis', root), chest = joint('chest', hips), head = joint('head', chest);
  chest.position.y = .43; head.position.y = .49;
  const look = role === 'guard' ? 4 : role === 'thief' ? 5 : role === 'traveler' ? 1 + index % 2 : [0, 3, 2][(index + Math.floor(index / 3)) % 3];
  const coat = look + 6, pants = look < 4 ? (look === 2 ? ink.moss : ink.denim) : ink.navy;
  const detail = mobile ? 16 : 24;
  const plastic = minifigMaterial(scene, mobile);
  const mold = (node: TransformNode) => new Mold(node, plastic);
  const torso = mold(chest);
  torso.box(0, .205, 0, .405, .40, .249, coat, { print: true, taper: -.74, bevel: .024 });
  torso.box(0, .007, 0, .355, .072, .219, pants);
  torso.profile(0, .422, 0, cylinder(.079, .072), ink.skin, { detail: 12 });
  if (role === 'traveler') {
    torso.box(0, .222, -.195, .316, .318, .173, ink.sand, { bevel: .026 });
    torso.box(0, .245, -.28, .255, .187, .066, ink.wood);
    torso.profile(0, .37, -.207, cylinder(.06, .333), ink.chocolate, { roll: Math.PI / 2, detail: 12 });
    for (const side of [-1, 1]) torso.box(side * .085, .209, -.315, .035, .12, .016, ink.brass);
  }
  const meshes = [torso.finish(`costume:${index}`)];

  const skull = mold(head);
  skull.profile(0, 0, 0, [[-.047, .075], [-.04, .112], [-.022, .141], [.009, .159], [.188, .159], [.212, .148], [.231, .120], [.232, 0]], look, { detail, print: true });
  if (look === 0) {
    skull.profile(0, 0, -.01, [[.092, .143], [.119, .165], [.166, .176], [.216, .178], [.254, .154], [.28, .096], [.286, 0]], ink.chocolate, { detail, hairline: true, depth: 1.04 });
    skull.box(-.058, .219, .101, .17, .063, .156, ink.chocolate, { roll: -.20, bevel: .028 });
  } else if (look === 1 || look === 4) {
    const base = look === 4 ? ink.navy : ink.sand, band = look === 4 ? ink.sole : ink.chocolate;
    skull.profile(0, .213, look === 4 ? -.025 : 0, cylinder(look === 4 ? .179 : .229, .042, .008), base, { detail, depth: .91 });
    if (look === 4) skull.box(0, .194, .106, .286, .03, .211, ink.navy, { bevel: .014 });
    skull.profile(0, .253, -.025, cylinder(.159, .043, .006), band, { detail });
    skull.profile(0, 0, -.025, [[.255, .16], [.297, .152], [.318, .114], [.323, 0]], base, { detail });
    if (look === 4) skull.box(0, .253, .139, .058, .039, .017, ink.brass);
  } else {
    const cap = look === 5 ? ink.sole : look === 3 ? ink.rust : ink.teal;
    skull.profile(0, 0, -.014, [[.182, .157], [.198, .178], [.23, .176], [.27, .159], [.303, .116], [.311, 0]], cap, { detail });
    skull.profile(0, .204, -.011, cylinder(.18, .048, .008), cap, { detail });
    if (look === 2) skull.profile(0, .321, -.014, cylinder(.049, .054, .014), ink.ivory, { detail: 12 });
    if (look === 3) skull.box(-.102, .206, .139, .043, .037, .016, ink.sand);
  }
  meshes.push(skull.finish(`moulded-head:${index}`));

  const legs: TransformNode[] = [], arms: TransformNode[] = [];
  for (const side of [-1, 1]) {
    const hip = joint('hip', hips); hip.position.set(side * .102, .406, 0); legs.push(hip);
    const leg = mold(hip);
    leg.box(0, -.151, 0, .181, .317, .20, pants);
    leg.box(0, -.332, .038, .187, .128, .283, pants, { bevel: .019 });
    leg.box(0, -.389, .039, .186, .033, .283, ink.sole, { bevel: .008 });
    meshes.push(leg.finish(`walking-leg:${index}:${side}`));

    const shoulder = joint('shoulder', chest); shoulder.position.set(side * .232, .356, 0); arms.push(shoulder);
    const arm = mold(shoulder);
    arm.profile(0, 0, 0, [[-.273, .052], [-.259, .067], [-.226, .071], [-.176, .076], [-.111, .087], [-.057, .091], [-.011, .079], [.018, .048], [.022, 0]], coat, { detail: mobile ? 12 : 16, depth: .93, bend: .17 });
    arm.profile(0, -.268, .033, cylinder(.065, .03, .007), look === 4 ? ink.navy : coat, { detail: 12 });
    arm.profile(0, -.298, .03, cylinder(.046, .061), ink.skin, { detail: 12 });
    arm.profile(0, -.346, .046, claw, ink.skin, { detail: mobile ? 9 : 14, roll: Math.PI / 2, gap: .69 });
    meshes.push(arm.finish(`articulated-arm:${index}:${side}`));
  }

  const canopy = mold(chest);
  canopy.profile(-.018, 0, .027, [[.835, 0], [.872, .37], [.907, .383], [.996, .286], [1.044, .145], [1.068, .036], [1.068, 0]], index % 2 ? ink.teal : ink.rain, { detail: 12 });
  canopy.profile(-.018, .622, .027, cylinder(.017, .845, .003), ink.sole, { detail: 8 });
  canopy.box(-.127, .225, .027, .237, .035, .038, ink.sole, { bevel: .012 });
  canopy.box(-.238, .225, .147, .036, .035, .266, ink.sole, { bevel: .012 });
  const umbrella = canopy.finish(`umbrella:${index}`); umbrella.setEnabled(false);
  const accessory = mold(chest);
  let map: Mesh | undefined, lantern: Mesh | undefined;
  if (role === 'traveler') {
    accessory.box(0, .22, .307, .278, .159, .023, ink.map, { print: true, roll: .065, bevel: .007 });
    map = accessory.finish(`folded-map:${index}`); map.setEnabled(false);
  } else if (role === 'guard') {
    const torch = mold(arms[1]);
    torch.box(0, -.355, .07, .055, .052, .128, ink.sole);
    torch.profile(0, -.455, .08, cylinder(.068, .167, .01), ink.lamp, { detail: 12 });
    for (const height of [-.533, -.38]) torch.profile(0, height, .08, cylinder(.082, .033, .007), ink.chocolate, { detail: 12 });
    for (const side of [-1, 1]) torch.box(side * .056, -.455, .126, .014, .13, .014, ink.wood);
    lantern = torch.finish(`patrol-lantern:${index}`); lantern.setEnabled(false);
  }
  meshes.push(umbrella);
  if (map) meshes.push(map);
  if (lantern) meshes.push(lantern);
  for (const mesh of meshes) { mesh.isPickable = mesh !== umbrella && mesh !== map && mesh !== lantern; mesh.metadata = { citizen: index }; }
  return { root, hips, chest, head, legs, arms, meshes, umbrella, map, lantern, gait: 0, heading: undefined as number | undefined };
}

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
export function poseMinifig(figure: ReturnType<typeof buildMinifig>, person: Citizen, dt: number, elapsed: number, reduced: boolean, night: boolean, rainy: boolean) {
  const { root, hips, chest, head, legs, arms } = figure;
  const amount = reduced ? 1 : 1 - Math.exp(-dt * 13);
  const angle = Math.atan2(person.facing.x, person.facing.z);
  const previous = figure.heading ?? angle;
  root.rotation.y = figure.heading = previous + Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous)) * amount;
  figure.gait = mix(figure.gait, person.moving && !reduced ? 1 : 0, amount);
  const run = person.state === 'escaping' || person.chasing, sneak = person.role === 'thief' && !run;
  const stride = person.stride ?? 0, gait = figure.gait;
  const step = Math.sin(stride) * gait, chat = reduced ? 0 : person.conversation;
  const address = chat && (person.chattingSecond ? person.conversationLeft < 2.45 : person.conversationLeft >= 2.45) ? chat : 0;
  const wave = !reduced && person.gesture === 'wave';
  const reading = !reduced && person.gesture === 'map' && !rainy;
  const scan = !reduced && (person.gesture === 'scan' || person.state === 'lurking');
  const knock = !reduced && person.state === 'entering' && person.timer < .44;
  const lantern = night && !!figure.lantern;
  figure.umbrella.setEnabled(rainy); figure.map?.setEnabled(reading); figure.lantern?.setEnabled(lantern);

  hips.position.y = gait * (.012 + Math.abs(Math.sin(stride)) * (run ? .044 : .023));
  chest.rotation.x = mix(chest.rotation.x, (rainy ? .02 : run ? .22 : sneak ? .12 : .04) * gait, amount);
  chest.rotation.y = mix(chest.rotation.y, -.11 * step, amount);
  chest.rotation.z = mix(chest.rotation.z, rainy ? .025 * step : .075 * step + (person.yielding && !reduced ? -.07 : 0), amount);
  const nod = chat * Math.sin(elapsed * 4.1) * .095;
  head.rotation.x = mix(head.rotation.x, reading ? .31 : wave ? .13 + .095 * Math.sin(elapsed * 7) : nod - .055 * gait, amount);
  head.rotation.y = mix(head.rotation.y, scan ? Math.sin((person.pause ?? -person.timer) * 2.55) * .73 : step * .085, amount);
  head.rotation.z = mix(head.rotation.z, chat * -.065 + (wave ? .12 : 0), amount);
  for (let index = 0; index < 2; index++) {
    const side = index === 0 ? -1 : 1;
    const leg = legs[index], arm = arms[index];
    const swing = step * side;
    leg.rotation.x = swing * (run ? .68 : sneak ? .33 : .46);
    leg.position.y = .406 + Math.max(0, swing) * (run ? .083 : .043);
    let lift = -swing * (run ? .74 : .43), spread = side * .14;
    if (reading) { lift = -1.13; spread = -side * .25; }
    else if (wave ? index === (lantern ? 0 : 1) : index === 1 && (knock || address > 0)) {
      lift = wave ? -2.14 : knock ? -1.39 - Math.sin(person.timer * 35) * .22 : -.63 - Math.sin(elapsed * 6.6) * .29 * address;
      spread = side * (wave ? .36 + Math.sin(elapsed * 13) * .14 : .24);
    }
    if (index === 0 && rainy) { lift = -1.16; spread = -.04; }
    if (index === 1 && lantern) { lift = -.58 + .11 * swing; spread = .1; }
    arm.rotation.x = mix(arm.rotation.x, lift, amount);
    arm.rotation.z = mix(arm.rotation.z, spread, amount);
  }
}
