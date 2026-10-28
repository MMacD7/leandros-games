// v5.1 FARTY POOP FARM (level 5): a friendly, silly farm. Leandro walks around feeding the animals (who are very
// happy... then toot and poop), rides the horse, calls Ricky & Bobby to herd a runaway piggy, and presses the
// BAD DAVID button to make a cheeky little troublemaker do something naughty (but gentle: no animal is ever hurt).
// Everything is procedural: vertex-coloured merged geometry, canvas-drawn icons, WebAudio sounds (audio.js).
// Bad David is an original character for this game (messy hair, big gap-tooth grin, striped shirt).
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { fbm, noise2, rng, smooth, clamp, lerp } from './noise.js';
import { sfx } from './audio.js';
import { voice } from './voice.js';
import { Rider } from './rider.js';
import { music } from './music.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
const pick = a => a[(Math.random() * a.length) | 0];
const $ = id => document.getElementById(id);

// ---------------- layout (world metres; the farmhouse sits where the robot hangar is on other levels) ----------------
export const FARM = {
  house: { x: 15, z: 230 }, barn: { x: -28, z: 160 }, silo: { x: -45, z: 145 }, coop: { x: -39, z: 192 },
  yard: { x: 14, z: 182 },
  pens: {
    cow: { x: 60, z: 150, w: 36, d: 30, gate: 'w' },
    pig: { x: -6, z: 116, w: 24, d: 20, gate: 'n' },
    sheep: { x: 52, z: 100, w: 32, d: 26, gate: 'n' },
    horse: { x: 62, z: 198, w: 26, d: 22, gate: 'w' },
    chick: { x: -34, z: 192, w: 20, d: 16, gate: 'e' },
  },
  pond: { x: -68, z: 126, r: 18 },
  mud: [[24, 140, 6], [-11, 111, 4.5], [0, 121, 3], [-49, 141, 3.2], [40, 177, 2.4], [66, 140, 2.6]],
  corn: { x0: -100, x1: -62, z0: 168, z1: 214 },
  pumpkins: { x0: 84, x1: 106, z0: 118, z1: 160 },
  tractor: { x: 4, z: 150 }, castle: { x: 30, z: 171, h: 5.6 }, windmill: { x: -64, z: 94 }, sign: { x: 6, z: 194 },
};
const GATE_W = 6;
function gateOf(P) { const o = P.gate === 'w' ? [-1, 0] : P.gate === 'e' ? [1, 0] : P.gate === 'n' ? [0, 1] : [0, -1];
  return { x: P.x + o[0] * P.w / 2, z: P.z + o[1] * P.d / 2, ox: o[0], oz: o[1] }; }
const inPen = (P, x, z, m = 0) => Math.abs(x - P.x) < P.w / 2 - m && Math.abs(z - P.z) < P.d / 2 - m;
function segD(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(x - ax - dx * t, z - az - dz * t); }
const PATHS = [[15, 224, 14, 192], [6, 180, -16, 163], [22, 176, 40, 151], [26, 186, 47, 198], [3, 187, -22, 192], [10, 170, -6, 128], [16, 150, 50, 115], [-38, 172, -60, 190], [-30, 148, -52, 134], [14, 170, 14, 150]];

// ---------------- terrain ----------------
export function rawHeightFarm(x, z) {
  const d0 = Math.hypot(x, z - 60), r = d0 / 320 + fbm(x * 0.006 + 3.1, z * 0.006 - 1.7, 3) * 0.08;
  const land = 1 - smooth(0.78, 1.0, r);
  let h = -9 + land * 13.2 + fbm(x * 0.02, z * 0.02, 3) * 0.9 * land;
  const dc = Math.hypot(x - 5, z - 160);
  h += smooth(118, 205, dc) * smooth(0.95, 0.62, r) * Math.max(0, fbm(x * 0.009 + 4, z * 0.009, 4) + 0.3) * 32; // rolling green hills around the farm
  h = lerp(h, 4.0 + fbm(x * 0.015, z * 0.015, 2) * 0.35, 1 - smooth(112, 138, dc)); // the farm itself is flat
  const P = FARM.pond, dp = Math.hypot(x - P.x, z - P.z) / P.r; if (dp < 1.4) h = lerp(-2.8, h, smooth(0.25, 1.3, dp));
  return h;
}
// 0..1 bare-earth amount (yard, paths, pig pen, chicken run, crop rows) used by the splat map
export function farmDirt(x, z) {
  let d = 1 - smooth(10, 16, Math.hypot(x - FARM.yard.x, z - FARM.yard.z));
  for (const s of PATHS) d = Math.max(d, 1 - smooth(1.4, 3.0, segD(x, z, s[0], s[1], s[2], s[3])));
  const p = FARM.pens; if (inPen(p.pig, x, z)) d = Math.max(d, 0.95); if (inPen(p.chick, x, z)) d = Math.max(d, 0.75);
  if (inPen(p.horse, x, z)) d = Math.max(d, 0.3 + 0.3 * smooth(0, 0.4, fbm(x * 0.1, z * 0.1, 2)));
  const C = FARM.corn; if (x > C.x0 - 1 && x < C.x1 + 1 && z > C.z0 - 1 && z < C.z1 + 1) d = Math.max(d, 0.6 + 0.4 * Math.abs(Math.sin((x - C.x0) / 2.6 * Math.PI)));
  const K = FARM.pumpkins; if (x > K.x0 && x < K.x1 && z > K.z0 && z < K.z1) d = Math.max(d, 0.55);
  if (x > -19 && x < -8 && z > 153 && z < 167) d = Math.max(d, 0.85); // barn apron
  return clamp(d * (0.85 + 0.3 * noise2(x * 0.15, z * 0.15)), 0, 1);
}
export const farmGLSL = () => '';

// ---------------- geometry helpers: vertex-coloured parts merged into one mesh ----------------
function C(geo, col, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo; for (const a of ['uv', 'uv1', 'uv2']) if (g.attributes[a]) g.deleteAttribute(a);
  g.scale(sx, sy, sz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z);
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const SPH = (r = 1, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
const CONE = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
let MAT = null;
function mats() {
  if (MAT) return MAT;
  MAT = { vc: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
    vcD: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide }),
    mud: new THREE.MeshStandardMaterial({ color: 0x5a3818, roughness: 0.22, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    poop: new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.35, metalness: 0 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffc22a, roughness: 0.18, metalness: 0.9, emissive: 0x7a4a00, emissiveIntensity: 0.6 }),
    eyes: new THREE.MeshBasicMaterial({ vertexColors: true }),
    print: new THREE.MeshStandardMaterial({ color: 0x4a2c14, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };
  return MAT;
}
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
// a "frame" so props can be built in local coords (x right, y up, z forward) then placed + turned
class Batch {
  constructor() { this.list = []; this.m = new THREE.Matrix4(); }
  at(x, y, z, ry = 0) { this.m.compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(1, 1, 1)); return this; }
  add(g) { g.applyMatrix4(this.m); this.list.push(g); return this; }
  build(mat, parent, shadow = true) { if (!this.list.length) return null; const g = mergeGeometries(this.list); g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); this.list = []; return m; }
}
// extruded profile (in local XY) along z, centred
function prism(pts, len) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); return g; }
// roof boards over a profile's top chain
function roofOver(B, chain, len, col, th = 0.28, over = 0.6) {
  for (let i = 0; i < chain.length - 1; i++) { const [ax, ay] = chain[i], [bx, by] = chain[i + 1], L = Math.hypot(bx - ax, by - ay), a = Math.atan2(by - ay, bx - ax), nx = -Math.sin(a), ny = Math.cos(a);
    B.add(C(BOX(L + 0.5, th, len + over * 2), col, (ax + bx) / 2 + nx * th / 2, (ay + by) / 2 + ny * th / 2, 0, 1, 1, 1, 0, 0, a)); }
}

// ---------------- static farm scenery (called from World on the farm level) ----------------
export function buildFarm(W) {
  const M = mats(), root = new THREE.Group(); root.name = 'farm'; W.root.add(root); W.farmRoot = root;
  const gy = (x, z) => W.height(x, z), B = new Batch(), r = rng(77);
  const RED = 0xb8322a, WHITE = 0xf4f1e8, WOOD = 0x8b5a2b, WOOD2 = 0xa8743f, DARK = 0x2a2420, STRAW = 0xe8c65a;
  const F = W.farmData = { bales: [], mud: FARM.mud.map(m => ({ x: m[0], z: m[1], r: m[2] })), fan: null, coopDoor: null, chimney: null, ducks: [] };
  // --- big red barn (front doors face +x, toward the yard) ---
  { const b = FARM.barn, y = gy(b.x + 10, b.z), Wd = 16, L = 20, wh = 6.5, rh = 5.5; B.at(b.x, y, b.z, Math.PI / 2);
    const prof = [[-Wd / 2, 0], [Wd / 2, 0], [Wd / 2, wh], [Wd * 0.3, wh + rh * 0.72], [0, wh + rh], [-Wd * 0.3, wh + rh * 0.72], [-Wd / 2, wh]];
    B.add(C(prism(prof, L), RED)); roofOver(B, [[-Wd / 2 - 0.4, wh - 0.3], [-Wd * 0.3, wh + rh * 0.72], [0, wh + rh], [Wd * 0.3, wh + rh * 0.72], [Wd / 2 + 0.4, wh - 0.3]], L, 0x6e2a22);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(C(BOX(0.45, wh, 0.45), WHITE, sx * Wd / 2, wh / 2, sz * L / 2));
    const fz = L / 2 + 0.06; B.add(C(BOX(7.6, 6, 0.2), WHITE, 0, 3, fz)); // door frame
    for (const s of [-1, 1]) { B.add(C(BOX(3.4, 5.4, 0.24), 0x9e2a22, s * 1.8, 2.75, fz + 0.04)); const a = Math.atan2(5.4, 3.4);
      B.add(C(BOX(6.1, 0.28, 0.1), WHITE, s * 1.8, 2.75, fz + 0.2, 1, 1, 1, 0, 0, a)); B.add(C(BOX(6.1, 0.28, 0.1), WHITE, s * 1.8, 2.75, fz + 0.2, 1, 1, 1, 0, 0, -a));
      B.add(C(BOX(3.4, 0.28, 0.1), WHITE, s * 1.8, 5.35, fz + 0.2)); B.add(C(BOX(3.4, 0.28, 0.1), WHITE, s * 1.8, 0.2, fz + 0.2)); }
    B.add(C(BOX(3.2, 2.6, 0.2), WHITE, 0, wh + 2.0, fz)); B.add(C(BOX(2.6, 2.0, 0.24), 0x3b2a1a, 0, wh + 2.0, fz + 0.03)); B.add(C(BOX(2.4, 0.9, 0.5), STRAW, 0, wh + 1.3, fz + 0.1)); // hay loft
    for (const s of [-1, 1]) for (const zz of [-5, 3]) { B.add(C(BOX(0.2, 1.8, 1.8), WHITE, s * (Wd / 2 + 0.05), 3.6, zz)); B.add(C(BOX(0.24, 1.4, 1.4), 0x3b2a1a, s * (Wd / 2 + 0.06), 3.6, zz)); }
    B.add(C(CYL(0.06, 0.06, 2.2, 5), DARK, 0, wh + rh + 1.1, 0)); B.add(C(BOX(0.12, 0.5, 0.9), DARK, 0, wh + rh + 2.1, 0.1)); // weather vane
    for (const x of [-37, -29, -21]) W.addCollider(x, b.z, 8.3, 14); }
  // --- farmhouse (front porch faces the yard, -z) ---
  { const h = FARM.house, y = gy(h.x, h.z), Wd = 14, L = 10, wh = 5.5, rh = 4; B.at(h.x, y, h.z, Math.PI);
    B.add(C(BOX(Wd, wh, L), 0xf3ecd9, 0, wh / 2, 0)); B.add(C(prism([[-Wd / 2, wh], [Wd / 2, wh], [0, wh + rh]], L), 0xf3ecd9, 0, 0, 0, 1, 1, 1, 0, 0, 0));
    roofOver(B, [[-Wd / 2 - 0.6, wh - 0.4], [0, wh + rh], [Wd / 2 + 0.6, wh - 0.4]], L, 0x3e5a7a, 0.32, 0.5);
    B.add(C(BOX(1.5, 4.5, 1.5), 0x9a4a35, 3.8, wh + 2.6, -1.5)); F.chimney = V(h.x - 3.8, y + wh + 5.2, h.z + 1.5);
    const fz = L / 2 + 0.05; B.add(C(BOX(1.8, 3.0, 0.15), 0x9c2b2b, 0, 1.5, fz)); B.add(C(SPH(0.09, 6, 4), 0xffd23a, 0.6, 1.5, fz + 0.12));
    for (const x of [-4.2, 4.2]) for (const yy of [2.2]) { B.add(C(BOX(2.0, 1.7, 0.12), WHITE, x, yy, fz)); B.add(C(BOX(1.6, 1.3, 0.14), 0x9fd3ff, x, yy, fz + 0.02)); for (const s of [-1, 1]) B.add(C(BOX(0.55, 1.7, 0.1), 0x2f6b3a, x + s * 1.35, yy, fz + 0.03)); }
    for (const x of [-4.2, 0, 4.2]) { B.add(C(BOX(2.0, 1.5, 0.12), WHITE, x, 4.2, fz)); B.add(C(BOX(1.6, 1.1, 0.14), 0x9fd3ff, x, 4.2, fz + 0.02)); }
    B.add(C(BOX(Wd + 1, 0.3, 3.2), WOOD2, 0, 0.15, fz + 1.6)); B.add(C(BOX(Wd + 1.4, 0.25, 3.6), 0x7a5a3a, 0, 3.3, fz + 1.7, 1, 1, 1, -0.12, 0, 0));
    for (const x of [-7, -2.5, 2.5, 7]) B.add(C(BOX(0.25, 3.2, 0.25), WHITE, x, 1.65, fz + 3.0));
    for (const s of [-1, 1]) B.add(C(BOX(1.2, 1.3, 0.8), 0x8a5a3a, s * 5.5, 0.95, fz + 1.2)); // porch rocking chairs
    W.addCollider(h.x - 5, h.z, 5.5, 12); W.addCollider(h.x + 5, h.z, 5.5, 12); }
  // --- silo ---
  { const s = FARM.silo, y = gy(s.x, s.z); B.at(s.x, y, s.z, 0); B.add(C(CYL(4, 4, 17, 20), 0xc9d3dc, 0, 8.5, 0));
    for (const yy of [3, 7, 11, 15]) B.add(C(CYL(4.08, 4.08, 0.25, 20), 0x8a96a2, 0, yy, 0));
    B.add(C(new THREE.SphereGeometry(4.05, 20, 8, 0, TAU, 0, Math.PI / 2), 0xb8c2cc, 0, 17, 0)); B.add(C(BOX(0.6, 17, 0.12), 0x5a6068, 0, 8.5, 4.05));
    W.addCollider(s.x, s.z, 4.4, 22); }
  // --- v5.3 BIG walk-in chicken coop (in the chicken run, open front faces +x): straw floor, 6 nest boxes along the back ---
  { const c = FARM.coop, y = gy(c.x, c.z); B.at(c.x, y, c.z, Math.PI / 2); const Wd = 8.4, Dp = 6.4, H = 3.6, RED = 0xc0392b;
    B.add(C(BOX(Wd, 0.25, Dp), 0xd8b860, 0, 0.12, 0)); // straw floor
    B.add(C(BOX(Wd, H, 0.3), RED, 0, H / 2, -Dp / 2)); for (const s of [-1, 1]) B.add(C(BOX(0.3, H, Dp), RED, s * Wd / 2, H / 2, 0));
    for (const s of [-1, 1]) B.add(C(BOX(2.2, H, 0.3), RED, s * (Wd / 2 - 1.1), H / 2, Dp / 2)); B.add(C(BOX(Wd, 0.7, 0.3), RED, 0, H - 0.35, Dp / 2)); // open doorway in the middle
    for (const s of [-1, 1]) B.add(C(BOX(0.18, H, 0.34), WHITE, s * 2.0, H / 2, Dp / 2 + 0.02)); B.add(C(BOX(4.2, 0.22, 0.34), WHITE, 0, H - 0.72, Dp / 2 + 0.02));
    B.add(C(prism([[-Wd / 2 - 0.4, H], [Wd / 2 + 0.4, H], [0, H + 2.2]], Dp + 0.2), WHITE)); roofOver(B, [[-Wd / 2 - 0.6, H - 0.1], [0, H + 2.25], [Wd / 2 + 0.6, H - 0.1]], Dp + 0.9, 0x5a4a3a, 0.2, 0.3);
    for (let i = 0; i < 6; i++) { const x = -Wd / 2 + 0.9 + i * (Wd - 1.8) / 5; B.add(C(BOX(1.1, 0.9, 1.0), WOOD, x, 1.1, -Dp / 2 + 0.7)); B.add(C(CYL(0.42, 0.38, 0.2, 10), 0xe8c65a, x, 1.6, -Dp / 2 + 0.75)); }
    B.add(C(BOX(Wd - 1, 0.12, 0.12), WOOD2, 0, 2.3, -0.4)); // a perch
    B.add(C(BOX(1.4, 0.1, 2.6), WOOD2, 0, 0.35, Dp / 2 + 1.3, 1, 1, 1, 0.2, 0, 0)); // ramp
    // walls collide (as a row of small circles) but the doorway is open so Leandro can walk in
    const cq = Math.cos(Math.PI / 2), sq = Math.sin(Math.PI / 2), wpt = (lx, lz) => [c.x + lx * cq + lz * sq, c.z - lx * sq + lz * cq];
    for (let i = 0; i <= 8; i++) { const lx = -Wd / 2 + i * Wd / 8; W.addCollider(...wpt(lx, -Dp / 2), 0.6, H); }
    for (const s of [-1, 1]) for (let i = 0; i <= 6; i++) W.addCollider(...wpt(s * Wd / 2, -Dp / 2 + i * Dp / 6), 0.6, H);
    for (const s of [-1, 1]) for (const lx of [Wd / 2 - 0.4, Wd / 2 - 1.5]) W.addCollider(...wpt(s * lx, Dp / 2), 0.6, H);
    F.coopNests = []; for (let i = 0; i < 6; i++) { const lx = -Wd / 2 + 0.9 + i * (Wd - 1.8) / 5, [wx, wz] = wpt(lx, -Dp / 2 + 0.75); F.coopNests.push({ x: wx, z: wz, y: y + 1.78 }); }
    F.coopIn = wpt(0, 0); }
  // --- tractor (v5.3: drivable; geometry only, local space, front = +z) ---
  { const t = FARM.tractor, y = gy(t.x, t.z); const tl = []; const TR = 0xc8261e;
    tl.push(C(BOX(1.7, 1.0, 2.2), TR, 0, 1.5, -0.6)); tl.push(C(BOX(1.3, 1.0, 2.0), TR, 0, 1.45, 1.4)); tl.push(C(BOX(1.1, 0.8, 0.1), DARK, 0, 1.45, 2.42));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tl.push(C(BOX(0.1, 1.8, 0.1), DARK, sx * 0.8, 2.9, -0.6 + sz * 0.9)); tl.push(C(BOX(1.9, 0.12, 2.1), TR, 0, 3.85, -0.6));
    tl.push(C(BOX(0.7, 0.15, 0.6), DARK, 0, 2.15, -0.9)); tl.push(C(BOX(0.7, 0.7, 0.12), DARK, 0, 2.5, -1.2)); tl.push(C(new THREE.TorusGeometry(0.28, 0.04, 6, 14), DARK, 0, 2.5, 0.1, 1, 1, 1, -0.9, 0, 0));
    tl.push(C(CYL(0.08, 0.08, 1.6, 6), 0x555555, 0.45, 2.6, 1.8)); for (const s of [-1, 1]) { tl.push(C(CYL(1.05, 1.05, 0.6, 18), 0x1c1c1c, s * 1.15, 1.05, -0.8, 1, 1, 1, 0, 0, Math.PI / 2)); tl.push(C(CYL(0.5, 0.5, 0.64, 12), 0xffc22a, s * 1.15, 1.05, -0.8, 1, 1, 1, 0, 0, Math.PI / 2));
      tl.push(C(CYL(0.55, 0.55, 0.4, 14), 0x1c1c1c, s * 0.85, 0.55, 1.7, 1, 1, 1, 0, 0, Math.PI / 2)); tl.push(C(CYL(0.25, 0.25, 0.44, 10), 0xffc22a, s * 0.85, 0.55, 1.7, 1, 1, 1, 0, 0, Math.PI / 2)); }
    W.farmData.tractorGeo = mergeGeometries(tl); } // v5.3: the tractor is a drivable object now (built in FarmLife)
  // --- windmill (the fan turns) ---
  { const m = FARM.windmill, y = gy(m.x, m.z); B.at(m.x, y, m.z, 0.4);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(C(BOX(0.22, 13, 0.22), 0x8a9098, sx * 1.1, 6.4, sz * 1.1, 1, 1, 1, sz * 0.08, 0, -sx * 0.08));
    for (const yy of [3, 7, 10.5]) { const k = 1.1 - yy * 0.075; B.add(C(BOX(2 * k + 0.6, 0.12, 0.12), 0x8a9098, 0, yy, k)); B.add(C(BOX(2 * k + 0.6, 0.12, 0.12), 0x8a9098, 0, yy, -k)); B.add(C(BOX(0.12, 0.12, 2 * k + 0.6), 0x8a9098, k, yy, 0)); B.add(C(BOX(0.12, 0.12, 2 * k + 0.6), 0x8a9098, -k, yy, 0)); }
    B.add(C(BOX(1.4, 0.5, 0.5), 0x8a9098, 0, 13.2, 0)); B.add(C(BOX(0.1, 1.6, 2.6), 0xc0392b, 0, 13.4, -2.0));
    const fan = new THREE.Group(); fan.position.set(m.x + Math.sin(0.4) * 0.7, y + 13.2, m.z + Math.cos(0.4) * 0.7); fan.rotation.y = 0.4; const fb = [];
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; fb.push(C(BOX(0.42, 2.3, 0.05), i % 2 ? 0xf4f1e8 : 0xd8d8d8, Math.sin(a) * 1.55, Math.cos(a) * 1.55, 0, 1, 1, 1, 0, 0, -a)); }
    fb.push(C(CYL(0.3, 0.3, 0.3, 10), 0x555555, 0, 0, 0, 1, 1, 1, Math.PI / 2, 0, 0));
    const fm = new THREE.Mesh(mergeGeometries(fb), M.vc); fm.castShadow = true; fan.add(fm); root.add(fan); F.fan = fm;
    W.addCollider(m.x, m.z, 1.8, 16); }
  // --- fences around every pen (posts + 2 rails, gate gaps) with colliders ---
  const fence = (x1, z1, x2, z2) => { const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(L / 2.4)), a = Math.atan2(x2 - x1, z2 - z1);
    for (let i = 0; i <= n; i++) { const x = lerp(x1, x2, i / n), z = lerp(z1, z2, i / n), y = gy(x, z); B.at(x, y, z, a); B.add(C(BOX(0.2, 1.45, 0.2), WOOD, 0, 0.72, 0));
      if (i < n) { const x3 = lerp(x1, x2, (i + 0.5) / n), z3 = lerp(z1, z2, (i + 0.5) / n), y3 = gy(x3, z3); B.at(x3, y3, z3, a); B.add(C(BOX(0.08, 0.16, L / n + 0.1), WOOD2, 0, 0.55, 0)); B.add(C(BOX(0.08, 0.16, L / n + 0.1), WOOD2, 0, 1.1, 0)); } }
    const k = Math.max(1, Math.round(L / 1.5)); for (let i = 0; i <= k; i++) W.addCollider(lerp(x1, x2, i / k), lerp(z1, z2, i / k), 0.5, 1.6); };
  for (const key in FARM.pens) { const P = FARM.pens[key], x0 = P.x - P.w / 2, x1 = P.x + P.w / 2, z0 = P.z - P.d / 2, z1 = P.z + P.d / 2, g = GATE_W / 2;
    const side = (s, ax, az, bx, bz) => { if (P.gate !== s) return fence(ax, az, bx, bz); const mx = (ax + bx) / 2, mz = (az + bz) / 2, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      fence(ax, az, mx - ux * g, mz - uz * g); fence(mx + ux * g, mz + uz * g, bx, bz);
      // an open gate swung outward
      const G = gateOf(P), hx = mx - ux * g, hz = mz - uz * g, y = gy(hx, hz); B.at(hx, y, hz, Math.atan2(G.ox * 0.8 + ux * 0.6, G.oz * 0.8 + uz * 0.6));
      for (const yy of [0.35, 0.75, 1.15]) B.add(C(BOX(0.08, 0.14, 2.8), WHITE, 0, yy, 1.4)); B.add(C(BOX(0.08, 1.0, 0.12), WHITE, 0, 0.75, 2.8)); B.add(C(BOX(0.08, 0.14, 3.1), WHITE, 0, 0.75, 1.4, 1, 1, 1, 0.3, 0, 0)); };
    side('s', x0, z0, x1, z0); side('n', x0, z1, x1, z1); side('w', x0, z0, x0, z1); side('e', x1, z0, x1, z1);
    // a water trough in each pen
    if (key !== 'chick') { const tx = P.x + P.w * 0.3, tz = P.z - P.d * 0.3, ty = gy(tx, tz); B.at(tx, ty, tz, 0); B.add(C(BOX(2.6, 0.7, 1.0), WOOD, 0, 0.35, 0)); B.add(C(BOX(2.3, 0.05, 0.75), 0x4aa8d8, 0, 0.62, 0)); W.addCollider(tx, tz, 1.1, 1); } }
  B.build(M.vc, root);
  // --- hay bales (round ones can be knocked over by Bad David) ---
  const strawTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#e2bf55'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { g.strokeStyle = ['#c9a23e', '#f2d77a', '#b8902e'][i % 3]; g.lineWidth = 1 + Math.random() * 1.5; g.beginPath(); const x = Math.random() * w, y = Math.random() * h, a = (Math.random() - 0.5) * 0.6; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); g.stroke(); } });
  strawTex.wrapS = strawTex.wrapT = THREE.RepeatWrapping;
  const hayM = new THREE.MeshStandardMaterial({ map: strawTex, roughness: 0.95 }), endTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#d9b44e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a8862c'; g.lineWidth = 3; for (let r = 6; r < 64; r += 7) { g.beginPath(); g.arc(64, 64, r, 0, TAU); g.stroke(); } });
  const endM = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.95 }), baleGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.25, 18, 1); baleGeo.rotateZ(Math.PI / 2);
  const BALES = [[-12, 171], [-13, 175.5], [-9, 177], [38, 162], [35.5, 166], [44, 190], [-55, 180], [-52, 185], [9, 130], [29, 168], [-2, 197], [74, 172], [-20, 140], [30, 205]];
  for (const [x, z] of BALES) { const m = new THREE.Mesh(baleGeo, [hayM, endM, endM]); const y = gy(x, z) + 0.85, yaw = r() * TAU; m.position.set(x, y, z); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true; root.add(m);
    W.addCollider(x, z, 1.0, 2); F.bales.push({ m, x, z, y, yaw, col: W.colliders[W.colliders.length - 1], fallen: false, roll: null }); }
  // square bale stacks (static)
  const sq = []; for (const [x, z, n] of [[-14, 150, 3], [-6, 158, 2], [48, 188, 2], [-58, 200, 3]]) { const y = gy(x, z); for (let i = 0; i < n; i++) { sq.push(C(BOX(1.3, 0.65, 0.7), STRAW, x, y + 0.33, z + i * 0.75)); if (i < n - 1) sq.push(C(BOX(1.3, 0.65, 0.7), 0xdcb84c, x, y + 0.98, z + i * 0.75 + 0.37)); } W.addCollider(x, z + n * 0.35, 1.3, 2); }
  { const m = new THREE.Mesh(mergeGeometries(sq), M.vc); m.castShadow = m.receiveShadow = true; root.add(m); }
  // --- mud puddles (shiny, squelchy) ---
  for (const d of F.mud) { const n = 28, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = d.r * (0.82 + 0.25 * noise2(Math.cos(a) * 1.5 + d.x, Math.sin(a) * 1.5 + d.z)); pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); }
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts)); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, M.mud); m.position.set(d.x, gy(d.x, d.z) + 0.06, d.z); m.receiveShadow = true; root.add(m); d.mesh = m; }
  // --- trees: a ring of round leafy trees + an apple orchard by the house ---
  { const tg = [], ag = []; const crown = (col, apples) => { const L = [C(CYL(0.3, 0.42, 3.2, 7), 0x6b4a2a, 0, 1.6, 0)];
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; L.push(C(new THREE.IcosahedronGeometry(1.7, 1), i % 2 ? col : new THREE.Color(col).multiplyScalar(0.85).getHex(), Math.cos(a) * 1.2, 4.3 + (i % 2) * 0.6, Math.sin(a) * 1.2)); }
      L.push(C(new THREE.IcosahedronGeometry(2.0, 1), col, 0, 5.4, 0)); if (apples) for (let i = 0; i < 14; i++) { const a = i * 2.4, e = 0.3 + (i % 5) * 0.25; L.push(C(SPH(0.2, 6, 5), 0xd8282a, Math.cos(a) * 2.3 * Math.cos(e), 4.6 + Math.sin(e) * 2, Math.sin(a) * 2.3 * Math.cos(e))); }
      return mergeGeometries(L); };
    const oak = crown(0x4f9a35, false), apple = crown(0x5aa83a, true), T = [], A = [];
    for (let i = 0; i < 260 && T.length < 70; i++) { const a = r() * TAU, d = 128 + r() * 70, x = 5 + Math.cos(a) * d, z = 160 + Math.sin(a) * d, h = gy(x, z); if (h < 2 || h > 30) continue; T.push([x, z, 0.8 + r() * 0.5]); }
    for (const [x, z] of [[72, 166], [64, 92], [-12, 100], [36, 128], [-56, 160], [90, 196], [-80, 150], [-6, 214]]) T.push([x, z, 1.0]);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) A.push([-44 + i * 7, 218 + j * 7, 0.75 + r() * 0.2]);
    const inst = (geo, list) => { const m = new THREE.InstancedMesh(geo, M.vc, list.length), o = new THREE.Object3D(); list.forEach(([x, z, s], i) => { o.position.set(x, gy(x, z) - 0.2, z); o.rotation.y = r() * TAU; o.scale.setScalar(s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); W.addCollider(x, z, 0.7 * s, 6); }); m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); root.add(m); return m; };
    inst(oak, T); inst(apple, A); }
  // --- corn field + pumpkin patch (walk-through crops) ---
  { const L = [C(CYL(0.05, 0.07, 2.3, 5), 0x5d8a2a, 0, 1.15, 0)]; for (let i = 0; i < 4; i++) L.push(C(BOX(0.1, 0.02, 0.9), 0x6fa232, Math.cos(i * 1.7) * 0.4, 0.7 + i * 0.35, Math.sin(i * 1.7) * 0.4, 1, 1, 1, 0.5, i * 1.7 + Math.PI / 2, 0));
    L.push(C(new THREE.CapsuleGeometry(0.09, 0.3, 3, 6), 0xf2c430, 0.12, 1.4, 0, 1, 1, 1, 0, 0, -0.3)); L.push(C(CONE(0.12, 0.4, 5), 0xc8a04a, 0, 2.45, 0));
    const geo = mergeGeometries(L), Cn = FARM.corn, list = []; for (let x = Cn.x0; x <= Cn.x1; x += 2.6) for (let z = Cn.z0; z <= Cn.z1; z += 1.3) list.push([x + (r() - 0.5) * 0.3, z + (r() - 0.5) * 0.3]);
    const m = new THREE.InstancedMesh(geo, M.vc, list.length), o = new THREE.Object3D(); list.forEach(([x, z], i) => { o.position.set(x, gy(x, z), z); o.rotation.set((r() - 0.5) * 0.1, r() * TAU, (r() - 0.5) * 0.1); o.scale.setScalar(0.85 + r() * 0.3); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.castShadow = true; m.computeBoundingSphere(); root.add(m);
    const pg = mergeGeometries([C(SPH(0.6, 12, 8), 0xf07a1a, 0, 0.42, 0, 1, 0.72, 1), C(CYL(0.06, 0.08, 0.3, 5), 0x4a6a1a, 0, 0.9, 0), C(BOX(0.5, 0.02, 0.3), 0x4a8a2a, 0.4, 0.1, 0.2, 1, 1, 1, 0, 0.6, 0)]), K = FARM.pumpkins, pl = [];
    for (let i = 0; i < 46; i++) pl.push([K.x0 + r() * (K.x1 - K.x0), K.z0 + r() * (K.z1 - K.z0), 0.7 + r() * 0.8]); pl.push([92, 136, 2.6]); // one GIANT pumpkin
    const pm = new THREE.InstancedMesh(pg, M.vc, pl.length); pl.forEach(([x, z, s], i) => { o.position.set(x, gy(x, z), z); o.rotation.set(0, r() * TAU, 0); o.scale.setScalar(s); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); });
    pm.castShadow = true; pm.computeBoundingSphere(); root.add(pm); W.addCollider(92, 136, 1.6, 3); }
  // --- pond: lily pads, cattails, a little dock and three ducks ---
  { const P = FARM.pond, lp = [], ct = []; for (let i = 0; i < 16; i++) { const a = r() * TAU, d = 3 + r() * 8; lp.push(C(new THREE.CircleGeometry(0.6 + r() * 0.4, 10, 0.3, TAU - 0.5), i % 4 ? 0x3f8a2a : 0x56a53a, P.x + Math.cos(a) * d, 0.04, P.z + Math.sin(a) * d, 1, 1, 1, -Math.PI / 2, 0, 0));
      if (i % 4 === 0) lp.push(C(SPH(0.15, 6, 4), 0xf5a8d0, P.x + Math.cos(a) * d, 0.12, P.z + Math.sin(a) * d)); }
    for (let i = 0; i < 46; i++) { const a = r() * TAU, d = P.r * (0.7 + r() * 0.15), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, y = gy(x, z); if (y < -0.3 || y > 2) continue; const hh = 1.3 + r() * 0.8;
      ct.push(C(CYL(0.025, 0.03, hh, 4), 0x5a8a2a, x, y + hh / 2, z)); ct.push(C(new THREE.CapsuleGeometry(0.07, 0.25, 2, 5), 0x6a3a1a, x, y + hh - 0.1, z)); }
    const lm = new THREE.Mesh(mergeGeometries(lp), M.vcD); root.add(lm); const cm = new THREE.Mesh(mergeGeometries(ct), M.vc); root.add(cm);
    const dx = P.x + P.r * 0.5, dz = P.z + P.r * 0.55; B.at(dx, 0.5, dz, -2.4); B.add(C(BOX(2.2, 0.15, 7), WOOD2, 0, 0.3, 2)); for (const s of [-1, 1]) for (const zz of [0, 2.5, 5]) B.add(C(CYL(0.12, 0.12, 2.4, 5), WOOD, s * 1.0, -0.6, zz)); B.build(M.vc, root);
    for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(mergeGeometries([C(SPH(0.32, 10, 8), i ? 0xf6f2e6 : 0x8a6a3a, 0, 0.18, 0, 1, 0.7, 1.35), C(SPH(0.18, 8, 6), i ? 0xf6f2e6 : 0x2a6a3a, 0, 0.48, 0.32), C(CONE(0.07, 0.2, 6), 0xf2a020, 0, 0.45, 0.55, 1, 1, 1, Math.PI / 2, 0, 0), C(SPH(0.03, 4, 3), 0x111111, 0.1, 0.52, 0.42), C(SPH(0.03, 4, 3), 0x111111, -0.1, 0.52, 0.42), C(CONE(0.12, 0.25, 5), i ? 0xf6f2e6 : 0x8a6a3a, 0, 0.32, -0.45, 1, 1, 1, -1.2, 0, 0)]), M.vc);
      d.scale.setScalar(1.3); root.add(d); F.ducks.push({ m: d, a: i * 2.1, r: 5 + i * 2, s: 0.25 + i * 0.07 }); } }
  // --- the welcome sign ---
  { const s = FARM.sign, y = gy(s.x, s.z); const tex = canvasTex(512, 200, (g, w, h) => { g.fillStyle = '#8b5a2b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5a3a1a'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
      for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 30 + i * 30); g.bezierCurveTo(150, 20 + i * 30, 350, 40 + i * 30, 500, 28 + i * 30); g.stroke(); }
      g.textAlign = 'center'; g.font = 'bold 64px Arial Black, Arial, sans-serif'; g.lineWidth = 8; g.strokeStyle = '#3a1e08'; g.fillStyle = '#ffd23a'; g.strokeText('FARTY POOP', w / 2, 88); g.fillText('FARTY POOP', w / 2, 88);
      g.fillStyle = '#ffffff'; g.strokeText('FARM', w / 2, 168); g.fillText('FARM', w / 2, 168); });
    const sg = new THREE.Group(); sg.position.set(s.x, y, s.z); sg.rotation.y = 0.15;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.68), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); front.position.set(0, 2.4, 0.09); sg.add(front);
    const back = new THREE.Mesh(C(BOX(4.4, 1.75, 0.15), 0x7a4a22, 0, 2.4, 0), M.vc); sg.add(back); for (const x of [-1.8, 1.8]) sg.add(new THREE.Mesh(C(BOX(0.2, 2.6, 0.2), 0x6b4a2a, x, 1.3, -0.1), M.vc));
    sg.traverse(o => { if (o.isMesh) o.castShadow = true; }); root.add(sg); W.addCollider(s.x, s.z, 1.0, 3); }
  return F;
}
export function updateFarmWorld(W, dt) {
  const F = W.farmData; if (!F) return; if (F.fan) F.fan.rotation.z -= dt * 1.6;
  for (const d of F.ducks) { d.a += dt * d.s; const P = FARM.pond; d.m.position.set(P.x + Math.cos(d.a) * d.r, 0.02 + Math.sin(W.time * 3 + d.r) * 0.03, P.z + Math.sin(d.a) * d.r); d.m.rotation.y = -d.a; }
}

