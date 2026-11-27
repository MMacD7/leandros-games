// v5.18.0 FARTY POOP FARM EXPANSION: the Pumpkin & Corn Harvest Patch, the Stinky Mud Pit, the Silo Grain Hopper
// (Mega Hay & Corn Shower + Barnyard Toot Chorus) and the jolly tractor TOOT exhaust. Everything is lean on purpose:
// one merged vertex-coloured mesh for all the new wood/dirt props, instanced crops and mud bubbles (about 9 draw calls).
// Warm country palette per the Game Art Director notes: barn red, warm wood, straw gold, pumpkin orange, crisp silhouettes.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { sfx } from './audio.js';
import { voice } from './voice.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = a => a[(Math.random() * a.length) | 0];
export const PLUS = {
  patch: { x: -28.5, z: 134, w: 11, d: 9 }, // beside the barn, sunlit, between the silo path and the hay bales
  mud: { x: 14, z: 114, r: 3.6 },          // right beside the pig pen's east fence
  hopper: { x: -38, z: 143, r: 2.1 },       // the golden Grain Hopper pad next to the silo
  regrow: 14, showerCD: 15,
};

function C(geo, col, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo; for (const a of ['uv', 'uv1', 'uv2']) if (g.attributes[a]) g.deleteAttribute(a);
  g.scale(sx, sy, sz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z);
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
const SPH = (r = 1, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);
const CONE = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);

