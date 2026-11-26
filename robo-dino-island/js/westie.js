// v5.10.4 Ricky and Bobby. One Meshy Westie mesh for both dogs, at 60% of the v5.10.3 size.
// The quadruped rig (Idle, Trot, Run, Sit, Wag, Bark, Poop) lives on the bones.
// westies.js drives those bones for the trot, the run, the sit, the tail wag, the bark hop, and the POOP squat.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneWestie } from './models.js';

// '#2FB8A8' recolours Bobby's cape, fins, collar and tag on Stompolis only. null would leave his usual blue.
export const STOMP_BOBBY_ACCENT = '#2FB8A8';

function paintTag(tag, label, color) {
  const canvas = tag.material.map.image;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = color; g.beginPath(); g.roundRect(12, 16, 488, 96, 28); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#fff4e0'; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 64px ui-rounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 256, 64);
  tag.material.map.needsUpdate = true;
  tag.userData.label = label; tag.userData.color = color;
}

function nameTag(label, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.42, 0.105, 1); sp.visible = false; sp.name = 'name-tag'; sp.center.set(0.5, 0);
  paintTag(sp, label, color);
  return sp;
}

export function setAccent(w, hex) {
  const color = new THREE.Color(hex);
  const paint = (mat) => { if (!mat) return; mat.color.copy(color); if (mat.emissive) mat.emissive.copy(color); };
  paint(w.acc);
  paint(w.finM);
  if (w.cape) paint(w.cape.material);
  if (w.collar) paint(w.collar.material);
  if (w.disc && w.disc.material) w.disc.material.color.set(color.getHex() === 0x2a6ad8 ? 0xd8e8ff : 0xf4f1e8);
  if (w.tag) paintTag(w.tag, w.tag.userData.label || '', '#' + color.getHexString().toUpperCase());
}

export function buildWestie(name, accent) {
  const { scene } = cloneWestie();
  const root = new THREE.Group(); root.name = 'westie-' + name;
  const body = new THREE.Group(); root.add(body); body.add(scene);
  const bones = {}; let skin = null;
  scene.traverse(o => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) { skin = o; o.castShadow = true; o.frustumCulled = false; o.raycast = () => {}; } });
  scene.updateMatrixWorld(true);
  const attr = skin.geometry.attributes.position, v = new THREE.Vector3();
  let foot = Infinity, back = -Infinity;
  for (let i = 0; i < attr.count; i += 8) {
    skin.getVertexPosition(i, v);
    if (v.y < foot) foot = v.y;
    if (Math.abs(v.x) < 0.16 && v.z > -0.15 && v.z < 0.2 && v.y > back) back = v.y;
  }
  let span = back - foot;
  if (!(span > 0.4 && span < 2.2)) span = 0.87; // measured shoulder-to-paw on the Meshy mesh
  const sc = (0.36 * 0.6) / span; // v5.10.4: 60% of the previous shoulder height
  scene.scale.setScalar(sc); scene.position.y = -foot * sc;
  skin.material = Array.isArray(skin.material) ? skin.material.map(m => m.clone()) : skin.material.clone();
  const who = name === 'bobby' ? 'Bobby' : 'Ricky';
  const collarColor = name === 'bobby' ? 0x2a6ad8 : 0xd82a2a;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.008, 8, 22), new THREE.MeshStandardMaterial({ color: collarColor, roughness: 0.4, emissive: collarColor, emissiveIntensity: 0.15 }));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 8, 22), new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.55 }));
  const disc = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshStandardMaterial({ color: name === 'bobby' ? 0xd8e8ff : 0xffd23a, metalness: 0.45, roughness: 0.4 }));
  collar.rotation.x = band.rotation.x = 1.15; collar.position.set(0, 0.12, 0.048); band.position.copy(collar.position); disc.position.set(0, 0.072, 0.084);
  body.add(band); body.add(collar); body.add(disc);
  const tag = nameTag(who, name === 'bobby' ? '#2A6AD8' : '#D82A2A'); tag.position.set(0, 0.42, 0); tag.userData.label = who; root.add(tag);
  const white = skin.material;
  const acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, emissive: accent, emissiveIntensity: 0.12 });
  const capeG = new THREE.PlaneGeometry(0.33, 0.42, 2, 3); capeG.translate(0, -0.2, 0);
  const cape = new THREE.Mesh(capeG, new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55, side: THREE.DoubleSide, emissive: accent, emissiveIntensity: 0.08 }));
  cape.position.set(0, 0.12, -0.02); cape.rotation.x = 1.1; (bones.chest || body).add(cape);
  const head = bones.head, jaw = bones.jaw, tail = bones.tail1;
  const legs = [bones.l_arm, bones.r_arm, bones.l_thigh, bones.r_thigh];
  const scuba = [];
  const rubber = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ae8ff, roughness: 0.05, transparent: true, opacity: 0.45 });
  const finM = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, emissive: accent, emissiveIntensity: 0.15 });
  const add = (parent, mesh) => { parent.add(mesh); scuba.push(mesh); return mesh; };
  const frame = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), rubber)); frame.position.set(0, 0.02, 0.08);
  const lens = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.015), glass)); lens.position.set(0, 0.02, 0.09);
  const tank = add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.04 * 0.6, 0.04 * 0.6, 0.16 * 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xffc81a, roughness: 0.35, metalness: 0.4 })));
  tank.position.set(0, 0.16 * 0.6, -0.06 * 0.6);
  for (const l of legs) { const fin = add(l, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.1), finM)); fin.position.set(0, -0.12, 0.04); }
  for (const m of scuba) m.visible = false;
  skin.userData.westieSkin = true;
  return { root, body, head, jaw, tail, legs, cape, collar, band, disc, finM, torso: skin, scuba, scubaOn: false, tag, mul: name === 'bobby' ? 0.92 : 1, white, acc };
}

