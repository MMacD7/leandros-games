// v5.9.7: spotted cartoon eggs on Jungle Island. Hatch one and a baby (0.25x of a 3D dino we already have) pops out.
// Up to four babies follow Leandro. The rest wait on the BABY DINOS shelf. Kid-safe: collecting only adds a friend.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneTrex, cloneBrachio, cloneGiga, cloneSpino, cloneTrike, cloneCarno, cloneRaptor, cloneAnky, cloneStego } from './models.js';
import { music } from './music.js';
import { sfx } from './audio.js';
const CLONE = { trex: cloneTrex, brachio: cloneBrachio, giga: cloneGiga, spinos: cloneSpino, trice: cloneTrike, carno: cloneCarno, velo: cloneRaptor, ankys: cloneAnky, stegos: cloneStego };
const NAMES = { trex: 'Baby T-Rex', brachio: 'Baby Brachio', giga: 'Baby Giga', spinos: 'Baby Spino', trice: 'Baby Trike', carno: 'Baby Carno', velo: 'Baby Raptor', ankys: 'Baby Anky', stegos: 'Baby Stego' };
// Longest axis of the grown dino, so the baby is about a quarter of that.
const ADULT = { trex: 9.6, brachio: 11, giga: 6.5, spinos: 8.45, trice: 8, carno: 10, velo: 6.8, ankys: 8, stegos: 9 };
const BABY = Object.fromEntries(Object.entries(ADULT).map(([id, n]) => [id, n * 0.25]));
const FOLLOW = 4;

export const EGGS = [
  { id: 'e1', species: 'trex', x: 300, z: 300, where: 'beach' },
  { id: 'e2', species: 'brachio', x: 0, z: -150, where: 'volcano' },
  { id: 'e3', species: 'velo', x: 6, z: -64, where: 'falls' },
  { id: 'e4', species: 'giga', x: 200, z: -180, where: 'hill' },
  { id: 'e5', species: 'spinos', x: -180, z: 40, where: 'hill' },
  { id: 'e6', species: 'trice', x: 160, z: 90, where: 'hill' },
  { id: 'e7', species: 'carno', x: 380, z: -30, where: 'beach' },
  { id: 'e8', species: 'ankys', x: -80, z: 200, where: 'hill' },
  { id: 'e9', species: 'trex', x: 40, z: 400, where: 'beach' },
  { id: 'e10', species: 'brachio', x: 70, z: -90, where: 'volcano' },
  { id: 'e11', species: 'stegos', x: -220, z: -160, where: 'hill' },
  { id: 'e12', species: 'velo', x: 220, z: 140, where: 'hill' },
];