// ---------------- animals (each = body + head + legs + tail meshes, vertex coloured) ----------------
export const KINDS = {
  cow: { name: 'cow', food: 'hay', snd: 'moo', farts: ['rumbly', 'long', 'wet', 'bubbly', 'trombone'], poop: 1, speed: 1.4, r: 1.3, emoji: '🐮', pen: 'cow', n: 3 },
  pig: { name: 'piggy', food: 'slop', snd: 'oink', farts: ['wet', 'squeaky', 'bubbly', 'stutter', 'squeakup'], poop: 0.8, speed: 1.8, r: 0.9, emoji: '🐷', pen: 'pig', n: 3 },
  chicken: { name: 'chicken', food: 'corn', snd: 'cluck', farts: ['squeaky', 'tiny', 'squeakup'], poop: 0.45, speed: 2.2, r: 0.45, emoji: '🐔', pen: 'chick', n: 6 },
  sheep: { name: 'sheep', food: 'hay', snd: 'baa', farts: ['short', 'trumpet', 'encore', 'raspberry'], poop: 0.6, speed: 1.3, r: 0.9, emoji: '🐑', pen: 'sheep', n: 3 },
  goat: { name: 'goat', food: 'carrot', snd: 'maa', farts: ['trumpet', 'squeaky', 'stutter', 'raspberry'], poop: 0.6, speed: 1.7, r: 0.8, emoji: '🐐', pen: 'sheep', n: 2 },
  horse: { name: 'horse', food: 'apple', snd: 'neigh', farts: ['long', 'trumpet', 'trombone', 'encore'], poop: 0.9, speed: 1.5, r: 1.3, emoji: '🐴', pen: 'horse', n: 1 },
};
function part(parent, list, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); if (list && list.length) { const m = new THREE.Mesh(mergeGeometries(list), mats().vc); m.castShadow = true; g.add(m); g.userData.mesh = m; } return g; }
function eyes(L, x, y, z, r = 0.06, white = true) { for (const s of [-1, 1]) { if (white) L.push(C(SPH(r, 8, 6), 0xffffff, s * x, y, z)); L.push(C(SPH(r * 0.6, 6, 5), 0x111111, s * (x + r * 0.15), y + r * 0.05, z + r * (white ? 0.55 : 0))); L.push(C(SPH(r * 0.18, 4, 3), 0xffffff, s * x + r * 0.2, y + r * 0.35, z + r * (white ? 0.95 : 0.5))); } }
function leg(parent, x, y, z, col, len, rad, hoof = 0x3a2a20, sock = null) { const L = [C(CYL(rad, rad * 0.85, len, 8), col, 0, -len / 2, 0)]; if (sock) L.push(C(CYL(rad * 0.9, rad * 0.95, len * 0.22, 8), sock, 0, -len * 0.82, 0)); L.push(C(CYL(rad * 0.95, rad * 1.05, 0.12, 8), hoof, 0, -len - 0.02, 0)); return part(parent, L, x, y, z); }
function buildAnimal(kind, variant = 0) {
  const A = { kind, root: new THREE.Group(), legs: [], wings: [] }; const R = A.root, b = [], h = [];
  if (kind === 'cow') {
    const W = 0xf7f5ef, K = 0x232323; b.push(C(SPH(1, 16, 12), W, 0, 1.3, 0, 0.62, 0.58, 1.05));
    for (const [x, y, z, sx, sy, sz] of [[0.5, 1.45, 0.35, 0.14, 0.3, 0.38], [-0.52, 1.3, -0.35, 0.14, 0.32, 0.4], [0.2, 1.84, -0.45, 0.35, 0.08, 0.3], [-0.25, 1.82, 0.5, 0.28, 0.08, 0.25], [0.45, 1.15, -0.7, 0.14, 0.25, 0.25]]) b.push(C(SPH(1, 10, 8), K, x, y, z, sx, sy, sz));
    b.push(C(SPH(0.24, 10, 8), 0xf3a7b5, 0, 0.78, -0.45)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.push(C(CYL(0.035, 0.03, 0.12, 5), 0xf08a9c, sx * 0.08, 0.6, -0.45 + sz * 0.08));
    h.push(C(SPH(1, 12, 10), W, 0, 0, 0.25, 0.36, 0.38, 0.5), C(SPH(1, 12, 8), 0xf2b8b0, 0, -0.14, 0.62, 0.31, 0.24, 0.22), C(SPH(0.04, 5, 4), K, 0.09, -0.1, 0.83), C(SPH(0.04, 5, 4), K, -0.09, -0.1, 0.83),
      C(SPH(1, 8, 6), K, 0.17, 0.12, 0.42, 0.12, 0.14, 0.08), C(SPH(1, 8, 6), 0xf6d0cc, 0.4, 0.12, 0.1, 0.22, 0.07, 0.12, 0, 0, -0.3), C(SPH(1, 8, 6), 0xf6d0cc, -0.4, 0.12, 0.1, 0.22, 0.07, 0.12, 0, 0, 0.3),
      C(CONE(0.055, 0.26, 6), 0xf2e6c4, 0.2, 0.36, 0.12, 1, 1, 1, 0, 0, -0.55), C(CONE(0.055, 0.26, 6), 0xf2e6c4, -0.2, 0.36, 0.12, 1, 1, 1, 0, 0, 0.55),
      C(SPH(0.09, 8, 6), 0xffc22a, 0, -0.44, 0.12), C(BOX(0.5, 0.06, 0.06), 0xc0392b, 0, -0.34, 0.08)); eyes(h, 0.2, 0.12, 0.47, 0.075);
    A.head = part(R, h, 0, 1.6, 0.98); A.mouth = V(0, -0.22, 0.75); A.h = 1.95; A.rear = V(0, 1.3, -1.1);
    for (const sx of [-1, 1]) for (const sz of [1, -1]) A.legs.push(leg(R, sx * 0.36, 1.02, sz * 0.62, W, 0.92, 0.11));
    A.tail = part(R, [C(CYL(0.03, 0.03, 0.85, 5), W, 0, -0.42, -0.04), C(SPH(1, 6, 5), K, 0, -0.88, -0.08, 0.09, 0.15, 0.09)], 0, 1.6, -1.04);
  } else if (kind === 'pig') {
    const P = 0xf4a6b6, D = 0xe08a9c; b.push(C(SPH(1, 14, 10), P, 0, 0.66, 0, 0.52, 0.48, 0.78)); if (variant === 1) for (const [x, y, z] of [[0.35, 0.8, -0.2], [-0.3, 0.55, 0.25], [0.1, 1.05, 0.1]]) b.push(C(SPH(1, 8, 6), 0x7a4a22, x, y, z, 0.2, 0.12, 0.2));
    h.push(C(SPH(0.38, 12, 10), P, 0, 0, 0.05, 1, 0.95, 0.9), C(CYL(0.17, 0.19, 0.16, 12), D, 0, -0.05, 0.38, 1, 1, 1, Math.PI / 2, 0, 0), C(SPH(0.035, 5, 4), 0x8a3a4a, 0.06, -0.05, 0.465), C(SPH(0.035, 5, 4), 0x8a3a4a, -0.06, -0.05, 0.465),
      C(CONE(0.13, 0.22, 6), D, 0.22, 0.3, 0.05, 1, 1, 1, 0.7, 0, -0.5), C(CONE(0.13, 0.22, 6), D, -0.22, 0.3, 0.05, 1, 1, 1, 0.7, 0, 0.5), C(BOX(0.16, 0.02, 0.02), 0x8a3a4a, 0, -0.2, 0.36)); eyes(h, 0.15, 0.12, 0.3, 0.05, false);
    A.head = part(R, h, 0, 0.78, 0.72); A.mouth = V(0, -0.15, 0.42); A.h = 1.1; A.rear = V(0, 0.7, -0.8);
    for (const sx of [-1, 1]) for (const sz of [1, -1]) A.legs.push(leg(R, sx * 0.26, 0.42, sz * 0.42, P, 0.36, 0.085, 0x5a3a3a));
    A.tail = part(R, [C(new THREE.TorusGeometry(0.08, 0.025, 5, 12, 5.2), P, 0, 0, -0.06, 1, 1, 1, 0, Math.PI / 2, 0)], 0, 0.78, -0.76);
  } else if (kind === 'chicken') {
    const W = variant % 3 === 1 ? 0xb5652b : variant % 3 === 2 ? 0x3a2a22 : 0xfafafa; b.push(C(SPH(1, 12, 9), W, 0, 0.48, 0, 0.26, 0.27, 0.33), C(CONE(0.14, 0.34, 6), W, 0, 0.66, -0.3, 1, 1, 1, -0.75, 0, 0));
    h.push(C(SPH(0.14, 10, 8), W, 0, 0, 0), C(SPH(0.05, 6, 4), 0xe0302a, 0, 0.15, -0.03), C(SPH(0.055, 6, 4), 0xe0302a, 0, 0.16, 0.04), C(SPH(0.045, 6, 4), 0xe0302a, 0, 0.14, 0.1), C(CONE(0.04, 0.11, 5), 0xf2a020, 0, -0.01, 0.17, 1, 1, 1, Math.PI / 2, 0, 0), C(SPH(1, 5, 4), 0xe0302a, 0, -0.09, 0.12, 0.03, 0.06, 0.03));
    eyes(h, 0.09, 0.04, 0.09, 0.03, false); A.head = part(R, h, 0, 0.74, 0.22); A.mouth = V(0, -0.02, 0.2); A.h = 0.9; A.rear = V(0, 0.5, -0.36);
    for (const s of [-1, 1]) { const w = part(R, [C(SPH(1, 8, 6), W, s * 0.03, -0.06, -0.04, 0.06, 0.16, 0.24)], s * 0.24, 0.56, 0); A.wings.push(w); }
    for (const s of [-1, 1]) A.legs.push(part(R, [C(CYL(0.02, 0.02, 0.3, 4), 0xf2a020, 0, -0.15, 0), C(BOX(0.12, 0.025, 0.15), 0xf2a020, 0, -0.3, 0.04)], s * 0.08, 0.3, 0));
    A.tail = part(R, [], 0, 0.6, -0.3); R.scale.setScalar(1.3);
  } else if (kind === 'sheep') {
    const W = 0xf4f1ea, K = 0x2a2a2a; for (let i = 0; i < 14; i++) { const a = i * 2.39996, t = (i + 0.5) / 14, yy = 1 - 2 * t, rr = Math.sqrt(1 - yy * yy); b.push(C(SPH(0.3, 9, 7), i % 3 ? W : 0xe8e4da, Math.cos(a) * rr * 0.42, 0.98 + yy * 0.3, Math.sin(a) * rr * 0.62)); }
    b.push(C(SPH(1, 12, 9), W, 0, 0.98, 0, 0.5, 0.42, 0.72));
    h.push(C(SPH(1, 10, 8), K, 0, 0, 0.12, 0.2, 0.24, 0.3), C(SPH(0.17, 8, 6), W, 0, 0.18, 0.0), C(SPH(1, 6, 5), K, 0.25, 0.05, 0.02, 0.16, 0.05, 0.08, 0, 0, -0.4), C(SPH(1, 6, 5), K, -0.25, 0.05, 0.02, 0.16, 0.05, 0.08, 0, 0, 0.4)); eyes(h, 0.12, 0.07, 0.3, 0.05);
    A.head = part(R, h, 0, 1.18, 0.76); A.mouth = V(0, -0.14, 0.4); A.h = 1.4; A.rear = V(0, 1.0, -0.8);
    for (const sx of [-1, 1]) for (const sz of [1, -1]) A.legs.push(leg(R, sx * 0.25, 0.66, sz * 0.42, K, 0.62, 0.055, 0x111111));
    A.tail = part(R, [C(SPH(0.14, 6, 5), W, 0, -0.06, -0.06)], 0, 1.05, -0.78);
  } else if (kind === 'goat') {
    const W = variant ? 0xeeeeee : 0xd8b98a, Pt = variant ? 0x8a6a4a : 0xf4efe6; b.push(C(SPH(1, 12, 9), W, 0, 0.98, 0, 0.42, 0.44, 0.74), C(SPH(1, 8, 6), Pt, 0.18, 1.1, -0.2, 0.3, 0.3, 0.35));
    h.push(C(SPH(1, 10, 8), W, 0, 0, 0.12, 0.2, 0.24, 0.36), C(CONE(0.05, 0.36, 6), 0x8a8070, 0.1, 0.27, -0.06, 1, 1, 1, -0.75, 0, 0), C(CONE(0.05, 0.36, 6), 0x8a8070, -0.1, 0.27, -0.06, 1, 1, 1, -0.75, 0, 0),
      C(SPH(1, 6, 5), W, 0.26, 0.06, 0.02, 0.18, 0.05, 0.08), C(SPH(1, 6, 5), W, -0.26, 0.06, 0.02, 0.18, 0.05, 0.08), C(CONE(0.06, 0.24, 6), 0xf4f4f4, 0, -0.26, 0.32, 1, 1, 1, Math.PI, 0, 0), C(SPH(0.05, 5, 4), 0x3a2a2a, 0, -0.06, 0.47));
    for (const s of [-1, 1]) { h.push(C(SPH(0.055, 8, 6), 0xd8c040, s * 0.14, 0.08, 0.3), C(BOX(0.07, 0.022, 0.02), 0x111111, s * 0.145, 0.08, 0.35)); }
    A.head = part(R, h, 0, 1.34, 0.7); A.mouth = V(0, -0.14, 0.46); A.h = 1.6; A.rear = V(0, 1.0, -0.8);
    for (const sx of [-1, 1]) for (const sz of [1, -1]) A.legs.push(leg(R, sx * 0.22, 0.68, sz * 0.45, W, 0.66, 0.06, 0x3a2a20));
    A.tail = part(R, [C(CONE(0.06, 0.2, 5), W, 0, 0.08, -0.03, 1, 1, 1, -0.4, 0, 0)], 0, 1.18, -0.72);
  } else { // horse (with saddle)
    const Br = 0x8b5a2b, Mn = 0x3a2414; b.push(C(SPH(1, 16, 12), Br, 0, 1.55, 0, 0.55, 0.6, 1.15), C(CYL(0.27, 0.38, 1.05, 10), Br, 0, 2.05, 0.95, 1, 1, 1, 0.62, 0, 0));
    for (let i = 0; i < 6; i++) { const t = i / 5; b.push(C(BOX(0.08, 0.32, 0.26), Mn, 0, 1.95 + t * 0.62 + 0.18, 0.55 + t * 0.62 - 0.12, 1, 1, 1, 0.62, 0, 0)); }
    b.push(C(BOX(0.82, 0.06, 0.95), 0xc0392b, 0, 2.12, -0.05), C(BOX(0.68, 0.14, 0.72), 0x5a3218, 0, 2.2, -0.05), C(CYL(0.06, 0.08, 0.2, 6), 0x5a3218, 0, 2.34, 0.28));
    for (const s of [-1, 1]) b.push(C(BOX(0.04, 0.6, 0.06), 0x3a2414, s * 0.47, 1.85, 0), C(BOX(0.14, 0.04, 0.12), 0x999999, s * 0.47, 1.55, 0));
    h.push(C(SPH(1, 12, 10), Br, 0, -0.12, 0.28, 0.21, 0.23, 0.5, 0.75, 0, 0), C(SPH(1, 10, 8), 0xc89a6a, 0, -0.38, 0.6, 0.19, 0.17, 0.2), C(SPH(0.035, 5, 4), 0x2a1a10, 0.08, -0.36, 0.78), C(SPH(0.035, 5, 4), 0x2a1a10, -0.08, -0.36, 0.78),
      C(SPH(1, 8, 6), 0xffffff, 0, -0.02, 0.5, 0.06, 0.22, 0.05, 0.75, 0, 0), C(CONE(0.07, 0.24, 6), Br, 0.11, 0.24, 0.02), C(CONE(0.07, 0.24, 6), Br, -0.11, 0.24, 0.02), C(BOX(0.1, 0.12, 0.25), Mn, 0, 0.16, 0.12, 1, 1, 1, 0.3, 0, 0),
      C(BOX(0.44, 0.04, 0.04), 0x3a2414, 0, -0.3, 0.52)); eyes(h, 0.19, 0.04, 0.24, 0.065);
    A.head = part(R, h, 0, 2.45, 1.32); A.mouth = V(0, -0.42, 0.66); A.h = 2.5; A.rear = V(0, 1.7, -1.15);
    for (const sx of [-1, 1]) for (const sz of [1, -1]) A.legs.push(leg(R, sx * 0.3, 1.2, sz * 0.75, Br, 1.1, 0.1, 0x2a1a10, 0xf2efe6));
    A.tail = part(R, [C(CONE(0.15, 1.0, 7), Mn, 0, -0.45, -0.18, 1, 1, 1, 0.35, 0, 0)], 0, 1.95, -1.1);
  }
  A.body = part(R, b); A.meshes = []; R.traverse(o => { if (o.isMesh) A.meshes.push(o); }); return A;
}

// ---------------- canvas-drawn icons (hearts, stars, stink lines, food bubbles) ----------------
const ICON = {};
function icon(kind) {
  if (ICON[kind]) return ICON[kind];
  const t = canvasTex(128, 128, (g, w, h) => {
    const out = (f, s, lw = 6) => { g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = s; g.stroke(); g.fillStyle = f; g.fill(); };
    const bubble = () => { g.beginPath(); g.arc(64, 60, 50, 0, TAU); g.moveTo(52, 104); g.lineTo(64, 124); g.lineTo(76, 104); out('#ffffff', '#3a3a3a', 5); };
    if (kind === 'heart') { g.beginPath(); g.moveTo(64, 112); g.bezierCurveTo(8, 72, 8, 18, 40, 18); g.bezierCurveTo(54, 18, 64, 30, 64, 42); g.bezierCurveTo(64, 30, 74, 18, 88, 18); g.bezierCurveTo(120, 18, 120, 72, 64, 112); out('#ff3b6b', '#7a0a2a');
      g.beginPath(); g.ellipse(42, 42, 9, 6, -0.6, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill(); }
    else if (kind === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 54; g.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r); } g.closePath(); out('#ffd23a', '#8a5a00'); }
    else if (kind === 'stink') { g.lineCap = 'round'; for (let k = 0; k < 3; k++) { g.beginPath(); for (let y = 0; y <= 100; y += 4) g.lineTo(30 + k * 34 + Math.sin(y * 0.12 + k) * 9, 114 - y); g.lineWidth = 14; g.strokeStyle = '#3a6a10'; g.stroke(); g.lineWidth = 8; g.strokeStyle = '#9be04a'; g.stroke(); } }
    else if (kind === 'bang') { g.beginPath(); g.arc(64, 64, 52, 0, TAU); out('#ffd23a', '#7a4a00'); g.font = 'bold 92px Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#e0302a'; g.fillText('!', 64, 98); }
    else if (kind === 'eyes') { for (const x of [36, 92]) { g.beginPath(); g.arc(x, 64, 30, 0, TAU); out('#ffffff', '#222222', 5); g.beginPath(); g.arc(x + 8, 70, 13, 0, TAU); g.fillStyle = '#111'; g.fill(); } }
    else if (kind === 'feather') { g.beginPath(); g.ellipse(64, 60, 18, 50, 0.5, 0, TAU); out('#ffffff', '#b0b0b0', 4); g.beginPath(); g.moveTo(40, 104); g.lineTo(88, 18); g.lineWidth = 4; g.strokeStyle = '#c0c0c0'; g.stroke(); }
    else if (kind === 'sparkle') { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 14 : 58; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); out('#fff6b0', '#c89a00', 4); }
    else { bubble(); // food wish bubbles
      if (kind === 'hay') { g.beginPath(); g.rect(30, 40, 68, 40); out('#e8c65a', '#8a6a1a', 5); g.strokeStyle = '#a8862c'; g.lineWidth = 3; for (let x = 36; x < 96; x += 8) { g.beginPath(); g.moveTo(x, 42); g.lineTo(x + 4, 78); g.stroke(); } g.fillStyle = '#c0392b'; g.fillRect(48, 40, 6, 40); g.fillRect(74, 40, 6, 40); }
      else if (kind === 'corn') { g.beginPath(); g.ellipse(64, 58, 16, 34, 0, 0, TAU); out('#f2c430', '#8a6a00', 5); g.fillStyle = '#c89a10'; for (let y = 34; y < 86; y += 9) for (let x = 54; x <= 74; x += 9) { g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); }
        g.beginPath(); g.moveTo(64, 96); g.quadraticCurveTo(36, 80, 38, 46); g.quadraticCurveTo(50, 76, 64, 90); out('#5aa83a', '#2a5a1a', 3); g.beginPath(); g.moveTo(64, 96); g.quadraticCurveTo(92, 80, 90, 46); g.quadraticCurveTo(78, 76, 64, 90); out('#5aa83a', '#2a5a1a', 3); }
      else if (kind === 'slop') { g.beginPath(); g.moveTo(34, 44); g.lineTo(94, 44); g.lineTo(86, 92); g.lineTo(42, 92); g.closePath(); out('#9aa6b0', '#3a4650', 5); g.beginPath(); g.ellipse(64, 44, 30, 9, 0, 0, TAU); out('#8a5a2a', '#4a2a10', 4);
        g.beginPath(); g.arc(52, 36, 6, 0, TAU); g.arc(72, 32, 5, 0, TAU); g.fillStyle = '#a8743f'; g.fill(); }
      else if (kind === 'carrot') { g.beginPath(); g.moveTo(44, 40); g.lineTo(86, 40); g.lineTo(64, 100); g.closePath(); out('#f07a1a', '#7a3a00', 5); g.strokeStyle = '#b85a10'; g.lineWidth = 3; for (let y = 52; y < 90; y += 10) { g.beginPath(); g.moveTo(52 + (y - 40) * 0.3, y); g.lineTo(62, y); g.stroke(); }
        for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.ellipse(64 + a * 26, 26, 6, 15, a, 0, TAU); out('#4aa83a', '#1a5a1a', 3); } }
      else { g.beginPath(); g.arc(64, 64, 30, 0, TAU); out('#e0302a', '#6a0a0a', 5); g.beginPath(); g.ellipse(52, 52, 7, 10, -0.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fill();
        g.fillStyle = '#5a3a1a'; g.fillRect(62, 22, 5, 16); g.beginPath(); g.ellipse(76, 28, 11, 6, -0.4, 0, TAU); out('#4aa83a', '#1a5a1a', 3); } }
  });
  return ICON[kind] = t;
}
const FOOD_COL = { hay: 0xe8c65a, corn: 0xf2c430, slop: 0x8a5a2a, carrot: 0xf07a1a, apple: 0xe0302a };
const FOOD_EMOJI = { hay: '🌾', corn: '🌽', slop: '🪣', carrot: '🥕', apple: '🍎' };
function foodMesh(kind) {
  const L = kind === 'hay' ? [C(BOX(0.6, 0.3, 0.35), 0xe8c65a), C(BOX(0.62, 0.32, 0.05), 0xc0392b, 0, 0, 0.08), C(BOX(0.62, 0.32, 0.05), 0xc0392b, 0, 0, -0.08)]
    : kind === 'corn' ? [C(new THREE.CapsuleGeometry(0.09, 0.28, 3, 8), 0xf2c430, 0, 0, 0, 1, 1, 1, 0, 0, 1.2), C(CONE(0.1, 0.25, 5), 0x5aa83a, -0.18, -0.06, 0, 1, 1, 1, 0, 0, 1.2)]
    : kind === 'slop' ? [C(SPH(0.22, 10, 8), 0x8a5a2a, 0, 0, 0, 1.2, 0.8, 1), C(SPH(0.08, 6, 5), 0xa8743f, 0.1, 0.12, 0.05), C(SPH(0.06, 6, 5), 0x6a8a2a, -0.1, 0.1, 0)]
    : kind === 'carrot' ? [C(CONE(0.08, 0.4, 8), 0xf07a1a, 0, 0, 0, 1, 1, 1, Math.PI, 0, 0), C(CONE(0.06, 0.18, 5), 0x4aa83a, 0, 0.27, 0)]
    : [C(SPH(0.15, 10, 8), 0xe0302a), C(CYL(0.015, 0.015, 0.1, 4), 0x5a3a1a, 0, 0.16, 0), C(SPH(1, 5, 4), 0x4aa83a, 0.06, 0.17, 0, 0.06, 0.02, 0.04)];
  const m = new THREE.Mesh(mergeGeometries(L), mats().vc); m.castShadow = true; return m;
}

