import { Texture, type Material, type Node } from "@babylonjs/core";
import { Batcher, Tint, cityMaterials, type CityMaterials, type Surface } from "./CityKit";
import { CITY_Y, FRONT_DOOR_X, FRONT_Z, GATE_X0, GATE_X1, PLOT, POOL, POOL_FLOOR_Y, WATER_Y } from "./cityLayout";
import { canvasTexture, hash, lit, type Ctx } from "./core";

/** A real flower / shrub model to place (see City.ts): file, position, yaw, scale. */
export type FlowerSpot = [string, number, number, number, number];

const Y = CITY_Y;
/**
 * The house: one storey on a 0.6 m stone plinth (the rooms' floor is y = 0). Its back wall stands
 * right behind the living room's back wall, with an opening where that room's window is, so the
 * window looks out onto the real garden.
 */
export const HOUSE = { x0: -14, x1: 19, z0: -5.4, z1: FRONT_Z };
const EAVE_Y = 3.95;
/** Window centres in the front wall (HomeRooms.ts puts the inner frames at the same places). */
export const FRONT_WINDOWS = [-12.2, -8.6, -5.0, -1.4, 7.4, 11.0, 14.6, 17.4];
/** The living-room window in Room.ts (x range, sill and head heights). */
const LIVING_WINDOW = { x0: -0.7, x1: 2.7, y0: 0.95, y1: 2.6 };

const matCache = new WeakMap<Ctx, CityMaterials>();
/** One shared set of materials per scene (textures are drawn once). */
export function getCityMaterials(ctx: Ctx) {
  let m = matCache.get(ctx);
  if (!m) matCache.set(ctx, (m = cityMaterials(ctx)));
  return m;
}

export type Collider = { x: number; z: number; hx: number; hz: number; top?: number };

// --------------------------------------------------------------- building parts

/**
 * A framed window on a wall. `axis` is the wall normal axis, `dir` its sign (which side faces out),
 * `at` the wall's outer surface coordinate; (u, y) is the window centre along the wall.
 */
export function windowOn(b: Batcher, m: CityMaterials, axis: "x" | "z", dir: 1 | -1, at: number, u: number, y: number, w: number, h: number, lit_: boolean, shutters?: Surface, real = false) {
  const out = (d: number) => at + dir * d;
  const put = (along: number, y_: number, depth: number, sw: number, sh: number, sd: number, mat: Surface) => {
    if (axis === "z") b.box(sw, sh, sd, along, y_, out(depth), mat, { pickable: false });
    else b.box(sd, sh, sw, out(depth), y_, along, mat, { pickable: false });
  };
  if (real) put(u, y, 0.03, w, h, 0.02, m.glassClear); // a real opening: you see into the room
  else {
    // no room behind this one: a lit room with curtains painted just behind the glass
    put(u, y, 0.004, w, h, 0.008, m.windowBack);
    put(u, y, 0.03, w, h, 0.02, lit_ ? m.glassClear : m.glassDark);
  }
  const f = 0.09;
  put(u, y + h / 2 + f / 2, 0.05, w + 2 * f, f, 0.1, m.darkWood);
  put(u, y - h / 2 - f / 2, 0.08, w + 2 * f + 0.1, f, 0.16, m.white); // sill
  put(u - w / 2 - f / 2, y, 0.05, f, h, 0.1, m.darkWood);
  put(u + w / 2 + f / 2, y, 0.05, f, h, 0.1, m.darkWood);
  put(u, y + h * 0.15, 0.05, w, 0.05, 0.08, m.darkWood); // transom
  put(u, y - h * 0.18, 0.05, 0.05, h * 0.66, 0.08, m.darkWood); // mullion
  if (shutters) {
    put(u - w / 2 - f - w * 0.25, y, 0.06, w * 0.48, h + 0.1, 0.05, shutters);
    put(u + w / 2 + f + w * 0.25, y, 0.06, w * 0.48, h + 0.1, 0.05, shutters);
  }
}

/** Plastered wall box on a stone plinth. */
/**
 * A wall along z (x = at, centre of its thickness `t`) or along x (z = at), from u0 to u1, with
 * window holes; `out` is the side the stone plinth goes on.
 */
