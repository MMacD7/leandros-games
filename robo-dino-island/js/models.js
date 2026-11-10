// Loads the Meshy lion (see CREDITS.md). One shared file, a skinned copy per actor.
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone } from './vendor/SkeletonUtils.js';

const LION_URL = 'assets/models/lion.glb';
const TREX_URL = 'assets/models/trex.glb';
const BRACHIO_URL = 'assets/models/brachio.glb';
let lionCache = null;
let trexCache = null;
let brachioCache = null;

export function preloadLion(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(LION_URL, gltf => { lionCache = gltf; }, undefined, err => console.error(LION_URL, err));
}

export function cloneLion() {
  if (!lionCache) throw new Error('lion model not loaded');
  return { scene: clone(lionCache.scene), animations: lionCache.animations };
}

export function preloadTrex(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(TREX_URL, gltf => { trexCache = gltf; }, undefined, err => console.error(TREX_URL, err));
}

export function cloneTrex() {
  if (!trexCache) throw new Error('trex model not loaded');
  return { scene: clone(trexCache.scene), animations: trexCache.animations };
}

export function preloadBrachio(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(BRACHIO_URL, gltf => { brachioCache = gltf; }, undefined, err => console.error(BRACHIO_URL, err));
}

export function cloneBrachio() {
  if (!brachioCache) throw new Error('brachio model not loaded');
  return { scene: clone(brachioCache.scene), animations: brachioCache.animations };
}
