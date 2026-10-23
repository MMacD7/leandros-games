// Mayhem: fire, burning, explosive props with chain reactions, volcano eruptions + lava bombs + lava rivers,
// battle power-ups (meteor storm / air strike), combo + KO streaks, boss waves and the end-of-battle celebration.
import * as THREE from './vendor/three.bundle.min.js';
import { ARENA, BASE, VOLC } from './world.js';
import { sfx } from './audio.js';
import { rng, clamp } from './noise.js';

const TYPES = { barrel: { hp: 12, power: 1.0, r: 0.8, h: 1.9 }, fuel: { hp: 22, power: 1.7, r: 1.35, h: 3.4 }, crate: { hp: 9, power: 0.8, r: 1.0, h: 1.8 } };
const G = new THREE.Vector3(0, -22, 0), V = new THREE.Vector3(), V2 = new THREE.Vector3();
const TITLE = { x: 16, z: 181 };

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function flameIcon(g, x, y, s, col = '#111') {
  g.save(); g.translate(x, y); g.fillStyle = '#ffcc1a'; g.strokeStyle = '#111'; g.lineWidth = s * 0.08;
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s, 0); g.lineTo(0, s); g.lineTo(-s, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = col; g.beginPath(); g.moveTo(0, -s * 0.62); g.bezierCurveTo(s * 0.45, -s * 0.15, s * 0.4, s * 0.45, 0, s * 0.5); g.bezierCurveTo(-s * 0.4, s * 0.45, -s * 0.42, -s * 0.05, -s * 0.12, -s * 0.25);
  g.bezierCurveTo(-s * 0.1, 0, 0, s * 0.05, 0.02, -s * 0.62); g.fill(); g.restore();
}
function hazard(g, y, h, w) { g.fillStyle = '#ffc21a'; g.fillRect(0, y, w, h); g.fillStyle = '#151515'; for (let x = -h; x < w + h; x += h * 1.4) { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + h * 0.7, y + h); g.lineTo(x + h * 1.4, y); g.lineTo(x + h * 0.7, y); g.fill(); } }

export class Mayhem {
  constructor(game) {
    this.g = game; this.scene = game.scene; this.world = game.world; this.fx = game.fx;
    this.items = []; this.fires = []; this.falls = []; this.powerups = []; this.jets = [];
    this.volc = { t: 35, on: 0, bombT: 0, n: 0, glow: 0 };
    this.combo = { n: 0, t: 0, best: 0 }; this.streak = { n: 0, t: 0 }; this.titleBoomT = 2; this.puT = 8; this.puKind = 0;
    this.stats = { explosions: 0, chain: 0, bombs: 0, ignites: 0, meteors: 0 };
    this.buildProps(); this.buildLava(); this.buildFallMeshes();
  }
  near(pos, R = 160) { const c = this.g.camera.position; return clamp(1 - Math.hypot(pos.x - c.x, pos.z - c.z) / R, 0, 1); }
  dinos() { const p = this.g.player; return p ? [p, ...this.g.enemies] : this.g.enemies; }

