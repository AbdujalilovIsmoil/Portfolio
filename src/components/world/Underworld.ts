import {
  Color3,
  Color4,
  Matrix,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Quaternion,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
  type Node,
} from "@babylonjs/core";
import { asphaltTexture, concreteTexture, kerbTexture } from "./RaceTrack";
import { PIT_HALF, ROAD_HALF, SURFACE, TILE, TRACK, TRENCH_HALF, TUBE_R, UNDER, WALL_IN, heightAt } from "./Track";
import { canvasTexture, glowTexture, group, hash, lit, setAdditive, unlit, type Ctx } from "./core";

/*
 * Under the lawn: the cuttings down, the covered concrete tunnels (TUN) and the aquarium (SUB) — a
 * pool of sea water dug into the ground, its road running along the bottom inside a glass tube, as
 * in a public aquarium's walk-through tunnel: sand and rocks, coral and swaying kelp, sunbeams and
 * rising bubbles, shoals of fish, sharks and a manta going round — and mermaids.
 */

type U = (typeof TRACK.unders)[number];

/** A point of an underground piece: `a` metres along it, `lat` to the left of its centre line, `up` above its road. */
function at(u: U, a: number, lat: number, up: number): [number, number, number] {
  return [u.x + u.fx * a + u.fz * lat, heightAt(u.s0 + a) + up, u.z + u.fz * a - u.fx * lat];
}

/** A mesh from raw arrays (normals computed). */
function build(ctx: Ctx, name: string, parent: Node, pos: number[], idx: number[], uv: number[], colors?: number[]) {
  const m = new Mesh(name, ctx.scene);
  const vd = new VertexData();
  vd.positions = pos;
  vd.indices = idx;
  vd.uvs = uv;
  const nor: number[] = [];
  VertexData.ComputeNormals(pos, idx, nor);
  vd.normals = nor;
  if (colors) vd.colors = colors;
  vd.applyToMesh(m);
  m.parent = parent;
  m.isPickable = false;
  return m;
}

/** A strip along a piece from a0 to a1: `edge(a)` gives its two edges' [lat, up] (u across, v along, in metres / `uvScale`). */
function strip(ctx: Ctx, u: U, a0: number, a1: number, edge: (a: number) => [[number, number], [number, number]], uvScale = 1, step = 1) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const n = Math.max(1, Math.ceil((a1 - a0) / step));
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    const [p, q] = edge(a);
    pos.push(...at(u, a, p[0], p[1]), ...at(u, a, q[0], q[1]));
    const w = Math.hypot(q[0] - p[0], q[1] - p[1]);
    uv.push(0, a / uvScale, w / uvScale, a / uvScale);
    if (k < n) {
      const i = k * 2;
      idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  return { pos, uv, idx };
}

/** Several strips into one mesh. */
function strips(ctx: Ctx, name: string, parent: Node, parts: { pos: number[]; uv: number[]; idx: number[] }[]) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const p of parts) {
    const b = pos.length / 3;
    pos.push(...p.pos);
    uv.push(...p.uv);
    idx.push(...p.idx.map((i) => i + b));
  }
  return build(ctx, name, parent, pos, idx, uv);
}

// ------------------------------------------------------------------ textures

/** Rippled sand, pale and blue-tinged under the water. */
function sandTexture(ctx: Ctx) {
  const t = canvasTexture(ctx, 512, 512, (g) => {
    g.fillStyle = "#b9b08f";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 30000; i++) {
      const v = hash(i, 301);
      g.fillStyle = v > 0.5 ? `rgba(235,228,200,${0.25 * hash(i, 302)})` : `rgba(90,85,65,${0.25 * hash(i, 303)})`;
      g.fillRect(hash(i, 304) * 512, hash(i, 305) * 512, 1.5, 1.5);
    }
    // ripples the current has left
    g.strokeStyle = "rgba(120,112,86,0.28)";
    g.lineWidth = 3;
    for (let y = 0; y < 512; y += 18) {
      g.beginPath();
      for (let x = 0; x <= 512; x += 8) g.lineTo(x, y + Math.sin((x / 512) * Math.PI * 6 + y * 0.3) * 5);
      g.stroke();
    }
  });
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/** Caustics: the net of light a rippling surface throws on the bottom (tiles seamlessly). */
function causticTexture(ctx: Ctx) {
  const S = 256;
  return canvasTexture(ctx, S, S, (g) => {
    const img = g.createImageData(S, S);
    const TAU = Math.PI * 2;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const u = (x / S) * TAU, v = (y / S) * TAU;
        // warped sines (integer frequencies: it tiles), folded into thin bright ridges
        const w1 = Math.sin(3 * u + 1.7 * Math.sin(2 * v) + Math.sin(u + 3 * v));
        const w2 = Math.sin(4 * v + 1.5 * Math.sin(3 * u) - Math.sin(2 * u - v));
        const w3 = Math.sin(2 * u + 5 * v + 1.3 * Math.sin(4 * u));
        const ridge = Math.pow(1 - Math.min(Math.abs(w1), Math.abs(w2), Math.abs(w3)), 6);
        const k = (y * S + x) * 4;
        img.data[k] = 210;
        img.data[k + 1] = 245;
        img.data[k + 2] = 255;
        img.data[k + 3] = Math.min(255, ridge * 330);
      }
    g.putImageData(img, 0, 0);
  });
}

