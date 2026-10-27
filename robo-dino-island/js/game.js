// Gameplay: player + wild robot and real dinos, AI, weapons and natural attacks, pickups, battle arena rounds, chase camera.
import * as THREE from './vendor/three.bundle.min.js';
import { Mech } from './mech.js';
import { Beast } from './beast.js';
import { DINOS, DRAGON_KING, MEGA_REX, KRAKEN, MONSTER_MEG, statsFor } from './data.js';
import { SeaBeast } from './sea.js';
import { SURF } from './ocean.js';
import { Westies, Pup, setScuba } from './westies.js';
import { music } from './music.js';
import { BASE, ARENA, VOLC } from './world.js';
import { sfx } from './audio.js';
import { clamp, lerp, rng } from './noise.js';
import { Mayhem } from './mayhem.js';
import { Rider } from './rider.js';
import { FarmLife, KidMech, KID } from './farm.js';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const pool = new Map();
export const makeDino = (def, assets, wild) => def.farmKid ? new KidMech(def) : def.westie ? new Pup(def) : def.sea ? new SeaBeast(def) : def.real ? new Beast(def, assets, wild) : new Mech(def, assets, wild);
const ROID = ['spinotitan', 'megatrike', 'raptorpack', 'brachiotank', 'lavaanky', 'tptero']; // v5 "on steroids" dinos (every level)
const STAMPEDERS = ['raptorpack', 'velo', 'megatrike', 'trice', 'pachy', 'para', 'raptor'];
function getMech(def, assets, wild) { const k = def.id + (wild ? '!' : ''); const p = pool.get(k); if (p && p.length) return p.pop(); return makeDino(def, assets, wild); }
function freeMech(m) { const k = m.def.id + (m.wild ? '!' : ''); if (!pool.has(k)) pool.set(k, []); m.ko = 0; m.flash = 0; m.obj.scale.setScalar(1); m.obj.rotation.set(0, 0, 0); pool.get(k).push(m); }
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class Dino {
  constructor(game, def, wild, level = 1) {
    this.g = game; this.def = def; this.wild = wild; this.level = level;
    this.mech = getMech(def, game.assets, wild); game.scene.add(this.mech.obj);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.speedNow = 0; this.alive = true; this.koT = 0;
    this.radius = def.radius ?? (def.kind === 'bronto' ? 3.2 : def.kind === 'raptor' ? 1.4 : def.kind === 'ptero' ? 2 : 2.4) * def.scale;
    this.real = !!def.real; this.stunT = 0; this.slowT = 0; this.act = null; this.biteA = 0; this.chargeA = 0; this.whipA = 0; this.rearA = 0; this.air = 0;
    this.tilt = new THREE.Quaternion(); this.laserT = 0; this.missileT = 0; this.meleeT = 0; this.jaw = 0; this.roar = 0; this.side = 0;
    this.fly = !!def.fly; this.swim = !!def.swim; this.alt = 0; this.climb = 0; this.knock = new THREE.Vector3();
    this.dragon = !!def.dragon; this.rageT = 0; this.poisonT = 0; this.chill = 0; this.frozenT = 0; this.frillT = 0;
    if (wild && def.real) { const m = 0.55 + 0.17 * level; this.st = { hp: Math.round(def.hp * m), speed: def.speed * 0.8, laser: 0, bite: 4 + level * 2.2, rate: Math.max(0.9, def.biteRate * 2.2), missiles: 0, missileCD: def.specialCD * 2.4, melee: 4 + level * 2.2, roar: def.roar * 0.5, roarCD: 12, boost: 0 }; }
    else if (wild) { const m = 0.55 + 0.17 * level; this.st = { hp: Math.round(def.hp * m), speed: def.speed * 0.78, laser: 2.2 + level * 0.9, rate: 0.2, missiles: level >= 3 ? 2 : 0, missileCD: 9, melee: 6 + level * 2.5, boost: 0 }; }
    else this.st = statsFor(def, game.save.up);
    this.maxHp = this.st.hp; this.hp = this.maxHp; this.boostE = this.st.boost;
    this.ai = { state: 'patrol', t: 0, wp: null, home: new THREE.Vector3(), burst: 0, retreated: false };
  }
  get center() { return tmp2.set(this.pos.x, this.pos.y + this.mech.height * 0.5, this.pos.z); }
  forward(out) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  place(x, z, yaw = 0) { this.pos.set(x, this.g.world.height(x, z), z); this.yaw = yaw; if (this.fly) this.alt = this.def.sea ? 3 : 7; this.groundY(); if (this.fly) this.pos.y = this.def.sea ? this.ground + 0.6 + this.alt : Math.max(this.ground, 0) + 2 + this.alt; }
  groundY() { const w = this.g.world, h = w.height(this.pos.x, this.pos.z); this.ground = h;
    if (this.fly) { const sea = this.def.sea, base = sea ? h + 0.6 : Math.max(h, 0) + 2; let y = Math.max(base, base + this.alt); if (w.ocean) y = Math.min(y, Math.max(base, SURF - 3 - this.mech.height)); this.pos.y = lerp(this.pos.y, y, sea ? 0.25 : 0.15); } // v5: swimmers hug the sea floor, nobody leaves the water
    else if (this.swim && h < -0.8 && !w.lava) this.pos.y = lerp(this.pos.y, Math.max(h, -1.7), 0.2);
    else this.pos.y = h;
    if (this.jy > 0) this.pos.y += this.jy; } // v5: westie jumps / flying hops
  hit(dmg, from, attacker, quiet) {
    if (!this.alive) return;
    if (this.shieldT > 0) { this.mech.flash = 0.4; return; }
    this.hp -= dmg; this.mech.flash = quiet ? Math.max(this.mech.flash, 0.5) : 1; this.g.onHit(this, dmg, attacker, quiet);
    if (from) { tmp.subVectors(this.pos, from).setY(0).normalize(); this.knock.addScaledVector(tmp, Math.min(8, dmg * 0.25) * (this.boss ? 0.15 : 1)); }
    if (this.wild && this.ai.state === 'patrol') this.ai.state = 'chase';
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.koT = 0; this.g.onKO(this, attacker); }
  }
  move(dt, dir, mag, boost) {
    const w = this.g.world;
    if (this.stunT > 0) mag = 0;
    const spd = this.st.speed * (boost ? (this.def.glide ? 2.4 : 1.75) : 1) * (this.slowT > 0 ? 0.45 : 1) * (this.rageT > 0 ? 1.4 : 1) * (this.swim && this.ground < -0.8 ? 1.3 : 1) * (!this.swim && !this.fly && this.ground < -0.4 ? 0.6 : 1);
    if (mag > 0.05) {
      const want = Math.atan2(dir.x, dir.z), d = angDiff(this.yaw, want), tr = (this.def.kind === 'raptor' ? 6 : 4) * (boost ? 0.8 : 1);
      this.turn = clamp(d, -1, 1); this.yaw += clamp(d, -tr * dt, tr * dt);
      const k = Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(d))));
      this.speedNow = lerp(this.speedNow, spd * mag * k, Math.min(1, dt * 6));
    } else { this.speedNow = lerp(this.speedNow, 0, Math.min(1, dt * 7)); this.turn = 0; }
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += Math.sin(this.yaw) * this.speedNow * dt + this.knock.x * dt; this.pos.z += Math.cos(this.yaw) * this.speedNow * dt + this.knock.z * dt;
    this.knock.multiplyScalar(Math.max(0, 1 - dt * 5));
    // water: only swimmers and flyers go deep
    const h = w.height(this.pos.x, this.pos.z);
    if (!this.fly && (!this.swim || this.g.world.lava) && h < -1.6) { this.pos.x = ox; this.pos.z = oz; this.speedNow *= 0.5; }
    const r = Math.hypot(this.pos.x, this.pos.z); if (r > 380) { this.pos.x *= 380 / r; this.pos.z *= 380 / r; }
    const hitB = w.collide(this.pos, this.radius * 0.6, this.fly && this.alt > 4 || this.jy > 6); if (hitB && w.city) w.city.slam(this, hitB, dt); // v5: smash into buildings
    this.groundY();
  }
  updateVisual(dt) {
    const m = this.mech, w = this.g.world;
    // v5 LOD: far dinos skip shadows, animate at a lower rate, and are hidden beyond the draw distance (keeps big waves iPad-friendly)
    if (this !== this.g.player) { const cp = this.g.camera.position, dd = Math.hypot(this.pos.x - cp.x, this.pos.z - cp.z), far = dd > 95, Q = this.g.quality;
      if (far !== this._far) { this._far = far; for (const mm of m.meshes) mm.castShadow = !far; }
      m.obj.visible = dd < Math.min(330, (Q && Q.draw) || 400, w.drawCap ? w.drawCap / 0.75 * 0.9 : 1e9) * 0.75;
      if (!m.obj.visible) { m.obj.position.copy(this.pos); return; }
      if (far) { this._lodT = (this._lodT || 0) + dt; if (this._lodSkip = !this._lodSkip) { m.obj.position.copy(this.pos); return; } dt = this._lodT; } this._lodT = 0; }
    const n = w.normalAt(this.pos.x, this.pos.z, tmp);
    if (this.fly || (this.swim && this.ground < -0.8)) n.set(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, n.lerp(up, this.mech.quad ? 0.35 : 0.65).normalize());
    this.tilt.slerp(q, Math.min(1, dt * 6));
    m.obj.position.copy(this.pos);
    m.obj.quaternion.copy(this.tilt).multiply(new THREE.Quaternion().setFromAxisAngle(up, this.yaw));
    if (!this.alive) {
      m.ko = Math.min(1, m.ko + dt * 1.6);
      const e = 1 - Math.pow(1 - m.ko, 3);
      m.obj.rotateZ(e * 1.35 * (this.side || 1)); m.obj.position.y -= e * 0.6 * this.def.scale;
    }
    this.jaw = Math.max(0, this.jaw - dt * 3); this.roar = Math.max(0, this.roar - dt * 1.2); this.biteA = Math.max(0, this.biteA - dt * 4); this.slowT -= dt;
    const ro = this.real ? sstep(0, 0.35, this.roar) : (this.roar > 0.2 ? 1 : 0);
    m.animate(dt, this.alive ? this.speedNow : 0, { jaw: Math.max(this.jaw, this.roar > 0 ? 1 : 0), roar: ro, turn: this.turn || 0, flying: this.fly, boost: this.boosting, climb: this.climb,
      bite: Math.sin(this.biteA * Math.PI), charge: this.chargeA, whip: this.whipA, rear: this.rearA, air: this.air, pant: this.boosting ? 1 : 0, look: this.look || 0, frill: this.frillT > 0 || this.breathT > 0 });
    this.status(dt);
    // heavy footsteps: thump, dust at the foot and a camera rumble for big dinos near the camera
    if (!this.fly && this.alive && this.speedNow > 1.5 && !this.air) { const s = Math.sin(m.phase * (m.quad ? 1 : 1)); if ((s > 0) !== (this._lastS > 0)) this.g.footstep(this, s > 0 ? 0 : 1); this._lastS = s; }
  }
  // status effects: berserk rage, venom, frost/freeze + dragon wing-beat whooshes
  status(dt) {
    const m = this.mech, fx = this.g.fx, cp = this.g.camera.position, near = Math.hypot(this.pos.x - cp.x, this.pos.z - cp.z) < 110;
    this.frillT -= dt;
    if (this.rageT > 0) { this.rageT -= dt; m.mats.plate.emissive.setRGB(0.35 + 0.15 * Math.sin(this.g.world.time * 12), 0.04, 0.02);
      if (near && Math.random() < 0.6 * fx.k) fx.glow.spawn({ pos: { x: this.pos.x + (Math.random() - 0.5) * this.radius * 1.6, y: this.pos.y + Math.random() * m.height, z: this.pos.z + (Math.random() - 0.5) * this.radius * 1.6 }, vel: { x: 0, y: 4, z: 0 }, size: 0.5, size1: 0.1, life: 0.6, r: 3, g: 0.4, b: 0.15, alpha: 1 }); }
    if (this.poisonT > 0) { this.poisonT -= dt; this.poisonTick = (this.poisonTick || 0) - dt;
      if (this.poisonTick <= 0 && this.alive && !this.g.mh.safe) { this.poisonTick = 0.5; this.hit(this === this.g.player ? 1.5 : 3.5, null, this.poisonBy, true); }
      if (near && Math.random() < 0.4 * fx.k) fx.glow.spawn({ pos: { x: this.pos.x + (Math.random() - 0.5) * this.radius, y: this.pos.y + m.height * (0.4 + Math.random() * 0.5), z: this.pos.z + (Math.random() - 0.5) * this.radius }, vel: { x: 0, y: 2.5, z: 0 }, size: 0.35, size1: 0.6, life: 0.7, r: 0.6, g: 2.4, b: 0.3, alpha: 0.9 }); }
    this.chill = Math.max(0, this.chill - dt * 0.25);
    if (this.frozenT > 0) { this.frozenT -= dt; m.mats.plate.emissive.setRGB(0.22, 0.45, 0.75);
      if (near && Math.random() < 0.5 * fx.k) fx.glow.spawn({ pos: { x: this.pos.x + (Math.random() - 0.5) * this.radius * 1.5, y: this.pos.y + Math.random() * m.height, z: this.pos.z + (Math.random() - 0.5) * this.radius * 1.5 }, vel: { x: 0, y: 0.6, z: 0 }, size: 0.3, size1: 0.05, life: 0.8, r: 1.8, g: 2.5, b: 3, alpha: 1 }); }
    if (this.real && this.fly && this.alive && m.flyer) { const s = m.flapS || 0; if (s < -0.85 && !this._fl) { this._fl = true; const v = this === this.g.player ? 0.6 : near ? 0.3 : 0; if (v) sfx.flap(v * Math.min(1.5, this.def.scale));
        if (this.alt < 10 && near) { const gp = this.pos.clone(); gp.y = Math.max(0, this.ground) + 0.3; fx.dust(gp, 3, 2 * this.def.scale, 9); } } if (s > 0.2) this._fl = false; }
  }
  remove() { const R = this.g.rider; if (R && (R.mounted === this.mech || R.popOf === this)) { R.unmount(); R.popOf = null; } this.g.scene.remove(this.mech.obj); this.act = null; freeMech(this.mech); }
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // renderer, scene, camera, world, fx, assets, save, input, hud, persist
    this.enemies = []; this.bolts = []; this.pickups = []; this.player = null; this.mode = 'roam';
    this.cam = { yaw: Math.PI, pitch: 0.2, dist: 14, pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.respawnT = 0; this.spawnT = 1; this.lock = null; this.r = rng(99);
    this.buildPickups();
    const lockGeo = new THREE.RingGeometry(0.85, 1, 32); lockGeo.rotateX(-Math.PI / 2);
    this.lockRing = new THREE.Mesh(lockGeo, new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.lockRing.visible = false; this.scene.add(this.lockRing);
    this.dummy = { pos: new THREE.Vector3(), alive: true, mech: { height: 0 }, radius: 1.5 };
    this.shots = []; this.orbs = []; this.timers = []; this.slowmo = 0; this.level = 'jungle';
    this.mh = new Mayhem(this);
    this.rider = new Rider(); this.rider.groundAt = (x, z) => Math.max(0, this.world.height(x, z));
    this.westies = new Westies(this);
    this.bindFarm();
  }
  // v5.1 Farty Poop Farm: the living farm (animals, poop, horse, Bad David) belongs to the farm world
  bindFarm() { const w = this.world; this.farm = w && w.farm ? (w.farmLife || (w.farmLife = new FarmLife(this, w))) : null; }
  mountRider() { const R = this.rider, p = this.player; R.unmount(); R.reset(); if (p && this.save.ride !== false && !p.def.westie && !p.def.sea && !p.def.farmKid && !(this.world && this.world.ocean)) R.mount(p.mech); } // Leandro doesn't ride the dogs (or go under the sea without scuba gear)
  later(t, fn) { this.timers.push({ t, fn }); }
  get westiesOn() { return !!this.westies; }

  // ---------- setup ----------
  spawnPlayer(atArena) {
    if (this.player) this.player.remove();
    let def = DINOS.find(d => d.id === this.save.selected) || DINOS[0]; const oc = this.world && this.world.ocean, by = id => DINOS.find(d => d.id === id);
    if (oc && !def.sea && !def.westie) def = by(this.save.seaSel) || by('shark'); else if (!oc && def.sea) def = by(this.save.landSel) || by('rex'); // v5: sea creatures swim in the Deep Sea, land dinos stomp on land
    if (this.world && this.world.farm) { def = KID; if (this.farm) { this.farm.riding = false; this.farm.kidSpeed = null; } } // v5.1: on the farm you ARE Leandro
    const p = new Dino(this, def, false); this.player = p; if (def.farmKid) { p.mech.setRide(false); p.mech.mud = 0; } if (def.westie) setScuba(p.mech.w, oc); // Ricky / Bobby dive in scuba gear this.mountRider();
    if (atArena) p.place(ARENA.x - 30, ARENA.z, Math.PI / 2); else p.place(BASE.x, BASE.z - 6, Math.PI);
    this.cam.yaw = p.yaw + Math.PI; this.snapCam = true;
    if (this.hud.actions) this.hud.actions(def);
    return p;
  }
  clearEnemies() { this.enemies.forEach(e => e.remove()); this.enemies = []; }
  spawnEnemy(x, z, level, defId) {
    // wild island life is a mix of real dinos and robots (alternating-ish so both always show up)
    this.mixN = (this.mixN || 0) + 1; const wantReal = this.r() < 0.35 ? this.r() < 0.5 : this.mixN % 2 === 0;
    let pickFrom;
    const roidNow = this.r() < 0.3 && this.level !== 'ocean'; // v5: the supercharged dinos show up everywhere (on land)
    if (roidNow) pickFrom = DINOS.filter(d => ROID.includes(d.id) && !(d.fly && this.mode === 'battle' && this.level !== 'peak'));
    else if (this.level === 'peak') { // Dragon Peak: dragons rule the skies, plus the new dinos and mechs on the ground
      const NEW = ['giga', 'allo', 'dilo', 'pachy', 'para', 'gmech', 'dblast', 'trex', 'rex'];
      pickFrom = this.mixN % 2 === 0 ? DINOS.filter(d => d.dragon) : DINOS.filter(d => NEW.includes(d.id) && d.real === wantReal); }
    else if (this.level === 'city') { // Mega City: big stompers + mechs + the occasional dragon over the rooftops
      const CITY = ['trex', 'giga', 'allo', 'spinos', 'trice', 'ankys', 'stegos', 'pachy', 'velo', 'carno', 'rex', 'gmech', 'tri', 'raptor', 'spino', 'ankylo', 'bronto', 'dblast'];
      pickFrom = this.mixN % 7 === 0 && this.mode !== 'battle' ? DINOS.filter(d => d.dragon) : DINOS.filter(d => CITY.includes(d.id) && d.real === wantReal); }
    else if (this.level === 'ocean') { // v5 Deep Sea: sharks, rays, octopuses, jellyfish, anglers, serpents, crabs (+ a rare megalodon)
      const OCEAN = ['shark', 'stingray', 'octopus', 'jellyfish', 'angler', 'serpent', 'crab', 'shark']; if (this.r() < 0.12) OCEAN.push('megalodon'); pickFrom = DINOS.filter(d => OCEAN.includes(d.id)); }
    else { const PEAK_ONLY = ['giga', 'allo', 'dilo', 'gmech', 'dblast']; // Jungle Island keeps its classic cast (+ Pachy and Para); the big new hunters live on Dragon Peak
      pickFrom = DINOS.filter(d => d.real === wantReal && !d.dragon && !d.westie && !ROID.includes(d.id) && !PEAK_ONLY.includes(d.id) && !(d.fly && this.mode === 'battle')); }
    const oc = this.level === 'ocean'; pickFrom = pickFrom.filter(d => !d.westie && (oc ? d.sea : !d.sea)); if (!pickFrom.length) pickFrom = DINOS.filter(d => d.real && !d.westie && !d.dragon && (oc ? d.sea : !d.sea));
    const def = defId ? DINOS.find(d => d.id === defId) : pickFrom[(this.r() * pickFrom.length) | 0];
    const e = new Dino(this, def, true, level); e.place(x, z, this.r() * 6.28); e.ai.home.set(x, 0, z); e.laserT = 1 + this.r(); e.missileT = 2 + this.r() * 3; e.meleeT = 2;
    this.enemies.push(e); return e;
  }
  roamSpawnPoint() {
    for (let t = 0; t < 40; t++) {
      const a = this.r() * Math.PI * 2, d = 60 + this.r() * 220, x = Math.cos(a) * d * 0.9, z = Math.sin(a) * d * 0.9;
      const h = this.world.height(x, z);
      if (h < 1.5 || h > 40) continue; if (Math.hypot(x - BASE.x, z - BASE.z) < 75) continue;
      if (this.player && Math.hypot(x - this.player.pos.x, z - this.player.pos.z) < 45) continue;
      if (this.player && t < 30 && Math.hypot(x - this.player.pos.x, z - this.player.pos.z) > 200) continue; // v5: keep new arrivals near the action (far ones despawn at 260 m)
      if (Math.hypot(x - VOLC.x, z - VOLC.z) < 30) continue;
      if (this.world.city && this.world.city.blocked(x, z, 5)) continue; // not inside a skyscraper
      return [x, z, 1 + Math.min(3, Math.floor(Math.hypot(x - BASE.x, z - BASE.z) / 90))];
    }
    return [ARENA.x, ARENA.z, 2];
  }

  buildPickups() {
    const coreGeo = new THREE.OctahedronGeometry(0.7, 0), scrapGeo = new THREE.TorusGeometry(0.45, 0.18, 6, 8), boltGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 6);
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x40f0ff).multiplyScalar(1.6), toneMapped: false });
    const scrapMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, metalness: 1, roughness: 0.3 });
    const boltMat = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.25, emissive: 0x4a2a00 });
    this.pk = { core: new THREE.InstancedMesh(coreGeo, coreMat, 80), scrap: new THREE.InstancedMesh(scrapGeo, scrapMat, 80), bolt: new THREE.InstancedMesh(boltGeo, boltMat, 160) };
    Object.values(this.pk).forEach(m => { m.count = 0; m.frustumCulled = false; this.scene.add(m); });
    this.placePickups();
  }
  placePickups() {
    this.pickups = []; if (this.world.farm) return; // v5.1: no robot parts lying around the farm
    const r = rng(this.world.peak ? 4321 : 1234);
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2, d = 20 + r() * 260, x = Math.cos(a) * d, z = Math.sin(a) * d, h = this.world.height(x, z);
      if (h < 1.2 || h > 45) continue;
      this.pickups.push({ type: r() < 0.4 ? 'core' : 'scrap', x, z, y: h, alive: true, t: 0, ph: r() * 6 });
    }
  }
  // switch level (Jungle Island <-> Dragon Peak)
  setWorld(w) {
    if (this.westies) this.westies.reset();
    this.world = w; this.level = w.level; this.mh.setWorld(w); this.placePickups(); this.bolts = []; this.bindFarm();
  }
  dropBolts(pos, n) { for (let i = 0; i < n; i++) { const a = this.r() * 6.28, s = 4 + this.r() * 6; this.bolts.push({ x: pos.x, y: pos.y + 2, z: pos.z, vx: Math.cos(a) * s, vy: 8 + this.r() * 6, vz: Math.sin(a) * s, t: 0, v: 3 }); } }

  // ---------- modes ----------
  startRoam() { this.mode = 'roam'; this.clearEnemies(); if (this.farm) this.farm.reset(); this.spawnPlayer(false); this.spawnT = 0.5; this.battle = null; }
  startBattle() {
    if (this.world && this.world.farm) { this.hud.toast('🚜 No battles on the farm! Feed the animals instead 🐮'); return; }
    if (this.westies) { this.westies.reset(); if (this.r() < 0.3) this.later(2.5, () => this.westies.trigger('battle')); }
    this.mode = 'battle'; this.clearEnemies(); this.spawnPlayer(true);
    this.battle = { t: 90, wave: 0, kos: 0, bolts: 0, over: false, boss: null, bosses: 0 }; this.mh.resetArena(); this.nextWave();
  }
  bossWave() {
    if (this.level === 'peak') return this.dragonKing();
    if (this.level === 'city') return this.megaRex();
    if (this.level === 'ocean') return this.krakenBoss();
    const b = this.battle, k = (b.wave / 3) | 0, real = k % 2 === 0, base = DINOS.find(d => d.id === (real ? 'trex' : 'rex')), S = 2.1;
    const def = { ...base, id: 'boss-' + base.id, name: real ? 'TITAN T-REX' : 'MEGA ROBO-REX', scale: base.scale * S, radius: (base.radius ?? 2.4 * base.scale) * S, boss: true };
    const e = new Dino(this, def, true, 4); e.boss = true; e.place(ARENA.x + 20, ARENA.z, -Math.PI / 2); e.ai.home.copy(ARENA); e.ai.state = 'chase';
    const hp = 520 + 180 * (k - 1); e.st = { ...e.st, hp, speed: e.st.speed * 0.9, laser: e.st.laser * 1.8, melee: e.st.melee * 1.5, bite: e.st.bite * 1.3, missiles: real ? 0 : 3, missileCD: 6, rate: real ? e.st.rate : 0.2 };
    e.maxHp = e.hp = hp; e.laserT = 2.5; e.missileT = 4; e.meleeT = 3; e.roar = 1.7; this.enemies.push(e);
    for (let i = 0; i < 2; i++) { const m = this.spawnEnemy(ARENA.x + 24, ARENA.z + (i ? 16 : -16), 2); m.ai.state = 'chase'; m.ai.home.copy(ARENA); m.yaw = -Math.PI / 2; }
    b.boss = e; b.bosses++; b.t += 30;
    this.hud.banner('⚠️ BOSS WAVE ⚠️', 4); this.hud.say?.('Boss incoming!', { prio: 2 }); if (this.westies && this.r() < 0.5) this.later(5, () => this.westies.trigger('boss')); this.hud.toast(def.name + ' has arrived!  +30s');
    sfx.bigRoar(0.55, 1.2, !real); sfx.bigBoom(1); this.fx.boom(new THREE.Vector3(e.pos.x, e.pos.y + 2, e.pos.z), 2.2, { groundY: e.pos.y, shake: 1.4 }); this.fx.ring(e.pos, 30, 0xff3020);
  }
  // Dragon Peak boss: the giant DRAGON KING, hovering over the castle arena
  dragonKing() {
    const b = this.battle, k = (b.wave / 3) | 0, def = { ...DRAGON_KING };
    const e = new Dino(this, def, false, 4); e.wild = true; e.boss = true; e.king = true; e.place(ARENA.x + 24, ARENA.z, -Math.PI / 2); e.alt = 14; e.ai.home.copy(ARENA); e.ai.state = 'chase';
    const hp = 760 + 220 * (k - 1); e.st = { hp, speed: 13, laser: 0, bite: 22, rate: 1.0, missiles: 0, missileCD: 6.5, melee: 22, roar: 1.4, roarCD: 9, boost: 0 };
    e.maxHp = e.hp = hp; e.laserT = 2.5; e.missileT = 5; e.meleeT = 3; e.barrageT = 8; e.roar = 1.7; this.enemies.push(e);
    for (let i = 0; i < 2; i++) { const m = this.spawnEnemy(ARENA.x + 24, ARENA.z + (i ? 18 : -18), 2); m.ai.state = 'chase'; m.ai.home.copy(ARENA); m.yaw = -Math.PI / 2; }
    b.boss = e; b.bosses++; b.t += 35;
    this.hud.banner('🐉 THE DRAGON KING 🐉', 4); this.hud.say?.('Dragon King incoming!', { prio: 2 }); if (this.westies && this.r() < 0.5) this.later(5, () => this.westies.trigger('boss')); this.hud.toast('The DRAGON KING has arrived!  +35s');
    sfx.bigRoar(0.42, 1.3, false); sfx.thunder(1); sfx.bigBoom(1); this.fx.boom(new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z), 2.4, { groundY: e.ground, shake: 1.5 }); this.fx.ring(new THREE.Vector3(e.pos.x, e.ground, e.pos.z), 34, 0xffa020);
    for (let i = 0; i < 4; i++) this.later(0.1 + i * 0.12, () => this.fx.zap(new THREE.Vector3(e.pos.x + (Math.random() - 0.5) * 30, e.pos.y + 60, e.pos.z + (Math.random() - 0.5) * 30), e.center.clone(), { r: 1, g: 0.85, b: 0.5 }, 0.6, 0.25, 0.1));
    if (this.world.flash) this.world.flash(1);
  }
  // v5 City boss: MEGA-REX, a kaiju-sized armored Giganotosaurus that flattens buildings as it walks
  megaRex() {
    const b = this.battle, k = (b.wave / 3) | 0, def = { ...MEGA_REX };
    const e = new Dino(this, def, true, 4); e.boss = true; e.mega = true; e.place(ARENA.x + 26, ARENA.z, -Math.PI / 2); e.ai.home.copy(ARENA); e.ai.state = 'chase';
    const hp = 900 + 260 * (k - 1); e.st = { ...e.st, hp, speed: 12, bite: 26, rate: 1.0, missileCD: 4.5, melee: 26, roar: 1.6, roarCD: 8 };
    e.maxHp = e.hp = hp; e.laserT = 2; e.missileT = 3; e.meleeT = 3; e.roar = 1.7; this.enemies.push(e);
    for (let i = 0; i < 3; i++) { const m = this.spawnEnemy(ARENA.x + 26, ARENA.z + (i - 1) * 18, 3); m.ai.state = 'chase'; m.ai.home.copy(ARENA); m.yaw = -Math.PI / 2; }
    b.boss = e; b.bosses++; b.t += 40;
    this.hud.banner('🦖 MEGA-REX 🦖', 4); this.hud.say?.('Mega Rex is stomping into the city! Get him, Leandro!', { prio: 2 }); if (this.westies && this.r() < 0.5) this.later(5, () => this.westies.trigger('boss')); this.hud.toast('MEGA-REX has arrived!  +40s');
    sfx.bigRoar(0.38, 1.4, false); sfx.bigBoom(1.3); sfx.rumble(3, 1); this.fx.boom(new THREE.Vector3(e.pos.x, e.pos.y + 3, e.pos.z), 2.8, { groundY: e.pos.y, shake: 1.8 }); this.fx.ring(e.pos, 40, 0xff3020); this.fx.ring(e.pos, 24, 0xffffff);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; this.fx.chunk(e.pos.clone().add(new THREE.Vector3(Math.cos(a) * 8, 1, Math.sin(a) * 8)), { x: Math.cos(a) * 12, y: 14 + this.r() * 8, z: Math.sin(a) * 12 }, 1.2); }
    music.bossHit && music.bossHit();
  }
  // v5 Deep Sea boss: THE KRAKEN rises from the deep (every other boss wave: a MONSTER MEGALODON)
  krakenBoss() {
    const b = this.battle, k = (b.wave / 3) | 0, mons = k % 2 === 0, def = mons ? { ...MONSTER_MEG } : { ...KRAKEN };
    const e = new Dino(this, def, true, 4); e.boss = true; e.kraken = !mons; e.place(ARENA.x + 28, ARENA.z, -Math.PI / 2); e.alt = 6; e.ai.home.copy(ARENA); e.ai.state = 'chase';
    const hp = (mons ? 950 : 1100) + 260 * (k - 1); e.st = { ...e.st, hp, speed: mons ? 15 : 10.5, bite: mons ? 32 : 26, rate: 0.9, missileCD: mons ? 4 : 4.5, melee: 26, roar: 1.6, roarCD: 8 };
    e.maxHp = e.hp = hp; e.laserT = 2; e.missileT = 3; e.meleeT = 3; e.roar = 1.7; this.enemies.push(e);
    for (let i = 0; i < 3; i++) { const m = this.spawnEnemy(ARENA.x + 26, ARENA.z + (i - 1) * 18, 3); m.ai.state = 'chase'; m.ai.home.copy(ARENA); m.yaw = -Math.PI / 2; }
    b.boss = e; b.bosses++; b.t += 40;
    this.hud.banner(mons ? '🦈 MONSTER MEGALODON 🦈' : '🐙 THE KRAKEN 🐙', 4); this.hud.say?.(mons ? 'A monster megalodon! Chomp it, Leandro!' : 'The Kraken is rising from the deep! Get him, Leandro!', { prio: 2 });
    if (this.westies && this.r() < 0.5) this.later(5, () => this.westies.trigger('boss')); this.hud.toast(def.name + ' has arrived!  +40s');
    sfx.bigRoar(0.32, 1.4, false); sfx.bigBoom(1.2); sfx.rumble(3, 1); sfx.bubbles && sfx.bubbles(1.2, 14); this.fx.ring(e.pos, 40, 0x40e0ff); this.fx.ring(e.pos, 24, 0xffffff); this.fx.shake = Math.max(this.fx.shake, 1.6);
    this.bubbles(e.center.clone(), 70, 18, 9);
    music.bossHit && music.bossHit();
  }
  nextWave() {
    const b = this.battle; b.wave++; if (b.wave % 3 === 0) { this.bossWave(); music.bossHit && music.bossHit(); return; }
    // v5 "on steroids": bigger, mixed waves (capped so iPads stay smooth) + a STAMPEDE now and then
    const n = Math.min(this.maxEnemies() - 1, 2 + b.wave + (b.wave > 3 ? 2 : 0));
    for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i - (n - 1) / 2) * (2.6 / Math.max(3, n)) + Math.PI, row = i % 2; const e = this.spawnEnemy(ARENA.x + 24 + row * 7 + Math.cos(a + Math.PI) * 6, ARENA.z + Math.sin(a) * 22, Math.min(4, 1 + ((b.wave - 1) / 2 | 0))); e.ai.state = 'chase'; e.ai.home.copy(ARENA); e.yaw = -Math.PI / 2; e.roar = 1; }
    this.hud.toast('Wave ' + b.wave + '!  ' + n + ' dinos!');
    sfx.bigRoar(0.8, 0.8, false);
    if (b.wave >= 2 && this.r() < 0.45) this.later(4, () => this.battle === b && !b.over && this.stampede());
  }
  maxEnemies() { return 9 + Math.min(5, ((this.quality && this.quality.tier) || 0) * 2); } // cap on living enemies (perf)
  // v5: STAMPEDE! A pack of fast dinos thunders straight through, smashing everything in its path, then runs off
  stampede(force) {
    const p = this.player; if (!p || !p.alive) return 0; const alive = this.enemies.filter(e => e.alive).length, room = this.maxEnemies() + 4 - alive; if (room < 3 && !force) return 0;
    const n = Math.max(3, Math.min(7, room)), side = new THREE.Vector3(), f = new THREE.Vector3(), a = this.r() * 6.28;
    f.set(Math.cos(a), 0, Math.sin(a)); side.set(-f.z, 0, f.x);
    const start = p.pos.clone().addScaledVector(f, -70);
    let made = 0;
    for (let i = 0; i < n; i++) { const x = start.x + side.x * (i - n / 2) * 6 + f.x * (this.r() * 10), z = start.z + side.z * (i - n / 2) * 6 + f.z * (this.r() * 10);
      const L = this.level === 'ocean' ? ['shark', 'shark', 'stingray', 'megalodon'] : STAMPEDERS; const e = this.spawnEnemy(x, z, 2, L[(this.r() * L.length) | 0]); e.stampede = { dir: f.clone(), t: 0 }; e.yaw = Math.atan2(f.x, f.z); e.ai.state = 'stampede'; e.st.speed *= 1.25; e.hp = e.maxHp = Math.round(e.maxHp * 0.6); made++; }
    if (this.level === 'ocean') { this.hud.banner('🦈 SHARK FRENZY! 🦈', 3); this.hud.say?.('Shark frenzy! Watch out, Leandro!', { prio: 2 }); this.hud.toast('🦈🦈🦈 SHARK FRENZY! Chomp them as they zoom by!'); }
    else { this.hud.banner('🦖 STAMPEDE! 🦖', 3); this.hud.say?.('Stampede! Watch out, Leandro!', { prio: 2 }); this.hud.toast('🦖🦖🦖 STAMPEDE! Smash them as they charge!'); }
    sfx.rumble(4, 1.1); sfx.bigRoar(0.9, 0.9, false); this.fx.shake = Math.max(this.fx.shake, 1.2); this.stampedes = (this.stampedes || 0) + 1;
    return made;
  }

  // ---------- events ----------
  onHit(d, dmg, attacker, quiet) { if (d === this.player && !quiet) this.hud.hurt(); this.mh.onHit(d, attacker, quiet);
    if (attacker === this.player && !quiet && dmg > 8) this.fx.shake = Math.max(this.fx.shake, Math.min(0.6, 0.12 + dmg * 0.01)); } // v5: punchier hits
  // v5 city: a building came down
  onBuildingDown(b, by) { this.buildingsDown = (this.buildingsDown || 0) + 1; if (by !== this.player) return; const c = this.world.city, n = c ? c.destroyed : 0;
    if (n === 1 || n % 10 === 0) { this.hud.say?.(n === 1 ? 'Timber! Smash it, Leandro!' : n + ' buildings down! Mega smash!', { prio: 1, cd: 6000 }); }
    this.hud.toast(['🏢💥 CRASH!', '🏙️ KA-BOOM! Building down!', '💥 SMASHED IT!', '🏚️ TIMBER!'][(this.r() * 4) | 0] + '  (' + n + ')'); if (this.battle) this.battle.smashed = (this.battle.smashed || 0) + 1; }
  onKO(d, attacker) {
    d.side = this.r() < 0.5 ? -1 : 1; d.act = null; d.air = 0; d.chargeA = d.whipA = d.rearA = 0; d.burnT = 0; d.breathT = 0;
    const byP = attacker === this.player && d !== this.player; // v5 "on steroids": every KO is a big, loud, glowing blast
    if (d.real) { sfx.ko(true); this.fx.dust(d.pos, 24, 3.2 * d.def.scale, 9); this.fx.impact(d.center.clone(), 2.6); if (byP) { this.fx.boom(d.center.clone(), 0.8 + 0.4 * d.def.scale, { groundY: d.ground, shake: 1.2 }); sfx.boom(0.8); this.fx.ring(d.pos, 18 * d.def.scale + 6, 0xffb040); } }
    else { sfx.ko(); this.fx.sparks(d.center.clone(), 60, { r: 1, g: 0.6, b: 0.2 }, 2.2); this.fx.boom(d.center.clone(), 1.5, { groundY: d.ground, shake: d === this.player || byP ? 1.4 : 0.5 }); sfx.boom(1.1); this.mh.damageAt(d.center, 7, 99, attacker); }
    if (this.world.ocean) { this.bubbles(d.center.clone(), byP ? 40 : 16, 3 * d.def.scale, 7); sfx.bubbles && sfx.bubbles(byP ? 1 : 0.4, 8); }
    if (byP) for (let i = 0; i < this.fx.n(8); i++) this.fx.chunk(d.center.clone(), { x: (this.r() - 0.5) * 18, y: 8 + this.r() * 10, z: (this.r() - 0.5) * 18 }, 0.5 + this.r() * 0.6);
    if (d.boss) { const c = d.center.clone(), S = d.def.scale; if (this.battle) this.battle.boss = null;
      for (let i = 0; i < 7; i++) this.later(0.15 + i * 0.22, () => { const q = c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 5 * S, (Math.random() - 0.3) * 3 * S, (Math.random() - 0.5) * 5 * S)); this.fx.boom(q, 1.5 + Math.random(), { groundY: d.ground, shake: 1.2 }); sfx.bigBoom(1); });
      if (this.hud.leandroWins) this.hud.leandroWins('💥 Boss defeated!'); else this.hud.banner('💥 BOSS DEFEATED! 💥', 4); if (attacker === this.player || !attacker) { this.dropBolts(d.pos, 40); this.addBolts(25); } }
    this.mh.onKO(d, attacker);
    if (d === this.player) { this.hud.knockedOut(d.real); this.respawnT = 3.2; this.rider.pop(); this.rider.popOf = d; return; }
    if (attacker === this.player) this.rider.cheer();
    if (attacker === this.player) {
      this.save.kos++; const n = 7 + d.level * 4 + (d.def.roid ? 6 : 0); this.dropBolts(d.pos, n);
      if (this.battle) { this.battle.kos++; }
      // dramatic KO: slow motion, white flash, big rumble
      this.slowmo = 0.75; if (!this.flashT || this.world.time - this.flashT > 2) { this.flashT = this.world.time; this.hud.flash(); } this.fx.shake = Math.max(this.fx.shake, 1.25); this.fx.ring(d.pos, 14, 0xfff0c0); this.fx.ring(d.pos, 24, 0xffffff); sfx.slam();
      const real = attacker.real;
      this.hud.toast((real ? ['CHOMP! Knocked out!', 'Roar-some!', 'Dino power!', 'Unstoppable!'] : ['Knocked out!', 'Great shot!', 'Robo power!', 'Awesome!'])[(this.r() * 4) | 0]);
    }
  }
  footstep(d, foot) {
    if (d.def.farmKid) { if (this.farm) this.farm.step(d, foot); return; } // little feet (or clip-clop hooves), no camera rumble
    const m = d.mech, s = d.def.scale, heavy = (d.real || m.quad || ['rex', 'bronto', 'spino', 'ankylo', 'tri'].includes(d.def.kind)) ? s * s : s * s * 0.5;
    const cp = this.camera.position, dist = Math.hypot(d.pos.x - cp.x, d.pos.z - cp.z), near = clamp(1 - dist / 70, 0, 1);
    if (near <= 0) return;
    const run = d.speedNow > 8 ? 1.4 : 1;
    if (d === this.player || near > 0.5) sfx.step((d === this.player ? 0.22 : 0.12 * near) * Math.min(1.6, heavy) * run);
    if (heavy >= 0.8) this.fx.shake = Math.max(this.fx.shake, 0.16 * heavy * near * run);
    const fp = new THREE.Vector3(); if (m.footPos) m.footPos(foot + (m.quad ? (this.r() < 0.5 ? 2 : 0) : 0), fp); else { const b = m.b[(foot ? 'R' : 'L') + 'foot']; if (b) b.getWorldPosition(fp); else fp.copy(d.pos); }
    fp.y = d.ground + 0.2; if (d.ground > -0.6) this.fx.dust(fp, heavy > 0.8 ? 3 : 2, 0.9 * s + 0.3 * heavy, 2.2 * s * run);
  }
  mouthPos(d) { return d.mech.socketPos('mouth', new THREE.Vector3()); }
  foesOf(d) { return d.wild ? [this.player] : this.enemies; }

  // ---------- natural attacks (real dinos) ----------
  bite(d, target) {
    const foes = this.foesOf(d), fwd = d.forward(new THREE.Vector3()), s = d.def.scale;
    let t = null, bd = Infinity;
    for (const e of foes) { if (!e || !e.alive) continue; tmp.subVectors(e.pos, d.pos); const dist = Math.hypot(tmp.x, tmp.z) - e.radius - d.radius; tmp.y = 0; tmp.normalize();
      if (dist < 3.4 * s + 1.5 && tmp.dot(fwd) > 0.15 && dist < bd) { bd = dist; t = e; } }
    if (!t && target && target.alive && target.pos.distanceTo(d.pos) - target.radius - d.radius < 6.5 * s + 2.5) t = target; // lunge assist
    const bm = d.rageT > 0 ? 1.6 : 1;
    d.biteA = 1; d.jaw = 1.6; sfx.bite(s); this.mh.damageAt(d.pos.clone().addScaledVector(fwd, d.radius + 1.5 * s).setY(d.pos.y + 1), 2.5 * s + 1, d.st.bite * bm, d);
    if (t) {
      d.yaw += angDiff(d.yaw, Math.atan2(t.pos.x - d.pos.x, t.pos.z - d.pos.z)) * 0.75;
      const gap = d.pos.distanceTo(t.pos) - t.radius - d.radius; if (gap > 0.8) d.knock.addScaledVector(d.forward(tmp), Math.min(16, gap * 5));
      this.later(0.11, () => { if (!t.alive || !d.alive) return; t.hit(d.st.bite * bm, d.pos, d); this.fx.impact(this.mouthPos(d), 0.8 + 0.4 * s, t.real);
        if (d === this.player || t === this.player) this.fx.shake = Math.max(this.fx.shake, 0.3 + 0.15 * s); sfx.chomp(s); });
    }
    return t;
  }
  roarAt(d) {
    const s = d.def.scale, isP = d === this.player, cp = this.camera.position, near = clamp(1 - Math.hypot(d.pos.x - cp.x, d.pos.z - cp.z) / 90, 0, 1);
    d.roar = 1.7; sfx.bigRoar(clamp(1.2 - s * 0.32, 0.55, 1.3), isP ? 1 : 0.25 + 0.6 * near, !d.real);
    const fwd = d.forward(new THREE.Vector3());
    this.fx.roarWave(this.mouthPos(d), fwd, s, d.mech.mats.glowColor);
    if (d.real) this.mh.fieryRoar(d, true);
    this.fx.shake = Math.max(this.fx.shake, isP ? 1.0 : 0.7 * near);
    if (isP) this.hud.roar();
    for (const e of this.foesOf(d)) { if (!e || !e.alive) continue; tmp.subVectors(e.pos, d.pos); const dist = tmp.length(); tmp.y = 0; tmp.normalize();
      if (dist < 22 * s + 8 && tmp.dot(fwd) > -0.15) { this.stun(e, d.st.roar || 1); if (e !== this.player) { e.hit(4, d.pos, d); e.knock.addScaledVector(tmp, 7); } } }
  }
  stun(e, t) { if (e === this.player) { e.slowT = Math.max(e.slowT || 0, Math.min(t, 0.7)); return; } e.stunT = Math.max(e.stunT || 0, t); e.act = null; e.chargeA = e.whipA = e.rearA = 0; e.air = 0; }
  special(d, target) {
    const k = d.def.special, s = d.def.scale, fwd = new THREE.Vector3();
    if (target && target.alive) d.yaw += angDiff(d.yaw, Math.atan2(target.pos.x - d.pos.x, target.pos.z - d.pos.z)) * 0.9;
    d.forward(fwd);
    if (k === 'chomp') d.act = { type: 'chomp', t: 0, dur: 0.5, dir: fwd.clone(), speed: 22 * s + 6, hit: new Set() };
    else if (k === 'charge') d.act = { type: 'charge', t: 0, dur: 1.15, dir: fwd.clone(), speed: Math.max(20, d.st.speed * 2.3), hit: new Set() };
    else if (k === 'pounce') { d.act = this.pounceAct(d, target, fwd); d.roar = 0.5; }
    else if (k === 'whip') d.act = { type: 'whip', t: 0, dur: 0.75, yaw0: d.yaw, dir: this.r() < 0.5 ? 1 : -1, hit: new Set() };
    else if (k === 'stomp') { d.act = { type: 'stomp', t: 0, dur: 1.2, slam: false }; d.roar = 0.8; }
    else if (k === 'rage') { d.rageT = 6.5; d.roar = 1.7; sfx.rage(); sfx.bigRoar(0.6, d === this.player ? 1 : 0.5, false); this.fx.ring(d.pos, 12 * s, 0xff3020); this.fx.roarWave(this.mouthPos(d), fwd, s, new THREE.Color(1, 0.2, 0.1)); this.fx.shake = Math.max(this.fx.shake, d === this.player ? 0.8 : 0.3); if (d === this.player) this.hud.toast('😡 BERSERK RAGE! Faster + harder bites!'); return; }
    else if (k === 'combo') d.act = { type: 'combo', t: 0, dur: 1.0, dir: fwd.clone(), n: 0, target };
    else if (k === 'spit') { d.frillT = 1.1; d.jaw = 1.4; this.later(0.25, () => { if (!d.alive) return; for (let i = 0; i < 3; i++) this.later(i * 0.09, () => d.alive && this.launchOrb(d, target, 'goo', i ? 0.08 : 0)); }); sfx.whoosh(0.7); return; }
    else if (k === 'headbutt') { d.act = { type: 'headbutt', t: 0, dur: 0.95, dir: fwd.clone(), speed: Math.max(24, d.st.speed * 2.5), hit: new Set() }; sfx.whoosh(0.6); return; }
    else if (k === 'honk') { this.honk(d); return; }
    // ---- v5 "on steroids" signature specials ----
    else if (k === 'tsunami') { this.tsunami(d); return; }
    else if (k === 'rockethorn') { d.act = { type: 'rocket', t: 0, dur: 1.05, dir: fwd.clone(), speed: Math.max(34, d.st.speed * 3), hit: new Set() }; sfx.jet(); d.roar = 0.8; return; }
    else if (k === 'pack') { this.packPounce(d, target, 3); return; }
    else if (k === 'cannon') { this.megaCannon(d, target); return; }
    else if (k === 'lavaslam') { d.act = { type: 'whip', t: 0, dur: 0.75, yaw0: d.yaw, dir: this.r() < 0.5 ? 1 : -1, hit: new Set(), lava: true }; sfx.whoosh(1); return; }
    else if (k === 'bark') { this.barkBlast(d); return; }
    else if (k === 'breath') { this.dragonBreath(d); return; }
    // ---- v5 Deep Sea signature moves ----
    else if (k === 'ram') { d.act = { type: 'charge', t: 0, dur: 0.9, dir: fwd.clone(), speed: Math.max(36, d.st.speed * 2.6), hit: new Set(), ram: true }; sfx.whoosh(1.3); sfx.bubbles && sfx.bubbles(0.7, 6); if (d === this.player) this.hud.toast('🦈 TORPEDO RAM!'); return; }
    else if (k === 'crush') { d.act = { type: 'chomp', t: 0, dur: 0.6, dir: fwd.clone(), speed: 26 * s + 8, hit: new Set(), crush: true }; d.roar = 0.6; sfx.whoosh(1.4); if (d === this.player) this.hud.toast('🦈 CRUSHING CHOMP!'); return; }
    else if (k === 'zap') { this.stingZap(d, target); return; }
    else if (k === 'grab') { this.tentacleGrab(d, target); return; }
    else if (k === 'shock') { this.shockAura(d); return; }
    else if (k === 'lure') { this.lureFlash(d, target); return; }
    else if (k === 'kraken') { this.krakenAttack(d, target); return; }
    sfx.whoosh(k === 'charge' || k === 'stomp' ? 0.6 : 1);
  }
  // ---------- v5 Deep Sea moves ----------
  bubbles(pos, n = 10, spread = 2, up = 6) { const fx = this.fx; for (let i = 0; i < fx.n(n); i++) fx.glow.spawn({ pos: { x: pos.x + (this.r() - 0.5) * spread, y: pos.y + (this.r() - 0.5) * spread, z: pos.z + (this.r() - 0.5) * spread }, vel: { x: (this.r() - 0.5) * 2.5, y: up * (0.5 + this.r() * 0.8), z: (this.r() - 0.5) * 2.5 }, size: 0.22 + this.r() * 0.4, size1: 0.45, life: 1.1 + this.r() * 1.2, r: 1.1, g: 1.5, b: 1.8, alpha: 0.75, grav: -3, drag: 0.9 }); }
  // stingray / jellyfish primary: a venomous sting (bite + poison)
  sting(d, target) { const t = this.bite(d, target); d.mech.zapK = Math.max(d.mech.zapK || 0, 0.5); d.whipA = 1; this.later(0.25, () => { d.whipA = 0; });
    if (t) this.later(0.12, () => { if (!t.alive) return; t.poisonT = Math.max(t.poisonT || 0, 3.5); t.poisonBy = d; this.fx.sparks(t.center.clone(), 8, { r: 0.6, g: 0.9, b: 1.2 }, 0.7); }); return t; }
  // Thunder Stingray: ZAP STRIKE — lightning from the tail barb that chains through up to 5 foes
  stingZap(d, target) { const isP = d === this.player, t = target && target.alive && target.pos.distanceTo(d.pos) < 42 ? target : this.nearestFoe(d, 40), from = d.mech.socketPos('sting', new THREE.Vector3());
    d.mech.zapK = 1.5; d.whipA = 1; this.later(0.35, () => { d.whipA = 0; }); this.zaps = (this.zaps || 0) + 1;
    if (t) { this.fx.zap(from, t.center.clone(), { r: 0.6, g: 0.95, b: 1.2 }, 0.55, 0.3, 0.12); this.zapChain(d, t, d.st.bite * 2.4, 4); this.bubbles(t.center.clone(), 14, 3, 6); }
    else { const q = d.pos.clone().addScaledVector(d.forward(new THREE.Vector3()), 18); this.fx.zap(from, q, { r: 0.6, g: 0.95, b: 1.2 }, 0.5, 0.25, 0.12); this.fx.ring(q, 6, 0x5ae8ff); this.mh.damageAt(q, 5, 30, d); sfx.zap(isP ? 1 : 0.4); }
    this.fx.shake = Math.max(this.fx.shake, isP ? 0.5 : 0.2); if (isP) this.hud.toast('⚡ ZAP STRIKE!'); }
  // Giant Octopus: TENTACLE GRAB — pull a foe in and squeeze
  tentacleGrab(d, target) { const isP = d === this.player, t = target && target.alive && target.pos.distanceTo(d.pos) < 30 + target.radius ? target : this.nearestFoe(d, 30); d.mech.grabK = 1;
    sfx.whoosh(1.2); if (!t) { this.later(0.5, () => { d.mech.grabK = 0; }); return; }
    d.act = { type: 'grab', t: 0, dur: 1.7, target: t, n: 0 }; this.stun(t, 2); this.grabs = (this.grabs || 0) + 1; if (isP) this.hud.toast('🐙 TENTACLE GRAB!'); }
  // Giant Octopus: INK CLOUD — a big black cloud; every enemy in it is blinded and wanders off
  inkCloud(d) { const isP = d === this.player, c = d.mech.socketPos('ink', new THREE.Vector3()), fx = this.fx; d.roar = 0.9; this.inks = (this.inks || 0) + 1;
    for (let i = 0; i < fx.n(30); i++) fx.smoke.spawn({ pos: { x: c.x + (this.r() - 0.5) * 4, y: c.y + (this.r() - 0.5) * 3, z: c.z + (this.r() - 0.5) * 4 }, vel: { x: (this.r() - 0.5) * 10, y: (this.r() - 0.3) * 5, z: (this.r() - 0.5) * 10 }, size: 3, size1: 16, life: 4, r: 0.02, g: 0.02, b: 0.05, alpha: 0.9, alpha1: 0, drag: 1.1, rv: 0.5 });
    d.knock.addScaledVector(d.forward(new THREE.Vector3()), 16); sfx.ink && sfx.ink(isP ? 1 : 0.4); this.bubbles(c, 16, 3, 5);
    for (const e of this.foesOf(d)) { if (!e || !e.alive || e.pos.distanceTo(d.pos) > 26 + e.radius) continue; if (e === this.player) { this.hud.ink?.(); e.slowT = Math.max(e.slowT || 0, 1); } else { e.blindT = 5; this.stun(e, 0.5); } }
    if (isP) this.hud.toast("🐙 INK CLOUD! They can't see you!"); }
  // Mega Jellyfish: SHOCK AURA — electric burst all around
  shockAura(d) { const isP = d === this.player, s = Math.max(1, d.def.scale), c = d.center.clone(), R = 15 * s; d.mech.zapK = 1.6; d.roar = 0.6; this.shocks = (this.shocks || 0) + 1;
    this.fx.ring(c, R, 0xd05aff); this.fx.ring(c, R * 0.55, 0xffffff); this.fx.sparks(c, 30, { r: 0.9, g: 0.6, b: 1.3 }, 1.6);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, q = c.clone().add(new THREE.Vector3(Math.cos(a) * R * 0.8, (this.r() - 0.5) * 6, Math.sin(a) * R * 0.8)); this.fx.zap(c, q, { r: 0.9, g: 0.6, b: 1.3 }, 0.35, 0.22, 0.14); }
    for (const e of this.foesOf(d)) { if (!e || !e.alive) continue; const dd = e.center.distanceTo(c); if (dd > R + e.radius) continue; tmp.subVectors(e.pos, d.pos).setY(0).normalize();
      e.hit(d.st.bite * 2.2, c, d); this.stun(e, 1.4); e.knock.addScaledVector(tmp, e.boss ? 4 : 14); this.fx.zap(c, e.center.clone(), { r: 1, g: 0.7, b: 1.4 }, 0.45, 0.25, 0.1); }
    this.mh.damageAt(c, R * 0.6, 30, d); sfx.zap(isP ? 1 : 0.4); sfx.boom(isP ? 0.5 : 0.2); this.fx.shake = Math.max(this.fx.shake, isP ? 0.7 : 0.25); if (isP) this.hud.toast('⚡ SHOCK AURA!'); }
  // Mega Jellyfish: STINGING TENDRILS — whip every tendril out in a ring
  tendrilWhip(d) { const isP = d === this.player, c = d.center.clone(), R = 12; d.whipA = 1; d.mech.zapK = 1; this.later(0.6, () => { d.whipA = 0; }); this.whips = (this.whips || 0) + 1;
    this.fx.ring(new THREE.Vector3(c.x, d.pos.y, c.z), R, 0xff7ad8); sfx.whoosh(1.1); sfx.zap(isP ? 0.5 : 0.2);
    for (const e of this.foesOf(d)) { if (!e || !e.alive || e.center.distanceTo(c) > R + e.radius) continue; tmp.subVectors(e.pos, d.pos).setY(0).normalize(); e.hit(d.st.bite * 1.5, c, d); e.poisonT = Math.max(e.poisonT || 0, 4); e.poisonBy = d; e.knock.addScaledVector(tmp, e.boss ? 3 : 10); this.fx.impact(e.center.clone(), 1, true); }
    if (isP) this.hud.toast('🪼 STINGING TENDRILS!'); }
  // Great White: FEEDING FRENZY (faster + harder bites for a while)
  frenzy(d) { d.rageT = 6.5; d.roar = 1.2; sfx.rage(); this.fx.ring(d.pos, 12, 0xff3020); this.bubbles(d.center.clone(), 24, 4, 6); this.fx.shake = Math.max(this.fx.shake, d === this.player ? 0.6 : 0.2); if (d === this.player) this.hud.toast('🦈 FEEDING FRENZY! Faster + harder bites!'); }
  seaThird(d) { const t = d.def.third; if (t === 'ink') this.inkCloud(d); else if (t === 'tendrils') this.tendrilWhip(d); else if (t === 'frenzy') this.frenzy(d); else { this.roarAt(d); this.bubbles(this.mouthPos(d), 18, 2, 7); } }
  // Anglerfish: a blinding LURE FLASH, then a lunge
  lureFlash(d, target) { const c = d.mech.socketPos('lure', new THREE.Vector3()); d.mech.zapK = 1.5; this.fx.glow.spawn({ pos: c, size: 14, size1: 2, life: 0.5, r: 1.6, g: 3, b: 2.6, alpha: 1 }); sfx.zap(0.4);
    const p = this.player; if (p && p.alive && p.pos.distanceTo(d.pos) < 26 && d.wild) { p.slowT = Math.max(p.slowT || 0, 1.2); if (this.hud.flash) this.hud.flash(); }
    this.later(0.35, () => { if (d.alive && !d.act) d.act = { type: 'chomp', t: 0, dur: 0.5, dir: d.forward(new THREE.Vector3()), speed: 26, hit: new Set() }; }); }
  // THE KRAKEN: tentacle slams on red circles, an ink storm, or a whirlpool that drags you in
  krakenAttack(e, target) { const p = this.player; if (!p || !p.alive) return; e.kn = (e.kn || 0) + 1; e.roar = 1.4; sfx.bigRoar(0.3, 0.8, false); const mode = e.kn % 3;
    if (mode === 1) { this.hud.toast('🐙 TENTACLE SLAM! Dodge the red circles!'); for (let i = 0; i < 4; i++) this.later(0.1 + i * 0.35, () => { if (!e.alive || !p.alive) return; const a = this.r() * 6.28, dd = i ? 3 + this.r() * 9 : 0, q = new THREE.Vector3(p.pos.x + Math.cos(a) * dd, 0, p.pos.z + Math.sin(a) * dd); q.y = this.world.height(q.x, q.z);
        this.fx.warn(q, 6, 0.9); this.later(0.9, () => { if (!e.alive) return; this.mh.blast(q.clone().setY(q.y + 1), 1.2, { by: e, dmg: 22, R: 7, only: x => x === this.player, playerScale: 0.7 }); this.fx.ring(q, 10, 0xff4a8a); this.bubbles(q, 20, 6, 8); this.fx.shake = Math.max(this.fx.shake, 0.8); sfx.slam(); }); }); }
    else if (mode === 2) { this.hud.toast('🐙 INK STORM!'); this.inkCloud(e); }
    else { this.hud.toast('🌀 WHIRLPOOL! Swim away!'); e.whirl = 2.6; sfx.rumble(2.5, 0.8); } }
  pounceAct(d, target, fwd, chain = 0) { const to = target && target.alive && target.pos.distanceTo(d.pos) < 30 ? target.pos.clone() : d.pos.clone().addScaledVector(fwd || d.forward(new THREE.Vector3()), 14); const dist = to.distanceTo(d.pos);
    return { type: 'pounce', t: 0, dur: 0.55 + dist * 0.014, from: d.pos.clone(), to, h: 3 + dist * 0.16, target, chain, done: new Set() }; }
  // Raptor Pack Alpha: pounce from foe to foe to foe
  packPounce(d, target, n) { const t = target && target.alive ? target : this.nearestFoe(d, 30); d.act = this.pounceAct(d, t, null, n - 1); d.roar = 0.8; d.jaw = 1.4; sfx.whoosh(1.1); if (d === this.player) this.hud.toast('🦖 PACK STRIKE!'); }
  nearestFoe(d, R, skip) { let best = null, bd = R; for (const e of this.foesOf(d)) { if (!e || !e.alive || (skip && skip.has(e))) continue; const q = e.pos.distanceTo(d.pos); if (q < bd) { bd = q; best = e; } } return best; }
  // Spino-Titan: a giant TIDAL WAVE that blasts everything in front away
  tsunami(d) {
    const s = d.def.scale, fwd = d.forward(new THREE.Vector3()), isP = d === this.player; d.roar = 1.6; d.jaw = 1.5; sfx.honk(); sfx.rumble(1.6, isP ? 0.9 : 0.4); this.fx.shake = Math.max(this.fx.shake, isP ? 1.1 : 0.4);
    const col = new THREE.Color(0.3, 0.8, 1.2);
    for (let i = 0; i < 6; i++) this.later(i * 0.1, () => { const c = d.pos.clone().addScaledVector(fwd, 5 + i * 5.5); c.y = d.ground + 0.2; this.fx.ring(c, 7 + i * 3, 0x5ad8ff);
      for (let j = 0; j < this.fx.n(8); j++) this.fx.glow.spawn({ pos: { x: c.x + (this.r() - 0.5) * (8 + i * 4), y: c.y + this.r() * 2, z: c.z + (this.r() - 0.5) * (8 + i * 4) }, vel: { x: fwd.x * 14, y: 7 + this.r() * 8, z: fwd.z * 14 }, size: 0.7, size1: 0.2, life: 0.9, r: 0.6, g: 1.6, b: 2.4, alpha: 0.9, grav: 18 });
      this.fx.roarWave(this.mouthPos(d), fwd, s * (1 + i * 0.25), col); });
    for (const e of this.foesOf(d)) { if (!e || !e.alive) continue; tmp.subVectors(e.pos, d.pos); const dist = tmp.length(); tmp.y = 0; tmp.normalize();
      if (dist < 30 * s + 6 && tmp.dot(fwd) > 0.25) { e.hit(d.st.bite * 1.8, d.pos, d); e.knock.addScaledVector(tmp, e.boss ? 6 : 30); this.stun(e, 1.8); } }
    this.mh.damageAt(this.mouthPos(d).addScaledVector(fwd, 14), 12, 60, d);
  }
  // Brachio-Tank: lobs three glowing mortar shells
  megaCannon(d, target) {
    const isP = d === this.player, from = new THREE.Vector3(); if (d.mech.sockets && d.mech.sockets.cannon) d.mech.sockets.cannon.getWorldPosition(from); else from.copy(d.center).setY(d.pos.y + d.mech.height);
    const fwd = d.forward(new THREE.Vector3()), only = e => (d.wild ? e === this.player : e !== this.player);
    sfx.boom(isP ? 0.9 : 0.5); this.fx.muzzle(from, { r: 1, g: 0.8, b: 0.3 }, fwd); this.fx.shake = Math.max(this.fx.shake, isP ? 0.7 : 0.25); d.roar = 0.5;
    for (let i = 0; i < 3; i++) this.later(i * 0.22, () => { if (!d.alive) return; const t = target && target.alive && target.pos.distanceTo(d.pos) < 70 ? target.pos : d.pos.clone().addScaledVector(fwd, 32);
      const to = new THREE.Vector3(t.x + (this.r() - 0.5) * 9, 0, t.z + (this.r() - 0.5) * 9); to.y = this.world.height(to.x, to.z) + 0.5;
      this.mh.launch('lava', from.clone(), to, 1.1 + i * 0.1, { size: 1.3, P: 1.1, dmg: (d.wild ? 14 : 45), R: 7, by: d, only, playerScale: 0.6 }); sfx.whistle(0.5); });
    if (isP) this.hud.toast('💣 MEGA CANNON!');
  }
  // Ricky & Bobby: BARK BLAST — a yippy shockwave cone that knocks dinos flying (and cracks buildings)
  barkBlast(d) {
    const fwd = d.forward(new THREE.Vector3()), isP = d === this.player, m = this.mouthPos(d); d.roar = 0.6; d.jaw = 1.2;
    sfx.bark(d.def.id === 'bobby' ? 1.15 : 1, 1, 2); this.barks = (this.barks || 0) + 1;
    const col = new THREE.Color(d.def.accent || 0xffffff).multiplyScalar(1.5);
    for (let i = 0; i < 3; i++) this.later(i * 0.08, () => { this.fx.roarWave(this.mouthPos(d), fwd, 0.7 + i * 0.35, col); const c = d.pos.clone().addScaledVector(fwd, 4 + i * 5); c.y = d.ground + 0.2; this.fx.ring(c, 4 + i * 3, d.def.accent || 0xffffff); });
    this.fx.shake = Math.max(this.fx.shake, isP ? 0.6 : 0.2);
    for (const e of this.foesOf(d)) { if (!e || !e.alive) continue; tmp.subVectors(e.pos, d.pos); const dist = tmp.length() - e.radius; tmp.y = 0; tmp.normalize();
      if (dist < 20 && tmp.dot(fwd) > 0.3) { e.hit(d.st.bite * 1.4, d.pos, d); e.knock.addScaledVector(tmp, e.boss ? 5 : 26); this.stun(e, 1.2); this.fx.impact(e.center.clone(), 1, e.real); } }
    this.mh.damageAt(m.clone().addScaledVector(fwd, 9), 8, 40, d);
  }
  // Thunder-Ptero: THUNDER STRIKE, sky lightning that chains through up to 5 foes
  thunderStrike(d, foes) {
    const t = this.nearestFoe(d, 60); d.jaw = 1.3; d.roar = 0.6; sfx.thunder(d === this.player ? 1 : 0.5);
    if (this.world.flash) this.world.flash(0.5);
    if (t) { this.fx.zap(t.center.clone().add(new THREE.Vector3(0, 40, 0)), t.center.clone(), { r: 1, g: 0.95, b: 0.5 }, 0.5, 0.25, 0.1); this.zapChain(d, t, d.st.melee * 1.1, 4); this.mh.blast(t.center.clone(), 0.8, { by: d, dmg: d.st.melee * 0.5, R: 6, only: e => (d.wild ? e === this.player : e !== this.player) }); }
    else { const p = d.pos.clone().addScaledVector(d.forward(new THREE.Vector3()), 20); p.y = this.world.height(p.x, p.z); this.fx.zap(p.clone().setY(p.y + 40), p, { r: 1, g: 0.95, b: 0.5 }, 0.5, 0.25, 0.1); this.mh.damageAt(p, 7, 60, d); this.fx.ring(p, 10, 0xffe23a); }
    this.fx.shake = Math.max(this.fx.shake, d === this.player ? 0.8 : 0.3);
    return 'thunder';
  }
  updateAct(d, dt) {
    const A = d.act; if (!A) return false; A.t += dt; const u = Math.min(1, A.t / A.dur), s = d.def.scale, foes = this.foesOf(d);
    const hitFoes = (R, dmg, knock, stunT, set, dirFn) => { let n = 0; for (const e of foes) { if (!e || !e.alive || (set && set.has(e))) continue; const dist = Math.hypot(e.pos.x - d.pos.x, e.pos.z - d.pos.z) - e.radius; if (dist > R) continue; if (set) set.add(e); n++;
      e.hit(dmg, d.pos, d); const dir = dirFn ? dirFn(e) : new THREE.Vector3().subVectors(e.pos, d.pos).setY(0).normalize(); e.knock.addScaledVector(dir, knock); if (stunT) this.stun(e, stunT); this.fx.impact(e.center.clone(), 1.2 + knock * 0.03, e.real); } return n; };
    const slide = (dir, sp) => { d.speedNow = sp; d.yaw = Math.atan2(dir.x, dir.z); d.pos.addScaledVector(dir, sp * dt); const h = this.world.height(d.pos.x, d.pos.z); if (h < -1.6 && !d.swim) d.pos.addScaledVector(dir, -sp * dt); this.world.collide(d.pos, d.radius * 0.6, false); d.groundY(); };
    if (A.type === 'chomp') { slide(A.dir, A.speed * Math.max(0, 1 - u * 1.4)); d.biteA = Math.max(d.biteA, 0.6); d.jaw = u < 0.55 ? 1.8 : 0.1;
      if (u > 0.55 && !A.done) { A.done = true; d.biteA = 1; const cr = A.crush ? 1.7 : 1; if (hitFoes(d.radius + 3.5 * s * cr, d.st.bite * (A.crush ? 4.2 : 3), A.crush ? 22 : 12, A.crush ? 1.6 : 0.8, A.hit)) { this.fx.shake = Math.max(this.fx.shake, A.crush ? 1.3 : 0.8); sfx.chomp(1.5); }
        if (A.crush) { const m = this.mouthPos(d); this.fx.ring(m, 14 * s, 0xff3a1a); this.fx.ring(m, 8 * s, 0xffffff); this.bubbles(m, 40, 5 * s, 8); sfx.boom(d === this.player ? 0.9 : 0.4); this.mh.damageAt(m, 6 * s, 80, d); this.crushes = (this.crushes || 0) + 1; } } }
    else if (A.type === 'grab') { const t = A.target; d.speedNow = 0; d.biteA = Math.max(d.biteA, 0.3); d.mech.grabK = 1;
      if (t && t.alive) { const f = d.forward(new THREE.Vector3()), gx = d.pos.x + f.x * (d.radius + t.radius * 0.6 + 1), gz = d.pos.z + f.z * (d.radius + t.radius * 0.6 + 1); t.pos.x += (gx - t.pos.x) * Math.min(1, dt * 5); t.pos.z += (gz - t.pos.z) * Math.min(1, dt * 5);
        if (t.fly && d.fly) t.alt += ((d.alt + 0.5) - t.alt) * Math.min(1, dt * 4); d.yaw += angDiff(d.yaw, Math.atan2(t.pos.x - d.pos.x, t.pos.z - d.pos.z)) * Math.min(1, dt * 8); if (t !== this.player) this.stun(t, 0.5);
        const k = Math.floor(u * 5); if (k > A.n && u < 0.98) { A.n = k; t.hit(d.st.bite * 0.7, d.pos, d, true); this.fx.impact(t.center.clone(), 0.8, true); this.bubbles(t.center.clone(), 6, 2, 5); sfx.bite(0.6); }
        if (u >= 1 && !A.done) { A.done = true; t.hit(d.st.bite * 2.2, d.pos, d); t.knock.addScaledVector(d.forward(new THREE.Vector3()), 22); this.fx.shake = Math.max(this.fx.shake, d === this.player ? 0.7 : 0.3); sfx.chomp(1.3); } }
      if (u >= 1 || !t || !t.alive) { d.mech.grabK = 0; A.t = A.dur; } }
    else if (A.type === 'charge') { const sp = A.speed * Math.min(1, u * 5) * (u > 0.82 ? (1 - u) / 0.18 : 1); slide(A.dir, sp); d.chargeA = 1;
      if (hitFoes(d.radius + 1.4, d.st.bite * 1.8, 24, 1.0, A.hit, e => A.dir.clone().multiplyScalar(0.8).add(tmp.subVectors(e.pos, d.pos).setY(0).normalize().multiplyScalar(0.5)))) { this.fx.shake = Math.max(this.fx.shake, 0.7); sfx.slam(); }
      if (d.def.sea) { if (this.r() < 0.8) this.bubbles(d.center.clone(), 2, 1.5 * s, 3); } else if (this.r() < 0.7) this.fx.dust(d.pos, 1, 1.4 * s, 4); this.mh.damageAt(d.pos, d.radius + 1.2, 40 * dt * 10, d); }
    else if (A.type === 'pounce') { if (A.target && A.target.alive && u < 0.7) A.to.lerp(A.target.pos, Math.min(1, dt * 5));
      d.pos.x = A.from.x + (A.to.x - A.from.x) * u; d.pos.z = A.from.z + (A.to.z - A.from.z) * u; this.world.collide(d.pos, d.radius * 0.5, true); d.groundY(); d.pos.y += Math.sin(Math.PI * u) * A.h;
      d.air = u < 0.9 ? 1 : 0; d.yaw = Math.atan2(A.to.x - A.from.x, A.to.z - A.from.z) || d.yaw; d.speedNow = 0; d.jaw = 1.4;
      if (u >= 1) { d.air = 0; d.biteA = 1; hitFoes(d.radius + 3.2, d.st.bite * 2.6, 9, 1.6, null); this.fx.dust(d.pos, 12, 1.8, 7); this.fx.ring(d.pos, 8, 0xffc070); this.fx.shake = Math.max(this.fx.shake, d === this.player ? 0.6 : 0.3); sfx.stomp(); sfx.chomp(1);
        if (A.chain > 0) { if (A.target) A.done.add(A.target); const nx = this.nearestFoe(d, 28, A.done); if (nx) { A.next = this.pounceAct(d, nx, null, A.chain - 1); A.next.done = A.done; sfx.whoosh(1); } } } }
    else if (A.type === 'rocket') { const sp = A.speed * Math.min(1, u * 6) * (u > 0.85 ? (1 - u) / 0.15 : 1); slide(A.dir, sp); d.chargeA = 1; // Mega-Trike: rocket-powered horn charge, ends in a KABOOM
      const at = d.pos.clone().addScaledVector(A.dir, -d.radius).setY(d.pos.y + d.mech.height * 0.5); for (let i = 0; i < this.fx.n(2); i++) this.fx.fire.spawn({ pos: at, vel: { x: -A.dir.x * 16 + (this.r() - 0.5) * 3, y: 1 + this.r() * 2, z: -A.dir.z * 16 + (this.r() - 0.5) * 3 }, size: 1.2, size1: 3, life: 0.3, r: 3.2, g: 1.4, b: 0.35, alpha: 1, drag: 1.5, rv: 3 });
      if (this.r() < 0.6) this.fx.dust(d.pos, 1, 1.4 * s, 4); this.mh.damageAt(d.pos, d.radius + 1.5, 60 * dt * 10, d);
      const n = hitFoes(d.radius + 1.6, d.st.bite * 2.2, 30, 1.2, A.hit, e => A.dir.clone());
      if ((n || u >= 0.98) && !A.boom) { A.boom = true; const bp = d.pos.clone().addScaledVector(A.dir, d.radius + 1).setY(d.pos.y + 1.5); this.mh.blast(bp, 1.4, { by: d, dmg: d.st.bite * 2.2, R: 9, only: e => (d.wild ? e === this.player : e !== this.player) }); this.fx.shake = Math.max(this.fx.shake, d === this.player ? 1.4 : 0.5); A.t = Math.max(A.t, A.dur * 0.85); } }
    else if (A.type === 'zoomies') { // Ricky & Bobby: ZOOMIES, a blur of a dash in a wiggly line that bowls dinos over
      A.dir.applyAxisAngle(up, Math.sin(A.t * 14) * dt * 5); const sp = A.speed * Math.min(1, u * 8) * (u > 0.85 ? (1 - u) / 0.15 : 1); slide(A.dir, sp); d.chargeA = 1;
      if (this.r() < 0.9) this.fx.dust(d.pos, 1, 1.0, 5); if (this.r() < 0.5) this.fx.glow.spawn({ pos: d.center.clone(), vel: { x: 0, y: 1, z: 0 }, size: 1.2, size1: 0.1, life: 0.35, r: 2.2, g: 2.2, b: 2.2, alpha: 0.6 });
      const n = hitFoes(d.radius + 2.2, d.st.bite * 1.6, 18, 0.9, A.hit); if (n) { sfx.bark(d.def.id === 'bobby' ? 1.15 : 1, 0.7, 1); this.fx.shake = Math.max(this.fx.shake, 0.5); }
      this.mh.damageAt(d.pos, d.radius + 1.5, 25 * dt * 10, d); }
    else if (A.type === 'whip') { d.yaw = A.yaw0 + A.dir * Math.PI * 2 * sstep(0, 1, u); d.whipA = Math.sin(u * Math.PI) * A.dir; d.speedNow = 0;
      if (u > 0.2) hitFoes(d.radius + 5.5 * s, d.st.bite * 2.3, 20, 0.8, A.hit, e => { const r = tmp.subVectors(e.pos, d.pos).setY(0).normalize(); return new THREE.Vector3(-r.z * A.dir, 0, r.x * A.dir).multiplyScalar(0.6).add(r); });
      if (this.r() < 0.6) { const tp = d.pos.clone().addScaledVector(new THREE.Vector3(-Math.sin(d.yaw), 0, -Math.cos(d.yaw)), 5 * s); tp.y = d.ground + 0.3; this.fx.dust(tp, 1, 1.4 * s, 4); } }
    else if (A.type === 'stomp') { d.speedNow = 0; d.rearA = u < 0.55 ? sstep(0, 0.55, u) : Math.max(0, 1 - (u - 0.55) / 0.1);
      if (u > 0.62 && !A.slam) { A.slam = true; hitFoes(16 * s, d.st.bite * 2.8, 16, 1.4, null); this.mh.damageAt(d.pos, 14 * s, 99, d); this.fx.dust(d.pos, 26, 3 * s, 14); this.fx.ring(d.pos, 18 * s, 0xffd8a0); this.fx.ring(d.pos, 10 * s, 0xffffff);
        this.fx.shake = Math.max(this.fx.shake, d === this.player ? 1.4 : 0.8); sfx.boom(1.2); sfx.stomp(); } }
    else if (A.type === 'combo') { const step = Math.min(2, Math.floor(u * 3)), lu = u * 3 - step;
      if (A.target && A.target.alive) A.dir.copy(tmp.subVectors(A.target.pos, d.pos).setY(0).normalize());
      slide(A.dir, lu < 0.45 ? 26 * s : 4); d.biteA = Math.max(d.biteA, Math.sin(lu * Math.PI)); d.jaw = lu < 0.5 ? 1.8 : 0.2;
      if (lu > 0.45 && A.n <= step) { A.n = step + 1; sfx.chomp(1.1 + step * 0.15); const n = hitFoes(d.radius + 3.2 * s, d.st.bite * (step === 2 ? 1.9 : 1.2), step === 2 ? 18 : 6, step === 2 ? 0.8 : 0.25, null);
        if (n) { this.fx.impact(this.mouthPos(d), 1 + step * 0.3, true); this.fx.shake = Math.max(this.fx.shake, d === this.player ? 0.35 + step * 0.15 : 0.2); } } }
    else if (A.type === 'headbutt') { const sp = A.speed * Math.min(1, u * 6) * (u > 0.8 ? (1 - u) / 0.2 : 1); slide(A.dir, sp); d.chargeA = 1;
      const n = hitFoes(d.radius + 1.6, d.st.bite * 2.6, 34, 1.8, A.hit, e => A.dir.clone().add(new THREE.Vector3(0, 0, 0)));
      if (n) { this.fx.shake = Math.max(this.fx.shake, 0.9); sfx.headbutt(); this.fx.ring(this.mouthPos(d), 7, 0xfff080); for (const e of A.hit) if (!e.dizzyFx) { e.dizzyFx = 1; for (let i = 0; i < 6; i++) this.later(i * 0.12, () => this.fx.dizzy(e, true)); } A.t = Math.max(A.t, A.dur * 0.8); }
      if (this.r() < 0.7) this.fx.dust(d.pos, 1, 1.3 * s, 4); this.mh.damageAt(d.pos, d.radius + 1.2, 40 * dt * 10, d); }
    if (A.type === 'whip' && A.lava && u > 0.5 && !A.lavaDone) { A.lavaDone = true; // Lava Ankylo: a ring of fire + a molten blast
      const P = d.pos; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, q = new THREE.Vector3(P.x + Math.cos(a) * 7 * s, 0, P.z + Math.sin(a) * 7 * s); q.y = this.world.height(q.x, q.z); this.mh.addFire(q, 2.4, 3.5, d); }
      this.mh.blast(P.clone().setY(P.y + 1), 1.2, { by: d, dmg: d.st.bite * 1.6, R: 9 * s, only: e => (d.wild ? e === this.player : e !== this.player), fire: false }); this.fx.ring(P, 16 * s, 0xff5a10); this.fx.ring(P, 9 * s, 0xffd040); }
    if (A.t >= A.dur) { d.act = null; d.chargeA = 0; d.air = 0; d.rearA = 0; d.whipA = 0; if (A.hit) for (const e of A.hit) e.dizzyFx = 0; if (A.next) d.act = A.next; }
    return true;
  }

  // ---------- v4 attacks: honk, element blasts, breaths, quake, goo ----------
  honk(d) {
    const s = d.def.scale, fwd = d.forward(new THREE.Vector3()), m = this.mouthPos(d), isP = d === this.player;
    d.roar = 1.4; d.jaw = 1.2; sfx.honk(); this.fx.shake = Math.max(this.fx.shake, isP ? 0.7 : 0.3);
    const col = new THREE.Color(0.4, 0.9, 1.0);
    for (let i = 0; i < 4; i++) this.later(i * 0.12, () => { const c = d.pos.clone().addScaledVector(fwd, 4 + i * 5); c.y = d.ground; this.fx.ring(c, 6 + i * 3, 0x7ae8ff); this.fx.roarWave(this.mouthPos(d), fwd, s * (1 + i * 0.2), col); });
    for (const e of this.foesOf(d)) { if (!e || !e.alive) continue; tmp.subVectors(e.pos, d.pos); const dist = tmp.length(); tmp.y = 0; tmp.normalize();
      if (dist < 26 * s + 6 && tmp.dot(fwd) > 0.35) { e.hit(d.st.bite * 1.3, d.pos, d); e.knock.addScaledVector(tmp, e.boss ? 4 : 20); this.stun(e, 1.5); } }
    this.mh.damageAt(m.clone().addScaledVector(fwd, 10), 9, 30, d);
  }
  elementOf(d) { return d.def.element === 'king' ? 'fire' : (d.def.element || 'fire'); }
  aimDir(d, target, from) { const dir = new THREE.Vector3(); if (target && target.alive) dir.copy(target.center).sub(from).normalize(); else { d.forward(dir); dir.y = d.fly ? -0.32 : -0.05; dir.normalize(); } return dir; }
  // primary attack for dragons (fireball / ice shard / lightning) and spit for Dilophosaurus
  fireOrb(d, target) {
    const el = this.elementOf(d), from = this.mouthPos(d); d.jaw = 1.3;
    if (el === 'storm') { const range = 60; let t = target && target.alive && target.pos.distanceTo(d.pos) < range ? target : null;
      if (!t) { const dir = this.aimDir(d, null, from); const end = from.clone().addScaledVector(dir, 34); const gy = this.world.height(end.x, end.z); if (end.y < gy) end.y = gy;
        this.fx.zap(from, end, { r: 0.75, g: 0.7, b: 1 }, 0.3, 0.16); this.mh.damageAt(end, 4, d.st.bite, d); sfx.zap(d === this.player ? 1 : 0.4); return; }
      this.zapChain(d, t, d.st.bite * 1.1, 2); return; }
    this.launchOrb(d, target, el, 0);
  }
  launchOrb(d, target, kind, spread) {
    const from = this.mouthPos(d), dir = this.aimDir(d, target, from), s = d.def.scale;
    if (spread) { dir.x += (this.r() - 0.5) * spread; dir.z += (this.r() - 0.5) * spread; dir.normalize(); }
    const speed = kind === 'goo' ? 34 : (d.wild ? 40 : 58), vel = dir.multiplyScalar(speed); if (kind === 'goo') vel.y += 4;
    const big = d.boss ? 2 : 1;
    this.orbs.push({ kind, pos: from.clone(), vel, life: kind === 'goo' ? 1.6 : 1.8, owner: d, dmg: (d.st.bite ?? d.st.melee * 0.4) * (kind === 'goo' ? 0.7 : 1) * (d.rageT > 0 ? 1.4 : 1), r: (kind === 'goo' ? 0.9 : 1.3) * big, size: big * Math.max(0.8, s) });
    if (kind === 'fire') { sfx.whoosh(0.8); sfx.ignite(); this.fx.muzzle(from, { r: 1, g: 0.5, b: 0.15 }, vel.clone().normalize()); }
    else if (kind === 'ice') { sfx.frost(1); this.fx.muzzle(from, { r: 0.5, g: 0.85, b: 1 }, vel.clone().normalize()); }
    else { sfx.spit(); }
  }
  updateOrbs(dt) {
    const fx = this.fx;
    for (let i = this.orbs.length - 1; i >= 0; i--) { const O = this.orbs[i]; O.life -= dt; const from = O.pos.clone();
      if (O.kind === 'goo') O.vel.y -= 16 * dt; O.pos.addScaledVector(O.vel, dt);
      const z = O.size;
      if (O.kind === 'fire') { fx.fire.spawn({ pos: O.pos, size: 1.9 * z, size1: 0.5, life: 0.3, r: 3, g: 1.1 + Math.random() * 0.5, b: 0.2, alpha: 1, rv: 4 }); fx.glow.spawn({ pos: O.pos, size: 3 * z, size1: 1, life: 0.06, r: 3, g: 1.6, b: 0.5, alpha: 1 }); if (Math.random() < 0.6 * fx.k) fx.smoke.spawn({ pos: from, size: 0.8 * z, size1: 3 * z, life: 0.9, r: 0.2, g: 0.17, b: 0.16, alpha: 0.5, drag: 1, rv: 1 }); }
      else if (O.kind === 'ice') { fx.glow.spawn({ pos: O.pos, size: 2.2 * z, size1: 0.6, life: 0.08, r: 1.4, g: 2.4, b: 3, alpha: 1 }); fx.glow.spawn({ pos: from, vel: { x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 3 }, size: 0.25, life: 0.5, r: 1.8, g: 2.6, b: 3, alpha: 1 }); fx.glow.spawn({ pos: O.pos, vel: { x: O.vel.x * 0.1, y: O.vel.y * 0.1, z: O.vel.z * 0.1 }, size: 0.6 * z, life: 0.08, len: 4, r: 2, g: 2.8, b: 3, alpha: 1, dir: O.vel.clone().normalize() }); }
      else { fx.glow.spawn({ pos: O.pos, size: 1.4 * z, size1: 0.4, life: 0.08, r: 0.9, g: 2.6, b: 0.3, alpha: 1 }); if (Math.random() < 0.5) fx.glow.spawn({ pos: O.pos, vel: { x: 0, y: -2, z: 0 }, size: 0.3, life: 0.5, r: 0.7, g: 2.2, b: 0.2, alpha: 1, grav: 12 }); }
      let hit = null; const foes = this.foesOf(O.owner);
      for (const e of foes) { if (!e || !e.alive) continue; const c = e.center, ab = tmp2.copy(O.pos).sub(from), t = clamp(c.clone().sub(from).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1), cp = from.clone().addScaledVector(ab, t);
        if (cp.distanceToSquared(c) < (e.radius + O.r) ** 2 * 1.3) { hit = e; O.pos.copy(cp); break; } }
      const gh = this.world.height(O.pos.x, O.pos.z), ground = O.pos.y < Math.max(gh, -0.3);
      const prop = !hit && this.mh.hitSegment(from, O.pos, 0, O.owner);
      if (hit || ground || prop || O.life <= 0) { this.orbs.splice(i, 1); this.orbHit(O, hit); }
    }
  }
  orbHit(O, hit) {
    const p = O.pos, d = O.owner, isOwnerP = d === this.player, only = e => (d.wild ? e === this.player : e !== this.player);
    if (O.kind === 'fire') { this.mh.blast(p.clone(), d.boss ? 1.3 : 0.62, { by: d, dmg: O.dmg * (d.boss ? 1 : 1.4), R: d.boss ? 9 : 5.5, only, playerScale: d.boss ? 1 : 1 }); }
    else if (O.kind === 'ice') { this.fx.shatter(p, d.boss ? 1.5 : 1); sfx.freeze();
      for (const e of this.foesOf(d)) { if (!e || !e.alive) continue; const dist = e.center.distanceTo(p) - e.radius; if (dist < 3.5) { e.hit(O.dmg * (e === hit ? 1.2 : 0.6), p, d); this.chill(e, e === hit ? 0.42 : 0.2, d); } }
      this.mh.damageAt(p, 3.5, O.dmg, d); }
    else { this.fx.goo(p, 1); sfx.splat();
      for (const e of this.foesOf(d)) { if (!e || !e.alive) continue; const dist = e.center.distanceTo(p) - e.radius; if (dist < 3.5) { e.hit(O.dmg, p, d); e.slowT = Math.max(e.slowT || 0, 3); e.poisonT = Math.max(e.poisonT || 0, 4); e.poisonBy = d; } } }
    if (isOwnerP && hit) this.fx.shake = Math.max(this.fx.shake, 0.2);
  }
  chill(e, k, by) {
    if (!e || !e.alive) return; e.chill = (e.chill || 0) + k; e.slowT = Math.max(e.slowT || 0, 2.2);
    if (e.chill >= 1 && !(e.frozenT > 0)) { e.chill = 0; sfx.freeze(); this.fx.shatter(e.center.clone(), 1.2);
      if (e === this.player) { e.slowT = Math.max(e.slowT, 2.5); e.frozenT = 1.2; } else { const t = e.boss ? 0.8 : 2.4; e.frozenT = t; this.stun(e, t); if (by === this.player) this.hud.toast('🧊 FROZEN SOLID!'); } }
  }
  // lightning: zap a target then arc on to nearby foes
  zapChain(d, first, dmg, hops = 2) {
    const col = d.def.element === 'king' ? { r: 1, g: 0.8, b: 0.45 } : { r: 0.75, g: 0.72, b: 1 };
    let from = this.mouthPos(d), cur = first; const done = new Set();
    for (let h = 0; h <= hops && cur; h++) { done.add(cur); const to = cur.center.clone(); this.fx.zap(from, to, col, h ? 0.22 : 0.34, 0.18); cur.hit(dmg * (h ? 0.65 : 1), from, d); this.stun(cur, h ? 0.35 : 0.5);
      this.fx.sparks(to, 10, { r: 0.7, g: 0.8, b: 1 }, 1); from = to;
      let nx = null, bd = 14; for (const e of this.foesOf(d)) { if (!e || !e.alive || done.has(e)) continue; const q = e.pos.distanceTo(cur.pos); if (q < bd) { bd = q; nx = e; } } cur = nx; }
    this.mh.damageAt(first.pos, 3, dmg, d);
    sfx.zap(d === this.player || first === this.player ? 1 : 0.4);
  }
  dragonBreath(d) {
    const el = this.elementOf(d), isP = d === this.player, lvl = isP ? (this.save.up.fire || 0) : 0;
    this.mh.startBreath(d, (el === 'storm' ? 1.4 : 1.6) * (d.boss ? 1.3 : 1) + 0.08 * lvl, el);
    d.roar = 0.6;
  }
  // Giga-Mech: piston-fist ground slam shockwave
  quake(d, foes) {
    const s = d.def.scale, isP = d === this.player; d.roar = 1; d.jaw = 1.2;
    this.later(0.18, () => { if (!d.alive) return; sfx.slam(); sfx.boom(isP ? 1.1 : 0.6); this.fx.dust(d.pos, 26, 3 * s, 16); this.fx.ring(d.pos, 18 * s, 0xff5a2a); this.fx.ring(d.pos, 10 * s, 0xffffff); this.fx.ring(d.pos, 26 * s, d.mech.mats.glowColor.getHex());
      this.fx.shake = Math.max(this.fx.shake, isP ? 1.3 : 0.6); this.mh.damageAt(d.pos, 13 * s, 99, d);
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, r = 6 + this.r() * 8 * s, q = d.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); q.y = this.world.height(q.x, q.z) + 0.3; this.fx.chunk(q, { x: Math.cos(a) * 6, y: 9 + this.r() * 6, z: Math.sin(a) * 6 }, 0.6); }
      for (const e of foes) { if (!e || !e.alive) continue; const dist = Math.hypot(e.pos.x - d.pos.x, e.pos.z - d.pos.z) - e.radius; if (dist < 16 * s && !(e.fly && e.alt > 6)) { const f = 1 - dist / (18 * s);
        e.hit(d.st.melee * (0.6 + 0.8 * f), d.pos, d); e.knock.addScaledVector(tmp.subVectors(e.pos, d.pos).setY(0).normalize(), (e.boss ? 3 : 16) * f); this.stun(e, 1.1); } } });
    return 'quake';
  }
  // Dilo-Blaster: sticky goo spray
  gooSpray(d) { d.jaw = 1.2; d.frillT = 0.8; const tgt = d === this.player ? this.lock : this.player;
    for (let i = 0; i < 5; i++) this.later(i * 0.07, () => d.alive && this.launchOrb(d, tgt && tgt.alive && tgt.pos.distanceTo(d.pos) < 40 ? tgt : null, 'goo', 0.22)); return 'goo'; }

  // ---------- combat ----------
  findTarget(from, fwd, range = 85, cone = 0.6) {
    let best = null, bs = Infinity;
    for (const e of this.enemies) { if (!e.alive) continue; tmp.subVectors(e.pos, from); const d = tmp.length(); if (d > range) continue; tmp.y = 0; tmp.normalize();
      const dot = tmp.dot(fwd); if (dot < cone) continue; const s = d * (2 - dot); if (s < bs) { bs = s; best = e; } }
    return best;
  }
  fireLaser(d, target, spread = 0) {
    const m = d.mech, from = new THREE.Vector3(); m.socketPos('mouth', from);
    const col = m.mats.glowColor, dir = new THREE.Vector3();
    if (target) { dir.copy(target.center).sub(from).normalize(); } else { d.forward(dir); dir.y = -0.05; if (d.fly) dir.y = -0.25; dir.normalize(); }
    if (spread) { dir.x += (this.r() - 0.5) * spread; dir.y += (this.r() - 0.5) * spread * 0.5; dir.z += (this.r() - 0.5) * spread; dir.normalize(); }
    const speed = d.wild ? 45 : 75;
    const vis = this.fx.laserBolt(from, dir, col, speed);
    this.shots.push({ pos: from.clone(), vel: dir.clone().multiplyScalar(speed), life: 1.2, dmg: d.st.laser, owner: d, vis, col });
    this.fx.muzzle(from, col, dir); d.jaw = 0.6;
    sfx.laser(d.wild ? 0.5 : 1);
  }
  fireMissiles(d, target) {
    const m = d.mech, n = d.st.missiles; const fwd = d.forward(new THREE.Vector3());
    const targets = target ? [target] : [];
    if (!target) { const others = this.enemies.filter(e => e.alive && e.pos.distanceTo(d.pos) < 90).sort((a, b) => a.pos.distanceTo(d.pos) - b.pos.distanceTo(d.pos)); targets.push(...others.slice(0, n)); }
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        if (!d.alive || !this.player) return;
        const from = new THREE.Vector3(); m.socketPos(i % 2 ? 'podR' : 'podL', from);
        let t = d.wild ? this.player : targets[i % Math.max(1, targets.length)];
        if (!t) { const p = d.pos.clone().addScaledVector(fwd, 35 + i * 3); p.x += (i - n / 2) * 3; p.y = this.world.height(p.x, p.z); t = { pos: p, alive: true, mech: { height: 0 }, radius: 1.5 }; }
        this.fx.launchMissile(from, fwd.clone().applyAxisAngle(up, (i % 2 ? -1 : 1) * 0.5), t, d, d.wild ? 7 : 26 * (1 + 0.15 * this.save.up.missile), m.mats.glowColor);
        this.fx.muzzle(from, { r: 1, g: 0.6, b: 0.2 });
      }, i * 140);
    }
  }
  melee(d, foes) {
    if (d.def.quake) return this.quake(d, foes);
    if (d.def.thunder) return this.thunderStrike(d, foes);
    if (d.def.goo) return this.gooSpray(d);
    const fwd = d.forward(new THREE.Vector3());
    let target = null, bd = Infinity;
    for (const e of foes) { if (!e.alive) continue; tmp.subVectors(e.pos, d.pos); const dist = tmp.length() - e.radius - d.radius; tmp.y = 0; tmp.normalize(); if (dist < 4.5 * d.def.scale + 1 && tmp.dot(fwd) > 0.3 && dist < bd) { bd = dist; target = e; } }
    if (target) { d.jaw = 1.4; sfx.bite(); target.hit(d.st.melee, d.pos, d); this.fx.sparks(target.center.clone(), 16, { r: 1, g: 0.9, b: 0.5 }, 1.2); this.fx.shake = Math.max(this.fx.shake, 0.25); return 'bite'; }
    // stomp shockwave
    sfx.stomp(); this.mh.damageAt(d.pos, 10 * d.def.scale, 30, d); this.fx.dust(d.pos, 14, 2.5, 9); this.fx.ring(d.pos, 10 * d.def.scale, d.mech.mats.glowColor.getHex()); this.fx.shake = Math.max(this.fx.shake, 0.4); d.roar = 0.6;
    for (const e of foes) { if (!e.alive) continue; const dist = e.pos.distanceTo(d.pos); if (dist < 10 * d.def.scale + e.radius) e.hit(d.st.melee * 0.6 * (1 - dist / (14 * d.def.scale + e.radius)), d.pos, d); }
    return 'stomp';
  }
  onMissileHit(M, p) {
    const foes = M.owner.wild ? [this.player] : this.enemies;
    const lvl = M.owner === this.player ? (this.save.up.fire || 0) : 0;
    for (const e of foes) { if (!e || !e.alive) continue; const d = e.center.distanceTo(p); if (d < 7 + e.radius) { e.hit(M.dmg * (1 - d / (9 + e.radius)) + M.dmg * 0.2, p, M.owner); if (e !== this.player || M.owner.boss) this.mh.ignite(e, 2.5 + 0.5 * lvl, M.owner); } }
    this.mh.damageAt(p, 6, M.dmg, M.owner);
    const gy = this.world.height(p.x, p.z); if (gy > -0.5 && p.y - gy < 3) this.mh.addFire(new THREE.Vector3(p.x, gy, p.z), 2 + 0.2 * lvl, 4 + lvl, M.owner);
  }
  updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.life -= dt; const step = tmp.copy(s.vel).multiplyScalar(dt); const from = s.pos.clone(); s.pos.add(step);
      let hit = null;
      const foes = s.owner.wild ? [this.player] : this.enemies;
      for (const e of foes) { if (!e || !e.alive) continue; const c = e.center, r = e.radius + 0.6;
        // segment-sphere test
        const ab = tmp2.copy(s.pos).sub(from), t = clamp(c.clone().sub(from).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1); const cp = from.clone().addScaledVector(ab, t);
        if (cp.distanceToSquared(e.center) < r * r * 1.4) { hit = e; s.pos.copy(cp); break; } }
      const gh = this.world.height(s.pos.x, s.pos.z);
      if (!hit && this.mh.hitSegment(from, s.pos, s.dmg, s.owner)) { this.fx.sparks(s.pos, 8, { r: s.col.r, g: s.col.g, b: s.col.b }, 0.8); sfx.hit(); if (s.vis) for (const v of s.vis) v.age = v.life; this.shots.splice(i, 1); continue; }
      if (hit) { hit.hit(s.dmg, s.owner.pos, s.owner); this.fx.sparks(s.pos, 8, { r: s.col.r, g: s.col.g, b: s.col.b }, 0.8); sfx.hit(); }
      else if (s.pos.y < gh) { this.fx.sparks(s.pos, 5, { r: s.col.r, g: s.col.g, b: s.col.b }, 0.5); this.fx.dust(s.pos, 2, 0.8, 2); }
      if (hit || s.pos.y < gh || s.life <= 0) { if (s.vis) for (const v of s.vis) v.age = v.life; this.shots.splice(i, 1); }
    }
  }

  // ---------- update ----------
  update(dt, inp) {
    if (this.westies) this.westies.update(dt);
    const p = this.player; if (!p) return;
    const cam = this.cam;
    // camera orbit from drag
    cam.yaw -= inp.look.dx * 0.006; cam.pitch = clamp(cam.pitch + inp.look.dy * 0.004, 0.05, 1.05);
    // player control (camera-relative)
    if (p.alive) {
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw); // camera forward on ground
      const dir = new THREE.Vector3(fx * -inp.y + (-fz) * inp.x, 0, fz * -inp.y + fx * inp.x);
      const mag = Math.min(1, Math.hypot(inp.x, inp.y));
      p.boosting = !p.def.westie && inp.btn.boost && p.boostE > 0.05;
      if (p.def.westie) this.pupJump(p, inp, dt);
      if (p.boosting) { p.boostE = Math.max(0, p.boostE - dt); if (inp.pressed.boost && !p.def.farmKid) sfx.boost(); this.jetFlame(p); } else p.boostE = Math.min(p.st.boost, p.boostE + dt * 0.45);
      if (p.def.sea && p.fly) { const v = (inp.btn.up ? 1 : 0) - (inp.btn.down ? 1 : 0) + (inp.pressed.up ? 0.5 : 0) - (inp.pressed.down ? 0.5 : 0); p.climb = clamp(v, -1, 1); p.alt = clamp(p.alt + v * 15 * dt, 0, 48); if (v) this.swimUD = (this.swimUD || 0) + 1; } // v5: free 3D swimming (▲/▼)
      else if (p.fly) { p.climb = p.boosting ? 1 : 0; p.alt = clamp(p.alt + (p.boosting ? 9 : -2.5) * dt, 5, 40); }
      if (!this.updateAct(p, dt)) p.move(dt, mag > 0.05 ? dir.normalize() : dir, mag, p.boosting && !p.fly ? true : p.boosting);
      // weapons
      p.laserT -= dt; p.missileT -= dt; p.meleeT -= dt;
      const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      const pf = p.forward(new THREE.Vector3());
      this.lock = this.findTarget(p.pos, mag > 0.1 ? pf : fwd.lerp(pf, 0.5).normalize(), p.real && !p.dragon ? 45 : 85, 0.45);
      // v4.2: no cooldowns for the player. Every tap fires at once, and holding a button auto-repeats
      // (laser at its fire rate, the others every REP s). Buttons are independent, so several can be held together.
      const REP = 0.22;
      const taps = k => Math.min(4, +inp.pressed[k] || 0) || (inp.btn[k] && p[k + 'T'] <= 0 ? 1 : 0); // every tap counts (even several between two frames)
      const nL = taps('laser'), nM = taps('missile'), nB = taps('melee'), L = nL > 0, M = nM > 0, B = nB > 0;
      if (L) p.laserT = p.st.rate; if (M) p.missileT = REP; if (B) p.meleeT = REP;
      if (p.def.farmKid) { if (this.farm) this.farm.controls(p, inp, nL, nM, nB); } // v5.1 farm: FEED / RIDE / TOOT / RUN
      else if (p.def.westie) { // v5: Ricky / Bobby: BITE, BARK BLAST, ZOOMIES (jump is on the 4th button)
        if (L) { if (p.act && p.act.type !== 'zoomies') p.act = null; this.bite(p, this.lock); }
        if (M) this.barkBlast(p);
        if (B && !(p.act && p.act.type === 'zoomies')) { const dir = this.lock && this.lock.alive && this.lock.pos.distanceTo(p.pos) < 40 ? new THREE.Vector3().subVectors(this.lock.pos, p.pos).setY(0).normalize() : p.forward(new THREE.Vector3()); p.act = { type: 'zoomies', t: 0, dur: 0.95, dir, speed: 44, hit: new Set() }; this.zooms = (this.zooms || 0) + 1; sfx.whoosh(1.3); sfx.bark(p.def.id === 'bobby' ? 1.15 : 1, 0.6, 1); }
      } else if (p.def.sea) { // v5 Deep Sea: BITE (or STING), the signature SPECIAL, and a 3rd move (frenzy / ink / tendrils / sonar roar)
        if (L) { if (p.act && p.act.type !== 'grab') p.act = null; if (p.def.sting) this.sting(p, this.lock); else this.bite(p, this.lock); }
        if (M && (inp.pressed.missile || !p.act)) { p.act = null; this.special(p, this.lock); } // holding lets a chomp / grab / ram finish before it repeats
        if (B) this.seaThird(p);
      } else if (p.real && p.dragon) {
        for (let i = 0; i < nL; i++) this.fireOrb(p, this.lock);
        if (M) this.dragonBreath(p);
        if (B) this.roarAt(p);
      } else if (p.real) {
        if (L) { if (p.act) p.act = null; this.bite(p, this.lock); }
        if (M) { if (p.act) p.act = null; this.special(p, this.lock); }
        if (B) this.roarAt(p);
      } else {
        if (L) { this.fireLaser(p, this.lock, this.lock ? 0.02 : 0.03); if (p.def.kind === 'raptor') setTimeout(() => this.player === p && p.alive && this.fireLaser(p, this.lock, 0.05), 50); }
        for (let i = 0; i < nM; i++) this.fireMissiles(p, this.lock);
        if (B) { if (p.def.breath) this.mh.startBreath(p, 1.25 + 0.1 * (this.save.up.fire || 0)); else this.melee(p, this.enemies); }
      }
      const S = this.shotLog || (this.shotLog = { L: 0, M: 0, B: 0 }); S.L += nL; S.M += nM; S.B += nB;
      // base repairs
      if (this.mode === 'roam' && Math.hypot(p.pos.x - this.world.baseGroup.position.x, p.pos.z - this.world.baseGroup.position.z) < 12 && p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + dt * 25); if (Math.random() < 0.3) this.fx.glow.spawn({ pos: new THREE.Vector3(p.pos.x + (Math.random() - 0.5) * 4, p.pos.y + Math.random() * 3, p.pos.z + (Math.random() - 0.5) * 4), vel: { x: 0, y: 3, z: 0 }, size: 0.4, life: 0.8, r: 0.3, g: 2, b: 2.4, alpha: 1 }); }
    } else {
      p.speedNow = 0; this.respawnT -= dt;
      if (Math.random() < 0.4) this.fx.sparks(p.center.clone(), 2, { r: 1, g: 0.7, b: 0.3 }, 0.6);
      if (this.respawnT <= 0) {
        if (this.mode === 'battle') { this.endBattle(); this.respawnT = 99; }
        else { this.spawnPlayer(false); this.player.shieldT = 3.5; this.hud.revived(); sfx.beam(); this.fx.ring(this.player.pos, 8, 0x40e8ff); }
      }
    }
    for (let i = this.timers.length - 1; i >= 0; i--) { const T = this.timers[i]; T.t -= dt; if (T.t <= 0) { this.timers.splice(i, 1); T.fn(); } }
    p.updateVisual(dt); this.rider.update(dt, p);
    if (this.farm) this.farm.update(dt);
    if (p.shieldT > 0) { p.shieldT -= dt; if (Math.random() < 0.5) this.fx.glow.spawn({ pos: new THREE.Vector3(p.pos.x + (Math.random() - 0.5) * 5, p.pos.y + Math.random() * p.mech.height, p.pos.z + (Math.random() - 0.5) * 5), vel: { x: 0, y: 1.5, z: 0 }, size: 0.5, life: 0.6, r: 0.3, g: 1.8, b: 2.6, alpha: 1 }); }
    if (!p.alive && this.player !== p) return;

    // enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.gone) { e.remove(); this.enemies.splice(i, 1); continue; } // v5: stampede runners leave the map
      if (e.alive) { if (this.battle && this.battle.over) { e.move(dt, tmp.set(0, 0, 0), 0, false); e.breathT = 0; } else this.think(e, dt); }
      else { e.koT += dt;
        if (e.real) { if (Math.random() < dt * 6) this.fx.dizzy(e, true); }
        else { if (Math.random() < 0.25) this.fx.sparks(e.center.clone(), 2, { r: 1, g: 0.5, b: 0.2 }, 0.5);
          if (e.koT > 1.2 && Math.random() < 0.2) this.fx.smoke.spawn({ pos: e.center.clone(), vel: { x: 0, y: 3, z: 0 }, size: 1.5, size1: 5, life: 2, r: 0.2, g: 0.2, b: 0.2, alpha: 0.6, rv: 0.5 }); }
        if (e.koT > 3) { if (e.real) { this.fx.dust(e.pos, 18, 3 * e.def.scale, 6); sfx.whoosh(0.5); } else { this.fx.glow.spawn({ pos: e.center.clone(), size: 8, size1: 1, life: 0.4, r: 1.2, g: 2, b: 3, alpha: 1 }); sfx.beam(); }
          e.remove(); this.enemies.splice(i, 1); continue; } }
      e.updateVisual(dt);
    }
    // separation between dinos
    const all = [p, ...this.enemies];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = all[i], b = all[j]; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = (a.radius + b.radius) * 0.8;
      if (d < m && d > 1e-3 && !(a.fly && a.alt > 4) && !(b.fly && b.alt > 4)) { const push = (m - d) / 2 / d; a.pos.x -= dx * push; a.pos.z -= dz * push; b.pos.x += dx * push; b.pos.z += dz * push; } }

    // spawning
    if (this.mode === 'roam' && !this.farm) { this.spawnT -= dt; const alive = this.enemies.filter(e => e.alive).length;
      if (this.spawnT <= 0 && alive < Math.min(this.maxEnemies(), this.quality.enemies)) { this.spawnT = 2.5; const [x, z, l] = this.roamSpawnPoint(); this.spawnEnemy(x, z, l); }
      this.stampT = (this.stampT ?? 70) - dt; if (this.stampT <= 0) { this.stampT = 75 + this.r() * 60; if (p.alive) this.stampede(); }
      // despawn very far enemies so the island stays lively near the player
      for (let i = this.enemies.length - 1; i >= 0; i--) { const e = this.enemies[i]; if (e.alive && e.pos.distanceTo(p.pos) > 260) { e.remove(); this.enemies.splice(i, 1); } } }
    else if (this.battle && !this.battle.over) {
      this.battle.t -= dt; if (music.setIntensity) music.setIntensity(clamp(this.enemies.filter(e => e.alive).length / 8 + (this.battle.boss ? 0.5 : 0), 0, 1)); if (this.enemies.length === 0) { if (this.battle.wave > 0) this.hud.leandroWins?.('Wave ' + this.battle.wave + ' cleared!'); this.nextWave(); }
      if (this.battle.t <= 0) this.endBattle();
    }
    this.mh.update(dt);
    this.updateShots(dt);
    this.updateOrbs(dt);
    this.updatePickups(dt);
    this.updateCamera(dt, inp);
    // lock-on ring
    if (this.lock && this.lock.alive) { this.lockRing.visible = true; this.lockRing.position.set(this.lock.pos.x, this.lock.ground + 0.3, this.lock.pos.z); this.lockRing.scale.setScalar(this.lock.radius * 1.4); this.lockRing.rotation.y += dt * 2; }
    else this.lockRing.visible = false;
  }
  // v5 westie: big jump + flying hops (tap again in the air, up to 2), hold to glide with the little cape
  pupJump(p, inp, dt) {
    for (let k = Math.min(3, +inp.pressed.boost || 0); k > 0; k--) { if (!(p.jy > 0.05) && !(p.jvy > 0)) { p.jvy = 17; p.hops = 0; sfx.whoosh(0.8); sfx.bark(p.def.id === 'bobby' ? 1.15 : 1, 0.5, 1); this.fx.dust(p.pos, 6, 1.4, 6); }
      else if ((p.hops || 0) < 2) { p.hops = (p.hops || 0) + 1; p.jvy = Math.max(p.jvy, 13); sfx.flap(0.8); this.fx.ring(p.pos.clone().setY(p.pos.y), 4, p.def.accent); for (let i = 0; i < this.fx.n(8); i++) this.fx.glow.spawn({ pos: p.center.clone(), vel: { x: (this.r() - 0.5) * 6, y: -3, z: (this.r() - 0.5) * 6 }, size: 0.4, size1: 0.05, life: 0.7, r: 2.4, g: 2, b: 0.8, alpha: 1 }); } }
    if (p.jy > 0 || p.jvy > 0) { p.jvy -= (inp.btn.boost && p.jvy < 0 ? 12 : 34) * dt; p.jy = Math.max(0, (p.jy || 0) + p.jvy * dt); p.air = p.jy > 0.2 ? 1 : 0;
      if (p.jy <= 0) { if (p.jvy < -12) { this.fx.dust(p.pos, 8, 1.6, 6); sfx.step(0.4); this.mh.damageAt(p.pos, 4, 12, p); } p.jvy = 0; p.air = 0; p.hops = 0; } }
    this.jumps = (this.jumps || 0) + Math.min(3, +inp.pressed.boost || 0);
  }
  jetFlame(d) { if (d.def.sea) { if (this.r() < 0.6) this.bubbles(d.pos.clone().addScaledVector(d.forward(tmp), -d.radius).setY(d.pos.y + d.mech.height * 0.5), 2, 1, 2); return; }
    if (d.real) { if (!d.fly && Math.random() < 0.5) this.fx.dust(d.pos, 1, 1.2 * d.def.scale, 3); return; }
    const m = d.mech, f = d.forward(tmp).clone();
    const at = new THREE.Vector3(); if (m.sockets.jet) m.sockets.jet.getWorldPosition(at); else at.copy(d.pos).addScaledVector(f, -1.2 * d.def.scale).setY(d.pos.y + m.height * 0.55);
    const c = m.mats.glowColor; const v = { x: -f.x * 14, y: d.fly ? -4 : 1, z: -f.z * 14 };
    this.fx.glow.spawn({ pos: at, vel: v, size: 1.3, size1: 0.2, life: 0.22, r: c.r * 2.4, g: c.g * 2.4, b: c.b * 2.4, alpha: 1 });
    for (let i = 0; i < this.fx.n(2); i++) this.fx.fire.spawn({ pos: at, vel: { x: v.x * (0.8 + Math.random() * 0.4) + (Math.random() - 0.5) * 3, y: v.y + (Math.random() - 0.5) * 3, z: v.z * (0.8 + Math.random() * 0.4) + (Math.random() - 0.5) * 3 }, size: 0.9 * d.def.scale, size1: 2.6 * d.def.scale, life: 0.3, r: 3.2, g: 1.4, b: 0.35, alpha: 1, drag: 1.5, rv: 3 });
    if (Math.random() < 0.4 * this.fx.k) this.fx.smoke.spawn({ pos: at.clone().addScaledVector(f, -3), vel: { x: -f.x * 3, y: 1.5, z: -f.z * 3 }, size: 0.8, size1: 3.5, life: 1.1, r: 0.3, g: 0.29, b: 0.28, alpha: 0.4, drag: 1, rv: 1 });
    for (const k of ['jetL', 'jetR']) if (m.sockets[k]) { m.sockets[k].getWorldPosition(at); this.fx.glow.spawn({ pos: at, vel: v, size: 1, size1: 0.2, life: 0.2, r: 2.6, g: 1.6, b: 0.6, alpha: 1 }); this.fx.fire.spawn({ pos: at, vel: v, size: 0.7, size1: 2, life: 0.26, r: 3.2, g: 1.3, b: 0.3, alpha: 1, drag: 1.5 }); }
    if (!d.fly && Math.random() < 0.5) this.fx.dust(d.pos, 1, 1.2, 3);
  }
  think(e, dt) {
    const p = this.player, ai = e.ai; ai.t -= dt;
    if (e.stampede) { e.stampede.t += dt; if (e.stampede.t > 9) { e.gone = true; return; } } // v5: runners always leave, even if stunned/re-targeted
    e.laserT -= dt; e.missileT -= dt; e.meleeT -= dt;
    if (e.stunT > 0) { e.stunT -= dt; e.move(dt, tmp.set(0, 0, 0), 0, false); if (Math.random() < dt * 7) this.fx.dizzy(e, e.real); return; }
    if (e.blindT > 0) { e.blindT -= dt; e.move(dt, tmp.set(Math.sin(this.world.time * 0.7 + e.level * 3), 0, Math.cos(this.world.time * 0.9 + e.level)), 0.5, false); if (this.r() < dt * 3) this.fx.dizzy(e, true); return; } // v5: blinded by ink
    if (e.def.sea && e.fly && ai.state !== 'stampede') { const chasing = ai.state === 'chase' && p.alive; const want = chasing ? clamp(p.pos.y + (p.mech.height - e.mech.height) * 0.5 - e.ground - 0.6, 0.3, 44) : 2.5 + e.level * 1.5 + Math.sin(this.world.time * 0.3 + e.level * 2) * 2;
      const da = clamp(want - e.alt, -6 * dt, 6 * dt); e.alt += da; e.climb = clamp(da / Math.max(1e-3, dt) * 0.25, -1, 1); }
    if (e.whirl > 0) { e.whirl -= dt; const P = this.player; if (P && P.alive) { tmp2.subVectors(e.pos, P.pos).setY(0); const dd = tmp2.length(); if (dd > e.radius + P.radius + 2) { tmp2.normalize(); P.knock.addScaledVector(tmp2, 22 * dt).addScaledVector(tmp2.set(-tmp2.z, 0, tmp2.x), 14 * dt); } }
      if (this.r() < 0.9) { const a = this.world.time * 6 + this.r() * 6, rr = 4 + this.r() * 20; this.bubbles(new THREE.Vector3(e.pos.x + Math.cos(a) * rr, e.pos.y + this.r() * 8, e.pos.z + Math.sin(a) * rr), 2, 1, 4); } }
    if (this.updateAct(e, dt)) return;
    if (ai.state === 'stampede') { const S = e.stampede; e.move(dt, S.dir, 1, true); if (this.r() < 0.5) this.fx.dust(e.pos, 1, 1.6 * e.def.scale, 6);
      if (p.alive && !S.hitP && Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < e.radius + p.radius + 1) { S.hitP = true; p.hit(8, e.pos, e); p.knock.addScaledVector(S.dir, 18); this.fx.shake = Math.max(this.fx.shake, 0.8); }
      this.mh.damageAt(e.pos, e.radius + 1, 30 * dt * 10, e); return; }
    const toP = tmp.subVectors(p.pos, e.pos); const dist = toP.length(); toP.y = 0;
    const battle = this.mode === 'battle';
    const pSafe = !battle && Math.hypot(p.pos.x - this.world.baseGroup.position.x, p.pos.z - this.world.baseGroup.position.z) < 12; // repair pad is a safe zone
    const pAlive = p.alive && !pSafe;
    if (ai.state === 'patrol') {
      if (!ai.wp || ai.t <= 0 || Math.hypot(ai.wp.x - e.pos.x, ai.wp.z - e.pos.z) < 4) { const a = this.r() * 6.28; ai.wp = new THREE.Vector3(ai.home.x + Math.cos(a) * 30, 0, ai.home.z + Math.sin(a) * 30); ai.t = 8; }
      const d = new THREE.Vector3(ai.wp.x - e.pos.x, 0, ai.wp.z - e.pos.z).normalize(); e.move(dt, d, 0.4, false);
      if (pAlive && (dist < 42 || battle)) { ai.state = 'chase'; if (e.real && dist < 60) { this.roarAt(e); e.meleeT = e.st.roarCD; } else { e.roar = 1; sfx.roar(1.3 - e.def.scale * 0.35); } }
    } else if (ai.state === 'chase') {
      if (!pAlive || (!battle && (dist > 80 || e.pos.distanceTo(ai.home) > 140))) { ai.state = 'patrol'; ai.wp = null; }
      if (e.real && e.dragon) { this.dragonThink(e, dt, p, dist, toP, pAlive, battle); return; }
      if (e.real) { this.realThink(e, dt, p, dist, toP, pAlive, battle); if (e.hp < e.maxHp * 0.28 && !ai.retreated && !battle) { ai.state = 'retreat'; ai.t = 5; ai.retreated = true; } return; }
      const meleeKind = ['raptor', 'ankylo', 'tri'].includes(e.def.kind);
      const want = meleeKind ? 3 : 20;
      const dir = toP.clone().normalize();
      if (dist > want + e.radius + p.radius) e.move(dt, dir, 0.85, false);
      else { e.move(dt, dir.clone().applyAxisAngle(up, Math.PI / 2 * (Math.sin(this.world.time * 0.6 + e.level) > 0 ? 1 : -1)), 0.25, false); e.yaw += clamp(angDiff(e.yaw, Math.atan2(dir.x, dir.z)), -3 * dt, 3 * dt); }
      // attacks
      if (pAlive && dist < 48) {
        const facing = Math.cos(angDiff(e.yaw, Math.atan2(toP.x, toP.z))) > 0.7;
        if (facing && e.laserT <= 0) { if (ai.burst <= 0) { ai.burst = 3; } this.fireLaser(e, p, 0.12); ai.burst--; e.laserT = ai.burst > 0 ? 0.22 : 2.2 + this.r() * 1.2; }
        if (e.st.missiles && e.missileT <= 0 && dist > 15) { e.missileT = e.st.missileCD; this.fireMissiles(e, p); }
        if (e.def.breath && facing && e.meleeT <= 0 && dist < 15 * e.def.scale + 4 && !(e.breathT > 0)) { e.meleeT = e.boss ? 4 : 6; this.mh.startBreath(e, e.boss ? 1.6 : 1.0); }
        else if (e.def.thunder && e.meleeT <= 0 && dist < 40) { e.meleeT = 4.5; this.melee(e, [p]); }
        else if (e.meleeT <= 0 && dist < e.radius + p.radius + 4) { e.meleeT = 1.6; this.melee(e, [p]); }
      }
      if (e.hp < e.maxHp * 0.28 && !ai.retreated && !battle) { ai.state = 'retreat'; ai.t = 5; ai.retreated = true; }
    } else if (ai.state === 'retreat') {
      e.move(dt, toP.clone().normalize().negate(), 1, false); e.hp = Math.min(e.maxHp, e.hp + dt * 3);
      if (ai.t <= 0) { ai.state = 'chase'; e.roar = 1; }
    }
  }
  realThink(e, dt, p, dist, toP, pAlive, battle) {
    const s = e.def.scale, reach = e.radius + p.radius + 2.2 * s, dir = toP.clone().normalize(), ai = e.ai;
    e.look = clamp(angDiff(e.yaw, Math.atan2(toP.x, toP.z)), -1, 1);
    if (dist > reach) e.move(dt, dir, dist > 30 ? 1 : 0.85, false);
    else { e.move(dt, dir.clone().applyAxisAngle(up, Math.PI / 2 * (Math.sin(this.world.time * 0.5 + e.level) > 0 ? 1 : -1)), 0.2, false); e.yaw += clamp(angDiff(e.yaw, Math.atan2(dir.x, dir.z)), -3 * dt, 3 * dt); }
    if (!pAlive) return;
    const facing = Math.cos(angDiff(e.yaw, Math.atan2(toP.x, toP.z))) > 0.6;
    if (facing && dist < reach + 1.5 && e.laserT <= 0) { e.laserT = e.st.rate; this.bite(e, p); }
    const k = e.def.special, inRange = k === 'chomp' ? dist < 12 : k === 'charge' || k === 'headbutt' ? dist > 7 && dist < 26 : k === 'pounce' || k === 'spit' ? dist > 6 && dist < 24 : k === 'whip' ? dist < e.radius + 6 * s
      : k === 'rage' ? dist < 22 : k === 'combo' ? dist < 11 : k === 'honk' ? dist < 18 * s + 4
      : k === 'tsunami' ? dist < 24 * s + 4 : k === 'rockethorn' ? dist > 7 && dist < 32 : k === 'pack' ? dist > 5 && dist < 26 : k === 'cannon' ? dist > 10 && dist < 50
      : k === 'lavaslam' ? dist < e.radius + 7 * s : k === 'bark' ? dist < 18
      : k === 'ram' ? dist > 7 && dist < 30 : k === 'crush' ? dist < 12 * s : k === 'zap' ? dist < 34 : k === 'grab' ? dist < 24 : k === 'shock' ? dist < 13 : k === 'lure' ? dist < 22 : k === 'kraken' ? dist < 70 : dist < 13 * s;
    if (e.missileT <= 0 && inRange && facing) { e.missileT = e.st.missileCD; e.roar = 0.5; e.jaw = 1; this.later(0.4, () => { if (e.alive && !(e.stunT > 0) && !e.act) this.special(e, p); }); }
    if (e.meleeT <= 0 && dist < 30 && this.r() < dt * 0.3) { e.meleeT = e.st.roarCD; this.roarAt(e); }
  }
  // wild dragons: circle the player in the air, swoop in to blast and breathe; the Dragon King adds fire rain
  dragonThink(e, dt, p, dist, toP, pAlive, battle) {
    const ai = e.ai, dir = toP.clone().normalize(), want = e.boss ? 26 : 18;
    ai.mt = (ai.mt ?? 2) - dt; if (ai.mt <= 0) { ai.mode = ai.mode === 'attack' ? 'circle' : 'attack'; ai.mt = ai.mode === 'attack' ? 3 + this.r() * 2 : 2.5 + this.r() * 2; ai.side = this.r() < 0.5 ? 1 : -1; }
    let mv, mag;
    if (dist > want + 14) { mv = dir; mag = 1; }
    else if (ai.mode === 'attack') { mv = dir; mag = dist > want ? 0.7 : 0.1; }
    else { mv = dir.clone().applyAxisAngle(up, Math.PI / 2 * (ai.side || 1)).addScaledVector(dir, (dist - want) * 0.05).normalize(); mag = 0.8; }
    if (e.boss && battle) { tmp2.set(ARENA.x - e.pos.x, 0, ARENA.z - e.pos.z); if (tmp2.length() > 34) mv = tmp2.normalize(); }
    e.move(dt, mv, mag, false);
    const wantAlt = (e.boss ? 13 : 8) + Math.sin(this.world.time * 0.4 + e.level * 2) * 2.5 + (p.fly ? Math.min(20, p.alt) * 0.6 : 0);
    e.alt += clamp(wantAlt - e.alt, -6 * dt, 6 * dt);
    e.look = clamp(angDiff(e.yaw, Math.atan2(toP.x, toP.z)), -1, 1);
    if (!pAlive) return;
    const facing = Math.cos(angDiff(e.yaw, Math.atan2(toP.x, toP.z))) > 0.55;
    if (facing && e.laserT <= 0 && dist < 55) { e.laserT = e.boss ? 1.4 : 2.0 + this.r() * 1.4; this.fireOrb(e, p); if (e.boss) for (const k of [-1, 1]) this.later(0.18, () => e.alive && this.launchOrb(e, p, 'fire', 0.3 * k)); }
    if (facing && e.missileT <= 0 && dist < (e.boss ? 32 : 22) && !(e.breathT > 0)) { e.missileT = e.st.missileCD; this.dragonBreath(e); }
    if (e.boss) { e.barrageT = (e.barrageT ?? 8) - dt; if (e.barrageT <= 0) { e.barrageT = 10; this.fireRain(e); } }
    if (e.meleeT <= 0 && dist < 40 && this.r() < dt * 0.25) { e.meleeT = e.st.roarCD; this.roarAt(e); }
  }
  fireRain(e) {
    const p = this.player; e.roar = 1.7; sfx.bigRoar(0.42, 1, false); this.hud.toast('☄️ FIRE RAIN! Dodge the red circles!');
    for (let i = 0; i < 7; i++) this.later(0.4 + i * 0.28, () => { if (!e.alive || !p.alive) return; const a = this.r() * 6.28, d = i === 0 ? 0 : 4 + this.r() * 12;
      const to = new THREE.Vector3(p.pos.x + Math.cos(a) * d + Math.sin(p.yaw) * p.speedNow * 0.8, 0, p.pos.z + Math.sin(a) * d + Math.cos(p.yaw) * p.speedNow * 0.8); to.y = this.world.height(to.x, to.z) + 1;
      this.mh.launch('meteor', e.center.clone().add(new THREE.Vector3(0, 6, 0)), to, 1.3, { size: 1.4, P: 1.1, dmg: 26, R: 7, by: e, only: x => x === this.player, playerScale: 0.6 }); sfx.whistle(0.6); });
  }
  updatePickups(dt) {
    const p = this.player, t = this.world.time; if (!p) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    let nc = 0, ns = 0, nb = 0;
    const reach = (x, y, z) => (p.pos.x - x) ** 2 + (p.pos.z - z) ** 2 < (p.radius + 2.5) ** 2 && Math.abs(p.pos.y + 1 - y) < 6 + p.alt;
    for (const k of this.pickups) {
      if (!k.alive) { k.t -= dt; if (k.t <= 0) k.alive = true; continue; }
      const dx = k.x - p.pos.x, dz = k.z - p.pos.z; if (dx * dx + dz * dz > 160 * 160) continue;
      if (p.alive && reach(k.x, k.y + 1.2, k.z)) { k.alive = false; k.t = 60;
        if (k.type === 'core') { this.addBolts(10); p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35); p.boostE = p.st.boost; this.save.cores++; sfx.core(); this.hud.toast('+10 bolts  ⚡ Energy core!'); this.fx.sparks(v.set(k.x, k.y + 1.2, k.z), 20, { r: 0.3, g: 0.9, b: 1 }, 1); }
        else { this.addBolts(3); sfx.pickup(); this.fx.sparks(v.set(k.x, k.y + 1, k.z), 8, { r: 1, g: 0.9, b: 0.6 }, 0.6); }
        continue; }
      const bob = Math.sin(t * 2 + k.ph) * 0.3;
      q.setFromEuler(new THREE.Euler(k.type === 'scrap' ? 1.2 : 0, t * 1.5 + k.ph, 0));
      m4.compose(v.set(k.x, k.y + 1.3 + bob, k.z), q, s);
      if (k.type === 'core') { this.pk.core.setMatrixAt(nc++, m4); if (Math.random() < 0.08) this.fx.glow.spawn({ pos: v.clone(), vel: { x: 0, y: 1.5, z: 0 }, size: 2.4, size1: 0.3, life: 0.8, r: 0.2, g: 1.4, b: 1.8, alpha: 0.6 }); }
      else this.pk.scrap.setMatrixAt(ns++, m4);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t += dt; const g = this.world.height(b.x, b.z) + 0.4;
      const dx = p.pos.x - b.x, dz = p.pos.z - b.z, dy = p.pos.y + 1 - b.y, d = Math.hypot(dx, dy, dz);
      if (p.alive && b.t > 0.6 && d < 14) { const k = 30 / Math.max(1, d); b.vx = dx * k * 0.3; b.vy = dy * k * 0.3; b.vz = dz * k * 0.3; }
      else { b.vy -= 25 * dt; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; if (b.y < g && d >= 14) { b.y = g; b.vy *= -0.3; b.vx *= 0.7; b.vz *= 0.7; }
      if (p.alive && d < p.radius + 1.5 && b.t > 0.5) { this.addBolts(b.v); sfx.pickup(); this.bolts.splice(i, 1); continue; }
      if (b.t > 40) { this.bolts.splice(i, 1); continue; }
      if (nb < 160) this.pk.bolt.setMatrixAt(nb++, m4.compose(v.set(b.x, b.y, b.z), q.setFromEuler(new THREE.Euler(1.2, b.t * 5, 0)), s));
    }
    this.pk.core.count = nc; this.pk.scrap.count = ns; this.pk.bolt.count = nb;
    for (const m of Object.values(this.pk)) m.instanceMatrix.needsUpdate = true;
  }
  addBolts(n) { this.save.bolts += n; if (this.battle) this.battle.bolts += n; this.hud.bolts(); this.persist(); }
  endBattle() {
    const b = this.battle; if (!b || b.over) return; b.over = true;
    const bonus = b.kos * 10 + b.wave * 5; this.addBolts(bonus);
    this.save.bestBattle = Math.max(this.save.bestBattle || 0, b.kos); this.persist();
    if (this.player) this.player.shieldT = Math.max(this.player.shieldT || 0, 3.5);
    this.mh.celebrate(); this.later(2.9, () => { if (this.battle === b) this.hud.results(b, bonus); });
  }

  updateCamera(dt, inp) {
    const p = this.player, c = this.cam, h = p.mech.height;
    // auto-follow behind the dino while moving (unless the player is steering the camera)
    if (!inp.looking && p.speedNow > 1.5) { const want = p.yaw + Math.PI; c.yaw += angDiff(c.yaw, want) * Math.min(1, dt * 1.4); }
    let dist = 4 + h * 1.55 + (p.def.farmKid ? 1.8 : 0) + (p.fly ? (p.def.sea ? 3 + Math.max(0, 4 - h) : 4) : 0) + (p.boosting ? 1.5 : 0);
    // v4.3: Ricky & Bobby show: ease back + around so both dogs and the player share the frame, then restore
    const W = this.westies, st = W && W.active && W.stage; this.stageK = lerp(this.stageK || 0, st ? 1 : 0, Math.min(1, dt * 2.5));
    const sk = this.stageK > 0.002 && W && W.stage ? this.stageK : 0;
    if (sk) { dist = lerp(dist, Math.max(dist, W.stage.need), sk); if (!inp.looking) c.yaw += angDiff(c.yaw, W.stage.yaw) * Math.min(1, dt * 3) * sk; }
    c.dist = lerp(c.dist, dist, Math.min(1, dt * 3));
    const tgt = tmp.set(p.pos.x, p.pos.y + h * 0.82, p.pos.z);
    const cp = new THREE.Vector3(tgt.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, tgt.y + Math.sin(c.pitch) * c.dist, tgt.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist);
    const gh = Math.max(this.world.height(cp.x, cp.z), 0) + 1.2; if (cp.y < gh) cp.y = gh; if (this.world.ocean && cp.y > SURF - 2) cp.y = SURF - 2; // stay under the waves
    if (this.snapCam) { c.pos.copy(cp); c.look.copy(tgt); this.snapCam = false; }
    c.pos.lerp(cp, Math.min(1, dt * 8)); c.look.lerp(tgt, Math.min(1, dt * 12));
    this.camera.position.copy(c.pos);
    const sh = this.fx.shake; if (sh > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
    this.camera.lookAt(c.look);
    if (this.camHook) this.camHook(this.camera); // test/screenshot framing hook
  }
}
