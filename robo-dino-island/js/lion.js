// v5.8.4 Thunder Lion. Sculpted CC0 body (see CREDITS.md), restyled as an original heroic battle cat.
// Fiery mane, gold fur, blue-silver armor, a plain bolt mark. No franchise logo or borrowed name.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneModel, playClip } from './models.js';

export const LION = {
  id: 'lion', name: 'Thunder Lion', lion: true, real: true, kind: 'lion',
  desc: 'A heroic golden lion with cartoon thunder. Leandro rides him on Jungle Island and Farty Poop Farm.',
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
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 3, 4, 2);
  g.fillStyle = '#6e6e6e'; g.fillRect(0, 5, 4, 3);
  CEL = new THREE.CanvasTexture(c); CEL.colorSpace = THREE.SRGBColorSpace; CEL.minFilter = THREE.NearestFilter; CEL.magFilter = THREE.NearestFilter;
  return CEL;
}
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: cel(), ...extra });
function lionMap(src) {
  const img = src.image;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], gc = d.data[i + 1], b = d.data[i + 2];
    if (r > 150 && gc < r * 0.62 && gc > 30 && b < r * 0.45) {
      d.data[i] = Math.min(255, 210 + r * 0.15);
      d.data[i + 1] = Math.floor(gc * 0.35);
      d.data[i + 2] = Math.floor(b * 0.15);
    }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
  return t;
}

