import { Color3, Matrix, Mesh, MeshBuilder, PBRMaterial, Quaternion, Texture, Vector3, VertexData, type Material, type Node } from "@babylonjs/core";
import { loadContainer, thinCopies } from "./assets";
import { buildBirds } from "./Birds";
import { buildMountains } from "./Mountains";
import { buildSky } from "./Sky";
import { ROAD_HALF, SURFACE, TILE, TRACK, WALL_H, WALL_IN, WALL_T, boostPad, heightAt, loopPose, nearLoop, onDeck, overUnder, roadFrames, sampleAt, underHoles } from "./Track";
import { mainStraightEnd, reserved } from "./Zones";
import { buildCity, pavementTexture, streetTexture } from "./City";
import { canvasTexture, group, hash, lit, unlit, type Ctx } from "./core";

/** Racing Kit props are a tile of 8 m (the road tiles are TILE). */
export const PROP = 8;

/** Kenney's models face −z and span −x: helpers to stand one at a point facing a way. */
export type Box = { x0: number; x1: number; z0: number; z1: number };
/** Position and yaw for a model whose local footprint `box` (kit units) should centre on (x, z), facing `face` (the yaw its front looks along). */
export function standAt(box: Box, scale: number, x: number, z: number, face: number) {
  const yaw = face + Math.PI; // the kit's fronts look down −z
  const cx = ((box.x0 + box.x1) / 2) * scale;
  const cz = ((box.z0 + box.z1) / 2) * scale;
  // rotate the local centre by yaw (+y turn in this right-handed scene) and subtract it
  const rx = cx * Math.cos(yaw) + cz * Math.sin(yaw);
  const rz = -cx * Math.sin(yaw) + cz * Math.cos(yaw);
  return { pos: [x - rx, 0, z - rz] as [number, number, number], yaw };
}

export const FOOT = {
  grandStandCovered: { x0: -1, x1: 0, z0: -0.02, z1: 1 },
  tentLong: { x0: -2, x1: 0, z0: 0, z1: 1 },
  billboardLow: { x0: -0.936, x1: 0.064, z0: -0.04, z1: 0.436 },
  point: { x0: 0, x1: 0, z0: 0, z1: 0 },
};

// ------------------------------------------------------------------ textures

/** Lawn: a mottled green with blades and the odd dry patch. */
export function grassTexture(ctx: Ctx, scale: number) {
  const t = canvasTexture(ctx, 512, 512, (g) => {
    g.fillStyle = "#4b7531";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const r = 18 + hash(i, 3) * 60;
      const grd = g.createRadialGradient(hash(i, 1) * 512, hash(i, 2) * 512, 0, hash(i, 1) * 512, hash(i, 2) * 512, r);
      const tone = hash(i, 4);
      grd.addColorStop(0, tone > 0.7 ? "rgba(140,150,70,0.22)" : tone > 0.35 ? "rgba(40,80,25,0.25)" : "rgba(95,140,55,0.25)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 512, 512);
    }
    for (let i = 0; i < 26000; i++) {
      const v = hash(i, 13);
      g.fillStyle = v > 0.66 ? "rgba(150,195,95,0.55)" : v > 0.33 ? "rgba(32,62,20,0.5)" : "rgba(90,130,50,0.5)";
      g.fillRect(hash(i, 14) * 512, hash(i, 15) * 512, 1, 2 + hash(i, 16) * 3);
    }
  });
  t.hasAlpha = false;
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.uScale = t.vScale = scale;
  return t;
}

