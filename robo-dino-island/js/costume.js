// v5.8 Rex Costume: an original cartoon inflatable T-rex the rider sits on.
// Straw safari hat, brown shirt, olive trousers, dark boots, legs dangling down the sides.
// Not a photo, not a real face, no logos. The Celtic-kit rider is a different character and is not used here.
import * as THREE from './vendor/three.bundle.min.js';

export const COSTUME = {
  id: 'costume', name: 'Rex Costume', costume: true, real: true, kind: 'costume',
  desc: 'A funny inflatable T-rex. Straw hat, brown shirt, olive trousers, legs dangling.',
  hp: 145, speed: 11.5, bite: 18, biteRate: 0.5,
  special: 'chomp', specialName: 'BIG<br>BITE', specialCD: 4, roar: 1.5,
  scale: 1, radius: 1.85, color: 0xf04a28, accent: 0x1a3d8f,
};

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0, ...o });

export class CostumeRex {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = false; this.flyer = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0;
    const bodyC = M(0xf04a28), belly = M(0xff8a55), blue = M(0x1a3d8f), speck = M(0xffb03a);
    const eyeC = M(0xc6e23a, { roughness: 0.3 }), pupil = M(0x1a1408, { roughness: 0.2 }), white = M(0xfff8ee);
    const straw = M(0xf3e2a0, { roughness: 0.85 }), shirt = M(0x8a4b2a), olive = M(0x5f7340), boot = M(0x241c16);
    const skin = M(0xf0c09a, { roughness: 0.55 }), smile = M(0xc45a6a);
    this.mats = { plate: bodyC, glowColor: new THREE.Color(0xffb03a) };
    const obj = this.obj = new THREE.Group(); obj.name = 'rex-costume';
    const add = (parent, geo, mat, x = 0, y = 0, z = 0, name) => {
      const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; if (name) o.name = name; parent.add(o); return o;
    };
    const body = this.body = new THREE.Group(); obj.add(body);
    const torso = add(body, new THREE.SphereGeometry(1, 22, 16), bodyC, 0, 1.15, 0.05, 'rex-body'); torso.scale.set(0.72, 0.62, 1.15);
    const tum = add(body, new THREE.SphereGeometry(0.5, 14, 10), belly, 0, 0.82, 0.2); tum.scale.set(0.7, 0.5, 1.05);
    // deep blue crown (top of the head) and back
    const back = add(body, new THREE.SphereGeometry(0.55, 14, 10), blue, 0, 1.55, -0.05, 'rex-back'); back.scale.set(0.85, 0.38, 1.35);
    const specks = [[0.22, 1.42, 0.35], [-0.28, 1.38, -0.15], [0.1, 1.5, -0.45], [-0.12, 1.46, 0.45], [0.32, 1.28, -0.35]];
    for (const [x, y, z] of specks) { const s = add(body, new THREE.SphereGeometry(0.1, 8, 6), speck, x, y, z, 'rex-speckle'); s.scale.set(1, 0.7, 1); }
    // head
    const head = this.head = new THREE.Group(); head.position.set(0, 1.72, 1.15); obj.add(head);
    add(head, new THREE.SphereGeometry(0.42, 16, 12), bodyC, 0, 0.05, 0.05).scale.set(1.05, 0.95, 1.15);
    const crown = add(head, new THREE.SphereGeometry(0.38, 12, 8), blue, 0, 0.22, -0.02, 'rex-crown'); crown.scale.set(0.95, 0.45, 0.9);
    add(head, new THREE.SphereGeometry(0.2, 10, 8), belly, 0, -0.08, 0.38).scale.set(0.9, 0.65, 0.7);
    this.mouth = new THREE.Group(); this.mouth.position.set(0, -0.16, 0.42); head.add(this.mouth);
    add(this.mouth, new THREE.TorusGeometry(0.09, 0.025, 6, 12, Math.PI), smile, 0, 0, 0.02).rotation.x = 0.2;
    for (const s of [-1, 1]) {
      const eye = add(head, new THREE.SphereGeometry(0.09, 10, 8), eyeC, s * 0.16, 0.1, 0.36, 'rex-eye'); eye.scale.set(1, 1.15, 0.7);
      add(head, new THREE.SphereGeometry(0.04, 8, 6), pupil, s * 0.17, 0.09, 0.43);
      add(head, new THREE.SphereGeometry(0.016, 6, 4), white, s * 0.19, 0.13, 0.46);
    }
    // tiny arms, big feet
    this.arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * 0.48, 1.15, 0.55); obj.add(a);
      add(a, new THREE.CapsuleGeometry(0.07, 0.18, 3, 6), bodyC, 0, -0.12, 0.08).rotation.x = -0.8;
      this.arms.push(a);
    }
    this.legs = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.28, 0.85, 0.15); obj.add(g);
      add(g, new THREE.CapsuleGeometry(0.16, 0.42, 3, 8), bodyC, 0, -0.32, 0);
      const ft = add(g, new THREE.SphereGeometry(0.2, 12, 8), bodyC, 0, -0.68, 0.12); ft.scale.set(1.15, 0.45, 1.45);
      this.legs.push(g);
    }
    this.tail = new THREE.Group(); this.tail.position.set(0, 1.15, -1.05); obj.add(this.tail);
    add(this.tail, new THREE.CapsuleGeometry(0.12, 0.7, 3, 8), bodyC, 0, 0.15, -0.35).rotation.x = 0.7;
    add(this.tail, new THREE.SphereGeometry(0.1, 8, 6), blue, 0, 0.42, -0.62);
    // the cartoon rider: generic smile, straw hat, brown shirt, olive trousers, dark boots
    this.seat = new THREE.Group(); this.seat.name = 'costume-seat'; this.seat.position.set(0, 1.72, -0.05); obj.add(this.seat);
    const rider = this.rider = new THREE.Group(); rider.name = 'costume-rider'; this.seat.add(rider);
    const shirtM = add(rider, new THREE.BoxGeometry(0.42, 0.36, 0.26), shirt, 0, 0.42, 0, 'costume-shirt');
    add(rider, new THREE.SphereGeometry(0.2, 14, 12), skin, 0, 0.78, 0.02).scale.set(1, 0.95, 0.95);
    add(rider, new THREE.SphereGeometry(0.035, 8, 6), pupil, -0.07, 0.82, 0.16);
    add(rider, new THREE.SphereGeometry(0.035, 8, 6), pupil, 0.07, 0.82, 0.16);
    add(rider, new THREE.TorusGeometry(0.07, 0.018, 6, 10, Math.PI), smile, 0, 0.7, 0.16).rotation.x = 0.15;
    const hat = new THREE.Group(); hat.name = 'costume-hat'; hat.position.set(0, 0.96, 0); rider.add(hat);
    add(hat, new THREE.CylinderGeometry(0.34, 0.36, 0.035, 16), straw, 0, 0, 0, 'costume-hat-brim');
    add(hat, new THREE.CylinderGeometry(0.16, 0.18, 0.16, 12), straw, 0, 0.09, 0, 'costume-hat-crown');
    add(hat, new THREE.TorusGeometry(0.17, 0.012, 6, 12), M(0xd8c080), 0, 0.04, 0); // band, no logo
    // chin cord
    for (const s of [-1, 1]) {
      const cord = add(hat, new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5), M(0xc8b48a), s * 0.12, -0.12, 0.08, 'costume-cord');
      cord.rotation.z = s * 0.35; cord.rotation.x = 0.4;
    }
    this.dangle = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.name = 'costume-leg'; leg.position.set(s * 0.36, 0.16, 0.1); rider.add(leg);
      add(leg, new THREE.CapsuleGeometry(0.08, 0.58, 3, 8), olive, 0, -0.4, 0.08, 'costume-trousers');
      add(leg, new THREE.BoxGeometry(0.16, 0.12, 0.26), boot, 0, -0.78, 0.12, 'costume-boots');
      this.dangle.push(leg);
    }
    shirtM.position.y = 0.42;
    this.meshes = []; obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.height = 2.85; this.fitR = 3.8;
    this.sockets = { mouth: this.mouth };
  }
  socketPos(name, out) { return (this.sockets[name] || this.mouth).getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].getWorldPosition(out); }
  dispose() { this.meshes.forEach(m => m.geometry.dispose()); }
  animate(dt, speed, o = {}) {
    this.t += dt; const k = Math.min(1, speed / 4);
    this.phase += dt * (speed > 0.4 ? 2.4 + speed * 0.45 : 0);
    const s = Math.sin(this.phase), amp = 0.55 * k;
    this.legs.forEach((g, i) => { g.rotation.x = (i ? -s : s) * amp; });
    this.arms.forEach((g, i) => { g.rotation.x = (i ? s : -s) * 0.35 * k; });
    const bob = k > 0 ? Math.abs(Math.cos(this.phase)) * 0.05 : Math.sin(this.t * 1.5) * 0.02;
    this.body.position.y = bob;
    this.head.position.y = 1.72 + bob;
    this.head.rotation.x = (o.roar || 0) * -0.28 + (o.jaw || 0) * 0.15;
    this.mouth.rotation.x = (o.jaw || 0) * 0.55 + (o.roar || 0) * 0.35;
    this.tail.rotation.y = Math.sin(this.t * 2.4 + this.phase) * 0.25;
    this.seat.position.y = 1.72 + bob;
    this.dangle.forEach((leg, i) => { leg.rotation.x = 0.35 + Math.sin(this.t * 3 + i) * 0.08 * (0.4 + k); leg.rotation.z = (i ? 1 : -1) * (0.95 + Math.sin(this.phase + i) * 0.06 * k); });
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.mats.plate.emissive.setRGB(this.flash > 0.2 ? 0.35 : 0, this.flash > 0.2 ? 0.12 : 0, 0);
  }
}