  // ---------- explosive props ----------
  buildProps() {
    const barrelT = canvasTex(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#8e140c'); gr.addColorStop(0.5, '#d42a18'); gr.addColorStop(1, '#8e140c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,.35)'; for (const y of [10, 118, 240]) g.fillRect(0, y, w, 6); hazard(g, 28, 22, w); hazard(g, 206, 22, w); flameIcon(g, w * 0.25, 128, 48); flameIcon(g, w * 0.75, 128, 48); });
    const fuelT = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#d8d2c4'; g.fillRect(0, 0, w, h); g.fillStyle = '#e0541a'; g.fillRect(0, 96, w, 64); g.fillStyle = '#222'; g.font = 'bold 48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('FUEL', w * 0.25, 128); g.fillText('FUEL', w * 0.75, 128); flameIcon(g, w * 0.5, 50, 34); flameIcon(g, 0, 50, 34); flameIcon(g, w, 50, 34); g.fillStyle = 'rgba(80,60,40,.25)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 20, 2); });
    const crateT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#9a6a35'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5a3a18'; g.lineWidth = 4; for (let y = 0; y < h; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#6a4520'; g.fillRect(0, 0, w, 22); g.fillRect(0, h - 22, w, 22); g.fillRect(0, 0, 22, h); g.fillRect(w - 22, 0, 22, h); flameIcon(g, w / 2, h / 2, 62); });
    const cap = new THREE.MeshStandardMaterial({ color: 0x5a1410, metalness: 0.6, roughness: 0.45 });
    const mk = (geo, tex, mats, n) => { const m = new THREE.InstancedMesh(geo, mats || new THREE.MeshStandardMaterial({ map: tex, metalness: 0.35, roughness: 0.55 }), n); m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.scene.add(m); return m; };
    this.mesh = {
      barrel: mk(new THREE.CylinderGeometry(0.75, 0.75, 1.9, 16), null, [new THREE.MeshStandardMaterial({ map: barrelT, metalness: 0.4, roughness: 0.5 }), cap, cap], 160),
      fuel: mk(new THREE.CylinderGeometry(1.3, 1.3, 3.4, 18), null, [new THREE.MeshStandardMaterial({ map: fuelT, metalness: 0.5, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0xbab4a8, metalness: 0.6, roughness: 0.4 }), cap], 40),
      crate: mk(new THREE.BoxGeometry(1.8, 1.8, 1.8), crateT, null, 80),
    };
    const W = this.world, ok = (x, z, r) => { const h = W.height(x, z); if (h < 1.2 || h > 38 || W.normalAtY(x, z) < 0.93) return false;
      for (const c of W.colliders) if ((c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + r + 1.5) ** 2) return false; for (const it of this.items) if ((it.x - x) ** 2 + (it.z - z) ** 2 < (it.r + r + 0.4) ** 2) return false; return true; };
    const add = (type, x, z, zone) => { const T = TYPES[type]; if (!ok(x, z, T.r)) return false; this.items.push({ type, x, z, y: W.height(x, z), r: T.r, h: T.h, hp: T.hp, alive: true, t: 0, zone, rot: Math.random() * 6 }); return true; };
    const cluster = (cx, cz, zone, r, big) => { if (big && r() < 0.6) add('fuel', cx, cz, zone); const n = 2 + (r() * 3 | 0);
      for (let i = 0; i < n; i++) { const a = r() * 6.28, d = 2 + r() * 3; add(r() < 0.7 ? 'barrel' : 'crate', cx + Math.cos(a) * d, cz + Math.sin(a) * d, zone); } };
    const r = rng(4242);
    // arena: clusters around the fighting floor (kept off the player start line and the enemy spawn)
    for (const [a, d] of [[0.9, 22], [2.2, 24], [4.0, 23], [5.3, 21], [1.57, 11], [4.7, 12], [2.75, 30], [3.55, 30]]) cluster(ARENA.x + Math.cos(a) * d, ARENA.z + Math.sin(a) * d, 'arena', r, d > 15);
    // island: scattered depots
    for (let i = 0, n = 0; i < 200 && n < 24; i++) { const a = r() * 6.28, d = 40 + r() * 250, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.hypot(x - BASE.x, z - BASE.z) < 45 || Math.hypot(x - ARENA.x, z - ARENA.z) < 45 || Math.hypot(x - VOLC.x, z - VOLC.z) < 50 || Math.hypot(x - TITLE.x, z - TITLE.z) < 28) continue;
      if (!ok(x, z, 1.4)) continue; cluster(x, z, 'island', r, true); n++; }
    this.dirty = true;
  }
  syncProps() {
    if (!this.dirty) return; this.dirty = false; const n = { barrel: 0, fuel: 0, crate: 0 }, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    for (const it of this.items) { if (!it.alive) continue; q.setFromAxisAngle(V.set(0, 1, 0), it.rot); m4.compose(V2.set(it.x, it.y + it.h / 2 - 0.05, it.z), q, s); this.mesh[it.type].setMatrixAt(n[it.type]++, m4); }
    for (const k in n) { this.mesh[k].count = n[k]; this.mesh[k].instanceMatrix.needsUpdate = true; }
  }
  resetArena() { for (const it of this.items) if (it.zone === 'arena') { it.alive = true; it.hp = TYPES[it.type].hp; } this.dirty = true; for (const p of this.powerups) this.scene.remove(p.m); this.powerups = []; this.puT = 7; }
  damageItem(it, dmg, by) { if (!it.alive) return; it.hp -= dmg; if (it.hp <= 0) this.explodeItem(it, by); else if (Math.random() < 0.5) this.fx.sparks(V.set(it.x, it.y + it.h * 0.6, it.z), 5, { r: 1, g: 0.7, b: 0.3 }, 0.6); }
  damageAt(pos, R, dmg, by) { for (const it of this.items) { if (!it.alive) continue; const d = Math.hypot(it.x - pos.x, it.z - pos.z) - it.r; if (d < R && Math.abs(it.y + it.h / 2 - pos.y) < R + it.h) this.damageItem(it, dmg, by); } }
  hitSegment(a, b, dmg, by) {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-6;
    for (const it of this.items) { if (!it.alive) continue; const t = clamp(((it.x - a.x) * dx + (it.z - a.z) * dz) / L2, 0, 1), px = a.x + dx * t, pz = a.z + dz * t, py = a.y + (b.y - a.y) * t;
      if ((px - it.x) ** 2 + (pz - it.z) ** 2 < (it.r + 0.3) ** 2 && py > it.y - 0.3 && py < it.y + it.h + 0.3) { this.damageItem(it, dmg, by); return it; } }
    return null;
  }
  explodeItem(it, by) {
    it.alive = false; it.t = it.zone === 'arena' ? 22 : 45; this.dirty = true; const T = TYPES[it.type], P = T.power;
    const c = new THREE.Vector3(it.x, it.y + it.h * 0.5, it.z);
    this.blast(c, P, { by, dmg: 42 * P, R: 8 * P + 2, groundY: it.y, item: it });
    if (it.type === 'fuel') { const base = c.clone(); this.fx.emit(1.1, (dt, t) => { for (let i = 0; i < this.fx.n(3); i++) this.fx.fire.spawn({ pos: { x: base.x + (Math.random() - 0.5) * 2, y: base.y + t * 14, z: base.z + (Math.random() - 0.5) * 2 }, vel: { x: (Math.random() - 0.5) * 4, y: 14, z: (Math.random() - 0.5) * 4 }, size: 4, size1: 9, life: 0.8, r: 1.9, g: 0.55, b: 0.1, alpha: 0.5, drag: 1, rv: 2 }); }); }
    if (it.type === 'crate') for (let i = 0; i < this.fx.n(5); i++) this.fx.chunk(c, { x: (Math.random() - 0.5) * 18, y: 8 + Math.random() * 10, z: (Math.random() - 0.5) * 18 }, 0.5);
    // chain reaction: neighbours go up a moment later
    for (const o of this.items) { if (!o.alive || o === it) continue; const d = Math.hypot(o.x - it.x, o.z - it.z); if (d < 7 * P + o.r + 1.5) { this.stats.chain++; this.g.later(0.1 + d * 0.035 + Math.random() * 0.12, () => this.damageItem(o, 99, by)); } }
  }
  // generic explosion: visuals + sound + area damage + ignition + burning ground + prop chain
  blast(pos, P, o = {}) {
    this.stats.explosions++; const near = this.near(pos, 170), by = o.by || null, R = o.R ?? 8 * P + 2;
    this.fx.boom(pos, P, { groundY: o.groundY ?? this.world.height(pos.x, pos.z), shake: 0.2 + near * 0.8 });
    if (near > 0) { if (P > 1.3) sfx.bigBoom(0.4 + near * 0.8); else sfx.boom(0.3 + near * 0.9); }
    const dmg = o.dmg ?? 40 * P;
    if (!this.safe) for (const d of this.dinos()) { if (!d.alive) continue; if (o.only && !o.only(d)) continue; const dist = Math.hypot(d.pos.x - pos.x, d.pos.z - pos.z) - d.radius;
      if (dist > R || Math.abs(d.pos.y + d.mech.height * 0.5 - pos.y) > R + d.mech.height) continue;
      const isP = d === this.g.player, own = by === this.g.player; let k = (isP ? (own ? 0.3 : 0.6) : 1) * (o.playerScale !== undefined && isP ? o.playerScale : 1); if (by && d === by) k = isP ? 0.15 : 0.4;
      if (k <= 0) continue; const f = 1 - clamp(dist / R, 0, 1) * 0.6;
      d.hit(dmg * f * k, pos, by); V.subVectors(d.pos, pos).setY(0).normalize(); d.knock.addScaledVector(V, (d.boss ? 3 : 14) * f); this.ignite(d, 1.5 + P, by); }
    if (!o.item) this.damageAt(pos, R * 0.8, 99, by); else this.damageAt(pos, 0, 0, by);
    const gy = o.groundY ?? this.world.height(pos.x, pos.z); if (gy > -0.5 && o.fire !== false) this.addFire(V2.set(pos.x, gy, pos.z), 1.6 + P * 1.1, 4 + P * 2.5, by);
  }

