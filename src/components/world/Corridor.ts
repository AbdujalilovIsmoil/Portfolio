import type { Node, TransformNode } from "@babylonjs/core";
import { instantiate } from "./assets";
import { DOOR_X, ROOM_H, ROOM_HZ } from "./Room";
import { DOOR_W, type DoorSystem } from "./Doors";
import { addChandelier } from "./Lamps";
import { EAST_DX, WEST_DX } from "./plan";
import { box, canvasTexture, group, hash, lit, type Ctx, type Region } from "./core";
import { mirror, picture } from "./decor";
import { addSeat, seatOf } from "./Seats";

/** The entrance hall (stairs + front door) between the bedroom and the kitchen is this wide. */
export const CORRIDOR_X0 = 1.5;
export const CORRIDOR_X1 = 4.5;
export const GAME_DOOR_Z = 11;

/** The central hall: 9 m wide, from the living room (z = ROOM_HZ) to the entrance hall. */
export const HALL = { x0: 1.3 + WEST_DX + 0.2, x1: 4.7 + EAST_DX - 0.2, z0: ROOM_HZ, z1: 39 };
const T = 0.2;
const SIDE_DOOR_ZS = [11, 20, 29];
const WX = HALL.x0 - T / 2; // west wall centre line
const EX = HALL.x1 + T / 2; // east wall centre line

/** Walkable areas: the hall and the doorways off it (the rooms add their own). */
export const CORRIDOR_REGIONS: Region[] = [
  { x0: DOOR_X - DOOR_W / 2, x1: DOOR_X + DOOR_W / 2, z0: ROOM_HZ - 1.0, z1: ROOM_HZ + 1.0 },
  { x0: HALL.x0, x1: HALL.x1, z0: HALL.z0, z1: HALL.z1 },
  ...SIDE_DOOR_ZS.flatMap((z) => [
    { x0: WX - 1.1, x1: WX + 1.1, z0: z - DOOR_W / 2, z1: z + DOOR_W / 2 },
    { x0: EX - 1.1, x1: EX + 1.1, z0: z - DOOR_W / 2, z1: z + DOOR_W / 2 },
  ]),
];

