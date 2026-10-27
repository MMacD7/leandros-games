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

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DOG_S = 2.5; // v4.4: cute small-terrier size next to the dino (v4.3 was 4.4, v4.2 was 2.1)
const HOP = 0.6;  // v4.4: hop heights scale with the dog, so lower hops keep them from floating up too high
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
  // ---- v5 SCUBA GEAR (toggleable add-on group, parented to head / body / feet so it follows every animation) ----
  const scuba = [];
  const rubber = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.5, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ae8ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45, emissive: 0x1a6a8a, emissiveIntensity: 0.4 });
  const tankM = new THREE.MeshStandardMaterial({ color: 0xffc81a, roughness: 0.3, metalness: 0.6, emissive: 0x3a2a00 });
  const finM = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.1, emissive: accent, emissiveIntensity: 0.2 });
  const add = (parent, mesh) => { parent.add(mesh); scuba.push(mesh); return mesh; };
  const frame = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.06), rubber)); frame.position.set(0, 0.07, 0.29);
  const lens = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.04), glass)); lens.position.set(0, 0.07, 0.315);
  const strap = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.025, 6, 22), rubber)); strap.rotation.x = Math.PI / 2; strap.position.set(0, 0.07, 0.02); strap.scale.set(1.02, 1.05, 1);
  const reg = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8), rubber)); reg.rotation.x = Math.PI / 2; reg.position.set(0.05, -0.12, 0.38);
  const tank = add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), tankM)); tank.rotation.x = Math.PI / 2 - 0.12; tank.position.set(0, 0.42, -0.08);
  const cap = add(body, new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), tankM)); cap.rotation.x = Math.PI / 2 - 0.12; cap.position.set(0, 0.455, 0.22);
  const valve = add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), metal)); valve.rotation.x = Math.PI / 2 - 0.12; valve.position.set(0, 0.47, 0.33);
  const hoseC = new THREE.CatmullRomCurve3([V(0, 0.47, 0.38), V(0.16, 0.5, 0.5), V(0.18, 0.3, 0.75), V(0.06, 0.29, 0.93)]);
  add(body, new THREE.Mesh(new THREE.TubeGeometry(hoseC, 10, 0.022, 5), rubber));
  for (const z of [-0.2, 0.12]) { const b = add(body, new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.025, 5, 20), rubber)); b.position.set(0, 0.04, z); b.scale.set(1.05, 0.95, 1); }
  for (const l of legs) { const f = add(l, new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.36), finM)); f.position.set(0, -0.4, 0.2); f.rotation.x = 0.12;
    const tip = add(l, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.12), finM)); tip.position.set(0, -0.415, 0.4); tip.rotation.x = 0.12; }
  for (const m of scuba) m.visible = false;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, body, head, jaw, tail, legs, cape, collar, torso, scuba, scubaOn: false };
}

// v5: put the scuba gear on (ocean) or take it off (land). The cape comes off underwater (the tank sits there).
export function setScuba(w, on) { on = !!on; if (w.scubaOn === on) return; w.scubaOn = on; for (const m of w.scuba) m.visible = on; w.cape.visible = !on; }

