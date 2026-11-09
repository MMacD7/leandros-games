// v5.8.3 original heroic battle lion. Fiery mane, gold fur, blue-silver armor with a plain bolt mark.
// Not a franchise character: no eye emblem, no logo, no borrowed name. Leandro rides in the hooped kit.
import * as THREE from './vendor/three.bundle.min.js';

export const LION = {
  id: 'lion', name: 'Thunder Lion', lion: true, real: true, kind: 'lion',
  desc: 'A heroic golden lion with cartoon thunder. Leandro rides him on Jungle Island and Farty Poop Farm.',
  hp: 150, speed: 12.5, bite: 14, biteRate: 0.48,
  special: 'nuzzle', specialName: '😺<br>NUZZLE', specialCD: 1.2, roar: 1.3,
  scale: 1, radius: 1.7, color: 0xe8a04a, accent: 0x39e0ff,
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let CEL = null;
function cel() {
  if (CEL) return CEL;
  CEL = canvasTex(4, 32, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 12);
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 12, w, 10);
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 22, w, 10);
  });
  return CEL;
}
const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: cel(), ...o });
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.08, map: cel(), ...o });
const ink = new THREE.MeshBasicMaterial({ color: 0x140c08, side: THREE.BackSide });

export class LionMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.happy = 0; this.cheek = 0; this.thunderT = 0;
    const fur = toon(0xe2a03a);
    const belly = toon(0xf0c56a);
    const fire = toon(0xe22810, { emissive: 0x6a1008, emissiveIntensity: 0.35 });
    const fire2 = toon(0xff7a18, { emissive: 0x802000, emissiveIntensity: 0.28 });
    const dark = toon(0x4a1208);
    const armor = new THREE.MeshStandardMaterial({ color: 0x2c6ec4, roughness: 0.28, metalness: 0.55 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xd5dee8, roughness: 0.22, metalness: 0.72 });
    const nose = toon(0xc46a58);
    const white = toon(0xfff6e8);
    const amber = new THREE.MeshStandardMaterial({ color: 0xffc14a, emissive: 0xffe080, emissiveIntensity: 1.15, roughness: 0.2 });
    const eye = toon(0x140e08);
    const paw = toon(0xf0c07a);
    this.mats = { plate: fur, glowColor: new THREE.Color(0xffc14a) };
    const obj = this.obj = new THREE.Group(); obj.name = 'friendly-lion';
    const add = (parent, geo, mat, x = 0, y = 0, z = 0, name) => {
      const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; if (name) o.name = name; parent.add(o); return o;
    };
    const body = this.body = new THREE.Group(); obj.add(body);
    const chest = add(body, new THREE.CapsuleGeometry(0.5, 1.05, 5, 14), fur, 0, 1.08, 0.02, 'lion-chest'); chest.rotation.x = Math.PI / 2;
    const chestInk = add(body, chest.geometry, ink, 0, 1.08, 0.02); chestInk.rotation.x = Math.PI / 2; chestInk.scale.setScalar(1.06);
    add(body, new THREE.SphereGeometry(0.42, 14, 12), fur, -0.4, 1.28, 0.28).scale.set(1.05, 0.9, 0.75);
    add(body, new THREE.SphereGeometry(0.42, 14, 12), fur, 0.4, 1.28, 0.28).scale.set(1.05, 0.9, 0.75);
    add(body, new THREE.SphereGeometry(0.46, 14, 12), fur, 0, 1.12, -0.85).scale.set(1.25, 1, 0.9);
    add(body, new THREE.CapsuleGeometry(0.32, 0.7, 4, 10), belly, 0, 0.7, 0.08).rotation.x = Math.PI / 2;
    const plate = add(body, new THREE.BoxGeometry(0.92, 0.62, 0.12), armor, 0, 1.16, 1.02, 'lion-armor');
    plate.rotation.x = -0.18;
    const bolt = new THREE.Group(); bolt.position.set(0, 1.18, 1.1); bolt.rotation.x = -0.18; bolt.name = 'lion-bolt'; body.add(bolt);
    const gold = new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffc020, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.2 });
    const b1 = add(bolt, new THREE.BoxGeometry(0.1, 0.28, 0.05), gold, 0.07, 0.1, 0); b1.rotation.z = -0.55;
    const b2 = add(bolt, new THREE.BoxGeometry(0.1, 0.26, 0.05), gold, -0.04, -0.08, 0); b2.rotation.z = 0.5;
    this.emblem = add(bolt, new THREE.BoxGeometry(0.28, 0.52, 0.02), new THREE.MeshBasicMaterial({ color: 0x39f0ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0, 0, 0.04, 'lion-emblem');
    add(body, new THREE.SphereGeometry(0.28, 12, 10), silver, -0.62, 1.38, 0.32).scale.set(1.15, 0.42, 0.75);
    add(body, new THREE.SphereGeometry(0.28, 12, 10), silver, 0.62, 1.38, 0.32).scale.set(1.15, 0.42, 0.75);

    const head = this.head = new THREE.Group(); head.position.set(0, 1.52, 1.28); head.name = 'lion-head'; obj.add(head);
    add(head, new THREE.CapsuleGeometry(0.24, 0.22, 4, 10), fur, 0, -0.06, -0.16).rotation.x = 0.7;
    const skull = add(head, new THREE.SphereGeometry(0.4, 16, 14), fur, 0, 0.14, -0.02); skull.scale.set(1.15, 0.92, 1.02);
    const skullInk = add(head, skull.geometry, ink, 0, 0.14, -0.02); skullInk.scale.set(1.22, 0.98, 1.08);
    const muz = add(head, new THREE.CapsuleGeometry(0.18, 0.26, 5, 12), belly, 0, -0.04, 0.36); muz.rotation.x = Math.PI / 2; muz.scale.set(1.15, 1, 0.72);
    add(head, new THREE.SphereGeometry(0.13, 12, 10), nose, 0, 0.02, 0.58).scale.set(1.35, 0.62, 0.7);
    add(head, new THREE.SphereGeometry(0.035, 8, 6), dark, -0.045, 0, 0.64);
    add(head, new THREE.SphereGeometry(0.035, 8, 6), dark, 0.045, 0, 0.64);
    this.mouth = new THREE.Group(); this.mouth.position.set(0, -0.16, 0.4); this.mouth.name = 'lion-mouth'; head.add(this.mouth);
    add(this.mouth, new THREE.CapsuleGeometry(0.12, 0.28, 4, 10), dark, 0, -0.02, 0.08).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      for (let w = 0; w < 3; w++) {
        const whisk = add(head, new THREE.CylinderGeometry(0.008, 0.006, 0.36, 4), white, s * 0.18, -0.02 + (w - 1) * 0.04, 0.4, 'lion-whisker');
        whisk.rotation.z = s * (Math.PI / 2); whisk.rotation.y = s * (0.15 + w * 0.12);
      }
      const ear = new THREE.Group(); ear.position.set(s * 0.28, 0.34, -0.04); ear.rotation.z = s * -0.4; head.add(ear);
      add(ear, new THREE.ConeGeometry(0.1, 0.22, 6), fur, 0, 0.08, 0);
      add(head, new THREE.BoxGeometry(0.22, 0.05, 0.05), dark, s * 0.18, 0.22, 0.32).rotation.z = s * -0.35;
      const iris = add(head, new THREE.SphereGeometry(0.075, 12, 8), amber, s * 0.17, 0.1, 0.32, 'lion-eye'); iris.scale.set(1.25, 0.38, 0.55);
      add(head, new THREE.SphereGeometry(0.032, 8, 6), eye, s * 0.175, 0.09, 0.36).scale.set(0.65, 1.15, 0.45);
      add(head, new THREE.SphereGeometry(0.014, 6, 4), white, s * 0.19, 0.105, 0.38);
    }
    this.mane = new THREE.Group(); this.mane.name = 'lion-mane'; head.add(this.mane);
    for (let i = 0; i < 20; i++) {
      const ang = -2.7 + (i / 19) * 5.4;
      const len = 1.05 + (i % 4) * 0.22;
      const rad = 0.13 + (i % 3) * 0.03;
      const cone = add(this.mane, new THREE.ConeGeometry(rad, len, 5), i % 2 ? fire : fire2, Math.sin(ang) * 0.5, 0.12 + Math.cos(ang) * 0.08, -0.12);
      cone.rotation.z = -Math.sin(ang) * 0.85;
      cone.rotation.x = 1.25;
      const rim = add(this.mane, new THREE.ConeGeometry(rad * 1.22, len * 1.02, 5), ink, cone.position.x, cone.position.y, cone.position.z - 0.02);
      rim.rotation.copy(cone.rotation);
    }
    const crest = add(this.mane, new THREE.ConeGeometry(0.16, 1.15, 5), fire, 0, 0.55, -0.2); crest.rotation.x = 0.55;

    this.legs = [];
    const spots = [[-0.38, 0.58], [0.38, 0.58], [-0.36, -0.82], [0.36, -0.82]];
    for (const [x, z] of spots) {
      const g = new THREE.Group(); g.position.set(x, 0.98, z); obj.add(g);
      add(g, new THREE.CapsuleGeometry(0.15, 0.32, 3, 8), fur, 0, -0.22, 0);
      add(g, new THREE.TorusGeometry(0.17, 0.04, 6, 10), silver, 0, -0.06, 0).rotation.x = Math.PI / 2;
      const knee = new THREE.Group(); knee.position.set(0, -0.46, 0); g.add(knee);
      add(knee, new THREE.CapsuleGeometry(0.1, 0.3, 3, 7), fur, 0, -0.2, 0);
      add(knee, new THREE.BoxGeometry(0.2, 0.07, 0.3), paw, 0, -0.38, 0.06, 'lion-paw');
      this.legs.push({ g, knee });
    }
    this.tail = new THREE.Group(); this.tail.position.set(0, 1.12, -1.25); this.tail.name = 'lion-tail'; obj.add(this.tail);
    const shaft = add(this.tail, new THREE.CapsuleGeometry(0.05, 0.9, 3, 6), fur, 0, 0.15, -0.4); shaft.rotation.x = 1.05;
    add(this.tail, new THREE.SphereGeometry(0.2, 10, 8), dark, 0, 0.52, -0.82, 'lion-tuft');
    this.rear = new THREE.Group(); this.rear.name = 'lion-rear'; this.rear.position.set(0, 0.95, -1.45); obj.add(this.rear);
    this.cloud = new THREE.Group(); this.rear.add(this.cloud);
    this.sparks = [];
    add(body, new THREE.BoxGeometry(0.62, 0.06, 0.5), M(0x8d4b22, { roughness: 0.8, map: null }), 0, 1.48, -0.2);
    this.seat = new THREE.Group(); this.seat.name = 'lion-seat'; this.seat.position.set(0, 1.62, -0.15); obj.add(this.seat);
    this.meshes = []; obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.height = 2.7; this.fitR = 3.8;
    this.sockets = { mouth: this.mouth, rear: this.rear };
  }
  socketPos(name, out) { const s = (name && this.sockets[name]) || this.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { const L = this.legs[i % this.legs.length]; return L.g.getWorldPosition(out); }
  dispose() { this.meshes.forEach(m => { if (m.geometry) m.geometry.dispose(); }); }
  animate(dt, speed, o = {}) {
    this.t += dt; const k = Math.min(1, speed / 4), run = Math.min(1, speed / 14);
    this.phase += dt * (speed > 0.4 ? 2.6 + speed * 0.45 : 1.3);
    const gallop = speed > 16, amp = (gallop ? 0.95 : 0.62) * (speed > 0.4 ? k : 0.12);
    this.legs.forEach((L, i) => {
      const s = Math.sin(this.phase + ((i === 0 || i === 3) ? 0 : Math.PI));
      L.g.rotation.x = s * amp;
      L.knee.rotation.x = Math.max(0, -s) * (gallop ? 1.1 : 0.8) * Math.max(k, 0.15);
    });
    const bob = speed > 0.4 ? Math.abs(Math.cos(this.phase * 2)) * (gallop ? 0.06 : 0.03) : Math.sin(this.t * 1.8) * 0.01;
    this.body.position.y = bob;
    this.head.position.y = 1.52 + bob * 0.4;
    this.head.rotation.x = (o.roar || 0) * -0.18 + (o.jaw || 0) * 0.06 - run * 0.08;
    this.head.rotation.y = Math.sin(this.t * 0.7) * 0.04 * (1 - k);
    this.mouth.rotation.x = (o.jaw || 0) * 0.35;
    this.mane.rotation.x = Math.sin(this.phase) * 0.04 * k;
    this.mane.rotation.z = Math.sin(this.t * 2) * 0.03;
    this.tail.rotation.y = Math.sin(this.t * 2.2 + this.phase) * (0.35 + run * 0.3);
    this.tail.rotation.x = this.thunderT > 0 ? -0.8 : -0.1 + Math.sin(this.t * 1.6) * 0.05;
    this.happy = Math.max(0, this.happy - dt);
    this.thunderT = Math.max(0, this.thunderT - dt);
    this.cheek = Math.max(0, (this.cheek || 0) - dt * 0.4);
    this.head.scale.setScalar(1 + this.cheek * 0.14);
    if (this.emblem) {
      const pulse = 0.25 + (this.thunderT > 0 ? 0.75 : 0.2 * Math.abs(Math.sin(this.t * 5)));
      this.emblem.material.opacity = pulse;
      this.emblem.scale.setScalar(0.85 + pulse * 0.35);
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.mats.plate.emissive.setRGB(this.flash > 0.2 ? 0.25 : 0, this.flash > 0.2 ? 0.12 : 0, 0);
  }
}
