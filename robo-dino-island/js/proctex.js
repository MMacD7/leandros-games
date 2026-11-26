// Procedural canvas textures (leaves, bark, smoke, glow, water normals).
import * as THREE from './vendor/three.bundle.min.js';
import { rng } from './noise.js';

const TEX2 = !/iPhone|Android/.test(navigator.userAgent || '');
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function canvas2(w, h) { const S = TEX2 ? 2 : 1; const [c, g] = canvas(w * S, h * S); if (S > 1) g.scale(S, S); return [c, g]; }
function tex(c, srgb = true, repeat = false) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; return t;
}

export function leafTexture() {
  // palm frond: central rib along +y, leaflets angled outwards. Alpha cut-out.
  const [c, g] = canvas2(256, 512); const r = rng(7);
  g.clearRect(0, 0, 256, 512);
  for (let i = 0; i < 46; i++) {
    const y = 500 - i * 10.5, len = 118 * Math.sin(Math.min(1, (i + 3) / 40) * Math.PI * 0.92) + 8;
    for (const s of [-1, 1]) {
      const hue = 85 + r() * 25, l = 22 + r() * 14;
      g.strokeStyle = `hsl(${hue},${55 + r() * 20}%,${l}%)`; g.lineWidth = 7 + r() * 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(128, y); g.quadraticCurveTo(128 + s * len * 0.5, y - 8, 128 + s * len, y - 26 - r() * 10); g.stroke();
      g.strokeStyle = `hsla(${hue},60%,${l + 18}%,0.6)`; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(128, y); g.quadraticCurveTo(128 + s * len * 0.5, y - 8, 128 + s * len, y - 26); g.stroke();
    }
  }
  g.strokeStyle = '#6b7a2c'; g.lineWidth = 6; g.beginPath(); g.moveTo(128, 512); g.lineTo(128, 0); g.stroke();
  const t = tex(c); t.generateMipmaps = true; return t;
}

export function broadLeafTexture() {
  // cluster of broad tropical leaves for bushes / jungle trees
  const [c, g] = canvas2(256, 256); const r = rng(11);
  for (let i = 0; i < 26; i++) {
    const x = 30 + r() * 196, y = 30 + r() * 196, a = r() * Math.PI * 2, L = 40 + r() * 40, W = L * 0.42;
    g.save(); g.translate(x, y); g.rotate(a);
    const grd = g.createLinearGradient(0, -W, 0, W); const h = 90 + r() * 30, l = 20 + r() * 16;
    grd.addColorStop(0, `hsl(${h},55%,${l}%)`); grd.addColorStop(0.5, `hsl(${h},60%,${l + 14}%)`); grd.addColorStop(1, `hsl(${h},55%,${l - 4}%)`);
    g.fillStyle = grd; g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -W, L / 2, 0); g.quadraticCurveTo(0, W, -L / 2, 0); g.fill();
    g.strokeStyle = `hsla(${h},40%,${l + 30}%,0.6)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
    g.restore();
  }
  return tex(c);
}

export function barkTexture() {
  const [c, g] = canvas2(128, 256); const r = rng(3);
  g.fillStyle = '#6d5a45'; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 16) {
    const grd = g.createLinearGradient(0, y, 0, y + 16); grd.addColorStop(0, '#4a3b2c'); grd.addColorStop(0.35, '#8a7558'); grd.addColorStop(1, '#5a4836');
    g.fillStyle = grd; g.fillRect(0, y, 128, 16);
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '30,22,15' : '160,140,110'},${r() * 0.25})`; g.fillRect(r() * 128, r() * 256, 1 + r() * 3, 1 + r() * 6); }
  return tex(c, true, true);
}