// ---------------- one farm animal ----------------
const BUSY = new Set(['faint', 'bounce', 'eat', 'happy', 'fart', 'poop', 'ridden', 'rodeo', 'tickled', 'wait', 'title']);
const LEG = { cow: 1.0, pig: 0.42, chicken: 0.3, sheep: 0.66, goat: 0.68, horse: 1.2 };
class Animal {
  constructor(F, kind, i) {
    this.F = F; this.kind = kind; this.K = KINDS[kind]; this.idx = i; this.id = kind + i; Object.assign(this, buildAnimal(kind, i)); this.name = this.K.name;
    this.pen = FARM.pens[this.K.pen]; this.pos = V(); this.yaw = Math.random() * TAU; this.speed = 0; this.ph = Math.random() * 6; this.state = 'idle'; this.t = Math.random() * 3; this.dur = 2;
    this.goal = null; this.path = null; this.fullT = 0; this.headP = 0; this.hop = 0; this.tailUp = 0; this.wig = 0; this.free = null; this.sndT = 4 + Math.random() * 14; this.cream = null; this.muddy = kind === 'pig' && i === 1; this.sq = 0; this.bug = 0; this.fluff = 0; this.buck = 0; this.flip = 0; this.fwd = 0; this.body0 = this.body.scale.clone(); this.head0 = this.head.scale.clone();
    this.bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon(this.K.food), transparent: true, depthWrite: false })); this.bub.scale.setScalar(0); this.bub.renderOrder = 5; F.root.add(this.bub);
    F.root.add(this.root);
  }
  get busy() { return BUSY.has(this.state); }
  homePoint(out = V()) { if (this.free) { const a = Math.random() * TAU, d = Math.random() * this.free.r; return out.set(this.free.x + Math.cos(a) * d, 0, this.free.z + Math.sin(a) * d); }
    const P = this.pen, m = this.kind === 'chicken' ? 1.5 : 2.6; let x, z, n = 0; do { x = P.x + (Math.random() - 0.5) * (P.w - 2 * m); z = P.z + (Math.random() - 0.5) * (P.d - 2 * m); } while (this.kind === 'chicken' && Math.hypot(x - FARM.coop.x, z - FARM.coop.z) < 4.5 && ++n < 9); return out.set(x, 0, z); }
  place(x, z, yaw = Math.random() * TAU) { this.pos.set(x, this.F.W.height(x, z), z); this.yaw = yaw; this.speed = 0; }
  set(state, t = 0) { this.state = state; this.t = t; }
  // path back into the pen through its gate
  goHome(speedK = 1.8) { const G = gateOf(this.pen), out = V(G.x + G.ox * 4, 0, G.z + G.oz * 4), inn = V(G.x - G.ox * 4, 0, G.z - G.oz * 4); this.free = null;
    this.path = inPen(this.pen, this.pos.x, this.pos.z, 0.5) ? [this.homePoint()] : [out, inn, this.homePoint()]; this.pathK = speedK; this.set('return'); }
  inside() { return inPen(this.pen, this.pos.x, this.pos.z, 0.3); }
  say(v = 1) { const F = this.F, d = F.camDist(this.pos), k = clamp(1.2 - d / 55, 0, 1) * v; if (k <= 0.02) return; const p = this.kind === 'chicken' ? 0.9 + Math.random() * 0.3 : this.kind === 'goat' ? 0.95 + Math.random() * 0.15 : 0.9 + Math.random() * 0.2 + (this.idx === 2 ? 0.15 : 0);
    sfx[this.K.snd](p, k); }
  steer(gx, gz, spd, dt, turn = 3) { const dx = gx - this.pos.x, dz = gz - this.pos.z, L = Math.hypot(dx, dz); const want = Math.atan2(dx, dz); this.yaw += clamp(angDiff(this.yaw, want), -turn * dt, turn * dt);
    const k = Math.max(0.2, Math.cos(Math.min(1.5, Math.abs(angDiff(this.yaw, want))))); this.speed = lerp(this.speed, L > 0.4 ? spd * k : 0, Math.min(1, dt * 4)); return L; }
  face(x, z, dt, k = 6) { this.yaw += angDiff(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z)) * Math.min(1, dt * k); }
  update(dt, title) {
    const F = this.F, K = this.K, T = (this.t += dt); this.fullT -= dt; let headW = 0, hopW = 0, tailW = 0, wigW = 0, flap = 0;
    switch (this.state) {
      case 'idle': this.speed = lerp(this.speed, 0, Math.min(1, dt * 5)); headW = this.kind === 'chicken' ? Math.max(0, Math.sin(T * 7)) * 0.9 : 0.75 * smooth(0.5, 1.2, T % 6) * (1 - smooth(4.5, 5.4, T % 6));
        if (T > this.dur && !title) { this.goal = this.homePoint(); this.set('walk'); this.dur = 2 + Math.random() * 5; } break;
      case 'walk': if (this.steer(this.goal.x, this.goal.z, K.speed, dt) < 0.8 || T > 14) this.set('idle'); break;
      case 'return': case 'runaway': case 'herded': { const wp = this.path && this.path[0]; if (!wp) { this.set(this.state === 'runaway' ? 'loose' : 'idle'); break; }
        let spd = K.speed * (this.pathK || 1.8); if (this.state === 'herded') { const dd = F.dogDist(this.pos); spd = dd < 7 ? 6.5 : dd < 12 ? 3 : 0.6; flap = 1; if (dd < 7 && Math.random() < dt * 1.5) this.say(0.8); }
        if (this.steer(wp.x, wp.z, spd, dt, 4) < 1.2) { this.path.shift(); if (!this.path.length) { const st = this.state; this.set(st === 'runaway' ? 'loose' : 'idle'); if (st === 'herded') F.herdDone(this); } } break; }
      case 'loose': this.speed = lerp(this.speed, Math.sin(T * 0.7) > 0.3 ? 1.2 : 0, dt * 3); this.yaw += Math.sin(T * 0.9) * dt * 0.8; headW = 0.6; if (Math.random() < dt * 0.4) this.say(0.7); break;
      case 'flee': { this.steer(this.goal.x, this.goal.z, K.speed * 3.2, dt, 6); flap = 1; if (T > (this.dur || 1.6)) { if (this.inside() || this.free) this.set('idle'); else this.goHome(); } break; }
      case 'scatter': { flap = 1; if (this.path && this.path.length) { const wp = this.path[0]; if (this.steer(wp.x, wp.z, K.speed * 2.8, dt, 8) < 1.2) this.path.shift(); break; } if (this.steer(this.goal.x, this.goal.z, K.speed * 2.6, dt, 7) < 1 || T > 3) { const c = this.scatterC; this.goal = V(c.x + (Math.random() - 0.5) * 16, 0, c.z + (Math.random() - 0.5) * 16); this.t = 0; this.scatterN = (this.scatterN || 0) + 1;
        if (Math.random() < 0.5) this.say(0.8); if (this.scatterN > 4) this.goHome(1.6); } break; }
      case 'wait': this.speed = lerp(this.speed, 0, Math.min(1, dt * 8)); if (F.kidPos) this.face(F.kidPos.x, F.kidPos.z, dt); if (T > 1.5) this.set('idle'); break;
      case 'eat': this.speed = 0; if (F.kidPos) this.face(F.kidPos.x, F.kidPos.z, dt, 3); headW = 0.35 + Math.abs(Math.sin(T * 9)) * 0.25; if (T > 1.3) { this.set('happy'); F.onFed(this); } break;
      case 'happy': this.speed = 0; hopW = Math.abs(Math.sin(T * 11)) * (this.kind === 'chicken' ? 0.35 : 0.3); wigW = 0.6; flap = 1;
        if (!this.reacted) { this.reacted = true; F.silly(this); } // v5.2: each kind has its own over-the-top happy reaction
        if (this.kind === 'pig') { wigW = 1.8; hopW = Math.abs(Math.sin(T * 14)) * 0.45; } // happy piggy wiggle
        if (this.kind === 'horse') { this.buck = 1; hopW = Math.abs(Math.sin(T * 8)) * 0.5; } // buck-dance
        if (T > 0.95) { this.reacted = false; this.set('fart'); F.fartFrom(this); } break;
      case 'fart': this.speed = 0; tailW = 1; wigW = T < 0.5 ? 1.3 : 0; hopW = T < 0.4 ? Math.sin(T / 0.4 * Math.PI) * (this.kind === 'pig' ? 0.9 : 0.45) : 0; // comedic little fart-jump
        if (this.kind === 'pig' && T < 0.4) { const k = dt * 3.5; this.pos.x += Math.sin(this.yaw) * k; this.pos.z += Math.cos(this.yaw) * k; } // fart-propelled piggy hop
        if (T > 0.85) { if (this.kind === 'goat' && F.goatButt(this)) break; if (Math.random() < K.poop) this.set('poop'); else { this.set('idle'); this.dur = 2; } } break;
      case 'faint': { this.speed = 0; headW = -0.4; if (T > 2.3) { this.faintK = 0; this.hop = 1.4; this.sq = 1; F.n.popUps++; sfx.boing(clamp(1.2 - F.camDist(this.pos) / 50, 0.05, 1), 1.2); F.emote('star', this, 2); this.say(0.8); this.set('idle'); } break; }
      case 'bounce': { this.speed = 0; const ph = (T * 1.6) % 1; hopW = 0.9 + Math.sin(ph * Math.PI) * 2.6; tailW = 1; wigW = 0.6; this.yaw += dt * 1.2;
        if (ph < this._bph) { F.n.guestBounces++; F.castleBoing(0.5, this.kind === 'chicken' ? 1.5 : this.kind === 'cow' ? 0.7 : 1); this.sq = 1; if (Math.random() < 0.3) { F.fartFrom(this, 0.7); F.n.fartBounces++; } } this._bph = ph; break; }
      case 'butt': { const b = this.butt; flap = 0; if (!b) { this.set('idle'); break; } const L = this.steer(b.x, b.z, K.speed * 3, dt, 6); headW = 0.5;
        if (L < 2.2 || T > 3.5) { F.knockBale(b, this.pos, 2.5); F.hayBurst(this.mouthPt(V())); sfx.boing(clamp(1.2 - F.camDist(this.pos) / 45, 0.05, 1), 0.8); F.emote('star', this, 2); this.butt = null; this.sq = 1; F.n.butts++; this.set('idle'); this.dur = 2; } break; }
      case 'poop': this.speed = 0; tailW = 1; if (T > 0.3 && !this.pooped) { this.pooped = true; F.poopFrom(this); } if (T > 0.9) { this.pooped = false; this.set('idle'); this.dur = 2; } break;
      case 'tickled': this.speed = 0; wigW = 1.4; hopW = Math.abs(Math.sin(T * 14)) * 0.12; headW = -0.3; if (T > 0.4 && !this.giggled) { this.giggled = true; this.say(1); } if (T > 2.4) { this.giggled = false; this.set('fart'); F.fartFrom(this, 1.2); } break;
      case 'rodeo': { const c = this.rodeoC, a = (this.rodeoA += dt * 0.9), gx = c.x + Math.cos(a) * 6, gz = c.z + Math.sin(a) * 6; this.steer(gx, gz, 6, dt, 6); hopW = Math.abs(Math.sin(T * 12)) * 0.12; if (Math.random() < dt * 1.6) this.say(1); break; }
      case 'ridden': break;
      case 'title': this.speed = 0; headW = Math.sin(T * 1.3) > 0.7 ? -0.35 : 0; if (this.kind === 'horse' && Math.random() < dt * 0.25) this.flip = 1; if (Math.random() < dt * 0.15) this.say(0.6); break;
    }
    // move + stay out of fences/buildings
    if (this.state !== 'ridden') { this.pos.x += Math.sin(this.yaw) * this.speed * dt; this.pos.z += Math.cos(this.yaw) * this.speed * dt; F.W.collide(this.pos, K.r * 0.7, false);
      const h = F.W.height(this.pos.x, this.pos.z); if (h < -0.6) { this.pos.x -= Math.sin(this.yaw) * this.speed * dt * 2; this.pos.z -= Math.cos(this.yaw) * this.speed * dt * 2; } this.pos.y = h; }
    // ambient voices
    if ((this.sndT -= dt) <= 0) { this.sndT = 9 + Math.random() * 16; if (!this.busy || this.state === 'title') this.say(0.55); }
    this.headP = lerp(this.headP, headW, Math.min(1, dt * 6)); this.hop = lerp(this.hop, hopW, Math.min(1, dt * 18)); this.tailUp = lerp(this.tailUp, tailW, Math.min(1, dt * 8)); this.wig = lerp(this.wig, wigW, Math.min(1, dt * 8));
    this.flap = flap; this.pose(dt);
  }
  pose(dt) {
    const R = this.root, F = this.F, cd = F.camDist(this.pos); R.visible = cd < 230; if (!R.visible) return;
    const far = cd > 75; if (far !== this._far) { this._far = far; for (const m of this.meshes) m.castShadow = !far; }
    const gal = this.kind === 'horse' && this.speed > 11, sp = this.speed, L = LEG[this.kind], amp = Math.min(this.kind === 'chicken' ? 0.9 : 0.65, sp * 0.3);
    this.ph += dt * (sp / (L * 1.4)) * Math.PI * (gal ? 0.75 : 1); const s = Math.sin(this.ph);
    if (this.legs.length === 2) { this.legs[0].rotation.x = s * amp; this.legs[1].rotation.x = -s * amp; }
    else if (gal) { const lf = this.legs; lf[0].rotation.x = Math.sin(this.ph) * 0.9; lf[2].rotation.x = Math.sin(this.ph + 0.5) * 0.9; lf[1].rotation.x = Math.sin(this.ph + Math.PI) * 0.8; lf[3].rotation.x = Math.sin(this.ph + Math.PI + 0.5) * 0.8; }
    else { this.legs[0].rotation.x = s * amp; this.legs[3].rotation.x = s * amp; this.legs[1].rotation.x = -s * amp; this.legs[2].rotation.x = -s * amp; }
    for (const [i, w] of this.wings.entries()) w.rotation.z = (i ? -1 : 1) * (this.flap ? 0.3 + Math.abs(Math.sin(F.t * 30 + i)) * 0.9 : 0.05);
    this.head.rotation.x = this.headP + (sp > 0.5 ? Math.sin(this.ph * 2) * 0.05 : 0);
    if (this.tail) { this.tail.rotation.x = this.tailUp * (this.kind === 'pig' ? 0.3 : 1.3); this.tail.rotation.z = Math.sin(F.t * (this.tailUp > 0.5 ? 18 : 4) + this.idx) * (this.kind === 'pig' ? 0.6 : 0.25); }
    const bob = sp > 0.5 ? Math.abs(Math.cos(this.ph)) * 0.05 * L : 0;
    // v5.2 cartoon squash & stretch / bug-eyes / fluff-up / buck / mane flip
    this.sq = Math.max(0, this.sq - dt * 1.4); const q = this.sq > 0 ? Math.sin((1 - this.sq) * Math.PI * 4) * this.sq : 0; R.scale.set(1 - 0.2 * q, 1 + 0.32 * q, 1 - 0.2 * q);
    this.bug = Math.max(0, this.bug - dt * 0.9); this.head.scale.copy(this.head0).multiplyScalar(1 + 0.45 * Math.sin(Math.min(1, this.bug * 3) * Math.PI / 2) * (this.bug > 0 ? 1 : 0));
    this.fluff = Math.max(0, this.fluff - dt * 0.5); const fk = Math.min(1, this.fluff * 2.5) * (1 + 0.06 * Math.sin(F.t * 18)); this.body.scale.set(this.body0.x * (1 + 0.38 * fk), this.body0.y * (1 + 0.22 * fk), this.body0.z * (1 + 0.25 * fk));
    this.buck = Math.max(0, this.buck - dt * 1.2); this.flip = Math.max(0, this.flip - dt * 1.5); if (this.flip > 0) { this.head.rotation.x -= Math.sin(this.flip * Math.PI) * 0.9; this.head.rotation.z = Math.sin(this.flip * Math.PI * 2) * 0.4; } else this.head.rotation.z = 0;
    R.position.set(this.pos.x, this.pos.y + this.hop + bob, this.pos.z); this.faintA = lerp(this.faintA || 0, this.state === 'faint' ? 1 : 0, Math.min(1, dt * (this.state === 'faint' ? 7 : 10)));
    R.rotation.set((gal ? Math.sin(this.ph) * 0.06 : 0) + (this.buck > 0 ? Math.sin(F.t * 12) * 0.3 * this.buck : 0), this.yaw, Math.sin(F.t * 30) * 0.1 * this.wig + this.faintA * 1.45 * (this.kind === 'chicken' ? 1.1 : 1)); // v5.3 comic faint: keels over on its side
    // "I'm hungry for…" bubble
    const want = !F.fed.has(this) && !this.busy && this.state !== 'ridden' && F.active && F.kidPos && Math.hypot(this.pos.x - F.kidPos.x, this.pos.z - F.kidPos.z) < 26 && this.fullT <= 0;
    const s0 = this.bub.scale.x, s1 = want ? 0.95 + (this.kind === 'chicken' ? -0.25 : 0) : 0; const ns = lerp(s0, s1, Math.min(1, dt * 8)); this.bub.scale.setScalar(ns); this.bub.visible = ns > 0.02;
    if (this.bub.visible) this.bub.position.set(this.pos.x, this.pos.y + this.h * (this.kind === 'chicken' ? 1.3 : 1) + 0.75 + Math.sin(F.t * 3 + this.idx) * 0.1, this.pos.z);
  }
  worldPt(local, out = V()) { this.root.updateMatrixWorld(); return out.copy(local).applyMatrix4(this.root.matrixWorld); }
  mouthPt(out = V()) { this.head.updateMatrixWorld(); return out.copy(this.mouth).applyMatrix4(this.head.matrixWorld); }
}

