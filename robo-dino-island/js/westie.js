// v5.10.3 Ricky and Bobby. One Meshy Westie mesh for both dogs.
// The quadruped rig (Idle, Trot, Run, Sit, Wag, Bark, Poop) lives on the bones.
// westies.js drives those bones for the trot, the run, the sit, the tail wag, the bark hop, and the POOP squat.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneWestie } from './models.js';

function nameTag(label) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.roundRect(8, 8, 240, 48, 16); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 128, 32);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.26, 0.065, 1); sp.visible = false; sp.name = 'name-tag'; sp.center.set(0.5, 0);
  return sp;
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
  const sc = 0.36 / span; // about 28 cm at the shoulder, times 1.3 so they read on a phone
  scene.scale.setScalar(sc); scene.position.y = -foot * sc;
  skin.material = Array.isArray(skin.material) ? skin.material.map(m => m.clone()) : skin.material.clone();
  const who = name === 'bobby' ? 'Bobby' : 'Ricky';
  const collarColor = name === 'bobby' ? 0xf7f7f7 : 0x2fce4a;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.012, 8, 22), new THREE.MeshStandardMaterial({ color: collarColor, roughness: 0.25, emissive: collarColor, emissiveIntensity: name === 'bobby' ? 0.25 : 0.7 }));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.02, 8, 22), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }));
  collar.rotation.x = band.rotation.x = 1.15; collar.position.set(0, 0.3, 0.12); band.position.copy(collar.position);
  body.add(band); body.add(collar);
  const tag = nameTag(who); tag.position.set(0, 0.56, 0); tag.userData.label = who; root.add(tag);
  const white = skin.material;
  const acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, emissive: accent, emissiveIntensity: 0.12 });
  const capeG = new THREE.PlaneGeometry(0.22, 0.28, 2, 3); capeG.translate(0, -0.14, 0);
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
  const tank = add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xffc81a, roughness: 0.35, metalness: 0.4 })));
  tank.position.set(0, 0.16, -0.06);
  for (const l of legs) { const fin = add(l, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.1), finM)); fin.position.set(0, -0.12, 0.04); }
  for (const m of scuba) m.visible = false;
  skin.userData.westieSkin = true;
  return { root, body, head, jaw, tail, legs, cape, collar, torso: skin, scuba, scubaOn: false, tag, mul: name === 'bobby' ? 0.92 : 1, white, acc };
}