export function smokeTexture() {
  const [c, g] = canvas(128, 128); const r = rng(5);
  for (let i = 0; i < 24; i++) {
    const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, rad = 18 + r() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  const img = g.getImageData(0, 0, 128, 128), d = img.data;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const dx = (x - 64) / 64, dy = (y - 64) / 64, f = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)); d[(y * 128 + x) * 4 + 3] *= Math.min(1, f * 1.8); }
  g.putImageData(img, 0, 0);
  return tex(c, false);
}

export function glowTexture() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.85)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.3)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return tex(c, false);
}

export function waterNormal() {
  // tileable normal map from periodic waves
  const N = 256, [c, g] = canvas(N, N); const img = g.createImageData(N, N), d = img.data; const r = rng(9);
  const waves = []; for (let i = 0; i < 14; i++) waves.push([((r() * 9) | 0) - 4, ((r() * 9) | 0) - 4, r() * 6.28, 0.3 + r()]);
  const h = (x, y) => { let s = 0; for (const [a, b, p, amp] of waves) s += Math.sin((a * x + b * y) * 2 * Math.PI / N + p) * amp / (1 + Math.hypot(a, b) * 0.3); return s; };
  const H = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) H[y * N + x] = h(x, y);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = H[y * N + ((x + 1) % N)] - H[y * N + ((x + N - 1) % N)], dy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
    let nx = -dx * 2, ny = -dy * 2, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * N + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return tex(c, false, true);
}

