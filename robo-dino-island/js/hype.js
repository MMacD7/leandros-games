// v5.4 JUNGLE ISLAND HYPE (level one only). Core gameplay is unchanged; this adds the drama on top:
// dramatic dino entrances with a ground-shaking roar, slow-mo finishing KOs with a camera punch-in, combo callouts
// (SMASH! / MEGA! / DINO-MITE!), a mid-level VOLCANO RUMBLE + STAMPEDE surprise with a camera swoop (and a swoop on the
// boss reveal in battles), quicker spawns with shorter lulls, music that builds with the action, meatier hits and roars,
// and hit flashes, stars, bursts, shake and sparkling pickups. All particles go through fx.n() and are throttled for iPads.
import * as THREE from './vendor/three.bundle.min.js';
import { sfx } from './audio.js';
import { music } from './music.js';
import { voice } from './voice.js';
import { VOLC } from './world.js';

const CALLS = [[3, 'SMASH!'], [6, 'MEGA!'], [10, 'DINO-MITE!']];
const $ = id => document.getElementById(id);

export class JungleHype {
  constructor(g) { this.g = g; this.n = { entrances: 0, roars: 0, hits: 0, stars: 0, bursts: 0, callouts: 0, finishers: 0, surprises: 0, swoops: 0, sparkles: 0, musicUps: 0, quickSpawns: 0 };
    this.calls = []; this.reset(); }
  get on() { const g = this.g; return g.level === 'jungle' && !g.farm && !!g.player; }
  reset() { this.combo = 0; this.comboT = 0; this.entT = 0; this.hitSndT = 0; this.ringT = 0; this.surpriseT = 50; this.musicT = 0; this.sparkT = 0; this.playT = 0; this.peakInt = 0;
    const g = this.g; g.swoop = null; g.koCam = null; }
  // ---- dramatic entrances: a ground-shaking roar + dust burst as a wild dino arrives near Leandro
  onSpawn(e) { if (!this.on || e.boss) return; const g = this.g, p = g.player, d = e.pos.distanceTo(p.pos); if (this.entT > 0 || d > 150) return;
    this.entT = 3.2; this.n.entrances++; const k = Math.max(0.25, 1 - d / 160), S = e.def.scale || 1;
    e.roar = 1.6; e.entrance = 1; sfx.bigRoar(Math.max(0.55, 1.1 - S * 0.12), 0.55 + 0.45 * k, !e.real); this.n.roars++;
    if (sfx.rumble) sfx.rumble(1.2, 0.5 * k); g.fx.shake = Math.max(g.fx.shake, 0.9 * k);
    g.fx.dust(e.pos, g.fx.n(26), 3 * S, 8); g.fx.ring(e.pos, 14 * S + 6, 0xffd080); g.fx.ring(e.pos, 22 * S + 8, 0xfff2c0);
    if (d < 110 && (!this._entToast || g.world.time - this._entToast > 9)) { this._entToast = g.world.time; g.hud.toast(`🦖 ${e.def.name.toUpperCase()} STOMPS IN! 🌋`); } }
  // ---- meatier hits: flash, stars, a burst ring, a punchy thump and a little shake; every hit grows the combo
  onHit(d, dmg) { if (!this.on || !d || d === this.g.player) return; const g = this.g, fx = g.fx, c = d.center.clone(); this.n.hits++;
    d.mech.flash = Math.max(d.mech.flash || 0, 0.6); this.combo++; this.comboT = 2.6;
    const ns = fx.n(Math.min(12, 5 + dmg * 0.15)); for (let i = 0; i < ns; i++) { const a = Math.random() * 6.283, s = 4 + Math.random() * 7;
      fx.glow.spawn({ pos: { x: c.x, y: c.y + 0.5, z: c.z }, vel: { x: Math.cos(a) * s, y: 4 + Math.random() * 6, z: Math.sin(a) * s }, size: 0.5, size1: 0.15, life: 0.7 + Math.random() * 0.4, r: 2.2, g: 1.9, b: 0.5, alpha: 1, drag: 2.2, grav: 9, rv: 8 }); }
    this.n.stars += ns; if (this.ringT <= 0) { this.ringT = 0.12; fx.ring(d.pos, 4 + Math.min(10, dmg * 0.15) * (d.def.scale || 1), 0xffe060); this.n.bursts++; }
    if (this.hitSndT <= 0) { this.hitSndT = 0.07; sfx.punch && sfx.punch(Math.min(1, 0.45 + dmg / 45)); }
    fx.shake = Math.max(fx.shake, Math.min(0.55, 0.18 + dmg * 0.008));
    this.checkCall(); }
  checkCall() { const c = this.combo; let txt = null; for (const [k, t] of CALLS) if (c === k) txt = t; if (!txt && c > 10 && (c - 10) % 8 === 0) txt = 'DINO-MITE!'; if (txt) this.callout(txt); }
  callout(txt) { const el = $('callout'); this.n.callouts++; this.calls.push(txt); if (this.calls.length > 30) this.calls.shift(); sfx.callout && sfx.callout(1); voice.say(txt.replace('-', ' '), { prio: 1, cd: 1200, rate: 1.15, pitch: 1.2 });
    if (el) { el.textContent = txt; el.className = ''; void el.offsetWidth; el.className = 'show c' + (txt === 'SMASH!' ? 1 : txt === 'MEGA!' ? 2 : 3); clearTimeout(this._cTO); this._cTO = setTimeout(() => { el.className = ''; }, 1300); } }
  // ---- slow-mo finishing KO with a camera punch-in and a star burst
  onKO(d) { if (!this.on || d === this.g.player) return; const g = this.g, fx = g.fx, c = d.center.clone(); this.n.finishers++;
    g.slowmo = Math.max(g.slowmo, 1.15); g.koCam = { t: 0, dur: 1.25, at: c.clone(), h: Math.max(4, (d.mech.height || 4)) };
    for (let i = 0; i < fx.n(22); i++) { const a = i / 22 * 6.283, s = 10 + Math.random() * 6; fx.glow.spawn({ pos: { x: c.x, y: c.y, z: c.z }, vel: { x: Math.cos(a) * s, y: 3 + Math.random() * 5, z: Math.sin(a) * s }, size: 0.7, size1: 0.2, life: 0.9, r: 2.4, g: 2.0, b: 0.6, alpha: 1, drag: 1.8, grav: 4, rv: 6 }); }
    this.combo += 2; this.comboT = 2.6; sfx.bigBoom && sfx.bigBoom(0.6); this.checkCall(); }
  // ---- the boss shows up in a battle: camera swoop + extra roar
  bossReveal(e) { if (!this.on) return; const g = this.g; g.swoop = { t: 0, dur: 3.0, at: e.pos.clone(), lift: 14 }; this.n.swoops++; sfx.bigRoar(0.5, 1, !e.real); this.n.roars++; g.fx.shake = Math.max(g.fx.shake, 1.2); }
  // ---- mid-level surprise: the volcano rumbles, then a STAMPEDE thunders through (camera swoops to show it)
  surprise() { const g = this.g, p = g.player; if (!p || !p.alive) return false; this.n.surprises++;
    g.hud.banner('🌋 VOLCANO RUMBLE! 🌋', 2); g.hud.say?.('Uh oh! The volcano is rumbling!', { prio: 2 }); sfx.rumble && sfx.rumble(3, 1.2); g.fx.shake = Math.max(g.fx.shake, 1.0);
    const top = new THREE.Vector3(VOLC.x, g.world.height(VOLC.x, VOLC.z) + 6, VOLC.z); g.fx.boom(top, 2.2, { groundY: top.y - 6, shake: 0.6 }); sfx.bigBoom && sfx.bigBoom(0.8);
    for (let i = 0; i < g.fx.n(30); i++) g.fx.smoke.spawn({ pos: { x: top.x + (Math.random() - 0.5) * 8, y: top.y + Math.random() * 4, z: top.z + (Math.random() - 0.5) * 8 }, vel: { x: (Math.random() - 0.5) * 3, y: 8 + Math.random() * 8, z: (Math.random() - 0.5) * 3 }, size: 4, size1: 16, life: 4 + Math.random() * 2, r: 0.3, g: 0.27, b: 0.25, alpha: 0.8, drag: 0.6 });
    g.later(1.6, () => { if (!this.on || !g.player || !g.player.alive) return; const before = new Set(g.enemies); const made = g.stampede(true); const herd = g.enemies.filter(e => !before.has(e) && e.stampede);
      if (herd.length) { const c = new THREE.Vector3(); herd.forEach(e => c.add(e.pos)); c.multiplyScalar(1 / herd.length); g.swoop = { t: 0, dur: 3.4, at: c, lift: 16, follow: herd }; this.n.swoops++; } });
    return true; }
  update(dt) { const g = this.g; if (!this.on) { if (this._wasOn) { this._wasOn = false; this.reset(); } return; } this._wasOn = true; const p = g.player;
    this.entT -= dt; this.hitSndT -= dt; this.ringT -= dt; this.playT += dt; if ((this.comboT -= dt) <= 0) this.combo = 0;
    if (g.mode === 'roam' && p.alive) { this.surpriseT -= dt; if (this.surpriseT <= 0) { this.surpriseT = 150 + Math.random() * 60; this.surprise(); } }
    // music that builds: nearby fighting + combo + a slow ramp over the visit (the battle has its own intensity)
    if (g.mode === 'roam' && (this.musicT -= dt) <= 0 && music.setIntensity) { this.musicT = 0.5; let near = 0; for (const e of g.enemies) if (e.alive && e.pos.distanceTo(p.pos) < 90) near++;
      const k = Math.min(1, near / 6 + Math.min(10, this.combo) / 20 + Math.min(0.25, this.playT / 480) + (g.swoop ? 0.5 : 0)); if (k > this.peakInt + 0.05) this.n.musicUps++; this.peakInt = Math.max(this.peakInt * 0.98, k); music.setIntensity(k); }
    // sparkling pickups near Leandro
    if ((this.sparkT -= dt) <= 0) { this.sparkT = 0.22; for (const k of g.pickups) { if (!k.alive) continue; const dx = k.x - p.pos.x, dz = k.z - p.pos.z; if (dx * dx + dz * dz > 3600) continue;
        g.fx.glow.spawn({ pos: { x: k.x + (Math.random() - 0.5) * 1.6, y: k.y + 0.8 + Math.random() * 1.2, z: k.z + (Math.random() - 0.5) * 1.6 }, vel: { x: 0, y: 1.2, z: 0 }, size: 0.35, size1: 0.05, life: 0.7, r: 2, g: 1.8, b: 0.8, alpha: 1, drag: 1 }); this.n.sparkles++; } } }
  // camera: KO punch-in and the surprise/boss swoop (called from Game.updateCamera; returns adjusted dist and nudges the target)
  camera(dt, dist, tgt, c, p, inp) { const g = this.g; let D = dist;
    const S = g.swoop; if (S) { S.t += dt; if (S.follow) { const live = S.follow.filter(e => e.alive); if (live.length) { const m = new THREE.Vector3(); live.forEach(e => m.add(e.pos)); S.at.lerp(m.multiplyScalar(1 / live.length), Math.min(1, dt * 3)); } }
      const k = Math.min(1, S.t / 0.6) * Math.min(1, Math.max(0, (S.dur - S.t) / 0.8)); if (S.t >= S.dur) g.swoop = null;
      else { D = D + S.lift * k; if (!inp.looking) { const want = Math.atan2(p.pos.x - S.at.x, p.pos.z - S.at.z); let a = want - c.yaw; while (a > Math.PI) a -= 6.283; while (a < -Math.PI) a += 6.283; c.yaw += a * Math.min(1, dt * 3) * k; }
        tgt.lerp(new THREE.Vector3((S.at.x + p.pos.x) / 2, tgt.y, (S.at.z + p.pos.z) / 2), 0.45 * k); tgt.y += 6 * k; } }
    const K = g.koCam; if (K) { K.t += dt; const k = Math.min(1, K.t / 0.15) * Math.min(1, Math.max(0, (K.dur - K.t) / 0.5)); if (K.t >= K.dur) g.koCam = null; else { D = D * (1 - 0.28 * k); tgt.lerp(K.at, 0.35 * k); } }
    return D; }
}
