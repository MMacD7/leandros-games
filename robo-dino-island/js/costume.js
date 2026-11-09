// v5.8.1 Rex Costume: original shaded cartoon art. Inflatable orange T-rex and a kid rider.
// Straw hat, brown shirt, olive trousers, dark boots, dangling legs. No photo, no raster copy, no logos.
import * as THREE from './vendor/three.bundle.min.js';

export const COSTUME = {
  id: 'costume', name: 'Rex Costume', costume: true, real: true, kind: 'costume',
  desc: 'A funny inflatable T-rex. Straw hat, brown shirt, olive trousers, legs dangling.',
  hp: 145, speed: 11.5, bite: 18, biteRate: 0.5,
  special: 'chomp', specialName: 'BIG<br>BITE', specialCD: 4, roar: 1.5,
  scale: 1, radius: 1.85, color: 0xf04a28, accent: 0x1a3d8f,
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let TEX = null;
function tex() {
  if (TEX) return TEX;
  const sheen = canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w * 0.38, h * 0.3, 6, w * 0.5, h * 0.55, w * 0.72);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.42, '#ececec'); grd.addColorStop(1, '#b5b5b5');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  const cloth = canvasTex(64, 96, (g, w, h) => {
    g.fillStyle = '#f3f3f3'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) { const k = 0.82 + 0.18 * Math.sin(x / w * Math.PI * 4); g.fillStyle = `rgba(0,0,0,${(1 - k) * 0.35})`; g.fillRect(x, 0, 1, h); }
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(w * 0.42, 0, w * 0.08, h);
  });
  const straw = canvasTex(128, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#fff6d2'); grd.addColorStop(0.55, '#f3e2a0'); grd.addColorStop(1, '#d7b56a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(140,90,30,.25)'; g.lineWidth = 1;
    for (let y = 3; y < h; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 1); g.stroke(); }
  });
  const skin = canvasTex(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w * 0.45, h * 0.38, 4, w * 0.5, h * 0.5, w * 0.55);
    grd.addColorStop(0, '#fff0e0'); grd.addColorStop(0.6, '#f0d2b4'); grd.addColorStop(1, '#d7a888');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  TEX = { sheen, cloth, straw, skin };
  return TEX;
}
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0, ...o });

export class CostumeRex {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = false; this.flyer = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0;
    const T = tex();
    const bodyC = M(0xf04a28, { map: T.sheen, roughness: 0.28, metalness: 0.04 });
    const belly = M(0xff8a55, { map: T.sheen, roughness: 0.48 });
    const blue = M(0x1a3d8f, { map: T.sheen, roughness: 0.4 });
    const speck = M(0xffb03a, { roughness: 0.5 });
    const eyeC = M(0xc6e23a, { roughness: 0.28 });
    const pupil = M(0x1a1408, { roughness: 0.2 });
    const white = M(0xfff8ee, { roughness: 0.3 });
    const straw = M(0xf3e2a0, { map: T.straw, roughness: 0.72 });
    const shirt = M(0x8a4b2a, { map: T.cloth, roughness: 0.78 });
    const olive = M(0x5f7340, { map: T.cloth, roughness: 0.8 });
    const boot = M(0x241c16, { roughness: 0.55 });
    const skin = M(0xd7a57a, { map: T.skin, roughness: 0.58 });
    const hair = M(0x2b1b12, { roughness: 0.86 });
    const smile = M(0xa33b45, { roughness: 0.55 });
    this.mats = { plate: bodyC, glowColor: new THREE.Color(0xffb03a) };
    const obj = this.obj = new THREE.Group(); obj.name = 'rex-costume';
    const add = (parent, geo, mat, x = 0, y = 0, z = 0, name) => {
      const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; if (name) o.name = name; parent.add(o); return o;
    };
    const body = this.body = new THREE.Group(); obj.add(body);
    const torso = add(body, new THREE.CapsuleGeometry(0.48, 1.15, 5, 10), bodyC, 0, 1.05, -0.05, 'rex-body'); torso.rotation.x = Math.PI / 2; torso.scale.set(1.15, 1, 1);
    add(body, new THREE.CapsuleGeometry(0.32, 0.35, 4, 8), belly, 0, 0.72, 0.15).rotation.x = Math.PI / 2;
    const neck = add(body, new THREE.CapsuleGeometry(0.2, 0.42, 3, 8), bodyC, 0, 1.28, 0.72); neck.rotation.x = -0.85;
    const back = add(body, new THREE.CapsuleGeometry(0.14, 1.7, 5, 10), blue, 0, 1.62, -0.05, 'rex-back'); back.rotation.x = Math.PI / 2;
    add(body, new THREE.BoxGeometry(0.04, 0.03, 2.05), M(0x0d2460), 0.16, 1.66, -0.05);
    add(body, new THREE.BoxGeometry(0.04, 0.03, 2.05), M(0x0d2460), -0.16, 1.66, -0.05);
    const specks = [[0.42, 1.15, 0.35], [-0.46, 1.05, -0.2], [0.38, 1.2, -0.55], [-0.4, 0.95, 0.45], [0.5, 0.9, 0.05], [-0.22, 1.35, 0.15]];
    for (const [x, y, z] of specks) { const s = add(body, new THREE.SphereGeometry(0.07, 7, 5), speck, x, y, z, 'rex-speckle'); s.scale.set(1.2, 0.55, 1); }