  // ---------- fire ----------
  ignite(d, t, by) { if (!d || !d.alive || d.shieldT > 0 || (d.ground !== undefined && d.ground < -0.8 && !d.fly)) return; if (!(d.burnT > 0)) { this.stats.ignites++; if (this.near(d.pos, 80) > 0) sfx.ignite(); } d.burnT = Math.max(d.burnT || 0, t); d.burnBy = by; d.burnTick = d.burnTick || 0.3; }
  addFire(pos, r, dur, by) { const cap = Math.round(5 + 12 * this.fx.k); if (this.fires.length >= cap) this.fires.shift(); this.fires.push({ x: pos.x, y: pos.y, z: pos.z, r, dur, t: 0, by, tick: 0.4 }); }
  updateFire(dt) {
    const fx = this.fx, cp = this.g.camera.position, lvl = this.g.save.up.fire || 0;
    for (let i = this.fires.length - 1; i >= 0; i--) { const F = this.fires[i]; F.t += dt; if (F.t > F.dur) { this.fires.splice(i, 1); continue; }
      const f = F.t > F.dur - 1.5 ? (F.dur - F.t) / 1.5 : Math.min(1, F.t * 4);
      if (Math.hypot(F.x - cp.x, F.z - cp.z) < 150) { const n = Math.ceil(F.r / 1.4); V.set(F.x, F.y, F.z); for (let k = 0; k < n; k++) fx.burn(V, F.r * f, 1.4 * f, 1.3); }
      F.tick -= dt; if (F.tick <= 0 && !this.safe) { F.tick = 0.45; for (const d of this.dinos()) { if (!d.alive || (d.fly && d.alt > 3)) continue; if ((d.pos.x - F.x) ** 2 + (d.pos.z - F.z) ** 2 < (F.r + d.radius * 0.6) ** 2) { const isP = d === this.g.player; d.hit(isP ? 2 : 4, null, F.by, true); this.ignite(d, 1.2, F.by); } } } }
    // burning dinos
    for (const d of this.dinos()) { if (!(d.burnT > 0)) continue; if (!d.alive) { d.burnT = 0; continue; }
      d.burnT -= dt; const h = d.mech.height, s = d.def.scale;
      if (d.ground < -0.8 && !d.fly) { d.burnT = 0; fx.smoke.spawn({ pos: d.center.clone(), vel: { x: 0, y: 5, z: 0 }, size: 2, size1: 7, life: 1.2, r: 0.85, g: 0.88, b: 0.9, alpha: 0.6 }); continue; }
      if (Math.hypot(d.pos.x - cp.x, d.pos.z - cp.z) < 120) { V.set(d.pos.x, d.pos.y + h * 0.25, d.pos.z); fx.burn(V, d.radius * 0.7, h * 0.75, 1.6 * s + 0.5); fx.burn(V, d.radius * 0.5, h * 0.6, 1); }
      d.burnTick -= dt; if (d.burnTick <= 0 && !this.safe) { d.burnTick = 0.35; const isP = d === this.g.player; const dps = isP ? 3 : (d.burnBy === this.g.player ? 7 + 2.5 * lvl : 5); d.hit(dps * 0.35, null, d.burnBy, true); } }
  }
  // Robo-Rex fire breath (player + wild)
  startBreath(d, dur = 1.25) { d.breathT = dur; d.breathTick = 0; d.breathSfx = 0; d.breathFire = 0.25; sfx.whoosh(0.8); sfx.ignite(); }
  updateBreath(d, dt) {
    if (!(d.breathT > 0)) return; if (!d.alive || d.stunT > 0) { d.breathT = 0; return; }
    d.breathT -= dt; d.jaw = Math.max(d.jaw, 1.3); const g = this.g, isP = d === g.player, lvl = isP ? (g.save.up.fire || 0) : 0, s = d.def.scale;
    const m = g.mouthPos(d), dir = d.forward(new THREE.Vector3()); dir.y = -0.1; const tgt = isP ? g.lock : g.player;
    if (tgt && tgt.alive) { V.copy(tgt.center).sub(m); const L = V.length(); if (L < 22 * s) { V.normalize(); if (V.dot(dir) > 0.75) dir.lerp(V, 0.6); } }
    dir.normalize(); const len = (1 + 0.08 * lvl) * (d.boss ? 1.6 : 1) * Math.max(0.8, s), pw = (1.05 + 0.06 * lvl) * Math.max(0.85, s) * (d.boss ? 1.4 : 1);
    this.fx.flame(m, dir, len, pw); if (isP) this.fx.shake = Math.max(this.fx.shake, 0.18);
    d.breathSfx -= dt; if (d.breathSfx <= 0) { d.breathSfx = 0.12; const v = isP ? 1 : this.near(d.pos, 90) * 0.6; if (v > 0.02) sfx.flame(v); }
    d.breathTick -= dt; if (d.breathTick <= 0 && !this.safe) { d.breathTick = 0.25; const R = 15 * len + 2;
      const dps = isP ? 34 * (1 + 0.15 * lvl) : (d.boss ? 22 : 9 + d.level * 2);
      for (const e of g.foesOf(d)) { if (!e || !e.alive) continue; V.copy(e.center).sub(m); const L = V.length() - e.radius; if (L > R) continue; V.normalize(); if (V.dot(dir) < 0.78 && L > 2) continue;
        e.hit(dps * 0.25, d.pos, d); this.ignite(e, 2 + 0.5 * lvl, d); }
      for (const it of this.items) { if (!it.alive) continue; V.set(it.x - m.x, it.y + it.h / 2 - m.y, it.z - m.z); const L = V.length(); if (L < R && V.normalize().dot(dir) > 0.75) this.damageItem(it, 5, d); } }
    d.breathFire -= dt; if (d.breathFire <= 0) { d.breathFire = 0.4; const e = m.clone().addScaledVector(dir, 9 * len); const gy = this.world.height(e.x, e.z); if (gy > -0.5 && e.y - gy < 4) this.addFire(V2.set(e.x, gy, e.z), 1.5, 2.5, d); }
  }
  // fiery roar for the real dinos: a gout of flame with the roar (damages + ignites once Fire Power is upgraded)
  fieryRoar(d, dmgOn) {
    const g = this.g, s = d.def.scale, isP = d === g.player, lvl = isP ? (g.save.up.fire || 0) : 0;
    if (!isP && this.near(d.pos, 120) <= 0) return;
    this.fx.emit(0.65, () => { if (!d.alive && g.player !== d) return; const m = g.mouthPos(d), dir = d.forward(new THREE.Vector3()); dir.y = -0.05; dir.normalize(); this.fx.flame(m, dir, (0.8 + 0.07 * lvl) * Math.max(0.7, s), (0.9 + 0.08 * lvl) * Math.max(0.7, s)); });
    if (dmgOn && lvl > 0) { const fwd = d.forward(new THREE.Vector3());
      for (const e of g.foesOf(d)) { if (!e || !e.alive) continue; V.subVectors(e.pos, d.pos); const L = V.length(); V.y = 0; V.normalize(); if (L < 16 * s + 6 && V.dot(fwd) > 0.5) { e.hit(6 + 5 * lvl, d.pos, d); this.ignite(e, 1.5 + 0.4 * lvl, d); } }
      this.damageAt(this.g.mouthPos(d).addScaledVector(fwd, 6), 8 * s, 4 + 3 * lvl, d); }
  }

