// v5.8.1 Thunder lion: an original tawny battle lion. Leandro sits on its back in the hooped kit.
// Muscular body, layered mane, a calm face. No photos, no logos, no crests, no scary teeth.
import * as THREE from './vendor/three.bundle.min.js';

export const LION = {
  id: 'lion', name: 'Thunder Lion', lion: true, real: true, kind: 'lion',
  desc: 'A friendly golden lion with cartoon thunder. Leandro rides him on Jungle Island and Farty Poop Farm.',
  hp: 150, speed: 12.5, bite: 14, biteRate: 0.48,
  special: 'nuzzle', specialName: '😺<br>NUZZLE', specialCD: 1.2, roar: 1.3,
  scale: 1, radius: 1.7, color: 0xe8a04a, accent: 0xffd56a,
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let TEX = null;
function tex() {
  if (TEX) return TEX;
  const shade = canvasTex(64, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.45, '#f0f0f0'); grd.addColorStop(1, '#c8c8c8');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(w * 0.5, h * 0.28, w * 0.22, h * 0.12, 0, 0, 7); g.fill();
  });
  const strand = canvasTex(32, 128, (g, w, h) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) { g.fillStyle = x % 8 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.45)'; g.fillRect(x, 0, 2, h); }
  });
  TEX = { shade, strand };
  return TEX;
}
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0, ...o });