function signAtlas(pages, bg = '#8b5a2b') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  pages.forEach((lines, pg) => { g.save(); g.translate(0, pg * 256);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#5a3a1a'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 242);
  for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(60,30,10,0.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(16, 40 + i * 44); g.bezierCurveTo(170, 30 + i * 44, 340, 52 + i * 44, 496, 38 + i * 44); g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  lines.forEach((L, i) => { g.font = `900 ${L.s}px ui-rounded, Arial Black, sans-serif`; g.lineWidth = 12; g.strokeStyle = '#3a1e08'; g.fillStyle = L.c; g.strokeText(L.t, 256, L.y); g.fillText(L.t, 256, L.y); });
  g.restore(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class FarmPlus {
  constructor(F, W) {
    this.F = F; this.W = W; this.t = 0; this.root = new THREE.Group(); this.root.name = 'farm-plus'; F.root.add(this.root);
    const gy = (x, z) => W.height(x, z), L = [], WOOD = 0x8b5a2b, WOOD2 = 0xa8743f, SOIL = 0x4a2e16, STRAW = 0xe8c65a;
    const P = PLUS.patch, py = gy(P.x, P.z);
    // ---- Pumpkin & Corn Patch: tilled soil bed + low split-rail fence (gap on the east side, toward the yard) ----
    L.push(C(BOX(P.w, 0.16, P.d), SOIL, P.x, py + 0.06, P.z));
    for (let r = -1; r <= 1; r++) L.push(C(BOX(P.w - 0.8, 0.12, 0.9), 0x5a3a1c, P.x, py + 0.17, P.z + r * 2.9));
    const fx0 = P.x - P.w / 2 - 0.4, fx1 = P.x + P.w / 2 + 0.4, fz0 = P.z - P.d / 2 - 0.4, fz1 = P.z + P.d / 2 + 0.4;
    const rail = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz), n = Math.max(1, Math.round(len / 2.2));
      for (let i = 0; i <= n; i++) { const u = i / n, x = ax + dx * u, z = az + dz * u; L.push(C(BOX(0.22, 1.1, 0.22), WOOD, x, gy(x, z) + 0.55, z)); }
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, my = gy(mx, mz); for (const h of [0.45, 0.88]) L.push(C(BOX(0.1, 0.12, len), WOOD2, mx, my + h, mz, 1, 1, 1, 0, ry, 0)); };
    rail(fx0, fz0, fx1, fz0); rail(fx0, fz1, fx1, fz1); rail(fx0, fz0, fx0, fz1);
    rail(fx1, fz0, fx1, P.z - 1.6); rail(fx1, P.z + 1.6, fx1, fz1); // the open gate
    // little patch sign on the gate post
    const sx = fx1 + 0.5, sz = P.z + 2.4; L.push(C(BOX(0.18, 2.0, 0.18), 0x6b4a2a, sx, gy(sx, sz) + 1.0, sz));
    // ---- Stinky Mud Pit: lumpy dirt rim + sign posts ----
    const M = PLUS.mud, my = gy(M.x, M.z);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rr = M.r + 0.15; L.push(C(SPH(0.55 + (i % 3) * 0.12, 8, 5), i % 2 ? 0x6a4422 : 0x7a5230, M.x + Math.cos(a) * rr, my - 0.05, M.z + Math.sin(a) * rr, 1.3, 0.38, 1.0, 0, -a, 0)); }
    const mxs = M.x + M.r + 1.2, mzs = M.z + 2.2; for (const o of [-0.9, 0.9]) L.push(C(BOX(0.2, 2.4, 0.2), 0x6b4a2a, mxs, gy(mxs, mzs) + 1.2, mzs + o));
    // ---- Silo Grain Hopper: a wooden chute from the silo down to the golden pad ----
    const H = PLUS.hopper, hy = gy(H.x, H.z);
    L.push(C(BOX(1.3, 0.3, 6.0), WOOD2, H.x - 3.2, hy + 4.6, H.z + 0.4, 1, 1, 1, 0.0, -0.95, 0.55));
    L.push(C(CONE(1.3, 1.6, 4), 0xb8322a, H.x - 0.6, hy + 3.1, H.z, 1, 1, 1, Math.PI, Math.PI / 4, 0));
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.push(C(BOX(0.16, 3.2, 0.16), WOOD, H.x - 0.6 + ox * 0.85, hy + 1.6, H.z + oz * 0.85));
    L.push(C(CYL(H.r + 0.25, H.r + 0.35, 0.14, 24), WOOD, H.x, hy + 0.07, H.z));
    for (let i = 0; i < 3; i++) L.push(C(CYL(0.55, 0.62, 0.5, 10), STRAW, H.x + 2.6 + (i % 2) * 0.4, hy + 0.25 + (i > 1 ? 0.5 : 0), H.z - 1.4 + (i % 2) * 1.1));
    const props = new THREE.Mesh(mergeGeometries(L), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0 }));
    props.castShadow = true; props.receiveShadow = true; props.name = 'farm-plus-props'; this.root.add(props);
    // mud surface (shiny), the bubbles (instanced) and the sign boards (one textured mesh each)
    this.mudM = new THREE.Mesh(new THREE.CircleGeometry(M.r, 28), new THREE.MeshStandardMaterial({ color: 0x5a3818, roughness: 0.2, metalness: 0, emissive: 0x1a0c04, emissiveIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.mudM.rotation.x = -Math.PI / 2; this.mudM.position.set(M.x, my + 0.06, M.z); this.mudM.receiveShadow = true; this.root.add(this.mudM);
    this.bub = new THREE.InstancedMesh(SPH(1, 10, 6), new THREE.MeshStandardMaterial({ color: 0x7a5028, roughness: 0.15, metalness: 0.05 }), 12); this.bub.frustumCulled = false; this.root.add(this.bub);
    this.bubs = []; for (let i = 0; i < 12; i++) this.bubs.push({ x: 0, z: 0, t: Math.random() * 1.6, dur: 0.9 + Math.random() * 1.1, s: 0.12 + Math.random() * 0.18 });
    // both wooden signs share one canvas atlas + one merged mesh (1 draw call): top half STINKY MUD PIT, bottom half PUMPKIN & CORN
    const atlas = signAtlas([[{ t: 'STINKY', s: 88, y: 80, c: '#a8e04a' }, { t: 'MUD PIT', s: 88, y: 180, c: '#ffd23a' }], [{ t: 'PUMPKIN', s: 84, y: 82, c: '#ff9a2a' }, { t: '& CORN', s: 84, y: 180, c: '#ffe36a' }]]);
    const plate = (w, h, half, x, y, z) => { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.5 + (half ? 0 : 0.5)); g.rotateY(Math.PI / 2); g.translate(x, y, z); return g; };
    const signs = new THREE.Mesh(mergeGeometries([plate(2.4, 1.2, 0, mxs + 0.12, gy(mxs, mzs) + 2.0, mzs), plate(1.9, 0.95, 1, sx + 0.12, gy(sx, sz) + 1.75, sz)]), new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.8, side: THREE.DoubleSide }));
    signs.name = 'farm-plus-signs'; this.root.add(signs);
    // golden Grain Hopper pad (glows when ready, dims while it refills)
    this.padMat = new THREE.MeshStandardMaterial({ color: 0xffc22a, roughness: 0.3, metalness: 0.6, emissive: 0xffa000, emissiveIntensity: 0.9 });
    this.pad = new THREE.Mesh(CYL(H.r, H.r, 0.12, 28), this.padMat); this.pad.position.set(H.x, hy + 0.16, H.z); this.pad.receiveShadow = true; this.pad.name = 'grain-hopper-pad'; this.root.add(this.pad);
    // ---- crops (instanced): pumpkins in the outer rows, tall golden corn in the middle row ----
    const pumpG = mergeGeometries([C(SPH(0.62, 14, 10), 0xff7a1a, 0, 0.48, 0, 1, 0.78, 1), ...[0, 1, 2, 3].map(i => C(SPH(0.34, 8, 6), 0xff8f2a, Math.cos(i * 1.57) * 0.42, 0.46, Math.sin(i * 1.57) * 0.42, 1, 1.25, 1)),
      C(CYL(0.07, 0.1, 0.34, 6), 0x3f6b1e, 0, 1.02, 0, 1, 1, 1, 0.2, 0, 0.15), C(SPH(0.2, 6, 4), 0x5aa02a, 0.22, 0.92, 0.05, 1.4, 0.3, 0.8)]);
    const cornG = mergeGeometries([C(CYL(0.07, 0.1, 2.6, 6), 0x5a9a2a, 0, 1.3, 0), ...[0, 1, 2, 3].map(i => C(BOX(0.06, 1.1, 0.22), 0x6fbf3a, Math.cos(i * 1.6 + 0.3) * 0.28, 1.0 + i * 0.32, Math.sin(i * 1.6 + 0.3) * 0.28, 1, 1, 1, 0.5 * Math.sin(i * 1.6 + 0.3), i * 1.6, 0.5 * Math.cos(i * 1.6 + 0.3))),
      C(CYL(0.16, 0.13, 0.7, 8), 0xffd23a, 0.18, 1.75, 0, 1, 1, 1, 0, 0, -0.35), C(CONE(0.12, 0.42, 5), 0xd8e86a, 0.05, 2.75, 0)]);
    this.pumpMesh = new THREE.InstancedMesh(pumpG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, emissive: 0x5a2400, emissiveIntensity: 0.55 }), 10);
    this.goldMesh = new THREE.InstancedMesh(pumpG, new THREE.MeshStandardMaterial({ color: 0xffd040, roughness: 0.18, metalness: 0.85, emissive: 0x9a6200, emissiveIntensity: 0.85 }), 10);
    this.cornMesh = new THREE.InstancedMesh(cornG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, emissive: 0x2a2200, emissiveIntensity: 0.35 }), 5);
    for (const m of [this.pumpMesh, this.goldMesh, this.cornMesh]) { m.castShadow = true; m.frustumCulled = false; this.root.add(m); }
    this.crops = []; let pi = 0, ci = 0;
    for (const r of [-1, 0, 1]) for (let c = -2; c <= 2; c++) { const x = P.x + c * 2.0 + (r === 0 ? 0.3 : 0), z = P.z + r * 2.9, kind = r === 0 ? 'corn' : 'pumpkin';
      this.crops.push({ x, z, y: py + 0.2, kind, slot: kind === 'corn' ? ci++ : pi++, gold: false, ripe: true, grow: 1, pop: 0, ph: Math.random() * 6, yaw: Math.random() * 6 }); }
    this.mtx = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.sc = V(); this.ps = V(); this.yAx = V(0, 1, 0);
    this.reset();
  }
  reset() { for (const c of this.crops) { c.ripe = true; c.grow = 1; c.pop = 0; c.gold = c.kind === 'pumpkin' && c.slot === 4; } this.showerT = 0; this.mudCD = 0; this.inMudWas = false; this.padWas = false; this.chorusQ = 0; this.n = { harvest: 0, goldPumpkins: 0, mudSplash: 0, mudGold: 0, showers: 0, chorus: 0, tractorToots: 0, exhaust: 0 }; this.sync(); }
  // ---------- per frame ----------
  update(dt, p, active) {
    this.t += dt; if (this.showerT > 0) this.showerT = Math.max(0, this.showerT - dt); if (this.mudCD > 0) this.mudCD -= dt;
    for (const c of this.crops) {
      if (c.pop > 0) { c.pop -= dt; if (c.pop <= 0) { c.pop = 0; c.grow = 0.04; } continue; }
      if (!c.ripe) { c.grow = Math.min(1, c.grow + dt / PLUS.regrow); if (c.grow >= 1) { c.ripe = true; if (c.kind === 'pumpkin') c.gold = Math.random() < 0.18; if (active && p && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 14) this.F.emote('sparkle', null, 1, V(c.x, c.y + 1.3, c.z)); } }
    }
    this.sync(); this.updateBubbles(dt);
    this.padMat.emissiveIntensity = this.showerT > 0 ? 0.15 + 0.1 * Math.sin(this.t * 3) : 0.75 + 0.35 * Math.sin(this.t * 4);
    if (!active || !p) return;
    const F = this.F, reach = F.driving ? 2.6 : (F.riding || F.ridingLion) ? 2.1 : 1.5;
    for (const c of this.crops) if (c.ripe && !c.pop && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < reach) this.harvest(c);
    // Stinky Mud Pit: walking, riding or driving through it
    const M = PLUS.mud, inMud = Math.hypot(p.pos.x - M.x, p.pos.z - M.z) < M.r * 0.92;
    if (inMud && (p.speedNow > 0.8 || !this.inMudWas) && this.mudCD <= 0) this.mudSplash(p);
    this.inMudWas = inMud;
    // Grain Hopper pad: stepping on it starts the shower (once per visit)
    const H = PLUS.hopper, onPad = Math.hypot(p.pos.x - H.x, p.pos.z - H.z) < H.r;
    if (onPad && !this.padWas) this.grainShower(p, 'step'); this.padWas = onPad;
  }
  sync() {
    const counts = { pumpkin: 0, gold: 0, corn: 0 }, hide = V(0, 0, 0);
    for (const c of this.crops) {
      let s = c.pop > 0 ? 1 + (0.35 - c.pop) * 2.4 : c.ripe ? 1 + Math.sin(this.t * 2.4 + c.ph) * 0.03 : 0.12 + c.grow * 0.7, y = c.y + (c.pop > 0 ? (0.35 - c.pop) * 4.5 : 0);
      if (c.pop > 0 && c.pop < 0.12) s *= c.pop / 0.12;
      const sy = c.kind === 'corn' ? (c.ripe ? s : 0.15 + c.grow * 0.75) : s;
      this.q.setFromAxisAngle(this.yAx, c.yaw + (c.kind === 'corn' ? Math.sin(this.t * 1.3 + c.ph) * 0.08 : 0)); this.ps.set(c.x, y, c.z); this.sc.set(s, sy, s); this.mtx.compose(this.ps, this.q, this.sc);
      if (c.kind === 'corn') this.cornMesh.setMatrixAt(c.slot, this.mtx);
      else { const gold = c.gold && (c.ripe || c.pop > 0); this.goldMesh.setMatrixAt(c.slot, gold ? this.mtx : this.mtx.clone().scale(hide)); this.pumpMesh.setMatrixAt(c.slot, gold ? this.mtx.clone().scale(hide) : this.mtx); }
    }
    for (const m of [this.pumpMesh, this.goldMesh, this.cornMesh]) m.instanceMatrix.needsUpdate = true;
    this.goldMesh.visible = this.crops.some(c => c.gold && (c.ripe || c.pop > 0));
  }
  updateBubbles(dt) { const M = PLUS.mud, y0 = this.mudM.position.y; let i = 0;
    for (const b of this.bubs) { b.t += dt * (this.mudBoost > 0 ? 2.2 : 1); if (b.t >= b.dur) { b.t = 0; const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * M.r * 0.8; b.x = M.x + Math.cos(a) * r; b.z = M.z + Math.sin(a) * r; b.dur = 0.9 + Math.random() * 1.1; b.s = 0.1 + Math.random() * 0.2; }
      const u = b.t / b.dur, s = b.s * (0.3 + u * 0.9) * (u > 0.88 ? (1 - u) / 0.12 : 1);
      this.ps.set(b.x, y0 + s * 0.35, b.z); this.sc.set(s, s * 0.7, s); this.q.identity(); this.mtx.compose(this.ps, this.q, this.sc); this.bub.setMatrixAt(i++, this.mtx); }
    this.bub.instanceMatrix.needsUpdate = true; if (this.mudBoost > 0) this.mudBoost -= dt; }
  // ---------- harvest ----------
  harvest(c) { const F = this.F, g = F.g, gold = c.kind === 'pumpkin' && c.gold, bolts = gold ? 15 : 5;
    c.ripe = false; c.pop = 0.35; c.grow = 0; this.n.harvest++; if (gold) this.n.goldPumpkins++;
    sfx.eggPop && sfx.eggPop(0.9); sfx.boing && sfx.boing(0.45, gold ? 1.5 : 1.25); if (gold) { sfx.sparkle(1); sfx.tada(0.6); } else sfx.coinChime && sfx.coinChime(1 + (this.n.harvest % 5));
    const at = V(c.x, c.y + 0.9, c.z), col = gold ? { r: 3, g: 2.4, b: 0.6 } : c.kind === 'corn' ? { r: 1.6, g: 1.4, b: 0.3 } : { r: 1.8, g: 0.8, b: 0.15 };
    for (let k = 0; k < F.fx.n(gold ? 22 : 12); k++) F.fx.glow.spawn({ pos: at, vel: { x: (Math.random() - 0.5) * 5, y: 2.5 + Math.random() * 4, z: (Math.random() - 0.5) * 5 }, size: 0.2, size1: 0.05, life: 0.75, r: col.r, g: col.g, b: col.b, alpha: 1, grav: 8 });
    F.emote(gold ? 'star' : 'sparkle', null, gold ? 3 : 1, at.clone().setY(at.y + 0.5));
    if (g.addBolts) g.addBolts(bolts);
    F.toast(gold ? `✨🎃 GOLDEN PUMPKIN! +15 🔩 ✨` : c.kind === 'corn' ? '🌽 POP! Golden corn! +5 🔩' : '🎃 POP! A big pumpkin! +5 🔩', gold ? 0 : 0.6);
    F.farmFair('harvest'); }
  radar() { const out = []; let any = false; for (const c of this.crops) { if (c.ripe && c.gold) out.push({ x: c.x, z: c.z, c: '#fff27a' }); if (c.ripe) any = true; }
    if (any) out.push({ x: PLUS.patch.x, z: PLUS.patch.z, c: '#ff9a2a' }); out.push({ x: PLUS.mud.x, z: PLUS.mud.z, c: '#8a5530' }); if (this.showerT <= 0) out.push({ x: PLUS.hopper.x, z: PLUS.hopper.z, c: '#ffc22a' }); return out; }
  // ---------- Stinky Mud Pit ----------
  mudSplash(p) { const F = this.F, M = PLUS.mud; this.mudCD = 1.0; this.n.mudSplash++; this.mudBoost = 1.5;
    sfx.squelch(1); sfx.bubbles && sfx.bubbles(0.8, 7); if (Math.random() < 0.6) sfx.fart('bubbly', 0.7); else sfx.plop(0.9);
    const at = V(p.pos.x, this.mudM.position.y, p.pos.z); for (let i = 0; i < F.fx.n(22); i++) F.fx.smoke.spawn({ pos: { x: at.x, y: at.y + 0.2, z: at.z }, vel: { x: (Math.random() - 0.5) * 8, y: 3 + Math.random() * 4.5, z: (Math.random() - 0.5) * 8 }, size: 0.35, size1: 0.7, life: 0.75, r: 0.34, g: 0.21, b: 0.09, alpha: 0.95, grav: 15, rv: 2 });
    F.fx.ring && F.fx.ring(at, 3.2, 0x6a4020); F.emote('stink', null, 1, at.clone().setY(at.y + 1.6)); p.mech.mud = Math.min(1, (p.mech.mud || 0) + 0.25); p.mech.squishT = 0.5;
    let pigs = 0; for (const a of F.animals) if (a.kind === 'pig' && !a.busy && a.state !== 'ridden' && a.state !== 'rodeo' && a.state !== 'herded' && a.state !== 'runaway' && a !== F.runaway && a.pos.distanceTo(p.pos) < 18) { pigs++; a.say(1); a.set('happy'); F.emote('heart', a); }
    const goldRoom = F.poops.filter(q => q.gold).length < (F.gMesh ? F.gMesh.instanceMatrix.count : 16), goldNow = goldRoom && (Math.random() < 0.22 || this.n.mudSplash === 2); let msg = pick(['🟤 SPLOOSH! Stinky mud everywhere! 😂', '🟤 SPLAT! Leandro is a mud monster! 😂', '🟤 BLORP! The mud tooted! 💨']);
    if (goldNow) { this.n.mudGold++; const a = Math.random() * 6.283, x = M.x + Math.cos(a) * (M.r + 1.4), z = M.z + Math.sin(a) * (M.r + 1.4), y = this.W.height(x, z);
      F.poops.push({ x, z, y, y0: y + 3, s: 1.1, gold: true, squish: 0, t: 0, landed: false, yaw: 0, ph: Math.random() * 6 }); F.syncPoop && F.syncPoop(); msg = '✨ BLOOP! The mud popped out a GOLDEN POOP! Grab it! +10 🔩'; sfx.sparkle(1); }
    if (pigs) msg += ' 🐷 Oink oink!'; F.toast(msg, goldNow ? 0 : 1.2); F.farmFair('mud'); }
  // ---------- Silo Grain Shower ----------
  nearHopper(p) { return p && Math.hypot(p.pos.x - PLUS.hopper.x, p.pos.z - PLUS.hopper.z) < 4.6; }
  grainShower(p, how = 'feed') { const F = this.F, g = F.g;
    if (this.showerT > 0) { if (how === 'feed' || F.hintT <= 0) { F.hintT = 1.2; F.toast(`🌾 The Grain Hopper is refilling... ${Math.ceil(this.showerT)}s`); } return false; }
    this.showerT = PLUS.showerCD; this.n.showers++; const c0 = V(p.pos.x, p.pos.y, p.pos.z);
    g.hud.shout && g.hud.shout('🌽 MEGA HAY SHOWER! 🌾', 1.8); sfx.whoosh(0.9); sfx.tada(0.8); sfx.cheer && sfx.cheer(0.5); voice.say('Yee-haw! Snack time!', { prio: 2, cd: 2500 });
    // golden hay + corn rains down over the barnyard for ~3 s
    for (let w = 0; w < 10; w++) g.later(w * 0.3, () => { for (let i = 0; i < F.fx.n(18); i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 26, corn = Math.random() < 0.45;
      F.fx.glow.spawn({ pos: V(c0.x + Math.cos(a) * r, c0.y + 10 + Math.random() * 6, c0.z + Math.sin(a) * r), vel: { x: (Math.random() - 0.5) * 1.5, y: -3, z: (Math.random() - 0.5) * 1.5 }, size: corn ? 0.2 : 0.28, size1: corn ? 0.16 : 0.22, life: 1.9, r: corn ? 1.5 : 1.2, g: corn ? 1.15 : 1.0, b: corn ? 0.2 : 0.45, alpha: 1, grav: 5, drag: 0.4 }); } });
    // feed every hungry animal nearby at once
    const fed = []; for (const a of F.animals) { if (a.busy || a.gulp || ['ridden', 'rodeo', 'herded', 'runaway', 'title', 'faint', 'eat'].includes(a.state) || a === F.runaway) continue; if (a.pos.distanceTo(c0) > 60) continue; fed.push(a); }
    fed.sort((x, y) => x.pos.distanceTo(c0) - y.pos.distanceTo(c0)); const eaters = fed.slice(0, 12);
    eaters.forEach((a, i) => g.later(0.6 + i * 0.12, () => { if (a.busy || a.state === 'ridden') return; a.set('eat'); a.fullT = 1e9; }));
    // ...and then the Barnyard Toot Chorus!
    const choir = eaters.slice(0, 7); g.later(2.6, () => { g.hud.shout && g.hud.shout('🎶💨 BARNYARD TOOT CHORUS! 💨🎶', 1.8); this.n.chorus++; });
    choir.forEach((a, i) => g.later(2.9 + i * 0.42, () => { if (a.busy || a.state === 'ridden' || a.state === 'eat') return; a.set('fart'); F.fartFrom(a, 1); }));
    if (g.addBolts) g.addBolts(10);
    F.toast(`🌾 MEGA HAY & CORN SHOWER! ${eaters.length} hungry animals munching! +10 🔩`);
    F.farmFair('shower'); return true; }
  // ---------- Red Tractor TOOT: jolly horn + stinky hay-exhaust that makes the animals giggle-fart ----------
  tractorToot() { const F = this.F, T = F.tractor; if (!T) return; this.n.tractorToots++; this.n.exhaust++;
    sfx.honkTune && sfx.honkTune(1, 0.85); const back = V(-Math.sin(T.yaw), 0, -Math.cos(T.yaw)), at = V(T.pos.x + back.x * 2.4, T.pos.y + 2.3, T.pos.z + back.z * 2.4);
    for (let i = 0; i < F.fx.n(16); i++) F.fx.smoke.spawn({ pos: { x: at.x + (Math.random() - 0.5) * 0.6, y: at.y + Math.random() * 0.5, z: at.z + (Math.random() - 0.5) * 0.6 }, vel: { x: back.x * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2, y: 0.8 + Math.random() * 1.5, z: back.z * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2 }, size: 0.8, size1: 3.2, life: 1.8 + Math.random() * 0.6, r: 0.9, g: 0.84, b: 0.4, alpha: 0.85, drag: 2.2, rv: (Math.random() - 0.5) * 3, fadeIn: 0.03 });
    F.cloud(at, back, 6, 0.9);
    const near = F.animals.filter(a => !a.busy && a.state !== 'ridden' && a.state !== 'rodeo' && a.pos.distanceTo(T.pos) < 13).slice(0, 4);
    near.forEach((a, i) => F.g.later(0.45 + i * 0.35, () => { if (a.busy || a.state === 'ridden') return; sfx.giggle && sfx.giggle(0.6); a.set('fart'); F.fartFrom(a, 0.8); F.emote('stink', a); }));
    F.toast(near.length ? '🚜📯 TOOT TOOT! The stinky hay exhaust made the animals giggle-fart! 😂' : '🚜📯 TOOT TOOT! Stinky hay exhaust! 💨', 1.5);
    F.farmFair('tractor'); }
}
