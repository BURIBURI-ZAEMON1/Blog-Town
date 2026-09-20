const hash = (value: string) => [...value].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
const randomFor = (seed: string) => {
  let state = hash(seed);
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

export const createGroundTextureData = (seed: string, width = 256, height = 256) => {
  const random = randomFor(`${seed}:ground-texture-data`);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const broad = Math.sin(x * 0.055) * 5 + Math.cos(y * 0.047) * 4 + Math.sin((x + y) * 0.021) * 3;
      const grain = (random() - 0.5) * 13;
      const speckle = random() > 0.965 ? -24 - random() * 18 : random() > 0.975 ? 13 : 0;
      const index = (y * width + x) * 4;
      data[index] = clampByte(242 + broad + grain + speckle);
      data[index + 1] = clampByte(240 + broad * 0.82 + grain * 0.72 + speckle * 0.76);
      data[index + 2] = clampByte(218 + broad * 0.55 + grain * 0.45 + speckle * 0.42);
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
};

export const createRoadTextureData = (seed: string, width = 256, height = 128) => {
  const random = randomFor(`${seed}:road-texture-data`);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const band = Math.sin(x * 0.08 + Math.sin(y * 0.03)) * 4 + Math.cos(y * 0.12) * 2;
      const grain = (random() - 0.5) * 18;
      const rut = Math.abs((y % 38) - 19) < 1.4 ? -18 : 0;
      const index = (y * width + x) * 4;
      data[index] = clampByte(221 + band + grain + rut);
      data[index + 1] = clampByte(191 + band * 0.72 + grain * 0.7 + rut);
      data[index + 2] = clampByte(143 + band * 0.45 + grain * 0.45 + rut * 0.72);
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
};
