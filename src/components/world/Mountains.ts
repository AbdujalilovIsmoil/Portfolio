import { Mesh, VertexData, type Node } from "@babylonjs/core";
import { hash, lit, type Ctx } from "./core";

/** Smooth value noise in 2D (periodic in x with period `px`). */
function noise(x: number, y: number, px: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (i: number, j: number) => hash(((i % px) + px) % px + j * 1013, seed);
  const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Ridged multi-octave noise: sharp crests and valleys, like eroded mountains. */
function ridged(x: number, y: number, px: number) {
  let sum = 0, amp = 0.55, f = 1;
  for (let o = 0; o < 5; o++) {
    const n = 1 - Math.abs(noise(x * f, y * f, px * f, 11 + o) * 2 - 1);
    sum += n * n * amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum;
}

/**
 * A ring of real 3D mountains on the horizon (the Chimgan side of Tashkent is the highest):
 * a heightfield between 300 m and 520 m out, with rock, scree, grassy foothills and snow caps
 * coloured by height and slope.
 */
export function buildMountains(ctx: Ctx, parent: Node, centre: { x: number; y: number; z: number }) {
  const SEG_A = ctx.lowPower ? 220 : 360; // around
  const SEG_R = ctx.lowPower ? 18 : 28; // outwards
  const R0 = 300, R1 = 520;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const heights: number[] = [];
  for (let j = 0; j <= SEG_R; j++) {
    const t = j / SEG_R;
    const r = R0 + (R1 - R0) * t;
    for (let i = 0; i <= SEG_A; i++) {
      const a = (i / SEG_A) * Math.PI * 2;
      // range height varies around the horizon: highest to the north-east
      const range = 0.55 + 0.45 * Math.max(0, Math.cos(a - 2.3)) + 0.15 * Math.sin(a * 3 + 1);
      const u = (i / SEG_A) * 24;
      const h = ridged(u, t * 4, 24) * 150 * range * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5 + 0.05) - 6;
      heights.push(h);
      pos.push(centre.x + Math.cos(a) * r, centre.y + h, centre.z + Math.sin(a) * r);
    }
  }
  const W = SEG_A + 1;
  for (let j = 0; j < SEG_R; j++)
    for (let i = 0; i < SEG_A; i++) {
      const p = j * W + i;
      idx.push(p, p + W, p + 1, p + 1, p + W, p + W + 1);
    }
  const vd = new VertexData();
  vd.positions = pos;
  vd.indices = idx;
  const nor: number[] = [];
  VertexData.ComputeNormals(pos, idx, nor);
  // colours: grassy foothills → rock and scree → snow above the snow line (less on steep faces)
  for (let k = 0; k < heights.length; k++) {
    const h = heights[k];
    const steep = 1 - Math.abs(nor[k * 3 + 1]);
    const n = hash(k, 7) * 0.08;
    let c: [number, number, number];
    if (h > 78 + n * 60 && steep < 0.55) c = [0.93, 0.95, 0.98];
    else if (h > 26) c = [0.36 + n, 0.34 + n, 0.33 + n];
    else c = [0.33 + n, 0.38 + n, 0.22 + n];
    // scree: lighter rock on steep faces
    if (steep > 0.6 && h > 20) c = [c[0] + 0.08, c[1] + 0.07, c[2] + 0.06];
    col.push(Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2), 1);
  }
  vd.normals = nor;
  vd.colors = col;
  const m = new Mesh("mountains3d", ctx.scene);
  vd.applyToMesh(m);
  m.parent = parent;
  m.isPickable = false;
  m.receiveShadows = false;
  const mat = lit(ctx, { color: "#ffffff", rough: 0.95 });
  m.material = mat;
  m.freezeWorldMatrix();
  return m;
}
