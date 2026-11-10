import { BufferGeometry, Float32BufferAttribute } from './three.bundle.min.js';
// Only used if a model is triangle strips or fans. Our CC0 characters are plain triangles.
export function toTrianglesDrawMode(geometry, drawMode) {
  console.warn('toTrianglesDrawMode unused path', drawMode);
  return geometry;
}
export { BufferGeometry, Float32BufferAttribute };