// ---------------- the living farm: animals, feeding, poop, the horse, Bad David ----------------
const POOP_MAX = 90, GOLD_MAX = 16;
export class FarmLife {
  constructor(game, W) {
    this.g = game; this.W = W; this.fx = game.fx; this.t = 0; this.active = false;
    this.root = new THREE.Group(); this.root.name = 'farm-life'; W.root.add(this.root);
    this.animals = []; for (const k in KINDS) for (let i = 0; i < KINDS[k].n; i++) this.animals.push(new Animal(this, k, i));
    this.horse = this.animals.find(a => a.kind === 'horse');
    // poop piles: swirly instanced poops with googly eyes (+ rare GOLDEN ones)
    const M = mats(), pg = mergeGeometries([C(CYL(0.24, 0.28, 0.1, 14), 0, 0, 0.05, 0), C(new THREE.TorusGeometry(0.19, 0.11, 8, 18), 0, 0, 0.12, 0, 1, 1, 1, Math.PI / 2, 0, 0),
      C(new THREE.TorusGeometry(0.13, 0.09, 8, 16), 0, 0, 0.26, 0, 1, 1, 1, Math.PI / 2, 0, 0), C(new THREE.TorusGeometry(0.07, 0.065, 6, 12), 0, 0, 0.37, 0, 1, 1, 1, Math.PI / 2, 0, 0), C(CONE(0.07, 0.17, 8), 0, 0, 0.47, 0, 1, 1, 1, 0.25, 0, 0)]);
    const eg = mergeGeometries([C(SPH(0.058, 8, 6), 0xffffff, 0.07, 0.29, 0.17), C(SPH(0.058, 8, 6), 0xffffff, -0.07, 0.29, 0.17), C(SPH(0.028, 6, 4), 0x111111, 0.075, 0.29, 0.222), C(SPH(0.028, 6, 4), 0x111111, -0.065, 0.29, 0.222),
      C(new THREE.TorusGeometry(0.055, 0.012, 4, 10, Math.PI), 0x2a1408, 0, 0.2, 0.2, 1, 1, 1, 0, 0, Math.PI)]);
    this.pMesh = new THREE.InstancedMesh(pg, M.poop, POOP_MAX); this.gMesh = new THREE.InstancedMesh(pg, M.gold, GOLD_MAX); this.eMesh = new THREE.InstancedMesh(eg, M.eyes, POOP_MAX + GOLD_MAX);
    for (const m of [this.pMesh, this.gMesh, this.eMesh]) { m.count = 0; m.castShadow = m !== this.eMesh; m.frustumCulled = false; this.root.add(m); }
    this.poops = []; this.prints = []; this.prMesh = new THREE.InstancedMesh(mergeGeometries([C(SPH(1, 10, 4), 0, 0, 0, 0, 0.1, 0.02, 0.16), ...[-0.07, -0.025, 0.02, 0.06].map((x, i) => C(SPH(0.03, 5, 3), 0, x, 0, 0.2 - Math.abs(i - 1.5) * 0.015, 1, 0.5, 1))]), M.print, 140);
    this.prMesh.count = 0; this.prMesh.frustumCulled = false; this.root.add(this.prMesh);
    this.sprites = []; for (let i = 0; i < 36; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon('heart'), transparent: true, depthWrite: false })); s.visible = false; s.renderOrder = 6; this.root.add(s); this.sprites.push({ s, life: 0 }); }
    this.foods = []; this.fed = new Set(); this.goal = 12; this.round = 1; this.n = { feeds: 0, fed: 0, farts: 0, poops: 0, squish: 0, gold: 0, toots: 0, rides: 0, bounces: 0, bigBounces: 0, flipsK: 0, fartBounces: 0, guestBounces: 0, dogBounces: 0, davidBounces: 0, coopVisits: 0, stinks: 0, stinkBlocked: 0, faints: 0, popUps: 0, strangers: 0, ewws: 0, nosesHeld: 0, runAways: 0, stinkFlies: 0, eggsCollected: 0, goldEggs: 0, coopPanics: 0, drives: 0, hopOffs: 0, honks: 0, putts: 0, exhaust: 0, balePush: 0, gallopFarts: 0, herds: 0, wins: 0, mud: 0, butts: 0, eggs: 0, fluffs: 0, bugeyes: 0, feathers: 0, slips: 0, noses: 0, dances: 0, turbos: 0, laughs: 0, flips: 0, boings: 0, starSplats: 0 };
    this.flyMesh = new THREE.InstancedMesh(mergeGeometries([C(SPH(0.045, 6, 4), 0x111111), C(SPH(1, 6, 4), 0xd8eeff, 0.04, 0.03, 0, 0.05, 0.012, 0.03), C(SPH(1, 6, 4), 0xd8eeff, -0.04, 0.03, 0, 0.05, 0.012, 0.03)]), mats().vc, 48); this.flyMesh.count = 0; this.flyMesh.frustumCulled = false; this.root.add(this.flyMesh);
    this.eggs = []; this.eggGeo = SPH(0.12, 10, 8); this.eggGeo.scale(1, 1.3, 1);
    this.riding = false; this.sinceGold = 0; this.hintT = 0; this.gfT = 3; this.mudT = 0; this.toastT = 0;
    // v5.3 the drivable TRACTOR (putt-putt engine, MOO-horn, exhaust puffs, bouncy suspension, squishes poop, pushes hay bales)
    { const T = this.tractor = { g: new THREE.Group(), body: null, pos: V(), yaw: 0.7, speed: 0, ph: 0, puttT: 0, bounce: 0 }; T.body = new THREE.Mesh(W.farmData.tractorGeo || new THREE.BoxGeometry(2, 2, 3), mats().vc); T.body.castShadow = true; T.g.add(T.body); T.g.name = 'tractor'; this.root.add(T.g); }
    this.driving = false;
    this.buildCastle(); this.nests = (W.farmData.coopNests || []).map(n => ({ ...n, egg: null, t: 0 })); this.eggs2 = 0; this.goldEggs = 0;
    this.stinkCD = 0; this.stink = null; this.strangers = []; this.stinkFlyM = [];
    this.david = new BadDavid(this); this.reset();
  }
  camDist(p) { const c = this.g.camera.position; return Math.hypot(p.x - c.x, p.z - c.z); }
  toast(t, cd = 0) { if (cd && this.t - (this._toastAt || -99) < cd) return; this._toastAt = this.t; this.g.hud.toast(t); }
  get kid() { const p = this.g.player; return p && p.def.farmKid ? p : null; }
  // everyone back home, poop swept up, new round
  reset() {
    for (const st of this.strangers || []) { this.root.remove(st.m.root); disposeStranger(st.m); } this.strangers = []; this.stink = null; this.stinkCD = 0; for (const f of this.stinkFlyM || []) f.visible = false;
    if (this.riding) this.dismount(true); if (this.driving) this.hopOffTractor(true); this.parkTractor();
    for (const a of this.animals) { a.free = null; a.path = null; a.cream && (a.cream.visible = false); const p = a.homePoint(); a.place(p.x, p.z); a.set('idle', Math.random() * 2); a.fullT = 0; }
    this.poops.length = 0; this.prints.length = 0; for (const e of this.eggs || []) this.root.remove(e.m); if (this.eggs) this.eggs.length = 0; this.turboT = 0; this.fed.clear(); this.round = 1; this.david.stop(); this.syncPoop(); this.bar();
    for (const b of this.W.farmData.bales) { b.fallen = false; b.roll = null; b.x = b.x0 ?? b.x; b.z = b.z0 ?? b.z; b.x0 = b.x; b.z0 = b.z; b.m.position.set(b.x, b.y, b.z); b.m.rotation.order = 'XYZ'; b.m.rotation.set(0, b.yaw, 0); b.col.x = b.x; b.col.z = b.z; }
  }
  titlePose(tx, tz) { const H = this.horse; H.free = null; H.place(tx + 3.4, tz - 1, -Math.PI / 2 + 0.35); H.set('title'); }
  // ---------- per frame ----------
  update(dt, title = false) {
    this.t += dt; const p = this.kid; this.active = !title && !!p; this.kidPos = p ? p.pos : null;
    for (const a of this.animals) a.update(dt, title);
    if (this.riding && p) this.syncHorse(p, dt);
    this.updateTractor(dt, p); this.updateCastle(dt, this.active ? p : null); this.updateCoop(dt, this.active ? p : null); this.updateStink(dt, p);
    this.updateFoods(dt); this.updateSprites(dt); this.updatePoops(dt); this.updateBales(dt); this.david.update(dt);
    if (this.active) this.kidStuff(p, dt);
    if (this.toastT > 0) this.toastT -= dt;
  }
  kidStuff(p, dt) {
    const m = p.mech, fx = this.fx; m.mud = Math.max(0, (m.mud || 0) - dt * 0.004);
    // squish poop!
    const rr = this.driving ? 2.1 : this.riding ? 1.5 : 0.75;
    for (const q of this.poops) { if (q.squish || q.t < 0.4) continue; const d = Math.hypot(q.x - p.pos.x, q.z - p.pos.z); if (d < rr * Math.max(0.8, q.s)) { q.gold ? this.collectGold(q) : this.squish(q, p); } }
    // mud: squelchy steps, a brown splash, and a muddy Leandro
    const mud = this.inMud(p.pos.x, p.pos.z); if (mud && p.speedNow > 1) { this.mudT -= dt; if (this.mudT <= 0) { this.mudT = this.riding ? 0.22 : 0.32; sfx.squelch(0.9); this.splat(p.pos, 5, 0.6); m.mud = Math.min(1, (m.mud || 0) + 0.12); this.n.mud++; if (!this._mudTold) { this._mudTold = true; this.toast('🟤 SQUELCH! Leandro is getting muddy! (the pond washes it off 💦)'); } } }
    if (p.ground < -0.25 && (m.mud || 0) > 0.05) { m.mud = 0; this.toast('💦 Splish splash! All clean!', 4); sfx.splash(0.6); }
    // don't walk through the animals
    for (const a of this.animals) { if (a.state === 'ridden') continue; const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z, d = Math.hypot(dx, dz), mm = a.K.r + (this.riding ? 1.0 : 0.45); if (d < mm && d > 1e-3) { p.pos.x = a.pos.x + dx / d * mm; p.pos.z = a.pos.z + dz / d * mm; } }
    // v5.3 tractor: Leandro can't walk through the parked tractor; while driving it shoves hay bales along
    const T = this.tractor; if (!this.driving) { const dx = p.pos.x - T.pos.x, dz = p.pos.z - T.pos.z, d = Math.hypot(dx, dz), mm = 2.3 + (this.riding ? 1 : 0.4); if (d < mm && d > 1e-3) { p.pos.x = T.pos.x + dx / d * mm; p.pos.z = T.pos.z + dz / d * mm; } }
    else if (p.speedNow > 1.5) { const f = V(Math.sin(p.yaw), 0, Math.cos(p.yaw)); for (const b of this.W.farmData.bales) { if (b.fallen && b.roll) continue; const dx = b.x - p.pos.x, dz = b.z - p.pos.z, d = Math.hypot(dx, dz); if (d < 3.6 && (dx * f.x + dz * f.z) > 0.5) { this.knockBale(b, p.pos, 3 + p.speedNow * 0.6); this.n.balePush++; sfx.boing(0.5, 0.7); this.toast('🚜 PUSH! The tractor shoved a hay bale! 💪', 3); } } }
    // galloping farts
    if (this.riding && p.boosting && p.speedNow > 13) { this.gfT -= dt; if (this.gfT <= 0) { this.gfT = 3 + Math.random() * 3.5; this.n.gallopFarts++; this.fartFrom(this.horse, 1.1, true); this.turboT = 1.4; this.n.turbos++; p.speedNow = Math.max(p.speedNow, p.st.speed * 1.9); if (Math.random() < 0.5) this.horseLaugh(); this.toast(pick(['💨 The horse tooted while galloping! 😂', '💨 PRRRRT! Giddy-up, stinky!', '💨 Horse power! 😂']), 6); } }
    // v5.2 fart-boost turbo: a burst of speed with a puffy cloud trail
    if (this.turboT > 0) { this.turboT -= dt; if (this.riding) { p.speedNow = Math.max(p.speedNow, p.st.speed * 1.6); this.turboPuffT = (this.turboPuffT || 0) - dt; if (this.turboPuffT <= 0) { this.turboPuffT = 0.09; const b = V(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)); this.cloud(V(p.pos.x + b.x * 1.4, p.pos.y + 1.6, p.pos.z + b.z * 1.4), b, 3, 0.8); } } }
    // button labels
    const near = this.nearFood(p), fl = near ? FOOD_EMOJI[near.K.food] : '🌽'; if (fl !== this._fl) { this._fl = fl; const b = document.querySelector('#a-laser span'); if (b) b.innerHTML = fl + '<br>FEED'; }
    const ride = this.riding ? 'off' : this.driving ? 'toff' : (this.onCastle(p.pos.x, p.pos.z) || this.castleHop) ? 'jump' : this.horseNear(p) ? 'near' : this.tractorNear(p) ? 'tnear' : 'far'; if (ride !== this._rl) { this._rl = ride; const b = document.querySelector('#a-missile span'), el = $('a-missile');
      if (b) b.innerHTML = ride === 'off' ? '🐴<br>HOP OFF' : ride === 'toff' ? '🚜<br>HOP OFF' : ride === 'tnear' ? '🚜<br>DRIVE' : ride === 'jump' ? '🤸<br>JUMP' : '🐴<br>RIDE'; if (el) el.classList.toggle('glow', ride === 'near' || ride === 'tnear' || ride === 'jump'); const bb = document.querySelector('#a-boost span'); if (bb) bb.innerHTML = this.riding ? 'GALLOP' : this.driving ? 'FAST' : 'RUN';
      const tb = document.querySelector('#a-melee span'); if (tb) tb.innerHTML = this.driving ? '📯<br>HONK' : '💨<br>TOOT'; }
    if (this.hintT > 0) this.hintT -= dt;
  }
  inMud(x, z) { for (const d of this.W.farmData.mud) if (Math.hypot(x - d.x, z - d.z) < d.r * 0.85) return d; return null; }
  horseNear(p) { const H = this.horse; return H && Math.hypot(H.pos.x - p.pos.x, H.pos.z - p.pos.z) < 4.6 && H.state !== 'ridden'; }
  nearFood(p, reach = this.riding ? 7.5 : 6) { let best = null, bd = 1e9; for (const a of this.animals) { if (a.busy || a.state === 'ridden') continue; const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) - a.K.r; if (d > reach) continue;
      const s = d + (this.fed.has(a) ? 4 : 0) + (a.fullT > 0 ? 8 : 0); if (s < bd) { bd = s; best = a; } } return best; }
  // ---------- controls (called from Game.update on the farm) ----------
  controls(p, inp, nL, nM, nB) {
    p.boostE = p.st.boost; // Leandro never runs out of puff
    if (nL) this.feed(p); if (nM && !this.riding && !this.driving && (this.onCastle(p.pos.x, p.pos.z) || this.castleHop)) { this.castleJump(p); nM = 0; } // v5.6.1: on the castle JUMP always wins (a horse or tractor parked nearby used to steal it)
    // v5.6.1: RIDE / HOP OFF / DRIVE only on a fresh press (plus a short cooldown). Holding the button used to auto-repeat every
    // 0.22 s, so a kid keeping a finger on HOP OFF got off and straight back on the horse (or tractor) and could never get down.
    if (nM && (!(inp && inp.pressed && inp.pressed.missile) || this.t < (this.rideCdT || 0))) nM = 0;
    if (nM) { this.rideCdT = this.t + 0.6; if (this.riding) this.dismount(); else if (this.driving) this.hopOffTractor(); else if (this.tractorNear(p) && !this.horseNear(p)) this.driveTractor(p); else this.tryMount(p); } if (nB) { if (this.driving) this.honk(); else this.toot(p); }
  }
  feed(p = this.kid) {
    if (!p) return false; const a = this.nearFood(p);
    if (!a) { const h = this.animals.filter(x => !this.fed.has(x) && x.state !== 'ridden').sort((x, y) => x.pos.distanceToSquared(p.pos) - y.pos.distanceToSquared(p.pos))[0];
      if (this.hintT <= 0) { this.hintT = 1.6; this.toast(h ? `${h.K.emoji} Walk up close to an animal, then tap FEED! The ${h.name} is hungry!` : '🌽 Walk up close to an animal, then tap FEED!'); } return false; }
    if (a.fullT > 0) { if (this.hintT <= 0) { this.hintT = 1.2; this.toast(`${a.K.emoji} The ${a.name} is full! Try another animal!`); } a.set('wait'); return false; }
    this.n.feeds++; p.mech.throwT = 0.45; sfx.whoosh && sfx.whoosh(0.35);
    const m = foodMesh(a.K.food); const from = p.mech.socketPos('hand', V()); m.position.copy(from); this.root.add(m); this.foods.push({ m, a, from, t: 0, dur: 0.5 }); a.set('wait'); return a;
  }
  updateFoods(dt) {
    for (let i = this.foods.length - 1; i >= 0; i--) { const f = this.foods[i]; f.t += dt; const u = Math.min(1, f.t / f.dur), to = f.a.mouthPt(V());
      f.m.position.lerpVectors(f.from, to, u); f.m.position.y += Math.sin(u * Math.PI) * 1.6; f.m.rotation.set(f.t * 9, f.t * 6, 0);
      if (u >= 1) { this.root.remove(f.m); f.m.geometry.dispose(); this.foods.splice(i, 1); f.a.set('eat'); f.a.fullT = 1e9; sfx.munch(Math.max(0.2, 1 - this.camDist(f.a.pos) / 50)); this.crumbs(to, FOOD_COL[f.a.K.food]); } }
  }
  crumbs(p, col) { const c = new THREE.Color(col); for (let i = 0; i < this.fx.n(8); i++) this.fx.glow.spawn({ pos: p, vel: { x: (Math.random() - 0.5) * 3, y: 1 + Math.random() * 2, z: (Math.random() - 0.5) * 3 }, size: 0.12, life: 0.6, r: c.r, g: c.g, b: c.b, alpha: 0.9, grav: 9 }); }
  onFed(a) {
    a.say(1.1); this.emote('heart', a, 3); a.fullT = 9;
    if (!this.fed.has(a)) { this.fed.add(a); this.n.fed++; const k = this.fed.size; this.bar();
      if (k >= this.goal) this.win(); else { this.toast(`🌟 Yum! The ${a.name} loves it! ${a.K.emoji} ${k}/${this.goal}`); if (k % 4 === 0) { sfx.tada(0.9); voice.say(pick(['Great job, Leandro!', 'Super farmer!', 'Yee-haw!']), { prio: 1, cd: 3000 }); } } }
    else this.toast(`${a.K.emoji} More snacks for the ${a.name}! Yum!`, 1.5);
  }
  win() {
    this.n.wins++; if (this.kid && !this.riding) { this.kid.mech.danceT = 5; this.n.dances++; } const n = this.fed.size; this.bar(); sfx.tada(1); sfx.cheer && sfx.cheer(0.8); music.victory();
    voice.say('Farm Hero! You fed all the animals, Leandro!', { prio: 3, cd: 0, replace: true });
    const el = $('farmwin'); if (el) { const s = $('fw-sub'); if (s) s.textContent = `You fed ${n} hungry animals! 🐮🐷🐔🐑🐐🐴`; el.classList.remove('hidden'); clearTimeout(this._winTO); this._winTO = setTimeout(() => el.classList.add('hidden'), 9000); }
    if (this.g.mh && this.g.mh.firework) { const p = this.kid ? this.kid.pos : FARM.yard; for (let i = 0; i < 5; i++) this.g.later(0.3 + i * 0.45, () => this.g.mh.firework(V(p.x + (Math.random() - 0.5) * 30, (p.y || 4) + 18 + Math.random() * 10, p.z + (Math.random() - 0.5) * 30))); }
    // the grand fart symphony: every animal nearby lets one rip, one after the other
    const near = this.animals.filter(a => !a.busy && a.state !== 'ridden').sort((x, y) => this.camDist(x.pos) - this.camDist(y.pos)).slice(0, 6);
    near.forEach((a, i) => this.g.later(1.2 + i * 0.55, () => { if (!a.busy) { a.set('fart'); this.fartFrom(a, 1); } }));
    this.g.later(4, () => { this.round++; this.fed.clear(); this.bar(); this.toast(`🚜 Round ${this.round}! Feed them all again!`); });
  }
  bar() { const f = $('fb-fed'); if (f) f.textContent = `${Math.min(this.fed.size, this.goal)}/${this.goal}`; const s = $('fb-stars'); if (s) { const k = this.fed.size; s.textContent = [4, 8, 12].map(x => k >= x ? '★' : '☆').join(''); }
    const q = $('fb-poop'); if (q) q.textContent = this.n.poops; const g = $('fb-gold'); if (g) g.textContent = this.n.gold; }
  // ---------- farts + poop ----------
  // v5.2: a BIG bouncy cartoon green fart cloud (puffy balls that pop out fast then billow) + little rising bubbles
  cloud(p, dir, n = 8, big = 1) { const fx = this.fx; this.n.clouds = (this.n.clouds || 0) + 1;
    for (let i = 0; i < fx.n(n * 1.3); i++) { const g = Math.random(); fx.smoke.spawn({ pos: { x: p.x + (Math.random() - 0.5) * 0.4 * big, y: p.y + (Math.random() - 0.5) * 0.4 * big, z: p.z + (Math.random() - 0.5) * 0.4 * big },
      vel: { x: dir.x * (2 + Math.random() * 3) * big + (Math.random() - 0.5) * 2 * big, y: 0.6 + Math.random() * 1.4, z: dir.z * (2 + Math.random() * 3) * big + (Math.random() - 0.5) * 2 * big }, size: 0.7 * big, size1: 3.4 * big, life: 1.6 + Math.random() * 0.8, r: 0.5 + g * 0.25, g: 0.85 + g * 0.1, b: 0.2 + g * 0.1, alpha: 0.8, drag: 2.4, rv: (Math.random() - 0.5) * 3, fadeIn: 0.03 }); }
    for (let i = 0; i < fx.n(6 * big); i++) fx.glow.spawn({ pos: { x: p.x + (Math.random() - 0.5) * 0.6 * big, y: p.y, z: p.z + (Math.random() - 0.5) * 0.6 * big }, vel: { x: dir.x * 1.5 + (Math.random() - 0.5) * 1.2, y: 1.2 + Math.random() * 1.6, z: dir.z * 1.5 + (Math.random() - 0.5) * 1.2 }, size: 0.12 + Math.random() * 0.12, size1: 0.2, life: 1.2 + Math.random() * 0.6, r: 0.75, g: 1.2, b: 0.4, alpha: 0.75, drag: 1, grav: -0.5 }); // little bubbles
    fx.ring(p, 1.2 * big, 0x9be04a); }
  fartFrom(a, v = 1, trail = false) {
    this.n.farts++; const near = clamp(1.25 - this.camDist(a.pos) / 50, 0, 1); sfx.fart(pick(a.K.farts), v * near * (a.kind === 'chicken' ? 0.7 : 1));
    const p = a.worldPt(a.rear), back = V(-Math.sin(a.yaw), 0, -Math.cos(a.yaw)); this.cloud(p, back, trail ? 14 : 9, a.kind === 'chicken' ? 0.5 : a.kind === 'cow' || a.kind === 'horse' ? 1.2 : 0.85); this.emote('stink', a, 1, p);
    if (trail) for (let i = 1; i < 5; i++) this.g.later(i * 0.12, () => this.cloud(a.worldPt(a.rear), back, 4, 0.9));
    for (const b of this.animals) if (b !== a && !b.busy && b.kind === 'chicken' && b.pos.distanceTo(a.pos) < 4) this.startle(b, a.pos, 1.2);
    a.sq = 1; this.phew(a.pos);
  }
  // v5.2: Leandro holds his nose and fans the air when a fart goes off near him
  phew(at) { const k = this.kid; if (!k || this.riding || !this.active) return; if (Math.hypot(k.pos.x - at.x, k.pos.z - at.z) > 7.5) return; k.mech.noseT = 1.8; this.n.noses++; if (Math.random() < 0.35) this.toast(pick(['👃 PEE-YOO! Leandro holds his nose! 😂', '👃 Phew! What a stinker!', '👃 Leandro: "Ewww, stinky!" 😂']), 4); }
  // v5.2: every kind does its own silly happy dance
  silly(a) { const F = this; const near = clamp(1.2 - this.camDist(a.pos) / 50, 0, 1);
    if (a.kind === 'cow') { a.bug = 1; this.n.bugeyes++; this.emote('eyes', null, 1, a.mouthPt(V()).add(V(0, 0.6, 0))); sfx.boing(near * 0.7, 0.7); }
    else if (a.kind === 'chicken') { this.n.feathers++; for (let i = 0; i < this.fx.n(14); i++) this.fx.glow.spawn({ pos: V(a.pos.x, a.pos.y + 0.6, a.pos.z), vel: { x: (Math.random() - 0.5) * 4, y: 2 + Math.random() * 2, z: (Math.random() - 0.5) * 4 }, size: 0.14, size1: 0.1, life: 1.6, r: 1.5, g: 1.5, b: 1.45, alpha: 0.95, grav: 1.2, drag: 2, rv: 6 });
      this.emote('feather', a, 2); a.sq = 1; if (Math.random() < 0.6 || !this.n.eggs) this.g.later(0.9, () => this.layEgg(a)); }
    else if (a.kind === 'sheep') { a.fluff = 1.6; this.n.fluffs++; sfx.boing(near * 0.6, 1.3); }
    else if (a.kind === 'horse') { this.horseLaugh(a); a.flip = 1; }
    else a.sq = 1; }
  layEgg(a) { if (this.eggs.length >= 8) { const o = this.eggs.shift(); this.root.remove(o.m); } const m = new THREE.Mesh(this.eggGeo, new THREE.MeshStandardMaterial({ color: Math.random() < 0.15 ? 0x8ad0ff : 0xfff6e8, roughness: 0.5 }));
    const p = a.worldPt(a.rear); m.position.set(p.x, this.W.height(p.x, p.z) + 0.15, p.z); m.castShadow = true; this.root.add(m); this.eggs.push({ m, t: 0 }); this.n.eggs++; sfx.plop(0.5); sfx.boing(0.4, 1.6);
    this.emote('sparkle', null, 2, m.position.clone().setY(m.position.y + 0.4)); this.toast('🥚 SURPRISE! The chicken laid an egg! 😂', 5); }
  horseLaugh(H = this.horse) { this.n.laughs++; sfx.laughNeigh(clamp(1.2 - this.camDist(H.pos) / 50, 0.1, 1)); H.flip = 1; this.n.flips++; }
  goatButt(a) { const b = this.nearestBale(a.pos, 16); if (!b || Math.random() < 0.3) return false; a.butt = b; a.set('butt'); return true; }
  hayBurst(p) { for (let i = 0; i < this.fx.n(16); i++) this.fx.glow.spawn({ pos: p, vel: { x: (Math.random() - 0.5) * 6, y: 2 + Math.random() * 4, z: (Math.random() - 0.5) * 6 }, size: 0.12, size1: 0.08, life: 1, r: 1.4, g: 1.15, b: 0.45, alpha: 1, grav: 7, rv: 8 }); }
  poopFrom(a) { const p = a.worldPt(a.rear), back = V(-Math.sin(a.yaw), 0, -Math.cos(a.yaw)), x = p.x + back.x * 0.35, z = p.z + back.z * 0.35; this.dropPoop(x, z, { cow: 1.3, horse: 1.2, pig: 0.85, sheep: 0.6, goat: 0.6, chicken: 0.38 }[a.kind] || 1, p.y); }
  dropPoop(x, z, s = 1, fromY = null) {
    this.sinceGold++; const gold = this.poops.filter(q => q.gold).length < GOLD_MAX && (Math.random() < 0.1 || this.sinceGold >= 7); if (gold) this.sinceGold = 0;
    if (!gold && this.poops.filter(q => !q.gold).length >= POOP_MAX) { const i = this.poops.findIndex(q => !q.gold); if (i >= 0) this.poops.splice(i, 1); }
    const y = this.W.height(x, z); this.poops.push({ x, z, y, y0: fromY ?? y + 1, s, gold, squish: 0, t: 0, landed: false, yaw: Math.random() * 0.8 - 0.4 + Math.atan2(this.g.camera.position.x - x, this.g.camera.position.z - z), ph: Math.random() * 6 });
    this.n.poops++; this.bar(); sfx.plop(clamp(1.3 - this.camDist({ x, z }) / 45, 0.05, 1)); if (gold) { const g = $('fb-gold'); this.toast('✨ A GOLDEN POOP! Go grab it! ✨', 3); }
  }
  squish(q, p) { q.squish = 1; this.n.squish++; sfx.squish(1); sfx.stars(0.7); this.n.starSplats++; const at = V(q.x, q.y, q.z); this.splat(at, 16, q.s * 1.3); this.emote('star', null, 3, at.clone().setY(at.y + 0.5)); this.fx.ring(at, 1.6 * q.s, 0x6a4020);
    if (p) { p.mech.mud = Math.min(1, (p.mech.mud || 0) + 0.15); p.mech.squishT = 0.6;
      if (!this.riding && !this.driving && (this.n.squish % 3 === 1)) { p.mech.slipT = 1.4; this.n.slips++; sfx.slip(1); p.speedNow = 0; this.emote('star', null, 4, V(p.pos.x, p.pos.y + 1.2, p.pos.z)); this.toast('🍌 WHOOPS! Leandro slipped on the poop! 😂', 0); return; } }
    this.toast(pick(['💩 SQUISH! Ewww! 😂', '💩 SPLAT! Stinky shoes!', '💩 Oops! Stepped in poop!', '💩 SQUELCH! Gross! 😂']), 2.5); }
  collectGold(q) { const i = this.poops.indexOf(q); if (i >= 0) this.poops.splice(i, 1); this.n.gold++; this.bar(); sfx.tada(1); sfx.sparkle(1); sfx.coin && sfx.coin(); this.emote('sparkle', null, 4, V(q.x, q.y + 0.6, q.z));
    for (let k = 0; k < this.fx.n(24); k++) this.fx.glow.spawn({ pos: V(q.x, q.y + 0.4, q.z), vel: { x: (Math.random() - 0.5) * 7, y: 3 + Math.random() * 5, z: (Math.random() - 0.5) * 7 }, size: 0.25, size1: 0.05, life: 0.9, r: 3, g: 2.4, b: 0.6, alpha: 1, grav: 8 });
    this.toast(`✨ GOLDEN POOP! ✨ You have ${this.n.gold}!`); try { this.g.save.farmGold = (this.g.save.farmGold || 0) + 1; this.g.persist && this.g.persist(); } catch (e) { } }
  splat(p, n, s = 1) { for (let i = 0; i < this.fx.n(n); i++) this.fx.smoke.spawn({ pos: { x: p.x, y: p.y + 0.2, z: p.z }, vel: { x: (Math.random() - 0.5) * 5 * s, y: 2 + Math.random() * 3, z: (Math.random() - 0.5) * 5 * s }, size: 0.25 * s, size1: 0.5 * s, life: 0.6, r: 0.32, g: 0.2, b: 0.09, alpha: 0.95, grav: 14, rv: 2 }); }
  updatePoops(dt) {
    for (const q of this.poops) { q.t += dt; if (!q.landed && q.t >= 0.3) { q.landed = true; this.n.boings++; const v = clamp(1.2 - this.camDist(q) / 40, 0, 0.7); if (v > 0.02) sfx.boing(v, q.gold ? 1.4 : 0.9 + Math.random() * 0.3); }
      if (q.gold && Math.random() < dt * 6 && this.camDist(q) < 60) this.fx.glow.spawn({ pos: { x: q.x + (Math.random() - 0.5) * 0.7, y: q.y + 0.2 + Math.random() * 0.7, z: q.z + (Math.random() - 0.5) * 0.7 }, vel: { x: 0, y: 0.8, z: 0 }, size: 0.3, size1: 0.02, life: 0.7, r: 3, g: 2.6, b: 0.8, alpha: 1 }); }
    for (const e of this.eggs) { e.t += dt; e.m.rotation.z = Math.sin(e.t * 6) * 0.15 * Math.max(0, 1 - e.t / 3); }
    if (Math.random() < dt * 2.5 && this.poops.length) { const q = pick(this.poops); if (!q.squish && this.camDist(q) < 40) this.fx.glow.spawn({ pos: { x: q.x + (Math.random() - 0.5) * 0.4, y: q.y + 0.5 * q.s, z: q.z + (Math.random() - 0.5) * 0.4 }, vel: { x: Math.sin(this.t * 3) * 0.3, y: 1.0, z: 0 }, size: 0.16, size1: 0.35, life: 1.2, r: 0.5, g: 1.1, b: 0.2, alpha: 0.6 }); }
    this.syncPoop();
  }
  syncPoop() {
    const o = this._o || (this._o = new THREE.Object3D()); let np = 0, ng = 0, ne = 0;
    for (const q of this.poops) { const drop = q.t < 0.3 ? 1 - q.t / 0.3 : 0, bounce = q.t > 0.3 && q.t < 1.1 ? Math.sin((q.t - 0.3) / 0.8 * Math.PI * 3) * 0.5 * (1 - (q.t - 0.3) / 0.8) : 0;
      const sx = q.squish ? 1.45 : 1 + bounce * 0.5, sy = q.squish ? 0.28 : (1 - bounce * 0.6) * (1 + Math.sin(this.t * 3 + q.ph) * 0.03) * (q.gold ? 1.15 : 1);
      o.position.set(q.x, lerp(q.y, q.y0, drop * drop), q.z); o.rotation.set(0, q.yaw + (q.gold ? this.t * 1.5 : 0), 0); o.scale.set(sx * q.s, sy * q.s, sx * q.s); if (q.gold) o.position.y += 0.15 + Math.sin(this.t * 4 + q.ph) * 0.1; o.updateMatrix();
      if (q.gold) this.gMesh.setMatrixAt(ng++, o.matrix); else this.pMesh.setMatrixAt(np++, o.matrix); if (!q.squish) this.eMesh.setMatrixAt(ne++, o.matrix); }
    let nf2 = 0; const cam = this.g.camera.position; for (const q of this.poops) { if (q.gold || q.squish || nf2 >= 46) continue; if (Math.hypot(q.x - cam.x, q.z - cam.z) > 60) continue;
      for (let k = 0; k < 2; k++) { const a = this.t * (5 + k * 2) + q.ph * 3 + k * 3; o.position.set(q.x + Math.cos(a) * 0.45 * q.s, q.y + (0.55 + 0.15 * Math.sin(this.t * 7 + k)) * q.s, q.z + Math.sin(a * 1.3) * 0.45 * q.s); o.rotation.set(0, -a, 0); o.scale.setScalar(1); o.updateMatrix(); this.flyMesh.setMatrixAt(nf2++, o.matrix); } }
    this.flyMesh.count = nf2; this.flyMesh.instanceMatrix.needsUpdate = true;
    this.pMesh.count = np; this.gMesh.count = ng; this.eMesh.count = ne; for (const m of [this.pMesh, this.gMesh, this.eMesh]) m.instanceMatrix.needsUpdate = true;
    let nf = 0; for (const f of this.prints) { o.position.set(f.x, f.y + 0.03, f.z); o.rotation.set(0, f.yaw, 0); o.scale.setScalar(1.4); o.updateMatrix(); this.prMesh.setMatrixAt(nf++, o.matrix); } this.prMesh.count = nf; this.prMesh.instanceMatrix.needsUpdate = true;
  }
  footprint(x, z, yaw) { if (this.prints.length >= 140) this.prints.shift(); this.prints.push({ x, z, y: this.W.height(x, z), yaw }); }
  // ---------- emotes ----------
  emote(kind, a, n = 1, at = null) { for (let i = 0; i < n; i++) { const sp = this.sprites.find(s => s.life <= 0) || this.sprites[(Math.random() * this.sprites.length) | 0]; const p = at ? at.clone() : V(a.pos.x, a.pos.y + a.h * (a.kind === 'chicken' ? 1.3 : 1) + 0.3, a.pos.z);
      sp.s.material.map = icon(kind); sp.s.material.needsUpdate = true; sp.s.position.copy(p).add(V((Math.random() - 0.5) * 0.8, i * 0.25, (Math.random() - 0.5) * 0.8)); sp.vy = 0.9 + Math.random() * 0.6; sp.life = sp.max = 1.3 + i * 0.15; sp.k = kind === 'stink' ? 1.1 : 0.8; sp.s.visible = true; } }
  updateSprites(dt) { for (const sp of this.sprites) { if (sp.life <= 0) continue; sp.life -= dt; const u = 1 - sp.life / sp.max; sp.s.position.y += sp.vy * dt; const sc = sp.k * Math.min(1, u * 6) * (u > 0.8 ? 1 - (u - 0.8) * 5 : 1); sp.s.scale.setScalar(Math.max(0.001, sc)); sp.s.material.opacity = 1; if (sp.life <= 0) sp.s.visible = false; } }
  // ---------- animal reactions ----------
  startle(a, from, dur = 1.6) { if (a.state === 'ridden' || a.state === 'rodeo' || a.busy) return; const away = V(a.pos.x - from.x, 0, a.pos.z - from.z); if (away.lengthSq() < 0.01) away.set(1, 0, 0); away.normalize();
    a.goal = V(a.pos.x + away.x * 8, 0, a.pos.z + away.z * 8); a.set('flee'); a.dur = dur; a.hop = 0.5; this.emote('bang', a); if (Math.random() < 0.6) a.say(0.9); }
  toot(p = this.kid) {
    if (!p || this.t - (this._tootAt || -9) < 0.35) return; this._tootAt = this.t; this.n.toots++; p.mech.tootT = 0.8; p.mech.jumpT = 0.55; const k = sfx.fart('random', 1);
    const back = V(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)), at = V(p.pos.x + back.x * 0.3, p.pos.y + (this.riding ? 2.3 : 0.7), p.pos.z + back.z * 0.3); this.cloud(at, back, 12, 1.1); this.emote('stink', null, 1, at.clone().setY(at.y + 0.6)); if (this.riding) this.horseLaugh();
    let n = 0; for (const a of this.animals) if (a.state !== 'ridden' && a.pos.distanceTo(p.pos) < 8) { n++; if (a.kind === 'chicken' || Math.random() < 0.5) this.startle(a, p.pos, 1.2); else { a.say(0.9); this.emote('bang', a); } }
    this.toast(pick(['💨 Leandro tooted! 😂', '💨 PFFFT! Excuse me!', '💨 BRAAAP! Who did that?! 😂', '💨 Toot toot! 😂']), 2); return k;
  }
  // ---------- the horse ----------
  tryMount(p = this.kid) { if (!p) return false; if (!this.horseNear(p)) { if (this.hintT <= 0) { this.hintT = 1.6; this.toast('🐴 Walk up to the horse, then tap RIDE! (he lives in the paddock 👉)'); } return false; } this.mount(p); return true; }
  mount(p = this.kid) {
    const H = this.horse; this.riding = true; this.n.rides++; this.kidSpeed = this.kidSpeed || p.st.speed; p.st.speed = 12.5; p.radius = 1.25;
    p.pos.set(H.pos.x, p.pos.y, H.pos.z); p.yaw = H.yaw; p.speedNow = 0; p.groundY(); H.set('ridden'); H.free = null; p.mech.setRide(true); this.gfT = 2.5;
    H.say(1.2); this.g.later(0.9, () => this.horseLaugh()); this.toast('🐴 Giddy-up! Hold RUN to GALLOP! Tap HOP OFF to get down.'); voice.say('Giddy up!', { prio: 2, cd: 2000 }); this.fx.dust(p.pos, 8, 1.5, 4); this._rl = null;
  }
  dismount(quiet = false) {
    const p = this.kid, H = this.horse; this.riding = false; if (!p) return; const side = V(Math.cos(p.yaw), 0, -Math.sin(p.yaw)); p.st.speed = this.kidSpeed || 6.5; p.radius = 0.7; p.mech.setRide(false);
    H.place(p.pos.x, p.pos.z, p.yaw); H.free = H.inside() ? null : { x: H.pos.x, z: H.pos.z, r: 7 }; H.set('idle', 0); H.dur = 3; H.speed = 0;
    for (const s of [1, -1]) { const x = H.pos.x + side.x * s * 2.4, z = H.pos.z + side.z * s * 2.4; if (this.W.height(x, z) > -1.2) { p.pos.set(x, 0, z); break; } } p.groundY(); p.speedNow = 0; this._rl = null;
    if (!quiet) { this.toast('🐴 Whoa there! Leandro hopped off.'); H.say(0.8); this.fx.dust(p.pos, 6, 1.2, 4); }
  }
  // ---------- v5.3 the BIG BOUNCY CASTLE ----------
  buildCastle() { const K = FARM.castle, g = this.castle = new THREE.Group(), y = this.W.height(K.x, K.z), M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.0 }); g.position.set(K.x, y, K.z); g.name = 'bouncy-castle'; this.root.add(g);
    this.castleWalls = []; const S = 6; const floor = this.castleFloor = new THREE.Group(); g.add(floor);
    floor.add(new THREE.Mesh(new THREE.BoxGeometry(S * 2, 0.9, S * 2), M(0x3a8ae8)).translateY(0.45)); const pad = new THREE.Mesh(new THREE.BoxGeometry(S * 2 - 1, 0.12, S * 2 - 1), M(0xffd23a)); pad.position.y = 0.92; floor.add(pad);
    const cols = [0xe8302a, 0xffd23a, 0x2ac85a, 0x9a4aff, 0xff7ac8, 0x2ab8ff]; let ci = 0;
    const tube = (x, z, len, rotY) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, len, 4, 10).rotateZ(Math.PI / 2), M(cols[ci++ % cols.length])); this.castleWalls.push(m); m.position.set(x, 1.45, z); m.rotation.y = rotY; m.castShadow = true; floor.add(m);
      const m2 = m.clone(); m2.material = M(cols[ci++ % cols.length]); m2.position.y = 2.5; m2.scale.setScalar(0.92); floor.add(m2); this.castleWalls.push(m2); };
    tube(0, -S, S * 2 - 1.4, 0); tube(0, S, S * 2 - 1.4, 0); tube(S, 0, S * 2 - 1.4, Math.PI / 2); tube(-S, -S / 2 - 0.9, S - 2.6, Math.PI / 2); tube(-S, S / 2 + 0.9, S - 2.6, Math.PI / 2); // entrance gap on the -x side (toward the yard)
    this.turrets = []; [[S, S], [S, -S], [-S, S], [-S, -S]].forEach(([x, z], i) => { const t = new THREE.Group(); t.position.set(x, 0.6, z); g.add(t); const c = cols[(i * 2) % cols.length];
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, K.h - 1.2, 14), M(c)); body.position.y = (K.h - 1.2) / 2; body.castShadow = true; t.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.9, 14), M(cols[(i * 2 + 1) % cols.length])); roof.position.y = K.h - 0.2; t.add(roof); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), M(0xffffff)); ball.position.y = K.h + 0.9; t.add(ball);
      this.turrets.push({ t, ph: i * 1.7 }); });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.5, 8, 16, Math.PI), M(0xff7ac8)); arch.position.set(-S, 1.0, 0); arch.rotation.y = Math.PI / 2; floor.add(arch); this.castleWalls.push(arch); // v5.6.1: the doorway arch goes see-through too when the camera is right behind it
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.castleWob = 0; this.kidBounce = { v: 0, h: 0 }; this.guest = null; this.guestT = 4; }
  onCastle(x, z, m = 0) { const K = FARM.castle; return Math.abs(x - K.x) < 5.4 - m && Math.abs(z - K.z) < 5.4 - m; }
  castleBoing(v = 1, pitch = 1) { this.castleWob = Math.max(this.castleWob, 0.6 * v); sfx.boing(clamp(v * (1.2 - this.camDist(FARM.castle) / 60), 0.05, 1), pitch); sfx.squeakBounce && sfx.squeakBounce(v, pitch); }
  // v5.6.1 a landing on the castle floor: a springy bounce (JUMP queued = a BIG flip bounce)
  castleLand(p, big) { const B = this.kidBounce; this.castleJumpQ = false; B.bigUsed = big; const fart = !big && Math.random() < 0.18; B.v = big ? 16.5 : fart ? 13 : 10.5; this.n.bounces++; p.mech.squashT = 0.18;
    if (big) { this.n.bigBounces++; p.mech.flipT = 0.75; this.n.flipsK++; }
    if (fart) { this.n.fartBounces++; sfx.fart(pick(['squeakup', 'squeaky', 'tiny']), 0.8); this.cloud(V(p.pos.x, p.pos.y + 0.6, p.pos.z), V(0, -1, 0), 6, 0.7); this.toast('💨 FART-BOUNCE! 😂', 4); }
    this.castleBoing(big ? 1 : 0.7, big ? 0.8 : 1 + Math.random() * 0.2); if (this.n.bounces === 1) this.toast('🏰 BOING! The BOUNCY CASTLE! Tap JUMP for a big flip! Walk out the door to hop off.'); }
  // v5.6.1 JUMP on the castle: fires right away (no waiting for the next landing). One big jump per bounce, so mashing or holding
  // the button can never stack up and launch Leandro into the sky; a tap high in the air is saved for the next landing.
  castleJump(p) { const B = this.kidBounce; this.n.jumpTaps = (this.n.jumpTaps || 0) + 1; if (this.castleHop) return;
    if (!B.bigUsed && B.h < 2.6) { B.bigUsed = true; B.v = Math.max(B.v, Math.sqrt(Math.max(0, 2 * 24 * (5.7 - B.h)))); this.n.bigBounces++; this.n.jumpNow = (this.n.jumpNow || 0) + 1; p.mech.flipT = 0.75; this.n.flipsK++; this.castleBoing(1, 0.8); }
    else this.castleJumpQ = true; }
  // v5.6.1 the castle's walls are real: hop in over a wall, stay in, walk out the door or push on a wall to hop off. Horse and tractor stay out.
  castlePhys(dt, p) { const K = FARM.castle, C = this.kc || (this.kc = { lx: 0, lz: 0, push: 0, has: false, bumpT: 0 }); C.bumpT -= dt;
    if (!p || !this.active) { C.has = false; return; }
    if (!C.has || Math.hypot(p.pos.x - C.lx, p.pos.z - C.lz) > 3) { C.lx = p.pos.x; C.lz = p.pos.z; C.has = true; C.inside = undefined; } // first frame, or a teleport (restart, travel, tests): never drag him back
    const IN = 4.9, OUT = 6.7, DOOR = 2.0, dx = p.pos.x - K.x, dz = p.pos.z - K.z, ldx = C.lx - K.x, ldz = C.lz - K.z;
    if (this.castleHop) { C.lx = p.pos.x; C.lz = p.pos.z; return; }
    if (this.riding || this.driving) { // the horse and the tractor can't go on the bouncy castle: a soft rubbery push back
      const r = this.riding ? 1.4 : 2.2, E = OUT + r; if (Math.abs(dx) < E && Math.abs(dz) < E) { const ox = E - Math.abs(dx), oz = E - Math.abs(dz);
        if (ox < oz) p.pos.x = K.x + Math.sign(dx || -1) * E; else p.pos.z = K.z + Math.sign(dz || -1) * E; p.speedNow *= 0.5; this.n.rideBlocks = (this.n.rideBlocks || 0) + 1;
        if (C.bumpT <= 0) { C.bumpT = 2.5; this.castleBoing(0.5, 0.7); this.toast(this.riding ? '🐴 No horses on the bouncy castle! Tap HOP OFF, then jump on! 🏰' : '🚜 Tractors are too heavy for the bouncy castle! Tap HOP OFF, then jump on! 🏰', 3); } }
      C.lx = p.pos.x; C.lz = p.pos.z; return; }
    if (C.inside === undefined) C.inside = Math.abs(dx) < IN + 0.3 && Math.abs(dz) < IN + 0.3;
    const band = dx < -IN + 0.01 && dx > -OUT - 0.5 && Math.abs(dz) < DOOR + 0.6; // the doorway passage on the yard side
    if (C.inside) {
      // bouncy floor: slower steps so he stays on it and gets lots of bounces
      p.pos.x = C.lx + (p.pos.x - C.lx) * 0.6; p.pos.z = C.lz + (p.pos.z - C.lz) * 0.6; let nx = p.pos.x - K.x, nz = p.pos.z - K.z;
      const door = nx < -IN && Math.abs(nz) < DOOR;
      if (door) { C.push = 0; if (nx < -OUT) { C.inside = false; this.n.doorExits = (this.n.doorExits || 0) + 1; } } // walked straight out of the doorway
      else if (Math.abs(nx) > IN || Math.abs(nz) > IN) { const ox = Math.abs(nx) - IN, oz = Math.abs(nz) - IN, n = ox > oz ? V(Math.sign(nx), 0, 0) : V(0, 0, Math.sign(nz));
        if (nx < -IN && Math.abs(nz) < DOOR + 0.6) nz = clamp(nz, -DOOR + 0.05, DOOR - 0.05); else { nx = clamp(nx, -IN, IN); nz = clamp(nz, -IN, IN); } p.pos.x = K.x + nx; p.pos.z = K.z + nz; C.push += dt;
        if (C.bumpT <= 0) { C.bumpT = 0.8; this.castleWob = Math.max(this.castleWob, 0.4); sfx.squeakBounce && sfx.squeakBounce(0.5, 1.2); this.n.wallBumps = (this.n.wallBumps || 0) + 1; }
        if (C.push > 1.6) this.startCastleHop(p, false, V(p.pos.x + n.x * (OUT - IN + 2.4), 0, p.pos.z + n.z * (OUT - IN + 2.4))); }
      else C.push = Math.max(0, C.push - dt * 2); }
    else if (Math.abs(dx) < OUT && Math.abs(dz) < OUT) { // outside → into the castle: through the doorway, or spring over the wall
      if (band || (ldx < -IN && Math.abs(ldz) < DOOR + 0.6 && dx < -IN)) { p.pos.z = K.z + clamp(dz, -DOOR + 0.05, DOOR - 0.05); if (dx > -IN) C.inside = true; }
      else { const t = V(K.x + clamp(dx, -IN + 1.2, IN - 1.2) * 0.75, 0, K.z + clamp(dz, -IN + 1.2, IN - 1.2) * 0.75); this.startCastleHop(p, true, t, V(C.lx, 0, C.lz)); } }
    C.lx = p.pos.x; C.lz = p.pos.z; }
  startCastleHop(p, into, to, from = V(p.pos.x, 0, p.pos.z)) { const B = this.kidBounce; if (this.kc) this.kc.inside = false; this.castleHop = { a: from, b: to, t: 0, dur: into ? 0.55 : 0.6, h: into ? 3.2 : 2.6, into }; B.h = 0; B.v = 0; this.castleJumpQ = false; B.bigUsed = false; if (this.kc) this.kc.push = 0;
    if (into) { this.n.hopIns = (this.n.hopIns || 0) + 1; sfx.boing(0.7, 1.1); } else { this.n.hopOffs2 = (this.n.hopOffs2 || 0) + 1; sfx.boing(0.7, 1.25); this.toast('🤸 WHEEE! Leandro hopped off the castle!', 3); }
    this.castleWob = Math.max(this.castleWob, 0.6); }
  // v5.6.1 a fresh start (restart level / new kid): nobody is left riding, driving or mid-bounce
  resetKid() { const H = this.horse; if (this.riding && H) { H.set('idle', 0); H.free = null; } if (H && H.state === 'ridden') { H.set('idle', 0); H.free = null; }
    this.riding = false; this.driving = false; this.kidSpeed = null; this.castleHop = null; this.castleJumpQ = false; this.turboT = 0; if (this.kidBounce) { this.kidBounce.h = 0; this.kidBounce.v = 0; this.kidBounce.bigUsed = false; } if (this.kc) { this.kc.has = false; this.kc.inside = undefined; } this._rl = null; }
  updateCastle(dt, p) { const K = FARM.castle, y0 = this.castle.position.y, cp = this.g.camera.position;
    // the camera never gets a face full of inflatable: walls go see-through when the camera is right at / inside the castle
    const camIn = Math.abs(cp.x - K.x) < 10.5 && Math.abs(cp.z - K.z) < 10.5 && cp.y < y0 + 10; /* v5.6.1: a bit wider and higher, the camera rises with the big bounces */ if (camIn !== this._camIn) { this._camIn = camIn; for (const w of this.castleWalls) { w.material.transparent = camIn; w.material.opacity = camIn ? 0.28 : 1; w.material.depthWrite = !camIn; w.material.needsUpdate = true; } }
    const W = this.castleWob = Math.max(0, this.castleWob - dt * 1.2);
    this.castleFloor.scale.set(1 + W * 0.04 * Math.sin(this.t * 22), 1 - W * 0.12 * Math.abs(Math.sin(this.t * 18)), 1 + W * 0.04 * Math.cos(this.t * 20));
    for (const T of this.turrets) { T.t.rotation.x = Math.sin(this.t * 2.2 + T.ph) * (0.04 + W * 0.18); T.t.rotation.z = Math.cos(this.t * 1.9 + T.ph) * (0.04 + W * 0.18); T.t.scale.y = 1 + Math.sin(this.t * 3 + T.ph) * 0.03 - W * 0.08; }
    // v5.6.1 Leandro on the castle. ROOT CAUSE of "issues with jumping on the bouncy castle": the castle was only an invisible
    // square trigger with no walls, and the bounce was purely cosmetic. A kid holding the joystick ran straight across it in under
    // a second (2 small bounces), through the far wall and off the other side; JUMP only queued a flip for the next landing (often
    // after he had already left), and a horse or tractor parked nearby stole the JUMP button. Now the inflatable walls are real:
    // walk into one from outside and Leandro springs over it onto the castle; inside, the walls keep him on (soft boing) and the
    // bouncy floor slows his steps; walk out of the doorway or keep pushing into a wall to hop off. JUMP fires at once.
    this.castlePhys(dt, p);
    const B = this.kidBounce; if (p && !this.riding && !this.driving) { const on = this.onCastle(p.pos.x, p.pos.z), H = this.castleHop;
      if (H) { H.t += dt; const u = Math.min(1, H.t / H.dur); p.pos.x = lerp(H.a.x, H.b.x, u); p.pos.z = lerp(H.a.z, H.b.z, u); p.groundY(); B.h = Math.sin(u * Math.PI) * H.h; B.v = 0; p.speedNow = 0;
        if (u >= 1) { this.castleHop = null; B.h = 0; if (H.into) { B.v = 0; if (this.kc) this.kc.inside = true; this.castleLand(p, false); } else { this.fx.dust(p.pos, 8, 1.2, 4); sfx.boing(0.5, 1.3); B.v = 0; } } p.mech.castleH = (H.into ? u : 1 - u) * 0.9 + B.h; }
      else if (on || B.h > 0) { B.v -= 24 * dt; B.h = Math.max(0, B.h + B.v * dt);
        if (B.h <= 0 && on) this.castleLand(p, this.castleJumpQ);
        if (!on && B.h <= 0) B.v = 0; p.mech.castleH = (on ? 0.9 : 0) + B.h; }
      else p.mech.castleH = 0; }
    else { B.h = 0; B.v = 0; this.castleHop = null; if (p) p.mech.castleH = 0; }
    // guests: an animal hops on for a silly bounce (with fart-bounces) while Leandro plays there
    if (this.guest) { const a = this.guest; a.gT += dt; if (a.gT > 7 || a.state !== 'bounce') { if (a.state === 'bounce') { this.fx.dust(a.pos, 8, 1.2, 4); a.goHome(1.4); } this.guest = null; this.guestT = 8; } }
    else if (p && this.onCastle(p.pos.x, p.pos.z) && (this.guestT -= dt) <= 0) { const c = this.animals.filter(a => !a.busy && a.state !== 'herded' && a !== this.runaway && a.kind !== 'horse' && a.pos.distanceTo(p.pos) < 90).sort(() => Math.random() - 0.5)[0];
      if (c) { this.fx.dust(c.pos, 8, 1.2, 4); const ang = Math.random() * TAU; c.place(K.x + Math.cos(ang) * 3, K.z + Math.sin(ang) * 3); c.set('bounce'); c.gT = 0; c.free = null; c.path = null; this.guest = c; this.fx.dust(c.pos, 8, 1.2, 4); this.toast(`🏰 The ${c.name} wants to bounce too! ${c.K.emoji}`, 3); } else this.guestT = 5; }
    // the dogs and Bad David bounce too when they're on it
    const Wz = this.g.westies; if (Wz && Wz.active) for (const d of Wz.activeDogs()) if (this.onCastle(d.pos.x, d.pos.z)) { d.cb = (d.cb || 0) + dt; if (d.cb > 0.55) { d.cb = 0; this.n.dogBounces++; this.castleBoing(0.4, 1.3); if (Math.random() < 0.25) { sfx.fart('tiny', 0.6); this.n.fartBounces++; } } d.castleHop = 0.9 + Math.abs(Math.sin(this.t * 5.7)) * 2.2; } else d.castleHop = 0;
    const D = this.david; if (D.active && D.state !== 'leave' && !D.onPig && this.onCastle(D.pos.x, D.pos.z)) { D.cb = (D.cb || 0) + dt; if (D.cb > 0.6) { D.cb = 0; this.n.davidBounces++; this.castleBoing(0.5, 1.2); if (Math.random() < 0.3) { sfx.fart('squeakup', 0.6); this.n.fartBounces++; } } D.castleHop = 0.9 + Math.abs(Math.sin(this.t * 5.2)) * 2.0; } else D.castleHop = 0; }
  // ---------- v5.3 the BIG chicken coop: walk in to collect eggs (a golden one now and then) ----------
  updateCoop(dt, p) { for (const n of this.nests) { if (n.egg) { n.egg.rotation.z = Math.sin(this.t * 3 + n.x) * 0.06; continue; } n.t -= dt; if (n.t <= 0) { const gold = Math.random() < 0.15;
        n.egg = new THREE.Mesh(this.eggGeo, gold ? new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0x7a5a00, metalness: 0.6, roughness: 0.25 }) : new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.5 })); n.egg.position.set(n.x, n.y, n.z); n.egg.scale.setScalar(1.4); n.gold = gold; this.root.add(n.egg); } }
    if (!p || this.riding || this.driving) return; const ci = this.W.farmData.coopIn; if (!ci) return; const inside = Math.hypot(p.pos.x - ci[0], p.pos.z - ci[1]) < 3.6;
    if (inside && !this.inCoop) { this.inCoop = true; this.n.coopVisits++; this.coopPanic(); }
    else if (!inside && this.inCoop && Math.hypot(p.pos.x - ci[0], p.pos.z - ci[1]) > 4.6) this.inCoop = false;
    if (inside) for (const n of this.nests) if (n.egg && Math.hypot(p.pos.x - n.x, p.pos.z - n.z) < 3.4) this.collectEgg(n); }
  coopPanic() { this.n.coopPanics++; sfx.rooster && sfx.rooster(0.9); const ci = this.W.farmData.coopIn, c = V(ci[0], this.W.height(ci[0], ci[1]), ci[1]); let k = 0;
    for (const a of this.animals) if (a.kind === 'chicken' && a.pos.distanceTo(c) < 22 && !a.busy) { this.startle(a, c, 1.6); a.say(1); k++;
      for (let i = 0; i < this.fx.n(8); i++) this.fx.glow.spawn({ pos: V(a.pos.x, a.pos.y + 0.7, a.pos.z), vel: { x: (Math.random() - 0.5) * 5, y: 2 + Math.random() * 3, z: (Math.random() - 0.5) * 5 }, size: 0.14, size1: 0.1, life: 1.6, r: 1.5, g: 1.5, b: 1.45, alpha: 0.95, grav: 1.2, drag: 2, rv: 6 }); }
    for (let i = 0; i < 3; i++) this.g.later(i * 0.25, () => sfx.cluck && sfx.cluck(0.9)); this.toast('🐔 BAWK BAWK! The chickens flap out in a panic! Grab the eggs! 🥚', 0); }
  collectEgg(n) { const gold = n.gold; this.root.remove(n.egg); n.egg.material.dispose(); n.egg = null; n.t = 6 + Math.random() * 8; this.n.eggsCollected++; this.eggs2++; if (gold) { this.n.goldEggs++; this.goldEggs++; }
    const at = V(n.x, n.y + 0.3, n.z); this.emote(gold ? 'star' : 'sparkle', null, gold ? 3 : 1, at); sfx.coin && sfx.coin(); if (gold) { sfx.tada(0.9); sfx.sparkle(1); } else sfx.plop(0.5); this.bar();
    this.toast(gold ? `✨🥚 A GOLDEN EGG! ✨ (${this.eggs2} eggs)` : `🥚 Got an egg! (${this.eggs2})`, gold ? 0 : 0.6); }
  // ---------- v5.3 SUPER STINKY fart: wind-up → huge brown blast → animals faint → strangers walk up, "EEEEWWW!", run away ----------
  superStink() { const p = this.kid; if (!this.active || !p) return false;
    if (this.stinkCD > 0 || this.stink) { this.n.stinkBlocked++; sfx.deny && sfx.deny(); this.toast(`🤢 Stink tank refilling… ${Math.ceil(Math.max(this.stinkCD, 0.1))}s`, 0.8); return false; }
    this.stinkCD = 4; this.n.stinks++; this.stink = { t: 0, blown: false, spawned: false }; p.mech.stinkT = 1.0; sfx.grumble(1.3); sfx.grumble(1.0); this.fx.shake = Math.max(this.fx.shake, 0.15);
    this.toast('🤢 Uh oh… something is BREWING…', 0); return true; }
  stinkAt() { const p = this.kid, back = V(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)); return { back, at: V(p.pos.x + back.x * (this.riding ? 1.6 : this.driving ? 2.2 : 0.4), p.pos.y + (this.riding ? 2.2 : this.driving ? 1.6 : 0.8), p.pos.z + back.z * (this.riding ? 1.6 : this.driving ? 2.2 : 0.4)) }; }
  blast() { const p = this.kid, { back, at } = this.stinkAt(), fx = this.fx; this.stink.at = at.clone();
    sfx.fart('long', 1); this.g.later(0.12, () => sfx.fart('wet', 1)); this.g.later(0.45, () => sfx.fart('trombone', 0.9)); this.g.later(0.95, () => sfx.fart('bubbly', 0.9)); this.g.later(1.3, () => sfx.fart('squeakup', 0.7));
    fx.shake = Math.max(fx.shake, 0.9); p.mech.jumpT = 0.55;
    // the BIG BROWN cloud (brown instead of green), with stink lines
    for (let i = 0; i < fx.n(70); i++) { const g = Math.random(), a = Math.random() * TAU, sp = 2 + Math.random() * 6; fx.smoke.spawn({ pos: { x: at.x + (Math.random() - 0.5), y: at.y + (Math.random() - 0.5), z: at.z + (Math.random() - 0.5) },
      vel: { x: back.x * 4 + Math.cos(a) * sp, y: 0.4 + Math.random() * 2.2, z: back.z * 4 + Math.sin(a) * sp }, size: 1.4, size1: 7 + Math.random() * 3, life: 3.5 + Math.random() * 2, r: 0.42 + g * 0.12, g: 0.27 + g * 0.08, b: 0.1 + g * 0.05, alpha: 0.85, drag: 1.4, rv: (Math.random() - 0.5) * 2, fadeIn: 0.04 }); }
    for (let i = 0; i < fx.n(14); i++) fx.glow.spawn({ pos: { x: at.x, y: at.y, z: at.z }, vel: { x: (Math.random() - 0.5) * 4, y: 1 + Math.random() * 2, z: (Math.random() - 0.5) * 4 }, size: 0.2, size1: 0.3, life: 2, r: 0.7, g: 0.5, b: 0.2, alpha: 0.8, drag: 1, grav: -0.5 });
    fx.ring(at, 6, 0x7a4a1a); fx.ring(at, 10, 0x9a6a2a); this.emote('stink', null, 6, at.clone().setY(at.y + 1.2)); this.g.later(0.8, () => this.emote('stink', null, 5, at.clone().setY(at.y + 2)));
    // a couple of buzzing flies circle the cloud
    for (let i = 0; i < 2; i++) { const m = this.stinkFly(); m.visible = true; m.userData = { a: Math.random() * TAU, r: 1.6 + i * 0.9, h: 0.8 + i * 0.6, sp: 6 + i * 2 }; this.n.stinkFlies++; }
    this.toast('💩💨 SUPER STINKY!!! 🤢', 0); this.g.hud.shout && this.g.hud.shout('💩💨 SUPER STINKY! 🤢', 2.2);
    // nearby animals faint (comically) and pop back up
    for (const a of this.animals) if (a.state !== 'ridden' && a.state !== 'rodeo' && a.state !== 'title' && a.pos.distanceTo(p.pos) < 24 && a !== this.guest) { a.set('faint'); a.speed = 0; a.path = null; this.n.faints++; this.emote('bang', a); }
    // the farm's friendly visitors are on their way...
    this.g.later(0.6, () => this.spawnStrangers()); }
  stinkFly() { let m = this.stinkFlyM.find(f => !f.visible); if (!m) { m = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshBasicMaterial({ color: 0x111111 })); m.add(b);
      const wm = new THREE.MeshBasicMaterial({ color: 0xddeeff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.09, 6), wm); w.position.set(s * 0.09, 0.06, 0); w.rotation.x = -1.2; m.add(w); }
      this.root.add(m); this.stinkFlyM.push(m); } return m; }
  spawnStrangers() { const p = this.kid; if (!p || !this.active) return; const n = 2 + ((Math.random() * 3) | 0), kinds = [...STRANGERS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) { const def = kinds[i % kinds.length], m = strangerMesh(def), a = (i / n) * TAU + Math.random() * 0.8, d = 17 + Math.random() * 4; this.root.add(m.root);
      const s = { def, m, state: 'walk', t: 0, pos: V(p.pos.x + Math.cos(a) * d, 0, p.pos.z + Math.sin(a) * d), yaw: 0, ph: Math.random() * 6, stop: 6 + Math.random() * 2.5, sayT: 0.25 * i, pitch: def.pitch };
      s.pos.y = this.W.height(s.pos.x, s.pos.z); this.strangers.push(s); this.n.strangers++; } }
  updateStink(dt, p) { this.stinkCD = Math.max(0, this.stinkCD - dt); const el = $('b-stink'); if (el) { const c = this.stinkCD > 0; if (c !== this._stCool) { this._stCool = c; el.classList.toggle('cool', c); } const cd = $('stink-cd'); if (cd) { const t = c ? String(Math.ceil(this.stinkCD)) : ''; if (cd.textContent !== t) cd.textContent = t; } }
    const S = this.stink; if (S) { S.t += dt; if (!S.blown && S.t >= 0.95) { S.blown = true; if (p && this.active) this.blast(); } if (S.t > 6) { this.stink = null; for (const f of this.stinkFlyM) f.visible = false; } }
    if (S && S.at) for (const f of this.stinkFlyM) if (f.visible) { const u = f.userData; u.a += dt * u.sp; f.position.set(S.at.x + Math.cos(u.a) * u.r + Math.sin(this.t * 13 + u.r) * 0.2, S.at.y + u.h + Math.sin(this.t * 9 + u.a) * 0.3, S.at.z + Math.sin(u.a) * u.r); f.children[1].rotation.x = -1.2 + Math.sin(this.t * 60) * 0.6; f.children[2].rotation.x = -1.2 - Math.sin(this.t * 60) * 0.6; }
    for (let i = this.strangers.length - 1; i >= 0; i--) { const s = this.strangers[i], m = s.m; s.t += dt; s.ph += dt; let sp = 0, hold = 0, flail = 0;
      const kp = p ? p.pos : s.pos, dx = kp.x - s.pos.x, dz = kp.z - s.pos.z, dist = Math.hypot(dx, dz);
      if (s.state === 'walk') { sp = 6.5; s.yaw = Math.atan2(dx, dz); if (dist < s.stop || s.t > 7) { s.state = 'eww'; s.t = 0; } }
      else if (s.state === 'eww') { s.yaw = Math.atan2(dx, dz); hold = Math.min(1, s.t * 5); if (!s.said && s.t > s.sayT) { s.said = true; this.n.ewws++; this.n.nosesHeld++; m.bubble.visible = true; sfx.eww && sfx.eww(s.pitch, clamp(1.3 - this.camDist(s.pos) / 50, 0.2, 1)); voice.say('EEEEWWW!', { prio: 2, cd: 0, pitch: s.pitch, rate: 1.1 }); }
        if (s.t > s.sayT + 1.1) { s.state = 'run'; s.t = 0; s.yaw = Math.atan2(-dx, -dz) + (Math.random() - 0.5) * 0.6; this.n.runAways++; sfx.whoosh && sfx.whoosh(0.4); } }
      else if (s.state === 'run') { sp = 13; hold = 0.6; flail = 1; s.yaw += Math.sin(s.t * 7) * dt * 1.5; if (s.t > 0.9) m.bubble.visible = false; if (Math.random() < dt * 8) this.fx.dust(s.pos, 2, 0.5, 2); if (s.t > 3.6) { this.root.remove(m.root); disposeStranger(m); this.strangers.splice(i, 1); continue; } }
      s.pos.x += Math.sin(s.yaw) * sp * dt; s.pos.z += Math.cos(s.yaw) * sp * dt; this.W.collide(s.pos, 0.4, false); s.pos.y = this.W.height(s.pos.x, s.pos.z);
      animStranger(m, s, sp, hold, flail, dt); } }
  // ---------- v5.3 the tractor ----------
  parkTractor() { const T = this.tractor, t = FARM.tractor; T.pos.set(t.x, this.W.height(t.x, t.z), t.z); T.yaw = 0.7; T.speed = 0; this.placeTractor(0); }
  tractorNear(p) { const T = this.tractor; return T && !this.driving && Math.hypot(T.pos.x - p.pos.x, T.pos.z - p.pos.z) < 4.8; }
  driveTractor(p = this.kid) { if (!p || this.riding) return false; const T = this.tractor; if (Math.hypot(T.pos.x - p.pos.x, T.pos.z - p.pos.z) > 4.8) { this.toast('🚜 Walk up to the tractor, then tap DRIVE!'); return false; }
    this.driving = true; this.n.drives++; this.kidSpeed = this.kidSpeed || p.st.speed; p.st.speed = 6.2; p.radius = 2.0; p.pos.set(T.pos.x, p.pos.y, T.pos.z); p.yaw = T.yaw; p.speedNow = 0; p.groundY(); p.mech.setRide(true); p.mech.R.obj.position.set(0, 2.05, -0.95);
    sfx.putt(1, 0); this.g.later(0.15, () => sfx.putt(1, 0.3)); this.honk(0.7); this.toast('🚜 VROOM! Leandro is driving the tractor! Tap HONK! Hold FAST to go faster.'); voice.say('Vroom vroom!', { prio: 2, cd: 2000 }); this.fx.dust(p.pos, 8, 1.5, 4); this._rl = null; return true; }
  hopOffTractor(quiet = false) { const p = this.kid, T = this.tractor; this.driving = false; if (!p) return; p.st.speed = this.kidSpeed || 6.5; p.radius = 0.7; p.mech.setRide(false); p.mech.R.obj.position.set(0, 0, 0);
    T.pos.set(p.pos.x, this.W.height(p.pos.x, p.pos.z), p.pos.z); T.yaw = p.yaw; T.speed = 0; const side = V(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    for (const s of [1, -1]) { const x = T.pos.x + side.x * s * 3.0, z = T.pos.z + side.z * s * 3.0; if (this.W.height(x, z) > -1.2) { p.pos.set(x, 0, z); break; } } p.groundY(); p.speedNow = 0; this._rl = null; this.n.hopOffs++;
    if (!quiet) { this.toast('🚜 Leandro hopped off the tractor.'); this.fx.dust(p.pos, 6, 1.2, 4); } }
  honk(v = 1) { const T = this.tractor; this.n.honks++; sfx.mooHorn(v); this.emote('bang', null, 1, V(T.pos.x, T.pos.y + 4.6, T.pos.z)); if (v >= 1) { this.toast(pick(['📯 MOOOO-HONK! 😂', '📯 HONK HONK! Coming through!', '📯 Beep beep! MOOO!']), 1.5);
      for (const a of this.animals) if (a.state !== 'ridden' && !a.busy && a.pos.distanceTo(T.pos) < 14) { if (a.kind === 'cow') { a.say(1); this.emote('heart', a); } else this.startle(a, T.pos, 1); } } }
  placeTractor(dt) { const T = this.tractor, g = T.g, sp = Math.abs(T.speed); T.ph += dt * (6 + sp * 2.2); const bump = Math.sin(T.ph) * 0.05 * (0.4 + Math.min(1, sp / 6)) + Math.max(0, Math.sin(T.ph * 0.37)) * 0.06 * Math.min(1, sp / 4);
    g.position.set(T.pos.x, T.pos.y + bump, T.pos.z); g.rotation.set(Math.sin(T.ph * 0.5) * 0.025 * Math.min(1, sp / 3) - (T.acc || 0) * 0.02, T.yaw, Math.sin(T.ph * 0.7) * 0.03 * Math.min(1, sp / 3) + 0.006 * Math.sin(T.ph * 3)); T.bounce = bump; }
  updateTractor(dt, p) { const T = this.tractor; if (!T) return;
    if (this.driving && p) { const prev = T.speed; T.pos.set(p.pos.x, this.W.height(p.pos.x, p.pos.z), p.pos.z); T.yaw = p.yaw; T.speed = p.speedNow; T.acc = (T.speed - prev) / Math.max(dt, 1e-3) * 0.1;
      if (p.mech.R) p.mech.R.obj.position.y = 2.05 + T.bounce; }
    else T.speed *= Math.max(0, 1 - dt * 4);
    this.placeTractor(dt);
    // engine: putt-putt rate rises with speed, a puff of exhaust every putt
    const near = clamp(1.2 - this.camDist(T.pos) / 60, 0, 1); T.puttT -= dt;
    if (this.driving && T.puttT <= 0) { const sp = Math.abs(T.speed); T.puttT = 1 / (3.5 + sp * 0.9); sfx.putt(0.7 * near + 0.1, Math.min(1, sp / 10)); this.n.putts++;
      const ex = V(0.45, 3.45, 1.8).applyAxisAngle(V(0, 1, 0), T.yaw).add(T.g.position); this.fx.smoke.spawn({ pos: ex, vel: { x: (Math.random() - 0.5) * 0.6 - Math.sin(T.yaw) * sp * 0.3, y: 2.2 + Math.random(), z: (Math.random() - 0.5) * 0.6 - Math.cos(T.yaw) * sp * 0.3 }, size: 0.35, size1: 1.6, life: 1.3, r: 0.22, g: 0.22, b: 0.24, alpha: 0.6, drag: 1, rv: 1.5 }); this.n.exhaust++;
      if (sp > 3 && Math.random() < 0.5) this.fx.dust(V(T.pos.x - Math.sin(T.yaw) * 1.6, T.pos.y, T.pos.z - Math.cos(T.yaw) * 1.6), 1, 1, 3); } }
  syncHorse(p, dt) { const H = this.horse; H.pos.set(p.pos.x, p.pos.y, p.pos.z); H.yaw = p.yaw; H.speed = p.speedNow; }
  step(d, foot) { // called from Game.footstep for Leandro (and the horse he rides)
    const near = clamp(1 - this.camDist(d.pos) / 60, 0, 1); if (near <= 0) return;
    if (this.driving) return; // the engine does the noise
    if (this.riding) { sfx.clop(0.5 * near, foot ? 1.1 : 0.95); if (d.speedNow > 10) this.fx.dust(d.pos, 1, 1.2, 3); }
    else if (this.inMud(d.pos.x, d.pos.z)) sfx.squelch(0.6); else sfx.step(0.12 * near);
  }
  // ---------- Ricky & Bobby: a piggy escapes, the dogs herd it home ----------
  startRunaway() {
    const pigs = this.animals.filter(a => a.kind === 'pig' && a.state !== 'rodeo'); if (!pigs.length) return null; const pig = pigs.find(a => a.state === 'loose') || pick(pigs);
    const G = gateOf(pig.pen), kp = this.kidPos || V(FARM.yard.x, 0, FARM.yard.z);
    // escape toward the player so the chase happens on screen
    const ex = lerp(G.x + G.ox * 10, kp.x, 0.55) + (Math.random() - 0.5) * 8, ez = lerp(G.z + G.oz * 10, kp.z, 0.55) + (Math.random() - 0.5) * 8;
    pig.path = pig.inside() ? [V(G.x - G.ox * 3, 0, G.z - G.oz * 3), V(G.x + G.ox * 4, 0, G.z + G.oz * 4), V(ex, 0, ez)] : [V(ex, 0, ez)]; pig.pathK = 3.2; pig.free = null; pig.set('runaway'); pig.say(1.2); this.emote('bang', pig, 2);
    this.runaway = pig; return pig; // v5.3: no extra toast here; Ricky & Bobby's single POOOOPY! shout is the only intro line
  }
  herd(pig) { const G = gateOf(pig.pen); pig.path = [V(G.x + G.ox * 4, 0, G.z + G.oz * 4), V(G.x - G.ox * 4, 0, G.z - G.oz * 4), V(pig.pen.x, 0, pig.pen.z)]; pig.set('herded'); }
  herdDone(pig) { this.n.herds++; this.runaway = null; pig.free = null; pig.set('happy'); this.toast('🐷 Back in the pen! Good dogs! 🐶🐶'); voice.say('Good dogs!', { prio: 2, cd: 3000, pitch: 1.1 }); sfx.tada(0.7); }
  dogDist(p) { const W = this.g.westies; if (!W || !W.active) return 99; let d = 99; for (const dg of W.dogs) if (!dg.off) d = Math.min(d, Math.hypot(dg.pos.x - p.x, dg.pos.z - p.z)); return d; }
  nearestPoopOrMud(p) { let best = null, bd = 60; for (const q of this.poops) { if (q.gold) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = { x: q.x, z: q.z, poop: true }; } }
    for (const m of this.W.farmData.mud) { const d = Math.hypot(m.x - p.x, m.z - p.z) - 4; if (d < bd) { bd = d; best = { x: m.x, z: m.z, poop: false }; } } return best; }
  // ---------- hay bales (Bad David's mega toot knocks them over) ----------
  nearestBale(p, R = 30) { let best = null, bd = R; for (const b of this.W.farmData.bales) { if (b.fallen) continue; const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < bd) { bd = d; best = b; } } return best; }
  knockBale(b, from, v = 7) { const dir = V(b.x - from.x, 0, b.z - from.z).normalize(); b.fallen = true; b.roll = { dir, v, t: 0, spin: 0 }; }
  updateBales(dt) { for (const b of this.W.farmData.bales) { const r = b.roll; if (!r) continue; r.t += dt; r.v = Math.max(0, r.v - dt * 3.2); b.x += r.dir.x * r.v * dt; b.z += r.dir.z * r.v * dt;
      const tmp = V(b.x, 0, b.z); this.W.collide(tmp, 0.9, false); b.x = tmp.x; b.z = tmp.z; b.col.x = b.x; b.col.z = b.z; r.spin += r.v * dt / 0.85;
      b.m.position.set(b.x, this.W.height(b.x, b.z) + 0.85 + (r.t < 0.4 ? Math.sin(r.t / 0.4 * Math.PI) * 1.2 : 0), b.z); b.m.rotation.order = 'YXZ'; b.m.rotation.set(r.spin, Math.atan2(r.dir.x, r.dir.z), 0);
      if (r.v <= 0) b.roll = null; } }
  // radar dots: hungry animals (yellow), fed ones (green), the horse (brown), golden poop (gold)
  radar() { const out = []; for (const a of this.animals) out.push({ x: a.pos.x, z: a.pos.z, c: a === this.horse ? '#c08040' : this.fed.has(a) ? '#5fe06a' : '#ffd23a' }); for (const q of this.poops) if (q.gold) out.push({ x: q.x, z: q.z, c: '#fff27a' }); return out; }
  stats() { return { ...this.n, fedNow: this.fed.size, goal: this.goal, round: this.round, riding: this.riding, poopsOnGround: this.poops.length, goldOnGround: this.poops.filter(q => q.gold).length, david: this.david.log.slice() }; }
}