export class LionMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.happy = 0; this.cheek = 0; this.thunderT = 0;
    const { scene, animations } = cloneModel('assets/models/lion.glb');
    const obj = this.obj = new THREE.Group(); obj.name = 'friendly-lion'; obj.add(scene);
    let skin = null; scene.traverse(o => { if (o.isSkinnedMesh) skin = o; });
    const srcMap = skin.material && skin.material.map;
    const map = srcMap && srcMap.image ? lionMap(srcMap) : srcMap;
    const fur = toon(0xffffff, { map });
    skin.material = fur; skin.castShadow = true; skin.receiveShadow = true; skin.name = 'lion-body'; skin.raycast = () => {};
    this.mats = { plate: fur, glowColor: new THREE.Color(0xffc14a) };
    const head = this.head = scene.getObjectByName('Head');
    const spine = scene.getObjectByName('Spine');
    const hips = this.body = scene.getObjectByName('Hips');
    this.mouth = scene.getObjectByName('Mouth');
    this.tailBone = scene.getObjectByName('Tail');

    const fire = toon(0xe22810, { emissive: 0x7a1408, emissiveIntensity: 0.45 });
    const fire2 = toon(0xff7a18, { emissive: 0x802000, emissiveIntensity: 0.35 });
    const ink = new THREE.MeshBasicMaterial({ color: 0x1a0c06, side: THREE.BackSide });
    this.mane = new THREE.Group(); this.mane.name = 'lion-mane'; head.add(this.mane);
    for (let i = 0; i < 16; i++) {
      const ang = -2.5 + (i / 15) * 5.0;
      const len = 1.15 + (i % 4) * 0.28;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, len, 6), i % 2 ? fire : fire2);
      cone.position.set(Math.sin(ang) * 0.55, 0.15, -0.25 + Math.cos(ang) * 0.08);
      cone.rotation.z = -Math.sin(ang) * 0.9;
      cone.rotation.x = 1.35;
      cone.castShadow = true;
      this.mane.add(cone);
      const rim = new THREE.Mesh(cone.geometry, ink);
      rim.position.copy(cone.position); rim.rotation.copy(cone.rotation); rim.scale.setScalar(1.12);
      this.mane.add(rim);
    }

    const armor = new THREE.MeshStandardMaterial({ color: 0x2c6ec4, emissive: 0x123c88, emissiveIntensity: 0.45, metalness: 0.6, roughness: 0.28 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xd7e2ee, metalness: 0.75, roughness: 0.2 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffc020, emissiveIntensity: 0.85, metalness: 0.25, roughness: 0.3 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.05, 0.22), armor);
    plate.name = 'lion-armor'; plate.position.set(0, 0.72, 0.95); plate.castShadow = true; spine.add(plate);
    const bolt = new THREE.Group(); bolt.name = 'lion-bolt'; bolt.position.set(0, 0.74, 1.04); spine.add(bolt);
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.05), gold); b1.position.set(0.08, 0.1, 0); b1.rotation.z = -0.55; bolt.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.05), gold); b2.position.set(-0.05, -0.1, 0); b2.rotation.z = 0.5; bolt.add(b2);
    this.emblem = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, 0.03), new THREE.MeshBasicMaterial({ color: 0x39f0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.emblem.name = 'lion-emblem'; this.emblem.position.z = 0.04; bolt.add(this.emblem);
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), silver);
      pad.scale.set(1.25, 0.42, 0.8); pad.position.set(s * 0.78, 1.05, 0.35); pad.castShadow = true; spine.add(pad);
    }
    const white = toon(0xfff6e8);
    for (const s of [-1, 1]) for (let w = 0; w < 3; w++) {
      const whisk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.55, 4), white);
      whisk.name = 'lion-whisker';
      whisk.position.set(s * 0.28, -0.05 + (w - 1) * 0.08, 0.55);
      whisk.rotation.z = s * Math.PI / 2; whisk.rotation.y = s * (0.25 + w * 0.18);
      head.add(whisk);
    }
    this.legs = [];
    for (const n of ['LeftLegF', 'RightLegF', 'LeftLegB', 'RightLegB']) {
      const g = scene.getObjectByName(n);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 12), silver);
      band.rotation.x = Math.PI / 2; g.add(band);
      const knee = new THREE.Group(); g.add(knee);
      this.legs.push({ g, knee });
    }
    this.rear = new THREE.Group(); this.rear.name = 'lion-rear'; this.rear.position.set(0, 0.2, -1.15); hips.add(this.rear);
    this.seat = new THREE.Group(); this.seat.name = 'lion-seat'; this.seat.position.set(0, 0.95, -0.05); spine.add(this.seat);
    this.fitToSeat(scene, skin, 1.45);
    this.placeArmor(scene, skin, spine);
    this.mixer = new THREE.AnimationMixer(scene);
    this.actions = {};
    for (const clip of animations) this.actions[clip.name] = this.mixer.clipAction(clip, scene);
    this.clip = '';
    this.clip = playClip(this.mixer, this.actions, '', 'idle', 1);
    this.meshes = []; obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    const fitted = new THREE.Box3().setFromObject(obj);
    const sz = fitted.getSize(new THREE.Vector3());
    this.height = sz.y; this.fitR = Math.max(sz.x, sz.y, sz.z) * 0.72;
    this.sockets = { mouth: this.mouth, rear: this.rear };
  }
  fitToSeat(scene, skin, target) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(skin);
    const h = Math.max(0.2, box.max.y - box.min.y);
    scene.scale.multiplyScalar(2.7 / h);
    scene.updateMatrixWorld(true);
    const w = new THREE.Vector3(); this.seat.getWorldPosition(w);
    if (w.y > 0.2) scene.scale.multiplyScalar(target / w.y);
    scene.updateMatrixWorld(true);
    const grounded = new THREE.Box3().setFromObject(skin);
    scene.position.y -= grounded.min.y;
  }
  placeArmor(scene, skin, spine) {
    scene.updateMatrixWorld(true);
    const mouth = new THREE.Vector3(), hips = new THREE.Vector3();
    this.mouth.getWorldPosition(mouth); this.body.getWorldPosition(hips);
    const chest = hips.clone().lerp(mouth, 0.62); chest.y += 0.12;
    const plate = spine.getObjectByName('lion-armor');
    const bolt = spine.getObjectByName('lion-bolt');
    const put = (node, pos) => { const local = pos.clone(); spine.worldToLocal(local); node.position.copy(local); };
    if (plate) { put(plate, chest); plate.scale.set(1.15, 0.85, 0.5); }
    if (bolt) { put(bolt, chest.clone().add(mouth.clone().sub(hips).normalize().multiplyScalar(0.1))); bolt.scale.setScalar(1); }
    scene.updateMatrixWorld(true);
  }
  socketPos(name, out) { const s = (name && this.sockets[name]) || this.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].g.getWorldPosition(out); }
  dispose() { this.meshes.forEach(m => { if (m.geometry) m.geometry.dispose(); }); }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const moving = speed > 0.45, gallop = speed > 16;
    this.clip = playClip(this.mixer, this.actions, this.clip, moving ? 'walk' : 'idle', gallop ? 1.85 : 1);
    this.mixer.update(dt);
    this.mane.rotation.x = Math.sin(this.t * 2.2) * 0.05 * (moving ? 1 : 0.3);
    this.mane.rotation.z = Math.sin(this.t * 1.6) * 0.04;
    this.happy = Math.max(0, this.happy - dt);
    this.thunderT = Math.max(0, this.thunderT - dt);
    this.cheek = Math.max(0, (this.cheek || 0) - dt * 0.4);
    const puff = 1 + this.cheek * 0.12;
    this.head.scale.setScalar(puff);
    if (this.emblem) {
      const pulse = 0.3 + (this.thunderT > 0 ? 0.7 : 0.18 * Math.abs(Math.sin(this.t * 5)));
      this.emblem.material.opacity = pulse;
      this.emblem.scale.setScalar(0.9 + pulse * 0.3);
    }
    if ((o.jaw || 0) > 0 && this.mouth) this.mouth.rotation.x = Math.min(0.4, (o.jaw || 0) * 0.25);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.mats.plate.emissive.setRGB(this.flash > 0.2 ? 0.2 : 0, this.flash > 0.2 ? 0.08 : 0, 0);
  }
}