/** The pool's walls: deep blue water-worn rock, lighter towards the surface. */
function poolWallTexture(ctx: Ctx) {
  const t = canvasTexture(ctx, 256, 256, (g) => {
    const grd = g.createLinearGradient(0, 256, 0, 0);
    grd.addColorStop(0, "#0f3f4f");
    grd.addColorStop(0.6, "#1d6676");
    grd.addColorStop(1, "#3c94a2");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
      const r = 6 + hash(i, 311) * 26;
      g.fillStyle = `rgba(${10 + hash(i, 312) * 40},${50 + hash(i, 313) * 50},${60 + hash(i, 314) * 40},0.35)`;
      g.beginPath();
      g.ellipse(hash(i, 315) * 256, hash(i, 316) * 256, r, r * 0.6, hash(i, 317) * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/** The water's surface: soft ripples (a normal map; tiles). */
function rippleNormals(ctx: Ctx) {
  const S = 256;
  const t = canvasTexture(ctx, S, S, (g) => {
    const img = g.createImageData(S, S);
    const TAU = Math.PI * 2;
    const hgt = (x: number, y: number) => {
      const u = (x / S) * TAU, v = (y / S) * TAU;
      return Math.sin(3 * u + Math.sin(2 * v)) + 0.6 * Math.sin(5 * v + 2 * u) + 0.4 * Math.sin(7 * u - 3 * v);
    };
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
        const nx = -dx * 2, ny = -dy * 2, nz = 1, l = Math.hypot(nx, ny, nz);
        const k = (y * S + x) * 4;
        img.data[k] = ((nx / l) * 0.5 + 0.5) * 255;
        img.data[k + 1] = ((ny / l) * 0.5 + 0.5) * 255;
        img.data[k + 2] = ((nz / l) * 0.5 + 0.5) * 255;
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/** A sunbeam through the water: bright at the top, fading down, soft at its sides. */
function beamTexture(ctx: Ctx) {
  return canvasTexture(ctx, 64, 256, (g) => {
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, "rgba(220,250,255,0.9)");
    v.addColorStop(0.5, "rgba(180,235,255,0.35)");
    v.addColorStop(1, "rgba(150,220,255,0)");
    g.fillStyle = v;
    g.fillRect(0, 0, 64, 256);
    const h = g.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, "rgba(0,0,0,1)");
    h.addColorStop(0.5, "rgba(0,0,0,0)");
    h.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = h;
    g.fillRect(0, 0, 64, 256);
  });
}

/** A mermaid's tail: overlapping scales, teal shading to violet towards the fin, with a sheen. */
function scaleTexture(ctx: Ctx, from: string, to: string) {
  const t = canvasTexture(ctx, 256, 512, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, from);
    grd.addColorStop(1, to);
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 512);
    for (let row = 0; row < 32; row++)
      for (let col = 0; col < 17; col++) {
        const x = col * 16 + (row % 2) * 8, y = row * 16;
        const s = g.createRadialGradient(x, y + 4, 1, x, y + 2, 10);
        s.addColorStop(0, "rgba(255,255,255,0.35)");
        s.addColorStop(0.7, "rgba(255,255,255,0.05)");
        s.addColorStop(1, "rgba(0,0,0,0.3)");
        g.fillStyle = s;
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI);
        g.fill();
      }
  });
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

// ------------------------------------------------------------------ sea life: shapes

/** A fish facing +z, `len` long: an oval body, a forked tail and a dorsal fin, coloured by `paint` (x, y, z in body lengths). */
function fishMesh(ctx: Ctx, name: string, len: number, tall: number, thick: number, paint: (x: number, y: number, z: number) => [number, number, number]) {
  const body = MeshBuilder.CreateSphere(name, { diameterX: thick * len, diameterY: tall * len, diameterZ: len, segments: 12 }, ctx.scene);
  const H = tall * len;
  const fin = (pts: number[][]) => {
    const m = new Mesh("fin", ctx.scene);
    const vd = new VertexData();
    vd.positions = pts.flat();
    vd.indices = pts.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
    const nor: number[] = [];
    VertexData.ComputeNormals(vd.positions, vd.indices, nor);
    vd.normals = nor;
    vd.uvs = pts.map(() => [0, 0]).flat();
    vd.applyToMesh(m);
    return m;
  };
  const tail = fin([
    [0, 0, -0.4 * len],
    [0, 0.5 * H, -0.72 * len],
    [0, 0, -0.58 * len],
    [0, -0.5 * H, -0.72 * len],
  ]);
  const dorsal = fin([
    [0, 0.42 * H, 0.12 * len],
    [0, 0.72 * H, -0.08 * len],
    [0, 0.38 * H, -0.28 * len],
  ]);
  const m = Mesh.MergeMeshes([body, tail, dorsal], true, true)!;
  m.name = name;
  const pos = m.getVerticesData(VertexBuffer.PositionKind)!;
  const col: number[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    const [r, g2, b] = paint(pos[i] / len, pos[i + 1] / H, pos[i + 2] / len);
    col.push(r, g2, b, 1);
  }
  m.setVerticesData(VertexBuffer.ColorKind, col);
  const mat = new StandardMaterial(name, ctx.scene);
  mat.diffuseColor = Color3.White();
  mat.specularColor = new Color3(0.35, 0.35, 0.35);
  mat.specularPower = 48;
  mat.emissiveColor = new Color3(0.12, 0.14, 0.16);
  mat.backFaceCulling = false;
  m.material = mat;
  m.isPickable = false;
  return m;
}

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const mix = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** The kinds of fish (paints: z +½ is the nose, −½ the tail; y +½ the back). */
const SPECIES: { name: string; len: number; tall: number; thick: number; count: number; school?: boolean; speed: [number, number]; paint: (x: number, y: number, z: number) => [number, number, number] }[] = [
  {
    // clownfish: orange, three white bands edged in black
    name: "clownfish",
    len: 0.5,
    tall: 0.5,
    thick: 0.3,
    count: 22,
    speed: [1.2, 2],
    paint: (_x, _y, z) => {
      const bands = [0.25, 0.02, -0.3];
      for (const c of bands) {
        const d = Math.abs(z - c);
        if (d < 0.05) return hex("#ffffff");
        if (d < 0.075) return hex("#111111");
      }
      return z < -0.45 ? hex("#1a1a1a") : hex("#ff7a12");
    },
  },
  {
    // blue tang: royal blue, a dark sweep along the back, a yellow tail
    name: "bluetang",
    len: 0.65,
    tall: 0.55,
    thick: 0.22,
    count: 24,
    speed: [1.6, 2.6],
    paint: (_x, y, z) => (z < -0.4 ? hex("#ffd21f") : y > 0.15 && z < 0.25 && z > -0.3 ? hex("#0b1640") : mix(hex("#1f5fff"), hex("#5aa8ff"), Math.max(0, -y))),
  },
  {
    // yellow tang: all bright yellow
    name: "yellowtang",
    len: 0.55,
    tall: 0.7,
    thick: 0.2,
    count: 24,
    speed: [1.4, 2.2],
    paint: (_x, y) => mix(hex("#ffd400"), hex("#fff07a"), Math.max(0, -y)),
  },
  {
    // angelfish: tall, silver with black upright stripes
    name: "angelfish",
    len: 0.55,
    tall: 1,
    thick: 0.16,
    count: 14,
    speed: [1, 1.6],
    paint: (_x, _y, z) => (Math.abs(((z + 1) * 6) % 1 - 0.5) < 0.12 ? hex("#151515") : hex("#d9dde2")),
  },
  {
    // sardines: a shoal, dark blue-green backs, silver bellies
    name: "sardine",
    len: 0.32,
    tall: 0.24,
    thick: 0.16,
    count: 110,
    school: true,
    speed: [3, 3],
    paint: (_x, y) => (y > 0.1 ? hex("#2a5a6e") : mix(hex("#c9d6de"), hex("#ffffff"), Math.max(0, -y))),
  },
  {
    // a second shoal: silversides, bright and quick
    name: "silverside",
    len: 0.26,
    tall: 0.2,
    thick: 0.14,
    count: 90,
    school: true,
    speed: [3.6, 3.6],
    paint: (_x, y) => (y > 0.15 ? hex("#5f8fa3") : hex("#eef4f7")),
  },
  {
    // reef sharks: grey above, white beneath, a black-tipped fin
    name: "shark",
    len: 3.2,
    tall: 0.24,
    thick: 0.22,
    count: 3,
    speed: [2.2, 2.8],
    paint: (_x, y, z) => (y > 0.55 && z < 0 ? hex("#1d1f22") : y > -0.05 ? hex("#6d7780") : hex("#e9ecef")),
  },
];

/** A path round the pool: position and heading at time t (m, local: a along the piece, lat across, y up from the road). */
type Path = (t: number) => [number, number, number];

// ------------------------------------------------------------------ the aquarium

function buildAquarium(ctx: Ctx, root: Node, u: U) {
  const P = UNDER.SUB;
  const A1 = P.down * TILE, A2 = (P.down + P.flat) * TILE;
  const road = -P.depth * TILE; // the bottom road, below the lawn
  const seabed = road - 1.2;
  const surface = -0.9;
  const top = 0.35;
  const mid = (A1 + A2) / 2;
  const tubeTop = road + TUBE_R;
  const local = (a: number, lat: number, y: number) => new Vector3(u.x + u.fx * a + u.fz * lat, y, u.z + u.fz * a - u.fx * lat);
  const heading = Math.atan2(u.fx, u.fz);

  // ---- the pool: rock walls all round (an arch left open in each end for the tube) and the sand
  const wallMat = lit(ctx, { rough: 0.95, emissive: "#0b3542", ei: 0.6, double: true });
  wallMat.albedoTexture = poolWallTexture(ctx);
  {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const quad = (p: number[][], w: number, h0: number, h1: number) => {
      const b = pos.length / 3;
      pos.push(...p.flat());
      uv.push(0, h0 / 12, w / 12, h0 / 12, w / 12, h1 / 12, 0, h1 / 12);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    // the long sides
    for (const side of [-1, 1]) {
      const l = side * PIT_HALF;
      const p0 = local(A1, l, seabed), p1 = local(A2, l, seabed), p2 = local(A2, l, top), p3 = local(A1, l, top);
      quad([p0, p1, p2, p3].map((v) => [v.x, v.y, v.z]), A2 - A1, 0, top - seabed);
    }
    // the ends: strips across, each from the arch (or the sand) up to the lip
    for (const a of [A1, A2])
      for (let l = -PIT_HALF; l < PIT_HALF - 1e-6; l += 0.5) {
        const bottom = (x: number) => (Math.abs(x) < TUBE_R ? road + Math.sqrt(TUBE_R * TUBE_R - x * x) : seabed);
        const pa = local(a, l, bottom(l)), pb = local(a, l + 0.5, bottom(l + 0.5)), pc = local(a, l + 0.5, top), pd = local(a, l, top);
        quad([pa, pb, pc, pd].map((v) => [v.x, v.y, v.z]), 0.5, 0, top - seabed);
      }
    build(ctx, "poolWalls", root, pos, idx, uv).material = wallMat;
  }
  // a concrete kerb round the top
  {
    const kerbMat = lit(ctx, { rough: 0.9 });
    kerbMat.albedoTexture = concreteTexture(ctx);
    for (const side of [-1, 1]) {
      const b = MeshBuilder.CreateBox("poolKerb", { width: 1.2, height: 0.5, depth: A2 - A1 + 2.4 }, ctx.scene);
      const c = local(mid, side * (PIT_HALF + 0.6), top - 0.2);
      b.position.copyFrom(c);
      b.rotation.y = heading;
      b.material = kerbMat;
      b.parent = root;
      b.isPickable = false;
    }
    for (const a of [A1 - 0.6, A2 + 0.6])
      for (const side of [-1, 1]) {
        // (the ends: from the cutting's wall out to the corner)
        const w = PIT_HALF - TRENCH_HALF + 1.2;
        const b = MeshBuilder.CreateBox("poolKerb", { width: w, height: 0.5, depth: 1.2 }, ctx.scene);
        b.position.copyFrom(local(a, side * (TRENCH_HALF + w / 2 - 0.6), top - 0.2));
        b.rotation.y = heading;
        b.material = kerbMat;
        b.parent = root;
        b.isPickable = false;
      }
  }
  // the sand: dunes, flat under the tube
  // (two-sided: which way its triangles wind depends on which way the piece runs)
  const sandMat = lit(ctx, { rough: 1, emissive: "#0f3a46", ei: 0.4, double: true, color: "#8fb4b6" });
  sandMat.albedoTexture = sandTexture(ctx);
  const dune = (a: number, l: number) => {
    const out = Math.max(0, Math.abs(l) - TUBE_R - 1);
    return seabed + Math.min(1, out / 6) * (0.6 * Math.sin(a * 0.13 + l * 0.07) + 0.4 * Math.sin(a * 0.31 - l * 0.19) + 0.5);
  };
  {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const NA = Math.ceil((A2 - A1) / 2), NL = Math.ceil((2 * PIT_HALF) / 2);
    for (let i = 0; i <= NA; i++)
      for (let j = 0; j <= NL; j++) {
        const a = A1 + ((A2 - A1) * i) / NA, l = -PIT_HALF + (2 * PIT_HALF * j) / NL;
        const p = local(a, l, dune(a, l));
        pos.push(p.x, p.y, p.z);
        uv.push(a / 8, l / 8);
        if (i < NA && j < NL) {
          const k = i * (NL + 1) + j;
          idx.push(k, k + NL + 1, k + 1, k + 1, k + NL + 1, k + NL + 2);
        }
      }
    const sand = build(ctx, "seabed", root, pos, idx, uv);
    sand.material = sandMat;
    sand.receiveShadows = true;
    // and the light dancing on it: two caustic nets sliding past each other
    const caustic = causticTexture(ctx);
    const cl = [0, 1].map((k) => {
      const m = build(ctx, "caustics", root, pos.map((v, i) => (i % 3 === 1 ? v + 0.04 + k * 0.02 : v)), idx, uv.map((v) => v * (k ? 0.8 : 1.1)));
      const t = caustic.clone();
      const mat = unlit(ctx, { map: t, additive: true, depthWrite: false, double: true });
      setAdditive(mat, "#9fe8ff", 0.35);
      m.material = mat;
      return t;
    });
    ctx.onFrame((_, time) => {
      cl[0].uOffset = time * 0.03;
      cl[0].vOffset = time * 0.017;
      cl[1].uOffset = -time * 0.021;
      cl[1].vOffset = time * 0.026;
    });
  }

  // ---- the water's surface: from above, blue and see-through, with the sky's glint; from below, a bright rippling ceiling
  {
    const water = MeshBuilder.CreateGround("waterSurface", { width: 2 * PIT_HALF, height: A2 - A1 }, ctx.scene);
    water.position.copyFrom(local(mid, 0, surface));
    water.rotation.y = heading;
    const m = new StandardMaterial("water", ctx.scene);
    m.diffuseColor = new Color3(0.08, 0.42, 0.5);
    m.specularColor = new Color3(0.9, 0.95, 1);
    m.specularPower = 180;
    m.emissiveColor = new Color3(0.03, 0.16, 0.2);
    m.alpha = 0.55;
    m.backFaceCulling = false;
    const n = rippleNormals(ctx);
    n.uScale = 6;
    n.vScale = 10;
    m.bumpTexture = n;
    water.material = m;
    water.parent = root;
    water.isPickable = false;
    ctx.onFrame((_, time) => {
      n.uOffset = time * 0.02;
      n.vOffset = time * 0.012;
    });
  }

  // ---- the walk-through tube: acrylic, arched steel frames every 4 m, a steel base, light strips
  {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const SEG = 28, NA = Math.ceil((A2 - A1) / 2);
    for (let i = 0; i <= NA; i++)
      for (let j = 0; j <= SEG; j++) {
        const a = A1 + ((A2 - A1) * i) / NA, th = (Math.PI * j) / SEG;
        const p = local(a, TUBE_R * Math.cos(th), road + TUBE_R * Math.sin(th));
        pos.push(p.x, p.y, p.z);
        uv.push(j / SEG, a / 10);
        if (i < NA && j < SEG) {
          const k = i * (SEG + 1) + j;
          idx.push(k, k + SEG + 1, k + 1, k + 1, k + SEG + 1, k + SEG + 2);
        }
      }
    const glass = build(ctx, "tubeGlass", root, pos, idx, uv);
    const gm = new StandardMaterial("tubeGlass", ctx.scene);
    gm.diffuseColor = new Color3(0.55, 0.85, 0.92);
    gm.specularColor = new Color3(0.8, 0.9, 1);
    gm.specularPower = 96;
    gm.emissiveColor = new Color3(0.02, 0.08, 0.1);
    gm.alpha = 0.13;
    gm.backFaceCulling = false;
    glass.material = gm;
    const steel = lit(ctx, { color: "#2b3138", metal: 0.85, rough: 0.35 });
    for (let a = A1 + 0.3; a <= A2 - 0.3; a += 4) {
      const path: Vector3[] = [];
      for (let j = 0; j <= 24; j++) {
        const th = (Math.PI * j) / 24;
        path.push(local(a, (TUBE_R + 0.05) * Math.cos(th), road + (TUBE_R + 0.05) * Math.sin(th)));
      }
      const rib = MeshBuilder.CreateTube("tubeRib", { path, radius: 0.16, tessellation: 8 }, ctx.scene);
      rib.material = steel;
      rib.parent = root;
      rib.isPickable = false;
      ctx.shadow?.addShadowCaster(rib, false);
    }
    // the steel spine along the top and the light strips along the foot of the glass
    const spine = MeshBuilder.CreateBox("tubeSpine", { width: 0.5, height: 0.3, depth: A2 - A1 }, ctx.scene);
    spine.position.copyFrom(local(mid, 0, tubeTop + 0.1));
    spine.rotation.y = heading;
    spine.material = steel;
    spine.parent = root;
    const led = unlit(ctx, { color: "#59e6ff" });
    for (const side of [-1, 1]) {
      const s = MeshBuilder.CreateBox("tubeLed", { width: 0.12, height: 0.12, depth: A2 - A1 }, ctx.scene);
      s.position.copyFrom(local(mid, side * (WALL_IN + 0.9), road + 1.7));
      s.rotation.y = heading;
      s.material = led;
      s.parent = root;
      s.isPickable = false;
    }
  }

  // ---- the water itself: seen through more of it, things go blue-green and dim. Veils of tinted
  // water between the tube and the far walls (and across the ends) do that — the further out a fish
  // or a rock is, the more of them it is seen through.
  {
    const veil = new StandardMaterial("waterVeil", ctx.scene);
    veil.diffuseColor = Color3.Black();
    veil.specularColor = Color3.Black();
    veil.emissiveColor = new Color3(0.06, 0.3, 0.36);
    veil.alpha = 0.2;
    veil.backFaceCulling = false;
    veil.disableDepthWrite = true;
    const h = surface - seabed;
    const sheet = (a: number, l: number, w: number, yaw: number) => {
      const m = MeshBuilder.CreatePlane("waterVeil", { width: w, height: h }, ctx.scene);
      m.position.copyFrom(local(a, l, (surface + seabed) / 2));
      m.rotation.y = heading + yaw;
      m.material = veil;
      m.parent = root;
      m.isPickable = false;
    };
    for (const l of [TUBE_R + 5, TUBE_R + 12, PIT_HALF - 4]) for (const sd of [-1, 1]) sheet(mid, sd * l, A2 - A1, Math.PI / 2);
    for (const a of [A1 + 14, A1 + 30, A2 - 30, A2 - 14]) sheet(a, 0, 2 * PIT_HALF, 0);
  }

  // ---- sunbeams slanting down through the water
  {
    const mat = unlit(ctx, { map: beamTexture(ctx), additive: true, depthWrite: false, double: true });
    const beams: { m: Mesh; k: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const a = A1 + 6 + hash(i, 401) * (A2 - A1 - 12), l = (hash(i, 402) - 0.5) * 2 * (PIT_HALF - 4);
      const len = surface - seabed;
      const m = MeshBuilder.CreatePlane("sunbeam", { width: 2.5 + hash(i, 403) * 3, height: len }, ctx.scene);
      m.position.copyFrom(local(a, l, (surface + seabed) / 2));
      m.rotation.z = 0.18;
      m.billboardMode = Mesh.BILLBOARDMODE_Y;
      m.material = mat;
      m.parent = root;
      m.isPickable = false;
      beams.push({ m, k: hash(i, 404) * 6 });
    }
    ctx.onFrame((_, time) => setAdditive(mat, "#bdf3ff", 0.22 + 0.06 * Math.sin(time * 0.7)));
  }

  // ---- rocks, coral, sea fans, anemones and starfish on the sand (clear of the tube)
  const spots: [number, number][] = [];
  for (let i = 0; spots.length < 70 && i < 600; i++) {
    const a = A1 + 3 + hash(i, 411) * (A2 - A1 - 6);
    const side = hash(i, 412) < 0.5 ? -1 : 1;
    const l = side * (TUBE_R + 2.5 + hash(i, 413) * (PIT_HALF - TUBE_R - 4));
    if (spots.every(([pa, pl]) => Math.hypot(pa - a, pl - l) > 3.2)) spots.push([a, l]);
  }
  const reefMat = (name: string) => {
    const m = new StandardMaterial(name, ctx.scene);
    m.diffuseColor = Color3.White();
    m.specularColor = new Color3(0.15, 0.15, 0.15);
    m.emissiveColor = new Color3(0.1, 0.12, 0.14);
    return m;
  };
  const place = (mesh: Mesh, list: { a: number; l: number; s: number; yaw: number; c: string; lift?: number }[]) => {
    const buf = new Float32Array(list.length * 16), cols = new Float32Array(list.length * 4);
    const m = new Matrix(), q = new Quaternion();
    list.forEach((it, i) => {
      Quaternion.RotationYawPitchRollToRef(it.yaw, 0, 0, q);
      const p = local(it.a, it.l, dune(it.a, it.l) + (it.lift ?? 0));
      Matrix.ComposeToRef(new Vector3(it.s, it.s, it.s), q, p, m);
      m.copyToArray(buf, i * 16);
      const [r, g, b] = hex(it.c);
      cols.set([r, g, b, 1], i * 4);
    });
    mesh.thinInstanceSetBuffer("matrix", buf, 16, true);
    mesh.thinInstanceSetBuffer("color", cols, 4, true);
    mesh.parent = root;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
  };
  // rocks: knobbly boulders
  {
    const rock = MeshBuilder.CreateIcoSphere("rock", { radius: 1, subdivisions: 2, flat: true }, ctx.scene);
    const p = rock.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < p.length; i += 3) {
      const k = Math.round(p[i] * 31 + p[i + 1] * 17 + p[i + 2] * 13);
      const r = 0.75 + hash(k, 421) * 0.45;
      p[i] *= r * 1.2;
      p[i + 1] *= r * 0.7;
      p[i + 2] *= r;
    }
    rock.setVerticesData(VertexBuffer.PositionKind, p);
    rock.createNormals(false);
    rock.material = reefMat("rock");
    place(
      rock,
      spots.slice(0, 22).map(([a, l], i) => ({ a, l, s: 0.9 + hash(i, 422) * 1.8, yaw: hash(i, 423) * 6.28, c: ["#9aa39e", "#a39887", "#8c9a9b"][i % 3], lift: 0.2 }))
    );
  }
  // brain coral: squat bumpy domes
  {
    const m = MeshBuilder.CreateSphere("brainCoral", { diameter: 1.6, segments: 14 }, ctx.scene);
    const p = m.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < p.length; i += 3) {
      const bump = 1 + 0.07 * Math.sin(p[i] * 14) * Math.sin(p[i + 2] * 14);
      p[i] *= bump;
      p[i + 1] = Math.max(-0.1, p[i + 1] * 0.55 * bump);
      p[i + 2] *= bump;
    }
    m.setVerticesData(VertexBuffer.PositionKind, p);
    m.createNormals(false);
    m.material = reefMat("brainCoral");
    place(
      m,
      spots.slice(22, 36).map(([a, l], i) => ({ a, l, s: 0.6 + hash(i, 431) * 0.8, yaw: hash(i, 432) * 6.28, c: ["#e88a5b", "#c9a14a", "#d06a9a", "#9fc46a"][i % 4] }))
    );
  }
  // branching coral: a little tree of tapering stems
  {
    const parts: Mesh[] = [];
    const branch = (x: number, y: number, z: number, dx: number, dy: number, dz: number, r: number, depth: number) => {
      const len = 0.55 * Math.pow(0.8, 3 - depth);
      const ex = x + dx * len, ey = y + dy * len, ez = z + dz * len;
      const c = MeshBuilder.CreateTube("branch", { path: [new Vector3(x, y, z), new Vector3(ex, ey, ez)], radiusFunction: (i) => (i ? r * 0.65 : r), tessellation: 6, cap: Mesh.CAP_END }, ctx.scene);
      parts.push(c);
      if (depth > 0)
        for (let k = 0; k < 3; k++) {
          const ang = (k / 3) * Math.PI * 2 + depth;
          const ndx = dx + Math.cos(ang) * 0.6, ndz = dz + Math.sin(ang) * 0.6, ndy = dy + 0.2;
          const l = Math.hypot(ndx, ndy, ndz);
          branch(ex, ey, ez, ndx / l, ndy / l, ndz / l, r * 0.65, depth - 1);
        }
    };
    branch(0, 0, 0, 0, 1, 0, 0.09, 3);
    const tree = Mesh.MergeMeshes(parts, true, true)!;
    tree.material = reefMat("branchCoral");
    place(
      tree,
      spots.slice(36, 52).map(([a, l], i) => ({ a, l, s: 0.9 + hash(i, 441) * 0.9, yaw: hash(i, 442) * 6.28, c: ["#ff6f61", "#ffb347", "#c780ff", "#ff8fc1"][i % 4] }))
    );
  }
  // sea fans: upright lace discs
  {
    const fanTex = canvasTexture(ctx, 128, 128, (g) => {
      g.clearRect(0, 0, 128, 128);
      g.strokeStyle = "rgba(255,255,255,1)";
      g.lineWidth = 2;
      for (let i = 0; i < 28; i++) {
        g.beginPath();
        g.moveTo(64, 128);
        const ang = Math.PI * (0.1 + 0.8 * (i / 27));
        g.quadraticCurveTo(64 - Math.cos(ang) * 40, 128 - Math.sin(ang) * 40, 64 - Math.cos(ang) * 62, 128 - Math.sin(ang) * 120);
        g.stroke();
      }
      for (let r = 20; r < 128; r += 10) {
        g.beginPath();
        g.arc(64, 128, r, Math.PI, 0);
        g.stroke();
      }
    });
    const fan = MeshBuilder.CreatePlane("seaFan", { width: 2, height: 2 }, ctx.scene);
    fan.bakeTransformIntoVertices(Matrix.Translation(0, 1, 0));
    const fm = reefMat("seaFan");
    fm.diffuseTexture = fanTex;
    fanTex.hasAlpha = true;
    fm.useAlphaFromDiffuseTexture = true;
    fm.backFaceCulling = false;
    fan.material = fm;
    place(
      fan,
      spots.slice(52, 60).map(([a, l], i) => ({ a, l, s: 0.8 + hash(i, 451) * 0.6, yaw: hash(i, 452) * 6.28, c: ["#b04dff", "#ff5a8a", "#ffb02e"][i % 3] }))
    );
  }
  // anemones: a tuft of soft tentacles; starfish
  {
    const parts: Mesh[] = [];
    for (let k = 0; k < 18; k++) {
      const ang = (k / 18) * Math.PI * 2, r = 0.12 + (k % 3) * 0.05;
      const t = MeshBuilder.CreateCylinder("tentacle", { height: 0.5, diameterTop: 0.03, diameterBottom: 0.07, tessellation: 5 }, ctx.scene);
      t.position.set(Math.cos(ang) * r, 0.25, Math.sin(ang) * r);
      t.rotation.set(Math.sin(ang) * 0.5, 0, -Math.cos(ang) * 0.5);
      parts.push(t);
    }
    const anemone = Mesh.MergeMeshes(parts, true, true)!;
    anemone.material = reefMat("anemone");
    place(
      anemone,
      spots.slice(60, 70).map(([a, l], i) => ({ a, l, s: 1 + hash(i, 461) * 0.8, yaw: 0, c: ["#ff6fb5", "#9cff6f", "#ffe36f"][i % 3] }))
    );
    const star = new Mesh("starfish", ctx.scene);
    {
      const pos: number[] = [0, 0.05, 0], idx: number[] = [];
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2, r = k % 2 ? 0.08 : 0.25;
        pos.push(Math.cos(ang) * r, 0.02, Math.sin(ang) * r);
        idx.push(0, 1 + k, 1 + ((k + 1) % 10));
      }
      const vd = new VertexData();
      vd.positions = pos;
      vd.indices = idx;
      const nor: number[] = [];
      VertexData.ComputeNormals(pos, idx, nor);
      vd.normals = nor;
      vd.applyToMesh(star);
    }
    const sm = reefMat("starfish");
    sm.backFaceCulling = false;
    star.material = sm;
    place(
      star,
      Array.from({ length: 16 }, (_, i) => {
        const a = A1 + 4 + hash(i, 471) * (A2 - A1 - 8), l = (hash(i, 472) < 0.5 ? -1 : 1) * (TUBE_R + 2 + hash(i, 473) * 12);
        return { a, l, s: 1 + hash(i, 474) * 0.6, yaw: hash(i, 475) * 6.28, c: ["#ff7a2e", "#e8323c", "#ffb02e"][i % 3] };
      })
    );
  }

  // ---- kelp: tall fronds from the sand, swaying in the swell (one mesh, its vertices moved)
  const KELP = 34, KS = 12;
  const kelp: { a: number; l: number; h: number; ph: number }[] = [];
  for (let i = 0; kelp.length < KELP && i < 400; i++) {
    const a = A1 + 2 + hash(i, 481) * (A2 - A1 - 4);
    const nearWall = hash(i, 482) < 0.7;
    const side = hash(i, 483) < 0.5 ? -1 : 1;
    const l = side * (nearWall ? PIT_HALF - 1.5 - hash(i, 484) * 6 : TUBE_R + 4 + hash(i, 485) * 10);
    kelp.push({ a, l, h: 8 + hash(i, 486) * (surface - seabed - 10), ph: hash(i, 487) * 6.28 });
  }
  const kelpMesh = new Mesh("kelp", ctx.scene);
  const kelpPos = new Float32Array(KELP * (KS + 1) * 2 * 3);
  {
    const idx: number[] = [], uv: number[] = [];
    for (let i = 0; i < KELP; i++)
      for (let k = 0; k <= KS; k++) {
        const b = (i * (KS + 1) + k) * 2;
        uv.push(0, k / KS, 1, k / KS);
        if (k < KS) idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    const vd = new VertexData();
    vd.positions = kelpPos;
    vd.indices = idx;
    vd.uvs = uv;
    vd.normals = new Float32Array(kelpPos.length).fill(0).map((_, j) => (j % 3 === 0 ? 1 : 0));
    vd.applyToMesh(kelpMesh, true);
    const kt = canvasTexture(ctx, 64, 256, (g) => {
      g.clearRect(0, 0, 64, 256);
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, "#9a8f2a");
      grd.addColorStop(1, "#3f5f1f");
      g.fillStyle = grd;
      // a blade: wide in the middle, ruffled edges
      g.beginPath();
      g.moveTo(32, 0);
      for (let y = 0; y <= 256; y += 8) g.lineTo(32 + (14 + 6 * Math.sin(y * 0.3)) * Math.sin((y / 256) * Math.PI + 0.3), y);
      for (let y = 256; y >= 0; y -= 8) g.lineTo(32 - (14 + 6 * Math.sin(y * 0.37)) * Math.sin((y / 256) * Math.PI + 0.3), y);
      g.fill();
      g.strokeStyle = "rgba(40,60,10,0.5)";
      g.beginPath();
      g.moveTo(32, 0);
      g.lineTo(32, 256);
      g.stroke();
    });
    kt.hasAlpha = true;
    const km = new StandardMaterial("kelp", ctx.scene);
    km.diffuseTexture = kt;
    km.useAlphaFromDiffuseTexture = true;
    km.backFaceCulling = false;
    km.specularColor = new Color3(0.1, 0.1, 0.1);
    km.emissiveColor = new Color3(0.08, 0.12, 0.05);
    kelpMesh.material = km;
    kelpMesh.parent = root;
    kelpMesh.isPickable = false;
    kelpMesh.alwaysSelectAsActiveMesh = true;
  }

  // ---- bubbles rising from the sand
  {
    const ps = new ParticleSystem("bubbles", 400, ctx.scene);
    ps.particleTexture = glowTexture(ctx);
    ps.updateSpeed = 1 / 60;
    const vents = Array.from({ length: 6 }, (_, i) => local(A1 + 8 + hash(i, 491) * (A2 - A1 - 16), (hash(i, 492) < 0.5 ? -1 : 1) * (TUBE_R + 3 + hash(i, 493) * 12), seabed + 0.5));
    let vent = 0;
    ps.emitter = Vector3.Zero();
    ps.startPositionFunction = (_m, p) => {
      const v = vents[vent++ % vents.length];
      p.set(v.x + (Math.random() - 0.5) * 0.6, v.y, v.z + (Math.random() - 0.5) * 0.6);
    };
    ps.direction1 = new Vector3(-0.15, 1, -0.15);
    ps.direction2 = new Vector3(0.15, 1, 0.15);
    ps.minEmitPower = 1.2;
    ps.maxEmitPower = 2.2;
    ps.minLifeTime = (surface - seabed) / 2.2;
    ps.maxLifeTime = (surface - seabed) / 1.2;
    ps.minSize = 0.06;
    ps.maxSize = 0.2;
    ps.color1 = new Color4(0.85, 0.97, 1, 0.75);
    ps.color2 = new Color4(0.7, 0.92, 1, 0.55);
    ps.colorDead = new Color4(0.8, 0.95, 1, 0.3);
    ps.emitRate = 26;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
  }

  // ---- the fish: each kind one mesh drawn many times, swimming round the pool (and over the tube)
  /** clear of the glass by `m` metres (the animal's own reach: a mermaid is long), and in the water */
  const keepOut = (p: [number, number, number], m = 1.2) => {
    const [a, l, y] = p;
    const r = Math.hypot(l, y - road);
    if (r < TUBE_R + m) {
      const k = (TUBE_R + m) / Math.max(r, 0.01);
      p[1] = l * k;
      p[2] = road + (y - road) * k;
    }
    p[0] = Math.min(A2 - m - 1, Math.max(A1 + m + 1, a));
    p[1] = Math.min(PIT_HALF - m - 0.5, Math.max(-PIT_HALF + m + 0.5, p[1]));
    p[2] = Math.min(surface - 0.8, Math.max(seabed + Math.min(m, 2), p[2]));
    return p;
  };
  /** a loop round the pool: an oval (some cross over the tube), bobbing up and down */
  const loop = (seed: number, speed: number, m = 1.2): Path => {
    // some swim right by the glass — a third of them, round and over the tube, close enough to see well
    if (hash(seed, 530) < 0.33) {
      const ca = mid + (hash(seed, 531) - 0.5) * (A2 - A1) * 0.5;
      const ra = 10 + hash(seed, 532) * ((A2 - A1) / 2 - 14);
      const r = TUBE_R + m + 0.4 + hash(seed, 533) * 2.5;
      const th0 = 0.25 + hash(seed, 534) * (Math.PI - 0.5);
      const dir = hash(seed, 535) < 0.5 ? -1 : 1;
      const ph = hash(seed, 536) * 6.28;
      const w = (dir * speed) / ra;
      return (t) => {
        const th = th0 + Math.sin(t * 0.13 + ph) * 0.5;
        return keepOut([ca + Math.cos(w * t + ph) * ra, r * Math.cos(th), road + r * Math.sin(th)], m);
      };
    }
    const over = hash(seed, 501) < 0.45;
    const ca = mid + (hash(seed, 502) - 0.5) * (A2 - A1) * 0.4;
    const ra = 12 + hash(seed, 503) * ((A2 - A1) / 2 - 16);
    const side = hash(seed, 504) < 0.5 ? -1 : 1;
    const cl = over ? 0 : side * (TUBE_R + m + 3 + hash(seed, 505) * (PIT_HALF - TUBE_R - 2 * m - 7));
    const rl = over ? 10 + hash(seed, 506) * (PIT_HALF - 13) : 2 + hash(seed, 507) * 3;
    const y0 = over ? tubeTop + m + 0.4 + hash(seed, 508) * Math.max(0, surface - tubeTop - m - 1.6) : seabed + 1.5 + hash(seed, 509) * (surface - seabed - 4);
    const dir = hash(seed, 510) < 0.5 ? -1 : 1;
    const ph = hash(seed, 511) * 6.28;
    const w = (dir * speed) / Math.max(ra, rl);
    return (t) => keepOut([ca + Math.cos(w * t + ph) * ra, cl + Math.sin(w * t + ph) * rl, y0 + Math.sin(t * 0.5 + ph) * 0.8], m);
  };
  const fishM = new Matrix(), fishQ = new Quaternion(), fishS = new Vector3(1, 1, 1), fishP = new Vector3();
  const schools = SPECIES.map((sp, si) => {
    const mesh = fishMesh(ctx, sp.name, sp.len, sp.tall, sp.thick, sp.paint);
    mesh.parent = root;
    mesh.alwaysSelectAsActiveMesh = true;
    const buf = new Float32Array(sp.count * 16);
    mesh.thinInstanceSetBuffer("matrix", buf, 16, false);
    // (each kept clear of the glass by its own length: a shark by more than a sardine)
    const reach = Math.max(1.2, sp.len * 0.7);
    const lead = loop(si * 37 + 5, sp.speed[0], reach + 3);
    const fish = Array.from({ length: sp.count }, (_, i) => ({
      path: sp.school ? lead : loop(si * 101 + i * 7 + 1, sp.speed[0] + hash(si * 31 + i, 521) * (sp.speed[1] - sp.speed[0]), reach),
      // a shoal: each fish at its place in the ball round the leader
      off: sp.school ? [(hash(i, 522) - 0.5) * 7, (hash(i, 523) - 0.5) * 4, (hash(i, 524) - 0.5) * 3] : [0, 0, 0],
      ph: hash(si * 13 + i, 525) * 6.28,
      lag: sp.school ? hash(i, 526) * 0.6 : 0,
    }));
    return { sp, mesh, buf, fish };
  });

  // ---- a manta ray: a wide flat body whose wings beat slowly
  const manta = new TransformNode("manta", ctx.scene);
  manta.parent = root;
  const mantaWings: TransformNode[] = [];
  {
    const mat = new StandardMaterial("manta", ctx.scene);
    mat.diffuseColor = new Color3(0.12, 0.13, 0.15);
    mat.specularColor = new Color3(0.2, 0.2, 0.2);
    mat.emissiveColor = new Color3(0.05, 0.06, 0.08);
    mat.backFaceCulling = false;
    const body = MeshBuilder.CreateSphere("mantaBody", { diameterX: 1.4, diameterY: 0.35, diameterZ: 2.2, segments: 10 }, ctx.scene);
    body.material = mat;
    body.parent = manta;
    for (const side of [-1, 1]) {
      const hinge = new TransformNode("mantaHinge", ctx.scene);
      hinge.parent = manta;
      hinge.position.x = side * 0.6;
      const w = new Mesh("mantaWing", ctx.scene);
      const vd = new VertexData();
      vd.positions = [0, 0, 0.9, side * 2.8, 0, -0.3, 0, 0, -0.9, side * 0.4, 0, 0.2];
      vd.indices = [0, 1, 3, 3, 1, 2];
      const nor: number[] = [];
      VertexData.ComputeNormals(vd.positions, vd.indices, nor);
      vd.normals = nor;
      vd.applyToMesh(w);
      w.material = mat;
      w.parent = hinge;
      mantaWings.push(hinge);
    }
    const tail = MeshBuilder.CreateCylinder("mantaTail", { height: 2.2, diameterTop: 0.02, diameterBottom: 0.1, tessellation: 5 }, ctx.scene);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = -2;
    tail.material = mat;
    tail.parent = manta;
  }
  const mantaPath = loop(909, 2.4, 3.6);

  // ---- mermaids
  const mermaids = [
    { hair: "#8a2b16", tail: ["#1fb5a5", "#6a3bd1"], path: loop(611, 1.8, 2.8) },
    { hair: "#d9a84a", tail: ["#2a8cff", "#14c7a8"], path: loop(722, 1.6, 2.8) },
    { hair: "#1d1410", tail: ["#c14bd6", "#2a5bd8"], path: loop(833, 1.7, 2.8) },
  ].map((o, i) => ({ ...buildMermaid(ctx, root, o.hair, o.tail as [string, string], i), path: o.path }));

  // ---- move it all (only near enough to see)
  const toWorld = (p: [number, number, number]) => local(p[0], p[1], p[2]);
  const look = (path: Path, t: number, dt = 0.2) => {
    const p = path(t), q = path(t + dt);
    const w0 = toWorld(p), w1 = toWorld(q);
    const dx = w1.x - w0.x, dy = w1.y - w0.y, dz = w1.z - w0.z;
    return { pos: w0, yaw: Math.atan2(dx, dz), pitch: -Math.atan2(dy, Math.hypot(dx, dz)) };
  };
  const centre = local(mid, 0, road);
  ctx.onFrame((dt, time) => {
    if (Vector3.Distance(ctx.player, centre) > 260) return;
    // fish
    for (const s of schools) {
      s.fish.forEach((f, i) => {
        const o = look(f.path, time - f.lag);
        const wig = Math.sin(time * (s.sp.len > 2 ? 2.2 : 9) + f.ph) * (s.sp.len > 2 ? 0.08 : 0.14);
        // (a shoal: the offset turned with the leader)
        const c = Math.cos(o.yaw), sn = Math.sin(o.yaw);
        fishP.set(o.pos.x + f.off[0] * c + f.off[2] * sn, o.pos.y + f.off[1], o.pos.z - f.off[0] * sn + f.off[2] * c);
        Quaternion.RotationYawPitchRollToRef(o.yaw + wig, o.pitch, 0, fishQ);
        Matrix.ComposeToRef(fishS, fishQ, fishP, fishM);
        fishM.copyToArray(s.buf, i * 16);
      });
      s.mesh.thinInstanceBufferUpdated("matrix");
    }
    // the manta
    {
      const o = look(mantaPath, time);
      manta.position.copyFrom(o.pos);
      manta.rotation.set(o.pitch, o.yaw, Math.sin(time * 0.4) * 0.15);
      const flap = Math.sin(time * 1.6) * 0.45;
      mantaWings[0].rotation.z = -flap;
      mantaWings[1].rotation.z = flap;
    }
    // mermaids
    for (const m of mermaids) {
      const o = look(m.path, time, 0.4);
      m.root.position.copyFrom(o.pos);
      m.root.rotation.set(o.pitch * 0.7, o.yaw, Math.sin(time * 0.6 + m.seed) * 0.25);
      m.animate(time);
    }
    // kelp sways
    const sway = (k: number, h: number, ph: number) => [Math.sin(time * 0.8 + ph + k * 0.35) * k * 0.09, Math.cos(time * 0.6 + ph * 1.3 + k * 0.3) * k * 0.06] as const;
    kelp.forEach((kp, i) => {
      for (let k = 0; k <= KS; k++) {
        const y = (kp.h * k) / KS;
        const [sa, sl] = sway(k, kp.h, kp.ph);
        const w = 0.35 * Math.sin((k / KS) * Math.PI * 0.9 + 0.2) + 0.08;
        for (const e of [-1, 1]) {
          const p = local(kp.a + sa + e * w * 0.3, kp.l + sl + e * w, dune(kp.a, kp.l) + y);
          kelpPos.set([p.x, p.y, p.z], ((i * (KS + 1) + k) * 2 + (e > 0 ? 1 : 0)) * 3);
        }
      }
    });
    kelpMesh.updateVerticesData(VertexBuffer.PositionKind, kelpPos);
    void dt;
  });
}

