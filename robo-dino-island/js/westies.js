// RICKY & BOBBY: two West Highland White Terriers who occasionally run in, get a wrestling-announcer
// introduction (spotlights, confetti, crowd cheer, banner), DANCE for ~5 s (hops, spins, wiggles, tail wags),
// then fly away into the sky with flapping capes and a sparkle trail. Built procedurally from simple shapes. They are invincible and never targeted by anything.
// v5: the 🐶 button makes them HELPERS: they follow the player for a few seconds, hunt down the nearest enemy, pounce,
// bite-flurry it to a guaranteed KO, bark, then fly away. (No enemies around: follow, dance, bark, fly away as before.)
// v5 Deep Sea: buildWestie also makes a SCUBA GEAR add-on (mask + strap, air tank + hose + regulator, flippers) that is
// hidden on land and switched on with setScuba() in the ocean, where the dogs swim in, follow, KO, bark bubbly yips and float up.
// v5: Pup wraps a westie in the same interface as Beast/Mech so Ricky and Bobby are PLAYABLE dinos-sized heroes.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { sfx } from './audio.js';
import { voice } from './voice.js';
import { buildWestie } from './westie.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DOG_S = 1; // mesh shoulder is already the v5.10.4 size (60% of v5.10.3)
const HOP = 0.096;  // hops scaled with the smaller dogs
export const POOP_LINE = "Look it's Ricky and Bobby, they are going to POOP!";
// v5: put the scuba gear on (ocean) or take it off (land). The cape comes off underwater (the tank sits there).
export function setScuba(w, on) { on = !!on; if (w.scubaOn === on) return; w.scubaOn = on; for (const m of w.scuba) m.visible = on; w.cape.visible = !on; }

// ---- v5: a playable westie. Same interface the game uses on Beast/Mech (obj, height, mats, socketPos, footPos, animate, ...)
export const DOG_P = 1.45; // playable Westie: a little easier to see than the 36 cm companions, still a real dog next to Leandro
export class Pup {
  constructor(def) {
    this.def = def; this.real = true; this.quad = true; this.flyer = false; this.westie = true;
    const w = buildWestie(def.id, def.accent); this.w = w;
    this.obj = new THREE.Group(); w.root.scale.setScalar(DOG_P * (w.mul || 1)); this.obj.add(w.root);
    const fur = Array.isArray(w.torso.material) ? w.torso.material[0] : w.torso.material, acc = w.collar.material;
    this.mats = { plate: fur, frame: acc, glow: acc, glowColor: new THREE.Color(def.accent).multiplyScalar(1.6) };
    this.meshes = []; this.obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.height = 0.37; this.fitR = 0.42; this.b = {}; this.sockets = {};
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.spin = 0; this._v = V();
  }
  socketPos(name, out) { return this.w.jaw.getWorldPosition(out); }
  footPos(i, out) { return this.w.legs[i % 4].getWorldPosition(out); }
  dispose() {}
  animate(dt, speed, o = {}) {
    const w = this.w; this.t += dt; const t = this.t, run = Math.min(1, speed / 12), air = o.air || 0, fly = air > 0.01 || o.flying;
    this.phase += speed * dt / (1.1 * DOG_P) * Math.PI; const ph = this.phase, sw = Math.sin(ph * 2);
    const legSw = fly ? 0.7 : 0.95 * run;
    w.legs[0].rotation.x = sw * legSw; w.legs[1].rotation.x = -sw * legSw * 0.6; w.legs[2].rotation.x = -sw * legSw; w.legs[3].rotation.x = sw * legSw * 0.6;
    this.spin = o.charge > 0.05 ? this.spin + dt * 22 : 0; // zoomies spin
    w.body.position.y = Math.abs(Math.sin(ph)) * 0.03 * run + (o.rear || 0) * 0.036; w.body.rotation.x = -(o.rear || 0) * 0.7 + (fly ? -0.25 : 0);
    w.body.rotation.y = this.spin; w.body.rotation.z = this.ko * 0.5 + Math.sin(ph) * 0.05 * run;
    const bite = o.bite || 0, bark = Math.max(o.roar || 0, (o.jaw || 0) * 0.5);
    w.head.rotation.x = -0.35 * bite - 0.3 * bark + Math.sin(t * 2.2) * 0.04; w.jaw.rotation.x = 0.45 * Math.max(bite, bark);
    w.tail.rotation.z = Math.sin(t * (speed > 1 ? 30 : 18)) * 0.6;
    w.cape.rotation.x = fly || speed > 8 ? 1.0 + Math.sin(t * 30) * 0.4 : 1.3 + run * 0.2 + Math.sin(t * 9) * 0.1;
    this.flash = Math.max(0, this.flash - dt * 4); this.mats.plate.emissive.setRGB(0.165 + this.flash * 0.9, 0.157 + this.flash * 0.25, 0.15 + this.flash * 0.25);
  }
}