export class LionMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = true; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.happy = 0;
    const T = tex();
    const fur = M(0xe39a3a, { map: T.shade, roughness: 0.78 });
    const belly = M(0xf6d7a2, { map: T.shade, roughness: 0.82 });
    const mane = M(0xc46212, { map: T.strand, roughness: 0.86 });
    const mane2 = M(0xe88820, { map: T.strand, roughness: 0.84 });
    const dark = M(0x6a3410, { map: T.strand, roughness: 0.9 });
    const nose = M(0xc4747c, { roughness: 0.45 });
    const white = M(0xfff8ee, { roughness: 0.35 });
    const amber = M(0xc9862a, { roughness: 0.28 });
    const eye = M(0x1a120c, { roughness: 0.2 });
    const paw = M(0xf0c07a, { roughness: 0.8 });
    const tuft = M(0xa34e10, { map: T.strand, roughness: 0.88 });
    const blanket = M(0x8d4b22, { roughness: 0.8 });
    this.mats = { plate: fur, glowColor: new THREE.Color(0xffc14a) };
    const obj = this.obj = new THREE.Group(); obj.name = 'friendly-lion';
    const add = (parent, geo, mat, x = 0, y = 0, z = 0, name) => {
      const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; if (name) o.name = name; parent.add(o); return o;
    };
    const body = this.body = new THREE.Group(); obj.add(body);
    const torso = add(body, new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), fur, 0, 1.02, -0.05, 'lion-chest'); torso.rotation.x = Math.PI / 2; torso.scale.set(1.05, 1, 1);
    add(body, new THREE.SphereGeometry(0.36, 12, 10), fur, -0.28, 1.12, 0.42).scale.set(0.85, 0.9, 0.7);
    add(body, new THREE.SphereGeometry(0.36, 12, 10), fur, 0.28, 1.12, 0.42).scale.set(0.85, 0.9, 0.7);
    add(body, new THREE.SphereGeometry(0.4, 12, 10), fur, 0, 1.08, -0.72).scale.set(1.15, 0.95, 0.8);
    const tum = add(body, new THREE.SphereGeometry(0.4, 14, 10), belly, 0, 0.72, 0.12); tum.scale.set(0.75, 0.5, 1.2);
    add(body, new THREE.SphereGeometry(0.32, 12, 10), fur, 0, 1.22, 0.78).scale.set(0.85, 0.7, 0.8);

    const head = this.head = new THREE.Group(); head.position.set(0, 1.48, 1.22); head.name = 'lion-head'; obj.add(head);
    add(head, new THREE.CylinderGeometry(0.2, 0.26, 0.36, 12), fur, 0, -0.16, -0.18).rotation.x = 0.55;
    const skull = add(head, new THREE.SphereGeometry(0.38, 18, 14), fur, 0, 0.1, 0.02); skull.scale.set(1.08, 0.92, 1.05);
    const muzzle = add(head, new THREE.SphereGeometry(0.2, 14, 10), belly, 0, -0.04, 0.32); muzzle.scale.set(0.85, 0.62, 1.05);
    add(head, new THREE.SphereGeometry(0.1, 10, 8), nose, 0, 0.02, 0.5).scale.set(1.15, 0.72, 0.7);
    add(head, new THREE.SphereGeometry(0.028, 6, 4), dark, -0.035, 0.0, 0.56);
    add(head, new THREE.SphereGeometry(0.028, 6, 4), dark, 0.035, 0.0, 0.56);
    this.mouth = new THREE.Group(); this.mouth.position.set(0, -0.12, 0.4); this.mouth.name = 'lion-mouth'; head.add(this.mouth);
    add(this.mouth, new THREE.TorusGeometry(0.09, 0.02, 6, 12, Math.PI), dark, 0, 0, 0.06).rotation.x = 0.25;
    for (const s of [-1, 1]) {
      for (let w = 0; w < 3; w++) {
        const whisk = add(head, new THREE.CylinderGeometry(0.008, 0.008, 0.42, 4), white, s * (0.16 + w * 0.02), -0.02 + (w - 1) * 0.035, 0.42, 'lion-whisker');
        whisk.rotation.z = s * (Math.PI / 2 + (w - 1) * 0.18); whisk.rotation.y = s * 0.3;
      }
      const earG = new THREE.Group(); earG.position.set(s * 0.26, 0.32, -0.02); earG.rotation.z = s * -0.35; head.add(earG);
      add(earG, new THREE.SphereGeometry(0.14, 10, 8), fur, 0, 0.06, 0).scale.set(0.5, 1, 0.32);
      add(earG, new THREE.SphereGeometry(0.07, 8, 6), M(0xf0a0a8), 0, 0.05, 0.03).scale.set(0.4, 0.65, 0.18);
      add(head, new THREE.BoxGeometry(0.16, 0.04, 0.06), dark, s * 0.15, 0.2, 0.28).rotation.z = s * -0.2;
      add(head, new THREE.SphereGeometry(0.09, 10, 8), white, s * 0.15, 0.1, 0.3);
      const iris = add(head, new THREE.SphereGeometry(0.055, 10, 8), amber, s * 0.155, 0.095, 0.36, 'lion-eye'); iris.scale.set(1, 1.05, 0.55);
      const pupil = add(head, new THREE.SphereGeometry(0.03, 8, 6), eye, s * 0.158, 0.09, 0.4); pupil.scale.set(0.8, 1.2, 0.5);
      add(head, new THREE.SphereGeometry(0.014, 6, 4), white, s * 0.17, 0.11, 0.43);
    }
    this.mane = new THREE.Group(); this.mane.name = 'lion-mane'; head.add(this.mane);
    const ring = (n, y, z, rad, size, mat, lift) => {
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.15 + 0.7 * (i / (n - 1)));
        const s = add(this.mane, new THREE.SphereGeometry(size, 8, 6), mat, Math.cos(a) * rad * (i < n / 2 ? -1 : 1) * (0.15 + 0.85 * Math.abs(i / (n - 1) - 0.5) * 2), y + Math.sin(a) * lift, z - Math.cos(i / n * Math.PI) * 0.08);
        s.scale.set(0.85, 1.15, 0.7);
      }
    };
    const puffs = [[0, 0.42, -0.08, 0.26, mane], [0.34, 0.22, -0.02, 0.22, mane2], [-0.34, 0.22, -0.02, 0.22, mane2],
      [0.28, 0.02, -0.16, 0.24, mane], [-0.28, 0.02, -0.16, 0.24, mane], [0, 0.16, -0.28, 0.3, dark],
      [0.4, -0.1, 0.02, 0.18, mane2], [-0.4, -0.1, 0.02, 0.18, mane2], [0.16, 0.46, 0.02, 0.16, dark], [-0.16, 0.46, 0.02, 0.16, dark],
      [0.22, -0.16, -0.22, 0.2, dark], [-0.22, -0.16, -0.22, 0.2, dark]];
    for (const [x, y, z, r, mat] of puffs) { const s = add(this.mane, new THREE.SphereGeometry(r, 8, 6), mat, x, y, z); s.scale.set(0.9, 1.2, 0.75); }

    this.legs = [];
    const spots = [[-0.34, 0.55, 1], [0.34, 0.55, 1], [-0.32, -0.62, -1], [0.32, -0.62, -1]];
    for (const [x, z] of spots) {
      const g = new THREE.Group(); g.position.set(x, 1.02, z); obj.add(g);
      add(g, new THREE.CapsuleGeometry(0.11, 0.28, 3, 7), fur, 0, -0.2, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.4, 0); g.add(knee);
      add(knee, new THREE.CapsuleGeometry(0.08, 0.26, 3, 6), fur, 0, -0.18, 0);
      const ft = add(knee, new THREE.BoxGeometry(0.2, 0.08, 0.28), paw, 0, -0.38, 0.06, 'lion-paw');
      this.legs.push({ g, knee });
    }
    this.tail = new THREE.Group(); this.tail.position.set(0, 1.12, -1.05); this.tail.name = 'lion-tail'; obj.add(this.tail);
    add(this.tail, new THREE.CapsuleGeometry(0.055, 0.85, 3, 6), fur, 0, 0.2, -0.38).rotation.x = 0.85;
    add(this.tail, new THREE.SphereGeometry(0.2, 10, 8), M(0x3a2412, { roughness: 0.9 }), 0, 0.55, -0.78, 'lion-tuft');

    this.rear = new THREE.Group(); this.rear.name = 'lion-rear'; this.rear.position.set(0, 0.95, -1.12); obj.add(this.rear);
    const cloudMat = M(0xf7fbff, { roughness: 0.45, emissive: 0x9ecbff, emissiveIntensity: 0.35 });
    this.cloud = new THREE.Group(); this.rear.add(this.cloud);
    add(this.cloud, new THREE.SphereGeometry(0.22, 10, 8), cloudMat, 0, 0.28, 0);
    add(this.cloud, new THREE.SphereGeometry(0.15, 8, 6), cloudMat, 0.18, 0.2, 0.02);
    add(this.cloud, new THREE.SphereGeometry(0.15, 8, 6), cloudMat, -0.18, 0.2, 0.02);
    const bolt = M(0xfff4a8, { emissive: 0xfff2a0, emissiveIntensity: 1, roughness: 0.3 });
    const zig = (x, y, rz) => { const m = add(this.cloud, new THREE.BoxGeometry(0.16, 0.045, 0.045), bolt, x, y, 0.08); m.rotation.z = rz; return m; };
    zig(0, 0.02, 0.5); zig(0.08, -0.08, -0.6); zig(-0.02, -0.16, 0.4);
    this.sparks = [];
    const sparkAt = (x, y, z, blue, rz) => {
      const m = add(this.mane, new THREE.BoxGeometry(0.14, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: blue ? 0xb7e4ff : 0xfff6c0, transparent: true, opacity: 0.9, toneMapped: false }), x, y, z);
      m.rotation.z = rz; this.sparks.push(m);
    };
    [[0.36, 0.28, 0.02], [-0.36, 0.26, 0], [0, 0.5, -0.02]].forEach((p, i) => sparkAt(p[0], p[1], p[2], i % 2 === 0, (i - 1) * 0.4));
    this.thunderT = 0;
    add(body, new THREE.BoxGeometry(0.7, 0.07, 0.62), blanket, 0, 1.5, -0.15);
    this.seat = new THREE.Group(); this.seat.name = 'lion-seat'; this.seat.position.set(0, 1.62, -0.18); obj.add(this.seat);
    this.meshes = []; obj.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.height = 2.7; this.fitR = 3.6;
    this.sockets = { mouth: this.mouth, rear: this.rear };
  }
  socketPos(name, out) { const s = (name && this.sockets[name]) || this.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { const L = this.legs[i % this.legs.length]; return (L.g || L).getWorldPosition(out); }
  dispose() { this.meshes.forEach(m => m.geometry.dispose()); }
  animate(dt, speed, o = {}) {
    this.t += dt; const run = Math.min(1, speed / 14), k = Math.min(1, speed / 4);
    this.phase += dt * (speed > 0.4 ? 2.4 + speed * 0.5 : 1.2);
    const gallop = speed > 16;
    const amp = (gallop ? 0.9 : 0.55) * (speed > 0.4 ? k : 0.15);
    this.legs.forEach((L, i) => {
      const diag = (i === 0 || i === 3) ? 0 : Math.PI;
      const s = Math.sin(this.phase + diag);
      L.g.rotation.x = s * amp;
      L.knee.rotation.x = Math.max(0, -s) * (gallop ? 1.05 : 0.75) * Math.max(k, 0.2);
    });
    const bob = speed > 0.4 ? Math.abs(Math.cos(this.phase)) * (gallop ? 0.07 : 0.035) : Math.sin(this.t * 1.6) * 0.012;
    this.body.position.y = bob; this.head.position.y = 1.48 + bob * 0.5;
    this.head.rotation.x = (o.roar || 0) * -0.22 + Math.sin(this.t * 1.2) * 0.03 + (o.jaw || 0) * 0.08 - run * 0.06;
    this.head.rotation.y = Math.sin(this.t * 0.6) * 0.05 * (1 - k);
    this.mouth.rotation.x = (o.jaw || 0) * 0.45 + (o.roar || 0) * 0.28;
    this.mane.rotation.z = Math.sin(this.t * 2 + this.phase) * 0.04 * (0.4 + k);
    this.mane.rotation.x = Math.sin(this.phase) * 0.03 * k;
    this.tail.rotation.y = Math.sin(this.t * 2.4 + this.phase) * (0.28 + run * 0.35);
    this.tail.rotation.x = -0.15 + Math.sin(this.t * 1.8) * 0.06;
    this.happy = Math.max(0, this.happy - dt);
    this.thunderT = Math.max(0, (this.thunderT || 0) - dt);
    const pulse = this.thunderT > 0 ? 1 : 0.35 + 0.3 * Math.abs(Math.sin(this.t * 5));
    for (const s of this.sparks) { s.scale.setScalar(0.65 + pulse * 0.55); s.material.opacity = 0.35 + pulse * 0.6; }
    if (this.cloud) { this.cloud.position.y = Math.sin(this.t * 3) * 0.03 + (this.thunderT > 0 ? 0.12 : 0); this.cloud.rotation.z = Math.sin(this.t * 8) * (this.thunderT > 0 ? 0.22 : 0.03); }
    if (this.thunderT > 0) this.tail.rotation.x = -0.85;
    this.cheek = Math.max(0, (this.cheek || 0) - dt * 0.4);
    this.head.scale.setScalar(1 + this.cheek * 0.16);
    if (this.happy > 0) this.head.rotation.z = Math.sin(this.t * 8) * 0.08;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.mats.plate.emissive.setRGB(this.flash > 0.2 ? 0.28 : 0, this.flash > 0.2 ? 0.16 : 0, 0);
  }
}
