// v5.8.7 T-Rex. Meshy model from the approved concept, rigged in this game.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneTrex } from './models.js';

const RIM = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
    float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.0);
    outgoingLight += vec3(0.55, 0.95, 0.45) * rim * 0.22;
    #include <output_fragment>`);
};

export class TrexMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = false; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.jaw = 0;
    this.skinned = true; this._clip = 'Idle';
    const obj = this.obj = new THREE.Group(); obj.name = 'trex-3d';
    const { scene, animations } = cloneTrex();
    const rig = this.rig = new THREE.Group(); obj.add(rig); rig.add(scene);
    const bones = {};
    const meshes = [];
    scene.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.raycast = () => {};
        meshes.push(o);
        const mats = [].concat(o.material);
        for (const m of mats) {
          if (!m) continue;
          m.roughness = 0.62; m.metalness = 0.0;
          m.emissive = new THREE.Color(0x102008); m.emissiveIntensity = 0.18;
          m.onBeforeCompile = RIM;
        }
      }
    });
    this.bones = bones; this.meshes = meshes;
    this.b = { pelvis: bones.hips, chest: bones.chest, neck: bones.neck, head: bones.head, jaw: bones.jaw };
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const s = 6.4 / Math.max(size.z, 0.001);
    rig.scale.setScalar(s);
    box.setFromObject(rig);
    rig.position.y -= box.min.y;
    this.modelScale = s;

    this.mouth = new THREE.Group(); this.mouth.name = 'trex-mouth';
    this.mouth.position.set(0, -0.02, 0.16); (bones.jaw || bones.head).add(this.mouth);
    this.seat = new THREE.Group(); this.seat.name = 'trex-seat';
    this.seat.position.set(0, 0.14, 0.02); (bones.spine || bones.hips).add(this.seat);
    this.body = new THREE.Group(); this.body.name = 'trex-body'; bones.chest.add(this.body);
    this.legs = [bones.l_foot, bones.r_foot].map(g => ({ g: g || new THREE.Group() }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; obj.add(shadow); this.shadow = shadow;

    this.mixer = new THREE.AnimationMixer(scene);
    this.actions = {};
    for (const clip of animations) {
      const act = this.mixer.clipAction(clip);
      act.play();
      act.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0);
      this.actions[clip.name] = act;
    }
    const mat = meshes[0] && meshes[0].material;
    this.mats = { plate: mat, glowColor: new THREE.Color(0xffc21a) };
    this.height = size.y * s; this.fitR = Math.max(size.x, size.z) * s * 0.48;
    this.sockets = { mouth: this.mouth };
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
  // One cycle covers this much ground, so the feet keep up with speedNow.
  cycleDist(name) {
    const leg = 0.48 * this.modelScale;
    const amp = name === 'Run' ? 40 : 32;
    return 4 * leg * Math.sin(amp * Math.PI / 180);
  }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const roar = Math.max(o.roar || 0, this.roar || 0);
    const bite = Math.max(o.bite || 0, (o.jaw || 0) > 0.45 && roar < 0.15 ? o.jaw : 0);
    let name = 'Idle', loop = true, scale = 1;
    if (this.ko > 0.2) { name = 'Stagger'; loop = false; }
    else if (roar > 0.25) { name = 'Roar'; loop = false; }
    else if (bite > 0.25) { name = 'Chomp'; loop = false; }
    else if (this.flash > 0.65 && speed < 3) { name = 'Stagger'; loop = false; scale = 1.1; }
    else if (speed > 8) { name = 'Run'; scale = Math.max(0.4, speed / this.cycleDist('Run') * 0.48); }
    else if (speed > 0.45) { name = 'Walk'; scale = Math.max(0.4, speed / this.cycleDist('Walk') * 0.8); }
    const act = this.play(name, loop, scale);
    this.mixer.update(dt);
    if (act && act.getClip()) this.phase = (act.time / act.getClip().duration) * Math.PI * 2;
    this.jaw = Math.max(0, (this.jaw || 0) - dt * 1.6);
    this.roar = Math.max(0, (this.roar || 0) - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    const plate = this.mats.plate;
    if (plate && plate.emissive) plate.emissive.setRGB(0.06 + this.flash * 0.7, 0.08, 0.03);
  }
}
