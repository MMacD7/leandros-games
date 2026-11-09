// v5.8.6 Thunder Lion. A rigged CC0 big cat (see CREDITS.md), restyled as a heroic golden battle cat.
// No armor. The fiery mane, glowing eyes and chest bolt are original geometry for this game.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneLion } from './models.js';

export const LION = {
  id: 'lion', name: 'Thunder Lion', lion: true, real: true, kind: 'lion',
  desc: 'A heroic golden lion with a fiery mane. Leandro rides him on Jungle Island and Farty Poop Farm.',
  hp: 150, speed: 12.5, bite: 14, biteRate: 0.48,
  special: 'nuzzle', specialName: '😺<br>NUZZLE', specialCD: 1.2, roar: 1.3,
  scale: 1, radius: 1.7, color: 0xe8a04a, accent: 0x39e0ff,
};

let CEL = null;
function cel() {
  if (CEL) return CEL;
  const c = document.createElement('canvas'); c.width = 4; c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 4, 3);
  g.fillStyle = '#d0d0d0'; g.fillRect(0, 3, 4, 2);
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 5, 4, 3);
  CEL = new THREE.CanvasTexture(c);
  CEL.colorSpace = THREE.SRGBColorSpace;
  CEL.minFilter = THREE.NearestFilter; CEL.magFilter = THREE.NearestFilter;
  return CEL;
}
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: cel(), ...extra });