/**
 * A mermaid swimming along +z, belly down: head, flowing hair, arms reaching forward, a shell top,
 * and a long scaled tail that beats up and down (a dolphin kick) ending in a wide fluke.
 */
function buildMermaid(ctx: Ctx, parent: Node, hairColor: string, tail: [string, string], seed: number) {
  const root = new TransformNode("mermaid", ctx.scene);
  root.parent = parent;
  const skin = new StandardMaterial("skin", ctx.scene);
  skin.diffuseColor = Color3.FromHexString("#efc2a0");
  skin.specularColor = new Color3(0.15, 0.12, 0.1);
  skin.emissiveColor = new Color3(0.14, 0.11, 0.1);
  const hairMat = new StandardMaterial("hair", ctx.scene);
  hairMat.diffuseColor = Color3.FromHexString(hairColor);
  hairMat.specularColor = new Color3(0.3, 0.25, 0.2);
  hairMat.emissiveColor = Color3.FromHexString(hairColor).scale(0.15);
  hairMat.backFaceCulling = false;
  const shell = new StandardMaterial("shell", ctx.scene);
  shell.diffuseColor = Color3.FromHexString("#f6a6c1");
  shell.specularColor = new Color3(0.6, 0.6, 0.6);
  shell.emissiveColor = new Color3(0.12, 0.06, 0.08);
  const tailMat = new StandardMaterial("tail", ctx.scene);
  tailMat.diffuseTexture = scaleTexture(ctx, tail[0], tail[1]);
  tailMat.specularColor = new Color3(0.8, 0.8, 0.9);
  tailMat.specularPower = 40;
  tailMat.emissiveColor = new Color3(0.08, 0.1, 0.12);
  tailMat.backFaceCulling = false;
  const add = (m: Mesh, p: Node, mat: StandardMaterial) => {
    m.parent = p;
    m.material = mat;
    m.isPickable = false;
    return m;
  };
  // torso (lying along z), slimmer at the waist
  const torso = add(MeshBuilder.CreateCylinder("torso", { height: 0.72, diameterTop: 0.34, diameterBottom: 0.26, tessellation: 14 }, ctx.scene), root, skin);
  torso.rotation.x = Math.PI / 2;
  torso.position.z = 0.45;
  torso.scaling.z = 0.75; // (flatter front to back — up and down here)
  const chest = add(MeshBuilder.CreateSphere("chest", { diameterX: 0.36, diameterY: 0.26, diameterZ: 0.3, segments: 10 }, ctx.scene), root, skin);
  chest.position.set(0, 0, 0.72);
  for (const sx of [-1, 1]) {
    const s = add(MeshBuilder.CreateSphere("shellTop", { diameter: 0.15, segments: 8, slice: 0.5 }, ctx.scene), root, shell);
    s.position.set(sx * 0.08, -0.1, 0.7);
    s.rotation.x = Math.PI;
  }
  const neck = add(MeshBuilder.CreateCylinder("neck", { height: 0.12, diameter: 0.1, tessellation: 10 }, ctx.scene), root, skin);
  neck.rotation.x = Math.PI / 2;
  neck.position.z = 0.88;
  const head = add(MeshBuilder.CreateSphere("head", { diameterX: 0.2, diameterY: 0.22, diameterZ: 0.24, segments: 14 }, ctx.scene), root, skin);
  head.position.set(0, 0.02, 1.02);
  // hair: long strands from the back of the head, streaming back over the shoulders
  const strands: TransformNode[][] = [];
  for (let k = 0; k < 9; k++) {
    const chain: TransformNode[] = [];
    let p: Node = root;
    const x = (k / 8 - 0.5) * 0.18;
    for (let s = 0; s < 4; s++) {
      const joint = new TransformNode("hairJoint", ctx.scene);
      joint.parent = p;
      if (s === 0) joint.position.set(x, 0.1, 0.98);
      else joint.position.z = -0.2;
      const blade = add(MeshBuilder.CreatePlane("hair", { width: 0.07 - s * 0.01, height: 0.22 }, ctx.scene), joint, hairMat);
      blade.rotation.x = Math.PI / 2;
      blade.position.z = -0.1;
      chain.push(joint);
      p = joint;
    }
    strands.push(chain);
  }
  // arms, reaching ahead in a slow breaststroke
  const arms = [-1, 1].map((sx) => {
    const shoulder = new TransformNode("shoulder", ctx.scene);
    shoulder.parent = root;
    shoulder.position.set(sx * 0.19, 0, 0.76);
    const upper = add(MeshBuilder.CreateCylinder("arm", { height: 0.3, diameterTop: 0.07, diameterBottom: 0.055, tessellation: 8 }, ctx.scene), shoulder, skin);
    upper.rotation.x = Math.PI / 2;
    upper.position.z = 0.15;
    const elbow = new TransformNode("elbow", ctx.scene);
    elbow.parent = shoulder;
    elbow.position.z = 0.3;
    const fore = add(MeshBuilder.CreateCylinder("forearm", { height: 0.28, diameterTop: 0.05, diameterBottom: 0.04, tessellation: 8 }, ctx.scene), elbow, skin);
    fore.rotation.x = Math.PI / 2;
    fore.position.z = 0.14;
    const hand = add(MeshBuilder.CreateSphere("hand", { diameterX: 0.06, diameterY: 0.025, diameterZ: 0.09, segments: 6 }, ctx.scene), elbow, skin);
    hand.position.z = 0.32;
    return { shoulder, elbow, sx };
  });
  // the tail: hips, then segments tapering to the fluke
  const segs: TransformNode[] = [];
  let p: Node = root;
  const R = [0.15, 0.15, 0.13, 0.11, 0.09, 0.07, 0.05];
  for (let s = 0; s < R.length - 1; s++) {
    const joint = new TransformNode("tailJoint", ctx.scene);
    joint.parent = p;
    joint.position.z = s === 0 ? 0.1 : -0.26;
    const seg = add(MeshBuilder.CreateCylinder("tailSeg", { height: 0.28, diameterTop: R[s] * 2, diameterBottom: R[s + 1] * 2, tessellation: 14 }, ctx.scene), joint, tailMat);
    seg.rotation.x = Math.PI / 2;
    seg.position.z = -0.13;
    seg.scaling.z = 0.8;
    segs.push(joint);
    p = joint;
  }
  // the fluke: two wide lobes, flat (it beats up and down)
  const fluke = new Mesh("fluke", ctx.scene);
  {
    const vd = new VertexData();
    vd.positions = [0, 0, 0, -0.45, 0, -0.42, -0.2, 0, -0.18, 0, 0, -0.12, 0.2, 0, -0.18, 0.45, 0, -0.42];
    vd.indices = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5];
    vd.uvs = [0.5, 0, 0, 1, 0.3, 0.5, 0.5, 0.4, 0.7, 0.5, 1, 1];
    const nor: number[] = [];
    VertexData.ComputeNormals(vd.positions, vd.indices, nor);
    vd.normals = nor;
    vd.applyToMesh(fluke);
  }
  add(fluke, p, tailMat).position.z = -0.24;

  return {
    root,
    seed,
    animate(t: number) {
      const ph = t * 2.4 + seed;
      // the kick: a wave running down the tail
      segs.forEach((j, s) => (j.rotation.x = Math.sin(ph - s * 0.75) * (0.12 + s * 0.05)));
      // the body rides the stroke a little
      torso.position.y = Math.sin(ph + 1.2) * 0.02;
      // hair trails and ripples
      strands.forEach((chain, k) =>
        chain.forEach((j, s) => {
          j.rotation.x = (s === 0 ? -0.25 : 0) + Math.sin(ph - s * 0.9 + k * 0.4) * 0.18;
          j.rotation.y = Math.sin(t * 1.3 + k + s) * 0.08;
        })
      );
      // arms: a slow sweep out and back
      for (const a of arms) {
        const k = Math.sin(t * 1.1 + seed);
        a.shoulder.rotation.y = a.sx * (0.35 + 0.35 * k);
        a.shoulder.rotation.x = 0.15 + 0.1 * k;
        a.elbow.rotation.y = -a.sx * (0.3 + 0.3 * Math.max(0, k));
      }
    },
  };
}

