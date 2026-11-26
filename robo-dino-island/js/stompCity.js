// Textured Stompolis towers. One facade atlas (four variants), tinted per tower, with floor bands and roof caps.
import * as THREE from './vendor/three.bundle.min.js';
import { mergeGeometries } from './vendor/three.bundle.min.js';
import { cityMaps } from './models.js';

const SEG = 28;
const CELL = { A: [0, 0], B: [0.5, 0], C: [0, 0.5], D: [0.5, 0.5] };
const KIND = { egg: 'C', crane: 'B', neck: 'D', dome: 'A' };

const facadeMats = [];
let roofMat = null;
let trimMat = null;

function dress(tex, srgb) {
  if (!tex) return tex;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return tex;
}

function patchFacade(shader, cell, tint) {
  shader.uniforms.uCell = { value: new THREE.Vector2(cell[0], cell[1]) };
  shader.uniforms.uTintMap = { value: tint };
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
uniform vec2 uCell;
uniform sampler2D uTintMap;
float stompWall;
vec2 stompUv(vec2 uv){ return uCell + fract(uv) * 0.5; }`)
    .replace('#include <color_fragment>', '')
    .replace('#include <map_fragment>', `#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, stompUv(vMapUv) );
	stompWall = texture2D( uTintMap, stompUv(vMapUv) ).r;
	sampledDiffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, stompWall);
	diffuseColor *= sampledDiffuseColor;
#endif`)
    .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, stompUv(vRoughnessMapUv) );
	roughnessFactor *= texelRoughness.g;
#endif
roughnessFactor = mix(max(roughnessFactor, 0.35), roughnessFactor, stompWall);`)
    .replace('#include <metalnessmap_fragment>', `float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, stompUv(vMetalnessMapUv) );
	metalnessFactor *= texelMetalness.b;
#endif`)
    .replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, stompUv(vNormalMapUv) ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, stompUv(vNormalMapUv) ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`)
    .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, stompUv(vEmissiveMapUv) );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`)
    .replace('#include <aomap_fragment>', `#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, stompUv(vAoMapUv) ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`);
}

function makeFacadeMats(set) {
  facadeMats.length = 0;
  const tint = dress(set.tint, false);
  for (const key of ['A', 'B', 'C', 'D']) {
    const mat = new THREE.MeshStandardMaterial({
      map: dress(set.albedo, true),
      normalMap: dress(set.normal, false),
      roughnessMap: dress(set.orm, false),
      metalnessMap: set.orm,
      aoMap: set.orm,
      emissiveMap: dress(set.emis, false),
      emissive: new THREE.Color(0xffe6a8),
      emissiveIntensity: 0.8,
      roughness: 1,
      metalness: 1,
      aoMapIntensity: 1,
      envMapIntensity: 0.25,
      vertexColors: true,
    });
    const cell = CELL[key];
    mat.onBeforeCompile = (shader) => { patchFacade(shader, cell, tint); mat.userData.shader = shader; };
    mat.customProgramCacheKey = () => 'stomp-facade-' + key;
    mat.userData.variant = key;
    facadeMats.push(mat);
  }
  roofMat = new THREE.MeshStandardMaterial({
    map: dress(set.roof, true),
    normalMap: dress(set.roofN, false),
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.2,
    color: 0xffffff,
  });
  roofMat.map.wrapS = roofMat.map.wrapT = THREE.RepeatWrapping;
  if (roofMat.normalMap) { roofMat.normalMap.wrapS = roofMat.normalMap.wrapT = THREE.RepeatWrapping; }
  trimMat = new THREE.MeshStandardMaterial({ color: 0xc8bfb0, roughness: 0.86, metalness: 0.04 });
}

export function setCityDetail(high) {
  const set = high ? cityMaps.hi : cityMaps.lo;
  if (!set || !set.albedo || !facadeMats.length) return false;
  const tint = dress(set.tint, false);
  for (const m of facadeMats) {
    m.map = dress(set.albedo, true);
    m.normalMap = dress(set.normal, false);
    m.roughnessMap = dress(set.orm, false);
    m.metalnessMap = set.orm;
    m.aoMap = set.orm;
    m.emissiveMap = dress(set.emis, false);
    m.needsUpdate = true;
    if (m.userData.shader) m.userData.shader.uniforms.uTintMap.value = tint;
  }
  if (roofMat && set.roof) {
    roofMat.map = dress(set.roof, true);
    roofMat.normalMap = dress(set.roofN, false);
    roofMat.map.wrapS = roofMat.map.wrapT = THREE.RepeatWrapping;
    roofMat.needsUpdate = true;
  }
  return true;
}

function hash01(i) {
  let h = Math.imul(i + 1, 1225) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h & 1023) / 1023;
}

