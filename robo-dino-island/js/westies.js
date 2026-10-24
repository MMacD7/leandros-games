// RICKY & BOBBY: two West Highland White Terriers who occasionally run in, get a wrestling-announcer
// introduction (spotlights, confetti, crowd cheer, banner), DANCE for ~5 s (hops, spins, wiggles, tail wags),
// then fly away into the sky with flapping capes and a sparkle trail. No fighting. Built procedurally from simple shapes. They are invincible and never targeted by anything.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { sfx } from './audio.js';
import { voice } from './voice.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DOG_S = 4.4; // v4.3: big enough to read on an iPhone (was 2.1)
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
    for (const d of this.dogs) { d.root.scale.setScalar(DOG_S); d.root.visible = false; d.pos = V(); d.yaw = 0; d.ph = Math.random() * 6; d.bark = 0; d.hop = 0; game.scene.add(d.root); }
    // spotlight beams + glowing floor discs (cheap additive meshes, no real lights)
    const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.2), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const dm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.3, 1.0), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.spots = this.dogs.map(() => { const g = new THREE.Group(); const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 3.6, 30, 18, 1, true), bm); beam.position.y = 15; g.add(beam);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 28).rotateX(-Math.PI / 2), dm); disc.position.y = 0.08; g.add(disc); g.scale.setScalar(1.7); g.visible = false; game.scene.add(g); return g; });
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
    // v4.3: a dance stage the gameplay camera can see. One dog on each side, a little ahead of the player, far enough
    // sideways that (in perspective, from the camera) they clear the player's silhouette (tail, wings, rider), and the
    // camera eases back until both fit on screen (Game.updateCamera reads this.stage; it restores after the fly-away).
    const yaw = g.cam.yaw, f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), side = new THREE.Vector3(-f.z, 0, f.x);
    const corners = Westies.footprint(P).map(o => ({ lat: Math.abs(o.dot(side)), fw: o.dot(f) }));
    const pitch = g.cam.pitch || 0.3, cp = Math.max(0.5, Math.cos(pitch)), aspect = (g.camera && g.camera.aspect) || 1.6;
    const tanLim = Math.tan((g.camera ? g.camera.fov : 58) * Math.PI / 360) * aspect * 0.55, dogHalf = DOG_S * 0.8;
    const aheads = [4, 4]; let D = Math.max(6, (g.cam.dist || 12) * cp), Ls = [0, 0];
    for (let k = 0; k < 40; k++, D += 1.5) { let need = 0; for (const c of corners) if (D + c.fw > 1) need = Math.max(need, (c.lat + 1.5) * 1.15 / (D + c.fw));
      Ls = aheads.map(a => need * (D + a) + dogHalf); if (Ls.every((L, i) => L / (D + aheads[i]) <= tanLim)) break; }
    const base = V().set(P.pos.x, 0, P.pos.z);
    // they dance on two glowing floating dance floors at about the player's eye height: the middle band of the screen,
    // clear of the HUD corners and of ground clutter (trees/rocks) that hid them before
    const eyeY = P.pos.y + P.mech.height * 0.82;
    this.stage = { yaw, lat: Math.max(...Ls), lats: Ls, aheads, need: D / cp, half: Math.max(...corners.map(c => c.lat)) };
    this.dogs.forEach((d, i) => { const s = i ? 1 : -1;
      d.goal = base.clone().addScaledVector(f, aheads[i]).addScaledVector(side, s * Ls[i]); d.stageY = Math.max(eyeY - DOG_S * 0.5, this.ground(d.goal) + 0.6); const far = reason === 'victory' ? 16 : 30; d.start = d.goal.clone().addScaledVector(side, s * far).addScaledVector(f, far * 0.4);
      d.pos.copy(d.start); d.root.visible = true; d.bark = 0; d.hop = 0; d.spin = 0; });
    this.reason = reason; this.state = 'enter'; this.t = 0; this.count++; this.introduced = false; this.danced = 0; this.flew = false; this.log.push(reason);
    for (const d of this.dogs) { d.vy = 0; d.alt = 0; d.root.scale.setScalar(DOG_S); } return true;
  }
  ground(p) { const h = this.g.world.height(p.x, p.z); return Math.max(h, this.g.world.lava ? 0.2 : -0.3); }
  danger() { const g = this.g; for (const e of g.enemies) { if (!e.alive) continue; for (const d of this.dogs) if (e.pos.distanceTo(d.pos) < 6 + e.radius) return true; } return false; }
  intro() {
    const g = this.g; this.introduced = true;
    g.hud.banner('🐶 RICKY & BOBBY! 🐶', 4, true); document.getElementById('banner').classList.add('rb'); // banner sits high so it doesn't cover the dogs
    sfx.cheer && sfx.cheer(1);
    // natural words for speech (iOS spells out ALL-CAPS / stretched words); the drama comes from pitch + rate
    voice.say('In this corner... weighing in at fifteen pounds of pure fluff... Ricky!', { prio: 3, cd: 20000, pitch: 0.68, rate: 0.9 });
    voice.say('And his partner... Bobby!', { prio: 3, cd: 20000, pitch: 0.68, rate: 0.9 });
    voice.say("It's Ricky and Bobby!", { prio: 3, cd: 20000, pitch: 0.8, rate: 1.12 });
    if (g.rider && g.rider.mounted) g.rider.cheer();
    for (const s of this.spots) s.visible = true;
  }
  confetti(p, n) { const fx = this.g.fx; for (let i = 0; i < fx.n(n); i++) { const h = Math.random(), c = new THREE.Color().setHSL(h, 1, 0.6);
    fx.glow.spawn({ pos: { x: p.x + (Math.random() - 0.5) * 3, y: p.y + 7 + Math.random() * 3, z: p.z + (Math.random() - 0.5) * 3 }, vel: { x: (Math.random() - 0.5) * 9, y: 3 + Math.random() * 6, z: (Math.random() - 0.5) * 9 }, size: 0.32, size1: 0.22, life: 2.2 + Math.random(), r: c.r * 2, g: c.g * 2, b: c.b * 2, alpha: 1, grav: 5, drag: 1.2 }); } }
  // 🐶 button while they're already here: just a bigger confetti burst (no fighting)
  moreConfetti() { if (!this.active) return; for (const d of this.dogs) this.confetti(d.pos, 22); sfx.cheer && sfx.cheer(0.6); this.extra = (this.extra || 0) + 1; }
  sparkle(d) { const fx = this.g.fx, p = d.root.position; for (let i = 0; i < fx.n(3); i++) { const c = new THREE.Color().setHSL(0.12 + Math.random() * 0.1, 1, 0.75);
    fx.glow.spawn({ pos: { x: p.x + (Math.random() - 0.5) * 1.2, y: p.y + 0.8 + Math.random(), z: p.z + (Math.random() - 0.5) * 1.2 }, vel: { x: (Math.random() - 0.5) * 2, y: -2 - Math.random() * 2, z: (Math.random() - 0.5) * 2 }, size: 0.3, size1: 0.05, life: 0.9 + Math.random() * 0.5, r: c.r * 2.4, g: c.g * 2.4, b: c.b * 2.4, alpha: 1, grav: 0, drag: 1 }); } }
  // they don't run off any more: little capes flap and they rocket up into the sky with a sparkle trail
  flyAway() { this.state = 'fly'; this.t = 0; this.flew = true; for (const s of this.spots) s.visible = false; sfx.cheer && sfx.cheer(0.7); this.g.hud.toast('🐾 Bye Ricky! Bye Bobby! ✨');
    this.dogs.forEach((d, i) => { d.vy = 2 + i * 0.6; d.alt = 0; }); }
  end() { this.state = 'off'; this.lastEnd = this.clock; for (const d of this.dogs) { d.root.visible = false; d.alt = 0; d.vy = 0; } for (const s of this.spots) s.visible = false; }
  update(dt) {
    this.clock += dt; const g = this.g;
    if (!this.active) { // occasional surprise visit while exploring
      if (g.mode === 'roam' && !g.battle && g.player && g.player.alive) { this.cool -= dt; if (this.cool <= 0) { this.cool = 150 + Math.random() * 150; this.trigger('roam'); } }
      return;
    }
    this.t += dt; const T = this.t, DANCE = 5;
    if ((this.state === 'dance' || this.state === 'enter') && T > 0.8 && this.danger()) this.flyAway(); // trouble nearby: up, up and away
    for (const [i, d] of this.dogs.entries()) {
      let speed = 0, hopY = 0, spin = 0, rear = 0, wig = 0, sideX = 0, tailSp = 22, flap = 0;
      if (this.state === 'enter') { flap = 1; if (Math.random() < 0.6) this.sparkle(d); const to = V().subVectors(d.goal, d.pos).setY(0), L = to.length(); // capes out: they fly in
        if (L > 0.4) { speed = Math.min(20, L / dt); d.pos.addScaledVector(to.normalize(), Math.min(L, 20 * dt)); d.yaw = Math.atan2(to.x, to.z); } }
      else if (this.state === 'dance') {
        const P = g.cam.pos, want = Math.atan2(P.x - d.pos.x, P.z - d.pos.z); // face the camera (the audience) d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 6);
        tailSp = 34; const alt = i ? Math.PI : 0;
        if (T < 1.6) { const k = T * 4 * Math.PI + alt; hopY = Math.max(0, Math.sin(k)) * 0.8; } // 1) alternating bunny hops
        else if (T < 2.8) { const k = (T - 1.6) / 1.2; spin = k * Math.PI * 2 * (i ? -1 : 1); hopY = Math.sin(k * Math.PI) * 1.1; } // 2) mirrored jump-spin together
        else if (T < 4.2) { const k = (T - 2.8) * 9; wig = Math.sin(k + alt) * 0.45; sideX = Math.sin(k * 0.5 + alt) * 0.35; hopY = Math.abs(Math.sin(k)) * 0.15; } // 3) side-to-side butt wiggle
        else { const k = (T - 4.2) / (DANCE - 4.2); rear = Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.75; hopY = rear * 0.5; wig = Math.sin(T * 14) * 0.15; } // 4) rear up, paws in the air, ta-da!
      } else if (this.state === 'fly') {
        d.vy += dt * (14 + i * 3); d.alt += d.vy * dt; flap = 1; tailSp = 40; spin = Math.sin(T * 3 + i) * 0.4; rear = 0.5;
        if (Math.random() < 0.9) this.sparkle(d);
        const sc = DOG_S * Math.max(0.05, 1 - Math.max(0, d.alt - 30) / 25); d.root.scale.setScalar(sc);
      }
      const side = V(Math.cos(d.yaw), 0, -Math.sin(d.yaw));
      d.ph += dt * (speed > 1 ? 16 : 5); const run = Math.min(1, speed / 8), sw = Math.sin(d.ph);
      const legSw = flap ? 0.6 : 0.9 * run + (this.state === 'dance' ? 0.35 * Math.abs(Math.sin(T * 9 + i)) : 0);
      d.legs[0].rotation.x = sw * legSw; d.legs[1].rotation.x = sw * legSw; d.legs[2].rotation.x = -sw * legSw; d.legs[3].rotation.x = -sw * legSw;
      d.pos.y = Math.max(this.ground(d.pos), d.stageY ?? -1e9);
      d.root.position.copy(d.pos).addScaledVector(side, sideX); d.root.position.y += d.alt || 0; d.root.rotation.y = d.yaw + spin;
      d.body.position.y = 0.55 + hopY + (speed > 1 ? Math.abs(Math.sin(d.ph * 0.5)) * 0.18 * run : 0); d.body.rotation.x = -rear; d.body.rotation.z = wig;
      d.head.rotation.x = 0; d.jaw.position.y = -0.16 - (this.state === 'dance' ? 0.05 : 0);
      d.tail.rotation.z = Math.sin(this.clock * tailSp + i) * (this.state === 'dance' ? 0.75 : 0.5);
      d.cape.rotation.x = flap ? 1.0 + Math.sin(this.clock * 30 + i) * 0.45 : 1.3 + run * 0.22 + Math.sin(this.clock * 9 + i) * 0.1;
      this.spots[i].position.set(d.pos.x, d.pos.y, d.pos.z);
    }
    if (this.state === 'enter' && (T > 4 || this.dogs.every(d => d.pos.distanceTo(d.goal) < 0.6))) { this.state = 'dance'; this.t = 0; this.intro(); }
    else if (this.state === 'dance') { this.danced = T; if (Math.random() < dt * 7) this.confetti(this.dogs[(Math.random() * 2) | 0].pos, 6); if (T > DANCE) this.flyAway(); }
    else if (this.state === 'fly' && (T > 3.6 || this.dogs.every(d => d.alt > 55))) this.end();
  }
  // used when the level changes / the game resets
  reset() { if (this.active) this.end(); }
}
