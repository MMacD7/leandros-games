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

const CARNO_URL = 'assets/models/carno.glb';
let carnoCache = null;

export function preloadCarno(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(CARNO_URL, gltf => { carnoCache = gltf; }, undefined, err => console.error(CARNO_URL, err));
}

export function cloneCarno() {
  if (!carnoCache) throw new Error('carno model not loaded');
  return { scene: clone(carnoCache.scene), animations: carnoCache.animations };
}

const RAPTOR_URL = 'assets/models/raptor.glb';
let raptorCache = null;
const LEANDRO_URL = 'assets/models/leandro.glb';
let leandroCache = null;

export function preloadRaptor(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(RAPTOR_URL, gltf => { raptorCache = gltf; }, undefined, err => console.error(RAPTOR_URL, err));
}
export function cloneRaptor() {
  if (!raptorCache) throw new Error('raptor model not loaded');
  return { scene: clone(raptorCache.scene), animations: raptorCache.animations };
}
export function preloadLeandro(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(LEANDRO_URL, gltf => { leandroCache = gltf; }, undefined, err => console.error(LEANDRO_URL, err));
}
export function cloneLeandro() {
  if (!leandroCache) throw new Error('leandro model not loaded');
  return { scene: clone(leandroCache.scene), animations: leandroCache.animations };
}

const ANKY_URL = 'assets/models/anky.glb';
let ankyCache = null;

export function preloadAnky(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(ANKY_URL, gltf => { ankyCache = gltf; }, undefined, err => console.error(ANKY_URL, err));
}
export function cloneAnky() {
  if (!ankyCache) throw new Error('anky model not loaded');
  return { scene: clone(ankyCache.scene), animations: ankyCache.animations };
}

const STEGO_URL = 'assets/models/stego.glb';
let stegoCache = null;

export function preloadStego(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(STEGO_URL, gltf => { stegoCache = gltf; }, undefined, err => console.error(STEGO_URL, err));
}
export function cloneStego() {
  if (!stegoCache) throw new Error('stego model not loaded');
  return { scene: clone(stegoCache.scene), animations: stegoCache.animations };
}

const ALLO_URL = 'assets/models/allo.glb';
let alloCache = null;

export function preloadAllo(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(ALLO_URL, gltf => { alloCache = gltf; }, undefined, err => console.error(ALLO_URL, err));
}
export function cloneAllo() {
  if (!alloCache) throw new Error('allo model not loaded');
  return { scene: clone(alloCache.scene), animations: alloCache.animations };
}

const DILO_URL = 'assets/models/dilo.glb';
let diloCache = null;

export function preloadDilo(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(DILO_URL, gltf => { diloCache = gltf; }, undefined, err => console.error(DILO_URL, err));
}
export function cloneDilo() {
  if (!diloCache) throw new Error('dilo model not loaded');
  return { scene: clone(diloCache.scene), animations: diloCache.animations };
}

const PACHY_URL = 'assets/models/pachy.glb';
let pachyCache = null;

export function preloadPachy(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(PACHY_URL, gltf => { pachyCache = gltf; }, undefined, err => console.error(PACHY_URL, err));
}
export function clonePachy() {
  if (!pachyCache) throw new Error('pachy model not loaded');
  return { scene: clone(pachyCache.scene), animations: pachyCache.animations };
}

const PARA_URL = 'assets/models/para.glb';
let paraCache = null;

export function preloadPara(mgr) {
  const loader = new GLTFLoader(mgr);
  loader.load(PARA_URL, gltf => { paraCache = gltf; }, undefined, err => console.error(PARA_URL, err));
}
export function clonePara() {
  if (!paraCache) throw new Error('para model not loaded');
  return { scene: clone(paraCache.scene), animations: paraCache.animations };
}
