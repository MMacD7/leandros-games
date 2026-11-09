// v5.7 Friendly lion: an original cartoon mount for Jungle Island. Leandro (the existing rider) sits on its back.
// No photos, no logos, no scary teeth. Built from simple shapes.
import * as THREE from './vendor/three.bundle.min.js';

export const LION = {
  id: 'lion', name: 'Friendly Lion', lion: true, real: true, kind: 'lion',
  desc: 'A gentle golden lion. Leandro rides him on Jungle Island.',
  hp: 150, speed: 12.5, bite: 14, biteRate: 0.48,
  special: 'nuzzle', specialName: '😺<br>NUZZLE', specialCD: 1.2, roar: 1.3,
  scale: 1, radius: 1.7, color: 0xe8a04a, accent: 0xffd56a,
};

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0, ...o });

export class LionMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.happy = 0;
    const fur = M(0xe39a3a), belly = M(0xf6d7a2), mane = M(0xc46212), mane2 = M(0xe88820), dark = M(0x6a3410);
    const nose = M(0xd9899a), ear = M(0xf0a0a8), white = M(0xfff8ee, { roughness: 0.35 }), eye = M(0x1a120c, { roughness: 0.25 });
    const paw = M(0xf0c07a), tuft = M(0xa34e10), blanket = M(0x8d4b22);
    this.mats = { plate: fur, glowColor: new THREE.Color(0xffc14a) };
    const obj = this.obj = new THREE.Group(); obj.name = 'friendly-lion';
    const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
    };
    // rounded body, pale belly, no claws
    const body = this.body = new THREE.Group(); obj.add(body);
    const torso = add(body, new THREE.SphereGeometry(1, 22, 16), fur, 0, 1.12, 0.05); torso.scale.set(0.58, 0.5, 1.12);
    const tum = add(body, new THREE.SphereGeometry(0.42, 14, 10), belly, 0, 0.78, 0.15); tum.scale.set(0.7, 0.55, 1.15);
    add(body, new THREE.SphereGeometry(0.28, 12, 10), fur, 0, 1.28, 0.72).scale.set(0.7, 0.62, 0.85); // chest
    // neck + friendly head
    const head = this.head = new THREE.Group(); head.position.set(0, 1.58, 1.18); obj.add(head);
    add(head, new THREE.CylinderGeometry(0.22, 0.28, 0.42, 12), fur, 0, -0.18, -0.22).rotation.x = 0.7;
    const skull = add(head, new THREE.SphereGeometry(0.4, 18, 14), fur, 0, 0.08, 0.12); skull.scale.set(1.05, 0.92, 1.12);
    add(head, new THREE.SphereGeometry(0.22, 12, 10), belly, 0, -0.06, 0.34).scale.set(0.85, 0.7, 0.75); // muzzle
    const noseM = add(head, new THREE.SphereGeometry(0.09, 10, 8), nose, 0, 0.02, 0.52); noseM.scale.set(1.1, 0.75, 0.8);
    this.mouth = new THREE.Group(); this.mouth.position.set(0, -0.12, 0.4); head.add(this.mouth);
    add(this.mouth, new THREE.TorusGeometry(0.1, 0.028, 6, 14, Math.PI), dark, 0, 0, 0.08).rotation.x = 0.35; // closed smile, no fangs
    for (const s of [-1, 1]) {
      const earG = new THREE.Group(); earG.position.set(s * 0.28, 0.32, 0.02); earG.rotation.z = s * -0.4; head.add(earG);
      add(earG, new THREE.SphereGeometry(0.16, 10, 8), fur, 0, 0.08, 0).scale.set(0.55, 1, 0.35);
      add(earG, new THREE.SphereGeometry(0.09, 8, 6), ear, 0, 0.06, 0.04).scale.set(0.45, 0.7, 0.2);
      add(head, new THREE.SphereGeometry(0.1, 10, 8), white, s * 0.16, 0.1, 0.38);
      const pupil = add(head, new THREE.SphereGeometry(0.055, 8, 6), eye, s * 0.17, 0.09, 0.45); pupil.scale.set(0.85, 1.15, 0.6);
      add(head, new THREE.SphereGeometry(0.02, 6, 4), white, s * 0.19, 0.13, 0.49);
    }
    // fluffy mane (spheres, warm orange, not a scary ruff)
    this.mane = new THREE.Group(); head.add(this.mane);
    const puffs = [[0, 0.38, -0.05, 0.28, mane], [0.32, 0.22, -0.02, 0.24, mane2], [-0.32, 0.22, -0.02, 0.24, mane2],
      [0.22, 0.02, -0.18, 0.26, mane], [-0.22, 0.02, -0.18, 0.26, mane], [0, 0.12, -0.28, 0.3, dark],
      [0.38, -0.08, 0.05, 0.2, mane2], [-0.38, -0.08, 0.05, 0.2, mane2], [0.12, 0.42, 0.12, 0.18, mane2], [-0.12, 0.42, 0.12, 0.18, mane]];
    for (const [x, y, z, r, mat] of puffs) { const s = add(this.mane, new THREE.SphereGeometry(r, 10, 8), mat, x, y, z); s.scale.set(1, 0.85, 0.9); }
    // four soft paws
    this.legs = [];
    const spots = [[-0.32, 0.62], [0.32, 0.62], [-0.3, -0.72], [0.3, -0.72]];
    for (const [x, z] of spots) {
      const g = new THREE.Group(); g.position.set(x, 0.98, z); obj.add(g);
      add(g, new THREE.CapsuleGeometry(0.13, 0.34, 3, 8), fur, 0, -0.28, 0);
      const ft = add(g, new THREE.SphereGeometry(0.16, 12, 8), paw, 0, -0.62, 0.06); ft.scale.set(1.15, 0.5, 1.3);
      this.legs.push(g);
    }
    // tufted tail
    this.tail = new THREE.Group(); this.tail.position.set(0, 1.22, -1.02); obj.add(this.tail);
    add(this.tail, new THREE.CapsuleGeometry(0.06, 0.7, 3, 6), fur, 0, 0.15, -0.28).rotation.x = 0.9;
    add(this.tail, new THREE.SphereGeometry(0.16, 10, 8), tuft, 0, 0.42, -0.55);
    // ride blanket + seat anchor (Leandro's saddle is added by the rider)
    add(body, new THREE.BoxGeometry(0.72, 0.08, 0.7), blanket, 0, 1.58, -0.22);
    this.seat = new THREE.Group(); this.seat.name = 'lion-seat'; this.seat.position.set(0, 1.62, -0.18); obj.add(this.seat);
    this.meshes = []; obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.height = 2.65; this.fitR = 3.6;
    this.sockets = { mouth: this.mouth };
  }
  socketPos(name, out) { const s = (name && this.sockets[name]) || this.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].getWorldPosition(out); }
  dispose() { this.meshes.forEach(m => m.geometry.dispose()); }
  animate(dt, speed, o = {}) {
    this.t += dt; const run = Math.min(1, speed / 14), k = Math.min(1, speed / 4);
    this.phase += dt * (speed > 0.4 ? 2.2 + speed * 0.55 : 0);
    const s = Math.sin(this.phase), gallop = speed > 16;
    const amp = (gallop ? 0.95 : 0.62) * k;
    this.legs.forEach((g, i) => { const off = (i < 2 ? 0 : Math.PI) + (i % 2 ? 0.4 : 0); g.rotation.x = Math.sin(this.phase + off) * amp; });
    const bob = k > 0 ? Math.abs(Math.cos(this.phase)) * (gallop ? 0.08 : 0.04) : Math.sin(this.t * 1.6) * 0.015;
    this.body.position.y = bob; this.head.position.y = 1.58 + bob * 0.6;
    this.head.rotation.x = (o.roar || 0) * -0.35 + Math.sin(this.t * 1.3) * 0.04 + (o.jaw || 0) * 0.12;
    this.head.rotation.y = Math.sin(this.t * 0.7) * 0.08 * (1 - k);
    this.mouth.rotation.x = (o.jaw || 0) * 0.7 + (o.roar || 0) * 0.45;
    this.mane.rotation.z = Math.sin(this.t * 2.2 + this.phase) * 0.05 * (0.4 + k);
    this.tail.rotation.y = Math.sin(this.t * 3 + this.phase) * (0.35 + run * 0.4);
    this.tail.rotation.x = -0.2 + Math.sin(this.t * 2) * 0.08;
    this.happy = Math.max(0, this.happy - dt);
    if (this.happy > 0) { this.head.rotation.z = Math.sin(this.t * 10) * 0.12; this.body.position.y += Math.abs(Math.sin(this.t * 8)) * 0.06; }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.mats.plate.emissive.setRGB(this.flash > 0.2 ? 0.35 : 0, this.flash > 0.2 ? 0.22 : 0, 0);
  }
}