function eggTexture(spots) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff4d8'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffe7b0'; g.beginPath(); g.ellipse(64, 78, 40, 28, 0, 0, 7); g.fill();
  for (const s of spots) { g.fillStyle = s.c; g.beginPath(); g.ellipse(s.x, s.y, s.rx, s.ry, s.a || 0, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SPOTS = [
  [{ x: 40, y: 48, rx: 14, ry: 18, c: '#e23a4a' }, { x: 86, y: 70, rx: 16, ry: 12, c: '#2a8ae0' }, { x: 58, y: 96, rx: 12, ry: 10, c: '#f0c020' }],
  [{ x: 48, y: 40, rx: 12, ry: 16, c: '#3ec85a' }, { x: 90, y: 62, rx: 18, ry: 12, c: '#ff8a20' }, { x: 36, y: 90, rx: 14, ry: 11, c: '#c040e0' }],
  [{ x: 70, y: 44, rx: 15, ry: 12, c: '#20c0d0' }, { x: 34, y: 72, rx: 16, ry: 14, c: '#e23a6a' }, { x: 84, y: 100, rx: 12, ry: 10, c: '#ffe14a' }],
];

export class Eggs {
  constructor(game) {
    this.g = game;
    this.group = new THREE.Group(); this.group.name = 'eggs'; game.scene.add(this.group);
    this.list = []; this.followers = []; this.built = false; this.roarLatch = false;
    this.sync();
  }
  hatchedIds() { return Array.isArray(this.g.save.hatched) ? this.g.save.hatched : (this.g.save.hatched = []); }
  sync() {
    const jungle = !!(this.g.world && this.g.world.level === 'jungle' && !this.g.world.farm);
    if (jungle && !this.built) this.build();
    this.group.visible = jungle;
    for (const b of this.followers) b.obj.visible = jungle && !b.hatching;
  }
  build() {
    this.built = true;
    const done = new Set(this.hatchedIds());
    EGGS.forEach((def, i) => {
      const h = this.g.world.height(def.x, def.z);
      const geo = new THREE.SphereGeometry(0.62, 12, 10);
      geo.scale(1, 1.28, 1);
      const mat = new THREE.MeshStandardMaterial({ map: eggTexture(SPOTS[i % SPOTS.length]), roughness: 0.45, color: 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(def.x, h + 0.72, def.z);
      mesh.name = 'egg-' + def.id;
      this.group.add(mesh);
      const egg = { ...def, y: h, mesh, hatched: done.has(def.id), phase: '', t: 0 };
      if (egg.hatched) mesh.visible = false;
      this.list.push(egg);
    });
    this.refreshFollowers();
  }
  refreshFollowers() {
    const ids = this.hatchedIds();
    const want = ids.slice(-FOLLOW);
    for (const b of this.followers) if (!want.includes(b.id)) { this.group.remove(b.obj); b.mixer.stopAllAction(); }
    this.followers = this.followers.filter(b => want.includes(b.id));
    for (const id of want) if (!this.followers.some(b => b.id === id)) this.spawnBaby(this.list.find(e => e.id === id) || EGGS.find(e => e.id === id), false);
  }
  spawnBaby(egg, pop) {
    if (!egg || this.followers.some(b => b.id === egg.id)) return null;
    let packed;
    try { packed = CLONE[egg.species](); } catch (e) { return null; }
    const scene = packed.scene;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const target = BABY[egg.species];
    const s = target / Math.max(size.x, size.y, size.z, 0.001);
    scene.scale.setScalar(s);
    const planted = new THREE.Box3().setFromObject(scene);
    scene.position.y -= planted.min.y;
    const obj = new THREE.Group(); obj.name = 'baby-' + egg.id; obj.add(scene);
    const p = this.g.player;
    const x = p ? p.pos.x : egg.x, z = p ? p.pos.z : egg.z;
    obj.position.set(x, this.g.world.height(x, z), z);
    this.group.add(obj);
    const mixer = new THREE.AnimationMixer(scene);
    const actions = {};
    for (const clip of packed.animations || []) {
      const act = mixer.clipAction(clip);
      act.play(); act.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0); actions[clip.name] = act;
    }
    const baby = { id: egg.id, species: egg.species, name: NAMES[egg.species], obj, mixer, actions, clip: 'Idle', pop: pop ? 0.01 : 1, adult: ADULT[egg.species], target, roarT: 0, hopping: 0 };
    this.followers.push(baby);
    this.play(baby, 'Idle');
    return baby;
  }
  play(b, name) {
    const next = b.actions[name] || b.actions.Idle; if (!next) return;
    if (b.clip !== name) { next.reset(); next.loop = name === 'Roar' ? THREE.LoopOnce : THREE.LoopRepeat; next.clampWhenFinished = name === 'Roar'; next.play(); b.clip = name; }
    for (const [n, act] of Object.entries(b.actions)) act.setEffectiveWeight(n === (b.actions[name] ? name : 'Idle') ? 1 : 0);
  }
  nearest() {
    const p = this.g.player; if (!p) return null;
    let best = null;
    for (const e of this.list) {
      if (e.hatched) continue;
      const d = Math.hypot(e.x - p.pos.x, e.z - p.pos.z);
      if (!best || d < best.d) best = { egg: e, d };
    }
    return best;
  }
  update(dt) {
    if (!this.built || !this.group.visible) return;
    const p = this.g.player; if (!p) return;
    const t = this.g.world.time;
    for (const e of this.list) {
      if (e.hatched && e.phase !== 'crack' && e.phase !== 'wobble') continue;
      if (!e.phase) {
        e.mesh.position.y = e.y + 0.72 + Math.sin(t * 2 + e.x) * 0.06;
        e.mesh.rotation.y = t * 0.4;
        const reach = (p.radius || 2) + 2.4;
        if (p.alive && Math.hypot(e.x - p.pos.x, e.z - p.pos.z) < reach) this.beginHatch(e);
        continue;
      }
      e.t += dt;
      if (e.phase === 'wobble') {
        e.mesh.rotation.z = Math.sin(e.t * 28) * 0.35;
        e.mesh.rotation.x = Math.cos(e.t * 22) * 0.18;
        if (e.t > 0.55) { e.phase = 'crack'; e.t = 0; sfx.squeak(1.4); }
      } else if (e.phase === 'crack') {
        const u = Math.min(1, e.t / 0.4);
        e.mesh.scale.set(1 + u * 0.35, 1 - u * 0.45, 1 + u * 0.2);
        e.mesh.rotation.z = Math.sin(e.t * 40) * 0.5 * (1 - u);
        if (u >= 1) this.finishHatch(e);
      }
    }
    const roaring = p.roar > 0.25;
    if (roaring && !this.roarLatch) { this.roarLatch = true; for (const b of this.followers) { b.roarT = 0.7; sfx.squeakRoar(); } }
    if (!roaring) this.roarLatch = false;
    const fwd = p.forward ? p.forward(new THREE.Vector3()) : new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    this.followers.forEach((b, i) => {
      b.mixer.update(dt);
      b.pop = Math.min(1, b.pop + dt * 2.2);
      b.roarT = Math.max(0, b.roarT - dt);
      const slot = (p.radius || 2) + 2.2 + i * 1.5;
      const lateral = (i % 2 === 0 ? -1 : 1) * (1.1 + (i >> 1) * 0.8);
      const tx = p.pos.x - fwd.x * slot + side.x * lateral;
      const tz = p.pos.z - fwd.z * slot + side.z * lateral;
      b.obj.position.x += (tx - b.obj.position.x) * Math.min(1, dt * 4);
      b.obj.position.z += (tz - b.obj.position.z) * Math.min(1, dt * 4);
      const hop = Math.abs(Math.sin(t * 7 + i)) * (p.speedNow > 0.4 ? 0.45 : 0.12);
      b.obj.position.y = this.g.world.height(b.obj.position.x, b.obj.position.z) + hop;
      const dx = tx - b.obj.position.x, dz = tz - b.obj.position.z;
      if (dx * dx + dz * dz > 0.05) b.obj.rotation.y = Math.atan2(dx, dz);
      b.obj.scale.setScalar(0.35 + 0.65 * b.pop);
      const moving = p.speedNow > 1.2;
      this.play(b, b.roarT > 0 ? 'Roar' : moving ? (p.speedNow > 8 ? 'Run' : 'Walk') : 'Idle');
    });
    const n = document.getElementById('eggs-n');
    if (n) n.textContent = this.hatchedIds().length + '/' + EGGS.length;
  }
  beginHatch(e) {
    e.phase = 'wobble'; e.t = 0;
    music.hatch(); sfx.squeak(1);
    if (this.g.hud && this.g.hud.toast) this.g.hud.toast('🥚 The egg is wobbling!');
  }
  finishHatch(e) {
    e.hatched = true; e.phase = ''; e.mesh.visible = false;
    const ids = this.hatchedIds();
    if (!ids.includes(e.id)) ids.push(e.id);
    this.g.persist();
    this.refreshFollowers();
    const baby = this.followers.find(b => b.id === e.id);
    if (baby) { baby.pop = 0.01; baby.obj.position.set(e.x, e.y, e.z); }
    const waiting = !baby;
    if (this.g.hud && this.g.hud.toast) this.g.hud.toast(waiting ? '🥚 ' + NAMES[e.species] + ' is waiting in the garage!' : '🥚 ' + NAMES[e.species] + ' hatched!');
    if (this.g.fx) this.g.fx.sparks(new THREE.Vector3(e.x, e.y + 1, e.z), 16, { r: 1, g: 0.9, b: 0.4 }, 1);
  }
  catalog() {
    const ids = new Set(this.hatchedIds());
    const follow = new Set(this.followers.map(b => b.id));
    return EGGS.map(e => ({ id: e.id, species: e.species, name: NAMES[e.species], where: e.where, hatched: ids.has(e.id), following: follow.has(e.id) }));
  }
}

export const BABY_NAMES = NAMES;
export const BABY_ADULT = ADULT;