export type Hole = { u: number; w: number; y0: number; y1: number };
export function holeyWall(b: Batcher, m: CityMaterials, plaster: Surface, axis: "x" | "z", at: number, t: number, u0: number, u1: number, y0: number, y1: number, holes: Hole[], out: 1 | -1) {
  const put = (a: number, c: number, ya: number, yc: number) => {
    if (c - a < 0.005 || yc - ya < 0.005) return;
    if (axis === "z") b.box(c - a, yc - ya, t, (a + c) / 2, (ya + yc) / 2, at, plaster, { tile: 2, cast: true });
    else b.box(t, yc - ya, c - a, at, (ya + yc) / 2, (a + c) / 2, plaster, { tile: 2, cast: true });
  };
  let u = u0;
  for (const h of [...holes].sort((p, q) => p.u - q.u)) {
    const a = h.u - h.w / 2, c = h.u + h.w / 2;
    put(u, a, y0, y1);
    put(a, c, y0, h.y0);
    put(a, c, h.y1, y1);
    u = c;
  }
  put(u, u1, y0, y1);
  // plinth, outside face only
  const po = at + out * (t / 2 + 0.07);
  if (axis === "z") b.box(u1 - u0, 0.62, 0.14, (u0 + u1) / 2, y0 + 0.31, po, m.stone, { tile: 1.5 });
  else b.box(0.14, 0.62, u1 - u0, po, y0 + 0.31, (u0 + u1) / 2, m.stone, { tile: 1.5 });
}

/** The windows of the house that open onto real rooms: centre (along the wall), sill and head. */
export const WINDOW = { w: 1.3, y0: 0.75, y1: 2.35 };
/** Side-wall window of the bedroom (west) and the kitchen (east). */
export const SIDE_WINDOW_Z = 43.6;

function gateTexture(ctx: Ctx) {
  const t = canvasTexture(ctx, 128, 256, (g) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 128, 256);
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 6;
    g.strokeRect(8, 8, 112, 240);
    g.lineWidth = 3;
    g.strokeRect(20, 20, 88, 100);
    g.strokeRect(20, 136, 88, 100);
    // Uzbek-style rosette on the upper panel
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.moveTo(64, 70);
      g.lineTo(64 + Math.cos(a) * 30, 70 + Math.sin(a) * 30);
    }
    g.stroke();
    g.beginPath();
    g.arc(64, 70, 18, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,215,120,0.9)";
    g.beginPath();
    g.arc(64, 70, 6, 0, Math.PI * 2);
    g.fill();
  });
  t.hasAlpha = false;
  t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE;
  return t;
}

const gateMats = new WeakMap<Ctx, Material>();
function gateMaterial(ctx: Ctx, m: CityMaterials, i: number) {
  let mat = gateMats.get(ctx);
  if (!mat) {
    const lm = lit(ctx, { rough: 0.45, metal: 0.45 });
    lm.albedoTexture = gateTexture(ctx);
    gateMats.set(ctx, (mat = lm));
  }
  return new Tint(mat, m.gate[i % m.gate.length].color);
}

/** Rug texture for the so'ri (topchan). */
function rugMaterial(ctx: Ctx) {
  const t = canvasTexture(ctx, 128, 128, (g) => {
    g.fillStyle = "#8c1c22";
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "#e8c06a";
    g.lineWidth = 6;
    g.strokeRect(8, 8, 112, 112);
    g.strokeStyle = "#1d3b6b";
    g.lineWidth = 4;
    g.strokeRect(20, 20, 88, 88);
    g.fillStyle = "#e8c06a";
    for (let i = 0; i < 4; i++) {
      g.save();
      g.translate(64, 64);
      g.rotate((i * Math.PI) / 2);
      g.beginPath();
      g.moveTo(0, -30);
      g.lineTo(12, 0);
      g.lineTo(0, 30);
      g.lineTo(-12, 0);
      g.closePath();
      g.fill();
      g.restore();
    }
  });
  t.hasAlpha = false;
  const mat = lit(ctx, { rough: 1 });
  mat.albedoTexture = t;
  return mat;
}

// ------------------------------------------------------------------------ the pool

function poolTiles(ctx: Ctx) {
  const t = canvasTexture(ctx, 128, 128, (g) => {
    g.fillStyle = "#cfe9f2";
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        const v = hash(i * 8 + j, 3);
        g.fillStyle = `rgb(${120 + v * 30},${190 + v * 25},${215 + v * 20})`;
        g.fillRect(i * 16 + 1, j * 16 + 1, 14, 14);
      }
  });
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.hasAlpha = false;
  const mat = lit(ctx, { rough: 0.25 });
  mat.albedoTexture = t;
  return mat;
}