/** Asphalt: dark grey with fine aggregate and faint tyre-worn streaks. */
export function asphaltTexture(ctx: Ctx, scale: number) {
  const t = canvasTexture(ctx, 512, 512, (g) => {
    g.fillStyle = "#3b3d42";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 36000; i++) {
      const v = hash(i, 23);
      g.fillStyle = v > 0.6 ? `rgba(200,200,205,${0.12 + hash(i, 24) * 0.12})` : `rgba(10,10,12,${0.18 + hash(i, 25) * 0.2})`;
      g.fillRect(hash(i, 26) * 512, hash(i, 27) * 512, 1 + hash(i, 28) * 1.5, 1 + hash(i, 29) * 1.5);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.04 + hash(i, 31) * 0.05})`;
      g.fillRect(0, hash(i, 32) * 512, 512, 6 + hash(i, 33) * 20);
    }
  });
  t.hasAlpha = false;
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.uScale = t.vScale = scale;
  return t;
}

/** Concrete wall, its top band painted in red and white blocks (u runs along the wall). */
function wallTexture(ctx: Ctx) {
  const t = canvasTexture(ctx, 512, 256, (g) => {
    g.fillStyle = "#b9b6ae";
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 9000; i++) {
      const v = hash(i, 41);
      g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.1 * hash(i, 42)})` : `rgba(40,38,34,${0.16 * hash(i, 43)})`;
      g.fillRect(hash(i, 44) * 512, hash(i, 45) * 256, 2, 2);
    }
    // rain streaks and a dirty foot
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(60,55,48,${0.05 + 0.06 * hash(i, 46)})`;
      g.fillRect(hash(i, 47) * 512, 80, 3 + hash(i, 48) * 8, 176);
    }
    const foot = g.createLinearGradient(0, 200, 0, 256);
    foot.addColorStop(0, "rgba(50,45,38,0)");
    foot.addColorStop(1, "rgba(50,45,38,0.45)");
    g.fillStyle = foot;
    g.fillRect(0, 200, 512, 56);
    // the painted band (v = 1 is the top: the canvas's top rows)
    g.fillStyle = "#c8312d";
    g.fillRect(0, 0, 256, 78);
    g.fillStyle = "#f1efe9";
    g.fillRect(256, 0, 256, 78);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(0, 76, 512, 3);
  });
  t.hasAlpha = false;
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.CLAMP_ADDRESSMODE;
  return t;
}

// ------------------------------------------------------------------ the walls

/**
 * One continuous concrete wall along a side of the whole lap (side +1 = left of the way round) — it
 * follows the road's frame, so round the loop it turns over with it and becomes the loop's rail.
 */
function buildWall(ctx: Ctx, parent: Node, side: 1 | -1) {
  const S = roadFrames();
  S.push(S[0]);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  // three faces: the one facing the road, the top, the back — [lateral a, height a, lateral b, height b, v a, v b]
  const faces: [number, number, number, number, number, number][] = [
    [WALL_IN, -0.5, WALL_IN, WALL_H, 0.02, 1],
    [WALL_IN, WALL_H, WALL_IN + WALL_T, WALL_H, 0.97, 1],
    [WALL_IN + WALL_T, WALL_H, WALL_IN + WALL_T, -0.5, 1, 0.02],
  ];
  let u = 0;
  const us: number[] = [];
  S.forEach((q, i) => {
    if (i > 0) u += Math.hypot(q.pos[0] - S[i - 1].pos[0], q.pos[1] - S[i - 1].pos[1], q.pos[2] - S[i - 1].pos[2]) / 8; // a red and a white block every 8 m
    us.push(u);
  });
  const at = (q: (typeof S)[number], lat: number, h: number) => {
    const l = lat * side, k = SURFACE + h;
    return [q.pos[0] + q.left[0] * l + q.up[0] * k, q.pos[1] + q.left[1] * l + q.up[1] * k, q.pos[2] + q.left[2] * l + q.up[2] * k];
  };
  for (const [la, ha, lb, hb, va, vb] of faces) {
    const base = pos.length / 3;
    S.forEach((q, i) => {
      pos.push(...at(q, la, ha), ...at(q, lb, hb));
      uv.push(us[i], va, us[i], vb);
    });
    for (let i = 0; i < S.length - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const mesh = new Mesh("wall", ctx.scene);
  const vd = new VertexData();
  vd.positions = pos;
  vd.indices = idx;
  vd.uvs = uv;
  const normals: number[] = [];
  VertexData.ComputeNormals(pos, idx, normals);
  vd.normals = normals;
  vd.applyToMesh(mesh);
  mesh.parent = parent;
  mesh.receiveShadows = true;
  mesh.isPickable = false; // low enough to see over: the camera arm ignores it
  mesh.freezeWorldMatrix();
  return mesh;
}

// ------------------------------------------------------------------ the lawn

/**
 * The lawn, `size` metres square round the origin, with holes dug where the road goes underground
 * (axis-aligned: cut into a grid along every hole's edges, the cells inside a hole left out). Its UVs
 * are the ground's own (a repeat every 5 m, as the plain ground had), so it matches the tiles' verges.
 */
function lawn(ctx: Ctx, size: number, holes: [number, number, number, number][]) {
  const h = size / 2;
  const xs = [...new Set([-h, h, ...holes.flatMap((r) => [r[0], r[1]])])].sort((a, b) => a - b);
  const zs = [...new Set([-h, h, ...holes.flatMap((r) => [r[2], r[3]])])].sort((a, b) => a - b);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], nor: number[] = [];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      if (holes.some((r) => cx > r[0] && cx < r[1] && cz > r[2] && cz < r[3])) continue;
      const b = pos.length / 3;
      for (const [x, z] of [
        [xs[i], zs[j]],
        [xs[i + 1], zs[j]],
        [xs[i + 1], zs[j + 1]],
        [xs[i], zs[j + 1]],
      ]) {
        pos.push(x, 0, z);
        nor.push(0, 1, 0);
        uv.push((x + h) / size, (z + h) / size);
      }
      // (facing up in this right-handed scene)
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  const m = new Mesh("ground", ctx.scene);
  const vd = new VertexData();
  vd.positions = pos;
  vd.indices = idx;
  vd.uvs = uv;
  vd.normals = nor;
  vd.applyToMesh(m);
  return m;
}

// ------------------------------------------------------------------ decks under the bends up on the hills

/**
 * The bends up on a hill stand on concrete: a block the size of each one's tile, from the lawn up
 * to just under the tile (its sides banded every 2 m like poured concrete), so the bend sits on top
 * with a sheer drop beside it.
 */
function buildDecks(ctx: Ctx, parent: Node) {
  if (!TRACK.decks.length) return;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const d of TRACK.decks) {
    const top = d.y - 0.03;
    const n = d.pts.length;
    // the sides
    for (let i = 0; i < n; i++) {
      const [ax, az] = d.pts[i], [bx, bz] = d.pts[(i + 1) % n];
      const len = Math.hypot(bx - ax, bz - az);
      const b = pos.length / 3;
      pos.push(ax, -0.05, az, bx, -0.05, bz, bx, top, bz, ax, top, az);
      uv.push(0, 0, len / 6, 0, len / 6, top / 6, 0, top / 6);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    // the top (under the tile: what shows round its edges)
    const b = pos.length / 3;
    for (const [x, z] of d.pts) {
      pos.push(x, top, z);
      uv.push(x / 6, z / 6);
    }
    for (let i = 1; i < n - 1; i++) idx.push(b, b + i, b + i + 1);
  }
  const mesh = new Mesh("decks", ctx.scene);
  const vd = new VertexData();
  vd.positions = pos;
  vd.indices = idx;
  vd.uvs = uv;
  const normals: number[] = [];
  VertexData.ComputeNormals(pos, idx, normals);
  vd.normals = normals;
  vd.applyToMesh(mesh);
  const mat = lit(ctx, { rough: 0.95, double: true });
  mat.albedoTexture = concreteTexture(ctx);
  mesh.material = mat;
  mesh.parent = parent;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  ctx.shadow?.addShadowCaster(mesh, false);
}

/** Poured concrete: pale grey, a seam every lift, streaks of weather down it. */
export function concreteTexture(ctx: Ctx) {
  const t = canvasTexture(ctx, 256, 256, (g) => {
    g.fillStyle = "#b8b3a8";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const v = 150 + Math.floor(hash(i, 3) * 60);
      g.fillStyle = `rgba(${v},${v - 4},${v - 12},0.35)`;
      g.fillRect(hash(i, 1) * 256, hash(i, 2) * 256, 2 + hash(i, 4) * 3, 2 + hash(i, 5) * 3);
    }
    // weather streaks running down
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(90,86,78,${0.05 + hash(i, 7) * 0.08})`;
      g.fillRect(hash(i, 6) * 256, 0, 2 + hash(i, 8) * 6, 256);
    }
    // the seams between lifts, and the form-tie holes
    g.fillStyle = "rgba(70,66,60,0.55)";
    g.fillRect(0, 0, 256, 3);
    g.fillRect(0, 128, 256, 3);
    g.fillStyle = "rgba(60,56,50,0.6)";
    for (let x = 32; x < 256; x += 64)
      for (const y of [64, 192]) {
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
  });
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

