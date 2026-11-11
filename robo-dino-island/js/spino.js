// v5.9.0 Spinosaurus. Meshy model from the approved concept, rigged in this game.
import * as THREE from './vendor/three.bundle.min.js';
import { cloneSpino } from './models.js';

const RIM = (shader) => {
  shader.uniforms.uSplash = { value: 0 };
  // Deepen the ocean blue. Leave the orange sail and the cream belly bright.
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
    #include <color_fragment>
    float luma = dot(diffuseColor.rgb, vec3(0.30, 0.59, 0.11));
    float warm = smoothstep(0.04, 0.22, diffuseColor.r - diffuseColor.b);
    vec3 deep = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.18)) * vec3(0.70, 0.90, 0.98);
    float keep = max(smoothstep(0.38, 0.74, luma), warm);
    diffuseColor.rgb = mix(deep, diffuseColor.rgb * vec3(1.04, 0.98, 0.92), keep);
    diffuseColor.rgb += vec3(1.15, 0.42, 0.05) * uSplash * warm;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
    float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
    outgoingLight += vec3(0.15, 0.45, 0.85) * rim * 0.14;
    outgoingLight += vec3(1.2, 0.45, 0.08) * uSplash * rim * 0.35;
    #include <output_fragment>`);
  shader.fragmentShader = 'uniform float uSplash;\n' + shader.fragmentShader;
  return shader.uniforms.uSplash;
};

export class SpinoMech {
  constructor(def) {
    this.def = def; this.wild = false; this.real = true; this.quad = false; this.flyer = false; this.kid = false;
    this.phase = 0; this.t = 0; this.flash = 0; this.ko = 0; this.roar = 0; this.jaw = 0;
    this.skinned = true; this._clip = 'Idle';
    const obj = this.obj = new THREE.Group(); obj.name = 'spino-3d';
    const { scene, animations } = cloneSpino();
    const rig = this.rig = new THREE.Group(); obj.add(rig); rig.add(scene);
    const bones = {};
    const meshes = [];
    const splash = { value: 0 };
    this.splash = splash;
    scene.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.raycast = () => {};
        meshes.push(o);
        const mats = [].concat(o.material);
        for (const m of mats) {
          if (!m) continue;
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          m.roughness = 0.6; m.metalness = 0.0; m.envMapIntensity = 0.42;
          m.emissive = new THREE.Color(0x0a3048); m.emissiveIntensity = 0.06;
          m.onBeforeCompile = (shader) => { const u = RIM(shader); if (u) u.value = splash.value; shader.uniforms.uSplash = splash; };
        }
      }
    });
    this.bones = bones; this.meshes = meshes; this.skin = meshes[0];
    this.b = { pelvis: bones.hips, chest: bones.chest, neck: bones.neck, head: bones.head, jaw: bones.jaw };
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    // The box top is the sail. This height puts the skull near 6.6 m and the body past 14 m.
    const s = 8.45 / Math.max(size.y, 0.001);
    rig.scale.setScalar(s);
    box.setFromObject(rig);
    rig.position.y -= box.min.y;
    this.modelScale = s;

    this.mouth = new THREE.Group(); this.mouth.name = 'spino-mouth';
    this.mouth.position.set(0, -0.02, 0.12); (bones.jaw || bones.head).add(this.mouth);
    this.seat = new THREE.Group(); this.seat.name = 'spino-seat';
    (bones.neck || bones.chest).add(this.seat);
    this.seatOnBack();
    this.body = new THREE.Group(); this.body.name = 'spino-body'; bones.chest.add(this.body);
    this.legs = [bones.l_foot, bones.r_foot].map(g => ({ g: g || new THREE.Group() }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.0, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
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
    this.mats = { plate: mat, glowColor: new THREE.Color(0x4af0ff) };
    this.height = size.y * s;
    this.fitR = Math.max(size.x, size.z) * s * 0.48;
    this.sockets = { mouth: this.mouth };
  }
  groundNormal(x, z, yaw, heightAt, out) {
    const fX = Math.sin(yaw), fZ = Math.cos(yaw), sX = fZ, sZ = -fX, d = 2.6;
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
  surfaceY(x, z) {
    this.obj.updateMatrixWorld(true);
    for (const m of this.meshes) delete m.raycast;
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 28, z), new THREE.Vector3(0, -1, 0), 0, 48);
    const hits = ray.intersectObjects(this.meshes, false);
    for (const m of this.meshes) m.raycast = () => {};
    if (!hits.length) return null;
    let top = -Infinity;
    for (const h of hits) if (h.point.y > top) top = h.point.y;
    return top;
  }
  // At the base of the neck, just in front of the sail. The sail itself is rejected.
  seatOnBack() {
    this.obj.updateMatrixWorld(true);
    const neck = this.bones.neck || this.bones.chest;
    const origin = new THREE.Vector3();
    neck.getWorldPosition(origin);
    let best = null;
    for (const lz of [-0.10, -0.04, 0.02]) {
      for (const lx of [-0.02, 0, 0.02]) {
        const probe = new THREE.Vector3(lx, 0.5, lz);
        neck.localToWorld(probe);
        const y = this.surfaceY(probe.x, probe.z);
        if (y == null || y > origin.y + 1.35) continue;
        const hit = new THREE.Vector3(probe.x, y, probe.z);
        if (!best || hit.y > best.y) best = hit;
      }
    }
    if (!best) { this.seat.position.set(0, 0.12, -0.06); return; }
    const local = neck.worldToLocal(best.clone());
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
    const leg = 0.52 * this.modelScale;
    const amp = name === 'Run' ? 33 : 24;
    return 4 * leg * Math.sin(amp * Math.PI / 180);
  }
  animate(dt, speed, o = {}) {
    this.t += dt;
    const roar = Math.max(o.roar || 0, this.roar || 0);
    const splash = o.splash || 0;
    const bite = Math.max(o.bite || 0, (o.jaw || 0) > 0.45 && roar < 0.15 ? o.jaw : 0);
    let name = 'Idle', loop = true, scale = 1;
    if (this.ko > 0.2) { name = 'Idle'; loop = true; }
    else if (splash > 0.12) { name = 'Splash'; loop = false; }
    else if (roar > 0.25) { name = 'Roar'; loop = false; }
    else if (speed > 9) { name = 'Run'; scale = Math.max(0.4, speed / this.cycleDist('Run') * 0.5); }
    else if (speed > 0.45) { name = 'Walk'; scale = Math.max(0.4, speed / this.cycleDist('Walk') * 0.85); }
    const act = this.play(name, loop, scale);
    this.mixer.update(dt);
    if (name !== 'Splash' && name !== 'Roar' && bite > 0.25 && this.bones.jaw) this.bones.jaw.rotation.x = Math.min(0.45, bite * 0.4);
    if (act && act.getClip()) this.phase = (act.time / act.getClip().duration) * Math.PI * 2;
    this.jaw = Math.max(0, (this.jaw || 0) - dt * 1.6);
    this.roar = Math.max(0, (this.roar || 0) - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.splash) this.splash.value = Math.max(splash, this.flash * 0.4);
    const plate = this.mats.plate;
    if (plate && plate.emissive) plate.emissive.setRGB(0.05 + splash * 0.7, 0.12 + splash * 0.22, 0.22);
  }
}
