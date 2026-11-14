// v5.10.5: 24 spotted eggs on Jungle Island. Every hatched baby follows Leandro.
// The old cap of 4 (ids.slice(-FOLLOW)) dropped the newest baby or swapped it for an older one,
// so a hatch often looked like nothing came out. There is no cap any more.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneTrex, cloneBrachio, cloneGiga, cloneSpino, cloneTrike, cloneCarno, cloneRaptor, cloneAnky, cloneStego, cloneAllo, cloneDilo, clonePachy, clonePara } from './models.js';
import { music } from './music.js';
import { sfx } from './audio.js';
import { LAKE, VOLC } from './world.js';

const CLONE = { trex: cloneTrex, brachio: cloneBrachio, giga: cloneGiga, spinos: cloneSpino, trice: cloneTrike, carno: cloneCarno, velo: cloneRaptor, ankys: cloneAnky, stegos: cloneStego, allo: cloneAllo, dilo: cloneDilo, pachy: clonePachy, para: clonePara };
const NAMES = { trex: 'Baby T-Rex', brachio: 'Baby Brachio', giga: 'Baby Giga', spinos: 'Baby Spino', trice: 'Baby Trike', carno: 'Baby Carno', velo: 'Baby Raptor', ankys: 'Baby Anky', stegos: 'Baby Stego', allo: 'Baby Allo', dilo: 'Baby Dilo', pachy: 'Baby Pachy', para: 'Baby Para' };
const ADULT = { trex: 9.6, brachio: 11, giga: 6.5, spinos: 8.45, trice: 8, carno: 10, velo: 6.8, ankys: 8, stegos: 9, allo: 10, dilo: 7, pachy: 6, para: 9.5 };
const BABY = Object.fromEntries(Object.entries(ADULT).map(([id, n]) => [id, n * 0.25]));
const SPECIES = Object.keys(CLONE);

