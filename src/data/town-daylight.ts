type RGB = [number, number, number];
const rgb = (hex: string): RGB => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as RGB;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const tint = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => mix(v, b[i], t)) as RGB;
export const daylightStep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** An authored local solar day, without requesting the reader's location. */
export function getTownDaylight(date: Date, forceNight: boolean, wet: boolean) {
  const hour = forceNight ? 22 : date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const angle = (hour - 12) * Math.PI / 12;
  const elevation = Math.cos(angle) * Math.sin(Math.PI / 3);
  const day = daylightStep(-.12, .22, elevation);
  const high = daylightStep(.08, .8, elevation);
  return {
    hour, elevation, night: 1 - day, cloud: Number(wet),
    direction: [Math.sin(angle), -Math.max(.12, elevation), .5 * Math.cos(angle)] as RGB,
    sunColor: tint(rgb('#ffd09a'), rgb('#fff4e3'), high),
    skyColor: tint(rgb('#8fa8d0'), tint(rgb('#bdc9df'), rgb('#dce8f5'), high), day),
    groundColor: tint(rgb('#373e55'), rgb('#706b5b'), day),
    sun: daylightStep(0, .16, elevation) * mix(1.1, 3.8, high),
    sky: mix(.5, .68, day), exposure: mix(.9, 1, day),
  };
}

export type TownDaylight = ReturnType<typeof getTownDaylight>;

export function blendTownDaylight(from: TownDaylight, to: TownDaylight, amount: number): TownDaylight {
  if(amount>=1)return to;
  return {
    hour: to.hour, elevation: mix(from.elevation, to.elevation, amount),
    night: mix(from.night, to.night, amount), cloud: mix(from.cloud, to.cloud, amount),
    direction: tint(from.direction, to.direction, amount),
    sunColor: tint(from.sunColor, to.sunColor, amount), skyColor: tint(from.skyColor, to.skyColor, amount),
    groundColor: tint(from.groundColor, to.groundColor, amount),
    sun: mix(from.sun, to.sun, amount), sky: mix(from.sky, to.sky, amount),
    exposure: mix(from.exposure, to.exposure, amount),
  };
}