function gilam(ctx: Ctx, base: string, accent: string, seed: number) {
  const t = canvasTexture(ctx, 256, 384, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 384);
    g.strokeStyle = "#1f2f55";
    g.lineWidth = 16;
    g.strokeRect(8, 8, 240, 368);
    g.strokeStyle = accent;
    g.lineWidth = 4;
    g.strokeRect(22, 22, 212, 340);
    for (let i = 0; i < 3; i++) {
      const cy = 80 + i * 112;
      g.fillStyle = accent;
      g.beginPath();
      g.moveTo(128, cy - 44);
      g.lineTo(184, cy);
      g.lineTo(128, cy + 44);
      g.lineTo(72, cy);
      g.closePath();
      g.fill();
      g.fillStyle = "#1f2f55";
      g.beginPath();
      g.arc(128, cy, 16, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,230,180,${0.15 + hash(i, seed) * 0.2})`;
      g.fillRect(30 + hash(i, seed + 1) * 190, 30 + hash(i, seed + 2) * 320, 6, 6);
    }
  });
  t.hasAlpha = false;
  const m = lit(ctx, { rough: 1 });
  m.albedoTexture = t;
  return m;
}

/** Only the big furniture casts shadows (small props would cost more than they add). */
const BIG_CASTERS = /^(bed|wardrobe|sofa-modern|armchair|dining-table|bookshelf|grandfather-clock|kitchen-cabinet|stove)\.glb$/;

function model(ctx: Ctx, parent: Node, file: string, x: number, y: number, z: number, yaw: number, scale = 1) {
  instantiate(ctx, file, parent, { pos: [x, y, z], rot: [0, yaw, 0], scale, cast: BIG_CASTERS.test(file), background: true })
    .then((h: TransformNode) => {
      for (const m of h.getChildMeshes()) m.isPickable = false;
    })
    .catch(() => {});
}

/** The central hall: parquet, rugs, wainscoting, doors to the six themed rooms, furniture, chandeliers. */
export function buildCorridor(ctx: Ctx, parent: Node, doors: DoorSystem) {
  const root = group(ctx, { parent });
  const cols: { x: number; z: number; hx: number; hz: number }[] = [];
  const cx = (HALL.x0 + HALL.x1) / 2;
  const w = HALL.x1 - HALL.x0 + 2 * T;
  const len = HALL.z1 - HALL.z0;
  const cz = (HALL.z0 + HALL.z1) / 2;
  const wall = lit(ctx, { color: "#efe4cf", rough: 0.9 });
  const panel = lit(ctx, { color: "#6b4a30", rough: 0.55 });
  const trim = lit(ctx, { color: "#4a3020", rough: 0.6 });

  box(ctx, w, 0.1, len, { parent: root, pos: [cx, -0.05, cz], receive: true, mat: lit(ctx, { color: "#9a6a42", rough: 0.45 }) });
  box(ctx, w, 0.1, len, { parent: root, pos: [cx, ROOM_H + 0.05, cz], mat: lit(ctx, { color: "#f7f4ee", rough: 0.95 }) });
  // ceiling cornice + coffered beams across the hall
  for (let z = HALL.z0 + 3; z < HALL.z1; z += 5.5) box(ctx, w, 0.18, 0.22, { parent: root, pos: [cx, ROOM_H - 0.09, z], mat: lit(ctx, { color: "#e8dcc4", rough: 0.8 }) });

  // walls with door openings, wainscot panelling and skirting
  const wallWithDoors = (x: number, inward: number) => {
    let z = HALL.z0;
    const cuts = SIDE_DOOR_ZS.map((d) => [d - DOOR_W / 2, d + DOOR_W / 2] as [number, number]);
    for (const [a, b] of [...cuts, [HALL.z1, HALL.z1] as [number, number]]) {
      if (a > z) {
        box(ctx, T, ROOM_H, a - z, { parent: root, pos: [x, ROOM_H / 2, (a + z) / 2], receive: true, mat: wall });
        box(ctx, 0.04, 1.0, a - z, { parent: root, pos: [x + inward * 0.12, 0.5, (a + z) / 2], mat: panel });
        box(ctx, 0.06, 0.06, a - z, { parent: root, pos: [x + inward * 0.14, 1.02, (a + z) / 2], mat: trim });
      }
      if (b > a) box(ctx, T, ROOM_H - 2.4, DOOR_W, { parent: root, pos: [x, 2.4 + (ROOM_H - 2.4) / 2, (a + b) / 2], mat: wall });
      z = b;
    }
  };
  wallWithDoors(WX, 1);
  wallWithDoors(EX, -1);
  // the end wall towards the entrance hall (the stairwell walls carry on from its opening)
  for (const [a, b] of [[WX - T / 2, CORRIDOR_X0 - 0.2], [CORRIDOR_X1 + 0.2, EX + T / 2]]) box(ctx, b - a, ROOM_H, T, { parent: root, pos: [(a + b) / 2, ROOM_H / 2, HALL.z1], receive: true, mat: wall });
  // close the gap beside the living-room wall
  box(ctx, EX + T / 2 - 7, ROOM_H, T, { parent: root, pos: [(EX + T / 2 + 7) / 2, ROOM_H / 2, HALL.z0], mat: wall });

  // ---- doors (E to open)
  doors.add({ parent: root, hinge: [DOOR_X - DOOR_W / 2, ROOM_HZ], dir: [1, 0], side: 1, color: "#7a5637" });
  SIDE_DOOR_ZS.forEach((z, i) => {
    const hz = z - DOOR_W / 2;
    doors.add({ parent: root, hinge: [WX, hz], dir: [0, 1], side: 1, color: ["#2b2f45", "#4a3322", "#6a5a1c"][i] });
    doors.add({ parent: root, hinge: [EX, hz], dir: [0, 1], side: -1, color: ["#5a3b25", "#1f3a55", "#6a2a34"][i] });
  });

  // ---- rugs down the hall
  for (const [z, base, acc, seed] of [[13.2, "#6a1d2a", "#e0b45a", 1], [24.5, "#1f4a5a", "#e8c06a", 2], [34, "#5a2a1d", "#d9b45a", 3]] as [number, string, string, number][])
    box(ctx, 3.6, 0.02, 5.4, { parent: root, pos: [cx, 0.011, z], mat: gilam(ctx, base, acc, seed) });

  // ---- furniture between the doors (the middle stays clear: it is the way through)
  const W = HALL.x0, E = HALL.x1;
  // by the living room: a grandfather clock and a big plant
  model(ctx, root, "grandfather-clock.glb", W + 0.3, 0, 7.6, Math.PI / 2);
  cols.push({ x: W + 0.3, z: 7.6, hx: 0.3, hz: 0.4 });
  model(ctx, root, "potted-plant-2.glb", E - 0.5, 0, 6.2, 0, 1.3);
  model(ctx, root, "floor-vase.glb", E - 0.4, 0, 9.4, 0, 1.4);
  cols.push({ x: E - 0.5, z: 6.2, hx: 0.5, hz: 0.5 }, { x: E - 0.4, z: 9.4, hx: 0.25, hz: 0.25 });
  // west, between doors 1 and 2: console table, mirror, vase
  box(ctx, 0.45, 0.06, 1.6, { parent: root, pos: [W + 0.3, 0.82, 15.5], cast: true, mat: trim });
  for (const dz of [-0.7, 0.7]) box(ctx, 0.06, 0.82, 0.06, { parent: root, pos: [W + 0.42, 0.41, 15.5 + dz], mat: trim });
  model(ctx, root, "brass-vase.glb", W + 0.3, 0.85, 15.1, 0, 0.8);
  model(ctx, root, "ceramic-vase.glb", W + 0.3, 0.85, 16.0, 0, 1);
  mirror(ctx, root, W + 0.02, 1.75, 15.5, Math.PI / 2, 1.8, true, HALL);
  cols.push({ x: W + 0.3, z: 15.5, hx: 0.3, hz: 0.85 });
  // east, between doors 1 and 2: two armchairs with a little table, a picture above
  model(ctx, root, "armchair.glb", E - 0.6, 0, 14.4, -Math.PI / 2 - 0.25);
  model(ctx, root, "armchair.glb", E - 0.6, 0, 16.8, -Math.PI / 2 + 0.25);
  model(ctx, root, "coffee-table.glb", E - 0.55, 0, 15.6, 0, 0.55);
  picture(ctx, root, E - 0.02, 1.95, 15.6, -Math.PI / 2, 1.2, 0.85, 0);
  cols.push({ x: E - 0.6, z: 15.6, hx: 0.6, hz: 1.7 });
  // the lounge between doors 2 and 3: sofa, coffee table, armchair; bookshelf opposite
  model(ctx, root, "sofa-modern.glb", W + 0.45, 0, 24.5, Math.PI / 2, 1.2);
  model(ctx, root, "pillows.glb", W + 0.4, 0.42, 24.5, Math.PI / 2, 0.9);
  model(ctx, root, "coffee-table-2.glb", W + 1.75, 0, 24.5, 0, 1);
  model(ctx, root, "armchair.glb", W + 1.8, 0, 22.6, 0.4);
  picture(ctx, root, W + 0.02, 1.95, 24.5, Math.PI / 2, 1.6, 1.0, 1);
  cols.push({ x: W + 0.5, z: 24.5, hx: 0.45, hz: 1.0 }, { x: W + 1.75, z: 24.5, hx: 0.35, hz: 0.65 }, { x: W + 1.8, z: 22.6, hx: 0.45, hz: 0.45 });
  model(ctx, root, "bookshelf.glb", E - 0.32, 0, 24.5, -Math.PI / 2, 1.1);
  for (let s = 0; s < 3; s++) model(ctx, root, "books.glb", E - 0.35, 0.44 + s * 0.56, 24.0, -Math.PI / 2, 1);
  cols.push({ x: E - 0.32, z: 24.5, hx: 0.35, hz: 0.8 });
  // near the entrance: plants, a vase, a picture
  model(ctx, root, "potted-plant.glb", W + 0.5, 0, 33.4, 0, 1.2);
  model(ctx, root, "floor-vase.glb", W + 0.35, 0, 36.6, 0, 1.4);
  model(ctx, root, "potted-plant-2.glb", E - 0.5, 0, 37.6, 0, 1.1);
  picture(ctx, root, E - 0.02, 1.9, 33.8, -Math.PI / 2, 1.0, 1.3, 2);
  picture(ctx, root, W + 0.02, 1.9, 7.6 + 2.2, Math.PI / 2, 0.9, 0.7, 3);
  picture(ctx, root, W + 0.02, 1.9, 31.8, Math.PI / 2, 1.1, 0.8, 4);
  cols.push({ x: W + 0.5, z: 33.4, hx: 0.45, hz: 0.45 }, { x: W + 0.35, z: 36.6, hx: 0.25, hz: 0.25 }, { x: E - 0.5, z: 37.6, hx: 0.5, hz: 0.5 });

  // ---- seats (E to sit)
  addSeat(ctx, doors, seatOf(E - 0.6, 14.4, -Math.PI / 2 - 0.25, 0));
  addSeat(ctx, doors, seatOf(E - 0.6, 16.8, -Math.PI / 2 + 0.25, 0));
  addSeat(ctx, doors, seatOf(W + 1.8, 22.6, 0.4, 0));
  for (const dz of [-0.45, 0.45]) addSeat(ctx, doors, seatOf(W + 0.45, 24.5 + dz, Math.PI / 2, 0, 0.05));

  // ---- chandeliers
  for (const z of [12, 24.5, 34]) addChandelier(ctx, root, cx, z, ROOM_H, "#ffe6c0", 9, 13);

  ctx.colliders.push(...cols);
  return { root, cx, cz, len };
}
