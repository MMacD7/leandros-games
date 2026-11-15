// v5.10.7: the five Real-garage giants use the SUPER DINO models, then these extras.
// Meshes are attached to bones so they walk, run and roar with the rig. Materials are new
// objects, so the SUPER DINOS keep the shared GLB look.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneRaptor } from './models.js';

const GROW = { spinotitan: 1.22, megatrike: 1.2, raptorpack: 1.1, brachiotank: 1.16, lavaanky: 1.14 };
const metal = new THREE.MeshStandardMaterial({ color: 0xb7c0c8, metalness: 0.86, roughness: 0.32 });
const box = new THREE.BoxGeometry(1, 1, 1);
const cone = new THREE.ConeGeometry(1, 1, 7);

function piece(parent, geo, mat, sx, sy, sz, x, y, z, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function bone(mech, ...names) {
  const b = mech.bones || {};
  for (const n of names) if (b[n]) return b[n];
  let found = null;
  if (mech.rig) mech.rig.traverse(o => { if (!found && o.isBone && names.some(n => o.name.toLowerCase().includes(n))) found = o; });
  return found || b.chest || b.hips || mech.rig;
}

export function applyRoid(mech) {
  const id = mech.def && mech.def.id;
  const f = GROW[id];
  if (!f || !mech.rig) return;
  if (id === 'spinotitan') dressSpino(mech);
  else if (id === 'megatrike') dressTrike(mech);
  else if (id === 'raptorpack') dressRaptor(mech);
  else if (id === 'brachiotank') dressBrachio(mech);
  else if (id === 'lavaanky') dressLava(mech);
  mech.rig.scale.multiplyScalar(f);
  mech.rig.position.y *= f;
  if (mech.modelScale) mech.modelScale *= f;
  if (mech.height) mech.height *= f;
  if (mech.fitR) mech.fitR *= f;
  if (mech.shadow) mech.shadow.scale.multiplyScalar(f);
  if (id === 'raptorpack') addPack(mech);
}

function localOn(boneNode, skin, index) {
  if (!boneNode || !skin || index == null) return new THREE.Vector3();
  if (skin.skeleton) skin.skeleton.update();
  boneNode.updateWorldMatrix(true, false);
  skin.updateWorldMatrix(true, false);
  const inv = new THREE.Matrix4().copy(boneNode.matrixWorld).invert();
  const v = new THREE.Vector3();
  skin.getVertexPosition(index, v);
  return v.applyMatrix4(skin.matrixWorld).applyMatrix4(inv);
}
function dressSpino(mech) {
  const chest = bone(mech, 'chest'), hips = bone(mech, 'hips');
  const sail = new THREE.MeshStandardMaterial({ color: 0x0e6a88, emissive: 0x3ae8ff, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  mech.sailMat = sail;
  const tip = localOn(chest, mech.skin, mech._sailTip);
  const tall = Math.min(Math.abs(tip.y), 0.9);
  const y0 = tall * 0.35;
  for (let i = 0; i < 4; i++) {
    const u = i / 3;
    piece(chest, box, sail, 0.055 + u * 0.02, tall * 0.16, 0.05, tip.x, y0 + u * tall * 0.45, tip.z * (0.4 + u * 0.4));
  }
  piece(chest, box, metal, 0.08, 0.03, 0.1, 0.1, 0.05, 0.02);
  piece(chest, box, metal, 0.08, 0.03, 0.1, -0.1, 0.05, 0.02);
  piece(hips, box, metal, 0.09, 0.028, 0.09, 0.08, 0.04, 0);
  piece(hips, box, metal, 0.09, 0.028, 0.09, -0.08, 0.04, 0);
}

function dressTrike(mech) {
  const head = bone(mech, 'head');
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6a18, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
  const flames = [];
  // Jaw mouth sits at +z, so the face points that way. Caps and boosters stay on the skull.
  const horn = (x, y, z, len) => {
    const cap = piece(head, cone, metal, 0.055, len, 0.055, x, y, z + len * 0.45);
    cap.rotation.x = -Math.PI / 2;
    const booster = piece(head, cone, metal, 0.04, 0.08, 0.04, x, y, z - 0.04);
    booster.rotation.x = Math.PI / 2;
    const flame = piece(head, cone, flameMat, 0.05, 0.14, 0.05, x, y, z - 0.12);
    flame.rotation.x = Math.PI / 2;
    flame.castShadow = false;
    flame.visible = false;
    flames.push(flame);
  };
  horn(0, 0.1, 0.16, 0.22);
  horn(-0.11, 0.05, 0.1, 0.16);
  horn(0.11, 0.05, 0.1, 0.16);
  mech.flames = flames;
}

function dressRaptor(mech) {
  mech.rig.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = [].concat(o.material);
    for (const m of mats) {
      if (m.color) m.color.multiply(new THREE.Color(0.62, 0.46, 1));
      if (m.emissive) { m.emissive.set(0x4a1868); m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 0.32); }
    }
  });
  const chest = bone(mech, 'chest');
  const stripe = new THREE.MeshStandardMaterial({ color: 0xf4e2a4, emissive: 0xffd56a, emissiveIntensity: 0.4, roughness: 0.45, metalness: 0.08 });
  piece(chest, box, stripe, 0.09, 0.016, 0.03, 0, 0.05, 0.07, [0.15, 0, 0.55]);
  piece(chest, box, stripe, 0.08, 0.016, 0.03, 0, 0.01, 0.05, [-0.1, 0, -0.6]);
  mech.alpha = true;
}

