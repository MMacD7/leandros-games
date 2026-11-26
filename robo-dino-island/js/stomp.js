// v5.13 STOMPOLIS — The Swing Boy. Textured towers, warm daylight, one Zip-Goo cable from his palm.
// Buildings stay standing (this is not Mega City Smash). No webs, no web marks, no licensed music.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { sfx } from './audio.js';
import { voice } from './voice.js';
import { davidModel } from './farm.js';
import { buildAllTowers, fadeCityProps, castCityShadows } from './stompCity.js';

export const HOOP = { id: 'hoopster', name: 'The Swing Boy', kind: 'kid', farmKid: true, hoopster: true, real: true, hp: 100, speed: 6.5, bite: 0, biteRate: 0.3, special: 'none', specialName: 'ZIP', specialCD: 1, roar: 1, scale: 1, radius: 0.55, color: 0x1f8a45, accent: 0x3de8ff };

export function rawHeightStomp() { return 1.6; }

const TOWERS = [
  { x: -4.1, z: 0.4, r: 6.4, h: 28, kind: 'pot', col: 0xf4e2c4 },
  { x: 16.9, z: 6.1, r: 5.2, h: 34, kind: 'egg', col: 0x2f8f8a },
  { x: 31.8, z: -10.7, r: 6.2, h: 44, kind: 'pot', col: 0xe36b58 },
  { x: 44.8, z: 8.0, r: 5.4, h: 44, kind: 'crane', col: 0xf7e7cf },
  { x: 10.3, z: -17.3, r: 5.8, h: 36, kind: 'egg', col: 0x3aa0a8 },
  { x: 31.8, z: -34.6, r: 7.2, h: 76, kind: 'neck', col: 0xb8c4d2 },
  { x: 52.8, z: -16.8, r: 5.6, h: 32, kind: 'dome', col: 0xe8b07a },
  { x: -20.4, z: 15.8, r: 5.0, h: 40, kind: 'egg', col: 0x1f7a86 },
  { x: -12.4, z: -18.9, r: 4.6, h: 38, kind: 'pot', col: 0xf6c7a8 },
  { x: -2.3, z: 27.3, r: 5.5, h: 67, kind: 'egg', col: 0xd4554a },
  { x: 18.1, z: 27.4, r: 4.4, h: 27, kind: 'pot', col: 0xf0e2c8 },
  { x: -28.5, z: -4.6, r: 6.0, h: 60, kind: 'crane', col: 0x4aa3a0 },
];

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.72, metalness: o.metalness ?? 0.04, emissive: o.emissive || 0x000000, emissiveIntensity: o.em || 0 });

function add(parent, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function prop(mesh) {
  mesh.userData.fadeProp = true;
  if (mesh.material) { mesh.material.transparent = true; mesh.material.opacity = 1; }
  return mesh;
}

function streetTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#4e463c'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#6d6256';
  g.fillRect(0, 200, 512, 112); g.fillRect(196, 0, 120, 512);
  g.fillStyle = '#d8d2c6';
  g.fillRect(0, 248, 512, 6); g.fillRect(250, 0, 6, 512);
  g.fillStyle = '#3f8a42';
  g.fillRect(20, 20, 90, 70); g.fillRect(390, 400, 80, 70);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function buildStomp(W) {
  const root = new THREE.Group(); root.name = 'stompolis'; W.root.add(root);
  const street = new THREE.Mesh(new THREE.CircleGeometry(70, 40), new THREE.MeshStandardMaterial({ map: streetTex(), roughness: 0.92 }));
  street.rotation.x = -Math.PI / 2; street.position.y = 1.5; street.receiveShadow = true; root.add(street);
  const park = new THREE.Mesh(new THREE.RingGeometry(70, 140, 40), M(0x4f8a40, { roughness: 0.95 }));
  park.rotation.x = -Math.PI / 2; park.position.y = 1.45; root.add(park);
  const haze = new THREE.Mesh(new THREE.CircleGeometry(100, 28), new THREE.MeshBasicMaterial({ color: 0xede6da, transparent: true, opacity: 0.18, depthWrite: false }));
  haze.rotation.x = -Math.PI / 2; haze.position.y = 3; root.add(haze);
  buildStreetKit(root);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; float puff(vec2 p, vec2 o, float r){ return smoothstep(1.0, 0.35, length(p - o) / r); } void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0.0, 1.0); vec3 hor = vec3(0.749, 0.902, 1.0); vec3 top = vec3(0.310, 0.659, 1.0); vec3 c = mix(hor, top, smoothstep(0.0, 0.62, h)); vec2 uv = d.xz / max(0.2, d.y + 0.35); float cl = puff(uv, vec2(-0.55, 0.15), 0.5) + puff(uv, vec2(0.62, -0.2), 0.42) + puff(uv, vec2(0.05, 0.72), 0.34); c = mix(c, vec3(1.0), clamp(cl, 0.0, 1.0) * smoothstep(0.0, 0.1, h) * 0.9); gl_FragColor = vec4(c, 1.0); }',
  }));
  sky.frustumCulled = false; root.add(sky);
  const towers = TOWERS.map((t, i) => ({ ...t, park: i === 0 }));
  buildAllTowers(root, towers, (g, t) => roofPark(g, t));
  const anchors = [];
  towers.forEach(t => anchors.push(...t.anchors));
  buildMonorail(root, anchors);
  buildSkyline(root);
  const dinos = [2, 4, 5, 7, 8, 9, 10].map(i => parkDino(root, towers[i]));
  W.stompData = { root, towers, anchors, dinos };
  if (W.water) W.water.visible = false;
  if (W.baseGroup) W.baseGroup.visible = false;
}
function buildSkyline(root) {
  const mat = M(0x8a5a78, { roughness: 0.8 });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, mat, 18); mesh.castShadow = false; mesh.receiveShadow = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, rad = 96 + (i % 3) * 8, h = 40 + (i % 5) * 10;
    p.set(Math.cos(a) * rad, 1.6 + h / 2, Math.sin(a) * rad); s.set(6 + (i % 4), h, 6 + (i % 3));
    mesh.setMatrixAt(i, m.compose(p, q, s));
  }
  root.add(mesh);
  const far = new THREE.InstancedMesh(geo, M(0x7a4a6a, { roughness: 0.9 }), 14);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + 0.2, h = 48 + (i % 4) * 12;
    p.set(Math.cos(a) * 180, 1.6 + h / 2, Math.sin(a) * 180); s.set(10, h, 8);
    far.setMatrixAt(i, m.compose(p, q, s));
  }
  far.castShadow = false; root.add(far);
}

function stripeTex(a, b, stripes) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const w = 512 / stripes;
  for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(0, i * w, 512, w + 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function roofPark(g, t) {
  const grass = stripeTex('#3ec85a', '#2f9a3c', Math.max(8, Math.round(t.r * 2 / 0.8)));
  const disc = add(g, new THREE.CircleGeometry(t.r * 0.92, 28), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.9 }), 0, t.h + 0.08, 0);
  disc.rotation.x = -Math.PI / 2;
  const path = add(g, new THREE.RingGeometry(t.r * 0.7 - 0.4, t.r * 0.7 + 0.4, 28), M(0xe8c65a), 0, t.h + 0.1, 0);
  path.rotation.x = -Math.PI / 2;
  const pad = add(g, new THREE.RingGeometry(1.35, 1.6, 24), M(0xffd23a), 0, t.h + 0.12, 0);
  pad.rotation.x = -Math.PI / 2;
  const edge = add(g, new THREE.RingGeometry(1.6, 1.78, 24), M(0x7a1420), 0, t.h + 0.11, 0);
  edge.rotation.x = -Math.PI / 2;
  const rail = M(0xf4f1e8);
  const n = Math.max(10, Math.round(2 * Math.PI * t.r * 0.92 / 1.2));
  const posts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const post = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6);
    post.translate(Math.cos(a) * t.r * 0.92, t.h + 0.5, Math.sin(a) * t.r * 0.92);
    posts.push(post);
  }
  const hoop = new THREE.TorusGeometry(t.r * 0.92, 0.035, 6, n);
  hoop.rotateX(Math.PI / 2);
  hoop.translate(0, t.h + 0.92, 0);
  posts.push(hoop);
  const railMesh = new THREE.Mesh(mergeGeometries(posts), rail);
  railMesh.castShadow = false;
  railMesh.receiveShadow = true;
  g.add(railMesh);
  prop(add(g, new THREE.BoxGeometry(1.2, 0.8, 0.8), M(0x8a9099), 2.2, t.h + 0.5, -1.4));
  prop(add(g, new THREE.BoxGeometry(1.2, 0.8, 0.8), M(0x8a9099), -1.0, t.h + 0.5, 4.8));
  for (const [x, z] of [[3.2, 2.2], [-1.2, -4.6], [0.4, -3.2]]) {
    prop(add(g, new THREE.CylinderGeometry(0.35, 0.4, 0.45, 8), M(0xe8c65a), x, t.h + 0.3, z));
    prop(add(g, new THREE.SphereGeometry(0.55, 8, 6), M(0x2f9a3c), x, t.h + 0.85, z));
  }
}