// ------------------------------------------------------------------ the loop-the-loop

/** Red and white kerb blocks, 2 m each (v runs along the road). */
export function kerbTexture(ctx: Ctx) {
  const t = canvasTexture(ctx, 32, 256, (g) => {
    g.fillStyle = "#c8312d";
    g.fillRect(0, 0, 32, 128);
    g.fillStyle = "#f1efe9";
    g.fillRect(0, 128, 32, 128);
    g.fillStyle = "rgba(0,0,0,0.12)";
    for (let i = 0; i < 400; i++) g.fillRect(hash(i, 81) * 32, hash(i, 82) * 256, 1, 1);
  });
  t.hasAlpha = false;
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/** Glowing chevrons, pointing up the texture (the way you drive over it). */
function chevronTexture(ctx: Ctx) {
  const t = canvasTexture(ctx, 256, 256, (g) => {
    g.fillStyle = "#0b1a2e";
    g.fillRect(0, 0, 256, 256);
    for (const [y, a] of [[40, 1], [168, 1]] as const) {
      const grd = g.createLinearGradient(0, y, 0, y + 90);
      grd.addColorStop(0, `rgba(120,240,255,${a})`);
      grd.addColorStop(1, "rgba(40,140,255,0.9)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(128, y);
      g.lineTo(236, y + 70);
      g.lineTo(236, y + 104);
      g.lineTo(128, y + 34);
      g.lineTo(20, y + 104);
      g.lineTo(20, y + 70);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = "rgba(120,240,255,0.9)";
    g.lineWidth = 6;
    g.strokeRect(3, -10, 250, 276);
  });
  t.hasAlpha = false;
  t.wrapU = Texture.CLAMP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/**
 * A strip of the loop's deck along its whole length, between lateral offsets a and b (left +), `h`
 * above the road's level (along the road's up); its face looks along up (down for the underside).
 */
function loopStrip(ctx: Ctx, parent: Node, mat: Material, a: number, b: number, h: number, down: boolean, uvScale: number, vertical = false) {
  const L = TRACK.loop!;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = Math.ceil(L.length);
  let along = 0;
  let prev: [number, number, number] | null = null;
  for (let k = 0; k <= n; k++) {
    const q = loopPose(Math.min(L.length, k));
    if (prev) along += Math.hypot(q.pos[0] - prev[0], q.pos[1] - prev[1], q.pos[2] - prev[2]);
    prev = q.pos;
    // a vertical strip (a riser) runs from height a to height b at lateral h instead
    const pts = vertical ? [[h, a], [h, b]] : [[a, h], [b, h]];
    for (const [lat, up] of pts) {
      pos.push(q.pos[0] + q.left[0] * lat + q.up[0] * up, q.pos[1] + q.left[1] * lat + q.up[1] * up, q.pos[2] + q.left[2] * lat + q.up[2] * up);
      const s = down ? -1 : 1;
      if (vertical) nor.push(-q.left[0] * Math.sign(h), -q.left[1] * Math.sign(h), -q.left[2] * Math.sign(h));
      else nor.push(q.up[0] * s, q.up[1] * s, q.up[2] * s);
      uv.push((vertical ? up : lat) / uvScale, along / uvScale);
    }
  }
  for (let k = 0; k < n; k++) {
    const i = k * 2;
    idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  const m = new Mesh("loopDeck", ctx.scene);
  const vd = new VertexData();
  vd.positions = pos;
  vd.normals = nor;
  vd.uvs = uv;
  vd.indices = idx;
  vd.applyToMesh(m);
  m.material = mat;
  m.parent = parent;
  m.receiveShadows = true;
  m.isPickable = false;
  m.freezeWorldMatrix();
  ctx.shadow?.addShadowCaster(m, false);
  return m;
}

/**
 * The loop-the-loop, built to match the tiles: asphalt with red and white kerbs, the raised grey
 * verge, a steel underside, concrete piers under its lower half and two steel girders all round
 * (its rails are the track's walls, which follow it round). And the boost pad before it.
 */
function buildLoop(ctx: Ctx, parent: Node) {
  const L = TRACK.loop;
  if (!L) return;
  const root = group(ctx, { parent });
  const solid = (m: PBRMaterial) => {
    m.backFaceCulling = false;
    return m;
  };
  const asphalt = solid(lit(ctx, { rough: 0.85 }));
  asphalt.albedoTexture = asphaltTexture(ctx, 1);
  const kerb = solid(lit(ctx, { rough: 0.7 }));
  kerb.albedoTexture = kerbTexture(ctx);
  const grey = solid(lit(ctx, { color: "#c9c6bf", rough: 0.9 }));
  const steel = solid(lit(ctx, { color: "#3d4450", rough: 0.55, metal: 0.6 }));
  const RH = ROAD_HALF * TILE; // 7.59: the asphalt's edge
  const K = 0.8; // kerb width
  const VERGE = 2 * SURFACE; // the kit's grey verge stands a kerb's height above the road
  loopStrip(ctx, root, asphalt, -(RH - K), RH - K, SURFACE, false, 5.6);
  for (const s of [1, -1]) {
    loopStrip(ctx, root, kerb, s * (RH - K), s * RH, SURFACE, false, 4);
    loopStrip(ctx, root, grey, s * RH, s * WALL_IN, VERGE, false, 4);
    loopStrip(ctx, root, grey, SURFACE, VERGE, s * RH, false, 4, true);
  }
  loopStrip(ctx, root, steel, -(WALL_IN + WALL_T), WALL_IN + WALL_T, -0.5, true, 4);

  // two box girders under the deck all the way round the climb, with cross beams
  const girders: Vector3[][] = [[], []];
  for (let d = L.climbIn - 2; d <= L.climbOut + 2; d += 1.5) {
    const q = loopPose(Math.min(L.length, Math.max(0, d)));
    [-6, 6].forEach((lat, j) => girders[j].push(new Vector3(q.pos[0] + q.left[0] * lat - q.up[0] * 1.1, q.pos[1] + q.left[1] * lat - q.up[1] * 1.1, q.pos[2] + q.left[2] * lat - q.up[2] * 1.1)));
  }
  for (const path of girders) {
    const tube = MeshBuilder.CreateTube("girder", { path, radius: 0.55, tessellation: 8, cap: Mesh.CAP_ALL }, ctx.scene);
    tube.parent = root;
    tube.material = steel;
    tube.isPickable = false;
    tube.receiveShadows = true;
    tube.freezeWorldMatrix();
    ctx.shadow?.addShadowCaster(tube, false);
  }
  // cross beams and concrete piers: one unit box / cylinder, thin-instanced
  const beam = MeshBuilder.CreateBox("loopBeam", { size: 1 }, ctx.scene);
  beam.parent = root;
  beam.material = steel;
  beam.isPickable = false;
  beam.receiveShadows = true;
  const pier = MeshBuilder.CreateCylinder("loopPier", { height: 1, diameter: 1, tessellation: 14 }, ctx.scene);
  pier.parent = root;
  pier.material = lit(ctx, { color: "#b4b0a7", rough: 0.95 });
  pier.isPickable = false;
  pier.receiveShadows = true;
  const beams: number[] = [];
  const piers: number[] = [];
  const m = new Matrix();
  const q4 = new Quaternion();
  for (let d = L.climbIn + 3; d <= L.climbOut - 3; d += 5) {
    const q = loopPose(d);
    // a beam across under the deck, joining the girders
    const c = new Vector3(q.pos[0] - q.up[0] * 0.95, q.pos[1] - q.up[1] * 0.95, q.pos[2] - q.up[2] * 0.95);
    Quaternion.RotationQuaternionFromAxisToRef(new Vector3(...q.left), new Vector3(...q.up), new Vector3(...q.t), q4);
    Matrix.ComposeToRef(new Vector3(13, 0.6, 0.8), q4, c, m);
    beams.push(...m.toArray());
    // piers under the lower half (where the deck faces up)
    if (q.up[1] > 0.35) {
      for (const lat of [-6, 6]) {
        const top = new Vector3(q.pos[0] + q.left[0] * lat - q.up[0] * 1.1, q.pos[1] + q.left[1] * lat - q.up[1] * 1.1, q.pos[2] + q.left[2] * lat - q.up[2] * 1.1);
        const h = top.y - (L.y0 - 0.3);
        if (h < 1.2) continue;
        Matrix.ComposeToRef(new Vector3(1.1, h, 1.1), Quaternion.Identity(), new Vector3(top.x, L.y0 - 0.3 + h / 2, top.z), m);
        piers.push(...m.toArray());
      }
    }
  }
  beam.thinInstanceSetBuffer("matrix", new Float32Array(beams), 16, true);
  pier.thinInstanceSetBuffer("matrix", new Float32Array(piers), 16, true);
  for (const x of [beam, pier]) {
    x.thinInstanceRefreshBoundingInfo(false);
    x.freezeWorldMatrix();
    ctx.shadow?.addShadowCaster(x, false);
  }

  // ---- the boost pad on the straight before it
  drawBoostPad(ctx, root, boostPad()!);
}

/** A boost pad on the road: glowing chevrons scrolling the way you drive over it. */
export function drawBoostPad(ctx: Ctx, parent: Node, pad: { s0: number; s1: number; half: number }) {
  const mid = sampleAt((pad.s0 + pad.s1) / 2);
  const padMat = unlit(ctx, { map: chevronTexture(ctx), opaque: true });
  padMat.zOffset = -2;
  const padTex = padMat.diffuseTexture as Texture;
  padTex.vScale = (pad.s1 - pad.s0) / (pad.half * 2);
  const plate = MeshBuilder.CreateGround("boostPad", { width: pad.half * 2, height: pad.s1 - pad.s0 }, ctx.scene);
  plate.parent = parent;
  plate.material = padMat;
  plate.isPickable = false;
  plate.position.set(mid.x, heightAt((pad.s0 + pad.s1) / 2) + SURFACE + 0.02, mid.z);
  plate.rotation.y = mid.heading;
  ctx.onFrame((_, t) => {
    padTex.vOffset = -t * 1.6;
  });
  return plate;
}

// ------------------------------------------------------------------ the circuit

/**
 * The circuit: Racing Kit road tiles with their kerbs (re-surfaced in asphalt and grass), concrete
 * walls along the whole lap, grandstands and flags along the main straight, light gantries over the
 * hills, and a city round it (City.ts).
 */
export function buildRaceTrack(ctx: Ctx, parent: Node, o: { boards: { x: number; z: number }[] }) {
  const root = group(ctx, { parent });
  const colliders = ctx.colliders;

  // ---- the ground: a lawn to the mountains (2 cm under the tiles' verges)
  const ground = lawn(ctx, 2600, underHoles());
  const gm = lit(ctx, { rough: 1 });
  // (a city: the open ground is street asphalt; the blocks have their own pavements)
  gm.albedoTexture = streetTexture(ctx, 2600 / 6);
  ground.material = gm;
  ground.position.y = -0.02;
  // pushed back in depth: where the tiles' own grass lies 2 cm above it, the tiles always win
  // (otherwise the two flicker against each other further off)
  gm.zOffset = 2;
  gm.zOffsetUnits = 4;
  ground.parent = root;
  ground.receiveShadows = true;
  ground.isPickable = false;
  ground.freezeWorldMatrix();

  // ---- the road tiles (the start screen waits for these: you need them to drive), every copy of a
  // tile drawn in one go
  // re-surface the kit's flat colours: real asphalt, real grass (the kit's UVs run ~39 units a tile)
  // (the tiles' verges: pavement, not lawn, in town)
  const tileGrass = pavementTexture(ctx, 0.14);
  const tileAsphalt = asphaltTexture(ctx, 0.1);
  const resurfaced = new Map<string, Promise<void>>();
  const resurface = (file: string) => {
    let p = resurfaced.get(file);
    if (!p) {
      p = loadContainer(ctx, file).then((c) => {
        for (const m of c.materials) {
          if (!(m instanceof PBRMaterial)) continue;
          if (m.name === "grass") {
            m.albedoTexture = tileGrass;
            m.albedoColor = Color3.White();
            m.roughness = 1;
          } else if (m.name === "road") {
            m.albedoTexture = tileAsphalt;
            m.albedoColor = Color3.White();
            m.roughness = 0.85;
          }
        }
      });
      resurfaced.set(file, p);
    }
    return p;
  };
  const byFile = new Map<string, { pos: [number, number, number]; yaw: number; scale: number }[]>();
  for (const p of TRACK.models) byFile.set(p.file, [...(byFile.get(p.file) ?? []), { pos: [p.x, p.y, p.z], yaw: p.yaw, scale: TILE }]);
  const tiles = [...byFile].map(([file, places]) => resurface(file).then(() => thinCopies(ctx, file, root, places)));

  // ---- concrete walls both sides, the whole way round: nobody leaves the track
  const wallMat = lit(ctx, { rough: 0.9, double: true });
  wallMat.albedoTexture = wallTexture(ctx);
  for (const side of [1, -1] as const) {
    const w = buildWall(ctx, root, side);
    w.material = wallMat;
    ctx.shadow?.addShadowCaster(w, false);
  }

  buildLoop(ctx, root);
  buildDecks(ctx, root);

  // ---- the main straight: grandstands outside, flags each side of the start
  const s0 = 0;
  const s1 = mainStraightEnd();
  const along = (s: number, lateral: number) => {
    const q = sampleAt(s);
    // + lateral = left of the heading (+x when facing +z)
    return { x: q.x + Math.cos(q.heading) * lateral, z: q.z - Math.sin(q.heading) * lateral, heading: q.heading };
  };
  // (props are gathered per model and drawn as copies of it, below)
  const props = new Map<string, { cast: boolean; places: { pos: [number, number, number]; yaw: number; scale: number }[] }>();
  const put = (file: string, box: Box, scale: number, x: number, z: number, face: number, o: { cast?: boolean; solid?: [number, number] } = {}) => {
    const { pos, yaw } = standAt(box, scale, x, z, face);
    const entry = props.get(file) ?? { cast: !!o.cast, places: [] };
    entry.places.push({ pos, yaw, scale });
    props.set(file, entry);
    if (o.solid) colliders.push({ x, z, hx: o.solid[0], hz: o.solid[1] });
  };
  const GS = 16; // grandstand scale: 16 m wide, ~19 m tall
  for (let s = s0 + 24, k = 0; s < s1 - 16; s += GS + 1, k++) {
    const p = along(s, 0.5 * TILE + 4 + GS / 2);
    put(k % 3 === 1 ? "grandStand.glb" : "grandStandCovered.glb", FOOT.grandStandCovered, GS, p.x, p.z, p.heading - Math.PI / 2, { cast: true, solid: [GS / 2, GS / 2] });
  }
  for (let s = s0 + 34; s < s1 - 24; s += 40) {
    const p = along(s, 0.5 * TILE + 8 + GS + 10);
    put("tentLong.glb", FOOT.tentLong, PROP * 1.2, p.x, p.z, p.heading - Math.PI / 2, { solid: [PROP * 1.2, PROP * 0.6] });
  }
  for (const side of [-1, 1]) {
    const p = along(TRACK.startS, side * (WALL_IN + WALL_T + 1.2));
    put("flagCheckers.glb", FOOT.point, PROP * 1.2, p.x, p.z, p.heading + Math.PI / 2);
  }
  for (let s = s0 + 14, k = 0; s < s1; s += 30, k++) {
    const p = along(s, -(WALL_IN + WALL_T + 1.2));
    put(k % 2 ? "flagRed.glb" : "flagGreen.glb", FOOT.point, PROP, p.x, p.z, p.heading - Math.PI / 2);
  }

  // ---- light gantries over the road where each hill begins
  const gantries = TRACK.pieces
    .filter((q) => q.cmd === "UP")
    .map((p) => {
      const q = sampleAt(p.s0 + 0.5);
      return { pos: [q.x + Math.cos(q.heading) * 0.5 * TILE, 0, q.z - Math.sin(q.heading) * 0.5 * TILE] as [number, number, number], yaw: q.heading, scale: TILE };
    });
  props.set("overheadLights.glb", { cast: true, places: gantries });
  for (const [file, { cast, places }] of props) thinCopies(ctx, file, root, places, { cast, background: true }).catch((e) => console.error(file, e));

  // ---- the city round the circuit (in place of the lawn's trees): kept clear of the track, its
  // grandstands, the billboards and everything dug or raised for the road
  const free = (x: number, z: number, margin: number) =>
    !reserved(x, z) &&
    !nearLoop(x, z) &&
    !TRACK.decks.some((d) => onDeck(d.pts, x, z, margin)) &&
    !overUnder(x, z, margin) &&
    TRACK.samples.every((q) => Math.hypot(q.x - x, q.z - z) > 0.5 * TILE + margin) &&
    o.boards.every((b) => Math.hypot(b.x - x, b.z - z) > 10 + margin);
  buildCity(ctx, root, free);

  buildSky(ctx, root);
  buildBirds(ctx, root, { x: 0, y: 10, z: 0 });
  buildMountains(ctx, root, { x: 0, y: -0.5, z: 0 }, { inner: 520, outer: 860 });

  return { root, ready: Promise.all(tiles) };
}
