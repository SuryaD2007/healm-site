/**
 * A generic head and shoulders, built from simple shapes (a signed distance field): a cranium, the
 * face's masses, a nose, lids, lips, ears, a neck and shoulders, blended smoothly. It is a mannequin,
 * not anyone's face: no scan, no photo, no likeness.
 *
 * Units: y up, the face looks down +z, the head is about 2.3 tall. `generateHead` samples points evenly
 * over the surface with a seeded random generator, so the live scene and the static render (the poster)
 * draw the same points.
 */

type V3 = [number, number, number];

/** Regions, for the scan chapter's labels: Skin, Hair, Body. */
export const REGION = {
  face: 0,
  forehead: 1,
  cheeks: 2,
  hair: 3,
  nose: 4,
  jaw: 5,
  body: 6,
  ears: 7,
} as const;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ellipsoid(px: number, py: number, pz: number, c: V3, r: V3): number {
  const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const x2 = x / r[0], y2 = y / r[1], z2 = z / r[2];
  const k1 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

function capsule(px: number, py: number, pz: number, a: V3, b: V3, r: number): number {
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const h = Math.min(Math.max((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0), 1);
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

/** Polynomial smooth minimum: a union with a soft seam k wide. */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** Smooth subtraction of b from a. */
function ssub(a: number, b: number, k: number): number {
  return -smin(-a, b, k);
}

export function headSDF(x: number, y: number, z: number): number {
  const ax = Math.abs(x); // the face is symmetric

  // Cranium and the face's big masses.
  // The eyes sit about halfway between the crown and the chin, as on a real head.
  let d = ellipsoid(x, y, z, [0, 0.24, -0.08], [0.8, 0.78, 0.98]);
  d = smin(d, ellipsoid(x, y, z, [0, 0.3, 0.3], [0.68, 0.5, 0.6]), 0.2);
  d = smin(d, ellipsoid(x, y, z, [0, -0.2, 0.17], [0.68, 0.76, 0.72]), 0.22);
  d = smin(d, ellipsoid(x, y, z, [0, -0.6, 0.12], [0.58, 0.42, 0.62]), 0.2);
  d = smin(d, ellipsoid(x, y, z, [0, -0.9, 0.42], [0.24, 0.17, 0.2]), 0.16);
  d = smin(d, ellipsoid(ax, y, z, [0.45, -0.1, 0.45], [0.22, 0.16, 0.22]), 0.14);

  // Brow and eye sockets, then closed lids, like a mannequin's.
  d = smin(d, ellipsoid(x, y, z, [0, 0.12, 0.69], [0.56, 0.12, 0.17]), 0.1);
  d = ssub(d, ellipsoid(ax, y, z, [0.28, -0.04, 0.76], [0.17, 0.11, 0.16]), 0.06);
  d = smin(d, ellipsoid(ax, y, z, [0.28, -0.05, 0.62], [0.13, 0.075, 0.085]), 0.04);

  // Nose.
  d = smin(d, capsule(x, y, z, [0, 0.05, 0.82], [0, -0.3, 1.06], 0.09), 0.08);
  d = smin(d, ellipsoid(x, y, z, [0, -0.33, 1.02], [0.125, 0.095, 0.105]), 0.05);
  d = smin(d, ellipsoid(ax, y, z, [0.095, -0.37, 0.92], [0.08, 0.06, 0.07]), 0.04);

  // Lips and the line between them.
  d = smin(d, ellipsoid(x, y, z, [0, -0.555, 0.77], [0.19, 0.055, 0.085]), 0.05);
  d = smin(d, ellipsoid(x, y, z, [0, -0.66, 0.75], [0.16, 0.06, 0.08]), 0.05);
  d = ssub(d, ellipsoid(x, y, z, [0, -0.607, 0.83], [0.18, 0.014, 0.09]), 0.02);

  // Ears.
  d = smin(d, ellipsoid(ax, y, z, [0.8, -0.08, -0.04], [0.07, 0.23, 0.14]), 0.06);

  // Neck and shoulders, cut off low so they fade out below the ring.
  d = smin(d, capsule(x, y, z, [0, -0.72, -0.12], [0, -1.95, -0.2], 0.4), 0.18);
  d = smin(d, ellipsoid(ax, y, z, [0.62, -2.02, -0.22], [0.82, 0.3, 0.46]), 0.32);
  d = Math.max(d, -(y + 2.25));
  return d;
}

/** The surface normal by the tetrahedron technique: four samples instead of six. */
export function headNormal(x: number, y: number, z: number): V3 {
  const e = 0.002;
  const a = headSDF(x + e, y - e, z - e);
  const b = headSDF(x - e, y - e, z + e);
  const c = headSDF(x - e, y + e, z - e);
  const d = headSDF(x + e, y + e, z + e);
  const nx = a - b - c + d, ny = -a - b + c + d, nz = -a + b - c + d;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

export function regionOf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  if (y < -0.95 || (y < -0.75 && z < 0.1)) return REGION.body;
  if (ax > 0.7 && y > -0.35 && y < 0.2 && z < 0.15) return REGION.ears;
  // The hairline and crown: the top and back of the cranium.
  if (y > 0.7 || (z < -0.05 && y > 0.0) || (z < 0.25 && y > 0.48)) return REGION.hair;
  if (y > 0.16 && z > 0.25) return REGION.forehead;
  if (ax < 0.13 && y < 0.05 && y > -0.42 && z > 0.6) return REGION.nose;
  if (ax > 0.22 && y > -0.5 && y < 0.02 && z > 0.12) return REGION.cheeks;
  if (y < -0.45) return REGION.jaw;
  return REGION.face;
}

export interface HeadPoints {
  count: number;
  positions: Float32Array;
  normals: Float32Array;
  seeds: Float32Array;
  regions: Float32Array;
  /** 1 for a point on a scan line (a horizontal slice of the surface), 0 for the fill between them. */
  lines: Float32Array;
}

/** Scan lines: horizontal slices of the surface, this far apart (about 9 px on a 600 px stage). */
export const SLICE = 0.058;
/** The share of points on scan lines; the rest fill the surface faintly for volume. */
const LINE_SHARE = 0.65;

// Two boxes that hold the bust without overlapping: the head and neck, and the shoulders. Picking one in
// proportion to its volume keeps the sampling uniform while wasting far fewer tries on empty space.
const BOXES: { min: V3; max: V3; volume: number }[] = [
  { min: [-0.95, -1.5, -1.1], max: [0.95, 1.2, 1.1] },
  { min: [-1.5, -2.25, -0.85], max: [1.5, -1.5, 0.4] },
].map((b) => ({ ...b, volume: (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]) })) as never;
const HEAD_SHARE = BOXES[0].volume / (BOXES[0].volume + BOXES[1].volume);

// How much of each region's even density to keep. The shoulders fade out, so they need fewer points;
// the face carries the likeness of a face, so it keeps them all.
const KEEP: Record<number, number> = {
  [REGION.body]: 0.32, [REGION.ears]: 0.7, [REGION.hair]: 0.6,
};

const Y_MIN = -2.25;
const Y_MAX = 1.2;
const SLICES = Math.floor((Y_MAX - Y_MIN) / SLICE);

/**
 * Samples `count` points over the surface, like a 3D scanner: most lie on scan lines (horizontal slices,
 * evenly spaced, evenly dotted along each line), the rest fill the surface faintly. Either way a point is
 * a random try near the surface (within a thin shell, so density is even) pulled onto it. Lines and fill
 * are interleaved at random, so the first N points are an even sample too: phones draw a prefix of the
 * same cloud.
 */
export function generateHead(count: number, seed = 20261118): HeadPoints {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const regions = new Float32Array(count);
  const lines = new Float32Array(count);
  const shell = 0.07;
  let n = 0;
  let guard = 0;
  while (n < count && guard < count * 300) {
    guard++;
    const onLine = rand() < LINE_SHARE;
    let x: number, y: number, z: number;
    if (onLine) {
      y = Y_MIN + SLICE * (1 + Math.floor(rand() * (SLICES - 1)));
      const box = y > -1.5 ? BOXES[0] : BOXES[1];
      x = box.min[0] + rand() * (box.max[0] - box.min[0]);
      z = box.min[2] + rand() * (box.max[2] - box.min[2]);
    } else {
      const box = rand() < HEAD_SHARE ? BOXES[0] : BOXES[1];
      x = box.min[0] + rand() * (box.max[0] - box.min[0]);
      y = box.min[1] + rand() * (box.max[1] - box.min[1]);
      z = box.min[2] + rand() * (box.max[2] - box.min[2]);
    }
    const d0 = headSDF(x, y, z);
    if (Math.abs(d0) > shell) continue;
    // Thin out a region before paying for the projection.
    const keep = KEEP[regionOf(x, y, z)];
    if (keep !== undefined && rand() > keep) continue;

    let [nx, ny, nz] = headNormal(x, y, z);
    if (onLine) {
      // Stay on the slice: step only across it (x and z), scaled by how fast the distance changes there.
      let d = d0;
      for (let i = 0; i < 3; i++) {
        if (i > 0) {
          d = headSDF(x, y, z);
          [nx, ny, nz] = headNormal(x, y, z);
        }
        const g = Math.hypot(nx, nz);
        if (g < 0.2) break; // the very top of the head, where a slice runs flat
        x -= (nx / g) * (d / g);
        z -= (nz / g) * (d / g);
      }
      if (Math.abs(headSDF(x, y, z)) > 0.01) continue;
    } else {
      // One Newton step onto the surface, then one more with the refined distance.
      x -= nx * d0; y -= ny * d0; z -= nz * d0;
      const d1 = headSDF(x, y, z);
      x -= nx * d1; y -= ny * d1; z -= nz * d1;
    }
    [nx, ny, nz] = headNormal(x, y, z);
    positions[n * 3] = x; positions[n * 3 + 1] = y; positions[n * 3 + 2] = z;
    normals[n * 3] = nx; normals[n * 3 + 1] = ny; normals[n * 3 + 2] = nz;
    seeds[n] = rand();
    regions[n] = regionOf(x, y, z);
    lines[n] = onLine ? 1 : 0;
    n++;
  }
  return {
    count: n,
    positions: positions.subarray(0, n * 3),
    normals: normals.subarray(0, n * 3),
    seeds: seeds.subarray(0, n),
    regions: regions.subarray(0, n),
    lines: lines.subarray(0, n),
  };
}
