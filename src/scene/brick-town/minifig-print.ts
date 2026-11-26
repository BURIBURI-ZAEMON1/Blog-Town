import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import type { Scene } from '@babylonjs/core/scene.js';

const materials = new WeakMap<Scene, PBRMaterial>();
export const ink = {
  skin: 12, sole: 13, denim: 14, navy: 15, moss: 16, rust: 17, sand: 18,
  chocolate: 19, ivory: 20, brass: 21, teal: 22, rain: 23, coral: 24, lamp: 25,
  map: 26, wood: 27,
} as const;
const colors = ['#f4be32', '#272d2d', '#3c5667', '#243647', '#59705a', '#ad4c35', '#cba570',
  '#55352a', '#f2e3c6', '#e5a04b', '#387f80', '#b33e36', '#d37853', '#ffc361', '#efe0ba', '#7f5742'];
const coats = ['#b84d38', '#398985', '#d3894d', '#697b55', '#334f6d', '#36333b'];
const tileSide = 64, columns = 8, rows = 4;
export const atlasUV = (tile: number, x: number, y: number) => [
  ((tile % columns) * tileSide + 2 + x * (tileSide - 4)) / (columns * tileSide),
  1 - (Math.floor(tile / columns) * tileSide + 2 + y * (tileSide - 4)) / (rows * tileSide),
];

export function minifigMaterial(scene: Scene, mobile: boolean) {
  const cached = materials.get(scene); if (cached) return cached;
  const scale = mobile ? 1 : 2;
  const texture = new DynamicTexture('minifig-print-atlas', { width: tileSide * columns * scale, height: tileSide * rows * scale }, scene, true);
  const ctx = texture.getContext();
  const tile = (index: number, base: string, paint?: () => void) => {
    ctx.save(); ctx.scale(scale, scale); ctx.translate(index % columns * tileSide, Math.floor(index / columns) * tileSide);
    ctx.fillStyle = base; ctx.fillRect(0, 0, tileSide, tileSide); paint?.(); ctx.restore();
  };
  const line = (color: string, width: number, ...points: [number, number][]) => {
    ctx.beginPath(); ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
  };
  const dot = (x: number, y: number, size: number, color: string) => {
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  };
  for (let style = 0; style < 6; style++) {
    tile(style, colors[0], () => {
      const dark = '#30282a';
      if (style === 5) { ctx.fillStyle = '#2f2b33'; ctx.fillRect(19, 21, 26, 15); }
      for (const sign of [-1, 1]) {
        const eye = 32 + sign * 5.4;
        const brow = style === 4 ? 21 : 19;
        if (style !== 5) line(dark, 1.25, [eye - 2.5, brow + sign * .6], [eye, brow - 1.2], [eye + 2.2, brow - sign * .55]);
        dot(eye, 28, 2.45, style === 5 ? '#f4e8ca' : dark);
        if (style !== 5) dot(eye - .48, 27.2, .63, '#fff5da');
        if (style === 1 || style === 2) {
          dot(eye + sign * 1.8, 33.3, .68, '#ae6941'); dot(eye + sign * 3.1, 34.8, .6, '#ae6941');
        }
      }
      if (style === 3) {
        ctx.strokeStyle = '#483132'; ctx.lineWidth = 1.45;
        for (const x of [22.7, 33.4]) ctx.strokeRect(x, 23.5, 7.9, 8.9);
        line('#483132', 1.4, [30.6, 26.8], [33.4, 26.8]);
      }
      ctx.beginPath(); ctx.moveTo(27, 41);
      ctx.quadraticCurveTo(32, style === 4 ? 43 : style === 5 ? 47 : 50, 37, style === 5 ? 38 : 40);
      ctx.lineWidth = 1.8; ctx.strokeStyle = dark; ctx.stroke();
      if (style === 4) line('#684631', 2, [28, 36.7], [32, 36], [36, 36.7]);
    });
    tile(6 + style, coats[style], () => {
      if (style === 5) {
        for (let y = 15; y < 59; y += 9) line('#696471', 3.5, [3, y], [61, y]);
        line('#251f28', 4, [15, 3], [24, 27], [23, 61]);
      } else if (style === 4) {
        line('#22374a', 8, [20, 4], [30, 20], [44, 4]);
        line('#ebe0c1', 2, [20, 5], [31, 19], [43, 5]);
        line('#233444', 3, [31, 21], [31, 58]);
        dot(44, 26, 4.4, '#dda44f'); dot(44, 26, 1.7, '#f8db9b');
        line('#263749', 7, [4, 54], [60, 54]); ctx.fillStyle = '#bd965f'; ctx.fillRect(26, 51, 10, 7);
      } else {
        line(style === 0 ? '#f1c8a0' : '#ead9b7', 5, [20, 4], [31, 22], [45, 4]);
        if (style === 1 || style === 2) {
          line('#704d35', 6, [15, 5], [20, 53]); line('#704d35', 6, [48, 5], [43, 53]);
          line('#deb781', 1.5, [20, 43], [43, 43]);
          for (const x of [21, 42]) { ctx.fillStyle = '#e8b153'; ctx.fillRect(x - 3, 29, 6, 6); }
        } else {
          line(style === 0 ? '#7b3a37' : '#394941', 3, [31, 21], [33, 59]);
          line('#efc397', 1.25, [43, 31], [53, 31], [52, 42], [44, 42], [43, 31]);
          for (const y of [31, 40, 49]) dot(36, y, 1.35, '#f4d9a8');
        }
      }
    });
  }
  colors.forEach((color, index) => tile(index + 12, color));
  tile(ink.map, '#efe0ba', () => {
    line('#b3ab81', 2, [22, 4], [22, 60]); line('#b3ab81', 2, [42, 4], [42, 60]);
    line('#719895', 6, [7, 43], [24, 37], [29, 29], [37, 27], [54, 9]);
    line('#a66641', 2, [9, 23], [26, 24], [39, 43], [54, 47]); dot(39, 44, 4, '#b14e3d');
  });
  texture.update(); texture.anisotropicFilteringLevel = 2;
  const material = new PBRMaterial('minifig-moulded-plastic', scene);
  material.albedoTexture = texture; material.metallic = 0; material.roughness = .31;
  material.clearCoat.isEnabled = true; material.clearCoat.intensity = .3; material.clearCoat.roughness = .2;
  materials.set(scene, material);
  return material;
}
