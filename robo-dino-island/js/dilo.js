// v5.10.0 Dilophosaurus. Meshy model from the approved concept, rigged in this game.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneDilo } from './models.js';

const RIM = (shader) => {
  shader.uniforms.uFlash = { value: 0 };
  // Keep the green hide, the yellow belly, and the red crests. A roar or blast flashes the red.
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
    #include <color_fragment>
    float luma = dot(diffuseColor.rgb, vec3(0.30, 0.59, 0.11));
    float crest = smoothstep(0.08, 0.28, diffuseColor.r - max(diffuseColor.g, diffuseColor.b));
    vec3 rich = diffuseColor.rgb * vec3(0.92, 1.04, 0.90);
    float keep = max(crest, smoothstep(0.45, 0.78, luma));
    diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.78, 0.84, 0.74), rich, keep);
    diffuseColor.rgb += vec3(1.45, 0.22, 0.04) * uFlash * crest;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
    float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
    outgoingLight += vec3(0.35, 0.85, 0.25) * rim * 0.08;
    outgoingLight += vec3(1.5, 0.28, 0.05) * uFlash * rim * 0.4;
    #include <output_fragment>`);
  shader.fragmentShader = 'uniform float uFlash;\n' + shader.fragmentShader;
  return shader.uniforms.uFlash;
};

