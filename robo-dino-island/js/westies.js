// RICKY & BOBBY: two West Highland White Terriers who occasionally run in, get a wrestling-announcer
// introduction (spotlights, confetti, crowd cheer, banner), help for a moment (bark shockwave / fetch a power-up)
// and run off again. Built procedurally from simple shapes. They are invincible and never targeted by anything.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { sfx } from './audio.js';
import { voice } from './voice.js';

const V = () => new THREE.Vector3();
let furTex = null;
function fur() { // soft white fur with fine strands (canvas texture)
  if (furTex) return furTex; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { const x = Math.random() * 128, y = Math.random() * 128, l = 3 + Math.random() * 6, a = Math.PI / 2 + (Math.random() - 0.5) * 0.9, v = 205 + Math.random() * 50 | 0;
    g.strokeStyle = `rgba(${v},${v - 4},${v - 12},.7)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  furTex = new THREE.CanvasTexture(c); furTex.colorSpace = THREE.SRGBColorSpace; furTex.wrapS = furTex.wrapT = THREE.RepeatWrapping; return furTex;
}
// a fluffy blob: icosphere with jittered vertices so the silhouette looks shaggy
function fluff(r, seed, sx = 1, sy = 1, sz = 1, amt = 0.16) {
  const g = new THREE.SphereGeometry(r, 22, 16), p = g.attributes.position; let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const memo = new Map();
  for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); let f = memo.get(k); if (f === undefined) { f = 1 + (rnd() - 0.4) * amt; memo.set(k, f); }
    p.setXYZ(i, p.getX(i) * f * sx, p.getY(i) * f * sy, p.getZ(i) * f * sz); }
  g.computeVertexNormals(); return g;
}
export function buildWestie(name, accent) {
  const root = new THREE.Group(); root.name = 'westie-' + name;
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, map: fur(), roughness: 0.95, metalness: 0, emissive: 0x2a2826 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 0.35, metalness: 0.1 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xd8707a, roughness: 0.6 });
  const acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.3, emissive: accent, emissiveIntensity: 0.15 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, roughness: 0.2, metalness: 1 });
  const body = new THREE.Group(); root.add(body); body.position.y = 0.55;
  const torso = new THREE.Mesh(fluff(0.42, 7 + name.length, 1, 0.82, 1.35), white); body.add(torso);
  const chest = new THREE.Mesh(fluff(0.3, 13, 1.05, 1, 0.9, 0.25), white); chest.position.set(0, -0.05, 0.42); body.add(chest);
  // head (big fluffy round head, the classic westie "chrysanthemum" face)
  const head = new THREE.Group(); head.position.set(0, 0.38, 0.55); body.add(head);
  head.add(new THREE.Mesh(fluff(0.32, 21 + name.length, 1.08, 1, 1, 0.24), white));
  const muzzle = new THREE.Mesh(fluff(0.15, 5, 1, 0.85, 1.1, 0.18), white); muzzle.position.set(0, -0.07, 0.25); head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), black); nose.scale.set(1.25, 0.85, 1); nose.position.set(0, -0.02, 0.41); head.add(nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), black); eye.position.set(s * 0.12, 0.06, 0.26); head.add(eye);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(s * 0.12 + 0.015, 0.08, 0.305); head.add(hl);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 7), white); ear.position.set(s * 0.15, 0.33, -0.02); ear.rotation.z = -s * 0.22; head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.19, 5), pink); inner.position.set(s * 0.15, 0.32, 0.035); inner.rotation.z = -s * 0.22; head.add(inner);
  }
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), pink); jaw.scale.set(1, 0.45, 1); jaw.position.set(0, -0.16, 0.3); head.add(jaw);
  // tiny spiked collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 6, 20), acc); collar.rotation.x = Math.PI / 2 - 0.5; collar.position.set(0, 0.22, 0.47); body.add(collar);
  const spikes = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, c = new THREE.ConeGeometry(0.025, 0.09, 5); c.rotateZ(-Math.PI / 2); c.rotateY(-a); c.translate(Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28); spikes.push(c); }
  const sp = new THREE.Mesh(mergeGeometries(spikes), metal); sp.rotation.x = -0.5; sp.position.copy(collar.position); body.add(sp);
  // little superhero cape
  const capeG = new THREE.PlaneGeometry(0.55, 0.7, 4, 6); capeG.translate(0, -0.35, 0);
  const cape = new THREE.Mesh(capeG, new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55, side: THREE.DoubleSide, emissive: accent, emissiveIntensity: 0.1 }));
  cape.position.set(0, 0.36, 0.3); cape.rotation.x = 1.3; body.add(cape);
  // carrot-shaped tail, held up proud
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.52); body.add(tail);
  const tm = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.38, 7), white); tm.position.y = 0.19; tail.add(tm); tail.rotation.x = -0.45;
  // short legs with fluffy feet
  const legs = [];
  for (const [x, z] of [[-0.2, 0.36], [0.2, 0.36], [-0.2, -0.34], [0.2, -0.34]]) {
    const l = new THREE.Group(); l.position.set(x, -0.18, z); body.add(l);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.36, 7), white); m.position.y = -0.18; l.add(m);
    const f = new THREE.Mesh(fluff(0.085, 3, 1, 0.7, 1.25), white); f.position.set(0, -0.36, 0.03); l.add(f); legs.push(l);
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, body, head, jaw, tail, legs, cape, collar };
}

export class Westies {
  constructor(game) {
    this.g = game; this.state = 'off'; this.t = 0; this.cool = 70 + Math.random() * 60; this.lastEnd = -1e9; this.count = 0; this.clock = 0;
    this.dogs = [{ name: 'RICKY', ...buildWestie('ricky', 0xd82a2a) }, { name: 'BOBBY', ...buildWestie('bobby', 0x2a6ad8) }];
    for (const d of this.dogs) { d.root.scale.setScalar(2.1); d.root.visible = false; d.pos = V(); d.yaw = 0; d.ph = Math.random() * 6; d.bark = 0; d.hop = 0; game.scene.add(d.root); }
    // spotlight beams + glowing floor discs (cheap additive meshes, no real lights)
    const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.2), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const dm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.3, 1.0), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.spots = this.dogs.map(() => { const g = new THREE.Group(); const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 3.6, 30, 18, 1, true), bm); beam.position.y = 15; g.add(beam);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 28).rotateX(-Math.PI / 2), dm); disc.position.y = 0.08; g.add(disc); g.visible = false; game.scene.add(g); return g; });
    this.log = [];
  }
  get active() { return this.state !== 'off'; }
  // reason: 'roam' | 'battle' | 'boss' | 'victory' | 'test'. Returns true if the show starts.
  trigger(reason = 'roam', force = false) {
    const g = this.g, P = g.player; if (!P || this.active) return false;
    if (!force && this.clock - this.lastEnd < (reason === 'victory' ? 60 : 110)) return false;
    // pick a spot ~26 m in front-ish of the camera direction, on land
    const W = g.world, f = new THREE.Vector3(-Math.sin(g.cam.yaw), 0, -Math.cos(g.cam.yaw));
    const base = V().set(P.pos.x, 0, P.pos.z);
    const meet = base.clone().addScaledVector(f, 9 + P.def.scale * 2);
    if (W.height(meet.x, meet.z) < 0.3) meet.copy(base);
    const side = new THREE.Vector3(f.z, 0, -f.x);
    this.dogs.forEach((d, i) => { const s = i ? 1 : -1;
      d.goal = meet.clone().addScaledVector(side, s * 2.6); const far = reason === 'victory' ? 14 : 34; d.start = meet.clone().addScaledVector(side, s * far).addScaledVector(f, far * 0.3);
      d.pos.copy(d.start); d.root.visible = true; d.bark = 0; d.hop = 0; d.spin = 0; });
    this.reason = reason; this.state = 'enter'; this.t = 0; this.count++; this.helped = false; this.introduced = false; this.log.push(reason);
    sfx.bark && sfx.bark(1.0); return true;
  }
  ground(p) { const h = this.g.world.height(p.x, p.z); return Math.max(h, this.g.world.lava ? 0.2 : -0.3); }
  danger() { const g = this.g; for (const e of g.enemies) { if (!e.alive || e.stunT > 0.3) continue; for (const d of this.dogs) if (e.pos.distanceTo(d.pos) < 6 + e.radius) return true; } return false; }
  intro() {
    const g = this.g; this.introduced = true;
    g.hud.banner('🐶 RICKY & BOBBY! 🐶', 4, true); g.hud.toast('🐾 Here come RICKY & BOBBY!');
    sfx.cheer && sfx.cheer(1);
    voice.say('In this corner... weighing in at fifteen pounds of pure fluff... RICKYYYY!', { prio: 3, cd: 20000, pitch: 0.7, rate: 0.98 });
    voice.say('And his partner... BOBBYYYY!', { prio: 3, cd: 20000, pitch: 0.7, rate: 0.98 });
    if (g.rider && g.rider.mounted) g.rider.cheer();
    for (const s of this.spots) s.visible = true;
  }
  confetti(p, n) { const fx = this.g.fx; for (let i = 0; i < fx.n(n); i++) { const h = Math.random(), c = new THREE.Color().setHSL(h, 1, 0.6);
    fx.glow.spawn({ pos: { x: p.x + (Math.random() - 0.5) * 3, y: p.y + 7 + Math.random() * 3, z: p.z + (Math.random() - 0.5) * 3 }, vel: { x: (Math.random() - 0.5) * 9, y: 3 + Math.random() * 6, z: (Math.random() - 0.5) * 9 }, size: 0.32, size1: 0.22, life: 2.2 + Math.random(), r: c.r * 2, g: c.g * 2, b: c.b * 2, alpha: 1, grav: 5, drag: 1.2 }); } }
  help() {
    const g = this.g, P = g.player; this.helped = true; const mid = this.dogs[0].pos.clone().lerp(this.dogs[1].pos, 0.5);
    sfx.bark && sfx.bark(1.25); g.fx.ring(V().set(mid.x, this.ground(mid) + 0.3, mid.z), 18, 0xfff2a0); g.fx.shake = Math.max(g.fx.shake, 0.35);
    let n = 0; for (const e of g.enemies) if (e.alive && e.pos.distanceTo(mid) < 24) { g.stun(e, 2.5); e.knock.add(V().subVectors(e.pos, mid).setY(0).normalize().multiplyScalar(6)); n++; }
    if (n) g.hud.toast(`🐾 BARK BLAST! ${n} stunned!`);
    else if (g.battle && g.mh.powerups.length < 2) { g.mh.spawnPowerup(Math.random() < 0.5 ? 'meteor' : 'strike'); const U = g.mh.powerups[g.mh.powerups.length - 1]; if (U) { U.x = mid.x; U.z = mid.z; U.y = this.ground(mid); U.m.position.set(U.x, U.y + 1.8, U.z); } g.hud.toast('🐾 Ricky & Bobby fetched a power-up!'); }
    else { g.dropBolts(mid, 12); P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.25); g.hud.toast('🐾 Ricky & Bobby fetched bolts + a health snack!'); }
  }
  leave() { const g = this.g; this.state = 'exit'; this.t = 0; for (const s of this.spots) s.visible = false;
    this.dogs.forEach((d, i) => { const f = V().subVectors(d.pos, g.player.pos).setY(0); if (f.lengthSq() < 1) f.set(i ? 1 : -1, 0, 0); f.normalize(); d.goal = d.pos.clone().addScaledVector(f, 45); }); }
  end() { this.state = 'off'; this.lastEnd = this.clock; for (const d of this.dogs) d.root.visible = false; for (const s of this.spots) s.visible = false; }
  update(dt) {
    this.clock += dt; const g = this.g;
    if (!this.active) { // occasional surprise visit while exploring
      if (g.mode === 'roam' && !g.battle && g.player && g.player.alive) { this.cool -= dt; if (this.cool <= 0) { this.cool = 150 + Math.random() * 150; this.trigger('roam'); } }
      return;
    }
    this.t += dt; const T = this.t;
    if ((this.state === 'intro' || this.state === 'enter') && this.danger()) { g.hud.toast('🐾 Ricky & Bobby zoom off to safety!'); this.leave(); }
    for (const [i, d] of this.dogs.entries()) {
      let speed = 0;
      if (this.state === 'enter' || this.state === 'exit') { const to = V().subVectors(d.goal, d.pos).setY(0), L = to.length(); const sp = this.state === 'exit' ? 17 : 14;
        if (L > 0.4) { speed = Math.min(sp, L / dt); d.pos.addScaledVector(to.normalize(), Math.min(L, sp * dt)); d.yaw = Math.atan2(to.x, to.z); } }
      else { const P = g.player.pos, want = Math.atan2(P.x - d.pos.x, P.z - d.pos.z); d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 6); }
      d.pos.y = this.ground(d.pos);
      // animation: gallop, hype hops + spin, bark head toss
      d.ph += dt * (speed > 1 ? 16 : 5); const run = Math.min(1, speed / 8), sw = Math.sin(d.ph);
      d.legs[0].rotation.x = sw * 0.9 * run; d.legs[1].rotation.x = sw * 0.9 * run; d.legs[2].rotation.x = -sw * 0.9 * run; d.legs[3].rotation.x = -sw * 0.9 * run;
      let hopY = Math.abs(Math.sin(d.ph * 0.5)) * 0.18 * run, spin = 0, rear = 0;
      if (this.state === 'intro') { const k = (T + i * 0.35) % 1.6; hopY = k < 0.5 ? Math.sin(k / 0.5 * Math.PI) * 0.9 : 0; spin = k < 0.5 ? (k / 0.5) * Math.PI * 2 * (i ? -1 : 1) : 0; rear = Math.max(0, Math.sin(T * 2.2 + i)) * 0.5; }
      d.bark = Math.max(0, d.bark - dt * 3);
      if (this.state === 'intro' && Math.random() < dt * 1.6) { d.bark = 1; if (sfx.bark && Math.random() < 0.6) sfx.bark(0.75 + i * 0.2); }
      d.root.position.copy(d.pos); d.root.rotation.y = d.yaw + spin;
      d.body.position.y = 0.55 + hopY; d.body.rotation.x = -rear;
      d.head.rotation.x = -d.bark * 0.45; d.jaw.position.y = -0.16 - d.bark * 0.06;
      d.tail.rotation.z = Math.sin(this.clock * 22 + i) * 0.5; d.cape.rotation.x = 1.3 + run * 0.22 + Math.sin(this.clock * 9 + i) * 0.1;
      this.spots[i].position.set(d.pos.x, d.pos.y, d.pos.z);
    }
    if (this.state === 'enter' && (T > 4 || this.dogs.every(d => d.pos.distanceTo(d.goal) < 0.6))) { this.state = 'intro'; this.t = 0; this.intro(); }
    else if (this.state === 'intro') { if (Math.random() < dt * 6) this.confetti(this.dogs[(Math.random() * 2) | 0].pos, 6); if (T > 3.2 && !this.helped) this.help(); if (T > 5.2) this.leave(); }
    else if (this.state === 'exit' && T > 3.2) this.end();
  }
  // used when the level changes / the game resets
  reset() { if (this.active) this.end(); }
}