function buildStreetKit(root) {
  const lampG = new THREE.CylinderGeometry(0.08, 0.1, 4.5, 6);
  const lamp = new THREE.InstancedMesh(lampG, M(0x8a9099, { metalness: 0.3 }), 24);
  const tree = new THREE.InstancedMesh(new THREE.SphereGeometry(1.3, 8, 6), M(0x3ec85a), 16);
  const car = new THREE.InstancedMesh(new THREE.BoxGeometry(4.2, 1.4, 1.8), M(0xffd23a), 8);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    p.set(Math.cos(a) * 40, 1.5 + 2.25, Math.sin(a) * 40);
    lamp.setMatrixAt(i, m.compose(p, q, s));
  }
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + 0.2;
    p.set(Math.cos(a) * 58, 3.2, Math.sin(a) * 58);
    tree.setMatrixAt(i, m.compose(p, q, s));
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    p.set(Math.cos(a) * 28, 2.3, Math.sin(a) * 28);
    car.setMatrixAt(i, m.compose(p, q, s));
  }
  lamp.castShadow = tree.castShadow = car.castShadow = false;
  root.add(lamp, tree, car);
  root.userData.cars = { mesh: car, n: 8 };
}
function buildMonorail(root, anchors) {
  const cx = 36, cz = -8, R = 36, y = 74, n = 64;
  const rail = M(0x8aa0b4, { roughness: 0.4, metalness: 0.35 });
  const carMat = M(0xffd23a, { roughness: 0.5 });
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const x = cx + Math.cos(a0) * R, z = cz + Math.sin(a0) * R;
    const x2 = cx + Math.cos(a1) * R, z2 = cz + Math.sin(a1) * R;
    const beam = new THREE.BoxGeometry(Math.hypot(x2 - x, z2 - z) * 1.02, 0.45, 1.1);
    beam.rotateY(Math.atan2(x2 - x, z2 - z) - Math.PI / 2);
    beam.translate((x + x2) / 2, y, (z + z2) / 2);
    parts.push(beam);
    if (i % 8 === 0) {
      const post = new THREE.CylinderGeometry(0.35, 0.45, y - 1.6, 8);
      post.translate(x, y / 2, z);
      parts.push(post);
      anchors.push({ x, y: y + 0.8, z, roof: null });
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), rail);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  root.add(mesh);
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(3.2, 1.5, 1.6), carMat, 3);
  cars.castShadow = false;
  cars.receiveShadow = false;
  root.add(cars);
  root.userData.rail = { cars, cx, cz, R, y, n: 3 };
}

function parkDino(root, tower) {
  const g = new THREE.Group(); g.position.set(tower.x, tower.h + 0.4, tower.z); root.add(g);
  const steel = M(0xb8c4d2, { roughness: 0.48, metalness: 0.18 });
  const joint = M(0x3de8ff, { roughness: 0.35, emissive: 0x0f6f66, em: 0.6 });
  add(g, new THREE.BoxGeometry(2.4, 1.3, 1.2), steel, 0, 1.1, 0);
  add(g, new THREE.SphereGeometry(0.7, 12, 10), steel, 0, 1.7, 0.9);
  add(g, new THREE.SphereGeometry(0.12, 8, 6), M(0x0a141e), 0.22, 1.85, 1.35);
  add(g, new THREE.SphereGeometry(0.12, 8, 6), M(0x0a141e), -0.22, 1.85, 1.35);
  add(g, new THREE.CylinderGeometry(0.18, 0.22, 0.9, 6), joint, 0.7, 0.45, 0.35);
  add(g, new THREE.CylinderGeometry(0.18, 0.22, 0.9, 6), joint, -0.7, 0.45, 0.35);
  add(g, new THREE.BoxGeometry(0.35, 0.35, 1.3), steel, 0, 1.15, -1.1);
  g.userData.bob = Math.random() * 6;
  return g;
}

function stompDavid() {
  const d = davidModel();
  d.g.visible = true;
  d.pie.visible = true;
  const splat = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M(0xfff6dc, { roughness: 0.4 }));
  splat.scale.set(1.15, 0.72, 0.5); splat.position.set(0, 0.24, 0.22); splat.visible = false;
  d.head.add(splat);
  d.g.userData.pie = splat;
  d.g.userData.handPie = d.pie;
  d.g.userData.rig = d;
  d.g.scale.setScalar(0.8);
  const shoe = new THREE.Color(0x2e6bd8), red = new THREE.Color(0xb8322a);
  d.g.traverse(o => {
    const col = o.isMesh && o.geometry && o.geometry.attributes.color;
    if (!col) return;
    for (let i = 0; i < col.count; i++) {
      if (Math.abs(col.getX(i) - shoe.r) < 0.06 && Math.abs(col.getY(i) - shoe.g) < 0.06 && Math.abs(col.getZ(i) - shoe.b) < 0.08) col.setXYZ(i, red.r, red.g, red.b);
    }
    col.needsUpdate = true;
  });
  return d.g;
}

function yarnBall() {
  const g = new THREE.Group(); g.name = 'goo-wrap';
  const yarn = new THREE.MeshStandardMaterial({ color: 0xd8ff6a, emissive: 0x39e8ff, emissiveIntensity: 0.55, roughness: 0.55 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 12), yarn); ball.position.y = 1.05; g.add(ball);
  const tape = new THREE.MeshStandardMaterial({ color: 0x3de8ff, emissive: 0x19e4ff, emissiveIntensity: 0.8, roughness: 0.4 });
  for (const rot of [0.4, -0.6, 1.2]) {
    const strip = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.07, 6, 14), tape);
    strip.position.y = 1.05; strip.rotation.set(rot, rot * 0.4, 0.2); g.add(strip);
  }
  const eye = (x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M(0xffffff, { roughness: 0.3 }));
    e.position.set(x, 1.25, 0.78); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M(0x16120e));
    p.position.set(x, 1.24, 0.9); g.add(p);
  };
  eye(-0.2); eye(0.22);
  return g;
}