function assignVariants(towers) {
  const v = towers.map(t => KIND[t.kind] || null);
  const near = (i, j) => {
    const a = towers[i], b = towers[j];
    return Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r + 18;
  };
  for (let i = 0; i < towers.length; i++) {
    if (towers[i].kind !== 'pot') continue;
    const used = new Set();
    let far = 'D', farD = -1;
    for (let j = 0; j < towers.length; j++) {
      if (j === i || !v[j] || !near(i, j)) continue;
      used.add(v[j]);
      if (v[j] === 'A' || v[j] === 'D') {
        const d = Math.hypot(towers[i].x - towers[j].x, towers[i].z - towers[j].z);
        if (d > farD) { farD = d; far = v[j]; }
      }
    }
    v[i] = !used.has('A') ? 'A' : !used.has('D') ? 'D' : far;
  }
  return v;
}

function radiusAt(t, y) {
  const h = t.h, r = t.r;
  if (t.kind === 'egg') {
    const cy = h * 0.46, sy = h / (r * 1.65), ly = (y - cy) / sy;
    const rr = r * r - ly * ly;
    return rr > 0.25 ? Math.sqrt(rr) : r * 0.55;
  }
  if (t.kind === 'dome') return y <= h * 0.62 ? r : r * 0.9;
  if (t.kind === 'neck') {
    const u = Math.min(1, y / (h * 0.72));
    return r * (0.7 + (0.42 - 0.7) * u);
  }
  if (t.kind === 'crane') return r * (1 - 0.3 * Math.min(1, y / h));
  if (y < h * 0.58) return r * (1 + (0.76 - 1) * (y / (h * 0.58)));
  const u = Math.min(1, (y - h * 0.58) / (h * 0.4));
  return r * (0.68 + (0.92 - 0.68) * u);
}

function prepWall(geo, color, repX, repY, shift, jitter) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color(color);
  c.multiplyScalar(jitter);
  let minY = 1e9, maxY = -1e9;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(0.001, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const edge = Math.min((y - minY) / span, (maxY - y) / span);
    const ao = edge < 0.07 ? 0.62 + (edge / 0.07) * 0.38 : 1;
    uv.setXY(i, uv.getX(i) * repX + shift, uv.getY(i) * repY);
    col[i * 3] = c.r * ao; col[i * 3 + 1] = c.g * ao; col[i * 3 + 2] = c.b * ao;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uv.array.slice(), 2));
  return geo;
}

function cyl(rt, rb, height, y) {
  const g = new THREE.CylinderGeometry(rt, rb, height, SEG, 1, true);
  g.translate(0, y, 0);
  return g;
}

function wallParts(t) {
  if (t.kind === 'egg') {
    const g = new THREE.SphereGeometry(t.r, SEG, 20);
    g.scale(1, t.h / (t.r * 1.65), 1);
    g.translate(0, t.h * 0.46, 0);
    return [g];
  }
  if (t.kind === 'dome') return [cyl(t.r, t.r * 0.92, t.h * 0.62, t.h * 0.31)];
  if (t.kind === 'neck') return [cyl(t.r * 0.42, t.r * 0.7, t.h * 0.72, t.h * 0.36)];
  if (t.kind === 'crane') return [cyl(t.r * 0.7, t.r, t.h, t.h / 2)];
  return [cyl(t.r * 0.76, t.r, t.h * 0.58, t.h * 0.29), cyl(t.r * 0.92, t.r * 0.68, t.h * 0.4, t.h * 0.76)];
}

function matFor(variant) {
  return facadeMats.find(m => m.userData.variant === variant) || facadeMats[0];
}

function instanceOf(geo, mat, n) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  mesh.count = n;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

