// MEGA CITY SMASH: the third level. A flat city island with a road grid (painted in the terrain shader), a sunset sky,
// streetlights, parked cars (explosive Mayhem props) and ~150 procedural low-poly buildings drawn with 3 instanced meshes.
// Every building has HP: bites, lasers, missiles, stomps, breath and body-slams damage it; at zero it sinks and crumbles
// into a dust cloud and leaves a pile of rubble. All geometry is instanced, so the whole city is a handful of draw calls.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { fbm, rng, smooth, clamp, lerp } from './noise.js';
import { BASE, ARENA, VOLC, TITLE } from './world.js';
import { sfx } from './audio.js';

export const BLOCK = 44, ROAD = 6.2; // road half-width (m); roads run along x = k*BLOCK and z = k*BLOCK
export const CITY_R = 290;
const roadDist = v => { const m = ((v % BLOCK) + BLOCK) % BLOCK; return Math.min(m, BLOCK - m); };
// (lazy: world.js and city.js import each other, so these constants are only read at run time)
const PLAZAS = () => [[ARENA.x, ARENA.z, 56], [BASE.x, BASE.z, 34], [TITLE.x, TITLE.z, 36]];
export const inPlaza = (x, z, pad = 0) => PLAZAS().some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r + pad);

export function rawHeightCity(x, z) {
  const d = Math.hypot(x, z), r = d + fbm(x * 0.006 + 2, z * 0.006 - 4, 3) * 26;
  const land = 1 - smooth(CITY_R + 25, CITY_R + 70, r);
  let h = lerp(-9, 2.0, land);
  if (land < 0.98) h += fbm(x * 0.03, z * 0.03, 2) * 0.6 * land; // a little beach texture at the edge
  return h;
}

// GLSL shared by the terrain: roads / sidewalks / plazas, all procedural from world xz
export const cityGroundGLSL = () => `
float rd(float v){ float m = mod(v, ${BLOCK.toFixed(1)}); return min(m, ${BLOCK.toFixed(1)} - m); }
vec3 cityGround(vec3 base, vec2 p, float h){
  float land = smoothstep(1.2, 1.9, h);
  float dx = rd(p.x), dz = rd(p.y), dr = min(dx, dz);
  float road = 1.0 - smoothstep(${(ROAD - 0.1).toFixed(2)}, ${(ROAD + 0.1).toFixed(2)}, dr);
  float walk = 1.0 - smoothstep(${(ROAD + 2.4).toFixed(2)}, ${(ROAD + 2.6).toFixed(2)}, dr);
  vec3 asphalt = vec3(0.16, 0.165, 0.18) * (0.85 + 0.3 * fract(sin(dot(floor(p * 1.7), vec2(12.9, 78.2))) * 43758.5));
  vec3 curb = vec3(0.62, 0.6, 0.56);
  vec3 lot = vec3(0.42, 0.43, 0.42);
  vec3 c = mix(lot, curb, walk);
  // dashed yellow center lines + white crosswalk stripes
  float alongX = step(dz, dx); // 1 when this road runs along x (closer to a z-line)
  float center = alongX > 0.5 ? dz : dx; float along = alongX > 0.5 ? p.x : p.y;
  float dash = (1.0 - smoothstep(0.12, 0.22, center)) * step(0.5, fract(along / 6.0));
  float inter = step(dx, ${ROAD.toFixed(2)}) * step(dz, ${ROAD.toFixed(2)});
  float cross = (1.0 - inter) * step(min(dx, dz), ${ROAD.toFixed(2)}) * step(max(dx, dz), ${(ROAD + 4.5).toFixed(2)}) * step(0.5, fract((alongX > 0.5 ? p.y : p.x) / 1.6));
  vec3 rc = mix(asphalt, vec3(0.95, 0.78, 0.18), dash * (1.0 - inter));
  rc = mix(rc, vec3(0.9), cross);
  c = mix(c, rc, road);
  ${PLAZAS().map(([x, z, r], i) => `{ float pd = length(p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})); float pl = 1.0 - smoothstep(${(r - 3).toFixed(1)}, ${r.toFixed(1)}, pd);
    vec2 tq = floor(p / 3.0); vec3 tile = vec3(0.66, 0.6, 0.52) * (0.9 + 0.12 * mod(tq.x + tq.y, 2.0));
    ${i === 0 ? 'tile = mix(tile, vec3(0.75, 0.25, 0.18), (1.0 - smoothstep(0.3, 0.6, abs(pd - 30.0))) );' : ''}
    c = mix(c, tile, pl); }`).join('\n  ')}
  return mix(base, c, land);
}`;

