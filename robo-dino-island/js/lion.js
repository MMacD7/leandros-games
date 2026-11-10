// v5.8.6 Thunder Lion. Meshy model from the approved concept, rigged in this game. No armor.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneLion } from './models.js';

export const LION = {
  id: 'lion', name: 'Thunder Lion', lion: true, real: true, kind: 'lion',
  desc: 'A heroic golden lion with a fiery mane. Leandro rides him on Jungle Island and Farty Poop Farm.',
  hp: 150, speed: 12.5, bite: 14, biteRate: 0.48,
  special: 'nuzzle', specialName: '😺<br>NUZZLE', specialCD: 1.2, roar: 1.3,
  scale: 1, radius: 1.7, color: 0xe8a04a, accent: 0x39e0ff,
};

const RIM = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
    float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
    outgoingLight += vec3(1.0, 0.72, 0.35) * rim * 0.28;
    #include <output_fragment>`);
};

export class LionMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.happy = 0; this.cheek = 0; this.thunderT = 0; this.jaw = 0;
    this.skinned = true; this._clip = 'Idle';
    const obj = this.obj = new THREE.Group(); obj.name = 'friendly-lion';
    const { scene, animations } = cloneLion();
    const rig = this.rig = new THREE.Group(); obj.add(rig); rig.add(scene);
    const bones = {};
    scene.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.raycast = () => {};
        const mats = [].concat(o.material);
        for (const m of mats) {
          if (!m) continue;
          m.roughness = 0.62; m.metalness = 0.0;
          m.emissive = new THREE.Color(0x3a1808); m.emissiveIntensity = 0.22;
          m.onBeforeCompile = RIM;
        }
      }
    });
    this.bones = bones;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const s = 4.2 / Math.max(size.z, size.x, 0.001);
    rig.scale.setScalar(s);
    box.setFromObject(rig);
    rig.position.y -= box.min.y;
    this.modelScale = s;

    const head = bones.head;
    const spine = bones.spine || bones.chest;
    const hips = bones.hips;
    this.head = new THREE.Group(); this.head.name = 'lion-head'; head.add(this.head);
    this.mouth = new THREE.Group(); this.mouth.name = 'lion-mouth'; this.mouth.position.set(0, -0.05, 0.16); (bones.jaw || head).add(this.mouth);
    this.mane = new THREE.Group(); this.mane.name = 'lion-mane'; head.add(this.mane);
    const whisk = new THREE.Object3D(); whisk.name = 'lion-whisker'; whisk.position.set(0.08, 0.02, 0.18); head.add(whisk);
    this.body = new THREE.Group(); this.body.name = 'lion-body'; spine.add(this.body);
    this.seat = new THREE.Group(); this.seat.name = 'lion-seat'; this.seat.position.set(0, 0.1, 0.2); spine.add(this.seat);
    this.rear = new THREE.Group(); this.rear.name = 'lion-rear'; this.rear.position.set(0, 0.08, -0.22); (bones.tail1 || hips).add(this.rear);
    this.legs = ['fl_paw', 'fr_paw', 'bl_paw', 'br_paw'].map(name => ({ g: bones[name] || new THREE.Group(), knee: bones[name] }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.05, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; obj.add(shadow); this.shadow = shadow;

    this.mixer = new THREE.AnimationMixer(scene);
    this.actions = {};
    for (const clip of animations) {
      const act = this.mixer.clipAction(clip);
      act.play();
      act.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0);
      this.actions[clip.name] = act;
    }
    const mat = scene.getObjectByProperty('isMesh', true);
    this.mats = { plate: mat && mat.material, glowColor: new THREE.Color(0xffc14a) };
    this.height = size.y * s + 1.25; this.fitR = Math.max(size.x, size.z) * s * 0.62;
    this.sockets = { mouth: this.mouth, rear: this.rear };
  }
  socketPos(name, out) { const s = (name && this.sockets[name]) || this.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].g.getWorldPosition(out); }
  dispose() { this.mixer.stopAllAction(); }
  play(name, loop, scale) {
    const next = this.actions[name]; if (!next) return;
    const fresh = this._clip !== name;
    if (fresh) {
      next.reset();
      next.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
      next.clampWhenFinished = !loop;
      next.play();
      this._clip = name;
    }
    next.timeScale = scale;
    for (const [n, act] of Object.entries(this.actions)) {
      const target = n === name ? 1 : 0;
      act.setEffectiveWeight(fresh || !loop ? target : act.getEffectiveWeight() * 0.62 + target * 0.38);
    }
    return next;
  }
  // One cycle of the baked clip covers this much ground, so the feet keep up with speedNow.
  cycleDist(name) {
    const leg = 0.92 * this.modelScale;
    if (name === 'Run') return 4 * leg * Math.sin(35 * Math.PI / 180);
    if (name === 'Walk') return 4 * leg * Math.sin(32 * Math.PI / 180);
    return 1;
  }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const roar = Math.max(o.roar || 0, this.thunderT > 0 ? 1 : 0, this.roar || 0);
    const gulp = Math.max(o.jaw || 0, this.jaw || 0);
    let name = 'Idle', loop = true, scale = 1;
    if (gulp > 0.25) { name = 'Chomp'; loop = false; }
    else if (roar > 0.25) { name = 'Roar'; loop = false; }
    else if (speed > 8) { name = 'Run'; scale = Math.max(0.35, speed / this.cycleDist('Run') * 0.5); }
    else if (speed > 0.45) { name = 'Walk'; scale = Math.max(0.35, speed / this.cycleDist('Walk') * 0.8); }
    const act = this.play(name, loop, scale);
    this.mixer.update(dt);
    if (act && act.getClip()) this.phase = (act.time / act.getClip().duration) * Math.PI * 2;
    this.jaw = Math.max(0, (this.jaw || 0) - dt * 1.6);
    this.roar = Math.max(0, (this.roar || 0) - dt);
    this.thunderT = Math.max(0, this.thunderT - dt);
    this.happy = Math.max(0, this.happy - dt);
    this.cheek = Math.max(0, (this.cheek || 0) - dt * 0.4);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
  }
}
