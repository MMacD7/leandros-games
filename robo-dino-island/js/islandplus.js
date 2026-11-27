// v5.19.0 CORE JUNGLE ISLAND EXPANSION: Volcano Turbo Boost Rings, the Waterfall Dino Power Shrine and the interactive
// Expedition Beacon "Jungle Dino Rally". Lean on purpose: the 6 rings are ONE instanced mesh (+1 inner glow), the shrine is
// 2 meshes, the beacon ring + sky beam are 2 meshes (the beam only draws while it pulses). About 6 draw calls in total.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { VOLC, FALLS, LAKE, BASE } from './world.js';
import { sfx } from './audio.js';
import { voice } from './voice.js';

export const ISLE = { rings: 6, ringBolts: 8, runBolts: 30, ringReset: 18, ringR: 4.2, shrineBolts: 15, surge: 12, shrineCD: 20, rallyCD: 25, rallyCores: 5, rallyBolts: 40 };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const segD = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1; let t = ((x - ax) * dx + (z - az) * dz) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _e = new THREE.Euler();

export class IslandPlus {
  constructor(g, W) {
    this.g = g; this.W = W; this.t = 0; this.root = new THREE.Group(); this.root.name = 'island-plus'; W.root.add(this.root);
    this.n = { rings: 0, runs: 0, surges: 0, rallies: 0, rallyWins: 0 };
    this.buildRings(); this.buildShrine(); this.buildBeacon(); this.reset();
  }
  // ---------- Volcano Turbo Boost Rings: a rising arc of 6 fiery-gold hoops on the volcano's lower west slope ----------
  buildRings() {
    const W = this.W, R = ISLE.ringR, a0 = Math.atan2(BASE.z - VOLC.z, BASE.x - VOLC.x) + 0.62; this.rings = [];
    for (let i = 0; i < ISLE.rings; i++) {
      const a = a0 + i * 0.19; let r = 182 - i * 7, x, z, h;
      for (let k = 0; k < 12; k++, r -= 6) { x = VOLC.x + Math.cos(a) * r; z = VOLC.z + Math.sin(a) * r; h = W.height(x, z); if (h > 2.2) break; }
      const ta = a + Math.PI / 2; // face along the trail so Leandro dashes straight through
      this.rings.push({ x, z, y: h + R + 0.6, yaw: Math.atan2(Math.cos(ta), Math.sin(ta)), alive: true, pop: 0 });
    }
    const mk = (geo, col, k) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), toneMapped: false, transparent: k < 1.5, opacity: k < 1.5 ? 0.55 : 1, depthWrite: k >= 1.5, blending: k < 1.5 ? THREE.AdditiveBlending : THREE.NormalBlending }), ISLE.rings); m.frustumCulled = false; this.root.add(m); return m; };
    this.ringM = mk(new THREE.TorusGeometry(R, 0.42, 8, 36), 0xffb23a, 1.7); this.ringM.name = 'volcano-turbo-rings';
    this.ringG = mk(new THREE.TorusGeometry(R - 0.55, 0.24, 6, 30), 0xff4a10, 1.0); this.ringG.name = 'volcano-turbo-rings-glow';
    this.ringT = 0; this.ringDone = 0; this.resetT = 0;
  }
  // ---------- Waterfall Secret Power Shrine: turquoise pad + crystal arch on dry ground beside the falls pool ----------
  buildShrine() {
    const W = this.W; let best = null;
    for (const r of [15, 18, 21, 24, 28]) { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, x = FALLS.x + Math.cos(a) * r, z = FALLS.z + Math.sin(a) * r, h = W.height(x, z);
      if (h < 1.4) continue; const slope = Math.abs(W.height(x + 2.5, z) - W.height(x - 2.5, z)) + Math.abs(W.height(x, z + 2.5) - W.height(x, z - 2.5));
      const river = Math.min(segD(x, z, -8, -62, FALLS.x, FALLS.z), segD(x, z, FALLS.x, FALLS.z, LAKE.x, LAKE.z)); if (river < 12 || slope > 3.2) continue;
      const score = slope + r * 0.08; if (!best || score < best.s) best = { x, z, h, s: score }; } if (best) break; }
    if (!best) best = { x: FALLS.x - 14, z: FALLS.z + 16, h: W.height(FALLS.x - 14, FALLS.z + 16) };
    const S = this.shrine = { x: best.x, z: best.z, y: best.h, r: 3.1, cd: 0 };
    this.padMat = new THREE.MeshStandardMaterial({ color: 0x2ae8d0, roughness: 0.25, metalness: 0.35, emissive: 0x18d8c8, emissiveIntensity: 1.2 });
    this.pad = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(S.r, S.r + 0.5, 0.45, 28).translate(0, 0.2, 0), new THREE.CylinderGeometry(S.r + 0.9, S.r + 1.2, 0.18, 28).translate(0, 0.02, 0)]), this.padMat);
    this.pad.position.set(S.x, S.y, S.z); this.pad.receiveShadow = true; this.pad.name = 'dino-power-shrine-pad'; this.root.add(this.pad);
    const toY = Math.atan2(FALLS.x - S.x, FALLS.z - S.z), parts = [];
    const arch = new THREE.TorusGeometry(S.r + 0.6, 0.38, 8, 26, Math.PI); parts.push(arch);
    for (const sx of [-1, 1]) { parts.push(new THREE.OctahedronGeometry(0.9, 0).scale(0.7, 1.8, 0.7).translate(sx * (S.r + 0.6), 0.9, 0)); parts.push(new THREE.OctahedronGeometry(0.5, 0).scale(0.7, 1.6, 0.7).translate(sx * (S.r + 1.4), 0.5, 0.6)); }
    parts.push(new THREE.OctahedronGeometry(0.85, 0).scale(1, 1.4, 1).translate(0, S.r + 1.6, 0));
    this.crystalMat = new THREE.MeshStandardMaterial({ color: 0x9afcff, roughness: 0.08, metalness: 0.2, emissive: 0x20e0e8, emissiveIntensity: 1.4, transparent: true, opacity: 0.92 });
    this.arch = new THREE.Mesh(mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p)), this.crystalMat);
    this.arch.position.set(S.x, S.y + 0.3, S.z); this.arch.rotation.y = toY + Math.PI / 2; this.arch.castShadow = true; this.arch.name = 'dino-power-shrine-arch'; this.root.add(this.arch);
    this.surgeT = 0;
  }
  // ---------- Interactive Meshy Expedition Beacon: glowing base ring + sky-pulse beam ----------
  buildBeacon() {
    const W = this.W, b = W.expeditionBeacon, at = V(BASE.x - 14, 0, BASE.z - 1.5);
    if (b) { W.baseGroup && W.baseGroup.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(b); box.getCenter(_v); at.set(_v.x, 0, _v.z); }
    at.y = W.height(at.x, at.z); const B = this.beacon = { x: at.x, z: at.z, y: at.y, r: 4.2, cd: 0 };
    this.bRingMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb48cff).multiplyScalar(1.6), toneMapped: false });
    const rg = new THREE.TorusGeometry(B.r, 0.26, 6, 40); rg.rotateX(Math.PI / 2);
    this.bRing = new THREE.Mesh(rg, this.bRingMat); this.bRing.position.set(B.x, B.y + 0.45, B.z); this.bRing.name = 'beacon-rally-ring'; this.root.add(this.bRing);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.6, 160, 14, 1, true).translate(0, 80, 0), new THREE.MeshBasicMaterial({ color: 0xc8a0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.beam.position.set(B.x, B.y, B.z); this.beam.visible = false; this.beam.name = 'beacon-sky-pulse'; this.root.add(this.beam); this.beamT = 0;
    this.rally = null;
  }
  reset() {
    for (const r of this.rings) { r.alive = true; r.pop = 0; } this.ringDone = 0; this.resetT = 0; this.turboT = 0; this.surgeT = 0;
    if (this.rally && this.rally.foe && this.rally.foe.alive) this.rally.foe.rally = false; this.rally = null;
    const g = this.g; if (g.pickups) g.pickups = g.pickups.filter(k => !k.once);
    this.drawRings(0);
  }
  get on() { const g = this.g; return !!(g.world === this.W && g.mode === 'roam'); }
  hud(t) { const h = this.g.hud; if (h && h.toast) h.toast(t); }
  big(t, lvl = 2) { const h = this.g.hud; if (!h || !h.banner) return; h.banner(t, lvl); const el = typeof document !== 'undefined' && document.getElementById('banner'); if (el) el.classList.add('ip'); }
  // ---------- per frame ----------
  update(dt, p) {
    this.t += dt; const play = this.on && p && p.alive;
    this.updateRings(dt, p, play); this.updateShrine(dt, p, play); this.updateBeacon(dt, p, play);
  }
  near(p, x, z, r) { return Math.hypot(p.pos.x - x, p.pos.z - z) < r + Math.min(2.5, (p.radius || 1.5) * 0.45); }
  updateRings(dt, p, play) {
    const g = this.g;
    if (play) for (let i = 0; i < this.rings.length; i++) { const r = this.rings[i]; if (!r.alive) continue; const inside = this.near(p, r.x, r.z, ISLE.ringR + 0.4) && p.pos.y < r.y + ISLE.ringR + 4 + (p.alt || 0);
      if (r.hold) { if (!inside) r.hold = false; continue; } // came back while Leandro stood in it: step out first
      if (inside) this.popRing(r, i, p); }
    if (this.resetT > 0) { this.resetT -= dt; if (this.resetT <= 0) { for (const r of this.rings) { r.alive = true; r.pop = 0; r.hold = !!(p && p.alive && this.near(p, r.x, r.z, ISLE.ringR + 2)); } this.ringDone = 0; if (play) this.hud('🌋 The Volcano Turbo Rings are back! Go again! 🔥'); } }
    if (this.turboT > 0 && p && p.alive) { this.turboT -= dt; if (p.speedNow > 1) { p.forward(_v); p.knock.addScaledVector(_v, 42 * dt); }
      if (g.fx && Math.random() < 0.7) g.fx.fire.spawn({ pos: { x: p.pos.x - Math.sin(p.yaw) * p.radius, y: p.pos.y + 1, z: p.pos.z - Math.cos(p.yaw) * p.radius }, vel: { x: -Math.sin(p.yaw) * 6, y: 2, z: -Math.cos(p.yaw) * 6 }, size: 0.9, size1: 2.4, life: 0.35, r: 3.2, g: 1.5, b: 0.35, alpha: 1, drag: 1.5 }); }
    this.drawRings(dt);
  }
  drawRings(dt) {
    let n = 0; const t = this.t;
    for (const r of this.rings) { if (r.pop > 0) r.pop = Math.max(0, r.pop - dt * 2.2);
      const k = r.alive ? 1 + Math.sin(t * 3 + r.x) * 0.05 : r.pop > 0 ? 1 + (1 - r.pop) * 0.9 : 0; if (k <= 0) continue;
      _q.setFromEuler(_e.set(0, r.yaw, 0)); _m.compose(_v.set(r.x, r.y, r.z), _q, _s.setScalar(k)); this.ringM.setMatrixAt(n, _m);
      _q.setFromEuler(_e.set(0, r.yaw, t * 2.4)); _m.compose(_v, _q, _s.setScalar(k * (r.alive ? 1 : 0.6))); this.ringG.setMatrixAt(n, _m); n++; }
    this.ringM.count = this.ringG.count = n; this.ringM.instanceMatrix.needsUpdate = this.ringG.instanceMatrix.needsUpdate = true;
  }
  popRing(r, i, p) {
    const g = this.g; r.alive = false; r.pop = 1; this.ringDone++; this.n.rings++; this.turboT = 2.6;
    p.boostE = p.st.boost; p.forward(_v); p.knock.addScaledVector(_v, 26);
    sfx.whoosh(1.4); sfx.coinChime && sfx.coinChime(Math.min(4, this.ringDone)); if (g.fx) { const c = V(r.x, r.y, r.z); g.fx.sparks(c, 26, { r: 1, g: 0.6, b: 0.15 }, 1.6); g.fx.ring(V(r.x, r.y - ISLE.ringR, r.z), 9, 0xff8a2a); g.fx.embers && g.fx.embers(c, 6, 10, 5); }
    if (g.addBolts) g.addBolts(ISLE.ringBolts);
    if (g.expedition && g.expedition.onRing) g.expedition.onRing();
    if (this.ringDone >= this.rings.length) {
      this.n.runs++; this.resetT = ISLE.ringReset; if (g.addBolts) g.addBolts(ISLE.runBolts);
      this.big('🌋 VOLCANO TURBO RUN! +30 🔩', 3); sfx.banner && sfx.banner(3); sfx.tada && sfx.tada(0.8); voice.say('Volcano turbo run!', { prio: 2, cd: 2000 });
      if (g.fx) for (let k = 0; k < 3; k++) g.later(k * 0.18, () => g.fx.ring(p.pos.clone(), 10 + k * 7, 0xffb23a));
    } else this.hud(`🔥 TURBO RING ${this.ringDone}/${this.rings.length}! +${ISLE.ringBolts} 🔩`);
  }
  updateShrine(dt, p, play) {
    const S = this.shrine, g = this.g; if (S.cd > 0) S.cd -= dt;
    const ready = S.cd <= 0; this.padMat.emissiveIntensity = ready ? 1.0 + Math.sin(this.t * 3) * 0.35 : 0.25; this.crystalMat.emissiveIntensity = ready ? 1.4 : 0.5;
    this.arch.position.y = S.y + 0.3 + Math.sin(this.t * 1.6) * 0.15;
    const onPad = play && this.near(p, S.x, S.z, S.r); if (!onPad) S.armed = true;
    if (onPad && ready && S.armed !== false) { S.armed = false; this.surge(p); }
    if (this.surgeT > 0 && p && p.alive) { this.surgeT -= dt; p.boostE = p.st.boost; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.08 * dt); p.shieldT = Math.max(p.shieldT || 0, Math.min(0.3, this.surgeT));
      if (g.fx) for (let i = 0; i < g.fx.n(2); i++) { const a = Math.random() * 6.28, rr = p.radius * (0.8 + Math.random() * 0.5); g.fx.glow.spawn({ pos: { x: p.pos.x + Math.cos(a) * rr, y: p.pos.y + Math.random() * p.mech.height, z: p.pos.z + Math.sin(a) * rr }, vel: { x: 0, y: 2.5, z: 0 }, size: 0.7, size1: 0.1, life: 0.7, r: 0.3, g: 2.4, b: 2.2, alpha: 1 }); }
      if (this.surgeT <= 0) this.hud('⚡ Surge over. The shrine is recharging…'); }
  }
  surge(p) {
    const g = this.g, S = this.shrine; S.cd = ISLE.shrineCD; this.surgeT = ISLE.surge; this.n.surges++;
    p.hp = p.maxHp; p.boostE = p.st.boost; if (g.addBolts) g.addBolts(ISLE.shrineBolts);
    this.big('⚡ DINO POWER SURGE! ⚡', 3); sfx.power && sfx.power(); sfx.beam && sfx.beam(); voice.say('Dino power surge!', { prio: 2, cd: 2000 });
    if (g.fx) { g.fx.ring(V(S.x, S.y + 0.4, S.z), 12, 0x3affd8); g.fx.ring(V(S.x, S.y + 0.4, S.z), 20, 0xffffff); g.fx.sparks(p.center ? p.center.clone() : p.pos.clone(), 40, { r: 0.3, g: 1, b: 0.95 }, 1.8); }
    this.hud(`⚡ Full heal + boost for ${ISLE.surge}s! +${ISLE.shrineBolts} 🔩`);
    if (g.expedition && g.expedition.onShrine) g.expedition.onShrine();
  }
  updateBeacon(dt, p, play) {
    const B = this.beacon, g = this.g; if (B.cd > 0) B.cd -= dt; const ready = B.cd <= 0 && !this.rally;
    this.bRingMat.color.setRGB(ready ? 1.1 + Math.sin(this.t * 4) * 0.4 : 0.3, ready ? 0.8 + Math.sin(this.t * 4) * 0.3 : 0.25, ready ? 1.9 : 0.5); this.bRing.rotation.y += dt * 0.6;
    if (this.beamT > 0) { this.beamT -= dt; const k = this.beamT / 2.6; this.beam.material.opacity = 0.32 * k; this.beam.scale.set(1 + (1 - k) * 1.2, 1, 1 + (1 - k) * 1.2); this.beam.visible = this.beamT > 0; }
    const onRing = play && this.near(p, B.x, B.z, B.r); if (!onRing) B.armed = true;
    if (onRing && ready && B.armed !== false) { B.armed = false; this.startRally(p); }
    const R = this.rally; if (!R) return;
    R.t += dt; const f = R.foe;
    if (f && f.alive && g.fx && Math.random() < dt * 2.5) g.fx.ring(f.pos.clone(), f.radius * 2 + 2, 0xffd24a);
    if (f && !f.alive && !R.won) this.rally = null; // KO'd by something else: just end quietly
    else if (!f || g.enemies.indexOf(f) < 0 || R.t > 150) { if (!R.won && this.on) this.hud('🏁 The Rally Challenger ran off. Try the beacon again!'); this.rally = null; }
  }
  startRally(p) {
    const g = this.g, B = this.beacon, W = this.W; B.cd = ISLE.rallyCD; this.n.rallies++; this.beamT = 2.6; this.beam.visible = true;
    sfx.beam && sfx.beam(); sfx.power && sfx.power(); if (g.fx) { g.fx.ring(V(B.x, B.y + 0.5, B.z), 14, 0xb48cff); g.fx.ring(V(B.x, B.y + 0.5, B.z), 26, 0xffffff); }
    // pick an open, dry direction away from the base, then drop 5 bonus cores leading to the challenger
    let dir = null; const base = Math.atan2(VOLC.z - B.z, VOLC.x - B.x);
    for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) { const a = base + da, ok = [14, 28, 42, 56, 70, 86].every(d => { const h = W.height(B.x + Math.cos(a) * d, B.z + Math.sin(a) * d); return h > 1.3 && h < 45; }); if (ok) { dir = a; break; } }
    if (dir === null) dir = base; const cx = Math.cos(dir), cz = Math.sin(dir);
    for (let i = 0; i < ISLE.rallyCores; i++) { const d = 14 + i * 13, x = B.x + cx * d, z = B.z + cz * d; g.pickups.push({ type: 'core', x, z, y: W.height(x, z), alive: true, t: 0, ph: i, once: true, rally: true }); }
    const fx = B.x + cx * 86, fz = B.z + cz * 86; let foe = null;
    try { foe = g.spawnEnemy(fx, fz, 3, g.robos === false ? 'trex' : 'rex'); } catch (e) { foe = null; }
    if (foe) { foe.rally = true; foe.maxHp = foe.hp = Math.round(foe.maxHp * 1.4); foe.yaw = dir + Math.PI; }
    this.rally = { foe, t: 0, won: false };
    this.big('🏁 JUNGLE DINO RALLY! 🏁', 2); this.hud('⚡ Follow the 5 glowing cores to the Rally Challenger!'); voice.say('Jungle dino rally!', { prio: 2, cd: 2000 });
    if (g.expedition && g.expedition.onRally) g.expedition.onRally();
  }
  onKO(d, attacker) {
    const g = this.g; if (!this.on || d === g.player) return;
    if (d.rally && this.rally && this.rally.foe === d) { d.rally = false; this.rally.won = true; this.n.rallyWins++; if (g.addBolts) g.addBolts(ISLE.rallyBolts); g.dropBolts && g.dropBolts(d.pos, 12);
      g.later(0.9, () => { this.big('🏆 DINO RALLY VICTORY! +40 🔩', 4); sfx.tada && sfx.tada(1); voice.say('Dino rally victory!', { prio: 3, cd: 2000 }); }); this.rally = null; }
    if (attacker === g.player && g.expedition && g.expedition.onWildKO) g.expedition.onWildKO();
  }
  radar() {
    const out = []; for (const r of this.rings) if (r.alive) out.push({ x: r.x, z: r.z, c: '#ff8a1a', r: 4.5 });
    if (this.shrine.cd <= 0) out.push({ x: this.shrine.x, z: this.shrine.z, c: '#3affd8', r: 6 });
    if (this.beacon.cd <= 0 && !this.rally) out.push({ x: this.beacon.x, z: this.beacon.z, c: '#c69cff', r: 5 });
    return out;
  }
  stats() { return { ...this.n, ringsLeft: this.rings.filter(r => r.alive).length, ringDone: this.ringDone, resetT: this.resetT, surgeT: this.surgeT, shrineCD: this.shrine.cd, beaconCD: this.beacon.cd, rally: !!this.rally, rallyCores: this.g.pickups.filter(k => k.rally && k.alive).length }; }
}