// ---------- sunset sky ----------
export function citySky() {
  const w = 2048, h = 1024, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#1d3a78'); gr.addColorStop(0.22, '#3f6fb8'); gr.addColorStop(0.38, '#c88aa0'); gr.addColorStop(0.46, '#ffb070'); gr.addColorStop(0.5, '#ffd28a'); gr.addColorStop(0.53, '#a87060'); gr.addColorStop(1, '#2a2430');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const sx = w * 0.62, sy = h * 0.465; const sg = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.3);
  sg.addColorStop(0, 'rgba(255,240,190,1)'); sg.addColorStop(0.05, 'rgba(255,200,120,.9)'); sg.addColorStop(0.3, 'rgba(255,130,70,.35)'); sg.addColorStop(1, 'rgba(255,90,60,0)'); g.fillStyle = sg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(sx, sy, 22, 0, 7); g.fill();
  const r = rng(55);
  for (let i = 0; i < 90; i++) { const y = h * (0.18 + r() * 0.28), x = r() * w, cw = 100 + r() * 360, ch = 8 + r() * 22, k = (y / h - 0.18) / 0.28;
    g.fillStyle = `rgba(${255},${150 + k * 60 | 0},${120 + k * 30 | 0},${0.18 + r() * 0.3})`; for (const ox of [0, -w]) { g.beginPath(); g.ellipse(x + ox, y, cw / 2, ch / 2, 0, 0, 7); g.fill(); } }
  // a distant skyline silhouette on the horizon all the way around
  g.fillStyle = 'rgba(60,40,70,.85)'; for (let x = 0; x < w; x += 6 + r() * 14) { const bh = 6 + Math.pow(r(), 2) * 40, bw = 6 + r() * 16; g.fillRect(x, h * 0.5 - bh, bw, bh + 2); }
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- the city ----------
const CRACK = 0.55, LIE = 1.8, UP = new THREE.Vector3(0, 1, 0); // v5.6 collapse timing
const PALETTE = [0xd9cbb0, 0xb85a42, 0x6c8fa8, 0xe0d6c4, 0x8a9a9e, 0xc9a26a, 0x5f7d6a, 0xe8b88a, 0x9d6f8f, 0x4f6f96, 0xcfd8dc, 0xa8473a];
export class City {
  constructor(W) {
    this.W = W; this.list = []; this.grid = new Map(); this.destroyed = 0; this.game = null; this.rub = 0;
    const r = rng(2026);
    for (let i = -8; i < 8; i++) for (let j = -8; j < 8; j++) {
      const cx = i * BLOCK + BLOCK / 2, cz = j * BLOCK + BLOCK / 2; if (Math.hypot(cx, cz) > CITY_R - 30) continue;
      const lo = ROAD + 3.2, span = BLOCK - 2 * lo; // usable lot inside the sidewalks
      const dd = Math.hypot(cx - VOLC.x, cz - VOLC.z), tall = clamp(1 - dd / 170, 0, 1);
      const split = r() < 0.35 ? 1 : r() < 0.6 ? 2 : 4;
      const lots = split === 1 ? [[0, 0, span, span]] : split === 2 ? (r() < 0.5 ? [[-span / 4, 0, span / 2, span], [span / 4, 0, span / 2, span]] : [[0, -span / 4, span, span / 2], [0, span / 4, span, span / 2]])
        : [[-span / 4, -span / 4, span / 2, span / 2], [span / 4, -span / 4, span / 2, span / 2], [-span / 4, span / 4, span / 2, span / 2], [span / 4, span / 4, span / 2, span / 2]];
      for (const [ox, oz, lw, ld] of lots) {
        const x = i * BLOCK + BLOCK / 2 + ox, z = j * BLOCK + BLOCK / 2 + oz;
        if (r() < 0.08) continue; // a few empty lots
        const w = lw - 2 - r() * 3, d = ld - 2 - r() * 3;
        if (inPlaza(x, z, Math.max(w, d) * 0.6)) continue;
        const h = Math.round(9 + r() * 16 + tall * (20 + r() * 45) + (split === 1 ? 6 : 0));
        const col = new THREE.Color(PALETTE[(r() * PALETTE.length) | 0]).multiplyScalar(0.85 + r() * 0.25);
        const hp = Math.round(70 + h * 3.2 + w * d * 0.08);
        this.list.push({ i: this.list.length, x, z, w, d, h, hp, maxHp: hp, state: 'up', t: 0, col, tiltA: r() * 6.28, flash: 0, dmg: 0, roof: r() });
      }
    }
    for (const b of this.list) { const x0 = Math.floor((b.x - b.w / 2) / 16), x1 = Math.floor((b.x + b.w / 2) / 16), z0 = Math.floor((b.z - b.d / 2) / 16), z1 = Math.floor((b.z + b.d / 2) / 16);
      for (let a = x0; a <= x1; a++) for (let c = z0; c <= z1; c++) { const k = a + ',' + c; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(b); } }
    this.total = this.list.length;
    this.buildMeshes(); this.buildStreet();
  }
  near(x, z) { return this.grid.get(Math.floor(x / 16) + ',' + Math.floor(z / 16)); }
  // v5.6: how much of the straight line a→c is blocked by standing buildings (skip = the one coming down); used to pick a clear collapse shot
  losBlocked(a, c, skip) { const n = Math.max(2, Math.ceil(a.distanceTo(c) / 4)); let hit = 0;
    for (let i = 1; i < n; i++) { const t = i / n, x = a.x + (c.x - a.x) * t, y = a.y + (c.y - a.y) * t, z = a.z + (c.z - a.z) * t, L = this.near(x, z); if (!L) continue;
      for (const b of L) { if (b === skip || b.state !== 'up') continue; if (Math.abs(x - b.x) < b.w / 2 + 1 && Math.abs(z - b.z) < b.d / 2 + 1 && y < this.W.height(b.x, b.z) + b.h + 1.5) { hit++; break; } } }
    return hit; }
  // true if a circle at x,z (radius r) overlaps a standing building (used to keep spawns/props/pickups out)
  blocked(x, z, r = 0) { for (const b of this.list) if (b.state !== 'down' && Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return true; return false; }
  buildMeshes() {
    const N = this.list.length, W = this.W;
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.05, envMapIntensity: 0.6 });
    mat.customProgramCacheKey = () => 'city-bldg';
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aD; varying vec2 vD; varying vec3 vWP2; varying vec3 vON2;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 cw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
cw = instanceMatrix * cw;
#endif
cw = modelMatrix * cw; vWP2 = cw.xyz; vON2 = normal; vD = aD;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vD; varying vec3 vWP2; varying vec3 vON2;
float hh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
float side = 1.0 - step(0.5, abs(vON2.y));
vec2 wp = abs(vON2.x) > 0.5 ? vec2(vWP2.z, vWP2.y) : vec2(vWP2.x, vWP2.y);
vec2 cell = floor(vec2(wp.x / 3.1, (wp.y - 1.2) / 3.4)); vec2 f = fract(vec2(wp.x / 3.1, (wp.y - 1.2) / 3.4));
float win = side * step(0.18, f.x) * step(f.x, 0.82) * step(0.28, f.y) * step(f.y, 0.86) * step(4.0, wp.y);
float lit = step(0.62, hh(cell + floor(vWP2.xz / 20.0)));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.14, 0.2), win * 0.85);
diffuseColor.rgb *= 1.0 - 0.55 * vD.x * (0.6 + 0.4 * hh(floor(vWP2.xy * 0.7)));
float band = side * (1.0 - step(0.07, fract((vWP2.y - 1.2) / 3.4))) * step(4.0, vWP2.y);
diffuseColor.rgb *= 1.0 - band * 0.25;
float roofDark = 1.0 - side; diffuseColor.rgb *= 1.0 - roofDark * 0.35;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * win * lit * 0.9 * (1.0 - vD.x) + vec3(1.0, 0.85, 0.7) * vD.y;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, win);');
    };
    const mk = (geo, m, n) => { const im = new THREE.InstancedMesh(geo, m, n); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; W.root.add(im); return im; };
    const bg = box.clone(); this.aD = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2); bg.setAttribute('aD', this.aD);
    this.bm = mk(bg, mat, N);
    // roof cap / ledge + rooftop box (AC units, stair heads, water tanks)
    const capM = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.85 });
    this.cap = mk(box, capM, N);
    const tank = mergeGeometries([new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 1.5, 0), new THREE.ConeGeometry(0.55, 0.4, 10).translate(0, 2.2, 0),
      ...[[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]].map(([x, z]) => new THREE.CylinderGeometry(0.04, 0.04, 1, 4).translate(x, 0.5, z))]);
    this.top = mk(tank, new THREE.MeshStandardMaterial({ color: 0x6a4a34, roughness: 0.8 }), N);
    for (const b of this.list) this.bm.setColorAt(b.i, b.col);
    this.bm.instanceColor.needsUpdate = true;
    // rubble chunks (low-poly, flat shaded)
    const rg = new THREE.IcosahedronGeometry(1, 0);
    this.rubM = mk(rg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), N * 6); this.rubM.count = 0;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.e = new THREE.Euler(); this.s2 = new THREE.Vector3(); this.s3 = new THREE.Vector3();
    // v5.6: solid tumbling concrete chunks with simple physics (bounce, spin, settle), recycled from a fixed pool for iPads
    this.jMax = 64; this.junk = []; this.jM = mk(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), this.jMax); this.jM.count = 0; this.jM.frustumCulled = false; this.jM.castShadow = true;
    this.stats = { junk: 0, cracks: 0, topples: 0, pancakes: 0, floors: 0, fireballs: 0, impacts: 0, freezes: 0, debris: 0, rubble: 0 };
    for (const b of this.list) this.place(b);
    this.sync();
  }
  // v5.6: crack (wobble) -> TOPPLE about the base edge (tall towers) or PANCAKE floor by floor (squat blocks) -> rubble
  place(b) {
    const { m4, q, v, s, e } = this, gy = this.W.height(b.x, b.z); let y = gy - 0.4, jx = 0, jz = 0, hs = 1; q.identity();
    if (b.state === 'crack') { const u = clamp(b.t / CRACK, 0, 1); jx = Math.sin(b.t * 55) * 0.55 * u; jz = Math.cos(b.t * 47) * 0.55 * u; e.set(Math.sin(b.t * 31) * 0.035 * u, 0, Math.cos(b.t * 27) * 0.035 * u); q.setFromEuler(e); }
    else if (b.state === 'fall' && b.mode === 'topple') { const u = clamp(b.t / b.dur, 0, 1), th = Math.min(1.42, 1.42 * u * u), f = b.fdir; q.setFromUnitVectors(UP, this.s2.set(f.x * Math.sin(th), Math.cos(th), f.z * Math.sin(th))); y -= b.h * 0.08 * u; }
    else if (b.state === 'fall') { const per = b.dur / b.floors, k = Math.min(b.floors, b.t / per), i = Math.floor(k), fr = k - i, step = i + fr * fr * fr; hs = Math.max(0.12, 1 - 0.88 * step / b.floors); jx = Math.sin(b.t * 40) * 0.25; }
    else if (b.state === 'down' && b.lieT > 0) { const f = b.fdir; q.setFromUnitVectors(UP, this.s2.set(f.x * Math.sin(1.42), Math.cos(1.42), f.z * Math.sin(1.42))); y -= b.h * 0.08 + (1 - b.lieT / LIE) * (Math.min(b.w, b.d) + 1.5); } // the toppled tower lies there a moment, then sinks into its rubble
    else if (b.state === 'down') { y -= b.h * 0.92; }
    else if (b.flash > 0) { jx = Math.sin(b.t * 60) * 0.12 * b.flash; }
    // rotate around the bottom edge on the side it falls to (identity for the other states)
    const ext = b.fdir ? Math.abs(b.fdir.x) * b.w / 2 + Math.abs(b.fdir.z) * b.d / 2 : 0, E = this.s3.set(b.x + (b.fdir ? b.fdir.x * ext : 0), y, b.z + (b.fdir ? b.fdir.z * ext : 0));
    const base = v.set(b.x + jx, y, b.z + jz).sub(E).applyQuaternion(q).add(E), bx = base.x, by = base.y, bz = base.z, H = b.h * hs + 0.4;
    m4.compose(base, q, s.set(b.w, H, b.d)); this.bm.setMatrixAt(b.i, m4);
    const off = (x, yy, z) => v.set(x, yy, z).applyQuaternion(q).add(this.s3.set(bx, by, bz));
    m4.compose(off(0, H, 0), q, s.set(b.w + 0.7, 0.9, b.d + 0.7)); this.cap.setMatrixAt(b.i, m4);
    const ts = b.roof < 0.5 ? 1.6 + b.roof * 2 : 0.001;
    m4.compose(off(b.w * 0.2, H + 0.9, -b.d * 0.15), q, s.set(ts, ts, ts)); this.top.setMatrixAt(b.i, m4);
    this.aD.setXY(b.i, b.dmg, b.state === 'crack' ? 0.5 + 0.5 * Math.abs(Math.sin(b.t * 18)) : b.flash * 0.6);
  }
  sync() { for (const m of [this.bm, this.cap, this.top]) m.instanceMatrix.needsUpdate = true; this.aD.needsUpdate = true; }
  buildStreet() {
    const W = this.W, r = rng(7), lamps = [];
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) { const x = i * BLOCK, z = j * BLOCK; if (Math.hypot(x, z) > CITY_R - 10 || inPlaza(x, z, 4)) continue;
      lamps.push([x + ROAD + 1.2, z + ROAD + 1.2, Math.PI * 1.25]); if (r() < 0.5) lamps.push([x - ROAD - 1.2, z - ROAD - 1.2, Math.PI * 0.25]); }
    const pole = mergeGeometries([new THREE.CylinderGeometry(0.12, 0.18, 7, 6).translate(0, 3.5, 0), new THREE.BoxGeometry(0.12, 0.12, 2.2).translate(0, 6.9, 0.95)]);
    const pm = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.7, roughness: 0.4 }), lamps.length);
    const lm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.18, 0.8).translate(0, 6.78, 1.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 1.1), toneMapped: false }), lamps.length);
    lamps.forEach(([x, z, a], i) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, W.height(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(1, 1, 1)); pm.setMatrixAt(i, m); lm.setMatrixAt(i, m); });
    pm.castShadow = true; W.root.add(pm, lm); this.lamps = lamps;
    // the arena plaza: a ring of concrete jersey barriers + a statue plinth in the middle of the base plaza
    const bar = [], n = 28; for (let i = 0; i < n; i++) { if (i % 7 === 3) continue; const a = i / n * Math.PI * 2; bar.push([ARENA.x + Math.cos(a) * 44, ARENA.z + Math.sin(a) * 44, -a]); }
    const bgeo = new THREE.BoxGeometry(1.2, 1.3, 5.2).translate(0, 0.65, 0); const bmm = new THREE.InstancedMesh(bgeo, new THREE.MeshStandardMaterial({ color: 0xd0c8b8, roughness: 0.9 }), bar.length);
    bar.forEach(([x, z, a], i) => { bmm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, W.height(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(1, 1, 1))); W.addCollider(x, z, 1.6, W.height(x, z) + 1.3); });
    bmm.castShadow = bmm.receiveShadow = true; W.root.add(bmm);
  }
  // dinos can't walk through standing buildings; returns the building that was hit (for body-slams)
  collide(p, r, flyY) {
    const L = this.near(p.x, p.z); if (!L) return null; let hit = null;
    for (const b of L) { if (b.state !== 'up') continue; if (flyY > b.h + 2) continue;
      const hx = b.w / 2 + r, hz = b.d / 2 + r, dx = p.x - b.x, dz = p.z - b.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) { const ox = hx - Math.abs(dx), oz = hz - Math.abs(dz); if (ox < oz) p.x = b.x + Math.sign(dx || 1) * hx; else p.z = b.z + Math.sign(dz || 1) * hz; hit = b; } }
    return hit;
  }
  // area damage from any attack (bites, stomps, blasts, missiles…)
  damageAt(pos, R, dmg, by) {
    const L = this.list; let n = 0;
    for (const b of L) { if (b.state !== 'up') continue; const dx = Math.max(0, Math.abs(pos.x - b.x) - b.w / 2), dz = Math.max(0, Math.abs(pos.z - b.z) - b.d / 2);
      if (dx * dx + dz * dz > R * R) continue; const gy = this.W.height(b.x, b.z); if (pos.y > gy + b.h + R + 2) continue;
      this.damage(b, dmg, by, pos); n++; }
    return n;
  }
  // a laser / fireball segment: stops at the first building wall it reaches
  hitSegment(a, c, dmg, by) {
    const L = this.near(c.x, c.z); if (!L) return null;
    for (const b of L) { if (b.state !== 'up') continue; if (Math.abs(c.x - b.x) < b.w / 2 + 0.2 && Math.abs(c.z - b.z) < b.d / 2 + 0.2 && c.y < this.W.height(b.x, b.z) + b.h + 0.5) { if (dmg) this.damage(b, dmg, by, c); return b; } }
    return null;
  }
  damage(b, dmg, by, at) {
    if (b.state !== 'up' || !(dmg > 0)) return; const g = this.game, P = g && g.player;
    const k = by && P && by === P ? 1 : 0.3; // the player smashes hardest; wild dinos chip away at buildings as they stomp through
    b.hp -= Math.min(dmg, 90) * k; b.flash = Math.min(1, b.flash + 0.6); b.dmg = clamp(1 - b.hp / b.maxHp, 0, 1); this.dirty = true;
    if (g && Math.random() < 0.5) { const fx = g.fx, p = at ? at.clone ? at.clone() : new THREE.Vector3(at.x, at.y, at.z) : new THREE.Vector3(b.x, 4, b.z);
      p.x = clamp(p.x, b.x - b.w / 2, b.x + b.w / 2); p.z = clamp(p.z, b.z - b.d / 2, b.z + b.d / 2);
      fx.dust(p, 3, 1.6, 5); for (let i = 0; i < fx.n(2); i++) fx.chunk(p, { x: (Math.random() - 0.5) * 10, y: 4 + Math.random() * 7, z: (Math.random() - 0.5) * 10 }, 0.4 + Math.random() * 0.3); }
    if (b.hp <= 0) this.collapse(b, by);
  }
  // v5.6 BIG, VISIBLE collapses. Root cause of "I can't see it": the old collapse sank the box straight down in 1.9 s
  // inside an instant, opaque dust curtain (≈200 huge grey puffs), its debris was silently dropped because the shared
  // debris pool was already full of small hit chips, the crash sound was stretched over a minute (height in metres was
  // passed as a 0..1 factor), and the chase camera sat low behind the dino with the tower's top out of frame.
  collapse(b, by) {
    b.state = 'crack'; b.t = 0; b.hp = 0; b.dmg = 1; b.by = by; this.destroyed++; this.dirty = true; this.stats.cracks++;
    const g = this.game, P = g && g.player, tall = b.h / Math.max(b.w, b.d) > 2.0;
    b.mode = tall ? 'topple' : 'pancake'; b.floors = clamp(Math.round(b.h / 8), 3, 6); b.dur = tall ? 1.5 + Math.min(0.6, b.h / 120) : 0.34 * b.floors; b.floor = 0;
    const away = P ? new THREE.Vector3(b.x - P.pos.x, 0, b.z - P.pos.z) : new THREE.Vector3(Math.cos(b.tiltA), 0, Math.sin(b.tiltA)); if (away.lengthSq() < 0.01) away.set(1, 0, 0); away.normalize();
    // fall away from the player, a little to the side so it reads in profile
    b.fdir = away.applyAxisAngle(UP, (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.3));
    if (!g) return; const fx = g.fx, gy = this.W.height(b.x, b.z), cam = g.camera.position, near = clamp(1 - Math.hypot(b.x - cam.x, b.z - cam.z) / 200, 0, 1);
    sfx.crash && sfx.crash(0.25 + near * 0.4, 0.2); fx.shake = Math.max(fx.shake, 0.3 + near * 0.4);
    for (let i = 0; i < fx.n(6); i++) fx.glow.spawn({ pos: { x: b.x + (Math.random() - 0.5) * b.w, y: gy + Math.random() * b.h, z: b.z + (Math.random() - 0.5) * b.d }, vel: { x: (Math.random() - 0.5) * 8, y: 2 + Math.random() * 6, z: (Math.random() - 0.5) * 8 }, size: 0.3, size1: 0.05, life: 0.8, len: 0.5, r: 3, g: 2.2, b: 0.8, alpha: 1, grav: 12 });
    const mine = by && P && by === P;
    if (mine || !by) { const n = 6 + Math.min(14, b.h / 4 | 0); g.dropBolts(new THREE.Vector3(b.x, gy + 1, b.z), n); g.addBolts(4 + (b.h / 6 | 0)); }
    // the camera pulls back so the whole building is in frame (player-caused, close by)
    if (mine && Math.hypot(b.x - P.pos.x, b.z - P.pos.z) < 90 && g.collapseCam !== undefined) g.collapseCam = { b, t: 0, dur: CRACK + b.dur + 1.8 };
    if (g.onBuildingDown) g.onBuildingDown(b, by);
  }
  busyN() { let n = 0; for (const b of this.list) if (b.state === 'crack' || b.state === 'fall') n++; return n; }
  update(dt) {
    const g = this.game; let any = false;
    for (const b of this.list) {
      if (b.flash > 0) { b.flash = Math.max(0, b.flash - dt * 3); b.t += dt; any = true; }
      if (b.state === 'down' && b.lieT > 0) { b.lieT = Math.max(0, b.lieT - dt); any = true; this.place(b); continue; }
      if (b.state !== 'fall' && b.state !== 'crack') continue; b.t += dt; any = true;
      if (b.state === 'crack') { if (g && Math.random() < dt * 10) g.fx.dust(new THREE.Vector3(b.x + (Math.random() - 0.5) * b.w, this.W.height(b.x, b.z) + Math.random() * b.h * 0.6, b.z + (Math.random() - 0.5) * b.d), 1, 1.5, 3);
        if (b.t >= CRACK) { b.state = 'fall'; b.t = 0; if (b.mode === 'topple') this.stats.topples++; else this.stats.pancakes++; if (g) this.blast(b); } continue; }
      if (!g) { if (b.t > b.dur) { b.state = 'down'; this.rubble(b); } continue; }
      const fx = g.fx, gy = this.W.height(b.x, b.z), u = clamp(b.t / b.dur, 0, 1), near = this.near01(b);
      if (b.mode === 'topple') { // chunks + smoke peel off the falling top
        if (Math.random() < 0.5 && u < 0.95) { const top = this.topPt(b, u); fx.chunk(top, { x: b.fdir.x * 10 * u + (Math.random() - 0.5) * 6, y: Math.random() * 4, z: b.fdir.z * 10 * u + (Math.random() - 0.5) * 6 }, 0.5 + Math.random() * 0.6, true); this.stats.debris++; }
        if (Math.random() < 0.35 * fx.k) { const top = this.topPt(b, u); fx.smoke.spawn({ pos: top, vel: { x: 0, y: 1, z: 0 }, size: 2, size1: 6, life: 1.6, r: 0.55, g: 0.52, b: 0.48, alpha: 0.4, drag: 1, fadeIn: 0.1 }); } }
      else { const per = b.dur / b.floors, fl = Math.min(b.floors, Math.floor(b.t / per)); // one floor slams down onto the next: puff + chunks + thump
        if (fl > b.floor) { b.floor = fl; this.stats.floors++; const hs = Math.max(0.12, 1 - 0.88 * fl / b.floors), ty = gy + b.h * hs;
          for (let k = 0; k < fx.n(8); k++) { const a = k / 8 * 6.28 + Math.random() * 0.5; fx.smoke.spawn({ pos: { x: b.x + Math.cos(a) * b.w * 0.55, y: ty, z: b.z + Math.sin(a) * b.d * 0.55 }, vel: { x: Math.cos(a) * 10, y: 1 + Math.random() * 2, z: Math.sin(a) * 10 }, size: 2 + b.w * 0.08, size1: 6 + b.w * 0.2, life: 1.4, r: 0.72, g: 0.68, b: 0.6, alpha: 0.5, drag: 2, rv: (Math.random() - 0.5) }); }
          for (let k = 0; k < fx.n(3); k++) { fx.chunk(new THREE.Vector3(b.x + (Math.random() - 0.5) * b.w, ty, b.z + (Math.random() - 0.5) * b.d), { x: (Math.random() - 0.5) * 16, y: 4 + Math.random() * 8, z: (Math.random() - 0.5) * 16 }, 0.6 + Math.random() * 0.6, true); this.stats.debris++; }
          this.junkBurst(b, new THREE.Vector3(b.x, ty, b.z), fx.n(4), 18, 6); sfx.boom(0.25 + 0.45 * near); fx.shake = Math.max(fx.shake, 0.3 + 0.6 * near); fx.ring(new THREE.Vector3(b.x, ty, b.z), Math.max(b.w, b.d) * 0.9, 0xe8d8b8); } }
      if (b.t > b.dur) { b.state = 'down'; this.impact(b); }
    }
    this.updateJunk(dt);
    if (any || this.dirty) { for (const b of this.list) if (b.flash > 0 || b.state === 'fall' || b.state === 'crack' || this.dirty) this.place(b); this.sync(); this.dirty = false; }
  }
  throwJunk(p, vel, size, col) { const g = this.game, cap = Math.round(this.jMax * clamp(g ? g.fx.k : 1, 0.4, 1)); if (this.junk.length >= cap) this.junk.shift();
    this.junk.push({ p: p.clone(), v: new THREE.Vector3(vel.x, vel.y, vel.z), r: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0), w: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10), s: size, t: 0, col: col.clone().multiplyScalar(0.75 + Math.random() * 0.3) }); this.stats.junk++; }
  junkBurst(b, at, n, sp, up) { for (let i = 0; i < n; i++) this.throwJunk(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * b.w * 0.8, Math.random() * 2, (Math.random() - 0.5) * b.d * 0.8)), { x: (Math.random() - 0.5) * sp, y: up * (0.4 + Math.random()), z: (Math.random() - 0.5) * sp }, 0.6 + Math.random() * Math.min(1.8, b.w * 0.07), b.col); }
  updateJunk(dt) { if (!this.junk.length && !this.jM.count) return; const m4 = this.m4, q = this.q, s = this.s, W = this.W;
    for (let i = this.junk.length - 1; i >= 0; i--) { const J = this.junk[i]; J.t += dt; J.v.y -= 30 * dt; J.p.addScaledVector(J.v, dt); J.r.x += J.w.x * dt; J.r.y += J.w.y * dt; J.r.z += J.w.z * dt;
      const gh = W.height(J.p.x, J.p.z) + J.s * 0.4; if (J.p.y < gh) { J.p.y = gh; if (J.v.y < -3) { J.v.y *= -0.35; J.v.x *= 0.6; J.v.z *= 0.6; J.w.multiplyScalar(0.5); } else { J.v.set(0, 0, 0); J.w.multiplyScalar(0.8); } }
      if (J.t > 4.5) this.junk.splice(i, 1); }
    let n = 0; for (const J of this.junk) { const k = J.t > 3.8 ? Math.max(0.01, 1 - (J.t - 3.8) / 0.7) : 1; q.setFromEuler(J.r); m4.compose(J.p, q, s.set(J.s * k, J.s * 0.7 * k, J.s * 0.9 * k)); this.jM.setMatrixAt(n, m4); this.jM.setColorAt(n, J.col); n++; }
    this.jM.count = n; this.jM.instanceMatrix.needsUpdate = true; if (this.jM.instanceColor) this.jM.instanceColor.needsUpdate = true; }
  near01(b) { const g = this.game, cam = g.camera.position; return clamp(1 - Math.hypot(b.x - cam.x, b.z - cam.z) / 200, 0, 1); }
  topPt(b, u) { const th = Math.min(1.42, 1.42 * u * u), ext = Math.abs(b.fdir.x) * b.w / 2 + Math.abs(b.fdir.z) * b.d / 2, gy = this.W.height(b.x, b.z), r = b.h;
    return new THREE.Vector3(b.x + b.fdir.x * ext + b.fdir.x * Math.sin(th) * r, gy + Math.cos(th) * r, b.z + b.fdir.z * ext + b.fdir.z * Math.sin(th) * r); }
  // the moment it starts to go: cartoon fireballs bursting out of the floors + a flash and a big BOOM
  blast(b) { const g = this.game, fx = g.fx, gy = this.W.height(b.x, b.z), near = this.near01(b), busy = this.busyN() > 3, n = busy ? 1 : b.h > 30 ? 3 : 2, pw = clamp(0.7 + b.w / 30, 0.7, 1.5);
    for (let i = 0; i < n; i++) g.later(i * 0.12, () => { const side = i % 2 ? -1 : 1, p = new THREE.Vector3(b.x + side * b.w * 0.3 * Math.random(), gy + b.h * (0.25 + 0.5 * i / Math.max(1, n - 1)), b.z + side * b.d * 0.3 * Math.random());
      fx.boom(p, pw * (i === 0 ? 1 : 0.75), { groundY: gy, shake: 0.6 + near, column: i === 0 }); this.stats.fireballs++; });
    fx.flash(new THREE.Vector3(b.x, gy + b.h * 0.5, b.z), 2.2, 0xffb050); sfx.bigBoom(0.5 + 0.6 * near); sfx.crash(0.5 + near * 0.8, 0.6); if (near > 0.1) sfx.rumble(2.4, 0.3 + near * 0.6); fx.shake = Math.max(fx.shake, 0.6 + near * 1.2);
    for (let i = 0; i < fx.n(10); i++) { fx.chunk(new THREE.Vector3(b.x + (Math.random() - 0.5) * b.w, gy + b.h * (0.2 + 0.6 * Math.random()), b.z + (Math.random() - 0.5) * b.d), { x: (Math.random() - 0.5) * 26, y: 8 + Math.random() * 14, z: (Math.random() - 0.5) * 26 }, 0.7 + Math.random() * 0.9, true); this.stats.debris++; }
    this.junkBurst(b, new THREE.Vector3(b.x, gy + b.h * 0.5, b.z), fx.n(14), 24, 12); }
  // it hits the ground: impact freeze (player-caused), shockwave rings, a fireball at the impact, rolling dust that follows the shock out, rubble pile
  impact(b) { const g = this.game, fx = g.fx, gy = this.W.height(b.x, b.z), near = this.near01(b), P = g.player, tp = b.mode === 'topple';
    const at = tp ? new THREE.Vector3(b.x + b.fdir.x * b.h * 0.6, gy + 1, b.z + b.fdir.z * b.h * 0.6) : new THREE.Vector3(b.x, gy + 1, b.z); this.stats.impacts++;
    if (b.by && P && b.by === P && near > 0.45 && !(g.slowmo > 0)) { g.slowmo = 0.5; this.stats.freezes++; if (g.hud && g.hud.flash) g.hud.flash(); }
    if (this.busyN() < 3) { fx.boom(at, tp ? 1.3 : 1.1, { groundY: gy, shake: 1 + near, column: false }); this.stats.fireballs++; }
    fx.ring(at, Math.max(b.w, b.d) * 1.6 + (tp ? b.h * 0.3 : 0), 0xffe0a0); fx.ring(at, Math.max(b.w, b.d) * 2.6 + (tp ? b.h * 0.4 : 0), 0xd8c8a8);
    sfx.bigBoom(0.6 + 0.6 * near); sfx.crash(0.6 + near * 0.8, 0.9); fx.shake = Math.max(fx.shake, 0.8 + near * 1.4);
    // rolling dust: low, wide and semi-transparent (so the rubble shows through), along the fall line for a toppled tower
    const len = tp ? b.h * 1.0 : 0, nd = fx.n(18);
    for (let k = 0; k < nd; k++) { const a = Math.random() * 6.28, t = Math.random(), cx = tp ? b.x + b.fdir.x * len * t : b.x, cz = tp ? b.z + b.fdir.z * len * t : b.z, gg = 0.62 + Math.random() * 0.12;
      fx.smoke.spawn({ pos: { x: cx + Math.cos(a) * b.w * 0.4, y: gy + 0.8 + Math.random() * 1.5, z: cz + Math.sin(a) * b.d * 0.4 }, vel: { x: Math.cos(a) * (8 + Math.random() * 8), y: 0.6 + Math.random() * 1.8, z: Math.sin(a) * (8 + Math.random() * 8) }, size: 3 + b.w * 0.1, size1: 9 + b.w * 0.3, life: 2.4 + Math.random() * 1.2, r: gg, g: gg * 0.95, b: gg * 0.86, alpha: 0.45, drag: 1.3, rv: (Math.random() - 0.5) * 0.6, fadeIn: 0.06 }); }
    for (let i = 0; i < fx.n(10); i++) { fx.chunk(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * b.w, 1, (Math.random() - 0.5) * b.d)), { x: (Math.random() - 0.5) * 22, y: 6 + Math.random() * 10, z: (Math.random() - 0.5) * 22 }, 0.6 + Math.random() * 0.8, true); this.stats.debris++; }
    this.junkBurst(b, at, fx.n(14), 26, 9); if (tp) b.lieT = LIE; this.rubble(b); }
  // v5.6 Restart level: every building stands again, rubble and flying junk cleared
  reset() { for (const b of this.list) { b.state = 'up'; b.t = 0; b.hp = b.maxHp; b.dmg = 0; b.flash = 0; b.lieT = 0; b.fdir = null; b.mode = null; b.by = null; }
    this.destroyed = 0; this.rubM.count = 0; this.rubM.instanceMatrix.needsUpdate = true; this.junk.length = 0; this.jM.count = 0; this.dirty = true; for (const b of this.list) this.place(b); this.sync(); }
  rubble(b) { // a big heap where it stood, plus a trail of chunks along the fall line for a toppled tower
    const r = rng(b.i * 31 + 7), gy = this.W.height(b.x, b.z), m4 = this.m4, q = this.q, v = this.v, s = this.s, tp = b.mode === 'topple' && b.fdir, n = (tp ? 9 : 7) + (r() * 3 | 0);
    for (let k = 0; k < n && this.rubM.count < this.rubM.instanceMatrix.count; k++) { const sz = 1.4 + r() * Math.min(5, b.w * 0.22), t = tp ? r() : 0;
      const px = (tp ? b.x + b.fdir.x * b.h * 0.9 * t : b.x) + (r() - 0.5) * b.w * 0.9, pz = (tp ? b.z + b.fdir.z * b.h * 0.9 * t : b.z) + (r() - 0.5) * b.d * 0.9, py = this.W.height(px, pz);
      q.setFromEuler(this.e.set(r() * 3, r() * 6, r() * 3)); m4.compose(v.set(px, py + sz * (tp ? 0.25 : 0.35 + 0.25 * (1 - t)), pz), q, s.set(sz * (1 + r()), sz * (tp ? 0.6 : 0.8), sz));
      const i = this.rubM.count++; this.stats.rubble++; this.rubM.setMatrixAt(i, m4); this.rubM.setColorAt(i, b.col.clone().lerp(new THREE.Color(0x777370), 0.5).multiplyScalar(0.7 + r() * 0.3)); }
    this.rubM.instanceMatrix.needsUpdate = true; if (this.rubM.instanceColor) this.rubM.instanceColor.needsUpdate = true;
  }
  // body-slam: a dino that runs/charges into a wall damages it (speed-scaled)
  slam(d, b, dt) { const sp = Math.abs(d.speedNow) + (d.act && (d.act.type === 'charge' || d.act.type === 'headbutt' || d.act.type === 'zoomies') ? 20 : 0); if (sp < 4) return;
    this.damage(b, sp * dt * (d === (this.game && this.game.player) ? 9 : 4) * Math.max(0.6, d.def.scale), d, d.pos.clone().setY(d.pos.y + 2)); }
  get pct() { return this.total ? this.destroyed / this.total : 0; }
}

export function buildCity(W) { W.city = new City(W); }
export function updateCity(W, dt) { if (W.city) W.city.update(dt); }