// ---------------- Leandro on foot (the farm "dino": a walking kid built from the rider model) ----------------
export const KID = { id: 'kid', name: 'Leandro', kind: 'kid', farmKid: true, real: true, hp: 100, speed: 6.5, bite: 0, biteRate: 0.3, special: 'none', specialName: '', specialCD: 1, roar: 1, scale: 1, radius: 0.7, color: 0x3b7bd8, accent: 0xffd23a };
export class KidMech {
  constructor(def) {
    this.def = def; this.real = true; this.quad = false; this.flyer = false; this.kid = true; this.phase = 0; this.flash = 0; this.ko = 0; this.height = 1.9; this.b = {}; this.sockets = {}; this.t = 0;
    const R = this.R = new Rider(); R.seatGroup.visible = false; R.hips.position.y = 0.7; R.spread = 0.85; R.shinOut = 0.35; this.obj = new THREE.Group(); this.obj.name = 'kid'; this.obj.add(R.obj);
    const straw = new THREE.MeshStandardMaterial({ color: 0xe8c65a, roughness: 0.9 }), band = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7 });
    const hat = this.hat = new THREE.Group(); hat.position.set(0, 0.4, -0.01); hat.rotation.x = -0.14; R.head.add(hat);
    const add = (g, geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; g.add(o); return o; };
    add(hat, CYL(0.37, 0.39, 0.025, 22), straw, 0); add(hat, CYL(0.2, 0.23, 0.18, 18), straw, 0.1); add(hat, CYL(0.236, 0.236, 0.05, 18), band, 0.04);
    // mud splotches (shown as Leandro gets muddier)
    const mm = new THREE.MeshStandardMaterial({ color: 0x5a3818, roughness: 0.4 }); this.splotch = [];
    const spots = [[R.legs[0].knee, 0.04, -0.12, 0.05], [R.legs[1].knee, -0.04, -0.2, 0.05], [R.legs[0].foot, 0, 0.02, 0.12], [R.legs[1].foot, 0, 0.02, 0.12], [R.hips, 0.12, 0.02, 0.14], [R.torso, -0.1, 0.12, 0.13], [R.legs[1].knee, 0.05, -0.05, 0.05], [R.torso, 0.12, 0.3, 0.13], [R.head, 0.12, 0.13, 0.17]];
    for (const [g, x, y, z] of spots) { const o = new THREE.Mesh(SPH(0.06, 7, 5), mm); o.position.set(x, y, z); o.scale.set(1, 0.8, 0.5); o.visible = false; g.add(o); this.splotch.push(o); }
    this.meshes = []; this.obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.mats = { plate: new THREE.MeshStandardMaterial(), glowColor: new THREE.Color(0xffd23a) }; this.riding = false; this.mud = 0; this.throwT = 0; this.tootT = 0; this.squishT = 0; this.noseT = 0; this.slipT = 0; this.danceT = 0; this.jumpT = 0; this.flipT = 0;
  }
  socketPos(name, out) { return (name === 'hand' ? this.R.arms[1].hand : this.R.head).getWorldPosition(out); }
  footPos(i, out) { return this.R.legs[i % 2].foot.getWorldPosition(out); }
  dispose() {}
  setRide(on) { this.riding = on; this.height = on ? 3.3 : 1.9; this.R.hips.position.y = on ? 0.13 : 0.7; this.R.obj.position.y = on ? 2.1 : 0; this.R.root.position.y = 0; this.R.torso.rotation.set(0, 0, 0); }
  animate(dt, speed, o = {}) {
    const R = this.R, t = (this.t += dt); R.t += dt; this.throwT -= dt; this.tootT -= dt; this.squishT -= dt; this.noseT -= dt; this.slipT -= dt; this.danceT -= dt; this.jumpT -= dt; if (R.cheerT > 0) R.cheerT -= dt; R.obj.rotation.set(0, 0, 0);
    const nm = Math.round(clamp(this.mud, 0, 1) * this.splotch.length); this.splotch.forEach((s, i) => { s.visible = i < nm; });
    if (this.riding) { const k = clamp(speed / 12, 0, 1.6); this.phase += dt * (2 + speed * 0.55); R.root.position.y = Math.abs(Math.sin(this.phase)) * 0.09 * Math.min(1, k) + 0.02;
      R.setPose(dt, { k: Math.min(1, k), hold: o.boost ? 0.7 : 0.2 }); if (this.throwT > 0) this.throwArm(); if (this.tootT > 0) { R.torso.rotation.x = 0.35; R.root.position.y += Math.max(0, Math.sin((0.8 - this.tootT) / 0.8 * Math.PI)) * 0.15; } return; }
    R.root.position.y = 0;
    const k = clamp(speed / 3, 0, 1), run = clamp((speed - 5) / 5, 0, 1); this.phase += dt * (speed > 0.3 ? 2.6 + speed * 1.05 : 0); const s = Math.sin(this.phase);
    R.legs.forEach((g, i) => { const ss = i ? -s : s; g.hip.rotation.set(-ss * (0.65 + 0.3 * run) * k, 0, g.s * 0.05); g.knee.rotation.set(0.05 + Math.max(0, ss) * (0.8 + 0.6 * run) * k, 0, 0); g.foot.rotation.set(0, 0, 0); });
    R.arms.forEach((a, i) => { const ss = i ? s : -s; a.sh.rotation.set(-ss * (0.6 + 0.5 * run) * k - 0.05, 0, a.s * (0.1 + 0.04 * Math.sin(t * 1.7))); a.el.rotation.set(-0.25 - 0.7 * run * k, 0, 0); });
    R.hips.position.y = 0.7 + Math.abs(Math.cos(this.phase)) * 0.05 * k + (k < 0.05 ? Math.sin(t * 2) * 0.006 : 0); R.torso.rotation.set(0.05 * k + 0.15 * run, 0, 0); R.head.rotation.set(-0.08 * run, k < 0.05 ? Math.sin(t * 0.6) * 0.3 : 0, 0); R.root.position.y = 0;
    if (this.tootT > 0) { const u = 1 - this.tootT / 0.8; R.torso.rotation.x = 0.55 * Math.sin(Math.min(1, u * 2) * Math.PI * 0.5); R.hips.position.y -= 0.06; for (const a of R.arms) { a.sh.rotation.set(-0.7, 0, a.s * 0.2); a.el.rotation.set(-0.3, 0, 0); } R.head.rotation.x = -0.3; }
    if (this.squishT > 0) { R.head.rotation.x = 0.5; for (const a of R.arms) { a.sh.rotation.set(-0.3, 0, a.s * (1.2 + Math.sin(t * 25) * 0.3)); a.el.rotation.set(-0.4, 0, 0); } }
    if (R.cheerT > 0) for (const a of R.arms) { const pump = Math.abs(Math.sin(R.cheerT * 9)); a.sh.rotation.set(-2.7 - 0.2 * pump, 0, a.s * 0.3); a.el.rotation.set(-0.3, 0, 0); }
    if (this.throwT > 0) this.throwArm();
    // v5.2 silly animations
    if (this.jumpT > 0) { const u = 1 - this.jumpT / 0.55; R.root.position.y = Math.sin(u * Math.PI) * 0.75; for (const g of R.legs) { g.hip.rotation.x = -0.6; g.knee.rotation.x = 1.1; } }
    if (this.noseT > 0 && this.throwT <= 0) { const A = R.arms; A[0].sh.rotation.set(-2.5, 0, -0.55); A[0].el.rotation.set(-1.6, 0, 0); A[1].sh.rotation.set(-1.4 + Math.sin(t * 22) * 0.5, 0, 0.6 + Math.sin(t * 22) * 0.4); A[1].el.rotation.set(-0.4, 0, 0); R.head.rotation.set(-0.15, Math.sin(t * 9) * 0.3, 0); } // holds his nose + fans the air
    if (this.danceT > 0) { const b = Math.sin(t * 10); R.root.position.y = Math.abs(b) * 0.25; R.torso.rotation.set(0, 0, b * 0.25); for (const [i, a] of R.arms.entries()) { a.sh.rotation.set(-2.6 + Math.sin(t * 10 + i * Math.PI) * 0.6, 0, a.s * 0.4); a.el.rotation.set(-0.4, 0, 0); } R.head.rotation.set(0, 0, -b * 0.2); R.obj.rotation.y = Math.sin(t * 2.5) * 0.6; } // victory dance
    if (this.flipT > 0) { this.flipT -= dt; const u = 1 - Math.max(0, this.flipT) / 0.75; R.obj.rotation.x = -u * TAU; for (const g of R.legs) { g.hip.rotation.x = -1.2; g.knee.rotation.x = 1.6; } for (const a of R.arms) a.sh.rotation.set(-2.6, 0, a.s * 0.5); } // bouncy-castle flip
    if (this.slipT > 0) { const u = 1 - this.slipT / 1.4, k = Math.min(1, u * 5) * (u > 0.8 ? (1 - u) * 5 : 1); R.obj.rotation.x = -1.35 * k; R.root.position.y = 0.25 * k + (u < 0.2 ? Math.sin(u / 0.2 * Math.PI) * 0.5 : 0); for (const g of R.legs) { g.hip.rotation.x = -1.4 * k; g.knee.rotation.x = 0.2; } for (const a of R.arms) a.sh.rotation.set(-2.8 * k, 0, a.s * 1.0 * k); } // whoops! pratfall
    if (this.flipT > 0) { const th = R.obj.rotation.x, h = 0.8; R.obj.position.set(0, h - h * Math.cos(th), -h * Math.sin(th)); } else if (!this.riding) R.obj.position.set(0, 0, 0);
    if (this.stinkT > 0) { this.stinkT -= dt; const w = Math.min(1, this.stinkT * 3); R.obj.rotation.z = Math.sin(t * 45) * 0.09 * w; R.root.position.y -= 0.12 * w; for (const g of R.legs) { g.hip.rotation.x = -0.5 * w; g.knee.rotation.x = 0.9 * w; } for (const a of R.arms) a.sh.rotation.set(-0.4 * w, 0, a.s * 0.6 * w); } // SUPER STINKY wind-up wobble
    R.root.position.y += this.castleH || 0; // v5.3 bouncy castle height
    if (this.squashT > 0 || this._sq) { this.squashT = Math.max(0, (this.squashT || 0) - dt); const k = Math.sin((this.squashT / 0.18) * Math.PI); R.root.scale.set(1 + k * 0.16, 1 - k * 0.24, 1 + k * 0.16); this._sq = this.squashT > 0; } // v5.6.1 springy squash on each castle landing
  }
  throwArm() { const a = this.R.arms[1], u = 1 - this.throwT / 0.45; a.sh.rotation.set(lerp(-2.9, -0.9, smooth(0, 1, u)), 0, 0.15); a.el.rotation.set(-0.5 * (1 - u), 0, 0); }
}