// ---- v5: a playable westie. Same interface the game uses on Beast/Mech (obj, height, mats, socketPos, footPos, animate, ...)
export const DOG_P = 3.3; // playable size: bigger than the helper dogs so he reads on an iPhone screen, still small next to a T-rex
export class Pup {
  constructor(def) {
    this.def = def; this.real = true; this.quad = true; this.flyer = false; this.westie = true;
    const w = buildWestie(def.id, def.accent); this.w = w;
    this.obj = new THREE.Group(); w.root.scale.setScalar(DOG_P); this.obj.add(w.root);
    const fur = w.torso.material, acc = w.collar.material;
    this.mats = { plate: fur, frame: acc, glow: acc, glowColor: new THREE.Color(def.accent).multiplyScalar(1.6) };
    this.meshes = []; this.obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.height = 1.3 * DOG_P; this.fitR = 1.1 * DOG_P; this.b = {}; this.sockets = {};
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
    w.body.position.y = 0.55 + Math.abs(Math.sin(ph)) * 0.16 * run + (o.rear || 0) * 0.15; w.body.rotation.x = -(o.rear || 0) * 0.7 + (fly ? -0.25 : 0);
    w.body.rotation.y = this.spin; w.body.rotation.z = this.ko * 0.5 + Math.sin(ph) * 0.05 * run;
    const bite = o.bite || 0, bark = Math.max(o.roar || 0, (o.jaw || 0) * 0.5);
    w.head.rotation.x = -0.35 * bite - 0.3 * bark + Math.sin(t * 2.2) * 0.04; w.jaw.position.y = -0.16 - 0.08 * Math.max(bite, bark);
    w.tail.rotation.z = Math.sin(t * (speed > 1 ? 30 : 18)) * 0.6;
    w.cape.rotation.x = fly || speed > 8 ? 1.0 + Math.sin(t * 30) * 0.4 : 1.3 + run * 0.2 + Math.sin(t * 9) * 0.1;
    this.flash = Math.max(0, this.flash - dt * 4); this.mats.plate.emissive.setRGB(0.165 + this.flash * 0.9, 0.157 + this.flash * 0.25, 0.15 + this.flash * 0.25);
  }
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
    for (const d of this.dogs) { d.vy = 0; d.alt = 0; d.root.scale.setScalar(DOG_S); d.bark = 0; d.hop = 0; d.spin = 0; d.root.visible = !d.off; setScuba(d, this.sea); }
    if (reason === 'button') { // v5 HELPER MODE: swoop in beside the player and follow
      this.helper = true; this.stage = null; const f = P.forward(V()), side = V(-f.z, 0, f.x);
      this.dogs.forEach((d, i) => { const s = i ? 1 : -1; d.stageY = null; d.pos.set(P.pos.x, 0, P.pos.z).addScaledVector(side, s * 26).addScaledVector(f, -12); d.alt = 9; d.yaw = P.yaw; });
      this.state = 'follow'; this.t = 0; return true;
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
    const solo = this.activeDogs().length === 1 ? this.activeDogs()[0].name : null;
    g.hud.banner(solo ? '🐶 ' + solo + '! 🐶' : '🐶 RICKY & BOBBY! 🐶', 4, true); document.getElementById('banner').classList.add('rb'); // banner sits high so it doesn't cover the dogs
    sfx.cheer && sfx.cheer(1);
    // natural words for speech (iOS spells out ALL-CAPS / stretched words); the drama comes from pitch + rate
    if (solo) { const nm = solo === 'RICKY' ? 'Ricky' : 'Bobby';
      voice.say('In this corner... weighing in at fifteen pounds of pure fluff... ' + nm + '!', { prio: 3, cd: 20000, pitch: 0.68, rate: 0.9 });
      voice.say(nm + ' is here to help, Leandro!', { prio: 3, cd: 20000, pitch: 0.8, rate: 1.12 }); }
    else { voice.say('In this corner... weighing in at fifteen pounds of pure fluff... Ricky!', { prio: 3, cd: 20000, pitch: 0.68, rate: 0.9 });
      voice.say('And his partner... Bobby!', { prio: 3, cd: 20000, pitch: 0.68, rate: 0.9 });
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
    this.dogs.forEach((d, i) => { d.vy = 2 + i * 0.6; d.alt = d.alt || 0; }); this.stage = null; }
  end() { this.state = 'off'; this.lastEnd = this.clock; this.helper = false; this.stage = null; this.target = null; for (const d of this.dogs) { d.root.visible = false; d.alt = 0; d.vy = 0; d.goalAlt = undefined; } for (const s of this.spots) s.visible = false; }
  update(dt) {
    this.clock += dt; const g = this.g;
    if (!this.active) { // occasional surprise visit while exploring
      if (g.mode === 'roam' && !g.battle && g.player && g.player.alive) { this.cool -= dt; if (this.cool <= 0) { this.cool = 150 + Math.random() * 150; this.trigger('roam'); } }
      return;
    }
    this.t += dt; const T = this.t, DANCE = 5;
    if (!this.helper && (this.state === 'dance' || this.state === 'enter') && T > 0.8 && this.danger()) this.flyAway(); // trouble nearby: up, up and away
    if (this.helper) this.helperLogic(dt, T);
    for (const [i, d] of this.dogs.entries()) {
      if (d.off) continue;
      let speed = 0, hopY = 0, spin = 0, rear = 0, wig = 0, sideX = 0, tailSp = 22, flap = 0;
      if (this.helper && this.state !== 'enter' && this.state !== 'dance' && this.state !== 'fly') { const a = this.anim(d, i, dt, T); speed = a.speed; hopY = a.hopY; flap = a.flap; rear = a.rear; spin = a.spin; tailSp = a.tailSp; }
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
        const sc = DOG_S * Math.max(0.05, 1 - Math.max(0, d.alt - 30) / 25); d.root.scale.setScalar(sc);
      }
      const side = V(Math.cos(d.yaw), 0, -Math.sin(d.yaw));
      d.ph += dt * (speed > 1 ? 16 : 5); const run = Math.min(1, speed / 8), sw = Math.sin(d.ph);
      const legSw = flap ? 0.6 : 0.9 * run + (this.state === 'dance' ? 0.35 * Math.abs(Math.sin(T * 9 + i)) : 0);
      d.legs[0].rotation.x = sw * legSw; d.legs[1].rotation.x = sw * legSw; d.legs[2].rotation.x = -sw * legSw; d.legs[3].rotation.x = -sw * legSw;
      d.pos.y = Math.max(this.ground(d.pos), d.stageY ?? -1e9);
      if (this.helper && this.state !== 'fly') { if (d.alt > 0 && d.goalAlt === undefined) d.alt = Math.max(0, d.alt - dt * 9); if (d.goalAlt !== undefined) d.alt += (d.goalAlt - d.alt) * Math.min(1, dt * 10); }
      d.root.position.copy(d.pos).addScaledVector(side, sideX); d.root.position.y += d.alt || 0; d.root.rotation.y = d.yaw + spin;
      d.body.position.y = 0.55 + hopY + (speed > 1 ? Math.abs(Math.sin(d.ph * 0.5)) * 0.18 * run : 0); d.body.rotation.x = -rear; d.body.rotation.z = wig;
      d.bark = Math.max(0, d.bark - dt); d.head.rotation.x = d.bark > 0 ? -0.25 * Math.sin(d.bark / 0.3 * Math.PI) : 0; d.jaw.position.y = -0.16 - (this.state === 'dance' ? 0.05 : 0) - (d.bark > 0 ? 0.06 : 0);
      d.tail.rotation.z = Math.sin(this.clock * tailSp + i) * (this.state === 'dance' ? 0.75 : 0.5);
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
      if (T > 3.2) { this.target = this.pickTarget();
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
    if (this.sea) { // v5 Deep Sea: they SWIM at the action's height (paddling flippers), a regulator bubble now and then
      const gd = this.ground(d.pos), bob = Math.sin(T * 2.4 + i * 2) * 0.5, e = this.target;
      if (this.state === 'follow' || this.state === 'cheer') d.goalAlt = Math.max(0.3, P.pos.y + P.mech.height * 0.35 - gd + bob + (this.state === 'cheer' ? 1.5 : 0));
      else if (e && this.state === 'hunt') d.goalAlt = Math.max(0.3, e.pos.y + e.mech.height * 0.4 - gd + bob);
      else if (e && this.state === 'maul') d.goalAlt = Math.max(0.3, (d.goalAlt || 0) + e.pos.y - gd);
      out.flap = 1; if (Math.random() < dt * 4) this.g.bubbles(d.head.getWorldPosition(V()), 2, 0.3, 4); }
    return out;
  }
  // used when the level changes / the game resets
  reset() { if (this.active) this.end(); }
}