/** Ripple normal map for the water (tileable noise turned into normals). */
function rippleTexture(ctx: Ctx) {
  const S = 128;
  const hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let v = 0;
      for (let k = 1; k <= 4; k++) v += Math.sin(((x * k) / S) * Math.PI * 2 + hash(k, 1) * 6) * Math.cos(((y * (5 - k)) / S) * Math.PI * 2 + hash(k, 2) * 6) / k;
      hgt[y * S + x] = v;
    }
  const t = canvasTexture(ctx, S, S, (g) => {
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = hgt[y * S + ((x + 1) % S)] - hgt[y * S + ((x + S - 1) % S)];
        const dy = hgt[((y + 1) % S) * S + x] - hgt[((y + S - 1) % S) * S + x];
        const i = (y * S + x) * 4;
        img.data[i] = 128 + dx * 40;
        img.data[i + 1] = 128 + dy * 40;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.hasAlpha = false;
  return t;
}

/** A sunken, tiled swimming pool with a stone deck, a steel ladder, loungers and rippling water. */
function buildPool(ctx: Ctx, b: Batcher, m: CityMaterials, colliders: Collider[]) {
  const { x0, x1, z0, z1 } = POOL;
  const w = x1 - x0, d = z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const tiles = poolTiles(ctx);
  const depth = Y - POOL_FLOOR_Y;
  // basin: floor + four walls (inner faces tiled)
  b.box(w, 0.1, d, cx, POOL_FLOOR_Y - 0.05, cz, tiles, { tile: 1 });
  b.box(0.2, depth, d + 0.4, x0 - 0.1, Y - depth / 2, cz, tiles, { tile: 1 });
  b.box(0.2, depth, d + 0.4, x1 + 0.1, Y - depth / 2, cz, tiles, { tile: 1 });
  b.box(w, depth, 0.2, cx, Y - depth / 2, z0 - 0.1, tiles, { tile: 1 });
  b.box(w, depth, 0.2, cx, Y - depth / 2, z1 + 0.1, tiles, { tile: 1 });
  // stone deck round the edge (coping)
  const deck = m.matte("#e4ddd0");
  b.box(w + 2.8, 0.08, 1.4, cx, Y + 0.04, z0 - 0.7, deck, { tile: 0 });
  b.box(w + 2.8, 0.08, 1.4, cx, Y + 0.04, z1 + 0.7, deck);
  b.box(1.4, 0.08, d, x0 - 0.7, Y + 0.04, cz, deck);
  b.box(1.4, 0.08, d, x1 + 0.7, Y + 0.04, cz, deck);
  b.box(w + 0.5, 0.06, 0.25, cx, Y + 0.09, z0 - 0.12, m.white);
  b.box(w + 0.5, 0.06, 0.25, cx, Y + 0.09, z1 + 0.12, m.white);
  b.box(0.25, 0.06, d, x0 - 0.12, Y + 0.09, cz, m.white);
  b.box(0.25, 0.06, d, x1 + 0.12, Y + 0.09, cz, m.white);
  // steel ladder at the north end — the only way out of the water
  const steel = m.matte("#d9dde2");
  const rail = depth + 1.0;
  for (const lx of [cx - 0.35, cx + 0.35]) {
    b.box(0.05, rail, 0.05, lx, POOL_FLOOR_Y + rail / 2, z1 - 0.14, steel, { pickable: false });
    b.box(0.05, 0.05, 0.42, lx, Y + 0.95, z1 + 0.06, steel, { pickable: false });
    b.box(0.05, 0.9, 0.05, lx, Y + 0.5, z1 + 0.26, steel, { pickable: false });
  }
  for (let yy = Y - 0.3; yy > POOL_FLOOR_Y + 0.2; yy -= 0.32) b.box(0.7, 0.04, 0.12, cx, yy, z1 - 0.17, steel, { pickable: false });
  // two loungers on the lawn beside the pool
  for (const lz of [36, 41]) {
    const lx = x1 + 2.3;
    b.box(0.7, 0.08, 1.9, lx, Y + 0.38, lz, m.white, { cast: true });
    const back = b.box(0.7, 0.06, 0.8, lx, Y + 0.65, lz - 1.05, m.white);
    back.rotation.x = -0.9;
    for (const [ax, az] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]]) b.box(0.05, 0.38, 0.05, lx + ax, Y + 0.19, lz + az, steel);
    b.box(0.62, 0.06, 1.7, lx, Y + 0.45, lz + 0.05, m.gate[0]);
    colliders.push({ x: lx, z: lz - 0.2, hx: 0.4, hz: 1.2 });
  }
  b.box(0.5, 0.45, 0.5, x1 + 2.3, Y + 0.22, 38.5, m.wood);
  colliders.push({ x: x1 + 2.3, z: 38.5, hx: 0.3, hz: 0.3 });
  // the water: transparent, rippling, softly lit from below at night
  const water = lit(ctx, { color: "#1f86b8", rough: 0.05, metal: 0.15, opacity: 0.72 });
  water.bumpTexture = rippleTexture(ctx);
  water.bumpTexture.level = 0.35;
  (water.bumpTexture as Texture).uScale = (water.bumpTexture as Texture).vScale = 3;
  water.emissiveColor.set(0.05, 0.25, 0.35);
  water.emissiveIntensity = 0;
  const surface = b.box(w, 0.02, d, cx, WATER_Y, cz, water, { pickable: false });
  void surface;
  ctx.onFrame((_, t) => {
    const tex = water.bumpTexture as Texture;
    tex.uOffset = (t * 0.02) % 1;
    tex.vOffset = (t * 0.013) % 1;
    water.emissiveIntensity = 0.2 + Math.max(0, ctx.night - 0.3) * 1.6;
  });
}