export class StompLife {
  constructor(game, world) {
    this.g = game; this.W = world; this.data = world.stompData;
    this.towers = this.data.towers; this.anchors = this.data.anchors;
    this.state = 'roof'; this.anchor = null; this.hooked = false; this.won = false;
    this.vel = new THREE.Vector3(); this.len = 12; this.combo = 0; this.comboT = 0;
    this.step = 0; this.ctrl = { swing: 0, zip: 0, wrap: 0 };
    this.sawSwing = false; this.sawFling = false; this.sawZip = false; this.wallT = 0;
    this.promptEl = document.getElementById('stomp-prompt');
    this.winEl = document.getElementById('stompwin');
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
    this.makeCable();
    this.makeChevrons();
    this.david = { mesh: stompDavid(), x: 0, y: 0, z: 0, yaw: 0, wrapped: false, u: 0, bundle: null };
    this.data.root.add(this.david.mesh);
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe9fff2, emissive: 0x19e4ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.45, roughness: 0.2 }));
    this.bubble.visible = false; this.data.root.add(this.bubble);
    this.path = [1, 2, 3, 6, 5, 4].map(i => this.towers[i]);
    this.buildCoins();
    this.reset();
  }
  makeCable() {
    const tube = (radius, mat) => {
      const tubular = 24, radial = 8, geo = new THREE.BufferGeometry();
      const count = (tubular + 1) * (radial + 1);
      const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), idx = [];
      for (let i = 0; i <= tubular; i++) for (let j = 0; j <= radial; j++) {
        const a = i * (radial + 1) + j; uv[a * 2] = j / radial; uv[a * 2 + 1] = i / tubular;
        if (i < tubular && j < radial) { const b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false; mesh.userData.tubular = tubular; mesh.userData.radial = radial; mesh.userData.radius = radius;
      return mesh;
    };
    const basic = (color, opacity, add) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity > 0.5, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false });
    // Lime shell ~30% of the forearm. Core and the cyan glow scale with it.
    const slim = 0.21;
    this.cable = tube(0.045 * slim, basic(0xe9fff2, 1, false));
    this.cableEdge = tube(0.10 * slim, basic(0xb6ff3a, 0.85, false));
    this.cableGlow = tube(0.17 * slim, basic(0x3de8ff, 0.18, true));
    const goo = new THREE.MeshStandardMaterial({ color: 0xb6ff3a, emissive: 0xb6ff3a, emissiveIntensity: 0.8, roughness: 0.35, toneMapped: false });
    this.hookMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), goo);
    this.hookMesh.scale.set(1.4, 0.35, 1.4);
    this.drips = [0, 1, 2].map(i => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), goo);
      d.position.set((i - 1) * 0.08, -0.12, 0); this.hookMesh.add(d); return d;
    });
    this.cable.visible = this.cableEdge.visible = this.cableGlow.visible = this.hookMesh.visible = false;
    this.curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
    this.sag = 0.4;
    this.data.root.add(this.cable, this.cableEdge, this.cableGlow, this.hookMesh);
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x3a0a10, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shade.rotation.x = -Math.PI / 2; this.shade.frustumCulled = false; this.data.root.add(this.shade);
  }
  tubeMesh(radius, color) {
    const tubular = 24, radial = 8, geo = new THREE.BufferGeometry();
    const count = (tubular + 1) * (radial + 1);
    const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), idx = [];
    for (let i = 0; i <= tubular; i++) for (let j = 0; j <= radial; j++) {
      const a = i * (radial + 1) + j; uv[a * 2] = j / radial; uv[a * 2 + 1] = i / tubular;
      if (i < tubular && j < radial) { const b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    mesh.frustumCulled = false; mesh.userData.tubular = tubular; mesh.userData.radial = radial; mesh.userData.radius = radius;
    return mesh;
  }
  strandPair() {
    const goo = this.tubeMesh(0.05 * 0.21, 0xc6ff4a), core = this.tubeMesh(0.02 * 0.21, 0xe9fff2);
    goo.visible = core.visible = false; this.data.root.add(goo, core); return { goo, core };
  }
  poseStrand(mesh, a, b) {
    const c = mesh.userData.curve || (mesh.userData.curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()));
    const prev = this.curve; this.curve = c;
    c.v0.set(a.x, a.y, a.z); c.v2.set(b.x, b.y, b.z); c.v1.set((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5);
    this.writeTube(mesh, 0.05); this.curve = prev;
  }
  makeChevrons() {
    this.chevrons = this.anchors.map(() => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), new THREE.MeshStandardMaterial({ color: 0x3de8ff, emissive: 0x19e4ff, emissiveIntensity: 1.2, roughness: 0.3, transparent: true }));
      c.visible = false; this.data.root.add(c); return c;
    });
  }
  reset() {
    this.state = 'roof'; this.anchor = null; this.hooked = false; this.won = false; this.step = 0;
    this.sawSwing = this.sawFling = this.sawZip = false; this.combo = 0; this.vel.set(0, 0, 0);
    this.david.wrapped = false; this.david.u = 0; if (this.david.bundle) this.david.bundle.visible = false;
    if (this.david.mesh.userData.pie) this.david.mesh.userData.pie.visible = false;
    if (this.david.mesh.userData.handPie) this.david.mesh.userData.handPie.visible = true;
    this.bubble.visible = false; this.cable.visible = this.cableEdge.visible = this.cableGlow.visible = this.hookMesh.visible = false;
    if (this.winEl) this.winEl.classList.add('hidden');
    const start = this.towers[0];
    this.lastRoof = start;
    const p = this.g.player;
    if (p) {
      p.pos.set(start.x, start.h, start.z); p.yaw = Math.atan2(this.towers[1].x - start.x, this.towers[1].z - start.z); p.speedNow = 0; p.alive = true;
      const R = p.mech && p.mech.R; if (R) { R.attachSkin(); R.setHoopster(true); }
    }
    this.camHeading = p ? p.yaw : 0; this.camY = start.h; this.routeHeading = this.camHeading;
    this.freezeDavid = false; this._davidBack = 0;
    if (this.david && this.david.mesh) this.david.mesh.visible = true;
    this.trackHeading = this.camHeading; this._inAirCam = false; this.takeoff = null;
    this._camLen = null; this.quietShake = 0; this.zipT = 0; this.coinChain = 0; this.coinChainT = 0;
    this.resetCoins();
    this.placeDavid(0);
    this.sayStep();
    this.rbQueued = 0;
    if (this.g.westies && this.g.westies.active && this.g.world && this.g.world.stomp) this.g.westies.end();
    if (this.g.cam) { this.g.cam.pitch = 0.28; this.g.cam.dist = 6.0; }
    if (this.g.snapCam !== undefined) this.g.snapCam = true;
    const toast = document.getElementById('toast'); if (toast) { toast.textContent = ''; toast.classList.remove('show'); }
    const shout = document.getElementById('shout'); if (shout) { shout.textContent = ''; shout.classList.remove('show'); }
  }
  insideTower(x, y, z) {
    for (const t of this.towers) {
      if (y < t.h + 2.2 && Math.hypot(x - t.x, z - t.z) < t.r + 0.8) return t;
    }
    return null;
  }
  moveToward(p, x, y, z, maxStep) {
    const dx = x - p.pos.x, dy = y - p.pos.y, dz = z - p.pos.z;
    const d = Math.hypot(dx, dy, dz);
    if (!(d > 1e-5)) return 0;
    const s = Math.min(d, maxStep);
    p.pos.x += dx / d * s; p.pos.y += dy / d * s; p.pos.z += dz / d * s;
    return s;
  }
  finishOutside(p, x0, y0, z0) {
    for (const t of this.towers) {
      const dx = p.pos.x - t.x, dz = p.pos.z - t.z, d = Math.hypot(dx, dz);
      if (!(p.pos.y < t.h - 0.15 && d < t.r - 0.05)) continue;
      const need = t.r + 0.08 - d;
      if (!(need > 0) || d < 0.05) continue;
      const nx = dx / d, nz = dz / d;
      const nx1 = p.pos.x + nx * need, nz1 = p.pos.z + nz * need;
      const jump = Math.hypot(nx1 - x0, p.pos.y - y0, nz1 - z0);
      if (jump < 1.98) { p.pos.x = nx1; p.pos.z = nz1; }
    }
  }
  limitStep(p, x, y, z, maxStep) {
    const dx = p.pos.x - x, dy = p.pos.y - y, dz = p.pos.z - z;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxStep && d > 0) { const s = maxStep / d; p.pos.set(x + dx * s, y + dy * s, z + dz * s); }
  }
  solidTop(t) {
    if (!t) return 0;
    if (t.kind === 'egg') return t.h * 1.08;
    if (t.kind === 'crane') return t.h + 2.8;
    if (t.kind === 'dome') return Math.max(t.h, t.h * 0.62 + t.r * 0.9);
    if (t.kind === 'neck') return Math.max(t.h, t.h * 0.98 + 0.5);
    return t.h + 0.5;
  }
  keepCameraOut(cp, look, dt) {
    if (!cp || !look || !cp.isVector3) return;
    const dir = this._camDir || (this._camDir = new THREE.Vector3());
    dir.copy(cp).sub(look);
    let len = dir.length(); if (len < 0.4 || !Number.isFinite(len)) return;
    dir.multiplyScalar(1 / len);
    let blocked = len, lift = 0;
    for (const t of this.towers) {
      const ox = look.x - t.x, oz = look.z - t.z;
      const a = dir.x * dir.x + dir.z * dir.z; if (a < 1e-6) continue;
      const b = 2 * (ox * dir.x + oz * dir.z);
      const rad = t.r + 0.8;
      const c = ox * ox + oz * oz - rad * rad;
      const disc = b * b - 4 * a * c; if (disc < 0) continue;
      const hit = (-b - Math.sqrt(disc)) / (2 * a);
      if (hit < 0.3 || hit > len) continue;
      const yHit = look.y + dir.y * hit;
      const top = this.solidTop(t);
      if (yHit > top + 0.4) continue;
      blocked = Math.min(blocked, Math.max(1.8, hit - 0.45));
    }
    const hero = this.g.player;
    if (hero && Number.isFinite(hero.pos.x)) {
      const cx = hero.pos.x, cy = hero.pos.y + 0.7, cz = hero.pos.z;
      const camx = look.x + dir.x * len, camy = look.y + dir.y * len, camz = look.z + dir.z * len;
      const vx = camx - cx, vy = camy - cy, vz = camz - cz, vlen = Math.hypot(vx, vy, vz) || 1;
      const ux = vx / vlen, uy = vy / vlen, uz = vz / vlen;
      for (const t of this.towers) {
        const ox = cx - t.x, oz = cz - t.z;
        const a2 = ux * ux + uz * uz; if (a2 < 1e-6) continue;
        const b2 = 2 * (ox * ux + oz * uz);
        const rad = t.r + 0.55;
        const c2 = ox * ox + oz * oz - rad * rad;
        const disc = b2 * b2 - 4 * a2 * c2; if (disc < 0) continue;
        const hit = (-b2 - Math.sqrt(disc)) / (2 * a2);
        if (hit < 0.15 || hit > vlen - 0.2) continue;
        const yHit = cy + uy * hit;
        if (yHit > this.solidTop(t) + 0.35) continue;
        blocked = Math.min(blocked, Math.max(1.6, hit * (len / vlen) - 0.35));
      }
    }
    const step = typeof dt === 'number' ? dt : 1 / 60;
    const dampTo = (cur, goal, lambda) => cur + (goal - cur) * (1 - Math.exp(-lambda * step));
    if (this._camLen == null || !Number.isFinite(this._camLen)) this._camLen = len;
    this._camLen = dampTo(this._camLen, blocked, blocked < this._camLen - 0.05 ? 12 : 2.5);
    this._camLift = dampTo(this._camLift || 0, lift, 6);
    const fullY = look.y + dir.y * len;
    cp.set(look.x + dir.x * this._camLen, fullY + (this._camLift || 0), look.z + dir.z * this._camLen);
    for (let n = 0; n < 4; n++) {
      let inside = false;
      for (const t of this.towers) {
        if (cp.y > this.solidTop(t) + 0.4) continue;
        const dx = cp.x - t.x, dz = cp.z - t.z, d = Math.hypot(dx, dz);
        if (d < t.r + 0.45) { inside = true; break; }
      }
      if (!inside) break;
      cp.lerp(look, 0.35);
    }
  }
  titlePose() {
    this.reset();
    const p = this.g.player; if (!p) return;
    p.yaw = Math.atan2(this.towers[1].x, this.towers[1].z);
  }
  placeDavid(u) {
    const path = this.path, n = path.length, f = ((u % n) + n) % n, i = Math.floor(f), k = f - i;
    const prev = path[(i - 1 + n) % n], a = path[i], b = path[(i + 1) % n];
    const rim = (from, toward) => {
      const dx = toward.x - from.x, dz = toward.z - from.z, gap = Math.hypot(dx, dz) || 1;
      return { x: from.x + dx / gap * from.r * 0.7, z: from.z + dz / gap * from.r * 0.7 };
    };
    const entry = rim(a, prev), exit = rim(a, b), land = rim(b, a);
    const run = Math.hypot(exit.x - entry.x, exit.z - entry.z);
    const hop = Math.hypot(land.x - exit.x, land.z - exit.z) || 1;
    const runShare = run / (run + hop);
    this.david.gap = run + hop;
    if (k < runShare) {
      const s = k / Math.max(0.001, runShare);
      this.david.x = entry.x + (exit.x - entry.x) * s;
      this.david.z = entry.z + (exit.z - entry.z) * s;
      this.david.y = a.h;
      this.david.hop = false;
      this.david.yaw = Math.atan2(exit.x - entry.x, exit.z - entry.z);
    } else {
      const s = (k - runShare) / Math.max(0.001, 1 - runShare);
      const H = 3 + 0.15 * hop;
      this.david.x = exit.x + (land.x - exit.x) * s;
      this.david.z = exit.z + (land.z - exit.z) * s;
      this.david.y = a.h + (b.h - a.h) * s + 4 * H * s * (1 - s);
      this.david.hop = true;
      this.david.yaw = Math.atan2(land.x - exit.x, land.z - exit.z);
    }
    this.david.mesh.position.set(this.david.x, this.david.y, this.david.z);
    this.david.mesh.rotation.y = this.david.yaw;
  }
  sayStep() {
    const lines = [
      'FIRST FLING — hold SWING',
      'Let go of SWING to FLING!',
      'Tap ZIP to zip up the Zip-Goo',
      'Catch Bad David — tap WRAP!',
    ];
    if (this.promptEl) this.promptEl.textContent = lines[Math.min(this.step, 3)] + (this.combo > 1 ? '   ZIP x' + this.combo : '');
  }
  roofAt(x, z, y) {
    let best = null;
    for (const t of this.towers) {
      if (Math.hypot(x - t.x, z - t.z) > t.r - 0.15) continue;
      if (y < t.h - 1.4 || y > t.h + 2.4) continue;
      if (!best || t.h > best.h) best = t;
    }
    return best;
  }
  bestAnchor(wide) {
    const p = this.g.player; if (!p) return null;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let best = null, score = 1e9;
    for (const a of this.anchors) {
      const dx = a.x - p.pos.x, dy = a.y - (p.pos.y + 1.2), dz = a.z - p.pos.z;
      const dist = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dz);
      if (a.roof && Math.hypot(p.pos.x - a.roof.x, p.pos.z - a.roof.z) < a.roof.r + 0.5 && p.pos.y > a.roof.h - 4) continue;
      if (dy < 3 || flat < 8 || dist > (wide ? 84 : 64)) continue;
      const dot = (dx * fx + dz * fz) / Math.max(0.001, flat);
      if (dot < (wide ? -0.45 : 0)) continue;
      if (dist < score) { score = dist; best = a; }
    }
    return best;
  }
  hook(a) {
    const p = this.g.player;
    const from = this.lastRoof || { x: p.pos.x, z: p.pos.z };
    this.routeHeading = Math.atan2(a.x - from.x, a.z - from.z);
    this.takeoff = { x: p.pos.x, z: p.pos.z, h: this.lastRoof ? this.lastRoof.h : p.pos.y };
    if (!this._inAirCam) { this.camHeading = this.routeHeading; this.trackHeading = this.routeHeading; this._inAirCam = true; }
    this.anchor = a; this.hooked = true; this.state = 'swing'; this.zipping = false; this.zipTarget = null; this.zipT = 0; this.hookT = this.g.world.time;
    this.len = Math.max(6, Math.hypot(a.x - p.pos.x, a.y - p.pos.y, a.z - p.pos.z));
    this.sawSwing = true; if (this.step === 0) { this.step = 1; this.sayStep(); }
    sfx.whoosh && sfx.whoosh(0.7);
  }
  fling() {
    const a = this.anchor, p = this.g.player;
    this.hooked = false; this.anchor = null; this.state = 'air'; this.zipping = false; this.zipTarget = null;
    if (a && a.roof && p) {
      const R = a.roof, y = p.pos.y;
      const apex = Math.max(y, R.h) + 2.6;
      const vy = Math.sqrt(2 * 20 * Math.max(0.05, apex - y));
      const T = vy / 20 + Math.sqrt(2 * Math.max(0, apex - R.h) / 20);
      const dx = R.x - p.pos.x, dz = R.z - p.pos.z, flat = Math.hypot(dx, dz) || 1;
      const vh = Math.min(20, flat / Math.max(0.05, T));
      this.vel.set(dx / flat * vh, vy, dz / flat * vh);
    } else this.vel.y = Math.max(this.vel.y + 2.4, 6);
    this.sawFling = true; this.combo = Math.min(12, this.combo + 1); this.comboT = 1.6;
    if (this.step === 1) { this.step = 2; }
    this.sayStep(); sfx.whoosh && sfx.whoosh(1);
  }
  drive(p, dt, dir, mag, inp) {
    if (!p || !Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y) || !Number.isFinite(p.pos.z) || !Number.isFinite(this.vel.x)) { this.recover(p); return; }
    const x0 = p.pos.x, y0 = p.pos.y, z0 = p.pos.z;
    this.driveMotion(p, dt, dir, mag, inp);
    if (Number.isFinite(p.pos.x)) this.limitStep(p, x0, y0, z0, 1.95);
    this.finishOutside(p, x0, y0, z0);
  }
  driveMotion(p, dt, dir, mag, inp) {
    if (!p || !Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y) || !Number.isFinite(p.pos.z) || !Number.isFinite(this.vel.x)) { this.recover(p); return; }
    if (this.quietShake > 0) this.quietShake -= dt;
    if (this.winOpen()) { p.speedNow = 0; return; }
    if (this.state === 'wall' && !this.wall) { this.state = 'air'; this.vel.y = Math.max(this.vel.y, 4); }
    if (!['roof', 'air', 'swing', 'wall', 'bubble'].includes(this.state)) this.recover(p);
    const hold = !!(inp && inp.btn && inp.btn.laser);
    const zip = !!(inp && inp.pressed && inp.pressed.missile);
    const wrap = !!(inp && inp.pressed && inp.pressed.melee);
    if (inp && inp.pressed && inp.pressed.laser) this.ctrl.swing++;
    if (zip) this.ctrl.zip++;
    if (wrap) this.ctrl.wrap++;
    if (wrap) this.tryWrap();
    if (zip) this.onZip();
    const wish = mag > 0.08 ? dir : this._v.set(0, 0, 0);
    if (this.state === 'bubble') {
      if (hold) {
        const a = this.bestAnchor(true);
        if (a) { if (this.bubble) this.bubble.visible = false; this.hook(a); this.stepSwing(p, dt, wish, mag); return; }
      }
      this.stepBubble(p, dt); return;
    }
    if (this.state === 'swing') {
      if (!hold && !this.zipping) { this.fling(); this.stepAir(p, dt, wish, mag); return; }
      this.stepSwing(p, dt, wish, mag); return;
    }
    if (hold) { const a = this.bestAnchor(this.state === 'air'); if (a) { this.hook(a); this.stepSwing(p, dt, wish, mag); return; } }
    if (this.state === 'wall') { this.stepWall(p, dt, wish, mag); return; }
    if (this.state === 'roof') this.stepRoof(p, dt, wish, mag);
    else this.stepAir(p, dt, wish, mag);
  }
  onZip() {
    if (this.winOpen()) return;
    if (!this.anchor) { const a = this.bestAnchor(true); if (!a) return; this.hook(a); }
    if (!this.anchor) return;
    const roof = this.anchor.roof || this.lastRoof || this.towers[0];
    if (!this.zipping || !this.zipTarget) {
      this.zipRoof = roof;
      this.zipTarget = this.safeLandingPos(roof, this.g.player && this.g.player.pos);
    }
    this.zipping = true; this.sawZip = true; if (this.step === 2) { this.step = 3; this.sayStep(); }
    sfx.whoosh && sfx.whoosh(0.85);
  }
  stepSwing(p, dt, wish, mag) {
    const a = this.anchor; if (!a) { this.state = 'air'; return; }
    if (this.zipping) {
      const roof = this.zipRoof || (a && a.roof) || this.lastRoof || this.towers[0];
      if (!this.zipTarget) this.zipTarget = this.safeLandingPos(roof, p.pos);
      const g = this.zipTarget;
      const flat = Math.hypot(g.x - p.pos.x, g.z - p.pos.z);
      const deck = roof.h;
      const wantY = flat > 1.6 ? deck + 1.25 + Math.sin(Math.min(1, flat / 10) * Math.PI) * 2.4 : g.y;
      this.moveToward(p, g.x, wantY, g.z, Math.min(1.15, 22 * dt));
      const left = Math.hypot(g.x - p.pos.x, g.y - p.pos.y, g.z - p.pos.z);
      if (Math.hypot(g.x - p.pos.x, g.z - p.pos.z) > 0.2) p.yaw = Math.atan2(g.x - p.pos.x, g.z - p.pos.z);
      if (left < 1.0) {
        this.state = 'roof'; this.vel.set(0, 0, 0); this.hooked = false; this.anchor = null; this.zipping = false; this.zipTarget = null;
        this.lastRoof = roof; p.speedNow = 0; this.quietShake = 0.45; this.zipT = 0;
        if (Number.isFinite(g.yaw)) p.yaw = g.yaw;
        return;
      }
      this.zipT += dt;
      p.speedNow = 16;
      return;
    }
    this.vel.y -= 18 * dt;
    if (mag > 0.08) { this.vel.x += wish.x * 10 * dt; this.vel.z += wish.z * 10 * dt; }
    p.pos.x += this.vel.x * dt; p.pos.y += this.vel.y * dt; p.pos.z += this.vel.z * dt;
    const deck = a.roof ? a.roof.h : p.pos.y;
    const minLen = Math.max(4.2, a.y - (deck + 1.2));
    const natural = Math.hypot(p.pos.x - a.x, p.pos.y - a.y, p.pos.z - a.z) || minLen;
    const reel = Math.max(minLen, Math.min(this.len, natural));
    this.len += (reel - this.len) * (1 - Math.exp(-3.2 * dt));
    let dx = p.pos.x - a.x, dy = p.pos.y - a.y, dz = p.pos.z - a.z;
    const dist = Math.hypot(dx, dy, dz) || 1; dx /= dist; dy /= dist; dz /= dist;
    const home = (this.takeoff && Number.isFinite(this.takeoff.h)) ? this.takeoff.h : deck;
    let tx = a.x + dx * this.len, ty = a.y + dy * this.len, tz = a.z + dz * this.len;
    const hi = home + 1.65;
    if (ty > hi) {
      ty = hi;
      const drop = Math.max(0.8, a.y - ty);
      const horiz = Math.max(0.8, Math.hypot(p.pos.x - a.x, p.pos.z - a.z));
      this.len = Math.max(this.len, Math.hypot(horiz, drop));
    }
    this.moveToward(p, tx, ty, tz, 1.45);
    const vr = this.vel.x * dx + this.vel.y * dy + this.vel.z * dz;
    if (vr > 0) { this.vel.x -= vr * dx; this.vel.y -= vr * dy; this.vel.z -= vr * dz; }
    const age = (this.g.world.time || 0) - (this.hookT || 0);
    if (age > 0.45) {
      const next = this.bestAnchor(true);
      if (next && next !== a) {
        const flat = Math.hypot(next.x - p.pos.x, next.z - p.pos.z);
        const fwd = Math.sin(p.yaw) * (next.x - p.pos.x) + Math.cos(p.yaw) * (next.z - p.pos.z);
        if (flat > 6 && flat < 16 && fwd > 0) {
          this.anchor = next; this.hookT = this.g.world.time;
          const from = a.roof || this.lastRoof || { x: p.pos.x, z: p.pos.z };
          this.routeHeading = Math.atan2(next.x - from.x, next.z - from.z);
          this.len = Math.max(4.2, Math.hypot(next.x - p.pos.x, next.y - p.pos.y, next.z - p.pos.z));
        }
      }
    }
    const sp = this.vel.length(); if (sp > 28) this.vel.multiplyScalar(28 / sp);
    if (sp > 1) p.yaw = Math.atan2(this.vel.x, this.vel.z);
    p.speedNow = Math.min(10, sp);
    this.keepOutside(p);
    this.holdDeck(p);
    const band = (this.takeoff && Number.isFinite(this.takeoff.h)) ? this.takeoff.h : (a.roof ? a.roof.h : p.pos.y);
    if (p.pos.y < band + 1.05) this.moveToward(p, p.pos.x, band + 1.2, p.pos.z, 0.5);
    else if (p.pos.y > band + 1.75) this.moveToward(p, p.pos.x, band + 1.6, p.pos.z, 0.55);
  }
  holdDeck(p) {
    for (const t of this.towers) {
      if (Math.hypot(p.pos.x - t.x, p.pos.z - t.z) >= t.r - 0.02) continue;
      if (p.pos.y < t.h - 0.08 && p.pos.y > t.h - 8) {
        p.pos.y = t.h - 0.08;
        if (this.vel.y < 0) this.vel.y = 0;
      }
    }
  }
  keepOutside(p) {
    for (const t of this.towers) {
      let dx = p.pos.x - t.x, dz = p.pos.z - t.z, d = Math.hypot(dx, dz);
      if (d < t.r + 0.15 && p.pos.y < t.h - 0.05) {
        if (d < 0.05) { const yaw = p.yaw || 0; dx = Math.sin(yaw) || 1; dz = Math.cos(yaw); d = Math.hypot(dx, dz) || 1; }
        const nx = dx / d, nz = dz / d;
        this.moveToward(p, t.x + nx * (t.r + 0.7), p.pos.y, t.z + nz * (t.r + 0.7), 1.95);
        const vn = this.vel.x * nx + this.vel.z * nz;
        if (vn < 0) { this.vel.x -= vn * nx; this.vel.z -= vn * nz; }
      }
    }
  }
  winOpen() {
    return !!(this.winEl && !this.winEl.classList.contains('hidden'));
  }
  roofBlockRadius(roof) {
    if (!roof) return 0;
    const r = roof.r, h = roof.h;
    if (roof.kind === 'egg') {
      const cy = h * 0.46, sy = h / (r * 1.65), ly = (h - cy) / sy;
      const rr = r * r - ly * ly;
      return rr > 0.25 ? Math.sqrt(rr) : r * 0.55;
    }
    if (roof.kind === 'dome') {
      const capR = r * 0.9, ly = h - h * 0.62;
      if (ly >= capR) return 0;
      return Math.sqrt(Math.max(0, capR * capR - ly * ly));
    }
    if (roof.kind === 'neck') {
      if (h * 0.9 + 0.75 < h + 0.15) return 0;
      return 1.5;
    }
    if (roof.kind === 'crane') return 0.9;
    return 0;
  }
  safeLandingPos(roof, fromPos) {
    const block = this.roofBlockRadius(roof);
    const maxR = Math.max(0.6, roof.r - 0.9);
    let rad = block > 0.15 ? Math.min(Math.max(block + 1.0, roof.r * 0.72), maxR) : 0;
    const fx = fromPos ? fromPos.x - roof.x : 0, fz = fromPos ? fromPos.z - roof.z : 0, fd = Math.hypot(fx, fz);
    let ang = fd > 0.4 ? Math.atan2(fx, fz) : 0;
    if (fd <= 0.4) {
      let next = null, nd = 1e9;
      for (const t of this.towers) {
        if (t === roof) continue;
        const d = Math.hypot(t.x - roof.x, t.z - roof.z);
        if (d < nd) { nd = d; next = t; }
      }
      if (next) ang = Math.atan2(next.x - roof.x, next.z - roof.z);
    }
    if (roof.kind === 'crane') {
      rad = Math.min(Math.max(rad, 1.4), maxR);
      const zOff = Math.abs(Math.cos(ang) * rad);
      if (zOff < 0.9) ang += Math.PI / 2;
    }
    return { x: roof.x + Math.sin(ang) * rad, y: roof.h, z: roof.z + Math.cos(ang) * rad, yaw: ang };
  }
  keepOffDome(p, roof) {
    if (!p || !roof) return;
    const block = this.roofBlockRadius(roof);
    if (block < 0.15) return;
    let dx = p.pos.x - roof.x, dz = p.pos.z - roof.z, d = Math.hypot(dx, dz);
    const min = Math.min(block + 0.85, Math.max(0.6, roof.r - 0.9));
    if (d >= min) return;
    if (d < 0.05) { dx = Math.sin(p.yaw || 0); dz = Math.cos(p.yaw || 0); d = 1; }
    p.pos.x = roof.x + dx / d * min;
    p.pos.z = roof.z + dz / d * min;
  }
  landAt(p, a) {
    const roof = (a && a.roof) || this.zipRoof || this.lastRoof || this.towers[0];
    const spot = this.safeLandingPos(roof, p.pos);
    const left = Math.hypot(spot.x - p.pos.x, spot.y - p.pos.y, spot.z - p.pos.z);
    if (left > 1.0) {
      this.zipRoof = roof; this.zipTarget = spot; this.zipping = true; this.anchor = a || this.anchor; this.state = 'swing'; this.hooked = true;
      return;
    }
    this.moveToward(p, spot.x, spot.y, spot.z, 1.0);
    if (Number.isFinite(spot.yaw)) p.yaw = spot.yaw;
    this.vel.set(0, 0, 0); this.state = 'roof'; this.hooked = false; this.anchor = null; this.zipping = false; this.zipTarget = null;
    this.lastRoof = roof; p.speedNow = 0; this.quietShake = 0.45; this.zipT = 0; sfx.boing && sfx.boing(0.6, 0.8);
  }
  stepRoof(p, dt, wish, mag) {
    const roof = this.roofAt(p.pos.x, p.pos.z, p.pos.y + 0.4) || this.lastRoof;
    const spd = 6.8 * mag;
    if (mag > 0.08) {
      const nx = p.pos.x + wish.x * spd * dt, nz = p.pos.z + wish.z * spd * dt;
      if (Math.hypot(nx - roof.x, nz - roof.z) > roof.r - 0.2) {
        this.state = 'air'; this.vel.set(wish.x * Math.max(5, spd), 3.4, wish.z * Math.max(5, spd)); p.yaw = Math.atan2(wish.x, wish.z);
      } else { p.pos.x = nx; p.pos.z = nz; p.yaw = Math.atan2(wish.x, wish.z); }
    }
    p.pos.y = roof.h; this.lastRoof = roof; p.speedNow = spd;
    this.keepOffDome(p, roof);
    const stuck = Math.hypot(p.pos.x - roof.x, p.pos.z - roof.z);
    if (stuck > roof.r - 0.05 && mag < 0.08) {
      const k = (roof.r - 0.45) / stuck;
      p.pos.x = roof.x + (p.pos.x - roof.x) * k;
      p.pos.z = roof.z + (p.pos.z - roof.z) * k;
    }
  }
  stepAir(p, dt, wish, mag) {
    this.vel.y -= 20 * dt;
    if (mag > 0.08) { this.vel.x += wish.x * 6 * dt; this.vel.z += wish.z * 6 * dt; }
    p.pos.x += this.vel.x * dt; p.pos.y += this.vel.y * dt; p.pos.z += this.vel.z * dt;
    const sp = this.vel.length(); if (sp > 26) this.vel.multiplyScalar(26 / sp);
    const wall = this.nearWall(p);
    if (wall && mag > 0.35) {
      const rx = wall.x - p.pos.x, rz = wall.z - p.pos.z, rd = Math.hypot(rx, rz) || 1;
      if ((wish.x * rx + wish.z * rz) / rd > 0.25) { this.state = 'wall'; this.wall = wall; this.wallT = 0.7; this.sawWall = true; return; }
    }
    let caught = null;
    for (const t of this.towers) {
      const d = Math.hypot(p.pos.x - t.x, p.pos.z - t.z);
      if (d < t.r + 0.85 && p.pos.y >= t.h - 0.15 && p.pos.y <= t.h + 3.4 && this.vel.y <= 0.4) caught = !caught || t.h > caught.h ? t : caught;
    }
    if (caught) {
      const gap = caught.h - p.pos.y;
      if (Math.abs(gap) > 1.2) this.moveToward(p, p.pos.x, caught.h, p.pos.z, 1.2);
      else {
        p.pos.y = caught.h; this.keepOffDome(p, caught); this.vel.set(0, 0, 0); this.state = 'roof'; this.lastRoof = caught; p.speedNow = 0; this.quietShake = 0.45; return;
      }
    }
    const roof = this.roofAt(p.pos.x, p.pos.z, p.pos.y);
    if (roof && this.vel.y <= 0 && p.pos.y <= roof.h + 0.35) {
      p.pos.y = roof.h; this.vel.set(0, 0, 0); this.state = 'roof'; this.lastRoof = roof; p.speedNow = 0; this.quietShake = 0.45; return;
    }
    this.keepOutside(p);
    const roofLine = this.lastRoof ? this.lastRoof.h : 20;
    const overDeck = this.roofAt(p.pos.x, p.pos.z, p.pos.y + 1.5);
    if (!overDeck && ((this.vel.y < -2 && p.pos.y < roofLine - 5) || p.pos.y < 8)) this.startBubble(p);
    else p.speedNow = Math.min(8, sp);
    if (this.vel.lengthSq() > 0.4) p.yaw = Math.atan2(this.vel.x, this.vel.z);
  }
  nearWall(p) {
    for (const t of this.towers) {
      const d = Math.hypot(p.pos.x - t.x, p.pos.z - t.z);
      if (d < t.r + 1.15 && d > t.r * 0.55 && p.pos.y > 3 && p.pos.y < t.h - 0.6) return t;
    }
    return null;
  }
  stepWall(p, dt, wish, mag) {
    const w = this.wall;
    if (!w) { this.state = 'air'; this.vel.y = Math.max(4, this.vel.y); return; }
    this.wallT -= dt;
    const rx = p.pos.x - w.x, rz = p.pos.z - w.z, rd = Math.hypot(rx, rz) || 1;
    let tx = -rz / rd, tz = rx / rd;
    if (mag > 0.1 && wish.x * tx + wish.z * tz < 0) { tx = -tx; tz = -tz; }
    p.pos.x = w.x + rx / rd * (w.r + 0.45) + tx * 7 * dt;
    p.pos.z = w.z + rz / rd * (w.r + 0.45) + tz * 7 * dt;
    p.pos.y += 3.2 * dt; p.yaw = Math.atan2(tx, tz); p.speedNow = 7;
    if (this.wallT <= 0) { this.state = 'air'; this.vel.set(tx * 8, 5, tz * 8); }
  }
  startBubble(p) {
    this.state = 'bubble'; this.bubbleT = 0; this.bubbleU = 0; this.hooked = false; this.anchor = null; this.zipping = false; this.zipTarget = null;
    this.bubbleFrom = p.pos.clone();
    const roof = this.lastRoof || this.towers[0];
    this.bubbleRoof = roof;
    const spot = this.safeLandingPos(roof, p.pos);
    this.bubbleTo = new THREE.Vector3(spot.x, spot.y, spot.z);
    let high = Math.max(this.bubbleFrom.y, this.bubbleTo.y);
    const ax = this.bubbleTo.x - this.bubbleFrom.x, az = this.bubbleTo.z - this.bubbleFrom.z, al2 = ax * ax + az * az || 1;
    for (const t of this.towers) {
      const u = Math.max(0, Math.min(1, ((t.x - this.bubbleFrom.x) * ax + (t.z - this.bubbleFrom.z) * az) / al2));
      const cx = this.bubbleFrom.x + ax * u, cz = this.bubbleFrom.z + az * u;
      if (Math.hypot(t.x - cx, t.z - cz) < t.r + 3) high = Math.max(high, this.solidTop(t));
    }
    const mid = (this.bubbleFrom.y + this.bubbleTo.y) * 0.5;
    this.bubbleLift = Math.max(Math.max(this.bubbleFrom.y, this.bubbleTo.y) + 8, high + 8 - mid);
    this.bubble.visible = true; sfx.boing && sfx.boing(0.8, 1.1);
    if (this.g.hud) this.g.hud.toast('Whoops! A soft puff pops you back up.');
  }
  bubblePoint(u, out) {
    const e = u * u * (3 - 2 * u);
    out.lerpVectors(this.bubbleFrom, this.bubbleTo, e);
    out.y += Math.sin(Math.PI * u) * (this.bubbleLift || 8);
    return out;
  }
  stepBubble(p, dt) {
    if (!this.bubbleFrom || !this.bubbleTo) { this.state = 'roof'; return; }
    const speed = Math.min(1.4, 20 * dt);
    let u = this.bubbleU || 0;
    const cur = this._bA || (this._bA = new THREE.Vector3());
    const nxt = this._bB || (this._bB = new THREE.Vector3());
    this.bubblePoint(u, cur);
    let lo = 0, hi = 1 - u;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) * 0.5;
      this.bubblePoint(u + mid, nxt);
      if (cur.distanceTo(nxt) > speed) hi = mid; else lo = mid;
    }
    u = Math.min(1, u + lo);
    this.bubbleU = u;
    this.bubblePoint(u, nxt);
    p.pos.copy(nxt);
    p.speedNow = 0; this.vel.set(0, 0, 0);
    this.bubble.position.copy(p.pos); this.bubble.position.y += 1;
    if (u >= 1) {
      this.state = 'roof'; this.bubble.visible = false;
      this.lastRoof = this.bubbleRoof || this.lastRoof;
      this.bubbleU = 0;
    }
  }
  tryWrap() {
    const hint = (t) => { if (this.g.hud) this.g.hud.toast(t); };
    if (this.won || this.david.wrapped) { hint(this.david.wrapped ? 'David is already wrapped!' : 'Pie returned!'); return false; }
    const p = this.g.player; if (!p) { hint('Swing closer, then tap WRAP!'); return false; }
    const REACH = 28, UP = 24;
    let best = null, bestD = REACH + 1;
    const consider = (x, y, z, kind, who) => {
      const flat = Math.hypot(x - p.pos.x, z - p.pos.z), dy = y - p.pos.y;
      if (flat > REACH || Math.abs(dy) > UP) return;
      if (flat < bestD) { bestD = flat; best = { x, y, z, kind, who }; }
    };
    consider(this.david.x, this.david.y, this.david.z, 'david');
    if (this.g.enemies) for (const e of this.g.enemies) if (e.alive && e.pos) consider(e.pos.x, e.pos.y, e.pos.z, 'enemy', e);
    if (!best) { hint('Swing closer, then tap WRAP!'); return false; }
    if (best.kind === 'enemy') {
      hint('Wrapped!');
      if (this.g.fx) this.g.fx.ring(best.who.pos, 3.2, 0xc6ff4a);
      return true;
    }
    this.david.wrapped = true; this.hooked = false; this.anchor = null; this.zipping = false;
    if (this.state === 'roof') this.vel.set(0, 0, 0);
    else { this.state = 'air'; if (this.vel.y < 3) this.vel.y = 3; }
    if (!this.david.bundle) { this.david.bundle = yarnBall(); this.david.mesh.add(this.david.bundle); }
    this.david.bundle.visible = true;
    if (this.david.mesh.userData.pie) this.david.mesh.userData.pie.visible = true;
    if (this.david.mesh.userData.handPie) this.david.mesh.userData.handPie.visible = false;
    sfx.pie && sfx.pie(1);
    if (this.g.hud) {
      this.g.hud.shout('NOOO DAVIDD!', 2.0);
      this.g.later(2.0, () => { if (this.david.wrapped) this.g.hud.shout('THATS NOT FUNNY DAVID!!', 2.4); });
      this.g.later(2.4, () => this.showWin());
    } else this.showWin();
    voice.say('Nooo, David!', { prio: 2, cd: 0, rate: 1.1, pitch: 1.05 });
    return true;
  }
  showWin() {
    this.won = true; this.step = 4;
    if (this.chevrons) this.chevrons.forEach(c => { c.visible = false; });
    if (this.winEl) this.winEl.classList.remove('hidden');
    if (this.promptEl) this.promptEl.textContent = 'Pie returned!';
    sfx.tada && sfx.tada(0.9);
  }
  keepSwinging() {
    this.won = false;
    if (this.winEl) this.winEl.classList.add('hidden');
    this.david.wrapped = false;
    if (this.david.bundle) this.david.bundle.visible = false;
    if (this.david.mesh.userData.pie) this.david.mesh.userData.pie.visible = false;
    if (this.david.mesh.userData.handPie) this.david.mesh.userData.handPie.visible = true;
    this.david.mesh.visible = false;
    this.freezeDavid = true;
    this._davidBack = 4;
  }
  bringDavidBack() {
    this._davidBack = 0;
    this.freezeDavid = false;
    this.david.wrapped = false;
    const p = this.g.player;
    let far = this.towers[0], fd = -1;
    for (const t of this.towers) {
      const d = p ? Math.hypot(t.x - p.pos.x, t.z - p.pos.z) : 0;
      if (d > fd) { fd = d; far = t; }
    }
    const spot = this.safeLandingPos(far, p && p.pos);
    this.david.x = spot.x; this.david.y = far.h; this.david.z = spot.z;
    this.david.yaw = spot.yaw;
    this.david.mesh.visible = true;
    this.david.mesh.position.set(spot.x, far.h, spot.z);
    this.david.mesh.rotation.y = spot.yaw;
    if (this.david.bundle) this.david.bundle.visible = false;
    if (this.david.mesh.userData.pie) this.david.mesh.userData.pie.visible = false;
    if (this.david.mesh.userData.handPie) this.david.mesh.userData.handPie.visible = true;
  }
  wrist(p) {
    const R = p.mech && p.mech.R; const out = this._w;
    const socket = R && R.palmSocket && R.palmSocket();
    if (socket) return socket.getWorldPosition(out);
    const bone = R && R.bone && R.bone('RightHand');
    if (bone) {
      bone.getWorldPosition(out);
      const q = this._handQ || (this._handQ = new THREE.Quaternion());
      bone.getWorldQuaternion(q);
      const palm = this._palm || (this._palm = new THREE.Vector3());
      palm.set(0, 0.07, 0.02).applyQuaternion(q);
      return out.add(palm);
    }
    if (R && R.arms && R.arms[1] && R.arms[1].hand) return R.arms[1].hand.getWorldPosition(out);
    return out.set(p.pos.x, p.pos.y + 1.3, p.pos.z);
  }
  writeTube(mesh, wobble) {
    const pos = mesh.geometry.attributes.position;
    const tubular = mesh.userData.tubular, radial = mesh.userData.radial;
    const P = this._tp || (this._tp = new THREE.Vector3());
    const T = this._tt || (this._tt = new THREE.Vector3());
    const N = this._tn || (this._tn = new THREE.Vector3());
    const B = this._tb || (this._tb = new THREE.Vector3());
    const up = this._tu || (this._tu = new THREE.Vector3());
    for (let i = 0; i <= tubular; i++) {
      const u = i / tubular;
      this.curve.getPoint(u, P);
      this.curve.getPoint(Math.min(1, u + 0.01), T);
      T.sub(P); if (T.lengthSq() < 1e-8) T.set(0, 1, 0); else T.normalize();
      up.set(Math.abs(T.y) > 0.92 ? 1 : 0, Math.abs(T.y) > 0.92 ? 0 : 1, 0);
      N.crossVectors(T, up).normalize(); B.crossVectors(T, N);
      const r = mesh.userData.radius * (1 + wobble * Math.sin(18 * u - this.g.world.time * 10));
      for (let j = 0; j <= radial; j++) {
        const ang = j / radial * Math.PI * 2, idx = i * (radial + 1) + j;
        pos.setXYZ(idx, P.x + (Math.cos(ang) * N.x + Math.sin(ang) * B.x) * r, P.y + (Math.cos(ang) * N.y + Math.sin(ang) * B.y) * r, P.z + (Math.cos(ang) * N.z + Math.sin(ang) * B.z) * r);
      }
    }
    pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
  }
  poseCable(p) {
    const on = this.hooked && this.anchor;
    this.cable.visible = this.cableEdge.visible = this.cableGlow.visible = this.hookMesh.visible = !!on;
    if (!on) return;
    const w = this.wrist(p), a = this.anchor;
    const len = Math.max(0.3, Math.hypot(a.x - w.x, a.y - w.y, a.z - w.z));
    const since = this.g.world.time - (this.hookT || 0);
    const slack = since < 0.12 || this.zipping || this.state !== 'swing';
    const want = slack ? Math.min(2, Math.max(0.3, 0.08 * len)) : 0.02 * len;
    this.sag += (want - (this.sag || 0)) * (1 - Math.exp(-12 * (this._dt || 0.016)));
    this.curve.v0.set(w.x, w.y, w.z);
    this.curve.v2.set(a.x, a.y, a.z);
    this.curve.v1.set((w.x + a.x) * 0.5, (w.y + a.y) * 0.5 - this.sag, (w.z + a.z) * 0.5);
    this.writeTube(this.cable, 0.12); this.writeTube(this.cableEdge, 0.12); this.writeTube(this.cableGlow, 0.08);
    this.hookMesh.position.set(a.x, a.y - 0.05, a.z);
  }
  markDavid(p) {
    const mark = document.getElementById('david-mark'), arrow = document.getElementById('david-arrow');
    if (!mark || !arrow) return;
    if (!p || this.won || this.david.wrapped) { mark.classList.add('hidden'); arrow.classList.add('hidden'); return; }
    const v = this._mv || (this._mv = new THREE.Vector3());
    v.set(this.david.x, this.david.y + 1.35, this.david.z).project(this.g.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth, y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const on = v.z < 1 && x > 12 && x < innerWidth - 12 && y > 12 && y < innerHeight - 12;
    mark.classList.toggle('hidden', !on); arrow.classList.toggle('hidden', on);
    if (on) {
      let top = y;
      const avoid = [];
      if (this.promptEl) { const r = this.promptEl.getBoundingClientRect(); if (r.width > 2 && r.height > 2) avoid.push(r); }
      const toast = document.getElementById('toast');
      if (toast && toast.classList.contains('show')) { const r = toast.getBoundingClientRect(); if (r.width > 2 && r.height > 2) avoid.push(r); }
      const rb = document.getElementById('b-rb');
      if (rb) { const rs = getComputedStyle(rb), r = rb.getBoundingClientRect(); if (rs.display !== 'none' && r.width > 2 && r.height > 2) avoid.push(r); }
      for (const rect of avoid) {
        const l = x - 20, rgt = x + 20, tp = top - 48, bt = top - 8;
        if (rgt > rect.left - 8 && l < rect.right + 8 && bt > rect.top - 8 && tp < rect.bottom + 8) top = rect.bottom + 8 + 48;
      }
      if (top - 48 < 60 && (x < 130 || x > innerWidth - 90)) top = 60 + 48;
      mark.style.left = x + 'px'; mark.style.top = top + 'px';
    } else {
      const cx = innerWidth * 0.5, cy = innerHeight * 0.5, ang = Math.atan2(y - cy, x - cx), pad = 86;
      arrow.style.left = Math.min(innerWidth - pad, Math.max(pad, cx + Math.cos(ang) * (cx - pad))) + 'px';
      arrow.style.top = Math.min(innerHeight - pad, Math.max(pad, cy + Math.sin(ang) * (cy - pad))) + 'px';
      arrow.style.transform = 'rotate(' + (ang * 180 / Math.PI + 90) + 'deg)';
    }
    const dim = document.getElementById('shout')?.classList.contains('show');
    mark.style.opacity = arrow.style.opacity = dim ? '0.35' : '';
  }
  placeChevrons() {
    const cam = this.g.camera;
    const html = document.getElementById('chev-html');
    if (html) html.classList.add('hidden');
    if (!cam || !this.chevrons) return;
    this.chevrons.forEach(c => { c.visible = false; });
    if (this.won) return;
    const fov = cam.fov * Math.PI / 180;
    const show = (a, dim) => {
      if (!a) return;
      const i = this.anchors.indexOf(a); const c = this.chevrons[i]; if (!c) return;
      const cd = Math.hypot(a.x - cam.position.x, a.y - cam.position.y, a.z - cam.position.z);
      if (cd < 4) return;
      const shout = document.getElementById('shout')?.classList.contains('show');
      c.visible = true; c.material.opacity = shout ? 0.35 : dim ? 0.5 : 1;
      c.rotation.x = Math.PI;
      c.scale.setScalar(Math.min(3, cd * 2 * Math.tan(fov / 2) * 24 / Math.max(1, window.innerHeight) / 0.4));
      c.position.set(a.x, a.y + 0.75, a.z);
    };
    const best = this.bestAnchor(false);
    show(best, false);
    const alt = this.bestAnchor(true);
    if (alt && alt !== best) show(alt, true);
    const vis = this.chevrons.find(c => c.visible && c.material.opacity > 0.6) || this.chevrons.find(c => c.visible);
    if (!vis || !html) return;
    const floors = [];
    if (this.promptEl) { const r = this.promptEl.getBoundingClientRect(); if (r.height > 2) floors.push(r.bottom); }
    const toast = document.getElementById('toast');
    if (toast && toast.classList.contains('show')) { const r = toast.getBoundingClientRect(); if (r.height > 2) floors.push(r.bottom); }
    const rb = document.getElementById('b-rb');
    let rbRect = null;
    if (rb && getComputedStyle(rb).display !== 'none') { const r = rb.getBoundingClientRect(); if (r.width > 2) rbRect = r; }
    const floor = floors.length ? Math.max(...floors) : 0;
    const ndc = vis.position.clone().project(cam);
    const sx = (ndc.x * 0.5 + 0.5) * window.innerWidth, sy = (-ndc.y * 0.5 + 0.5) * window.innerHeight;
    let avoidY = floor;
    if (rbRect && sx > rbRect.left - 8 && sx < rbRect.right + 8) avoidY = Math.max(avoidY, rbRect.bottom);
    if (sy < avoidY + 8) {
      vis.visible = false;
      html.classList.remove('hidden');
      html.style.left = sx + 'px';
      html.style.top = (avoidY + 8) + 'px';
      html.style.opacity = document.getElementById('shout')?.classList.contains('show') ? '0.35' : '';
    }
  }
  fadeProps(p) {
    if (!p || !this.data || !this.data.root) return;
    const cam = this.g.camera.position, chest = this._chest || (this._chest = new THREE.Vector3());
    chest.set(p.pos.x, p.pos.y + 0.7, p.pos.z);
    fadeCityProps(this.data.root, cam);
    castCityShadows(this.data.root, p.pos.x, p.pos.z);
    const ab = this._ab || (this._ab = new THREE.Vector3()), wp = this._wp || (this._wp = new THREE.Vector3());
    ab.copy(chest).sub(cam); const ab2 = ab.lengthSq() || 1;
    if (!this._fadeProps) {
      this._fadeProps = [];
      this.data.root.traverse(o => { if (o.userData && o.userData.fadeProp && o.material) this._fadeProps.push(o); });
    }
    for (const o of this._fadeProps) {
      if (o.userData.poleA && o.userData.poleB) {
        const A = o.userData.poleA, B = o.userData.poleB;
        const abx = B.x - A.x, aby = B.y - A.y, abz = B.z - A.z;
        const ab2s = abx * abx + aby * aby + abz * abz || 1;
        const u = Math.max(0, Math.min(1, ((cam.x - A.x) * abx + (cam.y - A.y) * aby + (cam.z - A.z) * abz) / ab2s));
        const d = Math.hypot(cam.x - (A.x + abx * u), cam.y - (A.y + aby * u), cam.z - (A.z + abz * u));
        if (d < 0.6) { o.visible = false; continue; }
        o.visible = true;
        o.material.opacity = d < 1.5 ? 0.2 : 1;
        o.material.depthWrite = d >= 1.5;
        continue;
      }
      o.visible = true;
      o.getWorldPosition(wp);
      const t = Math.max(0, Math.min(1, wp.clone().sub(cam).dot(ab) / ab2));
      const d = wp.distanceTo(cam.clone().addScaledVector(ab, t));
      o.material.opacity = d < 0.9 ? 0.25 : 1;
    }
  }
  placeShade(p) {
    if (!this.shade) return;
    if (!p) { this.shade.visible = false; return; }
    const roof = this.roofAt(p.pos.x, p.pos.z, p.pos.y + 1.2) || (this.lastRoof && Math.hypot(p.pos.x - this.lastRoof.x, p.pos.z - this.lastRoof.z) < this.lastRoof.r + 1.2 ? this.lastRoof : null);
    if (!roof || p.pos.y - roof.h > 12) { this.shade.visible = false; return; }
    this.shade.visible = true;
    this.shade.position.set(p.pos.x, roof.h + 0.07, p.pos.z);
  }
  recover(p) {
    this.vel.set(0, 0, 0); this.hooked = false; this.anchor = null; this.zipping = false; this.zipTarget = null; this.zipT = 0; this.wall = null;
    const roof = (p && Number.isFinite(p.pos.x) && this.roofAt(p.pos.x, p.pos.z, (p.pos.y || 0) + 2)) || this.lastRoof || this.towers[0];
    this.lastRoof = roof;
    if (!p) return;
    p.alive = true; p.speedNow = 0;
    if (!Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y) || !Number.isFinite(p.pos.z)) {
      const spot = this.safeLandingPos(roof, null);
      p.pos.set(spot.x, spot.y, spot.z); p.yaw = spot.yaw; this.state = 'roof';
      return;
    }
    if (this.state !== 'bubble') this.startBubble(p);
  }
  coinClear(x, y, z) {
    for (const t of this.towers) {
      if (y < t.h - 0.3 && Math.hypot(x - t.x, z - t.z) < t.r + 1.2) return false;
    }
    for (const a of this.anchors) if (Math.hypot(x - a.x, y - a.y, z - a.z) < 1.5) return false;
    return Number.isFinite(x + y + z);
  }
  buildCoins() {
    const spots = [];
    const push = (x, y, z) => { if (spots.length >= 60) return; if (this.coinClear(x, y, z)) spots.push({ x, y, z, baseY: y, got: false, fly: 0 }); };
    const arcs = [[0, 1], [1, 4], [4, 2], [2, 3], [3, 6]];
    for (const [ia, ib] of arcs) {
      const a = this.towers[ia], b = this.towers[ib];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
      const start = a.r + 1.4, end = len - (b.r + 1.4), span = Math.max(1.2, end - start);
      const count = Math.max(7, Math.min(9, Math.floor(span / 1.2)));
      const gap = Math.min(1.2, span / count);
      const mid = (start + end) * 0.5, total = gap * (count - 1);
      for (let i = 0; i < count; i++) {
        const along = mid - total * 0.5 + i * gap;
        const u = along / len;
        const sag = Math.sin(Math.PI * Math.max(0, Math.min(1, (along - start) / span))) * Math.min(7.5, len * 0.26);
        push(a.x + dx / len * along, a.h + (b.h - a.h) * u - sag + 1.1, a.z + dz / len * along);
      }
    }
    const line = (ia, ib, n) => {
      const a = this.towers[ia], b = this.towers[ib];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
      for (let i = 1; i <= n; i++) {
        const d = Math.min(a.r - 0.9, 1.1 + i * 1.2);
        if (d < 0.8) continue;
        push(a.x + dx / len * d, a.h + 1.35, a.z + dz / len * d);
      }
    };
    line(0, 1, 5); line(1, 4, 5); line(4, 2, 4);
    const land = (ia, ib) => {
      const a = this.towers[ia], b = this.towers[ib];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
      for (let i = 1; i <= 3; i++) {
        const d = b.r + 1.2 + i * 1.2;
        const u = 1 - d / len;
        push(b.x - dx / len * d, b.h + 1.2 + i * 0.7, b.z - dz / len * d);
        void u;
      }
    };
    land(0, 1); land(1, 4); land(4, 2);
    this.coinSpots = spots.slice(0, 60);
    const face = new THREE.CylinderGeometry(0.40, 0.40, 0.10, 20);
    const edge = new THREE.CylinderGeometry(0.45, 0.45, 0.14, 16, 1, true);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.35, metalness: 0.3, emissive: 0xffd23a, emissiveIntensity: 0.35 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x3a0a10, roughness: 0.6, metalness: 0.05 });
    this.coinFace = new THREE.InstancedMesh(face, faceMat, this.coinSpots.length);
    this.coinEdge = new THREE.InstancedMesh(edge, edgeMat, this.coinSpots.length);
    this.coinFace.frustumCulled = this.coinEdge.frustumCulled = false;
    this.coinFace.castShadow = this.coinEdge.castShadow = false;
    const star = new THREE.BufferGeometry();
    star.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.22, 0.22, 0, 0.22, 0.22, 0, 0, 0.55, 0,
      0.22, 0.22, 0, 0.22, -0.22, 0, 0.55, 0, 0,
      0.22, -0.22, 0, -0.22, -0.22, 0, 0, -0.55, 0,
      -0.22, -0.22, 0, -0.22, 0.22, 0, -0.55, 0, 0,
    ]), 3));
    this.coinSpark = new THREE.InstancedMesh(star, new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), this.coinSpots.length);
    this.coinSpark.frustumCulled = false;
    this.data.root.add(this.coinEdge, this.coinFace, this.coinSpark);
    this._coinDummy = new THREE.Object3D();
    this.coinN = this.coinSpots.length;
  }
  resetCoins() {
    if (!this.coinSpots) return;
    for (const c of this.coinSpots) {
      if (c.baseX == null) { c.baseX = c.x; c.baseZ = c.z; }
      c.got = false; c.fly = 0; c._counted = false;
      c.x = c.baseX; c.y = c.baseY; c.z = c.baseZ;
    }
  }
  updateCoins(dt) {
    if (!this.coinSpots || !this.coinFace) return;
    const p = this.g.player, t = (this.g.world && this.g.world.time) || 0;
    const dummy = this._coinDummy, m = dummy.matrix;
    if (this.coinChainT > 0) this.coinChainT -= dt;
    for (let i = 0; i < this.coinSpots.length; i++) {
      const c = this.coinSpots[i];
      if (c.got) { dummy.position.set(0, -100, 0); dummy.scale.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); this.coinFace.setMatrixAt(i, m); this.coinEdge.setMatrixAt(i, m); this.coinSpark.setMatrixAt(i, m); continue; }
      if (!c.fly && p && p.alive) {
        const d = Math.hypot(c.x - p.pos.x, c.y - (p.pos.y + 0.7), c.z - p.pos.z);
        if (d < 2.1) { c.fly = 0.0001; c.from = { x: c.x, y: c.y, z: c.z }; }
      }
      let sc = 1;
      if (c.fly) {
        c.fly += dt;
        const u = Math.min(1, c.fly / 0.15);
        const chest = p ? { x: p.pos.x, y: p.pos.y + 0.7, z: p.pos.z } : c.from;
        c.x = c.from.x + (chest.x - c.from.x) * u;
        c.y = c.from.y + (chest.y - c.from.y) * u;
        c.z = c.from.z + (chest.z - c.from.z) * u;
        sc = 1 + 0.4 * u;
        if (u >= 1 && !c._counted) {
          c._counted = true; c.got = true;
          if (this.coinChainT > 0) this.coinChain = (this.coinChain || 0) + 1; else this.coinChain = 1;
          this.coinChainT = 1.5;
          if (this.g.addBolts) this.g.addBolts(1);
          const box = document.getElementById('bolts-box'); if (box) { box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); }
          sfx.coinChime && sfx.coinChime(this.coinChain);
          if (this.g.fx && this.g.fx.sparks) this.g.fx.sparks(new THREE.Vector3(c.x, c.y, c.z), 8, { r: 1, g: 0.89, b: 0.48 }, 0.7);
          this.coinPop();
        }
      } else {
        c.y = c.baseY + Math.sin(t * Math.PI * 2 * 0.7 + i) * 0.08;
      }
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(Math.PI / 2, t * 1.2 + i, 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      this.coinFace.setMatrixAt(i, dummy.matrix);
      this.coinEdge.setMatrixAt(i, dummy.matrix);
      const flash = !c.fly && !c.got && ((t * 0.48 + i * 0.17) % 1) > 0.86;
      dummy.scale.set(flash ? 0.9 : 0, flash ? 0.9 : 0, flash ? 0.9 : 0);
      dummy.updateMatrix();
      this.coinSpark.setMatrixAt(i, dummy.matrix);
    }
    this.coinFace.instanceMatrix.needsUpdate = this.coinEdge.instanceMatrix.needsUpdate = this.coinSpark.instanceMatrix.needsUpdate = true;
  }
  coinPop() {
    const el = document.createElement('div');
    el.textContent = '+1';
    el.style.cssText = 'position:fixed;left:50%;top:42%;z-index:6;pointer-events:none;font:900 28px ui-rounded,sans-serif;color:#FFD23A;-webkit-text-stroke:3px #3A0A10;transform:translate(-50%,-50%) scale(.7);transition:transform .35s,opacity .35s;';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-80%) scale(1.15)'; el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 420);
  }
  update(dt) {
    this._dt = dt;
    this.updateCoins(dt);
    if (this.rbQueued > 0) {
      if (this.won) this.rbQueued = 0;
      else if (this.state === 'roof') {
        this.rbQueued = 0;
        const W = this.g.westies;
        if (W && !W.active && W.trigger('button', true) && this.g.onRbShow) this.g.onRbShow();
      } else { this.rbQueued -= dt; if (this.rbQueued <= 0) this.rbQueued = 0; }
    }
    const p = this.g.player;
    if (this._davidBack > 0) { this._davidBack -= dt; if (this._davidBack <= 0) this.bringDavidBack(); }
    if (!this.david.wrapped && !this.freezeDavid) {
      let dist = 99;
      if (p) dist = Math.hypot(this.david.x - p.pos.x, this.david.z - p.pos.z);
      let sp = this.step < 1 ? 0 : dist < 6 ? 6.5 : dist > 12 ? 0 : dist > 10 ? 1.3 : 3.5;
      if (sp === 0 && this.david.hop) sp = 3.5;
      this.david.u += dt * sp / Math.max(6, this.david.gap || 12);
      this.placeDavid(this.david.u);
      const t = this.g.world.time;
      const rig = this.david.mesh.userData.rig;
      const taunt = dist > 12 && !this.david.hop;
      if (taunt) this.tauntT = Math.min(0.8, (this.tauntT || 0) + dt); else this.tauntT = Math.max(0, (this.tauntT || 0) - dt);
      if (rig && rig.legs) {
        if (this.david.hop) rig.legs.forEach(leg => { leg.hip.rotation.x = -1; leg.knee.rotation.x = 1.2; });
        else rig.legs.forEach((leg, i) => { const s = Math.sin(12 * t + i * Math.PI); leg.hip.rotation.x = 0.7 * s; leg.knee.rotation.x = Math.max(0, -0.9 * s); });
        if (rig.arms) rig.arms.forEach((arm, i) => { arm.sh.rotation.x = this.tauntT > 0.05 ? -2.2 : 0.5 * Math.sin(12 * t + i * Math.PI + Math.PI); });
      }
      if (this.tauntT > 0.05 && p) this.david.mesh.rotation.y = Math.atan2(p.pos.x - this.david.x, p.pos.z - this.david.z);
      this.david.mesh.position.y = this.david.y + (this.david.hop ? 0 : Math.sin(t * 24) * 0.05);
      this.markDavid(p);
    } else this.markDavid(null);
    const rail = this.data.root.userData.rail;
    if (rail && rail.cars) {
      const dummy = this._railDummy || (this._railDummy = new THREE.Object3D());
      for (let i = 0; i < rail.n; i++) {
        const a = this.g.world.time * 0.35 + i * 2.1;
        dummy.position.set(rail.cx + Math.cos(a) * rail.R, rail.y + 1.15, rail.cz + Math.sin(a) * rail.R);
        dummy.rotation.set(0, a + Math.PI / 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        rail.cars.setMatrixAt(i, dummy.matrix);
      }
      rail.cars.instanceMatrix.needsUpdate = true;
    }
    this.data.dinos.forEach(d => {
      if (d.userData.baseY == null) d.userData.baseY = d.position.y;
      d.position.y = d.userData.baseY + Math.sin(this.g.world.time * 1.4 + d.userData.bob) * 0.12;
    });
    if (p) {
      const R = p.mech && p.mech.R;       if (R) {
        try {
        if (!R._hoopster) { R.attachSkin(); R.setHoopster(true); }
        if (R.pinSwingCull) R.pinSwingCull();
        let lean = 0;
        if (this.anchor && (this.state === 'swing' || this.state === 'wall')) {
          const ax = this.anchor.x - p.pos.x, az = this.anchor.z - p.pos.z;
          const side = this.vel.x * az - this.vel.z * ax;
          const mag = Math.hypot(ax, az) || 1;
          lean = Math.max(-0.35, Math.min(0.35, side / (mag * 18)));
        }
        const shooting = this.hooked && this.anchor;
        R.heroAct(this.state, this._dt || 0, { speed: p.speedNow, vy: this.vel.y, lean });
        if (shooting) R.aimShoot(this.anchor);
        if (R.pulseCuffs) R.pulseCuffs(!!shooting, this.g.world.time);
        } catch (err) { /* a bad clip must not freeze the swing */ }
      }
      this.poseCable(p);
      this.fadeProps(p);
      this.placeShade(p);
    } else if (this.shade) this.shade.visible = false;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0 && this.promptEl && !this.won) this.sayStep(); }
  }
}