const AX = new THREE.Vector3(1, 0, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const qSwing = new THREE.Quaternion();

export class LionMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.happy = 0; this.cheek = 0; this.thunderT = 0; this.jaw = 0;
    this.skinned = true;
    const obj = this.obj = new THREE.Group(); obj.name = 'friendly-lion';
    const scene = cloneLion();
    const rig = this.rig = new THREE.Group(); obj.add(rig); rig.add(scene);
    const bones = {};
    const skins = [];
    scene.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isSkinnedMesh) {
        const mats = [].concat(o.material);
        if (mats.some(m => m && /outline/i.test(m.name || ''))) { o.visible = false; return; }
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.raycast = () => {};
        o.material = toon(0xf0b24a, { emissive: 0x5a2808, emissiveIntensity: 0.18, side: THREE.DoubleSide });
        skins.push(o);
      }
    });
    this.bones = bones; this.skins = skins;
    this.rest = {};
    for (const [name, bone] of Object.entries(bones)) this.rest[name] = bone.quaternion.clone();
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z, 0.001);
    const s = 3.6 / longest;
    rig.scale.setScalar(s);
    box.setFromObject(rig);
    rig.position.y -= box.min.y;
    this.modelScale = s;
    // Outline shells from the source file and a second hull both turned into a black blob, so the cat stays double-sided gold.

    const headBone = bones.bn_c_head_01;
    const bodyBone = bones.bn_c_body_02 || bones.bn_c_body_01;
    const hipBone = bones.bn_c_body_01;
    this.head = new THREE.Group(); this.head.name = 'lion-head';
    this.mouth = new THREE.Group(); this.mouth.name = 'lion-mouth'; this.mouth.position.set(2.4, 0.2, 0); this.head.add(this.mouth);
    this.mane = new THREE.Group(); this.mane.name = 'lion-mane'; headBone.add(this.head); this.head.add(this.mane);
    this.buildMane();
    this.buildEyes();
    const whisk = new THREE.Object3D(); whisk.name = 'lion-whisker'; whisk.position.set(2.2, 0.3, 0.6); this.head.add(whisk);
    this.body = new THREE.Group(); this.body.name = 'lion-body'; bodyBone.add(this.body);
    this.seat = new THREE.Group(); this.seat.name = 'lion-seat';     this.seat.position.set(-0.4, 1.1, 0); bodyBone.add(this.seat);
    this.rear = new THREE.Group(); this.rear.name = 'lion-rear'; this.rear.position.set(-0.6, 0.5, 0); hipBone.add(this.rear);
    this.emblem = this.buildEmblem(); bodyBone.add(this.emblem);
    this.legs = ['bn_l_arm_end', 'bn_r_arm_end', 'bn_l_leg_end', 'bn_r_leg_end'].map(name => {
      const g = bones[name] || new THREE.Group();
      return { g, knee: g };
    });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; shadow.name = 'lion-shadow'; obj.add(shadow); this.shadow = shadow;
    this.mats = { plate: skins[0] ? skins[0].material : toon(0xf0b24a), glowColor: new THREE.Color(0xffc14a) };
    this.height = 2.5; this.fitR = 3.4;
    this.sockets = { mouth: this.mouth, rear: this.rear };
    this.meshes = skins.concat([shadow]);
  }
  buildMane() {
    const fire = toon(0xe22810, { emissive: 0xff4a10, emissiveIntensity: 0.55 });
    const fire2 = toon(0xff8a18, { emissive: 0xff6a00, emissiveIntensity: 0.4 });
    const geo = new THREE.ConeGeometry(0.55, 2.6, 5);
    this.spikes = [];
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2;
      const lift = Math.sin(ang * 2) * 0.35;
      const len = 0.85 + (i % 5) * 0.18;
      const spike = new THREE.Mesh(geo, i % 2 ? fire : fire2);
      spike.position.set(-0.4 + Math.cos(ang) * 0.3, 0.5 + Math.sin(ang) * 1.3, Math.sin(ang) * 1.4);
      spike.lookAt(spike.position.clone().add(new THREE.Vector3(-1, lift, Math.sin(ang))));
      // lookAt aims +Z; cones point +Y, so tip them outward from the neck
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.55, Math.sin(ang) * 0.85, Math.cos(ang) * 0.85).normalize());
      spike.scale.set(0.7 + (i % 3) * 0.15, len, 0.7 + (i % 3) * 0.15);
      spike.castShadow = true;
      this.mane.add(spike); this.spikes.push(spike);
    }
  }
  buildEyes() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x39e0ff });
    for (const z of [-4.2, 4.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat);
      eye.position.set(2.1, 0.7, z * 0.18); eye.name = 'lion-eye'; this.head.add(eye);
    }
  }
  buildEmblem() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 8); shape.lineTo(3.2, 2.2); shape.lineTo(0.8, 2.2); shape.lineTo(2.4, -6); shape.lineTo(-1.2, 0.4); shape.lineTo(1.1, 0.4); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x7af6ff, side: THREE.DoubleSide }));
    mesh.position.set(0.6, 0.8, 0.05); mesh.scale.setScalar(0.08); mesh.name = 'lion-bolt';
    return mesh;
  }
  socketPos(name, out) { const s = (name && this.sockets[name]) || this.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].g.getWorldPosition(out); }
  dispose() {}
  swing(name, axis, ang) {
    const bone = this.bones[name]; const rest = this.rest[name]; if (!bone || !rest) return;
    qSwing.setFromAxisAngle(axis, ang);
    bone.quaternion.copy(rest).multiply(qSwing);
  }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const moving = speed > 0.45;
    const stride = moving ? Math.max(1.6, 2.4 - speed * 0.04) : 2.4;
    this.phase += dt * (moving ? (speed / stride) * Math.PI * 2 : 1.2);
    const gallop = speed > 10;
    const amp = moving ? (gallop ? 0.85 : 0.55) : 0.08;
    const a = Math.sin(this.phase);
    const b = Math.sin(this.phase + Math.PI);
    this.swing('bn_l_arm_01', AZ, a * amp);
    this.swing('bn_r_arm_01', AZ, b * amp);
    this.swing('bn_l_leg_01', AZ, b * amp);
    this.swing('bn_r_leg_01', AZ, a * amp);
    this.swing('bn_l_arm_02', AX, Math.max(0, a) * amp * 0.7);
    this.swing('bn_r_arm_02', AX, Math.max(0, b) * amp * 0.7);
    this.swing('bn_l_leg_02', AX, Math.max(0, -b) * amp * 0.55);
    this.swing('bn_r_leg_02', AX, Math.max(0, -a) * amp * 0.55);
    const roar = Math.max(o.roar || 0, this.thunderT > 0 ? 1 : 0, this.roar || 0);
    const gulp = Math.max(o.jaw || 0, this.jaw || 0);
    this.swing('bn_c_head_01', AZ, -0.35 * roar + 0.45 * gulp + Math.sin(this.t * 1.4) * 0.04);
    this.swing('bn_c_tail_01', AZ, Math.sin(this.t * (moving ? 8 : 2)) * (moving ? 0.35 : 0.2));
    const bob = moving ? Math.abs(Math.sin(this.phase * 2)) * 0.06 : Math.sin(this.t * 2) * 0.02;
    this.rig.position.y = (this._baseY == null ? (this._baseY = this.rig.position.y) : this._baseY) + bob;
    for (let i = 0; i < this.spikes.length; i++) {
      const sp = this.spikes[i];
      const w = 1 + Math.sin(this.t * 3 + i) * 0.06 + roar * 0.08;
      sp.scale.y = (0.85 + (i % 5) * 0.18) * w;
    }
    if (this.emblem) this.emblem.material.color.setHex(this.thunderT > 0 ? 0xffffff : 0x7af6ff);
    this.shadow.scale.setScalar(1 + bob);
    this.jaw = Math.max(0, (this.jaw || 0) - dt * 1.4);
    this.happy = Math.max(0, this.happy - dt);
    this.thunderT = Math.max(0, this.thunderT - dt);
    this.cheek = Math.max(0, (this.cheek || 0) - dt * 0.4);
    this.roar = Math.max(0, (this.roar || 0) - dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
  }
}
