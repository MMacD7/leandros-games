// Loads the Meshy lion (see CREDITS.md). One shared file, a skinned copy per actor.
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone } from './vendor/SkeletonUtils.js';

const URL = 'assets/models/lion.glb';
let cache = null;

export function preloadLion(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(URL, gltf => { cache = gltf; }, undefined, err => console.error(URL, err));
}

export function cloneLion() {
  if (!cache) throw new Error('lion model not loaded');
  return { scene: clone(cache.scene), animations: cache.animations };
}