// ---------- reptile scales: tileable voronoi height -> albedo (grayscale, multiplied by vertex colour) + normal map ----------
function voronoiLayer(N, cells, seed, H, amp, round) {
  const r = rng(seed), pts = new Float32Array(cells * cells * 2), shade = new Float32Array(cells * cells);
  for (let i = 0; i < cells * cells; i++) { pts[i * 2] = r(); pts[i * 2 + 1] = r(); shade[i] = r(); }
  const cs = N / cells, S = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gx = x / cs, gy = y / cs, cx = Math.floor(gx), cy = Math.floor(gy); let f1 = 9, f2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const X = cx + i, Y = cy + j, wx = (X + cells) % cells, wy = (Y + cells) % cells, k = wy * cells + wx;
      // stagger rows a little so scales look like overlapping rows rather than a grid
      const px = X + 0.15 + pts[k * 2] * 0.7 + ((Y & 1) ? 0.35 : 0), py = Y + 0.15 + pts[k * 2 + 1] * 0.7;
      const d = Math.hypot(px - gx, (py - gy) * 1.15);
      if (d < f1) { f2 = f1; f1 = d; id = k; } else if (d < f2) f2 = d;
    }
    const e = Math.min(1, (f2 - f1) * round); const h = Math.sqrt(e) * (0.85 + 0.3 * shade[id]);
    H[y * N + x] += h * amp; S[y * N + x] = shade[id];
  }
  return S;
}
let _scales = null;
export function scaleTextures() {
  if (_scales) return _scales;
  const N = 512, H = new Float32Array(N * N);
  const big = voronoiLayer(N, 14, 21, H, 1.0, 2.6);
  const small = voronoiLayer(N, 44, 22, H, 0.35, 3.2);
  const [c1, g1] = canvas(N, N), [c2, g2] = canvas(N, N);
  const A = g1.createImageData(N, N), Nm = g2.createImageData(N, N), a = A.data, n = Nm.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, h = H[i];
    const hx = H[y * N + ((x + 1) % N)] - H[y * N + ((x + N - 1) % N)], hy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
    let nx = -hx * 3.2, ny = -hy * 3.2, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    n[i * 4] = (nx * 0.5 + 0.5) * 255; n[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; n[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; n[i * 4 + 3] = 255;
    // crevices dark, scale centres lighter, a little per-scale variation
    const v = 0.42 + 0.5 * Math.min(1, h / 1.1) + (big[i] - 0.5) * 0.18 + (small[i] - 0.5) * 0.06;
    const c = Math.max(0, Math.min(255, v * 235));
    a[i * 4] = c; a[i * 4 + 1] = c * 0.98; a[i * 4 + 2] = c * 0.95; a[i * 4 + 3] = 255;
  }
  g1.putImageData(A, 0, 0); g2.putImageData(Nm, 0, 0);
  const map = tex(c1, true, true), normal = tex(c2, false, true); map.anisotropy = normal.anisotropy = 8;
  _scales = { map, normal }; return _scales;
}

// ---------- battle damage for the robots: scratches, scorch marks, chipped paint (multiplied over the plate colour) ----------
let _dmg = null;
export function battleDamageTexture() { return _dmg || (_dmg = buildBattleDamage()); }
function buildBattleDamage() {
  const N = 512, [c, g] = canvas(N, N), r = rng(31);
  g.fillStyle = '#E6E6E6'; g.fillRect(0, 0, N, N);
  // grime / soot gradients (lighter so the plate colour stays in range)
  for (let i = 0; i < 26; i++) { const x = r() * N, y = r() * N, rad = 20 + r() * 70; const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(20,16,12,${(0.35 + r() * 0.35) * 0.6})`); grd.addColorStop(1, 'rgba(20,16,12,0)'); g.fillStyle = grd;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.save(); g.translate(ox, oy); g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.restore(); } }
  // scratches: bright thin lines (bare metal) with a dark edge
  for (let i = 0; i < 140; i++) { const x = r() * N, y = r() * N, a = r() * Math.PI, L = 10 + r() * 60, w = 0.6 + r() * 1.6;
    for (const [col, ww] of [['rgba(30,30,30,0.5)', w + 1.2], [`rgba(255,255,255,${0.55 + r() * 0.4})`, w]]) {
      g.strokeStyle = col; g.lineWidth = ww; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 8, y + Math.sin(a) * L * 0.5 + (r() - 0.5) * 8, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); } }
  // claw-mark triples
  for (let i = 0; i < 6; i++) { const x = r() * N, y = r() * N, a = r() * Math.PI; for (let k = 0; k < 3; k++) { g.strokeStyle = 'rgba(15,15,15,0.75)'; g.lineWidth = 3; g.beginPath();
    const ox = Math.cos(a + 1.57) * k * 9, oy = Math.sin(a + 1.57) * k * 9; g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * 50, y + oy + Math.sin(a) * 50); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.stroke(); } }
  // chipped paint flecks
  for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.6 ? `rgba(255,255,255,${r() * 0.5})` : `rgba(0,0,0,${r() * 0.5})`; g.fillRect(r() * N, r() * N, 1 + r() * 3, 1 + r() * 3); }
  // rivets / panel seams
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(0, k * 128 + 3); g.lineTo(N, k * 128 + 3); g.stroke(); g.beginPath(); g.moveTo(k * 128 + 3, 0); g.lineTo(k * 128 + 3, N); g.stroke(); }
  for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x * 32 + 10, y * 128 + 12, 2.4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x * 32 + 9.4, y * 128 + 11.4, 1, 0, 7); g.fill(); }
  const t = tex(c, true, true); t.anisotropy = 8; return t;
}

let _panels = null;
export function panelTextures() {
  if (_panels) return _panels;
  const N = 512, H = new Float32Array(N * N), R = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = Math.min(x % 128, 128 - (x % 128)), sy = Math.min(y % 128, 128 - (y % 128));
    const seam = Math.min(sx, sy);
    let h = 0.55;
    if (seam < 2) h = 0.12; else if (seam < 4) h = 0.32;
    const dx = (x % 32) - 10, dy = (y % 128) - 12, d = Math.hypot(dx, dy);
    if (d < 4.2) h = Math.max(h, 0.95 - d * 0.12);
    H[y * N + x] = h;
    const scratch = ((x * 13 + y * 7) % 97) < 2;
    R[y * N + x] = scratch ? 46 : seam < 3 ? 178 : 82;
  }
  const [cN, gN] = canvas(N, N), [cR, gR] = canvas(N, N);
  const Nm = gN.createImageData(N, N), Rm = gR.createImageData(N, N), n = Nm.data, r = Rm.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const hx = H[y * N + ((x + 1) % N)] - H[y * N + ((x + N - 1) % N)];
    const hy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
    let nx = -hx * 4, ny = -hy * 4, nz = 1, l = Math.hypot(nx, ny, nz) || 1;
    n[i * 4] = (nx / l * 0.5 + 0.5) * 255; n[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; n[i * 4 + 2] = (nz / l * 0.5 + 0.5) * 255; n[i * 4 + 3] = 255;
    const v = R[i]; r[i * 4] = r[i * 4 + 1] = r[i * 4 + 2] = v; r[i * 4 + 3] = 255;
  }
  gN.putImageData(Nm, 0, 0); gR.putImageData(Rm, 0, 0);
  const normal = tex(cN, false, true), rough = tex(cR, false, true);
  normal.anisotropy = rough.anisotropy = 8;
  _panels = { normal, rough }; return _panels;
}

let _membrane = null;
export function membraneTexture() {
  if (_membrane) return _membrane;
  const W = 256, H = 512, [c, g] = canvas(W, H);
  const grd = g.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.5, H * 0.72);
  grd.addColorStop(0, '#fff4e0'); grd.addColorStop(0.45, '#d8c8b0'); grd.addColorStop(1, '#6a5848');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.lineCap = 'round';
  const vein = (x, y, a, len, depth) => {
    if (depth > 5 || len < 8) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    vein(x2, y2, a - 0.45, len * 0.62, depth + 1);
    vein(x2, y2, a + 0.4, len * 0.58, depth + 1);
  };
  for (let i = 0; i < 7; i++) vein(20 + i * 36, 8, Math.PI * 0.5 + (i - 3) * 0.08, 150, 0);
  const t = tex(c, true, true); t.anisotropy = 8; _membrane = t; return t;
}

let _bio = null;
export function bioTexture() {
  if (_bio) return _bio;
  const N = 256, [c, g] = canvas(N, N), r = rng(19);
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 46; i++) {
    const x = r() * N, y = r() * N, rad = 4 + r() * 14;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.setLineDash([10, 8]);
  g.beginPath(); g.moveTo(0, 78); g.lineTo(N, 96); g.stroke();
  g.beginPath(); g.moveTo(0, 168); g.lineTo(N, 150); g.stroke();
  const t = tex(c, true, true); t.anisotropy = 4; _bio = t; return t;
}

// v5.16 fish scales: overlapping crescent rows, half a scale offset, 16 across. Cached like scaleTextures().
let _fishScale = null;
export function fishScaleTextures() {
  if (_fishScale) return _fishScale;
  const N = 256, across = 16, cell = N / across;
  const H = new Float32Array(N * N);
  const rad = cell * 0.72;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const row = Math.floor(y / cell);
    const off = (row & 1) ? cell * 0.5 : 0;
    const lx = (x + off) % N;
    const cx = (Math.floor(lx / cell) + 0.5) * cell;
    const cy = row * cell + cell * 0.72;
    let dx = lx - cx; if (dx > cell) dx -= cell;
    const dy = y - cy;
    const d = Math.hypot(dx, dy * 1.08);
    let h = 0.22;
    if (d < rad) {
      const edge = Math.abs(d - rad * 0.9);
      const rim = Math.max(0, 1 - edge / (cell * 0.11));
      const inner = Math.max(0, 1 - d / (rad * 0.62));
      h = 0.28 + rim * 0.72 - inner * 0.34;
    }
    H[y * N + x] = h;
  }
  const [c1, g1] = canvas(N, N), [c2, g2] = canvas(N, N);
  const A = g1.createImageData(N, N), Nm = g2.createImageData(N, N), a = A.data, n = Nm.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, h = H[i];
    const hx = H[y * N + ((x + 1) % N)] - H[y * N + ((x + N - 1) % N)];
    const hy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
    let nx = -hx * 2.5, ny = -hy * 2.5, nz = 1, l = Math.hypot(nx, ny, nz) || 1;
    n[i * 4] = (nx / l * 0.5 + 0.5) * 255; n[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; n[i * 4 + 2] = (nz / l * 0.5 + 0.5) * 255; n[i * 4 + 3] = 255;
    const rim = Math.max(0, Math.min(1, (h - 0.55) / 0.4));
    const dark = Math.max(0, Math.min(1, (0.4 - h) / 0.25));
    const v = Math.max(0, Math.min(255, 232 + rim * 23 - dark * 36));
    a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = v; a[i * 4 + 3] = 255;
  }
  g1.putImageData(A, 0, 0); g2.putImageData(Nm, 0, 0);
  const map = tex(c1, true, true), normal = tex(c2, false, true);
  map.anisotropy = normal.anisotropy = 8;
  _fishScale = { map, normal }; return _fishScale;
}

// fine shark-skin bump plus a raised lateral line on each flank (u = 0.25 and 0.75)
let _skinDetail = null;
export function skinDetailTexture() {
  if (_skinDetail) return _skinDetail;
  const N = 256, H = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const nse = Math.sin(x * 0.85) * Math.sin(y * 1.7) * 0.08 + Math.sin(x * 2.3 + y * 1.1) * 0.04;
    const u = x / N;
    const flank = Math.min(Math.abs(u - 0.25), Math.abs(u - 0.75)) * N;
    const line = flank < 2.2 ? (1 - flank / 2.2) * 0.85 : 0;
    H[y * N + x] = 0.45 + nse + line;
  }
  const [c, g] = canvas(N, N), img = g.createImageData(N, N), d = img.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const hx = H[y * N + ((x + 1) % N)] - H[y * N + ((x + N - 1) % N)];
    const hy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
    let nx = -hx * 3.2, ny = -hy * 3.2, nz = 1, l = Math.hypot(nx, ny, nz) || 1;
    d[i * 4] = (nx / l * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; d[i * 4 + 2] = (nz / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const normal = tex(c, false, true); normal.anisotropy = 8;
  _skinDetail = normal; return normal;
}

// radial fin rays: 1 px light lines from the base, opaque at the base, 70% at the tips, soft rim
let _finRay = null;
export function finRayTexture() {
  if (_finRay) return _finRay;
  const W = 256, H = 128, [cM, gM] = canvas(W, H), [cA, gA] = canvas(W, H);
  const mapI = gM.createImageData(W, H), alpI = gA.createImageData(W, H), md = mapI.data, ad = alpI.data;
  const rays = 14;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / (W - 1), v = y / (H - 1);
    const ang = Math.atan2((u - 0.5) * 2.1, v + 0.04);
    const slot = (ang / Math.PI + 0.5) * rays;
    const dist = Math.abs(slot - Math.round(slot));
    const line = dist < 0.045 ? 1 : dist < 0.09 ? (0.09 - dist) / 0.045 : 0;
    const rim = Math.max(0, Math.min(1, (v - 0.9) / 0.1)) * 0.85 + (u < 0.04 || u > 0.96 ? 0.35 : 0);
    const lit = Math.max(0, Math.min(255, 214 + line * 41 + rim * 30));
    const i = (y * W + x) * 4;
    md[i] = md[i + 1] = md[i + 2] = lit; md[i + 3] = 255;
    const a = Math.max(0, Math.min(255, (1 - v * 0.3) * 255));
    ad[i] = ad[i + 1] = ad[i + 2] = a; ad[i + 3] = 255;
  }
  gM.putImageData(mapI, 0, 0); gA.putImageData(alpI, 0, 0);
  const map = tex(cM, true, true), alpha = tex(cA, false, true);
  map.anisotropy = alpha.anisotropy = 8;
  _finRay = { map, alpha }; return _finRay;
}
