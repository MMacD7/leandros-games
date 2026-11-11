// Loads the Meshy lion (see CREDITS.md). One shared file, a skinned copy per actor.
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone } from './vendor/SkeletonUtils.js';

const LION_URL = 'assets/models/lion.glb';
const TREX_URL = 'assets/models/trex.glb';
const BRACHIO_URL = 'assets/models/brachio.glb';
const GIGA_URL = 'assets/models/giga.glb';
let lionCache = null;
let trexCache = null;
let brachioCache = null;
let gigaCache = null;

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

export function preloadGiga(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(GIGA_URL, gltf => { gigaCache = gltf; }, undefined, err => console.error(GIGA_URL, err));
}

export function cloneGiga() {
  if (!gigaCache) throw new Error('giga model not loaded');
  return { scene: clone(gigaCache.scene), animations: gigaCache.animations };
}

const SPINO_URL = 'assets/models/spino.glb';
let spinoCache = null;

export function preloadSpino(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(SPINO_URL, gltf => { spinoCache = gltf; }, undefined, err => console.error(SPINO_URL, err));
}

export function cloneSpino() {
  if (!spinoCache) throw new Error('spino model not loaded');
  return { scene: clone(spinoCache.scene), animations: spinoCache.animations };
}

const TRIKE_URL = 'assets/models/trike.glb';
let trikeCache = null;

export function preloadTrike(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(TRIKE_URL, gltf => { trikeCache = gltf; }, undefined, err => console.error(TRIKE_URL, err));
}

export function cloneTrike() {
  if (!trikeCache) throw new Error('trike model not loaded');
  return { scene: clone(trikeCache.scene), animations: trikeCache.animations };
}