// ------------------------------------------------------------------ the road down, and the covered tunnel

function buildCutting(ctx: Ctx, root: Node, u: U, mats: { road: ReturnType<typeof lit>; verge: ReturnType<typeof lit>; wall: ReturnType<typeof lit>; kerb: ReturnType<typeof lit> }) {
  const P = UNDER[u.cmd];
  const A1 = P.down * TILE, A2 = (P.down + P.flat) * TILE, L = u.length;
  const half = ROAD_HALF * TILE;
  // the road, its kerbs and the concrete verge out to the cutting's walls
  const road = strips(ctx, "underRoad", root, [strip(ctx, u, 0, L, () => [[-half, SURFACE], [half, SURFACE]], 5)]);
  road.material = mats.road;
  road.receiveShadows = true;
  const kerbs = strips(ctx, "underKerb", root, [-1, 1].map((sd) => strip(ctx, u, 0, L, () => [[sd * (half - 0.9), SURFACE + 0.01], [sd * half, SURFACE + 0.01]], 2)));
  kerbs.material = mats.kerb;
  kerbs.receiveShadows = true;
  const verge = strips(ctx, "underVerge", root, [-1, 1].map((sd) => strip(ctx, u, 0, L, () => [[sd * half, SURFACE], [sd * TRENCH_HALF, SURFACE]], 4)));
  verge.material = mats.verge;
  verge.receiveShadows = true;
  // the cutting's walls: from the road up to just above the lawn, where it is open to the sky
  const open: [number, number][] = u.cmd === "SUB" ? [[0, A1], [A2, L]] : [[0, A1], [A2, L]];
  const parts: ReturnType<typeof strip>[] = [];
  for (const [a0, a1] of open)
    for (const sd of [-1, 1]) {
      const ground = (a: number) => 0.35 - (heightAt(u.s0 + a) - u.y0);
      parts.push(strip(ctx, u, a0, a1, (a) => [[sd * TRENCH_HALF, -0.3], [sd * TRENCH_HALF, ground(a)]], 6));
    }
  const walls = strips(ctx, "cuttingWalls", root, parts);
  walls.material = mats.wall;
  walls.receiveShadows = true;
  ctx.shadow?.addShadowCaster(walls, false);
}