export function buildAllTowers(root, towers, onPark) {
  const set = cityMaps.hi;
  if (!set || !set.albedo) throw new Error('Stompolis textures are not loaded');
  makeFacadeMats(set);
  const variants = assignVariants(towers);
  const bodies = [];
  const bands = [];
  const roofs = [];
  const lips = [];
  const poles = [];
  const masts = [];
  const bushes = [];
  const gardens = [];
  const up = new THREE.Vector3(0, 1, 0);
  towers.forEach((t, ti) => {
    const g = new THREE.Group();
    g.position.set(t.x, 0, t.z);
    root.add(g);
    const shift = hash01(ti);
    const jitter = 1 + (hash01(ti + 17) * 0.08 - 0.04);
    const repX = Math.max(1, Math.round(2 * Math.PI * t.r / 8));
    const repY = Math.max(1, t.h / 25);
    const parts = wallParts(t).map(geo => prepWall(geo, t.col, repX, repY, shift, jitter));
    const body = new THREE.Mesh(mergeGeometries(parts), matFor(variants[ti]));
    body.castShadow = false;
    body.receiveShadow = true;
    g.add(body);
    bodies.push({ mesh: body, x: t.x, z: t.z });
    for (let y = 15.625; y < t.h - 2; y += 15.625) bands.push({ x: t.x, y, z: t.z, r: Math.max(0.8, radiusAt(t, y) * 1.05) });
    if (t.park && onPark) onPark(g, t);
    else {
      roofs.push({ x: t.x, y: t.h + 0.06, z: t.z, r: t.r * 0.96 });
      lips.push({ x: t.x, y: t.h + 0.32, z: t.z, r: t.r * 0.98 });
      gardens.push({ x: t.x + t.r * 0.42, y: t.h + 0.28, z: t.z + t.r * 0.2, r: t.r * 0.28 });
    }
    if (t.kind === 'dome') {
      const cap = new THREE.SphereGeometry(t.r * 0.9, SEG, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      const mesh = new THREE.Mesh(cap, roofMat);
      mesh.position.y = t.h * 0.62;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    if (t.kind === 'neck') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 2.0), new THREE.MeshStandardMaterial({ color: 0xb8c4d2, roughness: 0.5, metalness: 0.16 }));
      box.position.y = t.h * 0.9;
      box.castShadow = false;
      box.receiveShadow = true;
      g.add(box);
      for (const sx of [0.45, -0.45]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0a141e, roughness: 0.4 }));
        eye.position.set(sx, t.h * 0.98, 0.7);
        g.add(eye);
      }
    }
    if (t.kind === 'crane') {
      const jib = new THREE.Mesh(new THREE.BoxGeometry(t.r * 3.2, 0.7, 0.7), trimMat);
      jib.position.set(t.r * 1.05, t.h + 2.1, 0);
      jib.castShadow = false;
      g.add(jib);
      const mastH = t.h * 0.32;
      masts.push({
        A: new THREE.Vector3(t.x + t.r * 2.2, t.h * 0.5 - mastH * 0.5, t.z),
        B: new THREE.Vector3(t.x + t.r * 2.2, t.h * 0.5 + mastH * 0.5, t.z),
      });
    }
    bushes.push(
      { x: t.x + t.r * 0.35, y: t.h + 0.55, z: t.z + t.r * 0.2, s: 0.55 },
      { x: t.x + t.r * 0.1, y: t.h + 0.45, z: t.z + t.r * 0.6, s: 0.4 },
    );
    const anchors = [];
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.3, c = Math.cos(a), s = Math.sin(a);
      const x0 = c * t.r, z0 = s * t.r, y0 = t.h + 0.12;
      const x1 = c * (t.r + 1.5), z1 = s * (t.r + 1.5), y1 = t.h + 7;
      poles.push({
        A: new THREE.Vector3(t.x + x0, y0, t.z + z0),
        B: new THREE.Vector3(t.x + x1, y1, t.z + z1),
        thick: 1,
      });
      anchors.push({ x: t.x + x1, y: y1, z: t.z + z1, roof: t });
    }
    if (t.kind === 'crane') anchors.push({ x: t.x + t.r + 1.5, y: t.h + 7, z: t.z, roof: t });
    t.anchors = anchors;
    t.variant = variants[ti];
  });

  const bandMesh = instanceOf(new THREE.CylinderGeometry(1, 1, 0.6, SEG, 1, true), trimMat, bands.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  bands.forEach((b, i) => bandMesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.r, 1, b.r))));
  root.add(bandMesh);

  if (roofs.length) {
    const disc = new THREE.CircleGeometry(1, SEG);
    const roofMesh = instanceOf(disc, roofMat, roofs.length);
    roofs.forEach((b, i) => {
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      roofMesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.r, b.r, 1)));
    });
    root.add(roofMesh);
    const lip = instanceOf(new THREE.CylinderGeometry(1, 1, 0.5, SEG, 1, true), trimMat, lips.length);
    q.identity();
    lips.forEach((b, i) => lip.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.r, 1, b.r))));
    root.add(lip);
  }
  if (gardens.length) {
    const garden = instanceOf(new THREE.CylinderGeometry(1, 1, 0.22, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x3ec85a, roughness: 0.9 }), gardens.length);
    q.identity();
    gardens.forEach((b, i) => garden.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.r, 1, b.r))));
    root.add(garden);
  }
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x2f7a32, roughness: 0.85 });
  const bushMesh = instanceOf(new THREE.SphereGeometry(1, 8, 6), bushMat, bushes.length);
  bushMesh.receiveShadow = false;
  q.identity();
  const bushBase = [];
  bushes.forEach((b, i) => {
    const mat = m.compose(p.set(b.x, b.y, b.z), q, s.set(b.s, b.s, b.s));
    bushMesh.setMatrixAt(i, mat);
    bushBase.push(mat.clone());
  });
  root.add(bushMesh);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.55, metalness: 0.08, transparent: true });
  poleMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float poleOpacity;\nvarying float vPoleOp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPoleOp = poleOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPoleOp;')
      .replace('#include <dithering_fragment>', 'gl_FragColor.a *= vPoleOp;\n#include <dithering_fragment>');
  };
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 8, 1, true);
  const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, poles.length);
  poleMesh.castShadow = false;
  poleMesh.receiveShadow = false;
  poleMesh.frustumCulled = false;
  const opac = new Float32Array(poles.length).fill(1);
  poleGeo.setAttribute('poleOpacity', new THREE.InstancedBufferAttribute(opac, 1));
  const poleBase = [];
  const dummy = new THREE.Object3D();
  poles.forEach((seg, i) => {
    const dir = seg.B.clone().sub(seg.A);
    const len = dir.length() || 0.1;
    dummy.position.copy(seg.A).addScaledVector(dir, 0.5);
    dummy.quaternion.setFromUnitVectors(up, dir.multiplyScalar(1 / len));
    dummy.scale.set(1, len, 1);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    poleBase.push(dummy.matrix.clone());
  });
  root.add(poleMesh);

  let mastMesh = null;
  const mastBase = [];
  if (masts.length) {
    const geo = new THREE.BoxGeometry(0.45, 1, 0.45);
    mastMesh = new THREE.InstancedMesh(geo, poleMat, masts.length);
    mastMesh.castShadow = false;
    mastMesh.frustumCulled = false;
    const mo = new Float32Array(masts.length).fill(1);
    geo.setAttribute('poleOpacity', new THREE.InstancedBufferAttribute(mo, 1));
    masts.forEach((seg, i) => {
      const dir = seg.B.clone().sub(seg.A);
      const len = dir.length() || 0.1;
      dummy.position.copy(seg.A).addScaledVector(dir, 0.5);
      dummy.quaternion.setFromUnitVectors(up, dir.multiplyScalar(1 / len));
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      mastMesh.setMatrixAt(i, dummy.matrix);
      mastBase.push(dummy.matrix.clone());
    });
    root.add(mastMesh);
  }

  root.userData.cityBodies = bodies;
  root.userData.cityFade = { poleMesh, poleBase, poles, mastMesh, mastBase, masts, bushMesh, bushBase, bushes };
  return towers;
}