// ---------------- v5.3 friendly farm visitors (generic cartoon strangers, nobody real) who smell the SUPER STINKY ----------------
const STRANGERS = [
  { id: 'farmer', name: 'farmer', skin: 0xd8a27a, top: 0xc0392b, legs: 0x2a5aa8, hat: 'straw', h: 1.0, pitch: 0.8 },
  { id: 'hatlady', name: 'lady with a big hat', skin: 0xf0c8a0, top: 0x8a4ad0, legs: 0x8a4ad0, hat: 'big', dress: true, h: 0.98, pitch: 1.35 },
  { id: 'kid', name: 'kid', skin: 0x8a5a3a, top: 0xffd23a, legs: 0x3a6a3a, hat: 'cap', h: 0.68, pitch: 1.7 },
  { id: 'mail', name: 'mail carrier', skin: 0xc08a60, top: 0x3a5a8a, legs: 0x3a5a8a, hat: 'mail', bag: true, h: 1.02, pitch: 1.0 },
  { id: 'gardener', name: 'gardener', skin: 0xe8b890, top: 0x4aa84a, legs: 0x6a4a2a, hat: 'sun', h: 0.95, pitch: 1.2 },
];
let ewwTex = null;
function ewwBubble() { if (!ewwTex) { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.strokeStyle = '#222'; g.lineWidth = 7;
    g.beginPath(); g.roundRect(8, 8, 240, 88, 30); g.fill(); g.stroke(); g.beginPath(); g.moveTo(110, 94); g.lineTo(128, 122); g.lineTo(146, 94); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(112, 88, 32, 9);
    g.fillStyle = '#5a8a10'; let fs = 46; do { g.font = `900 ${fs}px system-ui, sans-serif`; fs -= 2; } while (fs > 18 && g.measureText('EEEEWWW!').width > 214); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EEEEWWW!', 128, 54); ewwTex = new THREE.CanvasTexture(c); ewwTex.colorSpace = THREE.SRGBColorSpace; }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ewwTex, depthTest: false, transparent: true })); s.scale.set(2.6, 1.3, 1); s.renderOrder = 10; s.visible = false; return s; }
function strangerMesh(d) { const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(d.h * 1.9); const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }), sk = M(d.skin), top = M(d.top), lg = M(d.legs);
  const add = (geo, mat, par, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m; };
  const legs = []; for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.09, 0.5, 0); body.add(g); add(new THREE.CapsuleGeometry(0.065, 0.36, 3, 8), lg, g, 0, -0.24, 0); add(new THREE.BoxGeometry(0.12, 0.07, 0.2), M(0x3a2a1a), g, 0, -0.47, 0.04); legs.push(g); }
  if (d.dress) add(new THREE.ConeGeometry(0.3, 0.55, 12), top, body, 0, 0.62, 0); add(new THREE.CapsuleGeometry(0.17, 0.3, 4, 10), top, body, 0, 0.82, 0);
  if (d.id === 'farmer') { add(new THREE.BoxGeometry(0.3, 0.3, 0.05), lg, body, 0, 0.78, 0.15); }
  if (d.bag) { const b = add(new THREE.BoxGeometry(0.1, 0.22, 0.28), M(0x7a4a22), body, -0.24, 0.72, 0); b.rotation.z = 0.15; }
  const head = new THREE.Group(); head.position.y = 1.18; body.add(head); add(new THREE.SphereGeometry(0.17, 14, 10), sk, head, 0, 0, 0); add(new THREE.SphereGeometry(0.035, 8, 6), sk, head, 0, -0.01, 0.17);
  for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.03, 8, 6), M(0xffffff), head, s * 0.06, 0.04, 0.145); add(new THREE.SphereGeometry(0.016, 6, 5), M(0x111111), head, s * 0.06, 0.04, 0.17); }
  const mouth = add(new THREE.TorusGeometry(0.035, 0.012, 6, 10), M(0x5a1a1a), head, 0, -0.08, 0.15);
  if (d.hat === 'straw') { add(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 16), M(0xe8c868), head, 0, 0.12, 0); add(new THREE.CylinderGeometry(0.13, 0.15, 0.13, 12), M(0xe8c868), head, 0, 0.19, 0); }
  else if (d.hat === 'big') { add(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 18), M(0xff7ac8), head, 0, 0.13, 0); add(new THREE.SphereGeometry(0.15, 12, 8, 0, TAU, 0, Math.PI / 2), M(0xff7ac8), head, 0, 0.13, 0); add(new THREE.SphereGeometry(0.06, 8, 6), M(0xffe04a), head, 0.14, 0.2, 0.06); }
  else if (d.hat === 'cap' || d.hat === 'mail') { add(new THREE.SphereGeometry(0.175, 12, 8, 0, TAU, 0, Math.PI / 2), M(d.hat === 'mail' ? 0x2a3a6a : 0xe03030), head, 0, 0.04, 0); add(new THREE.BoxGeometry(0.2, 0.02, 0.14), M(d.hat === 'mail' ? 0x1a2a4a : 0xe03030), head, 0, 0.06, 0.2); }
  else if (d.hat === 'sun') { add(new THREE.CylinderGeometry(0.32, 0.34, 0.02, 16), M(0x9ad06a), head, 0, 0.12, 0); add(new THREE.CylinderGeometry(0.12, 0.16, 0.1, 12), M(0x9ad06a), head, 0, 0.17, 0); }
  else add(new THREE.SphereGeometry(0.175, 12, 8, 0, TAU, 0, Math.PI / 2.2), M(0x3a2a1a), head, 0, 0.02, -0.01);
  const arms = []; for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.22, 1.0, 0); body.add(g); add(new THREE.CapsuleGeometry(0.05, 0.3, 3, 8), top, g, 0, -0.17, 0); add(new THREE.SphereGeometry(0.055, 8, 6), sk, g, 0, -0.36, 0); arms.push({ g, s }); }
  const bubble = ewwBubble(); bubble.position.y = d.h * 1.9 * 1.35 + 0.9; root.add(bubble);
  return { root, body, legs, arms, head, mouth, bubble }; }
