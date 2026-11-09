// v5.8.5 Thunder Lion. The approved drawing, shown as a camera-facing picture. No armor.
import * as THREE from './vendor/three.bundle.min.js';
import { ART, artMap, faceCamera, facingSign } from './art.js';

export const LION = {
  id: 'lion', name: 'Thunder Lion', lion: true, real: true, kind: 'lion',
  desc: 'A heroic golden lion with a fiery mane. Leandro rides him on Jungle Island and Farty Poop Farm.',
  hp: 150, speed: 12.5, bite: 14, biteRate: 0.48,
  special: 'nuzzle', specialName: '😺<br>NUZZLE', specialCD: 1.2, roar: 1.3,
  scale: 1, radius: 1.7, color: 0xe8a04a, accent: 0x39e0ff,
};

function plane(w, h, map, name) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    map, transparent: true, alphaTest: 0.28, depthWrite: true, side: THREE.DoubleSide, toneMapped: false,
  }));
  mesh.name = name; mesh.position.y = h * 0.5; mesh.frustumCulled = false; mesh.renderOrder = 2;
  return mesh;
}

export class LionMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.happy = 0; this.cheek = 0; this.thunderT = 0;
    this.ridden = true; this.face = 1; this._yaw = 0;
    const obj = this.obj = new THREE.Group(); obj.name = 'friendly-lion';
    const alone = { w: 4.35, h: 2.61 };
    const ride = { w: 4.55, h: 3.06 };
    this.sizes = { alone, ride };
    this.art = plane(ride.w, ride.h, artMap(ART.lionRide), 'lion-art');
    this.motion = new THREE.Group(); obj.add(this.motion); this.motion.add(this.art);
    this.body = new THREE.Group(); this.body.name = 'lion-body'; this.body.position.set(0, 1.15, 0); this.art.add(this.body);
    this.head = new THREE.Group(); this.head.name = 'lion-head'; this.head.position.set(ride.w * 0.32, 0.15, 0.02); this.art.add(this.head);
    this.mouth = new THREE.Group(); this.mouth.name = 'lion-mouth'; this.mouth.position.set(0.15, -0.05, 0.02); this.head.add(this.mouth);
    this.mane = new THREE.Group(); this.mane.name = 'lion-mane'; this.mane.position.set(-0.15, 0.25, 0); this.head.add(this.mane);
    const whisk = new THREE.Object3D(); whisk.name = 'lion-whisker'; whisk.position.set(0.2, -0.02, 0.02); this.head.add(whisk);
    this.rear = new THREE.Group(); this.rear.name = 'lion-rear'; this.rear.position.set(-ride.w * 0.36, -0.15, 0.04); this.art.add(this.rear);
    this.seat = new THREE.Group(); this.seat.name = 'lion-seat'; this.seat.position.set(-ride.w * 0.08, 0.35, 0); this.art.add(this.seat);
    this.legs = [];
    for (const x of [-0.7, -0.2, 0.35, 0.7]) {
      const g = new THREE.Group(); g.position.set(x, -ride.h * 0.42, 0); this.art.add(g);
      const knee = new THREE.Group(); g.add(knee); this.legs.push({ g, knee });
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; shadow.name = 'lion-shadow'; obj.add(shadow); this.shadow = shadow;
    this.mats = { plate: this.art.material, glowColor: new THREE.Color(0xffc14a) };
    this.setRidden(true);
    this.height = 2.9; this.fitR = 4.6;
    this.sockets = { mouth: this.mouth, rear: this.rear };
    this.meshes = [this.art, shadow];
  }
  setRidden(on) {
    this.ridden = !!on;
    const s = on ? this.sizes.ride : this.sizes.alone;
    this.art.material.map = artMap(on ? ART.lionRide : ART.lion);
    this.art.geometry.dispose();
    this.art.geometry = new THREE.PlaneGeometry(s.w, s.h);
    this.art.position.y = s.h * 0.5;
    this.head.position.x = s.w * 0.32;
    this.rear.position.x = -s.w * 0.36;
    this.seat.position.x = -s.w * (on ? 0.02 : 0.08);
    this.height = s.h;
  }
  socketPos(name, out) { const s = (name && this.sockets[name]) || this.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].g.getWorldPosition(out); }
  dispose() { this.art.geometry.dispose(); }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const moving = speed > 0.45, gallop = speed > 14;
    this.phase += dt * (moving ? (gallop ? 14 : 9) : 2.2);
    const bob = moving ? Math.abs(Math.sin(this.phase)) * (gallop ? 0.16 : 0.09) : Math.sin(this.t * 2.2) * 0.02;
    this.motion.position.y = bob;
    const yaw = this.obj.rotation.y;
    const turn = (o && o.turn) || (yaw - this._yaw);
    this._yaw = yaw;
    this.face = facingSign(yaw, this.face);
    faceCamera(this.art);
    const lean = Math.max(-0.18, Math.min(0.18, -turn * 2.2)) + Math.sin(this.phase) * (moving ? 0.035 : 0.012);
    this.art.rotateZ(lean);
    const sx = this.face * (1 + bob * 0.55);
    const sy = 1 - bob * 0.35 + (this.cheek || 0) * 0.04;
    this.art.scale.set(sx, sy, 1);
    this.shadow.scale.set(1.15 + bob, 1.15 + bob, 1);
    this.shadow.material.opacity = 0.28 + bob;
    this.happy = Math.max(0, this.happy - dt);
    this.thunderT = Math.max(0, this.thunderT - dt);
    this.cheek = Math.max(0, (this.cheek || 0) - dt * 0.4);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
  }
}