  // ---------- falling things: lava bombs, meteors, air-strike bombs ----------
  buildFallMeshes() {
    this.lavaMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.75, 0.15), toneMapped: false });
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x2a1a14, emissive: 0xff4a10, emissiveIntensity: 1.2, roughness: 0.9 });
    this.bombMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.7, roughness: 0.35 });
    this.fallGeo = new THREE.IcosahedronGeometry(1, 1); this.bombGeo = new THREE.CapsuleGeometry(0.35, 1.2, 3, 8);
  }
  launch(kind, from, to, T, o = {}) {
    if (this.falls.length >= 24) return null;
    const vel = kind === 'lava' ? new THREE.Vector3().subVectors(to, from).addScaledVector(G, -0.5 * T * T).divideScalar(T) : new THREE.Vector3().subVectors(to, from).divideScalar(T);
    const m = new THREE.Mesh(kind === 'bomb' ? this.bombGeo : this.fallGeo, kind === 'lava' ? this.lavaMat : kind === 'meteor' ? this.rockMat : this.bombMat); m.scale.setScalar(o.size || 1); m.position.copy(from); this.scene.add(m);
    const gy = this.world.height(to.x, to.z), warn = gy > -1 && o.warn !== false ? this.fx.warn(new THREE.Vector3(to.x, gy, to.z), o.R || 6, T) : null;
    const F = { ...o, kind, from: from.clone(), vel, T, t: 0, to: to.clone(), m, warn, gy }; this.falls.push(F); return F;
  }
  updateFalls(dt) {
    const cp = this.g.camera.position;
    for (let i = this.falls.length - 1; i >= 0; i--) { const F = this.falls[i]; F.t += dt; const t = Math.min(F.t, F.T);
      const p = F.m.position.copy(F.from).addScaledVector(F.vel, t); if (F.kind === 'lava') p.addScaledVector(G, 0.5 * t * t);
      if (F.kind === 'bomb') F.m.lookAt(p.x + F.vel.x, p.y + F.vel.y - 9, p.z + F.vel.z); else F.m.rotation.set(F.t * 3, F.t * 2, 0);
      if (Math.hypot(p.x - cp.x, p.z - cp.z) < 260) this.fx.trail(p, (F.size || 1) * (F.kind === 'bomb' ? 0.5 : 1), F.kind === 'meteor' ? 1.2 : 1);
      if (F.t >= F.T) { this.falls.splice(i, 1); this.scene.remove(F.m); if (F.warn) F.warn.dead = true; F.onHit ? F.onHit(F) : this.impact(F); } }
  }
  impact(F) {
    const p = F.to; if (F.gy < -1) { // into the sea: steam splash
      for (let i = 0; i < this.fx.n(14); i++) this.fx.smoke.spawn({ pos: { x: p.x, y: 0.2, z: p.z }, vel: { x: (Math.random() - 0.5) * 8, y: 6 + Math.random() * 8, z: (Math.random() - 0.5) * 8 }, size: 2, size1: 8, life: 1.6, r: 0.9, g: 0.92, b: 0.95, alpha: 0.7, drag: 1 });
      this.fx.ring(V.set(p.x, 0.15, p.z), 8, 0xcfefff); if (this.near(p, 150) > 0) sfx.whoosh(0.6); return; }
    p.y = F.gy + 1; this.blast(p, F.P || 1, { by: F.by || null, dmg: F.dmg ?? 30, R: F.R || 6, groundY: F.gy, only: F.only, playerScale: F.playerScale });
  }

  // ---------- volcano ----------
  buildLava() {
    const W = this.world, tex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#ff6a10'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { const x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * 22; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(40,8,4,.95)'); gr.addColorStop(0.7, 'rgba(60,12,4,.6)'); gr.addColorStop(1, 'rgba(60,12,4,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,220,90,.85)'; g.lineWidth = 3; for (let i = 0; i < 30; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 50; y += Math.random() * 40; g.lineTo(x, y); } g.stroke(); } });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; this.lavaTex = tex;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.9, 1.25, 1.0), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.lavaPts = []; const pos = [], uv = [], idx = []; const r = rng(31);
    for (let f = 0; f < 6; f++) {
      const a0 = f / 6 * Math.PI * 2 + r() * 0.6; let x = VOLC.x + Math.cos(a0) * 25, z = VOLC.z + Math.sin(a0) * 25; const pts = [];
      for (let i = 0; i < 90; i++) { const h = W.height(x, z); pts.push([x, z]); if (h < 4) break; const e = 2, gx = W.height(x + e, z) - W.height(x - e, z), gz = W.height(x, z + e) - W.height(x, z - e), gl = Math.hypot(gx, gz) || 1;
        const rx = x - VOLC.x, rz = z - VOLC.z, rl = Math.hypot(rx, rz) || 1, wob = Math.sin(i * 0.35 + f * 2) * 0.35;
        let dx = -gx / gl * 0.55 + rx / rl * 0.45, dz = -gz / gl * 0.55 + rz / rl * 0.45; const c = Math.cos(wob), s = Math.sin(wob); [dx, dz] = [dx * c - dz * s, dx * s + dz * c]; const dl = Math.hypot(dx, dz) || 1; x += dx / dl * 2.6; z += dz / dl * 2.6; }
      if (pts.length < 8) continue; let vAcc = 0; const base = pos.length / 3;
      for (let i = 0; i < pts.length; i++) { const [px, pz] = pts[i], [qx, qz] = pts[Math.min(pts.length - 1, i + 1)], [ox, oz] = pts[Math.max(0, i - 1)]; let tx = qx - ox, tz = qz - oz; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const w = (4.8 - 2.6 * i / pts.length) * (0.85 + 0.3 * Math.sin(i * 0.7 + f)); if (i) vAcc += Math.hypot(px - ox, pz - oz);
        for (const sd of [-1, 1]) { const vx = px - tz * w * sd, vz = pz + tx * w * sd; pos.push(vx, W.height(vx, vz) + 0.35, vz); uv.push(sd < 0 ? 0 : 1, vAcc / 9); }
        if (i) { const k = base + i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } this.lavaPts.push([px, W.height(px, pz), pz, w * 0.8]); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingSphere();
    this.lavaMesh = new THREE.Mesh(geo, mat); this.lavaMesh.renderOrder = 1; this.scene.add(this.lavaMesh);
    // soft glow halos along the rivers
    const gm = new THREE.SpriteMaterial({ map: this.g.assets.glow, color: 0xff5a18, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
    this.lavaGlows = []; for (let i = 0; i < this.lavaPts.length; i += 7) { const [x, y, z, w] = this.lavaPts[i]; const s = new THREE.Sprite(gm); s.position.set(x, y + 2, z); s.scale.set(w * 5, w * 3, 1); this.scene.add(s); this.lavaGlows.push(s); }
  }
  erupt(title) {
    const Vc = this.volc; Vc.on = title ? 9 : 11; Vc.n++; Vc.t = title ? 22 + Math.random() * 10 : 55 + Math.random() * 30; Vc.bombT = 0.5;
    const c = new THREE.Vector3(VOLC.x, this.world.craterY + 4, VOLC.z), near = this.near(c, 420);
    this.fx.boom(c, 2.6, { ground: false, shake: 0.15 + near * 0.5 }); sfx.rumble(3.5, 0.4 + near * 0.8); sfx.bigBoom(0.3 + near * 0.7);
    const p = this.g.player; if (!title && p && Math.hypot(p.pos.x - VOLC.x, p.pos.z - VOLC.z) < 300) this.g.hud.toast('🌋 VOLCANO ERUPTING! Dodge the red circles!');
  }
  updateVolcano(dt, title) {
    const Vc = this.volc, W = this.world, fx = this.fx, cp = this.g.camera.position;
    this.lavaTex.offset.y -= dt * 0.22; const pulse = 0.5 + 0.15 * Math.sin(W.time * 3.1);
    for (const s of this.lavaGlows) s.material.opacity = pulse + Vc.glow * 0.3;
    if (Vc.on > 0) { Vc.on -= dt; Vc.glow = Math.min(1, Vc.glow + dt * 2);
      const c = { x: VOLC.x, y: W.craterY + 2, z: VOLC.z };
      const big = Math.hypot(cp.x - VOLC.x, cp.z - VOLC.z) > 220 ? 1.7 : 1;
      for (let i = 0; i < fx.n(5); i++) { const a = Math.random() * 6.28, sp = Math.random() * 9 * big; fx.fire.spawn({ pos: c, vel: { x: Math.cos(a) * sp, y: (26 + Math.random() * 24) * big, z: Math.sin(a) * sp }, size: 6 * big, size1: 15 * big, life: 1.3 + Math.random() * 0.6, r: 3.2, g: 1 + Math.random() * 0.8, b: 0.2, alpha: 1, grav: 14, drag: 0.4, rv: 1.5 }); }
      for (let i = 0; i < fx.n(4); i++) { const a = Math.random() * 6.28, sp = 5 + Math.random() * 14; fx.glow.spawn({ pos: c, vel: { x: Math.cos(a) * sp, y: 25 + Math.random() * 30, z: Math.sin(a) * sp }, size: 0.9, size1: 0.3, life: 2.6, r: 3, g: 1.3, b: 0.3, alpha: 1, grav: 18, len: 0.6 }); }
      if (Math.random() < 0.7 * fx.k) { const g = 0.06 + Math.random() * 0.06; fx.smoke.spawn({ pos: { x: c.x + (Math.random() - 0.5) * 12, y: c.y + 6, z: c.z + (Math.random() - 0.5) * 12 }, vel: { x: 2, y: 18 + Math.random() * 8, z: 0 }, size: 22, size1: 90, life: 9, r: g, g, b: g, alpha: 0.9, drag: 0.08, rv: 0.2, fadeIn: 0.05 }); }
      W.lavaGlow.material.opacity = Math.min(0.9, W.lavaGlow.material.opacity + 0.25); W.lavaGlow.scale.set(60 + 25 * Vc.glow, 40 + 30 * Vc.glow, 1);
      Vc.bombT -= dt; if (Vc.bombT <= 0) { Vc.bombT = (title ? 0.35 : 0.45) + Math.random() * 0.45; this.lavaBomb(title); if (Math.random() < 0.4) this.lavaBomb(title); }
    } else { Vc.glow = Math.max(0, Vc.glow - dt * 0.5); W.lavaGlow.scale.set(60 + 25 * Vc.glow, 40 + 30 * Vc.glow, 1); Vc.t -= dt; if (Vc.t <= 0) this.erupt(title); }
    // embers drifting in the air near the volcano
    const dv = Math.hypot(cp.x - VOLC.x, cp.z - VOLC.z);
    if (dv < 200 && Math.random() < dt * (10 + 30 * Vc.glow) * (1 - dv / 200)) fx.embers({ x: cp.x + (VOLC.x - cp.x) * 0.08, y: cp.y + 2, z: cp.z + (VOLC.z - cp.z) * 0.08 }, 40, 2, 2.5);
    // lava rivers hurt
    const p = this.g.player; if (!title && p && p.alive && !(p.fly && p.alt > 3) && Math.hypot(p.pos.x - VOLC.x, p.pos.z - VOLC.z) < 260) { this.lavaTick = (this.lavaTick || 0) - dt;
      if (this.lavaTick <= 0) { this.lavaTick = 0.35; for (const [x, , z, w] of this.lavaPts) if ((p.pos.x - x) ** 2 + (p.pos.z - z) ** 2 < (w + p.radius * 0.4) ** 2) { p.hit(4, null, null, true); this.ignite(p, 1.2, null); break; } } }
  }
  lavaBomb(title) {
    const W = this.world, p = this.g.player, S = new THREE.Vector3(VOLC.x + (Math.random() - 0.5) * 8, W.craterY + 4, VOLC.z + (Math.random() - 0.5) * 8); let tx, tz;
    const pd = p ? Math.hypot(p.pos.x - VOLC.x, p.pos.z - VOLC.z) : 999;
    if (!title && p && p.alive && pd < 190 && Math.random() < 0.55) { const a = Math.random() * 6.28, d = 3 + Math.random() * 10; tx = p.pos.x + Math.cos(a) * d + Math.sin(p.yaw) * p.speedNow * 1.2; tz = p.pos.z + Math.sin(a) * d + Math.cos(p.yaw) * p.speedNow * 1.2; }
    else { const base = title ? Math.atan2(TITLE.z - VOLC.z, TITLE.x - VOLC.x) : Math.random() * 6.28, a = base + (Math.random() - 0.5) * (title ? 1.4 : 6.28), d = 30 + Math.random() * 130; tx = VOLC.x + Math.cos(a) * d; tz = VOLC.z + Math.sin(a) * d; }
    const to = new THREE.Vector3(tx, W.height(tx, tz) + 0.8, tz), T = 2.6 + Math.random() * 1.2 + Math.hypot(tx - S.x, tz - S.z) / 160;
    this.stats.bombs++; this.launch('lava', S, to, T, { size: 1.1 + Math.random() * 0.8, P: 0.95, dmg: 26, R: 6.5, playerScale: 0.55, warn: !title });
  }

  // ---------- battle extras ----------
  updatePowerups(dt) {
    const g = this.g, p = g.player, t = g.world.time;
    if (g.mode !== 'battle' || !g.battle || g.battle.over) return;
    this.puT -= dt; if (this.puT <= 0 && this.powerups.length < 2) { this.puT = 15 + Math.random() * 6; this.spawnPowerup(this.puKind++ % 2 ? 'strike' : 'meteor'); }
    for (let i = this.powerups.length - 1; i >= 0; i--) { const U = this.powerups[i]; U.m.position.y = U.y + 1.8 + Math.sin(t * 2.5) * 0.35; U.icon.rotation.y += dt * 2;
      if (Math.random() < 0.3 * this.fx.k) this.fx.glow.spawn({ pos: { x: U.x + (Math.random() - 0.5) * 2, y: U.y + 0.5, z: U.z + (Math.random() - 0.5) * 2 }, vel: { x: 0, y: 4, z: 0 }, size: 0.5, size1: 0.1, life: 1, r: U.col.r * 3, g: U.col.g * 3, b: U.col.b * 3, alpha: 1 });
      if (p.alive && (p.pos.x - U.x) ** 2 + (p.pos.z - U.z) ** 2 < (p.radius + 2.6) ** 2) { this.scene.remove(U.m); this.powerups.splice(i, 1); this.activate(U.kind); } }
  }
  spawnPowerup(kind) {
    let x = ARENA.x, z = ARENA.z; for (let k = 0; k < 20; k++) { const a = Math.random() * 6.28, d = 6 + Math.random() * 20; x = ARENA.x + Math.cos(a) * d; z = ARENA.z + Math.sin(a) * d; if (!this.items.some(it => it.alive && (it.x - x) ** 2 + (it.z - z) ** 2 < 16)) break; }
    const col = kind === 'meteor' ? new THREE.Color(1, 0.45, 0.1) : new THREE.Color(0.25, 0.8, 1), m = new THREE.Group(), y = this.world.height(x, z);
    const icon = new THREE.Group(); m.add(icon);
    if (kind === 'meteor') { const rock = new THREE.Mesh(this.fallGeo, this.rockMat); rock.scale.setScalar(0.9); icon.add(rock); for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.9, 0.2), toneMapped: false })); f.position.set(0.5, 0.9, 0); f.rotation.z = -0.6 + i * 0.1; f.position.x = 0.3 * (i - 1) + 0.6; icon.add(f); } }
    else { const jm = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x2a88ff, emissiveIntensity: 1, metalness: 0.6, roughness: 0.3 }); const b = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.4, 8), jm); b.rotation.x = Math.PI / 2; icon.add(b); const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.7), jm); w.position.z = -0.2; icon.add(w); const tl = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.4), jm); tl.position.z = -1; icon.add(tl); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 26, 12, 1, true), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.5), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    beam.position.y = 11; m.add(beam); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 6, 32), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = -1.6; m.add(ring);
    m.position.set(x, y + 1.8, z); this.scene.add(m); this.powerups.push({ kind, x, z, y, m, icon, col }); sfx.power(); this.g.hud.toast(kind === 'meteor' ? '☄️ Meteor power-up appeared!' : '✈️ Air-strike power-up appeared!');
  }
  activate(kind) {
    const g = this.g, P = g.player; sfx.power(); g.hud.banner(kind === 'meteor' ? '☄️ METEOR STORM!' : '✈️ AIR STRIKE!', 3); this.fx.ring(P.pos, 10, kind === 'meteor' ? 0xff8030 : 0x40c0ff);
    const foes = () => g.enemies.filter(e => e.alive); const only = d => d !== g.player;
    if (kind === 'meteor') { for (let i = 0; i < 10; i++) g.later(0.2 + i * 0.32, () => { const f = foes(), e = f.length ? f[i % f.length] : null; const a = Math.random() * 6.28, d = e ? Math.random() * 4 : 6 + Math.random() * 18;
      const tx = (e ? e.pos.x : ARENA.x) + Math.cos(a) * d, tz = (e ? e.pos.z : ARENA.z) + Math.sin(a) * d; const to = new THREE.Vector3(tx, g.world.height(tx, tz) + 1, tz);
      this.stats.meteors++; this.launch('meteor', to.clone().add(V.set(-35 + Math.random() * 10, 75, -25 + Math.random() * 10)), to, 1.15, { size: 1.6, P: 1.5, dmg: 60, R: 9, by: g.player, only }); sfx.whistle(0.8); }); }
    else { const f = foes(); let c = f.length ? f.reduce((a, e) => a.add(e.pos), new THREE.Vector3()).divideScalar(f.length) : ARENA.clone(); const ang = Math.random() * 6.28, dx = Math.cos(ang), dz = Math.sin(ang);
      sfx.jet(); this.flyJet(c, dx, dz);
      for (let i = 0; i < 9; i++) { const s = (i - 4) * 5.5, tx = c.x + dx * s, tz = c.z + dz * s, to = new THREE.Vector3(tx, g.world.height(tx, tz) + 0.8, tz);
        g.later(0.55 + i * 0.09, () => this.launch('bomb', to.clone().add(V.set(-dx * 18, 32, -dz * 18)), to, 0.9, { size: 1.2, P: 1.25, dmg: 50, R: 8, by: g.player, only })); } }
  }
  flyJet(c, dx, dz) {
    const jm = new THREE.MeshStandardMaterial({ color: 0x8a96a4, metalness: 0.8, roughness: 0.3 }), m = new THREE.Group();
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.9, 7, 10), jm); b.rotation.x = Math.PI / 2; m.add(b); const w = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 2.4), jm); w.position.z = -0.8; m.add(w); const t = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 1.4), jm); t.position.set(0, 0.9, -3); m.add(t);
    this.scene.add(m); this.jets.push({ m, c: c.clone(), dx, dz, t: 0 });
  }
  updateJets(dt) { for (let i = this.jets.length - 1; i >= 0; i--) { const J = this.jets[i]; J.t += dt; const s = (J.t - 1.0) * 70; J.m.position.set(J.c.x + J.dx * s, J.c.y + 34 + 4 * Math.max(0, J.t - 1.2), J.c.z + J.dz * s); J.m.lookAt(J.m.position.x + J.dx, J.m.position.y + (J.t > 1.2 ? 0.08 : 0), J.m.position.z + J.dz);
    V.copy(J.m.position).addScaledVector(V2.set(J.dx, 0, J.dz), -3.6); this.fx.fire.spawn({ pos: V, vel: { x: -J.dx * 20, y: 0, z: -J.dz * 20 }, size: 1.4, size1: 0.3, life: 0.25, r: 3, g: 1.6, b: 0.6, alpha: 1 }); if (Math.random() < 0.6) this.fx.smoke.spawn({ pos: V, size: 0.8, size1: 3, life: 1.5, r: 0.7, g: 0.7, b: 0.72, alpha: 0.35 });
    if (J.t > 3.2) { this.scene.remove(J.m); this.jets.splice(i, 1); } } }

  // ---------- combo + KO streak ----------
  onHit(d, attacker, quiet) { const g = this.g; if (attacker !== g.player || d === g.player || quiet) return; const C = this.combo; C.n = C.t > 0 ? C.n + 1 : 1; C.t = 2.6; C.best = Math.max(C.best, C.n); g.hud.combo(C.n); }
  onKO(d, attacker) {
    const g = this.g; if (attacker !== g.player || d === g.player) return; const S = this.streak; S.n = S.t > 0 ? S.n + 1 : 1; S.t = 5;
    if (S.n >= 2) { const name = S.n === 2 ? 'DOUBLE KO!' : S.n === 3 ? 'TRIPLE KO!' : S.n === 4 ? 'MEGA KO!' : S.n === 5 ? 'RAMPAGE!' : 'UNSTOPPABLE!'; g.hud.banner(name, Math.min(4, S.n - 1)); sfx.banner(Math.min(4, S.n - 1)); g.addBolts(S.n * 2); this.fx.shake = Math.max(this.fx.shake, 0.6); }
  }
  // ---------- end-of-battle celebration ----------
  celebrate() {
    const g = this.g; g.hud.banner('🏆 BATTLE OVER! 🏆', 4); if (g.hud.victory) g.hud.victory();
    for (let i = 0; i < 12; i++) g.later(0.15 + i * 0.2, () => { const a = Math.random() * 6.28, d = 8 + Math.random() * 22, x = ARENA.x + Math.cos(a) * d, z = ARENA.z + Math.sin(a) * d, gy = g.world.height(x, z);
      if (i % 2 === 0) { this.fx.boom(V.set(x, gy + 1, z), 1.2 + Math.random() * 0.8, { groundY: gy, shake: 0.5 }); sfx.boom(0.7); } this.firework(new THREE.Vector3(x, gy + 22 + Math.random() * 12, z)); });
    for (const it of this.items) if (it.zone === 'arena' && it.alive) g.later(0.4 + Math.random() * 2, () => this.damageItem(it, 99, null));
  }
  firework(p) { const h = Math.random(), c = new THREE.Color().setHSL(h, 1, 0.6); const n = this.fx.n(46);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.28, r = Math.sqrt(1 - u * u), sp = 12 + Math.random() * 4; this.fx.glow.spawn({ pos: p, vel: { x: r * Math.cos(a) * sp, y: u * sp, z: r * Math.sin(a) * sp }, size: 0.5, size1: 0.1, life: 1.4, r: c.r * 3, g: c.g * 3, b: c.b * 3, alpha: 1, grav: 6, drag: 1.2, len: 0.5 }); }
    this.fx.glow.spawn({ pos: p, size: 12, size1: 4, life: 0.3, r: c.r * 2, g: c.g * 2, b: c.b * 2, alpha: 1 }); sfx.banner(1); }

  // ---------- title-screen pyrotechnics ----------
  titleEnter() { this.volc.t = Math.min(this.volc.t, 3); this.titleBoomT = 1.2; }
  updateTitle(dt) {
    this.safe = true; this.updateVolcano(dt, true); this.updateFalls(dt); this.updateFire(dt); this.syncProps();
    const cam = this.g.camera, cp = cam.position; this.titleBoomT -= dt;
    if (this.titleBoomT <= 0) { this.titleBoomT = 3.2 + Math.random() * 1.8; const side = (this.titleSide = -(this.titleSide || 1)), x = TITLE.x + side * (2 + Math.random() * 7), z = TITLE.z - 38 - Math.random() * 14, gy = this.world.height(x, z);
      this.fx.boom(V.set(x, gy + 2.5, z), 2.0, { groundY: gy, shake: 0.35, column: true }); sfx.boom(0.45); this.g.hud.logoBoom && this.g.hud.logoBoom(); }
    if (Math.random() < dt * 14) { const f = cam.getWorldDirection(V2); this.fx.embers({ x: cp.x + f.x * 10, y: cp.y - 1, z: cp.z + f.z * 10 }, 26, 1, 1.6); }
  }
  // ---------- per-frame (play) ----------
  update(dt) {
    const g = this.g; this.safe = false; this.updateVolcano(dt, false); this.updateFalls(dt); this.updateFire(dt); this.updateJets(dt); this.updatePowerups(dt);
    for (const d of this.dinos()) { if (d.breathT > 0) this.updateBreath(d, dt);
      if (d.fly && d.alive && !d.real && Math.random() < 0.7) this.jetTrail(d); }
    // props: respawn + keep dinos from walking through them
    for (const it of this.items) { if (!it.alive) { it.t -= dt; const p = g.player; if (it.t <= 0 && (!p || (p.pos.x - it.x) ** 2 + (p.pos.z - it.z) ** 2 > 30 * 30) && !(it.zone === 'arena' && g.battle && g.battle.over)) { it.alive = true; it.hp = TYPES[it.type].hp; this.dirty = true; } continue; }
      for (const d of this.dinos()) { if (d.fly && d.alt > 3) continue; const dx = d.pos.x - it.x, dz = d.pos.z - it.z, m = it.r + d.radius * 0.55, q = dx * dx + dz * dz; if (q < m * m && q > 1e-6) { const k = Math.sqrt(q); d.pos.x = it.x + dx / k * m; d.pos.z = it.z + dz / k * m; } } }
    this.syncProps();
    if (this.combo.t > 0) { this.combo.t -= dt; if (this.combo.t <= 0) { this.combo.n = 0; g.hud.combo(0); } }
    if (this.streak.t > 0) this.streak.t -= dt;
  }
  jetTrail(d) { const m = d.mech, at = new THREE.Vector3(); if (m.sockets.jet) m.sockets.jet.getWorldPosition(at); else return; const f = d.forward(V2);
    this.fx.fire.spawn({ pos: at, vel: { x: -f.x * 9, y: -2, z: -f.z * 9 }, size: 0.7, size1: 1.8, life: 0.22, r: 3, g: 1.3, b: 0.35, alpha: 0.9, rv: 3 }); }
}