function animStranger(m, s, sp, hold, flail, dt) { const ph = s.ph * (sp > 8 ? 16 : 8), k = Math.min(1, sp / 4);
  m.root.position.set(s.pos.x, s.pos.y + (flail ? Math.abs(Math.sin(ph)) * 0.35 : 0), s.pos.z); m.root.rotation.y = s.yaw;
  m.legs[0].rotation.x = Math.sin(ph) * 0.7 * k; m.legs[1].rotation.x = -Math.sin(ph) * 0.7 * k; m.body.rotation.x = flail ? 0.25 : 0; m.body.rotation.z = s.state === 'eww' ? Math.sin(s.t * 30) * 0.05 : 0;
  // one hand pinches the nose; the other fans the air (or both flail when running)
  const [a0, a1] = m.arms; a1.g.rotation.set(-2.5 * hold, 0, 0.55 * hold * a1.s); a1.g.rotation.x += 0; // nose hand
  a0.g.rotation.set(flail ? -2.6 + Math.sin(ph * 1.3) * 0.8 : -1.4 * hold + Math.sin(s.ph * 18) * 0.5 * hold - Math.sin(ph) * 0.5 * k * (1 - hold), 0, flail ? 0.4 * a0.s : 0);
  m.head.rotation.x = s.state === 'eww' ? -0.2 : 0; m.mouth.scale.setScalar(s.state === 'walk' ? 1 : 2); }
function disposeStranger(m) { m.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } if (o.isSprite) o.material.dispose(); }); }

// ---------------- BAD DAVID: an original cheeky little troublemaker (gentle mischief only) ----------------
const ACTIONS = ['undies', 'mud', 'pigride', 'chickens', 'pie', 'megafart', 'footprints', 'tickle', 'pogo', 'ropeswing'];
const LINES = { undies: 'DAVID, NOOO! Put your clothes back on!', mud: 'DAVID, NOOO! Not in the mud!', pigride: "DAVID, NOOO! You're riding backwards!", chickens: 'DAVID! The chickens are OUT!',
  pie: 'DAVID, NOOO! No pie fights!', megafart: 'DAVID!!! Say excuse me!', footprints: 'DAVID, NOOO! Muddy feet everywhere!', tickle: 'DAVID! Stop tickling the {a}!', pogo: 'DAVID, NOOO! No fart-powered pogo sticks!', ropeswing: 'DAVID, NOOO! Not the rope swing!' };
const TOASTS = { undies: '😜 Bad David ran around in his undies! 🩲', mud: '😜 Bad David jumped in the mud! SPLOOSH!', pigride: '😜 Bad David is riding a piggy BACKWARDS! 🐷', chickens: '😜 Bad David let the chickens out! 🐔🐔🐔',
  pie: '😜 Bad David threw a cream pie! 🥧', megafart: '😜 Bad David did a MEGA TOOT! 💨💨💨', footprints: '😜 Bad David is tracking mud everywhere! 👣', tickle: '😜 Bad David is tickling the {a} with a feather! 🪶', pogo: '😜 Bad David is on a FART-POWERED POGO STICK! 💨🦘', ropeswing: '😜 Bad David grabbed a rope swing! AAAH-AH-AAAH! 🌳' };