function segDist(cam, A, B) {
  const abx = B.x - A.x, aby = B.y - A.y, abz = B.z - A.z;
  const ab2 = abx * abx + aby * aby + abz * abz || 1;
  const u = Math.max(0, Math.min(1, ((cam.x - A.x) * abx + (cam.y - A.y) * aby + (cam.z - A.z) * abz) / ab2));
  return Math.hypot(cam.x - (A.x + abx * u), cam.y - (A.y + aby * u), cam.z - (A.z + abz * u));
}

export function fadeCityProps(root, cam) {
  const f = root.userData.cityFade;
  if (!f) return;
  const apply = (mesh, base, segs) => {
    if (!mesh) return;
    const attr = mesh.geometry.getAttribute('poleOpacity');
    let moved = false;
    for (let i = 0; i < segs.length; i++) {
      const d = segDist(cam, segs[i].A, segs[i].B);
      const hide = d < 0.6;
      const op = hide ? 0 : d < 1.5 ? 0.2 : 1;
      if (attr.getX(i) !== op) { attr.setX(i, op); attr.needsUpdate = true; }
      if (hide) {
        mesh.setMatrixAt(i, _zero);
        moved = true;
      } else if (attr.getX(i) === op) {
        mesh.setMatrixAt(i, base[i]);
        moved = true;
      }
    }
    if (moved) mesh.instanceMatrix.needsUpdate = true;
  };
  apply(f.poleMesh, f.poleBase, f.poles);
  apply(f.mastMesh, f.mastBase, f.masts);
  if (f.bushMesh) {
    let moved = false;
    for (let i = 0; i < f.bushes.length; i++) {
      const b = f.bushes[i];
      const near = Math.hypot(cam.x - b.x, cam.y - b.y, cam.z - b.z) < 0.9;
      if (near) { f.bushMesh.setMatrixAt(i, _zero); moved = true; }
      else { f.bushMesh.setMatrixAt(i, f.bushBase[i]); moved = true; }
    }
    if (moved) f.bushMesh.instanceMatrix.needsUpdate = true;
  }
}

const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

export function castCityShadows(root, px, pz) {
  const list = root.userData.cityBodies;
  if (!list) return;
  for (const b of list) {
    const on = Math.hypot(px - b.x, pz - b.z) < 30;
    if (b.mesh.castShadow !== on) b.mesh.castShadow = on;
  }
}
