// v5.8.4 Rex Costume. Sculpted CC0 T-rex (see CREDITS.md), recolored as an orange inflatable suit.
// Cowboy hat, green and white hoops, white shorts. No photo, no crest, no logos, no backpack.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneModel, playClip } from './models.js';

export const COSTUME = {
  id: 'costume', name: 'Rex Costume', costume: true, real: true, kind: 'costume',
  desc: 'A funny inflatable T-rex. Cowboy hat, hooped top, white shorts, legs dangling.',
  hp: 145, speed: 11.5, bite: 18, biteRate: 0.5,
  special: 'chomp', specialName: 'BIG<br>BITE', specialCD: 4, roar: 1.5,
  scale: 1, radius: 1.85, color: 0xf04a28, accent: 0x1a3d8f,
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.02, ...o });

function rexMap(src) {
  const img = src.image;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], gc = d.data[i + 1], b = d.data[i + 2];
    if (gc > r + 18 && gc > b + 8 && gc > 50) {
      const v = gc / 255;
      d.data[i] = Math.min(255, 255 * v);
      d.data[i + 1] = Math.min(255, 78 * v);
      d.data[i + 2] = Math.min(255, 36 * v);
    }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
  return t;
}

export class CostumeRex {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = false; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0;
    const { scene, animations } = cloneModel('assets/models/trex.glb');
    const obj = this.obj = new THREE.Group(); obj.name = 'rex-costume'; obj.add(scene);
    let skin = null; scene.traverse(o => { if (o.isSkinnedMesh) skin = o; });
    const srcMap = skin.material && skin.material.map;
    const map = srcMap && srcMap.image ? rexMap(srcMap) : null;
    const bodyC = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, roughness: 0.18, metalness: 0.02, clearcoat: 0.55, clearcoatRoughness: 0.18 });
    const orange = M(0xf04a28, { roughness: 0.2, metalness: 0.05 });
    skin.material = bodyC; skin.castShadow = true; skin.receiveShadow = true; skin.name = 'rex-body'; skin.raycast = () => {};
    this.mats = { plate: bodyC, glowColor: new THREE.Color(0xffb03a) };
    const head = this.head = scene.getObjectByName('Head');
    const spine = scene.getObjectByName('Spine');
    this.body = scene.getObjectByName('Hips');
    this.mouth = scene.getObjectByName('Mouth');
    this.mouth.name = 'rex-jaw';
    const snout = new THREE.Object3D(); snout.name = 'rex-snout'; snout.position.set(0, 0.15, 0.85); head.add(snout);
    const blue = M(0x1a3d8f, { roughness: 0.35, metalness: 0.08 });
    const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.7, 4, 8), blue);
    stripe.name = 'rex-back'; stripe.rotation.x = Math.PI / 2; stripe.position.set(0, 1.15, -0.1); spine.add(stripe);
    const sheen = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.9, 3, 8), orange);
    sheen.name = 'rex-sheen'; sheen.rotation.x = Math.PI / 2; sheen.position.set(0.22, 0.55, 0.1); spine.add(sheen);
    this.legs = [];
    for (const n of ['LeftLegF', 'RightLegF', 'LeftLegB', 'RightLegB']) {
      const g = scene.getObjectByName(n);
      const knee = new THREE.Group(); g.add(knee);
      this.legs.push({ g, knee });
    }
    this.tail = scene.getObjectByName('Tail');
    this.arms = [scene.getObjectByName('LeftHand'), scene.getObjectByName('RightHand')];
    this.seat = new THREE.Group(); this.seat.name = 'costume-seat'; this.seat.position.set(0, 0.85, -0.05); spine.add(this.seat);
    this.fitToSeat(scene, skin, 1.5);
    this.buildRider();
    scene.updateMatrixWorld(true);
    const seatAt = new THREE.Vector3(); this.seat.getWorldPosition(seatAt);
    this.obj.attach(this.rider);
    this.rider.position.copy(seatAt);
    this.rider.position.y += 0.05;
    this.rider.scale.setScalar(1);
    this.mixer = new THREE.AnimationMixer(scene);
    this.actions = {};
    for (const clip of animations) this.actions[clip.name] = this.mixer.clipAction(clip, scene);
    this.clip = '';
    this.clip = playClip(this.mixer, this.actions, '', 'idle', 1);
    this.meshes = []; obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    const fitted = new THREE.Box3().setFromObject(obj);
    const sz = fitted.getSize(new THREE.Vector3());
    this.height = sz.y; this.fitR = Math.max(sz.x, sz.y, sz.z) * 0.62;
    this.sockets = { mouth: this.mouth };
  }
  fitToSeat(scene, skin, target) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(skin);
    scene.scale.multiplyScalar(2.8 / Math.max(0.2, box.max.y - box.min.y));
    scene.updateMatrixWorld(true);
    const w = new THREE.Vector3(); this.seat.getWorldPosition(w);
    if (w.y > 0.2) scene.scale.multiplyScalar(target / w.y);
    scene.updateMatrixWorld(true);
    const grounded = new THREE.Box3().setFromObject(skin);
    scene.position.y -= grounded.min.y;
  }
  buildRider() {
    const hoop = canvasTex(64, 256, (g, w, h) => { const n = 7; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#018749'; g.fillRect(0, Math.floor(i * h / n), w, Math.ceil(h / n) + 1); } });
    const shirt = M(0xffffff, { map: hoop, roughness: 0.72 });
    const shorts = M(0xf7f7f4, { roughness: 0.7 });
    const boot = M(0x241c16, { roughness: 0.55 });
    const skin = M(0xd7a57a, { roughness: 0.58 });
    const hair = M(0x2b1b12, { roughness: 0.86 });
    const straw = M(0xf3e2a0, { roughness: 0.7 });
    const smile = M(0xa33b45, { roughness: 0.55 });
    const white = M(0xfff8ee, { roughness: 0.3 });
    const pupil = M(0x1a120c, { roughness: 0.3 });
    const add = (parent, geo, mat, x = 0, y = 0, z = 0, name) => {
      const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; if (name) o.name = name; parent.add(o); return o;
    };
    const rider = this.rider = new THREE.Group(); rider.name = 'costume-rider'; this.seat.add(rider);
    add(rider, new THREE.BoxGeometry(0.42, 0.28, 0.24), shirt, 0, 0.42, 0, 'costume-shirt');
    add(rider, new THREE.SphereGeometry(0.1, 8, 6), shirt, -0.24, 0.42, 0);
    add(rider, new THREE.SphereGeometry(0.1, 8, 6), shirt, 0.24, 0.42, 0);
    add(rider, new THREE.CylinderGeometry(0.07, 0.08, 0.08, 8), skin, 0, 0.6, 0);
    const skull = add(rider, new THREE.SphereGeometry(0.2, 16, 12), skin, 0, 0.8, 0.02, 'costume-face'); skull.scale.set(1, 1.02, 0.96);
    add(rider, new THREE.SphereGeometry(0.205, 12, 8, 0, Math.PI * 2, 0, 1.35), hair, 0, 0.82, -0.02).rotation.x = -0.15;
    for (const s of [-1, 1]) {
      add(rider, new THREE.SphereGeometry(0.045, 8, 6), skin, s * 0.19, 0.78, 0).scale.set(0.45, 0.8, 0.55);
      add(rider, new THREE.SphereGeometry(0.045, 8, 6), white, s * 0.075, 0.82, 0.16);
      add(rider, new THREE.SphereGeometry(0.026, 8, 6), M(0x4a3428, { roughness: 0.3 }), s * 0.078, 0.818, 0.19);
      add(rider, new THREE.SphereGeometry(0.012, 6, 4), pupil, s * 0.082, 0.816, 0.208);
      const brow = add(rider, new THREE.BoxGeometry(0.07, 0.012, 0.015), hair, s * 0.078, 0.88, 0.16); brow.rotation.z = s * -0.2;
    }
    add(rider, new THREE.SphereGeometry(0.028, 8, 6), skin, 0, 0.78, 0.2);
    add(rider, new THREE.TorusGeometry(0.055, 0.012, 6, 10, Math.PI), smile, 0, 0.72, 0.175).rotation.x = 0.2;
    const hat = new THREE.Group(); hat.name = 'costume-hat'; hat.position.set(0, 0.98, 0.02); rider.add(hat);
    const brim = add(hat, new THREE.CylinderGeometry(0.38, 0.34, 0.03, 18), straw, 0, 0, 0.02, 'costume-hat-brim'); brim.scale.set(1, 1, 0.86); brim.rotation.x = -0.22;
    add(hat, new THREE.TorusGeometry(0.16, 0.035, 6, 10, Math.PI), straw, 0, -0.02, 0.28).rotation.x = 0.4;
    add(hat, new THREE.CylinderGeometry(0.16, 0.2, 0.16, 12), straw, 0, 0.1, 0, 'costume-hat-crown').scale.set(0.72, 1, 1.05);
    add(hat, new THREE.CylinderGeometry(0.192, 0.192, 0.045, 14), M(0x8a5a28, { roughness: 0.6 }), 0, 0.04, 0, 'costume-band');
    for (const s of [-1, 1]) {
      const cord = add(hat, new THREE.CylinderGeometry(0.01, 0.01, 0.34, 5), M(0xc8b48a), s * 0.14, -0.14, 0.06, 'costume-cord');
      cord.rotation.z = s * 0.42; cord.rotation.x = 0.35;
    }
    this.hands = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(s * 0.22, 0.5, 0.02); rider.add(arm);
      arm.rotation.z = s * 0.7; arm.rotation.x = 0.7;
      add(arm, new THREE.CapsuleGeometry(0.055, 0.16, 2, 6), skin, 0, -0.12, 0);
      const fore = new THREE.Group(); fore.position.set(0, -0.26, 0); fore.rotation.x = -0.8; arm.add(fore);
      add(fore, new THREE.CapsuleGeometry(0.045, 0.14, 2, 6), skin, 0, -0.1, 0);
      const hand = add(fore, new THREE.SphereGeometry(0.055, 8, 6), skin, 0, -0.22, 0.02, 'costume-hand'); hand.scale.set(1.1, 0.75, 0.8);
      this.hands.push(arm);
    }
    this.dangle = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.name = 'costume-leg'; leg.position.set(s * 0.28, 0.12, 0.02); rider.add(leg);
      add(leg, new THREE.CapsuleGeometry(0.08, 0.18, 3, 6), shorts, 0, -0.14, 0.02, 'costume-trousers');
      const knee = new THREE.Group(); knee.position.set(0, -0.3, 0.02); knee.rotation.x = 0.35; leg.add(knee);
      add(knee, new THREE.CapsuleGeometry(0.055, 0.16, 3, 6), skin, 0, -0.12, 0.02);
      add(knee, new THREE.BoxGeometry(0.13, 0.1, 0.22), boot, 0, -0.32, 0.06, 'costume-boots');
      this.dangle.push(leg);
    }
  }
  socketPos(name, out) { return (this.sockets[name] || this.mouth).getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].g.getWorldPosition(out); }
  dispose() { this.meshes.forEach(m => { if (m.geometry) m.geometry.dispose(); }); }
  animate(dt, speed, o = {}) {
    this.t += dt; const k = Math.min(1, speed / 4);
    const gallop = speed > 14;
    this.clip = playClip(this.mixer, this.actions, this.clip, speed > 0.45 ? 'walk' : 'idle', gallop ? 1.7 : 1);
    this.mixer.update(dt);
    this.rider.rotation.x = Math.sin(this.t * 2) * 0.03 * k;
    this.dangle.forEach((leg, i) => {
      leg.rotation.x = 0.15 + Math.sin(this.t * 2.4 + i) * 0.06 * (0.35 + k);
      leg.rotation.z = (i ? 1 : -1) * (0.45 + Math.sin(this.t * 1.8 + i) * 0.05 * k);
    });
    if ((o.jaw || 0) > 0) this.mouth.rotation.x = Math.min(0.45, (o.jaw || 0) * 0.3);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.mats.plate.emissive.setRGB(this.flash > 0.2 ? 0.18 : 0, this.flash > 0.2 ? 0.05 : 0, 0);
  }
}