// ---------------------------------------------------------------------- the house

/**
 * The yard face of the house — always drawn (it is also the entrance hall's end wall).
 * Doorway at FRONT_DOOR_X; Stairs.ts hangs the actual door in it.
 */
export function buildHouseFront(ctx: Ctx, parent: Node, doorW: number) {
  const m = getCityMaterials(ctx);
  const b = new Batcher(ctx, parent);
  const plaster = m.plaster[0];
  const z = FRONT_Z + 0.15;
  const dx0 = FRONT_DOOR_X - doorW / 2 - 0.1;
  const dx1 = FRONT_DOOR_X + doorW / 2 + 0.1;
  const doorTop = Y + 2.45;
  const holes = FRONT_WINDOWS.map((u) => ({ u, w: WINDOW.w, y0: WINDOW.y0, y1: WINDOW.y1 }));
  const piece = (x0: number, x1: number, y0: number, y1: number, hs: Hole[] = []) => {
    let u = x0;
    const put = (a: number, c: number, ya: number, yc: number) => {
      if (c - a > 0.005 && yc - ya > 0.005) b.box(c - a, yc - ya, 0.3, (a + c) / 2, (ya + yc) / 2, z, plaster, { tile: 2, cast: true });
    };
    for (const h of hs.filter((q) => q.u > x0 && q.u < x1)) {
      put(u, h.u - h.w / 2, y0, y1);
      put(h.u - h.w / 2, h.u + h.w / 2, y0, h.y0);
      put(h.u - h.w / 2, h.u + h.w / 2, h.y1, y1);
      u = h.u + h.w / 2;
    }
    put(u, x1, y0, y1);
  };
  piece(HOUSE.x0, dx0, Y, EAVE_Y, holes);
  piece(dx1, HOUSE.x1, Y, EAVE_Y, holes);
  piece(dx0, dx1, doorTop, EAVE_Y);
  // (everything below sits on the outer face only — the inner face is the entrance hall's wall)
  b.box(dx0 - HOUSE.x0 + 0.08, 0.64, 0.14, (HOUSE.x0 - 0.08 + dx0) / 2, Y + 0.32, z + 0.2, m.stone, { tile: 1.5 });
  b.box(HOUSE.x1 + 0.08 - dx1, 0.64, 0.14, (dx1 + HOUSE.x1 + 0.08) / 2, Y + 0.32, z + 0.2, m.stone, { tile: 1.5 });
  b.box(HOUSE.x1 - HOUSE.x0 + 0.56, 0.34, 0.74, (HOUSE.x0 + HOUSE.x1) / 2, EAVE_Y - 0.13, z + 0.3, m.white);
  // carved door surround
  b.box(0.16, 2.7, 0.2, dx0 - 0.08, Y + 1.35, z + 0.2, m.darkWood);
  b.box(0.16, 2.7, 0.2, dx1 + 0.08, Y + 1.35, z + 0.2, m.darkWood);
  b.box(dx1 - dx0 + 0.5, 0.22, 0.22, FRONT_DOOR_X, doorTop + 0.15, z + 0.2, m.darkWood);
  b.box(dx1 - dx0 + 0.2, 0.42, 0.06, FRONT_DOOR_X, doorTop + 0.46, z + 0.18, gateMaterial(ctx, m, 1));
  // windows with painted shutters
  const zo = z + 0.15;
  for (const x of FRONT_WINDOWS) windowOn(b, m, "z", 1, zo, x, 1.55, WINDOW.w, WINDOW.y1 - WINDOW.y0, true, m.gate[0], true);
  b.finalize();
}

/** Ayvon (veranda): carved posts, beam and a lean-to roof in front of the house. */
function ayvon(b: Batcher, m: CityMaterials, x0: number, x1: number, zWall: number, depth: number, h: number, colliders: Collider[]) {
  const n = Math.max(2, Math.round((x1 - x0) / 3) + 1);
  const zp = zWall + depth - 0.25;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    b.box(0.24, h, 0.24, x, Y + h / 2, zp, m.wood, { cast: true });
    b.box(0.46, 0.24, 0.46, x, Y + 0.12, zp, m.stone);
    b.box(0.6, 0.16, 0.38, x, Y + h - 0.14, zp, m.darkWood); // carved capital
    b.box(0.32, 0.1, 0.32, x, Y + h * 0.66, zp, m.darkWood);
    b.box(0.32, 0.1, 0.32, x, Y + h * 0.3, zp, m.darkWood);
    colliders.push({ x, z: zp, hx: 0.22, hz: 0.22 });
  }
  b.box(x1 - x0 + 0.6, 0.26, 0.32, (x0 + x1) / 2, Y + h + 0.1, zp, m.darkWood, { cast: true });
  // painted ceiling boards and the sloping roof
  for (let x = x0 + 0.4; x < x1; x += 0.9) b.box(0.12, 0.12, depth, x, Y + h + 0.28, zWall + depth / 2, m.darkWood, { pickable: false });
  const roof = b.box(x1 - x0 + 1.0, 0.12, depth + 0.6, (x0 + x1) / 2, Y + h + 0.5, zWall + depth / 2 + 0.2, m.roofs[0], { cast: true });
  roof.rotation.x = 0.12;
  // stone-paved floor of the veranda
  b.box(x1 - x0 + 0.8, 0.1, depth, (x0 + x1) / 2, Y + 0.05, zWall + depth / 2 + 0.15, m.paving, { tile: 1.2 });
}