export class DiloMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = false; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.jaw = 0;
    this.skinned = true; this._clip = 'Idle';
    const obj = this.obj = new THREE.Group(); obj.name = 'dilo-3d';
    const { scene, animations } = cloneDilo();
    const rig = this.rig = new THREE.Group(); obj.add(rig); rig.add(scene);
    const bones = {};
    const meshes = [];
    const flash = { value: 0 };
    this.flashU = flash;
    scene.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.raycast = () => {};
        meshes.push(o);
        const mats = [].concat(o.material);
        for (const m of mats) {
          if (!m) continue;
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          m.roughness = 0.55; m.metalness = 0.0; m.envMapIntensity = 0.4;
          m.emissive = new THREE.Color(0x143010); m.emissiveIntensity = 0.04;
          m.onBeforeCompile = (shader) => { const u = RIM(shader); if (u) u.value = flash.value; shader.uniforms.uFlash = flash; };
        }
      }
    });
    this.bones = bones; this.meshes = meshes; this.skin = meshes[0];
    const attr0 = this.skin.geometry.attributes.position;
    const backIds = [];
    let footY = Infinity, crestTip = 0, hipId = 0, hipBest = Infinity, hipY = 0, frillId = 0, frillX = 0;
    const box0 = new THREE.Box3();
    const tmp = new THREE.Vector3();
    for (let i = 0; i < attr0.count; i++) {
      const x = attr0.getX(i), y = attr0.getY(i), z = attr0.getZ(i);
      box0.expandByPoint(tmp.set(x, y, z));
      if (y < footY) footY = y;
      if (y > attr0.getY(crestTip)) crestTip = i;
      if (Math.abs(x) > frillX && y > 0.2 && z > 0.55 && z < 0.8) { frillX = Math.abs(x); frillId = i; }
      const hd = x * x + (y - 0.11) * (y - 0.11) + (z + 0.02) * (z + 0.02);
      if (Math.abs(x) < 0.08 && hd < hipBest) { hipBest = hd; hipId = i; hipY = y; }
      // Back behind the frill. The fan starts near z 0.55, so the seat stays further back.
      if (z > 0.14 && z < 0.40 && y > 0.06 && y < 0.20 && Math.abs(x) < 0.08) backIds.push(i);
    }
    this._backIds = backIds;
    this._crestTip = crestTip;
    this._hipId = hipId;
    this._frillId = frillId;
    this.b = { pelvis: bones.hips, chest: bones.chest, neck: bones.neck, head: bones.head, jaw: bones.jaw };
    const size = box0.getSize(new THREE.Vector3());
    const crestSpan = Math.max(0.2, attr0.getY(crestTip) - footY);
    // About 3.2 m at the crest tips. Hips land near 2.2 m. Length is stretched to about 7 m.
    const sy = 3.55 / crestSpan;
    const sz = 7.40 / Math.max(size.z, 0.001);
    const sx = sy;
    rig.scale.set(sx, sy, sz);
    const box = new THREE.Box3().setFromObject(rig);
    rig.position.y -= box.min.y;
    this.modelScale = sy;
    this.scale3 = { x: sx, y: sy, z: sz };

    this.mouth = new THREE.Group(); this.mouth.name = 'dilo-mouth';
    this.mouth.position.set(0, -0.02, 0.08); (bones.jaw || bones.head).add(this.mouth);
    this.seat = new THREE.Group(); this.seat.name = 'dilo-seat';
    (bones.spine || bones.chest).add(this.seat);
    this.seatOnBack();
    this.body = new THREE.Group(); this.body.name = 'dilo-body'; (bones.chest || bones.spine).add(this.body);
    this.legs = [bones.l_foot, bones.r_foot].map(g => ({ g: g || new THREE.Group() }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; obj.add(shadow); this.shadow = shadow;

    this.mixer = new THREE.AnimationMixer(scene);
    this.actions = {};
    for (const clip of animations) {
      const act = this.mixer.clipAction(clip);
      act.play();
      act.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0);
      this.actions[clip.name] = act;
    }
    const mat = meshes[0] && meshes[0].material;
    this.mats = { plate: mat, glowColor: new THREE.Color(0xff4020) };
    this.height = size.y * sy;
    this.fitR = Math.max(size.x * sx, size.z * sz) * 0.42;
    this.sockets = { mouth: this.mouth };
  }
  groundNormal(x, z, yaw, heightAt, out) {
    const fX = Math.sin(yaw), fZ = Math.cos(yaw), sX = fZ, sZ = -fX, d = 1.8;
    const dz = (heightAt(x + fX * d, z + fZ * d) - heightAt(x - fX * d, z - fZ * d)) / (2 * d);
    const dx = (heightAt(x + sX * d, z + sZ * d) - heightAt(x - sX * d, z - sZ * d)) / (2 * d);
    return out.set(-dx * sX - dz * fX, 1, -dx * sZ - dz * fZ).normalize();
  }
  seatOnGround(heightAt) {
    const sk = this.skin;
    if (!sk || !heightAt) return 0;
    this.obj.updateMatrixWorld(true);
    const attr = sk.geometry.attributes.position;
    const v = this._seatV || (this._seatV = new THREE.Vector3());
    let lift = -Infinity;
    for (let i = 0; i < attr.count; i += 4) {
      sk.getVertexPosition(i, v);
      v.applyMatrix4(sk.matrixWorld);
      const pen = heightAt(v.x, v.z) - v.y;
      if (pen > lift) lift = pen;
    }
    if (lift > -Infinity) this.obj.position.y += lift;
    return lift;
  }
  backHide(out = new THREE.Vector3()) {
    const sk = this.skin, ids = this._backIds, spine = this.bones.spine || this.bones.chest;
    if (!sk || !ids || !ids.length) return null;
    this.obj.updateMatrixWorld(true);
    const v = this._hideV || (this._hideV = new THREE.Vector3());
    const local = this._hideL || (this._hideL = new THREE.Vector3());
    let best = -Infinity;
    for (let k = 0; k < ids.length; k++) {
      sk.getVertexPosition(ids[k], v);
      v.applyMatrix4(sk.matrixWorld);
      if (!spine) continue;
      local.copy(v);
      spine.worldToLocal(local);
      if (Math.abs(local.x) > 0.08) continue;
      if (local.y > best) { best = local.y; out.copy(v); }
    }
    if (best === -Infinity) return null;
    return out;
  }
  crestTop(out = new THREE.Vector3()) {
    const sk = this.skin;
    if (!sk) return null;
    this.obj.updateMatrixWorld(true);
    sk.getVertexPosition(this._crestTip || 0, out);
    return out.applyMatrix4(sk.matrixWorld);
  }
  hipPoint(out = new THREE.Vector3()) {
    const sk = this.skin;
    if (!sk) return null;
    this.obj.updateMatrixWorld(true);
    sk.getVertexPosition(this._hipId || 0, out);
    return out.applyMatrix4(sk.matrixWorld);
  }
  frillEdge(out = new THREE.Vector3()) {
    const sk = this.skin;
    if (!sk) return null;
    this.obj.updateMatrixWorld(true);
    sk.getVertexPosition(this._frillId || 0, out);
    return out.applyMatrix4(sk.matrixWorld);
  }
  seatOnBack() {
    const spine = this.bones.spine || this.bones.chest;
    const hit = this.backHide(this._backHit || (this._backHit = new THREE.Vector3()));
    if (!spine || !hit) { if (this.seat) this.seat.position.set(0, 0.12, -0.04); return; }
    const local = spine.worldToLocal(hit.clone());
    local.y += 0.01;
    this.seat.position.copy(local);
  }
  socketPos(name, out) { const s = (name && this.sockets[name]) || this.mouth; return s.getWorldPosition(out); }
  footPos(i, out) { return this.legs[i % this.legs.length].g.getWorldPosition(out); }
  dispose() { this.mixer.stopAllAction(); }
  play(name, loop, scale) {
    const next = this.actions[name]; if (!next) return;
    const fresh = this._clip !== name;
    if (fresh) {
      next.reset();
      next.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
      next.clampWhenFinished = !loop;
      next.play();
      this._clip = name;
    }
    next.timeScale = scale;
    for (const [n, act] of Object.entries(this.actions)) {
      const target = n === name ? 1 : 0;
      act.setEffectiveWeight(fresh || !loop ? target : act.getEffectiveWeight() * 0.62 + target * 0.38);
    }
    return next;
  }
  cycleDist(name) {
    const leg = 0.48 * this.modelScale;
    const amp = name === 'Run' ? 39 : 23;
    return 4 * leg * Math.sin(amp * Math.PI / 180);
  }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const roar = Math.max(o.roar || 0, this.roar || 0);
    const blast = (o.frill || 0) > 0.5 || (o.charge || 0) > 0.12 ? 1 : 0;
    const bite = Math.max(o.bite || 0, (o.jaw || 0) > 0.45 && roar < 0.15 && !blast ? o.jaw : 0);
    let name = 'Idle', loop = true, scale = 1;
    if (this.ko > 0.2) { name = 'Idle'; loop = true; }
    else if (blast) { name = 'Blast'; loop = false; }
    else if (roar > 0.25) { name = 'Roar'; loop = false; }
    else if (speed > 8) { name = 'Run'; scale = Math.max(0.55, speed / this.cycleDist('Run') * 0.55); }
    else if (speed > 0.45) { name = 'Walk'; scale = Math.max(0.45, speed / this.cycleDist('Walk') * 0.9); }
    const act = this.play(name, loop, scale);
    this.mixer.update(dt);
    if (name !== 'Blast' && name !== 'Roar' && bite > 0.25 && this.bones.jaw) this.bones.jaw.rotation.x = Math.min(0.35, bite * 0.35);
    if (act && act.getClip()) this.phase = (act.time / act.getClip().duration) * Math.PI * 2;
    this.jaw = Math.max(0, (this.jaw || 0) - dt * 1.6);
    this.roar = Math.max(0, (this.roar || 0) - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    const lit = Math.max(roar, blast, this.flash * 0.5);
    if (this.flashU) this.flashU.value = lit;
    const plate = this.mats.plate;
    if (plate && plate.emissive) plate.emissive.setRGB(0.15 + lit * 0.7, 0.08 + lit * 0.05, 0.02);
    this.seatOnBack();
  }
}
