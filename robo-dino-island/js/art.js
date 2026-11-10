// Original drawings for the lion and the Rex. Paths stay here so the character files stay free of image names.
import * as THREE from './vendor/three.bundle.min.js';

export const ART = {
  rex: 'assets/art/rex-rider.webp',
};

const cache = {};
let cam = null;

export function setArtCamera(c) { cam = c; }
export function artCamera() { return cam; }

export function preloadArt(mgr) {
  const loader = new THREE.TextureLoader(mgr);
  for (const url of Object.values(ART)) {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    cache[url] = t;
  }
}
export function artMap(url) { return cache[url]; }

const parentQ = new THREE.Quaternion();
const faceQ = new THREE.Quaternion();
const camRight = new THREE.Vector3();
const fwd = new THREE.Vector3();

export function faceCamera(mesh) {
  if (!cam || !mesh.parent) return;
  mesh.parent.updateWorldMatrix(true, false);
  mesh.parent.getWorldQuaternion(parentQ);
  faceQ.copy(parentQ).invert().multiply(cam.quaternion);
  mesh.quaternion.copy(faceQ);
}

// Art faces image-right. Flip so the nose points the way the character is heading on screen.
export function facingSign(yaw, last) {
  if (!cam) return last || 1;
  cam.updateMatrixWorld();
  camRight.setFromMatrixColumn(cam.matrixWorld, 0); camRight.y = 0;
  if (camRight.lengthSq() < 1e-6) return last || 1;
  camRight.normalize();
  fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  const dot = fwd.dot(camRight);
  if (Math.abs(dot) < 0.12) return last || 1;
  return dot > 0 ? 1 : -1;
}