// e1–e12 keep their ids so an old 12-egg save still counts. e13–e24 are new.
// Positions sit on beach, river bank, waterfall, volcano base, canopy, hills, and near the start.
export const EGGS = [
  { id: 'e1', species: 'trex', x: 300, z: 300, where: 'beach' },
  { id: 'e2', species: 'brachio', x: 0, z: -150, where: 'volcano' },
  { id: 'e3', species: 'velo', x: 6, z: -64, where: 'falls' },
  { id: 'e4', species: 'giga', x: 200, z: -180, where: 'hill' },
  { id: 'e5', species: 'spinos', x: -180, z: 40, where: 'canopy' },
  { id: 'e6', species: 'para', x: 160, z: 90, where: 'hill' },
  { id: 'e7', species: 'carno', x: 380, z: -30, where: 'beach' },
  { id: 'e8', species: 'ankys', x: -80, z: 200, where: 'hill' },
  { id: 'e9', species: 'dilo', x: 40, z: 400, where: 'beach' },
  { id: 'e10', species: 'pachy', x: 70, z: -90, where: 'volcano' },
  { id: 'e11', species: 'stegos', x: -220, z: -160, where: 'canopy' },
  { id: 'e12', species: 'allo', x: 220, z: 140, where: 'hill' },
  { id: 'e13', species: 'trice', x: 48, z: 175, where: 'start' },
  { id: 'e14', species: 'trex', x: -28, z: 188, where: 'start' },
  { id: 'e15', species: 'brachio', x: 70, z: 240, where: 'start' },
  { id: 'e16', species: 'giga', x: -310, z: 260, where: 'beach' },
  { id: 'e17', species: 'spinos', x: 280, z: 250, where: 'beach' },
  { id: 'e18', species: 'carno', x: 48, z: -20, where: 'falls' },
  { id: 'e19', species: 'velo', x: -110, z: -20, where: 'volcano' },
  { id: 'e20', species: 'ankys', x: 96, z: 48, where: 'river' },
  { id: 'e21', species: 'stegos', x: 210, z: 55, where: 'river' },
  { id: 'e22', species: 'allo', x: -260, z: -30, where: 'canopy' },
  { id: 'e23', species: 'dilo', x: 110, z: -250, where: 'hill' },
  { id: 'e24', species: 'pachy', x: -150, z: 300, where: 'canopy' },
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
const EGG_GEO = new THREE.SphereGeometry(0.62 * 1.3, 12, 10);
EGG_GEO.scale(1, 1.28, 1);
const BEACON_GEO = new THREE.CylinderGeometry(0.18, 0.55, 7.5, 7, 1, true);
const BEACON_MAT = new THREE.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

function settle(world, x, z) {
  const lakeD = (px, pz) => Math.hypot(px - LAKE.x, pz - LAKE.z);
  const volcD = (px, pz) => Math.hypot(px - VOLC.x, pz - VOLC.z);
  for (let n = 0; n < 28; n++) {
    const h = world.height(x, z);
    const wet = h < 0.4 || lakeD(x, z) < 38;
    const crater = volcD(x, z) < 28;
    if (!wet && !crater && h < 90 && h > -0.2) return { x, z, h };
    if (crater) {
      const dx = x - VOLC.x, dz = z - VOLC.z, L = Math.hypot(dx, dz) || 1;
      x += dx / L * 10; z += dz / L * 10;
    } else if (lakeD(x, z) < 42) {
      const dx = x - LAKE.x, dz = z - LAKE.z, L = Math.hypot(dx, dz) || 1;
      x += dx / L * 10; z += dz / L * 10;
    } else {
      let best = null;
      for (let a = 0; a < 6.3; a += 0.7) {
        const nx = x + Math.cos(a) * 12, nz = z + Math.sin(a) * 12, nh = world.height(nx, nz);
        if (nh > 0.45 && lakeD(nx, nz) > 38 && volcD(nx, nz) > 28 && (!best || nh < best.h || (nh < 40 && best.h > 70))) best = { x: nx, z: nz, h: nh };
      }
      if (best) { x = best.x; z = best.z; } else break;
    }
  }
  const h = world.height(x, z);
  return { x, z, h: Math.max(h, 0.4) };
}

export class Eggs {
  constructor(game) {
    this.g = game;
    this.group = new THREE.Group(); this.group.name = 'eggs'; game.scene.add(this.group);
    this.list = []; this.followers = []; this.built = false; this.roarLatch = false; this.wasJungle = false;
    this.sync();
  }
  hatchedIds() { return Array.isArray(this.g.save.hatched) ? this.g.save.hatched : (this.g.save.hatched = []); }
  knownId(id) { return EGGS.some(e => e.id === id); }
  sync() {
    const jungle = !!(this.g.world && this.g.world.level === 'jungle' && !this.g.world.farm);
    if (jungle && !this.built) this.build();
    const back = jungle && !this.wasJungle && this.built;
    this.wasJungle = jungle;
    this.group.visible = jungle;
    for (const b of this.followers) b.obj.visible = jungle;
    if (back) this.gather();
  }
  gather() {
    for (const b of this.followers) b.snap = true;
  }
  build() {
    this.built = true;
    const done = new Set(this.hatchedIds());
    const world = this.g.world;
    EGGS.forEach((def, i) => {
      const spot = settle(world, def.x, def.z);
      const mat = new THREE.MeshStandardMaterial({ map: eggTexture(SPOTS[i % SPOTS.length]), roughness: 0.45, color: 0xffffff });
      const mesh = new THREE.Mesh(EGG_GEO, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(spot.x, spot.h + 0.94, spot.z);
      mesh.name = 'egg-' + def.id;
      const beacon = new THREE.Mesh(BEACON_GEO, BEACON_MAT);
      beacon.position.y = 4.2; beacon.name = 'egg-beacon'; mesh.add(beacon);
      this.group.add(mesh);
      const egg = { ...def, x: spot.x, z: spot.z, y: spot.h, mesh, beacon, hatched: done.has(def.id), phase: '', t: 0, hatching: false, chimed: false };
      if (egg.hatched) mesh.visible = false;
      this.list.push(egg);
    });
    this.refreshFollowers();
    this.hud();
  }
  hud() {
    const n = this.hatchedIds().filter(id => this.knownId(id)).length + '/' + EGGS.length;
    const el = document.getElementById('eggs-n'); if (el) el.textContent = n;
    const count = document.getElementById('babies-count'); if (count) count.textContent = n;
  }
  refreshFollowers() {
    const ids = this.hatchedIds().filter(id => this.knownId(id));
    for (const b of this.followers) if (!ids.includes(b.id)) { this.group.remove(b.obj); if (b.mixer) b.mixer.stopAllAction(); }
    this.followers = this.followers.filter(b => ids.includes(b.id));
    for (const id of ids) {
      if (this.followers.some(b => b.id === id)) continue;
      const egg = this.list.find(e => e.id === id) || EGGS.find(e => e.id === id);
      this.spawnBaby(egg, false);
    }
  }
  spawnBaby(egg, pop) {
    if (!egg || !egg.species || !CLONE[egg.species]) return null;
    if (this.followers.some(b => b.id === egg.id)) return this.followers.find(b => b.id === egg.id);
    let packed;
    try { packed = CLONE[egg.species](); } catch (err) { return null; }
    const scene = packed.scene;
    scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = true; } });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const target = BABY[egg.species] || 2;
    const s = target / Math.max(size.x, size.y, size.z, 0.001);
    scene.scale.setScalar(s);
    scene.updateMatrixWorld(true);
    const planted = new THREE.Box3().setFromObject(scene);
    if (Number.isFinite(planted.min.y)) scene.position.y -= planted.min.y;
    const obj = new THREE.Group(); obj.name = 'baby-' + egg.id; obj.add(scene); obj.visible = true;
    const p = this.g.player;
    const x = (egg.x != null ? egg.x : (p ? p.pos.x : 0));
    const z = (egg.z != null ? egg.z : (p ? p.pos.z : 0));
    obj.position.set(x, this.g.world.height(x, z), z);
    this.group.add(obj);
    const mixer = new THREE.AnimationMixer(scene);
    const actions = {};
    for (const clip of packed.animations || []) {
      const act = mixer.clipAction(clip);
      act.play(); act.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0); actions[clip.name] = act;
    }
    const baby = { id: egg.id, species: egg.species, name: NAMES[egg.species], obj, mixer, actions, clip: 'Idle', pop: pop ? 0.01 : 1, adult: ADULT[egg.species] || target / 0.25, target, roarT: 0, acc: 0, snap: false, hatching: false };
    this.followers.push(baby);
    this.play(baby, 'Idle');
    return baby;
  }
  play(b, name) {
    const next = b.actions[name] || b.actions.Idle; if (!next) return;
    if (b.clip === name) return;
    next.reset(); next.loop = name === 'Roar' ? THREE.LoopOnce : THREE.LoopRepeat; next.clampWhenFinished = name === 'Roar'; next.play(); b.clip = name;
    for (const [n, act] of Object.entries(b.actions)) act.setEffectiveWeight(n === (b.actions[name] ? name : 'Idle') ? 1 : 0);
  }
  slot(i, p, fwd, side) {
    const row = i >> 1, col = i % 2 === 0 ? -1 : 1;
    const back = (p.radius || 2) + 4.2 + row * 2.5;
    const lateral = col * (4.4 + (row % 3) * 0.35);
    return { x: p.pos.x - fwd.x * back + side.x * lateral, z: p.pos.z - fwd.z * back + side.z * lateral };
  }
  update(dt) {
    if (!this.built || !this.group.visible) return;
    const p = this.g.player; if (!p) return;
    const t = this.g.world.time || 0;
    BEACON_MAT.opacity = 0.16 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3));
    for (const e of this.list) {
      if (e.hatched && !e.hatching) continue;
      if (e.hatching) e.age = (e.age || 0) + dt;
      if (e.hatching && e.age > 2.2) { this.finishHatch(e); continue; }
      if (!e.phase) {
        const bob = Math.sin(t * 2.4 + e.x) * 0.08;
        e.mesh.position.y = e.y + 0.94 + bob;
        e.mesh.rotation.y = t * 0.6 + e.x;
        e.mesh.rotation.z = Math.sin(t * 1.7 + e.z) * 0.08;
        const d = Math.hypot(e.x - p.pos.x, e.z - p.pos.z);
        if (!e.chimed && d < 25 && p.alive) { e.chimed = true; sfx.squeak(0.55); }
        const reach = (p.radius || 2) + 2.4;
        if (p.alive && d < reach) this.beginHatch(e);
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
    if (roaring && !this.roarLatch) { this.roarLatch = true; for (const b of this.followers) { b.roarT = 0.7; if (this.followers.indexOf(b) < 6) sfx.squeakRoar && sfx.squeakRoar(); } }
    if (!roaring) this.roarLatch = false;
    const fwd = p.forward ? p.forward(new THREE.Vector3()) : new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    this.followers.forEach((b, i) => {
      b.pop = Math.min(1, b.pop + dt * 2.2);
      b.roarT = Math.max(0, b.roarT - dt);
      b.obj.visible = true;
      b.hatching = false;
      const slot = this.slot(i, p, fwd, side);
      const dx0 = slot.x - b.obj.position.x, dz0 = slot.z - b.obj.position.z;
      const away = dx0 * dx0 + dz0 * dz0;
      if (b.snap || away > 26 * 26) { b.obj.position.x = slot.x; b.obj.position.z = slot.z; b.snap = false; }
      else { b.obj.position.x += dx0 * Math.min(1, dt * 4); b.obj.position.z += dz0 * Math.min(1, dt * 4); }
      const hop = Math.abs(Math.sin(t * 7 + i)) * (p.speedNow > 0.4 ? 0.35 : 0.08);
      b.obj.position.y = this.g.world.height(b.obj.position.x, b.obj.position.z) + hop;
      const dx = slot.x - b.obj.position.x, dz = slot.z - b.obj.position.z;
      if (dx * dx + dz * dz > 0.04) b.obj.rotation.y = Math.atan2(dx, dz);
      b.obj.scale.setScalar(0.4 + 0.6 * b.pop);
      const far = i >= 8;
      b.acc += dt;
      if (!far || b.acc >= 0.18) { b.mixer.update(far ? b.acc : dt); b.acc = 0; }
      const moving = p.speedNow > 1.2 && i < 10;
      this.play(b, b.roarT > 0 && i < 8 ? 'Roar' : moving ? (p.speedNow > 8 ? 'Run' : 'Walk') : 'Idle');
    });
    this.hud();
  }
  beginHatch(e) {
    if (e.hatched || e.hatching) return;
    e.hatching = true; e.phase = 'wobble'; e.t = 0;
    music.hatch(); sfx.squeak(1);
    if (this.g.hud && this.g.hud.toast) this.g.hud.toast('🥚 The egg is wobbling!');
  }
  finishHatch(e) {
    if (e.hatched && this.followers.some(b => b.id === e.id)) { e.phase = ''; e.hatching = false; if (e.mesh) e.mesh.visible = false; return; }
    e.phase = ''; e.hatching = false;
    if (e.mesh) e.mesh.visible = false;
    const ids = this.hatchedIds();
    if (!ids.includes(e.id)) ids.push(e.id);
    if (this.g.persist) this.g.persist();
    let baby = this.followers.find(b => b.id === e.id) || this.spawnBaby(e, true);
    if (!baby) baby = this.spawnBaby(e, true);
    if (baby) {
      baby.pop = 0.05; baby.hatching = false; baby.obj.visible = true;
      baby.obj.position.set(e.x, this.g.world.height(e.x, e.z), e.z);
    }
    e.hatched = true;
    if (this.g.hud && this.g.hud.toast) this.g.hud.toast('🥚 ' + (NAMES[e.species] || 'A baby') + ' hatched!');
    if (this.g.fx) this.g.fx.sparks(new THREE.Vector3(e.x, e.y + 1, e.z), 16, { r: 1, g: 0.9, b: 0.4 }, 1);
    this.hud();
  }
  catalog() {
    const ids = new Set(this.hatchedIds());
    const follow = new Set(this.followers.map(b => b.id));
    return EGGS.map(e => ({ id: e.id, species: e.species, name: NAMES[e.species], where: (this.list.find(x => x.id === e.id) || e).where, hatched: ids.has(e.id), following: follow.has(e.id) }));
  }
}

export const BABY_NAMES = NAMES;
export const BABY_ADULT = ADULT;
export const EGG_SPECIES = SPECIES;