function addPack(mech) {
  const want = mech.height / GROW.raptorpack * 0.62;
  mech.pack = [0, 1].map(i => {
    const { scene, animations } = cloneRaptor();
    const obj = new THREE.Group();
    obj.name = 'pack-raptor';
    const h = Math.max(0.001, new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).y);
    scene.scale.setScalar(want / h);
    const planted = new THREE.Box3().setFromObject(scene);
    scene.position.y -= planted.min.y;
    obj.add(scene);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = true; } });
    const mixer = new THREE.AnimationMixer(scene);
    const actions = {};
    for (const clip of animations) {
      const act = mixer.clipAction(clip);
      act.play();
      act.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0);
      actions[clip.name] = act;
    }
    const side = i === 0 ? -1 : 1;
    obj.position.set(side * 1.85, 0, -2.4 - i * 0.2);
    mech.obj.add(obj);
    return { obj, mixer, actions, clip: 'Idle' };
  });
}

export function stepPack(mech, dt, speed, o = {}) {
  if (!mech.pack) return;
  const pounce = o.pounce || 0, lunging = pounce > 0.12;
  const name = lunging ? 'Pounce' : speed > 8 ? 'Run' : speed > 0.4 ? 'Walk' : 'Idle';
  mech.pack.forEach((m, i) => {
    m.obj.visible = mech.obj.visible !== false;
    const side = i === 0 ? -1 : 1;
    const tx = side * (lunging ? 1.1 : 1.85);
    const tz = lunging ? -0.3 : -2.4 - i * 0.2;
    const ty = lunging ? Math.sin(Math.min(1, pounce) * Math.PI) * 0.9 : 0;
    const k = Math.min(1, dt * (lunging ? 9 : 5));
    m.obj.position.x += (tx - m.obj.position.x) * k;
    m.obj.position.z += (tz - m.obj.position.z) * k;
    m.obj.position.y += (ty - m.obj.position.y) * k;
    if (m.clip !== name && m.actions[name]) {
      m.clip = name;
      const next = m.actions[name];
      next.reset();
      next.loop = name === 'Pounce' ? THREE.LoopOnce : THREE.LoopRepeat;
      next.clampWhenFinished = name === 'Pounce';
      next.play();
    }
    for (const [n, act] of Object.entries(m.actions)) act.setEffectiveWeight(n === m.clip ? 1 : 0);
    m.mixer.update(speed > 0.4 || lunging ? dt : dt * 0.35);
  });
}

function dressBrachio(mech) {
  const hips = bone(mech, 'hips');
  piece(hips, box, metal, 0.16, 0.04, 0.12, 0.12, 0.16, 0.02);
  piece(hips, box, metal, 0.16, 0.04, 0.12, -0.12, 0.16, 0.02);
  piece(hips, box, metal, 0.22, 0.035, 0.14, 0, 0.2, -0.02);
  const gun = new THREE.Group();
  gun.name = 'mega-cannon';
  gun.position.set(0, 0.28, 0.02);
  hips.add(gun);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.85, 8), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.22;
  barrel.castShadow = true;
  gun.add(barrel);
  piece(gun, box, metal, 0.16, 0.11, 0.18, 0, 0, 0.02);
  const muzzle = new THREE.Group();
  muzzle.name = 'cannon';
  muzzle.position.set(0, 0, 0.58);
  gun.add(muzzle);
  mech.sockets = mech.sockets || {};
  mech.sockets.cannon = muzzle;
  mech.cannonBarrel = barrel;
  mech.cannonKick = 0;
}

function dressLava(mech) {
  mech.lava = true;
  mech.rig.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = [].concat(o.material);
    for (const m of mats) {
      if (m.color) m.color.set(0xffffff);
      if (m.emissive) { m.emissive.set(0x000000); m.emissiveIntensity = 0; }
      // Orange patches in the hide become magma cracks. The rest is dark rock.
      m.customProgramCacheKey = () => 'lavaanky-rock';
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          float warm = smoothstep(0.04, 0.22, diffuseColor.r - diffuseColor.b);
          float luma = dot(diffuseColor.rgb, vec3(0.30, 0.59, 0.11));
          vec3 rock = vec3(0.34, 0.25, 0.18);
          vec3 magma = vec3(1.15, 0.38, 0.05);
          float crack = smoothstep(0.42, 0.82, luma) * warm;
          diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.4, 0.32, 0.26), rock, warm);
          diffuseColor.rgb = mix(diffuseColor.rgb, magma, crack);
          diffuseColor.rgb += magma * crack * 0.55;`);
      };
      m.needsUpdate = true;
    }
  });
  const magma = new THREE.MeshStandardMaterial({ color: 0x2a1008, emissive: 0xff5a12, emissiveIntensity: 1.45, roughness: 0.45, metalness: 0.05 });
  mech.lavaGlow = magma;
  const rock = new THREE.MeshStandardMaterial({ color: 0x2c241c, roughness: 0.9, metalness: 0.08 });
  const spine = bone(mech, 'spine', 'chest');
  for (let i = 0; i < 4; i++) piece(spine, box, rock, 0.09, 0.02, 0.07, (i % 2 ? 0.06 : -0.06), 0.08, -0.02 + i * 0.04);
  for (let i = 0; i < 5; i++) piece(spine, box, magma, 0.012, 0.008, 0.1, (i - 2) * 0.025, 0.095, 0.01 * i, [0.15, 0.2, 0.5]);
  let tip = null, best = -1;
  mech.rig.traverse(o => { if (o.isBone && /tail/i.test(o.name) && o.name.length > best) { tip = o; best = o.name.length; } });
  const mount = tip || bone(mech, 'hips');
  const club = piece(mount, new THREE.SphereGeometry(0.09, 10, 8), magma, 1, 1, 1, 0, 0.03, 0.12);
  piece(mount, new THREE.CylinderGeometry(0.025, 0.034, 0.14, 6), magma, 1, 1, 1, 0, 0.02, 0.03);
  mech.club = club;
}
