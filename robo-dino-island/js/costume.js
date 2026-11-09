// v5.8.5 Rex Costume. The approved drawing of Leandro on the inflatable T-rex, as a camera-facing picture.
import * as THREE from './vendor/three.bundle.min.js';
import { ART, artMap, faceCamera, facingSign } from './art.js';

export const COSTUME = {
  id: 'costume', name: 'Rex Costume', costume: true, real: true, kind: 'costume',
  desc: 'Leandro in a cowboy hat rides an orange and blue inflatable T-rex. Jungle Island only.',
  hp: 145, speed: 11.5, bite: 18, biteRate: 0.5,
  special: 'chomp', specialName: 'BIG<br>BITE', specialCD: 4, roar: 1.5,
  scale: 1, radius: 1.85, color: 0xf04a28, accent: 0x1a3d8f,
};

export class CostumeRex {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = false; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.face = 1; this._yaw = 0;
    const w = 4.15, h = 3.16;
    const obj = this.obj = new THREE.Group(); obj.name = 'rex-costume';
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: artMap(ART.rex), transparent: true, alphaTest: 0.28, depthWrite: true, side: THREE.DoubleSide, toneMapped: false,
    }));
    mesh.name = 'rex-art'; mesh.position.y = h * 0.5; mesh.frustumCulled = false; mesh.renderOrder = 2;
    this.art = mesh; this.rider = mesh;
    this.motion = new THREE.Group(); obj.add(this.motion); this.motion.add(mesh);
    this.body = new THREE.Group(); this.body.name = 'rex-body'; this.body.position.set(0, 0.1, 0); mesh.add(this.body);
    this.head = new THREE.Group(); this.head.name = 'rex-head'; this.head.position.set(w * 0.34, 0.35, 0.02); mesh.add(this.head);
    this.mouth = new THREE.Group(); this.mouth.name = 'rex-jaw'; this.mouth.position.set(0.2, -0.05, 0.02); this.head.add(this.mouth);
    const snout = new THREE.Object3D(); snout.name = 'rex-snout'; snout.position.set(0.25, 0, 0); this.head.add(snout);
    const stripe = new THREE.Object3D(); stripe.name = 'rex-back'; stripe.position.set(-0.2, 0.15, 0); mesh.add(stripe);
    this.seat = new THREE.Group(); this.seat.name = 'costume-seat'; this.seat.position.set(w * 0.02, 0.55, 0); mesh.add(this.seat);
    this.legs = [];
    for (const x of [-0.4, 0.45]) {
      const g = new THREE.Group(); g.position.set(x, -h * 0.4, 0); mesh.add(g);
      const knee = new THREE.Group(); g.add(knee); this.legs.push({ g, knee });
    }
    this.dangle = this.legs.map(L => L.g);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; obj.add(shadow); this.shadow = shadow;
    this.mats = { plate: mesh.material, glowColor: new THREE.Color(0xffb03a) };
    this.height = h; this.fitR = 4.4;
    this.sockets = { mouth: this.mouth };
    this.meshes = [mesh, shadow];
  }
  socketPos(name, out) { return (this.sockets[name] || this.mouth).getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].g.getWorldPosition(out); }
  dispose() { this.art.geometry.dispose(); }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const moving = speed > 0.45;
    this.phase += dt * (moving ? (speed > 12 ? 12 : 8) : 2);
    const bob = moving ? Math.abs(Math.sin(this.phase)) * 0.12 : Math.sin(this.t * 2) * 0.018;
    this.motion.position.y = bob;
    const yaw = this.obj.rotation.y;
    const turn = (o && o.turn) || (yaw - this._yaw);
    this._yaw = yaw;
    this.face = facingSign(yaw, this.face);
    faceCamera(this.art);
    this.art.rotateZ(Math.max(-0.16, Math.min(0.16, -turn * 2)) + Math.sin(this.phase) * (moving ? 0.03 : 0.01));
    this.art.scale.set(this.face * (1 + bob * 0.4), 1 - bob * 0.28, 1);
    this.shadow.scale.setScalar(1.1 + bob);
    if ((o && o.jaw) > 0) this.mouth.rotation.x = Math.min(0.4, o.jaw * 0.3);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
  }
}