    const head = this.head = new THREE.Group(); head.position.set(0, 1.72, 1.28); head.name = 'rex-head'; obj.add(head);
    add(head, new THREE.SphereGeometry(0.34, 16, 14), bodyC, 0, 0.08, -0.02).scale.set(1.08, 0.92, 0.95);
    const snoutPts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, y = (t - 0.5) * 0.82;
      const r = Math.max(0.02, 0.175 * Math.pow(1 - t, 0.62));
      snoutPts.push(new THREE.Vector2(r, y));
    }
    const snout = add(head, new THREE.LatheGeometry(snoutPts, 18), bodyC, 0, -0.02, 0.58, 'rex-snout'); snout.rotation.x = Math.PI / 2;
    add(head, new THREE.SphereGeometry(0.16, 12, 8), bodyC, 0, 0.26, 0.1, 'rex-brow').scale.set(1.7, 0.32, 0.7);
    const crown = add(head, new THREE.CapsuleGeometry(0.12, 0.42, 4, 10), blue, 0, 0.32, 0.02, 'rex-crown'); crown.rotation.x = Math.PI / 2; crown.scale.set(1.15, 1, 0.7);
    this.mouth = new THREE.Group(); this.mouth.position.set(0, -0.14, 0.46); this.mouth.name = 'rex-jaw'; head.add(this.mouth);
    const jawPts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, y = (t - 0.45) * 0.55;
      jawPts.push(new THREE.Vector2(Math.max(0.02, 0.105 * Math.pow(1 - t, 0.7)), y));
    }
    const jaw = add(this.mouth, new THREE.LatheGeometry(jawPts, 14), belly, 0, -0.02, 0.1); jaw.rotation.x = Math.PI / 2; jaw.scale.set(1.05, 1, 0.72);
    for (let i = -2; i <= 2; i++) add(head, new THREE.BoxGeometry(0.045, 0.07, 0.03), white, i * 0.07, -0.08, 0.78, 'rex-tooth');
    for (let i = -1; i <= 1; i++) add(this.mouth, new THREE.BoxGeometry(0.04, 0.05, 0.03), white, i * 0.08, 0.06, 0.32, 'rex-tooth');
    for (const s of [-1, 1]) {
      const eye = add(head, new THREE.SphereGeometry(0.07, 10, 8), eyeC, s * 0.2, 0.16, 0.22, 'rex-eye'); eye.scale.set(1, 1.1, 0.7);
      add(head, new THREE.SphereGeometry(0.032, 8, 6), pupil, s * 0.205, 0.15, 0.27);
      add(head, new THREE.SphereGeometry(0.012, 6, 4), white, s * 0.22, 0.18, 0.3);
    }

    this.arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * 0.42, 1.15, 0.42); obj.add(a);
      add(a, new THREE.CapsuleGeometry(0.05, 0.12, 2, 6), bodyC, 0, -0.08, 0.08).rotation.x = -1.1;
      add(a, new THREE.ConeGeometry(0.035, 0.1, 5), bodyC, s * 0.04, -0.2, 0.16).rotation.x = 1.2;
      add(a, new THREE.ConeGeometry(0.03, 0.08, 5), bodyC, s * -0.02, -0.18, 0.18).rotation.x = 1.1;
      this.arms.push(a);
    }
    this.legs = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.34, 1.05, -0.25); g.rotation.x = -0.7; obj.add(g);
      add(g, new THREE.CapsuleGeometry(0.16, 0.32, 3, 7), bodyC, 0, -0.22, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.42, 0); knee.rotation.x = 1.35; g.add(knee);
      add(knee, new THREE.CapsuleGeometry(0.11, 0.28, 3, 6), bodyC, 0, -0.2, 0);
      const ft = add(knee, new THREE.BoxGeometry(0.28, 0.1, 0.42), bodyC, 0, -0.4, 0.12); ft.name = 'rex-foot';
      for (const c of [-0.09, 0, 0.09]) add(knee, new THREE.ConeGeometry(0.035, 0.1, 5), M(0xf6e2c4), c, -0.42, 0.3);
      this.legs.push({ g, knee });
    }
    this.tail = new THREE.Group(); this.tail.position.set(0, 1.15, -0.85); this.tail.name = 'rex-tail'; obj.add(this.tail);
    const t1 = add(this.tail, new THREE.CapsuleGeometry(0.2, 0.45, 3, 8), bodyC, 0, 0.05, -0.35); t1.rotation.x = Math.PI / 2;
    const t2 = add(this.tail, new THREE.CapsuleGeometry(0.12, 0.4, 3, 7), bodyC, 0, 0.12, -0.95); t2.rotation.x = 1.2;
    const t3 = add(this.tail, new THREE.CapsuleGeometry(0.06, 0.28, 2, 6), bodyC, 0, 0.28, -1.4); t3.rotation.x = 0.8;
    add(this.tail, new THREE.BoxGeometry(0.16, 0.08, 1.7), blue, 0, 0.28, -0.85, 'rex-tail-stripe');

    this.seat = new THREE.Group(); this.seat.name = 'costume-seat'; this.seat.position.set(0, 1.7, -0.02); obj.add(this.seat);
    const rider = this.rider = new THREE.Group(); rider.name = 'costume-rider'; this.seat.add(rider);
    add(rider, new THREE.SphereGeometry(0.16, 10, 8), olive, 0, 0.16, 0).scale.set(1.3, 0.7, 1);
    add(rider, new THREE.BoxGeometry(0.46, 0.32, 0.24), shirt, 0, 0.42, 0, 'costume-shirt');
    add(rider, new THREE.SphereGeometry(0.1, 8, 6), shirt, -0.24, 0.42, 0);
    add(rider, new THREE.SphereGeometry(0.1, 8, 6), shirt, 0.24, 0.42, 0);
    add(rider, new THREE.CylinderGeometry(0.07, 0.08, 0.08, 8), skin, 0, 0.6, 0);
    const skull = add(rider, new THREE.SphereGeometry(0.2, 16, 12), skin, 0, 0.8, 0.02, 'costume-face'); skull.scale.set(1, 1.02, 0.96);
    add(rider, new THREE.SphereGeometry(0.205, 12, 8, 0, Math.PI * 2, 0, 1.35), hair, 0, 0.82, -0.02).rotation.x = -0.15;
    add(rider, new THREE.SphereGeometry(0.06, 8, 6), hair, 0.02, 0.96, 0.12).scale.set(1.4, 0.45, 0.7);
    for (const s of [-1, 1]) {
      add(rider, new THREE.SphereGeometry(0.045, 8, 6), skin, s * 0.19, 0.78, 0).scale.set(0.45, 0.8, 0.55);
      add(rider, new THREE.SphereGeometry(0.045, 8, 6), white, s * 0.075, 0.82, 0.16);
      add(rider, new THREE.SphereGeometry(0.026, 8, 6), M(0x4a3428, { roughness: 0.3 }), s * 0.078, 0.818, 0.19);
      add(rider, new THREE.SphereGeometry(0.012, 6, 4), pupil, s * 0.082, 0.816, 0.208);
      add(rider, new THREE.SphereGeometry(0.006, 5, 4), white, s * 0.088, 0.828, 0.214);
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
      const leg = new THREE.Group(); leg.name = 'costume-leg'; leg.position.set(s * 0.34, 0.08, 0.02); rider.add(leg);
      add(leg, new THREE.CapsuleGeometry(0.075, 0.22, 3, 6), olive, 0, -0.16, 0.02);
      const knee = new THREE.Group(); knee.position.set(0, -0.32, 0.02); knee.rotation.x = 0.35; leg.add(knee);
      add(knee, new THREE.CapsuleGeometry(0.06, 0.24, 3, 6), olive, 0, -0.16, 0.02, 'costume-trousers');
      add(knee, new THREE.BoxGeometry(0.13, 0.1, 0.22), boot, 0, -0.36, 0.06, 'costume-boots');
      add(knee, new THREE.BoxGeometry(0.14, 0.03, 0.24), M(0x120e0c), 0, -0.42, 0.07);
      this.dangle.push(leg);
    }
    this.meshes = []; obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.height = 2.9; this.fitR = 3.8;
    this.sockets = { mouth: this.mouth };
  }
  socketPos(name, out) { return (this.sockets[name] || this.mouth).getWorldPosition(out); }
  footPos(i, out) { const L = this.legs[i % this.legs.length]; return (L.g || L).getWorldPosition(out); }
  dispose() { this.meshes.forEach(m => m.geometry.dispose()); }
  animate(dt, speed, o = {}) {
    this.t += dt; const k = Math.min(1, speed / 4);
    this.phase += dt * (speed > 0.4 ? 2.3 + speed * 0.42 : 1.1);
    const gallop = speed > 14;
    const amp = (gallop ? 0.7 : 0.45) * (speed > 0.4 ? k : 0.12);
    this.legs.forEach((L, i) => {
      const s = Math.sin(this.phase + (i ? Math.PI : 0));
      L.g.rotation.x = s * amp;
      L.knee.rotation.x = Math.max(0, -s) * 0.65 * Math.max(k, 0.15);
    });
    this.arms.forEach((g, i) => { g.rotation.x = -0.5 + (i ? 1 : -1) * Math.sin(this.phase) * 0.18 * k; });
    const bob = speed > 0.4 ? Math.abs(Math.cos(this.phase)) * (gallop ? 0.06 : 0.032) : Math.sin(this.t * 1.5) * 0.015;
    this.body.position.y = bob;
    this.head.position.y = 1.68 + bob * 0.65;
    this.head.rotation.x = (o.roar || 0) * -0.2 + (o.jaw || 0) * 0.1 + Math.sin(this.t * 1.3) * 0.02;
    this.mouth.rotation.x = (o.jaw || 0) * 0.4 + (o.roar || 0) * 0.22;
    this.tail.rotation.y = Math.sin(this.t * 2.2 + this.phase) * (0.2 + k * 0.25);
    this.tail.rotation.x = 0.05 + Math.sin(this.t * 1.6) * 0.04;
    this.seat.position.y = 1.7 + bob;
    this.rider.rotation.x = Math.sin(this.phase) * 0.03 * k;
    this.dangle.forEach((leg, i) => {
      leg.rotation.x = 0.15 + Math.sin(this.t * 2.4 + i) * 0.06 * (0.35 + k);
      leg.rotation.z = (i ? 1 : -1) * (0.55 + Math.sin(this.phase + i) * 0.05 * k);
    });
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.mats.plate.emissive.setRGB(this.flash > 0.2 ? 0.22 : 0, this.flash > 0.2 ? 0.06 : 0, 0);
  }
}