export class Westies {
  constructor(game) {
    this.g = game; this.S = DOG_S; this.state = 'off'; this.t = 0; this.cool = 70 + Math.random() * 60; this.lastEnd = -1e9; this.count = 0; this.clock = 0;
    this.dogs = [{ name: 'RICKY', ...buildWestie('ricky', 0xd82a2a) }, { name: 'BOBBY', ...buildWestie('bobby', 0x2a6ad8) }];
    for (const d of this.dogs) { d.root.scale.setScalar(DOG_S * (d.mul || 1)); d.root.visible = false; d.pos = V(); d.yaw = 0; d.ph = Math.random() * 6; d.bark = 0; d.hop = 0; game.scene.add(d.root); }
    // spotlight beams + glowing floor discs (cheap additive meshes, no real lights)
    const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.2), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const dm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.3, 1.0), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.spots = this.dogs.map(() => { const g = new THREE.Group(); const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 3.6, 30, 18, 1, true), bm); beam.position.y = 15; g.add(beam);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 28).rotateX(-Math.PI / 2), dm); disc.position.y = 0.08; g.add(disc); g.scale.setScalar(Math.max(1, 1.7 * DOG_S / 4.4)); g.visible = false; game.scene.add(g); return g; });
    this.log = [];
  }
  // the player's oriented bounding box (dino + rider + wings) as 8 world-space offsets from its position
  static footprint(P) {
    const o = P.mech.obj, q = o.quaternion.clone(); o.quaternion.identity(); o.updateMatrixWorld(true);
    const bx = new THREE.Box3().setFromObject(o); o.quaternion.copy(q); o.updateMatrixWorld(true);
    const out = []; for (const x of [bx.min.x, bx.max.x]) for (const y of [bx.min.y, bx.max.y]) for (const z of [bx.min.z, bx.max.z]) out.push(V(x - o.position.x, y - o.position.y, z - o.position.z).applyQuaternion(q).add(V().subVectors(o.position, P.pos)));
    return out;
  }
  get active() { return this.state !== 'off'; }
  // reason: 'roam' | 'battle' | 'boss' | 'victory' | 'test'. Returns true if the show starts.
  trigger(reason = 'roam', force = false) {
    const g = this.g, P = g.player; if (!P || this.active) return false;
    if (!force && this.clock - this.lastEnd < (reason === 'victory' ? 60 : 110)) return false;
    // v5: if the player IS Ricky (or Bobby), only the other dog shows up
    for (const d of this.dogs) d.off = !!(P.def.westie && d.name.toLowerCase() === P.def.id);
    this.reason = reason; this.count++; this.introduced = false; this.barkQ = []; this.danced = 0; this.flew = false; this.log.push(reason); this.target = null; this.helped = 0;
    this.sea = !!(g.world && g.world.ocean); // v5 Deep Sea: SCUBA DOGS
    this.S = g.farm ? 1.15 : DOG_S; // v5.1: farm-dog size next to Leandro (2.5 is dino scale)
    for (const d of this.dogs) { d.vy = 0; d.alt = 0; d.root.scale.setScalar(this.S * (d.mul || 1)); d.bark = 0; d.hop = 0; d.spin = 0; d.poopT = 0; d.root.visible = !d.off; setScuba(d, this.sea); }
    if (reason === 'button') { // v5 HELPER MODE: swoop in beside the player and follow
      this.helper = true; this.stage = null; const f = P.forward(V()), side = V(-f.z, 0, f.x);
      this.dogs.forEach((d, i) => { const s = i ? 1 : -1; d.stageY = null; d.pos.set(P.pos.x, 0, P.pos.z).addScaledVector(side, s * 26).addScaledVector(f, -12); d.alt = 9; d.yaw = P.yaw; });
      this.state = 'follow'; this.t = 0; this.farmPig = g.farm ? g.farm.startRunaway() : null; return true; // v5.1 farm: a piggy escapes and the dogs herd it home
    }
    this.helper = false; this.setupStage(reason); this.state = 'enter'; this.t = 0; return true;
  }
  activeDogs() { return this.dogs.filter(d => !d.off); }
  // the dance stage (used by the surprise visits, and by helper mode when there's nobody to fight)
  setupStage(reason) {
    const g = this.g, P = g.player;
    // v4.3: a dance stage the gameplay camera can see. One dog on each side, a little ahead of the player, far enough
    // sideways that (in perspective, from the camera) they clear the player's silhouette (tail, wings, rider), and the
    // camera eases back until both fit on screen (Game.updateCamera reads this.stage; it restores after the fly-away).
    const yaw = g.cam.yaw, f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), side = new THREE.Vector3(-f.z, 0, f.x);
    const corners = Westies.footprint(P).map(o => ({ lat: Math.abs(o.dot(side)), fw: o.dot(f) }));
    const pitch = g.cam.pitch || 0.3, cp = Math.max(0.5, Math.cos(pitch)), aspect = (g.camera && g.camera.aspect) || 1.6;
    const tanLim = Math.tan((g.camera ? g.camera.fov : 58) * Math.PI / 360) * aspect * 0.55, dogHalf = this.S * 0.8;
    const aheads = [4, 4]; let D = Math.max(6, (g.cam.dist || 12) * cp), Ls = [0, 0];
    for (let k = 0; k < 40; k++, D += 1.5) { let need = 0; for (const c of corners) if (D + c.fw > 1) need = Math.max(need, (c.lat + 1.5) * 1.15 / (D + c.fw));
      Ls = aheads.map(a => need * (D + a) + dogHalf); if (Ls.every((L, i) => L / (D + aheads[i]) <= tanLim)) break; }
    const base = V().set(P.pos.x, 0, P.pos.z);
    // they dance on two glowing floating dance floors at about the player's eye height: the middle band of the screen,
    // clear of the HUD corners and of ground clutter (trees/rocks) that hid them before
    const eyeY = P.pos.y + P.mech.height * 0.82;
    this.stage = { yaw, lat: Math.max(...Ls), lats: Ls, aheads, need: D / cp, half: Math.max(...corners.map(c => c.lat)) };
    this.dogs.forEach((d, i) => { const s = i ? 1 : -1;
      d.goal = base.clone().addScaledVector(f, aheads[i]).addScaledVector(side, s * Ls[i]); d.stageY = Math.max(eyeY - this.S * 0.5, this.ground(d.goal) + 0.6); const far = reason === 'victory' ? 16 : 30; d.start = d.goal.clone().addScaledVector(side, s * far).addScaledVector(f, far * 0.4);
      if (!this.helper) d.pos.copy(d.start); d.bark = 0; d.hop = 0; d.spin = 0; });
  }
  // v5: nearest living enemy (prefer regular dinos over a boss) within reach of the player
  pickTarget() {
    const g = this.g, P = g.player; let best = null, bd = 1e9;
    for (const e of g.enemies) { if (!e.alive || e === P) continue; const dd = e.pos.distanceTo(P.pos) + (e.boss ? 400 : 0); if (dd < bd && dd < 90 + (e.boss ? 400 : 0)) { bd = dd; best = e; } }
    return best;
  }
  ground(p) { const h = this.g.world.height(p.x, p.z); return this.g.world.ocean ? h : Math.max(h, this.g.world.lava ? 0.2 : -0.3); }
  danger() { const g = this.g; for (const e of g.enemies) { if (!e.alive) continue; for (const d of this.dogs) if (e.pos.distanceTo(d.pos) < 6 + e.radius) return true; } return false; }
  intro() {
    const g = this.g; this.introduced = true;
    if (g.farm) { // v5.3 (Mike's exact words, updated in v5.6.2 to say POOP): ONE big bouncy line on the farm, nothing else before or after it
      const line = "Look it's Ricky and Bobby, they are going to POOP!"; this.farmShouts = (this.farmShouts || 0) + 1;
      if (g.hud.shout) g.hud.shout(line, 4.2); else g.hud.banner(line, 4, true); sfx.cheer && sfx.cheer(1);
      voice.say("Look, it's Ricky and Bobby, they are going to poop!", { prio: 3, cd: 0, pitch: 1.1, rate: 1.0, replace: true }); return; }
    const solo = this.activeDogs().length === 1 ? this.activeDogs()[0].name : null;
    g.hud.banner(solo ? '🐶 ' + solo + '! 🐶' : '🐶 RICKY & BOBBY! 🐶', 4, true); document.getElementById('banner').classList.add('rb'); // banner sits high so it doesn't cover the dogs
    sfx.cheer && sfx.cheer(1);
    // natural words for speech (iOS spells out ALL-CAPS / stretched words); the drama comes from pitch + rate
    if (solo) { const nm = solo === 'RICKY' ? 'Ricky' : 'Bobby';
      voice.say('In this corner... weighing in at fifteen pounds of pure fluff... ' + nm + '!', { prio: 3, cd: 20000, pitch: 0.68, rate: 0.9 });
      voice.say(nm + ' is here to help, Leandro!', { prio: 3, cd: 20000, pitch: 0.8, rate: 1.12 }); }
    else { voice.say('In this corner... weighing in at fifteen pounds of pure fluff... Ricky!', { prio: 3, cd: 20000, pitch: 0.68, rate: 0.9 });
      voice.say('And... Bobby!', { prio: 3, cd: 20000, pitch: 0.68, rate: 0.9 });
      voice.say("It's Ricky and Bobby!", { prio: 3, cd: 20000, pitch: 0.8, rate: 1.12 }); }
    if (g.rider && g.rider.mounted) g.rider.cheer();
    if (!this.helper) this.dogs.forEach((d, i) => { this.spots[i].visible = !d.off; });
    // v4.4: a couple of happy yips: Ricky, then Bobby (a bit higher), then one more from Ricky mid-wiggle
    const iA = this.dogs[0].off ? 1 : 0, iB = this.dogs[1].off ? 0 : 1;
    this.barkQ = [{ t: this.t + 0.25, i: iA, n: 2 }, { t: this.t + 0.7, i: iB, n: 2 }, { t: this.t + 3.0, i: iA, n: 1 }];
  }
  woof(i, n) { const d = this.dogs[i]; d.bark = 0.3; this.barked = (this.barked || 0) + 1; sfx.bark && sfx.bark(i ? 1.15 : 1, 0.85, n);
    if (this.sea) { this.bubbled = (this.bubbled || 0) + 1; sfx.bubbles && sfx.bubbles(0.8, 3 + n * 2); const p = d.head.getWorldPosition(V()); this.g.bubbles && this.g.bubbles(p, 6 + n * 3, 0.6, 5); } } // underwater: bubbly yips
  confetti(p, n) { const fx = this.g.fx; for (let i = 0; i < fx.n(n); i++) { const h = Math.random(), c = new THREE.Color().setHSL(h, 1, 0.6);
    fx.glow.spawn({ pos: { x: p.x + (Math.random() - 0.5) * 3, y: p.y + 7 + Math.random() * 3, z: p.z + (Math.random() - 0.5) * 3 }, vel: { x: (Math.random() - 0.5) * 9, y: 3 + Math.random() * 6, z: (Math.random() - 0.5) * 9 }, size: 0.32, size1: 0.22, life: 2.2 + Math.random(), r: c.r * 2, g: c.g * 2, b: c.b * 2, alpha: 1, grav: 5, drag: 1.2 }); } }
  // 🐶 button while they're already here: just a bigger confetti burst (no fighting)
  moreConfetti() { if (!this.active) return; for (const d of this.activeDogs()) this.confetti(d.pos, 22); sfx.cheer && sfx.cheer(0.6); this.extra = (this.extra || 0) + 1; }
  sparkle(d) { const fx = this.g.fx, p = d.root.position; if (this.sea) { if (Math.random() < 0.5) this.g.bubbles(V(p.x, p.y + 0.8, p.z), 1, 1, 3); if (Math.random() < 0.6) return; } for (let i = 0; i < fx.n(3); i++) { const c = new THREE.Color().setHSL(0.12 + Math.random() * 0.1, 1, 0.75);
    fx.glow.spawn({ pos: { x: p.x + (Math.random() - 0.5) * 1.2, y: p.y + 0.8 + Math.random(), z: p.z + (Math.random() - 0.5) * 1.2 }, vel: { x: (Math.random() - 0.5) * 2, y: -2 - Math.random() * 2, z: (Math.random() - 0.5) * 2 }, size: 0.3, size1: 0.05, life: 0.9 + Math.random() * 0.5, r: c.r * 2.4, g: c.g * 2.4, b: c.b * 2.4, alpha: 1, grav: 0, drag: 1 }); } }
  // they don't run off any more: little capes flap and they rocket up into the sky with a sparkle trail
  flyAway() { this.state = 'fly'; this.t = 0; this.flew = true; for (const s of this.spots) s.visible = false; sfx.cheer && sfx.cheer(0.7);
    const a = this.activeDogs(), bye = this.sea ? ' 🫧' : ' ✨'; this.g.hud.toast(a.length === 1 ? '🐾 Bye ' + (a[0].name === 'RICKY' ? 'Ricky' : 'Bobby') + '!' + bye : '🐾 Bye Ricky! Bye Bobby!' + bye);
    if (this.sea) { this.floated = (this.floated || 0) + 1; sfx.bubbles && sfx.bubbles(1, 12); }
    this.fartExit = !!this.g.farm; if (this.fartExit) { this.fartExits = (this.fartExits || 0) + 1; sfx.fart && sfx.fart('trumpet', 0.9); this.g.later && this.g.later(0.5, () => sfx.fart && sfx.fart('stutter', 0.7)); this.g.hud.toast('💨🚀 Ricky & Bobby FART-ROCKETED away! 😂'); }
    this.dogs.forEach((d, i) => { d.vy = 2 + i * 0.6; d.alt = d.alt || 0; }); this.stage = null; }
  end() { this.state = 'off'; this.lastEnd = this.clock; this.helper = false; this.stage = null; this.target = null; for (const d of this.dogs) { d.root.visible = false; d.alt = 0; d.vy = 0; d.goalAlt = undefined; } for (const s of this.spots) s.visible = false; }
  // Ricky and Bobby live on Jungle Island: they trot beside Leandro (on foot or on a dino) and never get in the way.
  companions(dt) {
    const g = this.g, P = g.player;
    const land = g.level === 'jungle' && !g.farm && !(g.world && g.world.ocean) && g.mode !== 'battle';
    if (!land || !P || !P.alive) {
      if (this.pals) { this.pals = false; for (const d of this.dogs) d.root.visible = false; }
      return false;
    }
    this.pals = true;
    const f = P.forward(V()), side = V(-f.z, 0, f.x), moving = (P.speedNow || 0) > 0.8;
    this.dogs.forEach((d, i) => {
      if (d.off) { d.root.visible = false; return; }
      d.root.visible = true; setScuba(d, false);
      const s = i ? 1 : -1, behind = (P.radius || 2) + 1.32;
      const gx = P.pos.x - f.x * behind + side.x * s * 0.96, gz = P.pos.z - f.z * behind + side.z * s * 0.96;
      let dx = gx - d.pos.x, dz = gz - d.pos.z, dist = Math.hypot(dx, dz);
      if (!d.placed) { d.pos.set(gx, 0, gz); d.placed = true; dist = 0; }
      if (dist > 32) { d.pos.set(gx, 0, gz); dist = 0; }
      else if (dist > 0.25) {
        const sp = dist > 10 ? 16 : dist > 4 ? 9 : 5, step = Math.min(dist, sp * dt);
        d.pos.x += dx / dist * step; d.pos.z += dz / dist * step; d.yaw = Math.atan2(dx, dz);
      }
      const pd = Math.hypot(d.pos.x - P.pos.x, d.pos.z - P.pos.z), minD = (P.radius || 1) + 0.69;
      if (pd < minD && pd > 0.01) { d.pos.x = P.pos.x + (d.pos.x - P.pos.x) / pd * minD; d.pos.z = P.pos.z + (d.pos.z - P.pos.z) / pd * minD; }
      if (g.world.collide) g.world.collide(d.pos, 0.17, false);
      d.pos.y = this.ground(d.pos); d.root.position.copy(d.pos); d.root.rotation.y = d.yaw;
      d.root.scale.setScalar(this.S * (d.mul || 1));
      const going = dist > 0.35 || moving;
      d.ph = (d.ph || 0) + dt * (going ? (dist > 6 ? 18 : 12) : 3);
      const sw = Math.sin(d.ph), amp = going ? (dist > 6 ? 0.9 : 0.55) : 0.04;
      d.body.position.y = going ? Math.abs(sw) * 0.018 : 0; d.body.rotation.x = 0; d.body.rotation.z = 0;
      const knee = b => b && b.children.find(c => c.isBone);
      if (d.poopT > 0) {
        d.poopT -= dt; d.body.rotation.x = 0.42;
        d.legs[0].rotation.x = 0.35; d.legs[1].rotation.x = 0.35; d.legs[2].rotation.x = -1.05; d.legs[3].rotation.x = -1.05;
        const lk = knee(d.legs[2]), rk = knee(d.legs[3]); if (lk) lk.rotation.x = 1.15; if (rk) rk.rotation.x = 1.15;
        d.tail.rotation.z = 0.15; d.head.rotation.x = 0.25; d.jaw.rotation.x = 0.1;
        if (!d.pooped && d.poopT < 0.85) {
          d.pooped = true; sfx.fart && sfx.fart('tiny', 0.8);
          const bx = d.pos.x - Math.sin(d.yaw) * 0.17, bz = d.pos.z - Math.cos(d.yaw) * 0.17;
          for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2;
            g.fx.glow.spawn({ pos: { x: bx + Math.cos(a) * 0.06, y: d.pos.y + 0.04, z: bz + Math.sin(a) * 0.06 }, vel: { x: Math.cos(a) * 0.15, y: 0.18, z: Math.sin(a) * 0.15 }, size: 0.06, life: 0.7, r: 0.45, g: 0.2, b: 0.06, alpha: 0.95, grav: 1.1 }); }
          g.fx.glow.spawn({ pos: { x: bx, y: d.pos.y + 0.08, z: bz }, vel: { x: -Math.sin(d.yaw) * 0.12, y: 0.33, z: -Math.cos(d.yaw) * 0.12 }, size: 0.12, life: 0.5, r: 0.8, g: 0.78, b: 0.55, alpha: 0.5, grav: -0.15 });
        }
      } else if (!going && (d.sit || 0) > 1.1) {
        d.legs[0].rotation.x = 0.75; d.legs[1].rotation.x = 0.75; d.legs[2].rotation.x = -1.15; d.legs[3].rotation.x = -1.15;
        d.body.rotation.x = -0.2; d.tail.rotation.z = Math.sin(this.clock * 14 + i) * 0.7; d.head.rotation.x = Math.sin(this.clock * 2) * 0.06; d.jaw.rotation.x = 0;
      } else {
        d.legs[0].rotation.x = sw * amp; d.legs[3].rotation.x = sw * amp; d.legs[1].rotation.x = -sw * amp; d.legs[2].rotation.x = -sw * amp;
        for (const leg of d.legs) { const k = knee(leg); if (k) k.rotation.x = Math.max(0, -leg.rotation.x) * 0.85; }
        d.tail.rotation.z = Math.sin(this.clock * (going ? 16 : 10) + i) * 0.55; d.head.rotation.x = 0; d.jaw.rotation.x = 0;
        if (going && Math.random() < dt * 0.12) d.hop = 0.22;
      }
      if (d.hop > 0) { d.hop -= dt; d.body.position.y += Math.max(0, Math.sin((0.22 - d.hop) / 0.22 * Math.PI)) * 0.06; d.head.rotation.x = -0.35; d.jaw.rotation.x = 0.4; }
      d.sit = going ? 0 : (d.sit || 0) + dt;
      d.cape.rotation.x = going ? 1.15 + Math.sin(this.clock * 12 + i) * 0.12 : 1.25;
      if (d.tag) d.tag.visible = Math.hypot(d.pos.x - P.pos.x, d.pos.z - P.pos.z) < 14;
    });
    this.poopClock = (this.poopClock == null ? 6.5 : this.poopClock) - dt;
    if (this.poopClock <= 0) {
      this.poopClock = 26 + Math.random() * 14;
      const live = this.dogs.filter(d => !d.off), d = live[(Math.random() * live.length) | 0];
      if (d) { d.poopT = 1.4; d.pooped = false;
        if (g.hud.shout) g.hud.shout(POOP_LINE, 3.4); else g.hud.banner(POOP_LINE, 3.2, true);
        voice.say("Look, it's Ricky and Bobby, they are going to poop!", { prio: 2, cd: 8000, pitch: 1.1, rate: 1.0 }); }
    }
    return true;
  }
  update(dt) {
    this.clock += dt; const g = this.g;
    if (!this.active) { // on the jungle they follow along; other worlds still get the occasional surprise visit
      const pals = this.companions(dt);
      if (!pals && g.mode === 'roam' && !g.battle && g.player && g.player.alive) { this.cool -= dt; if (this.cool <= 0) { this.cool = 150 + Math.random() * 150; this.trigger('roam'); } }
      return;
    }
    this.t += dt; const T = this.t, DANCE = 5;
    if (!this.helper && (this.state === 'dance' || this.state === 'enter') && T > 0.8 && this.danger()) this.flyAway(); // trouble nearby: up, up and away
    if (this.helper) this.helperLogic(dt, T);
    for (const [i, d] of this.dogs.entries()) {
      if (d.off) continue;
      let speed = 0, hopY = 0, spin = 0, rear = 0, wig = 0, sideX = 0, tailSp = 22, flap = 0, sniff = 0;
      if (this.helper && this.state !== 'enter' && this.state !== 'dance' && this.state !== 'fly') { const a = this.anim(d, i, dt, T); speed = a.speed; hopY = a.hopY; flap = a.flap; rear = a.rear; spin = a.spin; tailSp = a.tailSp; wig = a.wig || 0; sniff = a.sniff || 0; }
      else if (this.state === 'enter') { flap = 1; if (Math.random() < 0.6) this.sparkle(d); const to = V().subVectors(d.goal, d.pos).setY(0), L = to.length(); // capes out: they fly in
        if (L > 0.4) { speed = Math.min(20, L / dt); d.pos.addScaledVector(to.normalize(), Math.min(L, 20 * dt)); d.yaw = Math.atan2(to.x, to.z); } }
      else if (this.state === 'dance') {
        const P = g.cam.pos, want = Math.atan2(P.x - d.pos.x, P.z - d.pos.z); // face the camera (the audience)
        d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 6);
        tailSp = 34; const alt = i ? Math.PI : 0;
        if (T < 1.6) { const k = T * 4 * Math.PI + alt; hopY = Math.max(0, Math.sin(k)) * 0.8 * HOP; } // 1) alternating bunny hops
        else if (T < 2.8) { const k = (T - 1.6) / 1.2; spin = k * Math.PI * 2 * (i ? -1 : 1); hopY = Math.sin(k * Math.PI) * 1.1 * HOP; } // 2) mirrored jump-spin together
        else if (T < 4.2) { const k = (T - 2.8) * 9; wig = Math.sin(k + alt) * 0.45; sideX = Math.sin(k * 0.5 + alt) * 0.35; hopY = Math.abs(Math.sin(k)) * 0.15 * HOP; } // 3) side-to-side butt wiggle
        else { const k = (T - 4.2) / (DANCE - 4.2); rear = Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.75; hopY = rear * 0.5 * HOP; wig = Math.sin(T * 14) * 0.15; } // 4) rear up, paws in the air, ta-da!
      } else if (this.state === 'fly') {
        d.vy += dt * (this.sea ? 9 + i * 2 : 14 + i * 3); d.alt += d.vy * dt; flap = 1; tailSp = 40; spin = Math.sin(T * 3 + i) * 0.4; rear = 0.5; if (this.sea && Math.random() < 0.5) this.g.bubbles(d.head.getWorldPosition(V()), 2, 0.4, 4);
        if (Math.random() < 0.9) this.sparkle(d);
        if (this.fartExit && this.g.farm && Math.random() < 0.3) this.g.farm.cloud(V(d.pos.x, this.ground(d.pos) + d.alt, d.pos.z), V(0, -1, 0), 2, 0.7);
        const sc = this.S * (d.mul || 1) * Math.max(0.05, 1 - Math.max(0, d.alt - 30) / 25); d.root.scale.setScalar(sc);
      }
      const side = V(Math.cos(d.yaw), 0, -Math.sin(d.yaw));
      d.ph += dt * (speed > 1 ? 16 : 5); const run = Math.min(1, speed / 8), sw = Math.sin(d.ph);
      const legSw = flap ? 0.6 : 0.9 * run + (this.state === 'dance' ? 0.35 * Math.abs(Math.sin(T * 9 + i)) : 0);
      d.legs[0].rotation.x = sw * legSw; d.legs[1].rotation.x = sw * legSw; d.legs[2].rotation.x = -sw * legSw; d.legs[3].rotation.x = -sw * legSw;
      d.pos.y = Math.max(this.ground(d.pos), d.stageY ?? -1e9) + (d.castleHop || 0); // v5.3 bouncy castle
      if (this.helper && this.state !== 'fly') { if (d.alt > 0 && d.goalAlt === undefined) d.alt = Math.max(0, d.alt - dt * 9); if (d.goalAlt !== undefined) d.alt += (d.goalAlt - d.alt) * Math.min(1, dt * 10); }
      d.root.position.copy(d.pos).addScaledVector(side, sideX); d.root.position.y += d.alt || 0; d.root.rotation.y = d.yaw + spin;
      d.body.position.y = hopY + (speed > 1 ? Math.abs(Math.sin(d.ph * 0.5)) * 0.03 * run : 0); d.body.rotation.x = -rear; d.body.rotation.z = wig;
      d.bark = Math.max(0, d.bark - dt); d.head.rotation.x = d.bark > 0 ? -0.25 * Math.sin(d.bark / 0.3 * Math.PI) : sniff; d.jaw.rotation.x = (this.state === 'dance' ? 0.18 : 0) + (d.bark > 0 ? 0.35 : 0);
      d.tail.rotation.z = Math.sin(this.clock * tailSp + i) * (this.state === 'dance' ? 0.75 : 0.5);
      if (d.tag && g.player) d.tag.visible = Math.hypot(d.pos.x - g.player.pos.x, d.pos.z - g.player.pos.z) < 14;
      d.cape.rotation.x = flap ? 1.0 + Math.sin(this.clock * 30 + i) * 0.45 : 1.3 + run * 0.22 + Math.sin(this.clock * 9 + i) * 0.1;
      this.spots[i].position.set(d.pos.x, d.pos.y, d.pos.z);
    }
    if (this.helper && (this.state === 'follow' || this.state === 'hunt' || this.state === 'maul' || this.state === 'cheer')) { /* handled in helperLogic */ }
    else if (this.state === 'enter' && (T > 4 || this.activeDogs().every(d => d.pos.distanceTo(d.goal) < 0.6))) { this.state = 'dance'; this.t = 0;
      if (!this.introduced) this.intro(); else { const iA = this.dogs[0].off ? 1 : 0, iB = this.dogs[1].off ? 0 : 1; this.barkQ = [{ t: 0.3, i: iA, n: 2 }, { t: 0.8, i: iB, n: 2 }, { t: 3.0, i: iA, n: 1 }]; } }
    else if (this.state === 'dance') { this.danced = T; while (this.barkQ && this.barkQ.length && T >= this.barkQ[0].t) { const b = this.barkQ.shift(); this.woof(b.i, b.n); } if (Math.random() < dt * 7) this.confetti(this.dogs[(Math.random() * 2) | 0].pos, 6); if (T > DANCE) this.flyAway(); }
    else if (this.state === 'fly' && (T > (this.sea ? 4.2 : 3.6) || this.activeDogs().every(d => d.alt > 55))) this.end();
  }
  // ---- v5 helper mode: follow → hunt → pounce + bite flurry → guaranteed KO → bark → fly away
  bark2(n = 2) { let k = 0; this.barkQ = []; this.dogs.forEach((d, i) => { if (!d.off) this.barkQ.push({ t: 0.05 + 0.3 * k++, i, n }); }); } // call right after this.t = 0
  helperLogic(dt, T) {
    const g = this.g, P = g.player; if (!P) return;
    while (this.barkQ && this.barkQ.length && T >= this.barkQ[0].t) { const b = this.barkQ.shift(); if (!this.dogs[b.i].off) this.woof(b.i, b.n); }
    if (this.state === 'follow') {
      if (!this.introduced && T > 0.5) this.intro();
      if (T > 4.4 && this.farmPig && g.farm && !this.zoomed) { this.zoomed = true; this.zooms = (this.zooms || 0) + 1; this.state = 'zoom'; this.t = 0; g.hud.toast('🐶 ZOOMIES! Ricky & Bobby are going CRAZY! 🌀😂'); sfx.whoosh && sfx.whoosh(1.2); this.bark2(3); }
      else if (T > 4.4 && this.farmPig && g.farm) { this.zoomed = false; this.state = 'herd'; this.t = 0; g.farm.herd(this.farmPig); g.hud.toast('🐶 Ricky & Bobby are herding the piggy home! 🐷'); sfx.whoosh && sfx.whoosh(1); this.bark2(2); }
      else if (T > 3.2 && !(this.farmPig && g.farm)) { this.target = this.pickTarget();
        if (this.target) { this.state = 'hunt'; this.t = 0; g.hud.toast('🐶 Ricky & Bobby are on the hunt! 🐾'); sfx.whoosh && sfx.whoosh(1); }
        else { this.setupStage('button'); this.dogs.forEach(d => { d.alt = 0; }); this.state = 'enter'; this.t = 0; this.barkQ = []; } } // nobody to fight: dance like before
    } else if (this.state === 'hunt') {
      const e = this.target; if (!e || !e.alive) { this.target = this.pickTarget(); if (!this.target) { this.state = 'cheer'; this.t = 0; this.bark2(2); } return; }
      const close = this.activeDogs().every(d => Math.hypot(d.pos.x - e.pos.x, d.pos.z - e.pos.z) < e.radius + 3.5);
      if (close || T > 3.5) { this.state = 'maul'; this.t = 0; this.biteT = 0; this.dogs.forEach(d => { d.p0 = d.pos.clone(); }); g.stun(e, 3); sfx.whoosh && sfx.whoosh(1.2); this.bark2(1); }
    } else if (this.state === 'maul') {
      const e = this.target; g.stun(e, 0.6);
      this.biteT -= dt; if (this.biteT <= 0 && T > 0.35) { this.biteT = 0.13; const c = e.center.clone(); c.x += (Math.random() - 0.5) * e.radius; c.z += (Math.random() - 0.5) * e.radius;
        g.fx.impact(c, 0.9, true); sfx.bite && sfx.bite(0.55); e.mech.flash = 1; if (e.alive && e.hp > 6) { e.hp -= Math.min(e.hp - 5, e.maxHp * 0.06); }
        if (Math.random() < 0.3) this.woof(this.dogs[0].off ? 1 : this.dogs[1].off ? 0 : (Math.random() * 2) | 0, 1); }
      if (T > 1.65) { // the finishing bite: always a KO (bosses just take a huge chunk)
        if (e.alive) { e.shieldT = 0; const dmg = e.boss ? e.maxHp * 0.3 : e.hp + 100; e.hit(dmg, P.pos, P); }
        g.fx.shake = Math.max(g.fx.shake, 0.9); this.helped++; this.kos = (this.kos || 0) + (e.alive ? 0 : 1);
        g.hud.toast('🐶 RICKY & BOBBY GOT ONE! 💥'); voice.say('Good dogs!', { prio: 2, cd: 4000, pitch: 1.1, rate: 1.1 });
        this.state = 'cheer'; this.t = 0; this.bark2(2); for (const d of this.activeDogs()) this.confetti(d.pos, 18); }
    } else if (this.state === 'cheer') { if (T > 1.3) { this.dogs.forEach(d => { d.goalAlt = undefined; }); this.flyAway(); } }
    // ---- v5.2 farm sillies: zoomies, mud slip, sock tug-of-war, a toot that scares them, fart-powered exit
    else if (this.state === 'zoom') { if (Math.random() < dt * 5) this.woof((Math.random() * 2) | 0, 1); if (T > 2.6) { this.state = 'follow'; this.t = 4.5; } }
    else if (this.state === 'tug') { const so = this.sockMesh(); so.visible = true; if (Math.random() < dt * 4) this.woof((Math.random() * 2) | 0, 1);
      if (T > 2.6 && !this.sockGone) { this.sockGone = true; this.tugs = (this.tugs || 0) + 1; sfx.boing && sfx.boing(0.9, 0.7); sfx.trip && sfx.trip(0.6); g.hud.toast('🧦 RIIIP! The sock went flying… both dogs fell on their bottoms! 😂'); this.sockV = V((Math.random() - 0.5) * 4, 9, (Math.random() - 0.5) * 4); }
      if (this.sockGone) { this.sockV.y -= 22 * dt; so.position.addScaledVector(this.sockV, dt); so.rotation.x += dt * 12; }
      if (T > 3.6) { so.visible = false; this.sockGone = false; this.state = 'toot'; this.t = 0; } }
    // ---- v5.1 Farty Poop Farm: herd the runaway piggy → sniff the poop / roll in the mud → one dog toots → cheer → fly away
    else if (this.state === 'herd') { const pig = this.farmPig, F = g.farm;
      if (Math.random() < dt * 2.2) this.woof(this.dogs[0].off ? 1 : this.dogs[1].off ? 0 : (Math.random() * 2) | 0, 1);
      if (pig.state !== 'herded' || T > 16) { if (pig.state === 'herded') { pig.place(pig.pen.x, pig.pen.z); pig.path = null; F.herdDone(pig); g.fx.dust(pig.pos, 10, 1.2, 4); }
        this.herded = (this.herded || 0) + 1; this.spot = F.nearestPoopOrMud(this.activeDogs()[0].pos) || { x: P.pos.x + 4, z: P.pos.z + 4, poop: false }; this.state = 'sniff'; this.t = 0; this.bark2(2); } }
    else if (this.state === 'sniff') { const sp = this.spot, near = this.activeDogs().every(d => Math.hypot(d.pos.x - sp.x, d.pos.z - sp.z) < 2.6);
      if (near && !this.sniffAt) { this.sniffAt = T; g.hud.toast('🐶 Sniff sniff… what is THIS? 👃'); }
      if (this.sniffAt && Math.random() < dt * 3) sfx.sniff && sfx.sniff(0.8);
      if ((this.sniffAt && T - this.sniffAt > 1.3) || T > 6) { this.sniffAt = 0; this.state = 'roll'; this.t = 0; this.rolled = (this.rolled || 0) + 1; sfx.squish && sfx.squish(0.7); this.slips = (this.slips || 0) + 1; sfx.slip && sfx.slip(0.8); if (g.farm) g.farm.emote('star', null, 3, V(this.activeDogs()[0].pos.x, this.activeDogs()[0].pos.y + 1.6, this.activeDogs()[0].pos.z));
        g.hud.toast(sp.poop ? '🐶 EWWW! Ricky & Bobby rolled in the POOP! 💩😂' : '🐶 Ricky & Bobby rolled in the MUD! 🟤😂'); } }
    else if (this.state === 'roll') { if (Math.random() < dt * 8) for (const d of this.activeDogs()) g.farm && g.farm.splat(d.pos, 2, 0.7);
      if (T > 1.7) { this.state = this.dogs[0].off || this.dogs[1].off ? 'toot' : 'tug'; this.t = 0; if (this.state === 'tug') g.hud.toast('🧦 Ricky & Bobby found a SOCK! Tug-of-war! 😂'); } }
    else if (this.state === 'toot') { if (!this.tooted && T > 0.25) { this.tooted = true; this.dogToots = (this.dogToots || 0) + 1; const i = this.dogs[1].off ? 0 : 1, d = this.dogs[i]; sfx.fart && sfx.fart('tiny', 1);
        if (g.farm) g.farm.cloud(V(d.pos.x - Math.sin(d.yaw) * 1.2, d.pos.y + 1, d.pos.z - Math.cos(d.yaw) * 1.2), V(-Math.sin(d.yaw), 0, -Math.cos(d.yaw)), 8, 0.8);
        g.hud.toast(i ? '💨 Bobby tooted… and SCARED HIMSELF! 😱😂' : '💨 Ricky tooted… and SCARED HIMSELF! 😱😂'); this.scared = (this.scared || 0) + 1; if (g.farm) { const bx = d.pos.x - Math.sin(d.yaw) * 0.84, bz = d.pos.z - Math.cos(d.yaw) * 0.84; g.farm.dropPoop(bx, bz, 0.27, d.pos.y + 0.48); this.dogPoops = (this.dogPoops || 0) + 1; } for (const q of this.activeDogs()) { g.farm && g.farm.emote('bang', null, 1, V(q.pos.x, q.pos.y + 2.4, q.pos.z)); } this.woof(i, 2); }
      if (T > 1.5) { this.tooted = false; this.state = 'cheer'; this.t = 0; this.bark2(2); for (const d of this.activeDogs()) this.confetti(d.pos, 18); } }
  }
  anim(d, i, dt, T) {
    const g = this.g, P = g.player, s = i ? 1 : -1, out = { speed: 0, hopY: 0, flap: 0, rear: 0, spin: 0, tailSp: 26 };
    const mv = (gx, gz, vmax) => { const to = V(gx - d.pos.x, 0, gz - d.pos.z), L = to.length(); if (L > 0.3) { const st = Math.min(L, vmax * dt); d.pos.addScaledVector(to.normalize(), st); out.speed = st / dt; d.yaw += Math.atan2(Math.sin(Math.atan2(to.x, to.z) - d.yaw), Math.cos(Math.atan2(to.x, to.z) - d.yaw)) * Math.min(1, dt * 10); }
      if (g.world.collide) g.world.collide(d.pos, 1.2, false); };
    if (this.state === 'follow') { const f = P.forward(V()), side = V(-f.z, 0, f.x), r = (P.radius || 3) + 3.2;
      mv(P.pos.x + side.x * s * r - f.x * 2, P.pos.z + side.z * s * r - f.z * 2, 38); out.flap = d.alt > 0.3 ? 1 : 0; if (out.flap && Math.random() < 0.6) this.sparkle(d);
      if (out.speed < 1) { const want = P.yaw; d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 4); out.hopY = Math.max(0, Math.sin(T * 9 + i * 1.6)) * 0.35 * HOP; } }
    else if (this.state === 'hunt' || this.state === 'maul') { const e = this.target; if (!e) return out;
      const toE = V(e.pos.x - P.pos.x, 0, e.pos.z - P.pos.z).normalize(), side = V(-toE.z, 0, toE.x), r = (e.radius || 3) + 1.9;
      const gx = e.pos.x + side.x * s * r, gz = e.pos.z + side.z * s * r;
      if (this.state === 'hunt') { mv(gx, gz, T > 2.2 ? 80 : 36); out.flap = T > 2.2 ? 1 : 0; d.goalAlt = undefined; if (Math.random() < 0.5) this.g.fx.dust(d.pos, 1, 1, 4); }
      else { const k = Math.min(1, T / 0.35); d.pos.x = d.p0.x + (gx - d.p0.x) * k; d.pos.z = d.p0.z + (gz - d.p0.z) * k; // POUNCE: arc onto the enemy's flank
        d.goalAlt = Math.sin(k * Math.PI) * 3 + k * Math.max(0, e.mech.height * 0.35 - 1); out.flap = 1;
        const want = Math.atan2(e.pos.x - d.pos.x, e.pos.z - d.pos.z); d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 14);
        if (T > 0.35) { out.hopY = Math.abs(Math.sin(T * 22 + i)) * 0.3; out.rear = 0.25 + 0.2 * Math.sin(T * 22 + i); d.bark = Math.max(d.bark, 0.12); } out.tailSp = 44; } }
    else if (this.state === 'cheer') { d.goalAlt = 0; out.hopY = Math.max(0, Math.sin(T * 10 + i * 1.6)) * 0.8 * HOP; out.rear = 0.35; out.tailSp = 40; }
    else if (this.state === 'herd') { const pig = this.farmPig, wp = (pig.path && pig.path[0]) || pig.pos, to = V(wp.x - pig.pos.x, 0, wp.z - pig.pos.z); if (to.lengthSq() < 0.01) to.set(0, 0, 1); to.normalize();
      const side = V(-to.z, 0, to.x), gx = pig.pos.x - to.x * 3.4 + side.x * s * 1.9, gz = pig.pos.z - to.z * 3.4 + side.z * s * 1.9, far = Math.hypot(gx - d.pos.x, gz - d.pos.z) > 12;
      mv(gx, gz, far ? 60 : 30); out.flap = far ? 1 : 0; out.tailSp = 40; if (Math.random() < 0.4) this.g.fx.dust(d.pos, 1, 1, 4); }
    else if (this.state === 'sniff') { const sp = this.spot; mv(sp.x + s * 1.2, sp.z + 0.6, 34); out.tailSp = 44; if (this.sniffAt) { out.sniff = 0.55 + Math.sin(T * 14 + i) * 0.08; const want = Math.atan2(sp.x - d.pos.x, sp.z - d.pos.z); d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 6); } }
    else if (this.state === 'zoom') { const a = T * 5.5 + i * Math.PI, r = (P.radius || 2) + 4.5; mv(P.pos.x + Math.sin(a) * r, P.pos.z + Math.cos(a) * r, 70); out.tailSp = 60; out.hopY = Math.abs(Math.sin(T * 16 + i)) * 0.2 * HOP; if (Math.random() < 0.6) this.g.fx.dust(d.pos, 1, 1, 4); }
    else if (this.state === 'tug') { const o = this.dogs[0].pos, c = this.tugC || (this.tugC = V(o.x, o.y, o.z)); if (T < 0.1) this.tugC.copy(o); const yank = this.sockGone ? 0 : Math.sin(T * 7) * 0.5, gx = c.x + s * (this.S * 0.9 + yank), gz = c.z;
      mv(gx, gz, 20); const want = Math.atan2(-s, 0); d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 10); out.rear = this.sockGone ? 0.6 : -0.15 + Math.max(0, -s * yank) * 0.3; out.tailSp = 50;
      if (!this.sockGone && i === 0) { const so = this.sockMesh(), a = this.dogs[0].head.getWorldPosition(V()), b = this.dogs[1].head.getWorldPosition(V()); so.position.copy(a).add(b).multiplyScalar(0.5); so.position.y -= 0.2 * this.S; so.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z), Math.PI / 2); } }
    else if (this.state === 'roll') { out.wig = (T * 9 + i * 1.3); out.hopY = Math.abs(Math.sin(T * 9)) * 0.1; out.tailSp = 50; }
    else if (this.state === 'toot') { const k = (this.dogs[1].off ? 0 : 1) === i; out.hopY = T > 0.25 && T < 0.95 ? Math.sin((T - 0.25) / 0.7 * Math.PI) * (k ? 2.2 : 1.6) * HOP : 0; out.spin = T > 0.25 && T < 0.95 ? Math.sin((T - 0.25) / 0.7 * Math.PI) * 0.6 * s : 0; out.rear = T > 0.25 ? 0.3 : 0; out.tailSp = 50; }
    if (this.sea) { // v5 Deep Sea: they SWIM at the action's height (paddling flippers), a regulator bubble now and then
      const gd = this.ground(d.pos), bob = Math.sin(T * 2.4 + i * 2) * 0.5, e = this.target;
      if (this.state === 'follow' || this.state === 'cheer') d.goalAlt = Math.max(0.3, P.pos.y + P.mech.height * 0.35 - gd + bob + (this.state === 'cheer' ? 1.5 : 0));
      else if (e && this.state === 'hunt') d.goalAlt = Math.max(0.3, e.pos.y + e.mech.height * 0.4 - gd + bob);
      else if (e && this.state === 'maul') d.goalAlt = Math.max(0.3, (d.goalAlt || 0) + e.pos.y - gd);
      out.flap = 1; if (Math.random() < dt * 4) this.g.bubbles(d.head.getWorldPosition(V()), 2, 0.3, 4); }
    return out;
  }
  sockMesh() { if (!this.sock) { this.sock = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(0.09, 0.08, 0.7, 8).translate(0, 0, 0), new THREE.CylinderGeometry(0.095, 0.095, 0.1, 8).translate(0, 0.32, 0), new THREE.SphereGeometry(0.1, 8, 6).translate(0.06, -0.36, 0)]), new THREE.MeshStandardMaterial({ color: 0xff6a9a, roughness: 0.8 }));
      this.sock.scale.setScalar(this.S); this.sock.visible = false; this.g.scene.add(this.sock); } return this.sock; }
  // used when the level changes / the game resets
  reset() { if (this.active) this.end(); if (this.sock) this.sock.visible = false; }
}