function davidModel() {
  const M = mats(), g = new THREE.Group(); g.name = 'bad-david'; const body = new THREE.Group(); g.add(body);
  const SK = 0xf5cfa6, HR = 0x5a3015, Y = 0xffd23a, GR = 0x3aa655, SH = 0xd63a2a, mesh = (list, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(mergeGeometries(list), M.vc); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const hips = new THREE.Group(); hips.position.y = 0.6; body.add(hips);
  const shorts = mesh([C(BOX(0.35, 0.17, 0.24), SH, 0, 0.0, 0), C(CYL(0.075, 0.08, 0.12, 8), SH, 0.09, -0.1, 0), C(CYL(0.075, 0.08, 0.12, 8), SH, -0.09, -0.1, 0)], hips);
  const briefs = mesh([C(BOX(0.35, 0.15, 0.25), 0xffffff, 0, 0.0, 0), C(BOX(0.36, 0.035, 0.26), 0x3a7bd8, 0, 0.07, 0), C(SPH(0.03, 6, 4), 0xe0302a, 0.08, 0.0, 0.13), C(SPH(0.03, 6, 4), 0xe0302a, -0.05, -0.03, 0.13)], hips); briefs.visible = false;
  const legs = []; for (const s of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(s * 0.09, 0, 0); hips.add(hip); mesh([C(new THREE.CapsuleGeometry(0.062, 0.14, 3, 8), SK, 0, -0.13, 0)], hip);
    const knee = new THREE.Group(); knee.position.y = -0.27; hip.add(knee); const sock = s < 0 ? [C(CYL(0.056, 0.058, 0.14, 8), 0xffffff, 0, -0.19, 0), C(BOX(0.12, 0.02, 0.12), 0xe0302a, 0, -0.13, 0)] : [C(new THREE.TorusGeometry(0.055, 0.025, 6, 10), 0xdddddd, 0, -0.24, 0, 1, 1, 1, Math.PI / 2, 0, 0)];
    mesh([C(new THREE.CapsuleGeometry(0.05, 0.14, 3, 8), SK, 0, -0.1, 0), ...sock], knee); const foot = new THREE.Group(); foot.position.y = -0.28; knee.add(foot);
    mesh([C(BOX(0.12, 0.08, 0.21), 0x2e6bd8, 0, -0.02, 0.04), C(BOX(0.125, 0.03, 0.22), 0xffffff, 0, -0.06, 0.04), C(BOX(0.1, 0.012, 0.03), 0xffffff, 0, 0.022, 0.07)], foot); legs.push({ hip, knee, foot, s }); }
  const torso = new THREE.Group(); torso.position.y = 0.08; hips.add(torso); const st = []; for (let i = 0; i < 6; i++) st.push(C(BOX(0.34, 0.06, 0.22), i % 2 ? GR : Y, 0, 0.03 + i * 0.058, 0));
  st.push(C(BOX(0.16, 0.03, 0.225), 0xffffff, 0, 0.33, 0.0)); const shirt = mesh(st, torso);
  const bare = mesh([C(BOX(0.32, 0.34, 0.2), SK, 0, 0.18, 0), C(SPH(0.015, 5, 4), 0xb07a5a, 0, 0.1, 0.1)], torso); bare.visible = false;
  const head = new THREE.Group(); head.position.y = 0.4; torso.add(head); const H = [C(CYL(0.065, 0.075, 0.08, 8), SK, 0, -0.01, 0), C(SPH(0.25, 18, 14), SK, 0, 0.22, 0, 1.05, 0.95, 0.95)];
  for (const s of [-1, 1]) { H.push(C(SPH(1, 8, 6), 0xf0b890, s * 0.265, 0.22, 0, 0.05, 0.08, 0.06), C(SPH(0.055, 10, 8), 0xffffff, s * 0.09, 0.26, 0.2, 1, 1.25, 0.6), C(SPH(0.029, 8, 6), 0x111111, s * 0.09 + 0.025, 0.25, 0.235), C(BOX(0.08, 0.018, 0.02), HR, s * 0.095, 0.345, 0.21, 1, 1, 1, 0, 0, s * 0.35));
    for (let i = 0; i < 3; i++) H.push(C(SPH(0.011, 4, 3), 0xc9824a, s * (0.12 + i * 0.025), 0.17 + (i % 2) * 0.02, 0.2)); }
  H.push(C(SPH(0.035, 8, 6), 0xf0b890, 0, 0.2, 0.245), C(new THREE.CircleGeometry(0.13, 20, Math.PI, Math.PI), 0x6a1010, 0, 0.13, 0.225, 1, 1, 1, -0.25, 0, 0), C(new THREE.PlaneGeometry(0.19, 0.04), 0xffffff, 0, 0.115, 0.232, 1, 1, 1, -0.25, 0, 0),
    C(new THREE.PlaneGeometry(0.03, 0.042), 0x3a0808, 0.02, 0.114, 0.236, 1, 1, 1, -0.25, 0, 0), C(SPH(1, 8, 6), 0xf06a7a, 0, 0.055, 0.205, 0.05, 0.025, 0.03), C(SPH(0.24, 14, 8, 0, TAU, 0, 1.2), HR, 0, 0.26, -0.03));
  const rr = rng(13); for (let i = 0; i < 15; i++) { const th = rr() * TAU, ph = 0.15 + rr() * 1.15, d = V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th) - 0.25).normalize(); if (d.z > 0.55 && d.y < 0.6) continue;
    const c = CONE(0.05 + rr() * 0.025, 0.16 + rr() * 0.1, 5); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d)); H.push(C(c, HR, d.x * 0.24, 0.24 + d.y * 0.22, d.z * 0.22)); }
  mesh(H, head);
  const tongue = mesh([C(SPH(1, 8, 6), 0xff5a7a, 0, 0, 0, 0.055, 0.02, 0.08)], head, 0, 0.1, 0.27); tongue.rotation.x = 0.5; tongue.visible = false; // v5.3 goofy tongue-out face
  const arms = []; for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.2, 0.31, 0); torso.add(sh); mesh([C(CYL(0.065, 0.06, 0.1, 8), Y, 0, -0.03, 0), C(new THREE.CapsuleGeometry(0.045, 0.12, 3, 8), SK, 0, -0.12, 0)], sh);
    const el = new THREE.Group(); el.position.y = -0.22; sh.add(el); mesh([C(new THREE.CapsuleGeometry(0.042, 0.11, 3, 8), SK, 0, -0.08, 0), C(SPH(0.052, 8, 6), SK, 0, -0.19, 0)], el); arms.push({ sh, el, s }); }
  const hand = new THREE.Group(); hand.position.y = -0.2; arms[1].el.add(hand);
  const feather = mesh([C(SPH(1, 8, 6), 0xffd23a, 0, 0.2, 0, 0.05, 0.2, 0.012), C(SPH(1, 8, 6), 0xff6a3a, 0, 0.32, 0, 0.035, 0.08, 0.013), C(CYL(0.008, 0.008, 0.4, 4), 0xffffff, 0, 0.12, 0)], hand); feather.visible = false;
  const pie = mesh([C(CYL(0.2, 0.16, 0.06, 14), 0xd9a35a, 0, 0, 0), C(SPH(1, 12, 6, 0, TAU, 0, Math.PI / 2), 0xfffaf0, 0, 0.02, 0, 0.19, 0.09, 0.19), C(SPH(0.035, 6, 4), 0xd8202a, 0, 0.11, 0)], hand, 0, -0.05, 0.05); pie.visible = false;
  const mm = new THREE.MeshStandardMaterial({ color: 0x5a3818, roughness: 0.4 }), mud = []; for (const [p, x, y, z] of [[legs[0].knee, 0.03, -0.12, 0.05], [legs[1].knee, -0.03, -0.18, 0.05], [legs[0].foot, 0, 0.03, 0.1], [legs[1].foot, 0, 0.03, 0.1], [torso, 0.1, 0.12, 0.12], [torso, -0.08, 0.25, 0.12], [head, 0.13, 0.3, 0.18]]) { const o = new THREE.Mesh(SPH(0.06, 7, 5), mm); o.position.set(x, y, z); o.scale.set(1, 0.8, 0.5); o.visible = false; p.add(o); mud.push(o); }
  g.visible = false; return { g, body, hips, legs, torso, head, arms, shirt, bare, shorts, briefs, feather, pie, mud, tongue };
}
class BadDavid {
  constructor(F) { this.F = F; Object.assign(this, davidModel()); F.root.add(this.g); this.state = 'off'; this.bag = []; this.log = []; this.done = { undies: 0, mud: 0, pigride: 0, chickens: 0, pie: 0, campie: 0, megafart: 0, footprints: 0, tickle: 0, pogo: 0, pogoHops: 0, ropeswing: 0, flips: 0, prats: 0, circles: 0 }; this.circleLog = []; this.shouts = []; this.spin = 0; this.flipX = 0;
    this.pos = V(); this.yaw = 0; this.speed = 0; this.ph = 0; this.t = 0; this.mode = 'idle'; this.jy = 0; this.gigT = 1; this.flying = []; this.proj = []; this.bubT = 0; this.el = $('david-say'); this.n = 0; }
  get active() { return this.state !== 'off'; }
  trigger(name) {
    const F = this.F, p = F.kid; if (!p) return null; if (this.active) this.cleanup();
    if (!ACTIONS.includes(name)) { if (!this.bag.length) { this.bag = ACTIONS.slice(); for (let i = this.bag.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; } if (this.bag[this.bag.length - 1] === this.log[this.log.length - 1]) this.bag.unshift(this.bag.pop()); } name = this.bag.pop(); }
    this.log.push(name); this.n++;
    if (!this.g.visible) { const cy = F.g.cam.yaw, cf = V(-Math.sin(cy), 0, -Math.cos(cy)), sd = V(-cf.z, 0, cf.x), s = Math.random() < 0.5 ? -1 : 1;
      this.pos.set(p.pos.x + cf.x * 6 + sd.x * s * 3.5, 0, p.pos.z + cf.z * 6 + sd.z * s * 3.5); this.pos.y = F.W.height(this.pos.x, this.pos.z); this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      this.g.visible = true; F.fx.dust(this.pos, 10, 1.2, 5); F.fx.ring(this.pos, 3, 0xffd23a); sfx.whoosh && sfx.whoosh(0.6); }
    // v5.3: Mike's entrance shouts, then 2-3 fast goofy laps around Leandro (or the horse / tractor he's on), THEN the prank
    this.act = name; this.state = 'circle'; this.t = 0; this.stage = 0; this.d = {}; const C0 = this.circleCenter();
    this.circ = { a0: Math.atan2(this.pos.x - C0.x, this.pos.z - C0.z), n: Math.random() < 0.5 ? 2 : 3, p0: this.pos.clone(), dustT: 0, around: F.driving ? 'tractor' : F.riding ? 'horse' : 'kid' };
    this.shout('NOOO DAVIDD!', 1.0); F.g.later(0.95, () => { if (this.state === 'circle' && this.act === name) this.shout('THATS NOT FUNNY DAVID!!', 1.3); }); sfx.giggle(1); this.tongue.visible = true;
    return name;
  }
  say(text, dur = 2.6, big = false) { this.bubT = dur; if (this.el) { this.el.textContent = text; this.el.classList.remove('hidden'); this.el.classList.toggle('no', /NO|DAVID/.test(text)); this.el.classList.remove('shout'); if (big) { void this.el.offsetWidth; this.el.classList.add('shout'); } } }
  shout(text, dur) { this.say(text, dur, true); this.shouts.push(text); voice.say(text === 'NOOO DAVIDD!' ? 'Nooo, David!' : "That's not funny, David!", { prio: 2, cd: 0, rate: 1.1, pitch: 1.05 }); }
  circleCenter() { const F = this.F; return F.driving && F.tractor ? F.tractor.pos : F.riding && F.horse ? F.horse.pos : F.kid ? F.kid.pos : this.pos; }
  circle_(dt, T) { const F = this.F, C = this.circ, ctr = this.circleCenter(), R = C.around === 'kid' ? 2.8 : C.around === 'tractor' ? 5.2 : 4.4, dur = C.n === 3 ? 2.0 : 1.55, u = Math.min(1, T / dur), a = C.a0 + u * C.n * TAU;
    const gx = ctr.x + Math.sin(a) * R, gz = ctr.z + Math.cos(a) * R, k = Math.min(1, T / 0.18); this.pos.x = C.p0.x + (gx - C.p0.x) * k; this.pos.z = C.p0.z + (gz - C.p0.z) * k; F.W.collide(this.pos, 0.35, false);
    this.yaw = a + Math.PI / 2; this.speed = 16; this.mode = 'circle'; if ((C.dustT -= dt) <= 0) { C.dustT = 0.08; F.fx.dust(this.pos, 2, 0.8, 3); }
    if (T >= dur) { this.circleLog.push({ name: this.act, laps: C.n, dur: +T.toFixed(2), around: C.around }); this.done.circles++; this.tongue.visible = false; this.state = 'act'; this.t = 0; this.mode = 'idle';
      F.toast(TOASTS[this.act].replace('{a}', 'cow'), 0); sfx.giggle(0.8); this.setup(this.act); } }
  noo(extra) { const line = LINES[this.act].replace('{a}', extra || 'cow'); this.say(line, 3); voice.say('David, no!', { prio: 2, cd: 1200, rate: 1.05 }); this.F.toast(TOASTS[this.act].replace('{a}', extra || 'cow'), 0); }
  setup(name) {
    const F = this.F, d = this.d, kp = F.kid.pos;
    if (name === 'undies') { d.c = this.pos.clone(); d.a = Math.atan2(this.pos.x - kp.x, this.pos.z - kp.z); }
    else if (name === 'mud') { let best = null, bd = 30; for (const m of F.W.farmData.mud) { const dd = Math.hypot(m.x - this.pos.x, m.z - this.pos.z); if (dd < bd) { bd = dd; best = m; } }
      if (!best) { best = this.tempMud(this.pos.x + Math.sin(this.yaw) * 3, this.pos.z + Math.cos(this.yaw) * 3); } d.m = best; }
    else if (name === 'pigride') { const pigs = F.animals.filter(a => a.kind === 'pig' && a.state !== 'herded' && a !== F.runaway); d.pig = pigs.sort((a, b) => a.pos.distanceTo(this.pos) - b.pos.distanceTo(this.pos))[0];
      if (d.pig) { d.pig.set('wait'); d.pig.t = -6; } }
    else if (name === 'chickens') { const P = FARM.pens.chick, G = gateOf(P); d.g = V(G.x + G.ox * 2.5, 0, G.z + G.oz * 2.5); d.c = kp.clone(); }
    else if (name === 'pie') { d.a = F.animals.filter(a => a.state !== 'ridden' && a.pos.distanceTo(this.pos) < 40).sort((a, b) => (a.kind === 'cow' ? -15 : 0) + a.pos.distanceTo(this.pos) - (b.kind === 'cow' ? -15 : 0) - b.pos.distanceTo(this.pos))[0] || null; }
    else if (name === 'megafart') { let b = F.nearestBale(this.pos, 30); if (!b) { b = F.W.farmData.bales.find(x => x.fallen && !x.roll) || F.W.farmData.bales[0]; const x = this.pos.x + Math.sin(this.yaw) * 4, z = this.pos.z + Math.cos(this.yaw) * 4;
        b.fallen = false; b.roll = null; b.x = x; b.z = z; b.col.x = x; b.col.z = z; b.m.rotation.order = 'XYZ'; b.m.rotation.set(0, Math.random() * TAU, 0); b.m.position.set(x, F.W.height(x, z) + 0.85, z); F.fx.dust(b.m.position, 8, 1.4, 4); } d.b = b; }
    else if (name === 'footprints') { d.c = kp.clone(); d.a = 0; for (const m of this.mud) m.visible = true; }
    else if (name === 'pogo') { d.c = kp.clone(); d.a = Math.atan2(this.pos.x - kp.x, this.pos.z - kp.z); d.hop = -1; this.pogoMesh().visible = true; }
    else if (name === 'ropeswing') { const P = FARM.pond, dp = Math.hypot(kp.x - P.x, kp.z - P.z); let c, r, water;
      if (dp < 55) { c = V(P.x, 0, P.z); r = P.r * 0.8; water = true; } else { let best = null, bd = 60; for (const m of F.W.farmData.mud) { if (m.temp) continue; const dd = Math.hypot(m.x - kp.x, m.z - kp.z); if (dd < bd) { bd = dd; best = m; } }
        if (!best) best = this.tempMud(kp.x + 6, kp.z + 6); c = V(best.x, 0, best.z); r = best.r || 3; water = false; }
      const dir = V(kp.x - c.x, 0, kp.z - c.z); if (dir.lengthSq() < 0.01) dir.set(1, 0, 0); dir.normalize(); const gy = Math.max(F.W.height(c.x + dir.x * (r + 2), c.z + dir.z * (r + 2)), 0);
      d.c = c; d.dir = dir; d.water = water; d.L = 6.5; d.piv = V(c.x + dir.x * (r * 0.55 + 2.5), gy + 8.2, c.z + dir.z * (r * 0.55 + 2.5)); d.th0 = 0.85; d.splY = water ? 0.02 : F.W.height(c.x, c.z);
      d.grab = this.ropePt(d, d.th0); this.swingRig(d, true); }
    else if (name === 'tickle') { const pref = { cow: -20, horse: -8, goat: -6, sheep: -4, pig: -2, chicken: 10 }; d.a = F.animals.filter(a => a.state !== 'ridden' && a.state !== 'herded' && a !== F.runaway).sort((a, b) => a.pos.distanceTo(this.pos) + pref[a.kind] - b.pos.distanceTo(this.pos) - pref[b.kind])[0] || null; if (d.a) { d.a.set('wait'); d.a.t = -8; } }
  }
  tempMud(x, z) { const F = this.F, M = mats(); let m = F.W.farmData.mud.find(q => q.temp); if (!m) { m = { temp: true, r: 3 }; const g = new THREE.CircleGeometry(3, 24); g.rotateX(-Math.PI / 2); m.mesh = new THREE.Mesh(g, M.mud); F.W.farmRoot.add(m.mesh); F.W.farmData.mud.push(m); }
    m.x = x; m.z = z; m.mesh.position.set(x, F.W.height(x, z) + 0.06, z); m.mesh.visible = true; return m; }
  run(x, z, spd, dt) { const dx = x - this.pos.x, dz = z - this.pos.z, L = Math.hypot(dx, dz); if (L > 0.3) { const st = Math.min(L, spd * dt); this.pos.x += dx / L * st; this.pos.z += dz / L * st; this.speed = st / dt; this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 12); } else this.speed = 0;
    this.F.W.collide(this.pos, 0.35, false); return L; }
  faceTo(x, z, dt, k = 10) { this.yaw += angDiff(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z)) * Math.min(1, dt * k); }
  muddy(on) { for (const m of this.mud) m.visible = on; }
  clothes(on) { this.shirt.visible = this.shorts.visible = on; this.bare.visible = this.briefs.visible = !on; }
  // throw something in an arc (pie / clothes); onHit runs when it lands
  toss(mesh, from, to, dur, onHit, spin = 8) { mesh.position.copy(from); this.F.root.add(mesh); this.proj.push({ mesh, from: from.clone(), to, dur, t: 0, onHit, spin }); }
  update(dt) {
    const F = this.F; if (this.bubT > 0) { this.bubT -= dt; if (this.bubT <= 0 && this.el) this.el.classList.add('hidden'); }
    for (let i = this.proj.length - 1; i >= 0; i--) { const q = this.proj[i]; q.t += dt; const u = Math.min(1, q.t / q.dur), to = typeof q.to === 'function' ? q.to() : q.to; q.mesh.position.lerpVectors(q.from, to, u); q.mesh.position.y += Math.sin(u * Math.PI) * 2.2; q.mesh.rotation.x += dt * q.spin;
      if (u >= 1) { F.root.remove(q.mesh); this.proj.splice(i, 1); q.onHit && q.onHit(to); } }
    if (!this.active) return;
    const T = (this.t += dt), d = this.d, kp = F.kid ? F.kid.pos : this.pos; this.mode = 'idle'; this.speed = 0;
    if ((this.gigT -= dt) <= 0) { this.gigT = 1.4 + Math.random() * 1.6; sfx.giggle(clamp(1.2 - F.camDist(this.pos) / 40, 0, 0.8)); }
    if (this.state === 'leave' && this.prat > 0) { this.prat -= dt; this.mode = 'prat'; if (this.prat <= 0) { this.t = 0; this.F.emote('star', null, 3, V(this.pos.x, this.pos.y + 1.4, this.pos.z)); } }
    else if (this.state === 'leave') { const away = V(this.pos.x - kp.x, 0, this.pos.z - kp.z).normalize(); this.run(this.pos.x + away.x * 10, this.pos.z + away.z * 10, 9, dt); this.mode = 'run';
      if (T > 1.4) { F.fx.dust(this.pos, 10, 1.2, 5); sfx.whoosh && sfx.whoosh(0.5); this.stop(); return; } }
    else if (this.state === 'circle') this.circle_(dt, T);
    else this.act_(dt, T, d, kp);
    if (this.rope && this.rope.visible && this.act === 'ropeswing' && d.piv) { const end = this.stage >= 1 && this.stage <= 2 ? V(this.pos.x, this.pos.y + 1.55 + this.jy, this.pos.z) : this.ropePt(d, this.stage >= 3 ? -d.th0 * 0.5 : d.th0).add(V(0, 1.55, 0)); const mid = d.piv.clone().add(end).multiplyScalar(0.5);
      this.rope.position.copy(mid); this.rope.scale.set(1, d.piv.distanceTo(end), 1); this.rope.quaternion.setFromUnitVectors(V(0, 1, 0), end.clone().sub(d.piv).normalize()); }
    this.animate(dt);
    if (this.el && this.bubT > 0) { const cam = F.g.camera, hp = V(this.pos.x, this.pos.y + 2.0 + this.jy, this.pos.z).project(cam); const vis = hp.z < 1 && Math.abs(hp.x) < 1.1 && Math.abs(hp.y) < 1.1;
      this.el.style.opacity = vis ? 1 : 0; this.el.style.left = ((hp.x * 0.5 + 0.5) * innerWidth) + 'px'; this.el.style.top = ((-hp.y * 0.5 + 0.5) * innerHeight) + 'px'; }
  }
  leave() { const pr = this.prat > 0 ? this.prat : (Math.random() < 0.4 ? 0.9 : 0); this.cleanup(); this.state = 'leave'; this.t = 0; this.prat = pr; if (pr) { this.done.prats++; sfx.trip(clamp(1.2 - this.F.camDist(this.pos) / 40, 0.1, 0.8)); } }
  act_(dt, T, d, kp) {
    const F = this.F, a = this.act;
    if (a === 'undies') {
      if (this.stage === 0) { this.mode = 'flail'; this.faceTo(kp.x, kp.z, dt); if (T > 0.5) { this.stage = 1; this.clothes(false); this.done.undies++; this.noo(); sfx.whoosh && sfx.whoosh(0.8);
        for (const [col, w, h] of [[0xffd23a, 0.34, 0.34], [0xd63a2a, 0.34, 0.2]]) { const m = new THREE.Mesh(C(BOX(w, h, 0.08), col), mats().vc); const to = V(this.pos.x + (Math.random() - 0.5) * 6, this.pos.y, this.pos.z + (Math.random() - 0.5) * 6); this.toss(m, V(this.pos.x, this.pos.y + 1, this.pos.z), V(to.x, F.W.height(to.x, to.z) + 0.05, to.z), 0.9, () => this.flying.push(m), 6); } } }
      else { d.a += dt * 1.6; this.run(d.c.x + Math.sin(d.a) * 4.5, d.c.z + Math.cos(d.a) * 4.5, 7.5, dt); this.mode = 'flail'; if (T > 5.2) this.leave(); } }
    else if (a === 'mud') { const m = d.m;
      if (this.stage === 0) { this.mode = 'run'; if (this.run(m.x, m.z, 8.5, dt) < 1.5 || T > 4) { this.stage = 1; d.t0 = T; d.p0 = this.pos.clone(); } }
      else if (this.stage === 1) { const u = Math.min(1, (T - d.t0) / 0.6); this.jy = Math.sin(u * Math.PI) * 2.6; this.flipX = u < 1 ? u * TAU : 0; this.mode = 'jump'; this.pos.lerpVectors(d.p0, V(m.x, d.p0.y, m.z), u);
        if (u >= 1) { this.jy = 0; this.stage = 2; d.t1 = T; this.muddy(true); this.done.mud++; sfx.splash(clamp(1.3 - F.camDist(this.pos) / 40, 0.2, 1)); F.splat(this.pos, 28, 1.8); F.fx.ring(this.pos, 4, 0x6a4020); F.fx.shake = Math.max(F.fx.shake, 0.3); this.noo();
          const k = F.kid; if (k && k.pos.distanceTo(this.pos) < 8) { k.mech.mud = Math.min(1, (k.mech.mud || 0) + 0.5); F.toast('🟤 SPLOOSH! Leandro got splashed with mud! 😂', 0); }
          for (const b of F.animals) if (b.pos.distanceTo(this.pos) < 7 && b.kind !== 'pig') F.startle(b, this.pos); } }
      else { this.mode = 'stomp'; if (Math.random() < dt * 4) { sfx.squelch(0.7); F.splat(this.pos, 4, 0.8); } if (T - d.t1 > 2.2) this.leave(); } }
    else if (a === 'pigride') { const pig = d.pig; if (!pig) return this.leave();
      if (this.stage === 0) { this.mode = 'run'; if (this.run(pig.pos.x, pig.pos.z, 10, dt) < 1.4 + pig.K.r || T > 3.5) { this.stage = 1; d.t0 = T; pig.free = { x: pig.pos.x, z: pig.pos.z, r: 6 }; pig.rodeoC = pig.pos.clone().add(V(Math.sin(pig.yaw) * -6, 0, Math.cos(pig.yaw) * -6)); pig.rodeoA = Math.atan2(pig.pos.x - pig.rodeoC.x, pig.pos.z - pig.rodeoC.z);
        pig.rodeoC.set(pig.pos.x - Math.sin(pig.rodeoA) * 6, 0, pig.pos.z - Math.cos(pig.rodeoA) * 6); pig.rodeoA = Math.atan2(pig.pos.x - pig.rodeoC.x, pig.pos.z - pig.rodeoC.z); pig.set('rodeo'); this.done.pigride++; this.noo(); pig.say(1.2); F.emote('bang', pig, 2); } }
      else { pig.rodeoA = pig.rodeoA; const sa = Math.atan2(pig.pos.x - pig.rodeoC.x, pig.pos.z - pig.rodeoC.z); pig.rodeoA = sa + 0.6; this.pos.set(pig.pos.x, pig.pos.y + 0.66 + pig.hop, pig.pos.z); this.yaw = pig.yaw + Math.PI; this.mode = 'sitback'; this.onPig = true;
        if (T - d.t0 > 5.5) { this.onPig = false; pig.goHome(1.4); this.pos.set(pig.pos.x + 1.2, 0, pig.pos.z); this.pos.y = F.W.height(this.pos.x, this.pos.z); this.leave(); } } }
    else if (a === 'chickens') {
      if (this.stage === 0) { this.mode = 'run'; const L = this.run(d.g.x, d.g.z, 24, dt); if (Math.random() < 0.6) F.fx.dust(this.pos, 1, 0.8, 3);
        if (L < 1.5 || T > 2.2) { if (L >= 1.5) { F.fx.dust(this.pos, 8, 1, 4); this.pos.set(d.g.x, F.W.height(d.g.x, d.g.z), d.g.z); F.fx.dust(this.pos, 8, 1, 4); } this.stage = 1; d.t0 = T; this.done.chickens++; this.noo(); sfx.rooster(1);
          const P = FARM.pens.chick, G = gateOf(P); for (const c of F.animals) if (c.kind === 'chicken') { c.scatterC = d.c; c.scatterN = 0; c.free = null; c.path = c.inside() ? [V(G.x - G.ox * 2, 0, G.z - G.oz * 2), V(G.x + G.ox * 4, 0, G.z + G.oz * 4)] : null;
            c.goal = V(d.c.x + (Math.random() - 0.5) * 14, 0, d.c.z + (Math.random() - 0.5) * 14); c.set('scatter'); c.say(1); } } }
      else { this.mode = 'flap'; const L = this.run(d.c.x + Math.sin(T * 1.3) * 4, d.c.z + Math.cos(T * 1.3) * 4, 12, dt); if (Math.random() < dt * 6) F.fx.glow.spawn({ pos: V(this.pos.x, this.pos.y + 1, this.pos.z), vel: { x: (Math.random() - 0.5) * 3, y: 1, z: (Math.random() - 0.5) * 3 }, size: 0.15, life: 1.2, r: 1.4, g: 1.4, b: 1.4, alpha: 0.9, grav: 1.5, drag: 1 });
        if (T - d.t0 > 5) this.leave(); } }
    else if (a === 'pie') {
      if (this.stage === 0) { this.pie.visible = true; this.mode = 'windup'; if (d.a) this.faceTo(d.a.pos.x, d.a.pos.z, dt); if (T > 0.6) { this.stage = 1; this.pie.visible = false; this.mode = 'throw'; d.tt = T;
        if (d.a) { const tgt = d.a; this.toss(this.pieMesh(), this.pie.getWorldPosition(V()), () => tgt.mouthPt(V()).add(V(0, 0.15, 0)), Math.min(1.1, 0.35 + tgt.pos.distanceTo(this.pos) * 0.03), () => this.pieHit(tgt)); this.noo(tgt.name); } else this.noo(); } }
      else if (this.stage === 1) { this.mode = T - d.tt < 0.3 ? 'throw' : 'cheer'; if (T > 2.2) { this.stage = 2; this.pie.visible = true; d.tw = T; } }
      else if (this.stage === 2) { this.mode = 'windup'; const c = F.g.camera.position; this.faceTo(c.x, c.z, dt); if (T - d.tw > 0.5) { this.stage = 3; this.pie.visible = false; d.tt = T; const from = this.pie.getWorldPosition(V());
          this.toss(this.pieMesh(), from, () => { const cam = F.g.camera; return cam.position.clone().add(cam.getWorldDirection(V()).multiplyScalar(0.6)); }, 0.45, () => this.camPie(), 4); this.say('Catch! 🥧 Hee hee!', 1.5); } }
      else { this.mode = T - d.tt < 0.3 ? 'throw' : 'cheer'; if (T - d.tt > 1.8) this.leave(); } }
    else if (a === 'megafart') { const b = d.b;
      if (this.stage === 0) { this.mode = 'run'; const dir = V(this.pos.x - b.x, 0, this.pos.z - b.z); if (dir.lengthSq() < 0.01) dir.set(1, 0, 0); dir.normalize(); const gx = b.x + dir.x * 2.3, gz = b.z + dir.z * 2.3;
        if (this.run(gx, gz, 8, dt) < 0.6 || T > 4.5) { this.stage = 1; d.t0 = T; } }
      else if (this.stage === 1) { this.faceTo(this.pos.x * 2 - b.x, this.pos.z * 2 - b.z, dt, 14); this.mode = 'squat'; if (T - d.t0 > 1.0) { this.stage = 2; d.t1 = T; this.done.megafart++; sfx.fart('mega', 1.2); F.n.farts++;
        const back = V(b.x - this.pos.x, 0, b.z - this.pos.z).normalize(), at = V(this.pos.x + back.x * 0.3, this.pos.y + 0.6, this.pos.z + back.z * 0.3); F.cloud(at, back, 40, 2.2); F.fx.ring(at, 7, 0x8ad040); F.fx.ring(at, 12, 0x6ab030); F.fx.shake = Math.max(F.fx.shake, 1.0);
        F.knockBale(b, this.pos); F.emote('stink', null, 3, at.clone().setY(at.y + 1)); this.noo(); for (const q of F.animals) if (q.state !== 'ridden' && q.pos.distanceTo(this.pos) < 25) F.startle(q, this.pos, 1.8); } }
      else { const u = Math.min(1, (T - d.t1) / 0.9); this.jy = Math.sin(u * Math.PI) * 2.6; this.flipX = u < 1 ? u * TAU : 0; this.mode = u < 1 ? 'jump' : 'cheer'; if (u >= 1 && !d.fl) { d.fl = true; this.done.flips++; F.fx.dust(this.pos, 8, 1, 4); } if (T - d.t1 > 2.2) this.leave(); } }
    else if (a === 'footprints') { d.a += dt * 0.95; const x = d.c.x + Math.sin(d.a) * 7, z = d.c.z + Math.sin(d.a * 2) * 4; this.run(x, z, 7, dt); this.mode = 'run'; if (T > 0.4 && !d.said) { d.said = true; this.noo(); }
      if (T > 6) this.leave(); }
    else if (a === 'pogo') { // boing… pfft… BOING! each bounce is fart-powered, the last one is HUGE
      if (d.hop < 0 || T - d.h0 >= d.hd) { d.hop++; d.h0 = T; d.hd = d.hop >= 6 ? 1.5 : 0.62; if (d.hop > 6) { this.jy = 0; this.pogoMesh().visible = false; F.fx.dust(this.pos, 10, 1.2, 4); sfx.trip(0.8); this.done.prats++; this.prat = 0.9; return this.leave(); }
        if (d.hop === 0) { this.done.pogo++; this.noo(); } this.done.pogoHops++; F.n.farts++; const near = clamp(1.3 - F.camDist(this.pos) / 40, 0.15, 1); sfx.boing(near, d.hop >= 6 ? 0.6 : 1 + Math.random() * 0.3); sfx.fart(d.hop >= 6 ? 'trumpet' : pick(['tiny', 'squeaky', 'squeakup', 'short']), near * (d.hop >= 6 ? 1.1 : 0.8));
        F.cloud(V(this.pos.x, this.pos.y + 0.3, this.pos.z), V(0, -1, 0), d.hop >= 6 ? 14 : 5, d.hop >= 6 ? 1.2 : 0.6); F.fx.ring(this.pos, 1.5, 0x9be04a); }
      const u = Math.min(1, (T - d.h0) / d.hd); this.jy = 0.32 + Math.sin(u * Math.PI) * (d.hop >= 6 ? 4.2 : 1.3 + d.hop * 0.15); this.mode = 'pogo'; d.a += dt * 0.9; this.run(d.c.x + Math.sin(d.a) * 5, d.c.z + Math.cos(d.a) * 5, 6, dt);
      if (d.hop >= 6) this.flipX = -u * TAU; }
    else if (a === 'ropeswing') { // AAH-AH-AAAH… let go… SPLOOSH!
      if (this.stage === 0) { this.mode = 'run'; const L = this.run(d.grab.x, d.grab.z, 24, dt); if (Math.random() < 0.6) F.fx.dust(this.pos, 1, 0.8, 3);
        if (L < 0.8 || T > 2.4) { if (L >= 0.8) { F.fx.dust(this.pos, 8, 1, 4); this.pos.set(d.grab.x, F.W.height(d.grab.x, d.grab.z), d.grab.z); F.fx.dust(this.pos, 8, 1, 4); } this.stage = 1; d.t0 = T; d.p0 = this.pos.clone(); this.onPig = true; this.done.ropeswing++; this.noo(); } }
      else if (this.stage === 1) { const u = Math.min(1, (T - d.t0) / 0.4), top = this.ropePt(d, d.th0); this.mode = 'jump'; this.pos.lerpVectors(d.p0, top, u); this.pos.y += Math.sin(u * Math.PI) * 0.6; if (u >= 1) { this.stage = 2; d.t1 = T; sfx.whoosh && sfx.whoosh(1); this.say('AAAH-AH-AAAAH! 🌳', 2); } }
      else if (this.stage === 2) { const k = (T - d.t1) / 2.2, th = d.th0 * Math.cos(k * Math.PI * 1.75); this.pos.copy(this.ropePt(d, th)); this.yaw = Math.atan2(-d.dir.x, -d.dir.z); this.mode = 'hang';
        if (Math.random() < dt * 3) sfx.giggle(0.6); if (k >= 1 || (k > 0.45 && th < -d.th0 * 0.9)) { this.stage = 3; d.t2 = T; d.p1 = this.pos.clone(); d.to = V(d.c.x + d.dir.x * 1.5, d.splY, d.c.z + d.dir.z * 1.5); this.mode = 'flail'; sfx.whoosh && sfx.whoosh(0.8); } }
      else if (this.stage === 3) { const u = Math.min(1, (T - d.t2) / 0.7); this.pos.lerpVectors(d.p1, d.to, u); this.pos.y += Math.sin(u * Math.PI) * 2.2; this.flipX = -u * TAU; this.mode = 'jump';
        if (u >= 1) { this.flipX = 0; this.stage = 4; d.t3 = T; this.done.flips++; const near = clamp(1.3 - F.camDist(this.pos) / 45, 0.25, 1.1); sfx.splash(near); sfx.splash(near * 0.7); F.fx.shake = Math.max(F.fx.shake, 0.4);
          for (let i = 0; i < F.fx.n(30); i++) F.fx.glow.spawn({ pos: V(this.pos.x, d.splY + 0.2, this.pos.z), vel: { x: (Math.random() - 0.5) * 7, y: 4 + Math.random() * 6, z: (Math.random() - 0.5) * 7 }, size: 0.25, size1: 0.12, life: 1.1, r: d.water ? 0.7 : 0.6, g: d.water ? 1.1 : 0.42, b: d.water ? 1.6 : 0.2, alpha: 0.9, grav: 12 });
          F.fx.ring(this.pos, 4, d.water ? 0x8ad0ff : 0x6a4020); F.fx.ring(this.pos, 7, d.water ? 0xbfe8ff : 0x8a6030); if (!d.water) { F.splat(this.pos, 24, 1.6); this.muddy(true); }
          F.toast(d.water ? '😜 SPLOOSH! Bad David swung right into the POND! 🌊😂' : '😜 SPLOOSH! Bad David swung right into the MUD! 🟤😂', 0); this.say(d.water ? 'Hee hee! The water is FINE! 🌊' : 'Hee hee! SO muddy! 😜', 2.4);
          for (const q of F.animals) if (q.pos.distanceTo(this.pos) < 9 && !q.busy) F.startle(q, this.pos); } }
      else { this.mode = 'cheer'; this.pos.y = d.splY - (d.water ? 0.75 : 0.25) + Math.sin(T * 4) * 0.08; if (T - d.t3 > 2.2) { F.fx.dust(this.pos, 10, 1.2, 5); sfx.whoosh && sfx.whoosh(0.5); this.stop(); return; } } }
    else if (a === 'tickle') { const t = d.a; if (!t) return this.leave();
      if (this.stage === 0) { this.mode = 'run'; const side = V(Math.cos(t.yaw), 0, -Math.sin(t.yaw)), gx = t.pos.x + side.x * (t.K.r + 0.8), gz = t.pos.z + side.z * (t.K.r + 0.8); if (this.run(gx, gz, 10, dt) < 0.7 || T > 4.5) { this.stage = 1; d.t0 = T; t.set('tickled'); this.done.tickle++; this.noo(t.name); } }
      else { this.feather.visible = true; this.mode = 'tickle'; this.faceTo(t.pos.x, t.pos.z, dt); if (T - d.t0 > 3.4) { this.feather.visible = false; this.leave(); } } }
  }
  pogoMesh() { if (!this.pogo) { this.pogo = new THREE.Mesh(mergeGeometries([C(CYL(0.025, 0.025, 1.15, 6), 0xd63a2a, 0, 0.35, 0.13), C(BOX(0.42, 0.04, 0.04), 0x222222, 0, 0.9, 0.13), C(BOX(0.36, 0.03, 0.09), 0x333333, 0, -0.05, 0.12), C(new THREE.TorusGeometry(0.05, 0.012, 4, 10), 0xc0c0c0, 0, -0.12, 0.13, 1, 1, 1, Math.PI / 2, 0, 0), C(new THREE.TorusGeometry(0.05, 0.012, 4, 10), 0xc0c0c0, 0, -0.17, 0.13, 1, 1, 1, Math.PI / 2, 0, 0), C(SPH(0.04, 6, 4), 0x222222, 0, -0.24, 0.13)]), mats().vc); this.pogo.position.y = -0.04; this.g.add(this.pogo); } return this.pogo; }
  ropePt(d, th) { return V(d.piv.x - d.dir.x * Math.sin(th) * d.L * -1, d.piv.y - Math.cos(th) * d.L - 1.5, d.piv.z - d.dir.z * Math.sin(th) * d.L * -1); }
  // the rope hangs from a branch of a little temporary tree at the edge of the pond / puddle
  swingRig(d, on) { const F = this.F; if (!this.rig) { const g = new THREE.Group(), M = mats(); g.add(new THREE.Mesh(mergeGeometries([C(CYL(0.4, 0.6, 10, 8), 0x6a4420, 0, 5, 0), C(SPH(2.6, 10, 8), 0x3f8a2a, 0, 10.5, 0), C(SPH(2, 10, 8), 0x56a53a, 1.6, 9.6, 0.8)]), M.vc)); this.branch = new THREE.Mesh(C(CYL(0.18, 0.25, 1, 6), 0x6a4420), M.vc); g.add(this.branch);
      this.rope = new THREE.Mesh(CYL(0.035, 0.035, 1, 5), new THREE.MeshStandardMaterial({ color: 0xc8a060, roughness: 0.9 })); this.rope.castShadow = true; F.root.add(this.rope); this.rig = g; F.root.add(g); }
    this.rig.visible = this.rope.visible = on; if (!on) return; const tx = d.piv.x + d.dir.x * 4.5, tz = d.piv.z + d.dir.z * 4.5, ty = F.W.height(tx, tz); this.rig.position.set(tx, ty, tz);
    const a = V(0, d.piv.y - ty, 0), b = V(d.piv.x - tx, d.piv.y - ty, d.piv.z - tz); this.branch.position.copy(a).add(b).multiplyScalar(0.5); this.branch.scale.set(1, a.distanceTo(b) + 0.4, 1); this.branch.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); }
  pieMesh() { return new THREE.Mesh(mergeGeometries([C(CYL(0.22, 0.18, 0.07, 14), 0xd9a35a), C(SPH(1, 12, 6, 0, TAU, 0, Math.PI / 2), 0xfffaf0, 0, 0.03, 0, 0.21, 0.1, 0.21), C(SPH(0.04, 6, 4), 0xd8202a, 0, 0.13, 0)]), mats().vc); }
  pieHit(a) { const F = this.F; this.done.pie++; sfx.pie(clamp(1.2 - F.camDist(a.pos) / 40, 0.2, 1)); const p = a.mouthPt(V()); for (let i = 0; i < F.fx.n(18); i++) F.fx.smoke.spawn({ pos: p, vel: { x: (Math.random() - 0.5) * 4, y: 1 + Math.random() * 3, z: (Math.random() - 0.5) * 4 }, size: 0.2, size1: 0.35, life: 0.7, r: 1, g: 0.97, b: 0.9, alpha: 1, grav: 10 });
    if (!a.cream) { a.cream = new THREE.Mesh(mergeGeometries([C(SPH(1, 10, 8), 0xfffaf0, 0, 0, 0, 0.3, 0.22, 0.12), C(SPH(0.05, 6, 4), 0xd8202a, 0.05, 0.12, 0.08), C(SPH(0.09, 6, 5), 0xfffaf0, -0.12, -0.18, 0.02)]), mats().vc); a.head.add(a.cream); }
    a.cream.position.copy(a.mouth).add(V(0, 0.22, -0.05)); a.cream.visible = true; clearTimeout(a._creamTO); a._creamTO = setTimeout(() => { if (a.cream) a.cream.visible = false; }, 9000); a.say(1.1); F.emote('bang', a); if (!a.busy) { a.set('wait'); a.hop = 0.4; } }
  camPie() { const F = this.F; this.done.campie++; sfx.pie(1.2); F.fx.shake = Math.max(F.fx.shake, 0.4); const el = $('pie-splat'); if (el) { el.classList.remove('hidden'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); clearTimeout(this._pieTO); this._pieTO = setTimeout(() => el.classList.add('hidden'), 2600); }
    F.toast('🥧 SPLAT! Bad David pied the camera! 😂', 0); }
  cleanup() { const d = this.d || {}; if (this.tongue) this.tongue.visible = false; this.feather.visible = false; this.pie.visible = false; this.clothes(true); this.jy = 0; this.onPig = false; this.flipX = 0; this.spin = 0; if (this.pogo) this.pogo.visible = false; if (this.rig) { this.rig.visible = false; this.rope.visible = false; }
    for (const m of this.flying) this.F.root.remove(m); this.flying.length = 0;
    if (this.act === 'pigride' && d.pig && d.pig.state === 'rodeo') d.pig.goHome(1.4); if (this.act === 'pigride' && d.pig && d.pig.state === 'wait') d.pig.set('idle');
    if (this.act === 'tickle' && d.a && d.a.state === 'wait') d.a.set('idle'); }
  stop() { if (this.state === 'act' || this.state === 'circle') this.cleanup(); this.state = 'off'; this.g.visible = false; this.muddy(false); this.clothes(true); this.bubT = 0; if (this.el) this.el.classList.add('hidden');
    const t = this.F.W.farmData.mud.find(q => q.temp); if (t && t.mesh) t.mesh.visible = false; if (t) { t.x = 1e5; t.z = 1e5; } }
  animate(dt) {
    const L = this.legs, A = this.arms, sp = this.speed, k = clamp(sp / 4, 0, 1), T = this.t; this.ph += dt * (sp > 0.3 ? 3 + sp * 1.2 : 0); const s = Math.sin(this.ph);
    if (sp > 0.3 && (s > 0) !== (this._ls > 0)) { const near = clamp(1 - this.F.camDist(this.pos) / 40, 0, 1); if (near > 0) sfx.step(0.08 * near);
      if (this.act === 'footprints' && this.state === 'act') { const side = V(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), f = s > 0 ? 1 : -1; this.F.footprint(this.pos.x + side.x * 0.1 * f, this.pos.z + side.z * 0.1 * f, this.yaw); this.done.footprints++; } } this._ls = s;
    L.forEach((g, i) => { const ss = i ? -s : s; g.hip.rotation.set(-ss * 0.8 * k, 0, g.s * 0.05); g.knee.rotation.set(0.05 + Math.max(0, ss) * 1.1 * k, 0, 0); });
    A.forEach((a, i) => { const ss = i ? s : -s; a.sh.rotation.set(-ss * 0.9 * k - 0.1, 0, a.s * 0.15); a.el.rotation.set(-0.4 - 0.5 * k, 0, 0); });
    this.hips.position.y = 0.6 + Math.abs(Math.cos(this.ph)) * 0.06 * k; this.torso.rotation.set(0.12 * k, 0, 0); this.head.rotation.set(0, 0, Math.sin(T * 3) * 0.08); let bodyY = 0, bodyX = 0, bodyZ = 0;
    const m = this.mode;
    if (m === 'flail' || m === 'flap' || m === 'cheer') { A.forEach((a, i) => { a.sh.rotation.set(m === 'flap' ? -0.2 : -2.6 - Math.sin(T * 14 + i * 2) * 0.4, 0, a.s * (m === 'flap' ? 1.1 + Math.sin(T * 22) * 0.6 : 0.5 + Math.sin(T * 12 + i) * 0.2)); a.el.rotation.set(-0.2, 0, 0); }); if (m === 'cheer') bodyY = Math.abs(Math.sin(T * 9)) * 0.18; }
    if (m === 'jump') { L.forEach(g => { g.hip.rotation.set(-1.0, 0, g.s * 0.2); g.knee.rotation.set(1.6, 0, 0); }); A.forEach(a => { a.sh.rotation.set(-2.9, 0, a.s * 0.4); }); }
    if (m === 'stomp') { L.forEach((g, i) => { const u = Math.max(0, Math.sin(T * 10 + i * Math.PI)); g.hip.rotation.set(-u * 1.0, 0, g.s * 0.1); g.knee.rotation.set(u * 1.3, 0, 0); }); bodyY = Math.abs(Math.sin(T * 10)) * 0.08; A.forEach((a, i) => a.sh.rotation.set(-2.2, 0, a.s * 0.9)); }
    if (m === 'sitback') { L.forEach(g => { g.hip.rotation.set(-1.4, 0, g.s * 0.7); g.knee.rotation.set(1.2, 0, 0); }); this.hips.position.y = 0.12; A.forEach((a, i) => { a.sh.rotation.set(-2.8 + Math.sin(T * 10 + i * 3) * 0.4, 0, a.s * 0.6); a.el.rotation.set(-0.3, 0, 0); }); bodyY = Math.abs(Math.sin(T * 12)) * 0.08; bodyZ = Math.sin(T * 6) * 0.12; }
    if (m === 'squat') { this.torso.rotation.x = 0.85; this.hips.position.y = 0.48; L.forEach(g => { g.hip.rotation.set(-0.7, 0, g.s * 0.25); g.knee.rotation.set(1.0, 0, 0); }); A.forEach(a => { a.sh.rotation.set(-1.0, 0, a.s * 0.3); a.el.rotation.set(-0.5, 0, 0); }); bodyZ = Math.sin(T * 18) * 0.12; this.head.rotation.x = -0.6; }
    if (m === 'windup') { const R = A[1]; R.sh.rotation.set(-2.9, 0, 0.3); R.el.rotation.set(-0.6, 0, 0); this.torso.rotation.x = -0.1; }
    if (m === 'throw') { const R = A[1]; R.sh.rotation.set(-0.9, 0, 0.1); R.el.rotation.set(-0.1, 0, 0); this.torso.rotation.x = 0.25; }
    if (m === 'tickle') { const R = A[1]; R.sh.rotation.set(-1.4 + Math.sin(T * 20) * 0.25, 0, 0.2 + Math.sin(T * 17) * 0.3); R.el.rotation.set(-0.3 + Math.sin(T * 23) * 0.3, 0, 0); A[0].sh.rotation.set(-1.2, 0, -0.4); bodyY = Math.abs(Math.sin(T * 8)) * 0.05; }
    if (m === 'circle') { A.forEach((a, i) => { a.sh.rotation.set(-2.4 + Math.sin(T * 20 + i * 3) * 0.6, 0, a.s * 1.0); a.el.rotation.set(-0.3, 0, 0); }); bodyZ = -0.35; this.head.rotation.set(0, 0, Math.sin(T * 14) * 0.3); }
    if (m === 'cheer') { this.spin += dt * 9; bodyY = Math.abs(Math.sin(T * 9)) * 0.3; } else this.spin = 0;
    if (m === 'pogo') { L.forEach(g => { g.hip.rotation.set(-0.15, 0, g.s * 0.12); g.knee.rotation.set(0.3, 0, 0); }); A.forEach(a => { a.sh.rotation.set(-1.2, 0, a.s * 0.35); a.el.rotation.set(-0.6, 0, 0); }); this.head.rotation.x = -0.25; }
    if (m === 'hang') { A.forEach(a => { a.sh.rotation.set(-3.0, 0, a.s * 0.15); a.el.rotation.set(0, 0, 0); }); L.forEach((g, i) => { g.hip.rotation.set(-0.5 - Math.sin(T * 12 + i * 3) * 0.6, 0, g.s * 0.1); g.knee.rotation.set(0.8, 0, 0); }); }
    if (m === 'prat') { bodyX = -1.45; this.hips.position.y = 0.2; L.forEach((g, i) => { g.hip.rotation.set(-1.6 + Math.sin(T * 16 + i * 3) * 0.3, 0, g.s * 0.3); g.knee.rotation.set(0.3, 0, 0); }); A.forEach(a => a.sh.rotation.set(-2.9, 0, a.s * 1.2)); }
    bodyX += this.flipX;
    const gy = this.onPig ? this.pos.y : this.F.W.height(this.pos.x, this.pos.z); if (!this.onPig) this.pos.y = gy + (this.castleHop || 0);
    this.g.position.set(this.pos.x, this.pos.y + this.jy, this.pos.z); this.g.rotation.set(0, this.yaw, 0); this.body.position.y = bodyY; this.body.rotation.set(bodyX, this.spin, bodyZ); this.g.scale.setScalar(1.15);
  }
}