/**
 * Everything of the house except its front wall (sides, back, roof, veranda) plus the whole
 * hovli: lawn, pool, so'ri with a tea set, grape trellis, flower beds, tandir, fruit trees,
 * vegetable beds — and the brick wall with its gate that encloses the property.
 */
export function buildHouseAndYard(ctx: Ctx, b: Batcher, colliders: Collider[]) {
  const m = getCityMaterials(ctx);
  const plaster = m.plaster[0];
  const { x0, x1, z0 } = HOUSE;
  const z1 = FRONT_Z;
  // side walls
  // (side walls run between the back wall and the front wall — no overlapping corners, which flickered)
  const sideHole = [{ u: SIDE_WINDOW_Z, w: WINDOW.w, y0: WINDOW.y0, y1: WINDOW.y1 }];
  holeyWall(b, m, plaster, "x", x0 + 0.15, 0.3, z0 + 0.3, z1, Y, EAVE_Y, sideHole, -1);
  holeyWall(b, m, plaster, "x", x1 - 0.15, 0.3, z0 + 0.3, z1, Y, EAVE_Y, sideHole, 1);
  // back wall, with an opening for the living room's window
  const W = LIVING_WINDOW;
  const back = (a: number, c: number, y0: number, y1: number) => b.box(c - a, y1 - y0, 0.3, (a + c) / 2, (y0 + y1) / 2, z0 + 0.15, plaster, { tile: 2, cast: true });
  back(x0, W.x0, Y, EAVE_Y);
  back(W.x1, x1, Y, EAVE_Y);
  back(W.x0, W.x1, Y, W.y0);
  back(W.x0, W.x1, W.y1, EAVE_Y);
  b.box(x1 - x0 + 0.16, 0.6, 0.14, (x0 + x1) / 2, Y + 0.3, z0 - 0.07, m.stone, { tile: 1.5 });
  b.box(W.x1 - W.x0 + 0.3, 0.1, 0.2, (W.x0 + W.x1) / 2, W.y0 - 0.05, z0 - 0.05, m.white, { pickable: false });
  for (const x of [-11, -7, -4, 6, 10, 14, 17]) windowOn(b, m, "z", -1, z0, x, 1.55, 1.2, 1.4, hash(x, 5) > 0.4, m.gate[0]);
  for (let z = z0 + 5; z < z1 - 3; z += 5.5) {
    const real = Math.abs(z - SIDE_WINDOW_Z) < 0.1;
    const [ww, wh] = real ? [WINDOW.w, WINDOW.y1 - WINDOW.y0] : [1.2, 1.4];
    windowOn(b, m, "x", -1, x0, z, 1.55, ww, wh, hash(z, 1) > 0.35, m.gate[0], real);
    windowOn(b, m, "x", 1, x1, z, 1.55, ww, wh, hash(z, 2) > 0.35, m.gate[0], real);
  }
  b.box(x1 - x0 + 0.5, 0.3, z1 - z0 + 0.5, (x0 + x1) / 2, EAVE_Y - 0.12, (z0 + z1) / 2, m.white);
  // roof: a long hip roof in green tin, two chimneys and a TV dish
  b.roof(x1 - x0 + 1.4, z1 - z0 + 1.4, 4, (x0 + x1) / 2, EAVE_Y, (z0 + z1) / 2, m.roofs[0], { cast: true });
  for (const [cx, cz] of [[-4, 30], [9, 8]]) {
    b.box(0.6, 2.6, 0.6, cx, EAVE_Y + 2.6, cz, m.brick, { tile: 1 });
    b.box(0.8, 0.12, 0.8, cx, EAVE_Y + 3.95, cz, m.white);
  }
  b.box(0.1, 0.9, 0.1, 12, EAVE_Y + 1.4, 44, m.metal);
  b.box(1.0, 1.0, 0.1, 12, EAVE_Y + 2.0, 44.1, m.white, { yaw: 0.5 });
  // a veranda across the front
  ayvon(b, m, x0 + 0.8, x1 - 0.8, z1 + 0.3, 3.2, 3.0, colliders);

  // ---- the yard
  const P = PLOT;
  const yz0 = z1 + 3.8; // in front of the veranda
  // lawn everywhere inside the wall, paved paths on top
  // (cut round the pool and its stone deck)
  const hole = { x0: POOL.x0 - 1.4, x1: POOL.x1 + 1.4, z0: POOL.z0 - 1.4, z1: POOL.z1 + 1.4 };
  const lawn = (a: number, c: number, d: number, e: number) => b.box(c - a, 0.06, e - d, (a + c) / 2, Y + 0.03, (d + e) / 2, m.grass, { tile: 3 });
  // (and never inside the house: its floors are lower than the lawn)
  const hz0 = z0 - 0.05, hz1 = z1 + 0.35;
  lawn(P.x0, P.x1, P.z0, hz0); // behind the house
  lawn(P.x0, P.x1, hz1, P.z1); // the front yard
  lawn(P.x0, x0, hz0, hz1); // west side
  lawn(x1, hole.x0, hz0, hz1); // east side, up to the pool
  lawn(hole.x1, P.x1, hz0, hz1);
  lawn(hole.x0, hole.x1, hz0, hole.z0);
  lawn(hole.x0, hole.x1, hole.z1, hz1);
  const path = (ax: number, az: number, cx: number, cz: number, w = 1.8) =>
    b.box(Math.abs(cx - ax) + w, 0.08, Math.abs(cz - az) + w, (ax + cx) / 2, Y + 0.04, (az + cz) / 2, m.paving, { tile: 1.6 });
  path(FRONT_DOOR_X, z1 + 0.4, FRONT_DOOR_X, P.z1 - 0.4, 2.2); // door → gate
  path(x0 - 3, z1 + 3.2, x1 + 3, z1 + 3.2); // along the veranda
  path(x0 - 3, z1 + 3.2, x0 - 3, P.z0 + 3); // west garden walk
  path(x1 + 3, z1 + 3.2, x1 + 3, P.z0 + 3); // east garden walk
  path(x0 - 3, P.z0 + 3, x1 + 3, P.z0 + 3); // behind the house

  buildPool(ctx, b, m, colliders);

  // so'ri in the front yard with a rug, xontaxta and a tea set
  const sx = 13, sz = 70.2;
  b.box(2.8, 0.12, 2.6, sx, Y + 0.55, sz, m.wood, { cast: true });
  for (const [ax, az] of [[-1.3, -1.2], [1.3, -1.2], [-1.3, 1.2], [1.3, 1.2]]) b.box(0.12, 0.55, 0.12, sx + ax, Y + 0.27, sz + az, m.darkWood);
  for (const [ax, az, w, d] of [[0, 1.25, 2.8, 0.06], [-1.35, 0, 0.06, 2.6], [1.35, 0, 0.06, 2.6]]) b.box(w, 0.45, d, sx + ax, Y + 0.85, sz + az, m.darkWood);
  b.box(2.6, 0.04, 2.4, sx, Y + 0.63, sz, rugMaterial(ctx));
  b.box(1.0, 0.28, 0.7, sx, Y + 0.79, sz, m.darkWood);
  b.cylinder(0.11, 0.14, sx + 0.1, Y + 1.0, sz, m.gate[0]);
  for (const [ax, az] of [[-0.3, 0.15], [0.35, -0.15], [-0.25, -0.2]]) b.cylinder(0.05, 0.05, sx + ax, Y + 0.96, sz + az, m.white);
  b.box(2.4, 0.08, 0.6, sx, Y + 0.68, sz + 0.85, m.gate[4]);
  b.box(0.6, 0.08, 2.2, sx - 1.0, Y + 0.68, sz, m.gate[4]);
  colliders.push({ x: sx, z: sz, hx: 1.45, hz: 1.35 });

  // grape trellis (ishkom) over the path to the gate
  const tx0 = FRONT_DOOR_X - 2.2, tx1 = FRONT_DOOR_X + 2.2;
  const tz0 = yz0 + 1.5, tz1 = P.z1 - 3;
  const ty = Y + 2.8;
  for (const x of [tx0, tx1])
    for (let k = 0; k <= 3; k++) {
      const z = tz0 + ((tz1 - tz0) * k) / 3;
      b.box(0.12, 2.8, 0.12, x, Y + 1.4, z, m.metal);
      colliders.push({ x, z, hx: 0.12, hz: 0.12 });
    }
  for (let z = tz0; z <= tz1; z += 0.6) b.box(tx1 - tx0 + 0.3, 0.05, 0.05, (tx0 + tx1) / 2, ty, z, m.metal, { pickable: false });
  for (const x of [tx0, tx1]) b.box(0.06, 0.06, tz1 - tz0, x, ty, (tz0 + tz1) / 2, m.metal, { pickable: false });
  const leaf = m.matte("#4f7f2c");
  const grape = m.matte("#4a2350");
  for (let i = 0; i < 90; i++) {
    const lx = tx0 - 0.2 + hash(i, 61) * (tx1 - tx0 + 0.4);
    const lz = tz0 + hash(i, 62) * (tz1 - tz0);
    b.box(0.9 + hash(i, 63) * 0.7, 0.18, 0.8 + hash(i, 64) * 0.6, lx, ty + 0.08 + hash(i, 65) * 0.12, lz, leaf, { yaw: hash(i, 66) * 3, cast: true, pickable: false });
    if (i % 3 === 0) {
      b.box(0.12, 0.16, 0.12, lx, ty - 0.12, lz, grape, { pickable: false });
      b.box(0.08, 0.1, 0.08, lx, ty - 0.24, lz, grape, { pickable: false });
    }
  }

  // flower beds (stone kerb + soil); the plants themselves are real models placed by City.ts
  const flowers: FlowerSpot[] = [];
  const FLOWER_FILES = ["flower-gazania.glb", "flower-ursinia.glb", "flower-empodium.glb", "flower-sorrel.glb", "periwinkle.glb"];
  const bed = (a: number, c: number, z: number, depth = 0.9) => {
    b.box(c - a, 0.25, depth, (a + c) / 2, Y + 0.12, z, m.stone, { tile: 1 });
    b.box(c - a - 0.12, 0.08, depth - 0.12, (a + c) / 2, Y + 0.27, z, m.soil, { tile: 1 });
    // plants stay inside the kerb: patches are scaled to the bed and turned along it
    const rows = Math.max(1, Math.floor((depth - 0.2) / 0.55));
    for (let x = a + 0.35; x < c - 0.3; x += 0.45)
      for (let row = 0; row < rows; row++) {
        const zz = z - depth / 2 + 0.1 + (depth - 0.2) * ((row + 0.5) / rows) + (hash(x + row, 53) - 0.5) * 0.08;
        const sc = Math.min(1.0, (depth - 0.2) / rows / 0.55) * (0.85 + hash(x + row, 56) * 0.2);
        flowers.push([FLOWER_FILES[Math.floor(hash(x * 7 + row, 51) * FLOWER_FILES.length)], x, zz, (hash(x + row, 54) > 0.5 ? 0 : Math.PI) + (hash(x, 57) - 0.5) * 0.3, sc]);
      }
    // low enough to jump onto / over (see Character.ts), but you can't just wade through the flowers
    colliders.push({ x: (a + c) / 2, z, hx: (c - a) / 2, hz: depth / 2, top: Y + 0.42 });
  };
  bed(x0 + 0.5, FRONT_DOOR_X - 2.6, yz0 + 0.7);
  bed(FRONT_DOOR_X + 2.6, 8.5, yz0 + 0.7);
  bed(-24, -6, P.z1 - 1.2);
  bed(19, 30, P.z1 - 1.2);
  bed(9.6, 16.4, 63.6, 3.2); // a flower garden where the little pool used to be
  bed(-22, -10, 63, 2.4);
  // shrubs along the walls
  const shrubAt = (x: number, z: number, yaw: number, sc: number) => {
    flowers.push(["shrub.glb", x, z, yaw, sc]);
    colliders.push({ x, z, hx: 0.35 * sc, hz: 0.35 * sc, top: Y + 0.5 });
  };
  for (let x = P.x0 + 2; x < P.x1 - 2; x += 3.2) if (x < GATE_X0 - 2 || x > GATE_X1 + 2) shrubAt(x, P.z1 - 0.9, hash(x, 9) * 6.28, 1.1 + hash(x, 8) * 0.5);
  for (let z = P.z0 + 3; z < P.z1 - 4; z += 3.4) {
    shrubAt(P.x0 + 0.9, z, hash(z, 9) * 6.28, 1.1 + hash(z, 8) * 0.5);
    if (z < POOL.z0 - 3 || z > POOL.z1 + 3) shrubAt(P.x1 - 0.9, z, hash(z, 7) * 6.28, 1.1 + hash(z, 6) * 0.5);
  }

  // vegetable beds in the west garden, a tandir and a woodpile in the east one
  const veg = [m.matte("#4f8a2c"), m.matte("#6a9a32"), m.matte("#c0392b")];
  for (let i = 0; i < 6; i++) {
    const z = 4 + i * 5;
    b.box(6, 0.18, 1.6, -22, Y + 0.09, z, m.soil, { tile: 1 });
    for (let k = 0; k < 10; k++) b.box(0.3, 0.3, 0.3, -24.6 + k * 0.58, Y + 0.32, z + (k % 2 ? 0.35 : -0.35), veg[(i + k) % 3], { pickable: false });
    colliders.push({ x: -22, z, hx: 3, hz: 0.8, top: Y + 0.47 });

  }
  b.cylinder(0.7, 1.2, 34.5, Y + 0.6, 22, m.plaster[2], 14);
  b.cylinder(0.38, 0.05, 34.5, Y + 1.22, 22, m.darkWood, 12);
  colliders.push({ x: 34.5, z: 22, hx: 0.7, hz: 0.7 });
  for (let i = 0; i < 12; i++) b.cylinder(0.12, 1.6, 34 + (i % 4) * 0.26, Y + 0.14 + Math.floor(i / 4) * 0.24, 16, m.wood, 8).rotation.x = Math.PI / 2;
  colliders.push({ x: 34.4, z: 16, hx: 0.7, hz: 0.9 });

  // ---- the property wall with its darvoza standing open
  const H = 2.4;
  const T = 0.32;
  const wallSeg = (ax: number, az: number, cx: number, cz: number) => {
    // walls running along z are a hair thinner and lower, so no two faces are coplanar where
    // the walls meet (coplanar overlapping faces flicker — z-fighting)
    const alongZ = Math.abs(cz - az) > Math.abs(cx - ax);
    const t = alongZ ? T - 0.03 : T;
    const h = alongZ ? H - 0.012 : H;
    const w = Math.abs(cx - ax) + t, d = Math.abs(cz - az) + t;
    b.box(w, h, d, (ax + cx) / 2, Y + h / 2, (az + cz) / 2, m.brick, { tile: 2.2, cast: true });
    b.box(w + 0.08 - (alongZ ? 0.02 : 0), 0.12, d + 0.08 - (alongZ ? 0.02 : 0), (ax + cx) / 2, Y + h + 0.06, (az + cz) / 2, m.white);
    colliders.push({ x: (ax + cx) / 2, z: (az + cz) / 2, hx: w / 2, hz: d / 2 });
    const n = Math.round(Math.max(w, d) / 4.5);
    for (let i = 0; i <= n; i++) {
      const t = i / Math.max(1, n);
      const qx = ax + (cx - ax) * t, qz = az + (cz - az) * t;
      // pillars: offset a little per wall so corner pillars do not coincide
      const o = alongZ ? 0.004 : 0;
      b.box(0.5 - o, H + 0.3 - o, 0.5 - o, qx, Y + (H + 0.3) / 2, qz, m.plaster[1], { tile: 1 });
      b.box(0.6 - o, 0.12, 0.6 - o, qx, Y + H + 0.36 + o * 2, qz, m.white);
    }
  };
  wallSeg(P.x0, P.z1, GATE_X0 - 0.3, P.z1);
  wallSeg(GATE_X1 + 0.3, P.z1, P.x1, P.z1);
  wallSeg(P.x0, P.z0, P.x0, P.z1);
  wallSeg(P.x1, P.z0, P.x1, P.z1);
  wallSeg(P.x0, P.z0, P.x1, P.z0);
  for (const gx of [GATE_X0 - 0.3, GATE_X1 + 0.3]) {
    b.box(0.6, H + 0.8, 0.6, gx, Y + (H + 0.8) / 2, P.z1, m.brick, { tile: 1, cast: true });
    b.box(0.72, 0.14, 0.72, gx, Y + H + 0.87, P.z1, m.white);
  }
  b.box(GATE_X1 - GATE_X0 + 1.2, 0.4, 0.4, (GATE_X0 + GATE_X1) / 2, Y + H + 0.6, P.z1, m.brick, { tile: 1 });
  // the darvoza, shut
  const gm = gateMaterial(ctx, m, 0);
  const leafW = (GATE_X1 - GATE_X0) / 2;
  for (const cx of [GATE_X0 + leafW / 2, GATE_X1 - leafW / 2]) b.box(leafW - 0.03, H + 0.1, 0.08, cx, Y + (H + 0.1) / 2 + 0.05, P.z1, gm, { cast: true });
  b.box(0.05, 0.4, 0.12, (GATE_X0 + GATE_X1) / 2 + 0.1, Y + 1.2, P.z1 - 0.06, m.metal); // latch
  colliders.push({ x: (GATE_X0 + GATE_X1) / 2, z: P.z1, hx: (GATE_X1 - GATE_X0) / 2, hz: 0.2 });

  // shade trees (real models, see City.ts): a few round the yard and the garden
  const trees: [number, number, number][] = [
    [-26, 70, 10], [-16, 58, 8.5], [32, 66, 10], [24, 56, 8],
    [-26, 40, 10], [-24, 22, 9], [-27, 2, 10], [-20, -18, 9.5],
    [-2, -19, 10], [10, -20, 9], [24, -16, 10], [26, 8, 9.5], [34, 52, 8],
  ];
  for (const [x, z] of trees) colliders.push({ x, z, hx: 0.4, hz: 0.4 });
  return { trees, flowers };
}
