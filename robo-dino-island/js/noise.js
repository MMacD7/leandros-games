// Small deterministic noise helpers (gradient noise + fbm) and a seeded RNG.
const P = new Uint8Array(512);
(function () { let s = 1337; const p = []; for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255]; })();
const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
export function noise2(x, y) {
  const X = Math.floor(x), Y = Math.floor(y); x -= X; y -= Y; const xi = X & 255, yi = Y & 255;
  const g = (i, j, dx, dy) => { const h = G[P[P[xi + i] + yi + j] & 7]; return h[0] * dx + h[1] * dy; };
  const u = fade(x), v = fade(y);
  const a = g(0, 0, x, y) + u * (g(1, 0, x - 1, y) - g(0, 0, x, y));
  const b = g(0, 1, x, y - 1) + u * (g(1, 1, x - 1, y - 1) - g(0, 1, x, y - 1));
  return (a + v * (b - a)) * 0.7071 * 1.4;
}
export function fbm(x, y, oct = 5) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