function buildTunnel(ctx: Ctx, root: Node, u: U, wallMat: ReturnType<typeof lit>) {
  const P = UNDER.TUN;
  const A1 = P.down * TILE, A2 = (P.down + P.flat) * TILE;
  const H = 7.5;
  const roadAt = (a: number) => heightAt(u.s0 + a) - u.y0;
  // inner walls and the ceiling, along the covered stretch (a little past each end: the mouths)
  const parts = [-1, 1].map((sd) => strip(ctx, u, A1, A2, () => [[sd * TRENCH_HALF, -0.3], [sd * TRENCH_HALF, H]], 6));
  parts.push(strip(ctx, u, A1, A2, () => [[-TRENCH_HALF, H], [TRENCH_HALF, H]], 6));
  const shell = strips(ctx, "tunnelShell", root, parts);
  const sm = lit(ctx, { rough: 0.9, color: "#9a968e", double: true });
  sm.albedoTexture = concreteTexture(ctx);
  shell.material = sm;
  shell.receiveShadows = true;
  ctx.shadow?.addShadowCaster(shell, false);
  // the mouths: concrete from the tunnel's top up to the lawn, and a frame round the opening
  for (const a of [A1, A2]) {
    const y = roadAt(a);
    const face = MeshBuilder.CreateBox("tunnelMouth", { width: 2 * TRENCH_HALF + 2, height: -y - H + 0.6, depth: 1 }, ctx.scene);
    face.position.copyFrom(new Vector3(...at(u, a, 0, H + (-y - H + 0.6) / 2)));
    face.rotation.y = Math.atan2(u.fx, u.fz);
    face.material = wallMat;
    face.parent = root;
    face.isPickable = false;
    ctx.shadow?.addShadowCaster(face, false);
    const lintel = MeshBuilder.CreateBox("tunnelLintel", { width: 2 * TRENCH_HALF + 2, height: 0.9, depth: 1.6 }, ctx.scene);
    lintel.position.copyFrom(new Vector3(...at(u, a, 0, H + 0.2)));
    lintel.rotation.y = face.rotation.y;
    const lm = lit(ctx, { color: "#f0c419", rough: 0.6 }); // yellow and black: mind your head
    lintel.material = lm;
    lintel.parent = root;
  }
  // lamps down both sides of the ceiling, and the pools of light they throw on the road
  const lampMat = unlit(ctx, { color: "#fff1cf" });
  const pool = canvasTexture(ctx, 128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,236,190,0.9)");
    grd.addColorStop(1, "rgba(255,236,190,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
  const poolMat = unlit(ctx, { map: pool, additive: true, depthWrite: false });
  setAdditive(poolMat, "#ffe3a8", 0.55);
  for (let a = A1 + 3; a < A2 - 2; a += 7)
    for (const sd of [-1, 1]) {
      const lamp = MeshBuilder.CreateBox("tunnelLamp", { width: 0.5, height: 0.12, depth: 1.6 }, ctx.scene);
      lamp.position.copyFrom(new Vector3(...at(u, a, sd * 6.5, H - 0.1)));
      lamp.rotation.y = Math.atan2(u.fx, u.fz);
      lamp.material = lampMat;
      lamp.parent = root;
      lamp.isPickable = false;
      const glow = MeshBuilder.CreateGround("lampPool", { width: 7, height: 9 }, ctx.scene);
      glow.position.copyFrom(new Vector3(...at(u, a, sd * 4, SURFACE + 0.03)));
      glow.rotation.y = lamp.rotation.y;
      glow.material = poolMat;
      glow.parent = root;
      glow.isPickable = false;
    }
}

/** Everything under the lawn for the track being driven (nothing if it has no underground pieces). */
export function buildUnderworld(ctx: Ctx, parent: Node) {
  if (!TRACK.unders.length) return;
  const root = group(ctx, { parent });
  const roadMat = lit(ctx, { rough: 0.85 });
  roadMat.albedoTexture = asphaltTexture(ctx, 1);
  const verge = lit(ctx, { rough: 0.9, color: "#a9a59c" });
  verge.albedoTexture = concreteTexture(ctx);
  const wall = lit(ctx, { rough: 0.9, double: true });
  wall.albedoTexture = concreteTexture(ctx);
  const kerb = lit(ctx, { rough: 0.7 });
  kerb.albedoTexture = kerbTexture(ctx);
  for (const u of TRACK.unders) {
    buildCutting(ctx, root, u, { road: roadMat, verge, wall, kerb });
    if (u.cmd === "SUB") buildAquarium(ctx, root, u);
    else buildTunnel(ctx, root, u, wall);
  }
}
