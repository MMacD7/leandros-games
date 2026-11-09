// Preloads the CC0 character files during the boot loading screen, then clones a skinned copy per actor.
import * as THREE from './vendor/three.bundle.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone } from './vendor/SkeletonUtils.js';

const URLS = ['assets/models/lion.glb', 'assets/models/trex.glb'];
const cache = {};

export function preloadModels(mgr) {
  const loader = new GLTFLoader(mgr);
  for (const url of URLS) loader.load(url, gltf => { cache[url] = gltf; }, undefined, err => console.error(url, err));
}

export function cloneModel(url) {
  const src = cache[url];
  if (!src) throw new Error('model not loaded: ' + url);
  return { scene: clone(src.scene), animations: src.animations };
}

export function paintFromTexture(mesh) {
  const map = mesh.material && mesh.material.map;
  const img = map && map.image;
  if (!img || !img.width) return null;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const uv = mesh.geometry.attributes.uv;
  const col = new Float32Array(uv.count * 3);
  const sample = (u, v) => {
    const x = Math.min(c.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * c.width)));
    const y = Math.min(c.height - 1, Math.max(0, Math.floor((1 - (v - Math.floor(v))) * (c.height - 1))));
    return (y * c.width + x) * 4;
  };
  for (let i = 0; i < uv.count; i++) {
    const p = sample(uv.getX(i), uv.getY(i));
    col[i * 3] = data[p] / 255; col[i * 3 + 1] = data[p + 1] / 255; col[i * 3 + 2] = data[p + 2] / 255;
  }
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return col;
}

export function playClip(mixer, actions, current, name, timeScale) {
  const next = actions[name];
  if (!next) return current;
  next.timeScale = timeScale;
  if (current === name) return current;
  next.reset().setEffectiveWeight(1).play();
  if (current && actions[current]) next.crossFadeFrom(actions[current], 0.15, true);
  return name;
}
