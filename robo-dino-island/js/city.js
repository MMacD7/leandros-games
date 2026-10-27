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
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.e = new THREE.Euler();
    for (const b of this.list) this.place(b);
    this.sync();
  }
  place(b) {
    const { m4, q, v, s, e } = this; let y = this.W.height(b.x, b.z) - 0.4, jx = 0, jz = 0, tilt = 0, hs = 1;
    if (b.state === 'fall') { const u = clamp(b.t / 1.9, 0, 1), k = u * u * (3 - 2 * u); y -= b.h * 0.92 * k; tilt = 0.14 * Math.sin(u * Math.PI * 0.8); jx = Math.sin(b.t * 47) * 0.35 * (1 - u); jz = Math.cos(b.t * 39) * 0.35 * (1 - u); }
    else if (b.state === 'down') { y -= b.h * 0.92; }
    else if (b.flash > 0) { jx = Math.sin(b.t * 60) * 0.12 * b.flash; }
    e.set(Math.cos(b.tiltA) * tilt, 0, Math.sin(b.tiltA) * tilt); q.setFromEuler(e);
    m4.compose(v.set(b.x + jx, y, b.z + jz), q, s.set(b.w, b.h * hs + 0.4, b.d)); this.bm.setMatrixAt(b.i, m4);
    const top = y + b.h + 0.4;
    m4.compose(v.set(b.x + jx, top, b.z + jz), q, s.set(b.w + 0.7, 0.9, b.d + 0.7)); this.cap.setMatrixAt(b.i, m4);
    const ts = b.roof < 0.5 ? 1.6 + b.roof * 2 : 0.001;
    m4.compose(v.set(b.x + jx + b.w * 0.2, top + 0.9, b.z + jz - b.d * 0.15), q, s.set(ts, ts, ts)); this.top.setMatrixAt(b.i, m4);
    this.aD.setXY(b.i, b.dmg, b.flash * 0.6);
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
  collapse(b, by) {
    b.state = 'fall'; b.t = 0; b.hp = 0; b.dmg = 1; this.destroyed++; this.dirty = true; const g = this.game; if (!g) return;
    const fx = g.fx, gy = this.W.height(b.x, b.z), c = new THREE.Vector3(b.x, gy + b.h * 0.5, b.z), cam = g.camera.position, near = clamp(1 - Math.hypot(b.x - cam.x, b.z - cam.z) / 200, 0, 1);
    sfx.crash && sfx.crash(0.4 + near * 0.8, b.h); if (near > 0.1) sfx.rumble(2.2, 0.3 + near * 0.6);
    fx.shake = Math.max(fx.shake, 0.4 + near * 1.1);
    fx.ring(new THREE.Vector3(b.x, gy, b.z), Math.max(b.w, b.d) * 1.1, 0xd8c8a8);
    for (let i = 0; i < fx.n(10); i++) fx.chunk(c.clone().add(new THREE.Vector3((Math.random() - 0.5) * b.w, b.h * 0.4 * Math.random(), (Math.random() - 0.5) * b.d)), { x: (Math.random() - 0.5) * 22, y: 8 + Math.random() * 14, z: (Math.random() - 0.5) * 22 }, 0.7 + Math.random() * 0.8);
    const P = g.player, mine = by && by === P;
    if (mine || !by) { const n = 6 + Math.min(14, b.h / 4 | 0); g.dropBolts(new THREE.Vector3(b.x, gy + 1, b.z), n); g.addBolts(4 + (b.h / 6 | 0)); }
    if (g.onBuildingDown) g.onBuildingDown(b, by);
  }
  update(dt) {
    const g = this.game; let any = false;
    for (const b of this.list) {
      if (b.flash > 0) { b.flash = Math.max(0, b.flash - dt * 3); b.t += dt; any = true; }
      if (b.state !== 'fall') continue; b.t += dt; any = true;
      if (g) { const fx = g.fx, gy = this.W.height(b.x, b.z), u = b.t / 1.9;
        // billowing dust skirt at the base + puffs falling off the top while it sinks
        for (let k = 0; k < fx.n(3); k++) { const a = Math.random() * 6.28, px = b.x + Math.cos(a) * b.w * 0.6, pz = b.z + Math.sin(a) * b.d * 0.6, gg = 0.55 + Math.random() * 0.15;
          fx.smoke.spawn({ pos: { x: px, y: gy + 1 + Math.random() * 3, z: pz }, vel: { x: Math.cos(a) * 9, y: 2 + Math.random() * 4, z: Math.sin(a) * 9 }, size: 3 + b.w * 0.15, size1: 10 + b.w * 0.4, life: 2.4 + Math.random(), r: gg, g: gg * 0.95, b: gg * 0.85, alpha: 0.7, drag: 1.1, rv: (Math.random() - 0.5) }); }
        if (Math.random() < 0.5 && u < 0.9) { const top = gy + b.h * (1 - u * 0.92); fx.chunk(new THREE.Vector3(b.x + (Math.random() - 0.5) * b.w, top, b.z + (Math.random() - 0.5) * b.d), { x: (Math.random() - 0.5) * 8, y: 2 + Math.random() * 4, z: (Math.random() - 0.5) * 8 }, 0.5 + Math.random() * 0.5); }
        fx.shake = Math.max(fx.shake, 0.25 * (1 - u)); }
      if (b.t > 1.9) { b.state = 'down'; this.rubble(b); if (g) { g.fx.dust(new THREE.Vector3(b.x, this.W.height(b.x, b.z) + 0.5, b.z), 14, 4 + b.w * 0.2, 12); sfx.boom(0.4); } }
    }
    if (any || this.dirty) { for (const b of this.list) if (b.flash > 0 || b.state === 'fall' || this.dirty) this.place(b); this.sync(); this.dirty = false; }
  }
  rubble(b) {
    const r = rng(b.i * 31 + 7), gy = this.W.height(b.x, b.z), m4 = this.m4, q = this.q, v = this.v, s = this.s, n = 4 + (r() * 3 | 0);
    for (let k = 0; k < n && this.rubM.count < this.rubM.instanceMatrix.count; k++) { const sz = 1.4 + r() * Math.min(5, b.w * 0.2);
      q.setFromEuler(this.e.set(r() * 3, r() * 6, r() * 3)); m4.compose(v.set(b.x + (r() - 0.5) * b.w * 0.8, gy + sz * 0.25, b.z + (r() - 0.5) * b.d * 0.8), q, s.set(sz * (1 + r()), sz * 0.6, sz));
      const i = this.rubM.count++; this.rubM.setMatrixAt(i, m4); this.rubM.setColorAt(i, b.col.clone().lerp(new THREE.Color(0x777370), 0.5).multiplyScalar(0.7 + r() * 0.3)); }
    this.rubM.instanceMatrix.needsUpdate = true; if (this.rubM.instanceColor) this.rubM.instanceColor.needsUpdate = true;
  }
  // body-slam: a dino that runs/charges into a wall damages it (speed-scaled)
  slam(d, b, dt) { const sp = Math.abs(d.speedNow) + (d.act && (d.act.type === 'charge' || d.act.type === 'headbutt' || d.act.type === 'zoomies') ? 20 : 0); if (sp < 4) return;
    this.damage(b, sp * dt * (d === (this.game && this.game.player) ? 9 : 4) * Math.max(0.6, d.def.scale), d, d.pos.clone().setY(d.pos.y + 2)); }
  get pct() { return this.total ? this.destroyed / this.total : 0; }
}

export function buildCity(W) { W.city = new City(W); }
export function updateCity(W, dt) { if (W.city) W.city.update(dt); }
