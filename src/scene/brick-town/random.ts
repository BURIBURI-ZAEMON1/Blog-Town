export function randomFor(seed: string) {
  let state = [...seed].reduce((sum, c) => (sum * 33 + c.charCodeAt(0)) >>> 0, 5381);
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}
