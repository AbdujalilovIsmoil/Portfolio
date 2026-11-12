import { Vector3, type Node, type TransformNode } from "@babylonjs/core";
import { buildCooking } from "./Cooking";
import { instantiate } from "./assets";
import { CITY_Y, FRONT_Z } from "./cityLayout";
import { CORRIDOR_X0, CORRIDOR_X1 } from "./Corridor";
import { DOOR_W, type DoorSystem } from "./Doors";
import { addPendant } from "./Lamps";
import { DESK, ROOM_H, buildDesk } from "./Room";
import { FRONT_WINDOWS, HOUSE, SIDE_WINDOW_Z, WINDOW } from "./House";
import { box, canvasTexture, cylinder, group, hash, lit, type Ctx, type Region } from "./core";
import { curtains, mirror, picture, wallpaper } from "./decor";
import { addSeat, seatOf } from "./Seats";

const Y = CITY_Y;
/** The doors from the entrance hall into the bedroom (west) and the kitchen (east). */
export const HOME_DOOR_Z = 44.4;
const BACK_Z = 40.2;
const BED = { x0: HOUSE.x0 + 0.3, x1: CORRIDOR_X0 - 0.2 };
const KIT = { x0: CORRIDOR_X1 + 0.2, x1: HOUSE.x1 - 0.3 };
const FRONT = FRONT_Z;

/** Both rooms together (for switching them off when the player is far away). */
export const HOME_BOX: Region = { x0: HOUSE.x0, x1: HOUSE.x1, z0: BACK_Z, z1: FRONT };

/** Walkable floor of the two rooms plus their doorways from the hall. */
export const HOME_REGIONS: Region[] = [
  { x0: BED.x0, x1: BED.x1, z0: BACK_Z + 0.1, z1: FRONT - 0.05 },
  { x0: KIT.x0, x1: KIT.x1, z0: BACK_Z + 0.1, z1: FRONT - 0.05 },
  { x0: CORRIDOR_X0 - 1.2, x1: CORRIDOR_X0 + 1.0, z0: HOME_DOOR_Z, z1: HOME_DOOR_Z + DOOR_W },
  { x0: CORRIDOR_X1 - 1.0, x1: CORRIDOR_X1 + 1.2, z0: HOME_DOOR_Z, z1: HOME_DOOR_Z + DOOR_W },
];

type Col = { x: number; z: number; hx: number; hz: number };

function gilam(ctx: Ctx, base: string, accent: string) {
  const t = canvasTexture(ctx, 256, 192, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 192);
    g.strokeStyle = "#1f2f55";
    g.lineWidth = 14;
    g.strokeRect(7, 7, 242, 178);
    g.strokeStyle = accent;
    g.lineWidth = 3;
    g.strokeRect(18, 18, 220, 156);
    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 6; j++) {
        if ((i + j) % 2) continue;
        g.fillStyle = accent + "88";
        g.beginPath();
        g.moveTo(32 + i * 24, 30 + j * 24);
        g.lineTo(40 + i * 24, 38 + j * 24);
        g.lineTo(32 + i * 24, 46 + j * 24);
        g.lineTo(24 + i * 24, 38 + j * 24);
        g.fill();
      }
  });
  t.hasAlpha = false;
  const m = lit(ctx, { rough: 1 });
  m.albedoTexture = t;
  return m;
}

/**
 * An inner window: frame, a bright pane (daylight; dark blue at night) and curtains.
 * `axis`/`dir`: which wall and which way the room is.
 */
/**
 * The inside of a window that opens through the house wall: a painted frame round the opening,
 * a deep sill, and curtains you can draw with E.
 */
function innerWindow(ctx: Ctx, parent: Node, doors: DoorSystem, axis: "x" | "z", at: number, inward: 1 | -1, u: number, curtain: string) {
  const y = (WINDOW.y0 + WINDOW.y1) / 2;
  const h = WINDOW.y1 - WINDOW.y0;
  const w = WINDOW.w;
  const frame = lit(ctx, { color: "#f2efe8", rough: 0.6 });
  const put = (along: number, yy: number, d: number, sw: number, sh: number, t: number) =>
    axis === "z" ? box(ctx, sw, sh, t, { parent, pos: [along, yy, at + inward * d], mat: frame }) : box(ctx, t, sh, sw, { parent, pos: [at + inward * d, yy, along], mat: frame });
  put(u, WINDOW.y1 + 0.05, 0.02, w + 0.2, 0.1, 0.04);
  put(u, WINDOW.y0 - 0.03, 0.08, w + 0.3, 0.06, 0.18); // sill
  put(u - w / 2 - 0.05, y, 0.02, 0.1, h, 0.04);
  put(u + w / 2 + 0.05, y, 0.02, 0.1, h, 0.04);
  curtains(ctx, parent, doors, { axis, at, inward, u, y, w, h, color: curtain });
}

/** Only the big furniture casts shadows (small props would cost more than they add). */
const BIG_CASTERS = /^(bed|wardrobe|sofa-modern|armchair|dining-table|bookshelf|grandfather-clock|kitchen-cabinet|stove)\.glb$/;

function model(ctx: Ctx, parent: Node, file: string, x: number, z: number, yaw: number, scale = 1, y = Y) {
  return instantiate(ctx, file, parent, { pos: [x, y, z], rot: [0, yaw, 0], scale, cast: BIG_CASTERS.test(file), background: true }).then((h: TransformNode) => {
    for (const m of h.getChildMeshes()) m.isPickable = false;
    return h;
  });
}

/** The bedroom and the kitchen, both opening off the entrance hall. */
export function buildHomeRooms(ctx: Ctx, parent: Node, doors: DoorSystem) {
  const root = group(ctx, { parent });
  const colliders: Col[] = [];
  const H = ROOM_H - Y;
  // each room its own finish: blue damask wallpaper in the bedroom, sage paint in the kitchen
  const wallMat = wallpaper(ctx, "damask", 6, 2);
  const kitWall = wallpaper(ctx, "sage", 4, 2);
  const parquet = lit(ctx, { color: "#8a5f3c", rough: 0.55 });
  const tilesTex = canvasTexture(ctx, 128, 128, (g) => {
    g.fillStyle = "#d9d2c4";
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const v = hash(i * 4 + j, 2);
        g.fillStyle = (i + j) % 2 ? `rgb(${224 + v * 10},${218 + v * 10},${206 + v * 10})` : `rgb(${168 + v * 10},${150 + v * 10},${126 + v * 10})`;
        g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30);
      }
  });
  tilesTex.uScale = tilesTex.vScale = 4;
  tilesTex.hasAlpha = false;
  tilesTex.wrapU = tilesTex.wrapV = 1; // WRAP
  const kitFloor = lit(ctx, { rough: 0.4 });
  kitFloor.albedoTexture = tilesTex;
  const ceiling = lit(ctx, { color: "#f7f4ee", rough: 0.95 });
  const darkWood = lit(ctx, { color: "#4a3020", rough: 0.6 });
  // ---- shells: floor, ceiling, back wall (the house walls close the other sides)
  for (const [r, floor, wall] of [[BED, parquet, wallMat], [KIT, kitFloor, kitWall]] as const) {
    const cx = (r.x0 + r.x1) / 2, w = r.x1 - r.x0, d = FRONT - BACK_Z, cz = (FRONT + BACK_Z) / 2;
    box(ctx, w, 0.1, d, { parent: root, pos: [cx, Y - 0.04, cz], receive: true, mat: floor });
    box(ctx, w, 0.1, d, { parent: root, pos: [cx, ROOM_H + 0.05, cz], mat: ceiling });
    box(ctx, w, H, 0.2, { parent: root, pos: [cx, Y + H / 2, BACK_Z], receive: true, mat: wall });
    // the inner faces of the house's outer walls in the room's own finish, with the window openings
    const lining = (axis: "x" | "z", at: number, u0: number, u1: number, holes: number[]) => {
      let u = u0;
      const put = (a: number, c: number, ya: number, yc: number) => {
        if (c - a < 0.01 || yc - ya < 0.01) return;
        if (axis === "z") box(ctx, c - a, yc - ya, 0.02, { parent: root, pos: [(a + c) / 2, (ya + yc) / 2, at], mat: wall });
        else box(ctx, 0.02, yc - ya, c - a, { parent: root, pos: [at, (ya + yc) / 2, (a + c) / 2], mat: wall });
      };
      for (const h of holes.sort((p_, q_) => p_ - q_)) {
        const a = h - WINDOW.w / 2, c = h + WINDOW.w / 2;
        put(u, a, Y, ROOM_H);
        put(a, c, Y, WINDOW.y0);
        put(a, c, WINDOW.y1, ROOM_H);
        u = c;
      }
      put(u, u1, Y, ROOM_H);
    };
    lining("z", FRONT - 0.04, r.x0, r.x1, FRONT_WINDOWS.filter((x_) => x_ > r.x0 && x_ < r.x1));
    if (r === BED) lining("x", HOUSE.x0 + 0.32, BACK_Z, FRONT, [SIDE_WINDOW_Z]);
    else lining("x", HOUSE.x1 - 0.32, BACK_Z, FRONT, [SIDE_WINDOW_Z]);
    // skirting
    box(ctx, w, 0.12, 0.04, { parent: root, pos: [cx, Y + 0.06, BACK_Z + 0.12], mat: darkWood });
    box(ctx, w, 0.12, 0.04, { parent: root, pos: [cx, Y + 0.06, FRONT - 0.06], mat: darkWood });
  }

  // ---- doors from the hall
  doors.add({ parent: root, y: Y, hinge: [CORRIDOR_X0 - 0.1, HOME_DOOR_Z], dir: [0, 1], side: 1, color: "#6b4a2b" });
  doors.add({ parent: root, y: Y, hinge: [CORRIDOR_X1 + 0.1, HOME_DOOR_Z], dir: [0, 1], side: -1, color: "#6b4a2b" });

  // ================================================================ bedroom
  for (const x of FRONT_WINDOWS.filter((x) => x > BED.x0 && x < BED.x1)) innerWindow(ctx, root, doors, "z", FRONT, -1, x, "#7a3a4a");
  innerWindow(ctx, root, doors, "x", HOUSE.x0 + 0.3, 1, SIDE_WINDOW_Z, "#7a3a4a");
  const bx = -6.5;
  box(ctx, 5.0, 0.02, 3.6, { parent: root, pos: [bx, Y + 0.012, 45.4], mat: gilam(ctx, "#6a1d2a", "#e0b45a") });
  // the bed against the back wall, cushions, a nightstand each side with a lamp, an alarm clock
  model(ctx, root, "bed.glb", bx, BACK_Z + 1.25, 0, 1.15).catch(() => {});
  model(ctx, root, "pillows.glb", bx, BACK_Z + 0.75, 0, 0.75, Y + 0.62).catch(() => {});
  colliders.push({ x: bx, z: BACK_Z + 1.35, hx: 0.95, hz: 1.2 });
  for (const nx of [bx - 1.3, bx + 1.3]) {
    model(ctx, root, "nightstand.glb", nx, BACK_Z + 0.4, 0, 1).catch(() => {});
    colliders.push({ x: nx, z: BACK_Z + 0.4, hx: 0.3, hz: 0.3 });
    cylinder(ctx, 0.12, 0.08, 0.32, 14, { parent: root, pos: [nx + 0.1, Y + 0.86, BACK_Z + 0.35], mat: lit(ctx, { color: "#f3e3c3", emissive: "#ffd79a", ei: 0.4 }) });
  }
  model(ctx, root, "alarm-clock.glb", bx - 1.42, BACK_Z + 0.45, 0.3, 1, Y + 0.7).catch(() => {});
  model(ctx, root, "succulent.glb", bx + 1.2, BACK_Z + 0.45, 0, 1, Y + 0.7).catch(() => {});
  // pictures over the bed
  picture(ctx, root, bx, Y + 2.45, BACK_Z + 0.11, 0, 1.6, 0.9, 5);
  picture(ctx, root, bx - 2.3, Y + 2.25, BACK_Z + 0.11, 0, 0.6, 0.8, 6);
  picture(ctx, root, bx + 2.3, Y + 2.25, BACK_Z + 0.11, 0, 0.6, 0.8, 7);
  // a carved chest at the foot of the bed
  box(ctx, 1.4, 0.5, 0.55, { parent: root, pos: [bx, Y + 0.25, BACK_Z + 2.75], cast: true, mat: darkWood });
  box(ctx, 1.45, 0.05, 0.6, { parent: root, pos: [bx, Y + 0.52, BACK_Z + 2.75], mat: lit(ctx, { color: "#b08a3c", rough: 0.35, metal: 0.7 }) });
  colliders.push({ x: bx, z: BACK_Z + 2.75, hx: 0.72, hz: 0.3 });
  // bookshelf full of books, and a reading armchair by the window
  model(ctx, root, "bookshelf.glb", BED.x0 + 2.6, BACK_Z + 0.35, 0, 1.1).catch(() => {});
  for (let k = 0; k < 4; k++) model(ctx, root, "books.glb", BED.x0 + 2.1, BACK_Z + 0.35, 0, 1, Y + 0.12 + k * 0.5).catch(() => {});
  colliders.push({ x: BED.x0 + 2.6, z: BACK_Z + 0.35, hx: 0.8, hz: 0.35 });
  model(ctx, root, "armchair.glb", BED.x0 + 0.9, 42.4, Math.PI / 2 + 0.4, 1).catch(() => {});
  addSeat(ctx, doors, seatOf(BED.x0 + 0.9, 42.4, Math.PI / 2 + 0.4, Y));
  addSeat(ctx, doors, { x: DESK.x, z: DESK.z + 0.85, yaw: Math.PI, y: Y }); // at the computer
  model(ctx, root, "floor-vase.glb", BED.x0 + 0.35, 41.0, 0, 1.3).catch(() => {});
  colliders.push({ x: BED.x0 + 0.9, z: 42.4, hx: 0.5, hz: 0.5 });
  // wardrobe on the side wall, a full-length mirror by the door
  model(ctx, root, "wardrobe.glb", BED.x0 + 0.5, 47.8, Math.PI / 2, 1).catch(() => {});
  colliders.push({ x: BED.x0 + 0.5, z: 47.8, hx: 0.55, hz: 0.95 });
  mirror(ctx, root, BED.x1 - 0.02, Y + 1.2, 47.9, -Math.PI / 2, 2.4, true, { x0: BED.x0, x1: BED.x1, z0: BACK_Z, z1: FRONT }); // full-length
  model(ctx, root, "wall-clock.glb", BED.x1 - 0.02, 42.4, -Math.PI / 2, 1.2, Y + 2.45).catch(() => {});
  // more of a lived-in room: a dressing table with a mirror and a stool, a wall shelf with books,
  // a vase on the chest, a bedside rug, a big plant by the window
  const dtX = BED.x0 + 4.9;
  box(ctx, 1.1, 0.06, 0.45, { parent: root, pos: [dtX, Y + 0.78, BACK_Z + 0.33], cast: true, mat: darkWood });
  box(ctx, 1.06, 0.72, 0.42, { parent: root, pos: [dtX, Y + 0.38, BACK_Z + 0.33], mat: darkWood });
  for (const dy of [0.2, 0.5]) box(ctx, 0.9, 0.02, 0.02, { parent: root, pos: [dtX, Y + dy, BACK_Z + 0.55], mat: lit(ctx, { color: "#b08a3c", rough: 0.3, metal: 0.8 }) });
  mirror(ctx, root, dtX, Y + 1.15, BACK_Z + 0.12, 0, 1.3, false);
  model(ctx, root, "ceramic-vase.glb", dtX - 0.35, BACK_Z + 0.33, 0, 0.7, Y + 0.81).catch(() => {});
  model(ctx, root, "succulent.glb", dtX + 0.35, BACK_Z + 0.33, 0, 0.9, Y + 0.81).catch(() => {});
  model(ctx, root, "stool.glb", dtX, BACK_Z + 0.95, 0, 1.0).catch(() => {});
  colliders.push({ x: dtX, z: BACK_Z + 0.4, hx: 0.58, hz: 0.3 });
  // wall shelf with books above the desk
  box(ctx, 1.4, 0.04, 0.25, { parent: root, pos: [DESK.x, Y + 2.0, BACK_Z + 0.22], mat: darkWood });
  model(ctx, root, "books.glb", DESK.x - 0.6, BACK_Z + 0.22, 0, 1, Y + 2.02).catch(() => {});
  model(ctx, root, "brass-vase.glb", DESK.x + 0.45, BACK_Z + 0.22, 0, 0.5, Y + 2.02).catch(() => {});
  model(ctx, root, "brass-vase.glb", bx - 0.4, BACK_Z + 2.75, 0, 0.5, Y + 0.55).catch(() => {});

  model(ctx, root, "potted-plant-2.glb", BED.x0 + 0.55, 45.2, 0, 1.2).catch(() => {});
  colliders.push({ x: BED.x0 + 0.55, z: 45.2, hx: 0.45, hz: 0.45 });
  box(ctx, 0.8, 0.02, 1.8, { parent: root, pos: [bx - 1.55, Y + 0.013, BACK_Z + 1.4], mat: gilam(ctx, "#1d3b6b", "#e8c06a") });

  // the desk with the computer (F there opens the CSS exercises)
  colliders.push(...buildDesk(ctx, root, DESK.x, Y, DESK.z, 0));
  model(ctx, root, "potted-plant.glb", BED.x1 - 0.5, FRONT - 0.6, 0, 1).catch(() => {});
  model(ctx, root, "potted-plant-2.glb", BED.x0 + 0.6, FRONT - 0.6, 0, 1).catch(() => {});
  colliders.push({ x: BED.x1 - 0.5, z: FRONT - 0.6, hx: 0.35, hz: 0.35 }, { x: BED.x0 + 0.6, z: FRONT - 0.6, hx: 0.4, hz: 0.4 });
  addPendant(ctx, root, bx, 45.4, ROOM_H, "#ffe2b8", 7, 10);
  addPendant(ctx, root, -1.4, 43.2, ROOM_H, "#ffe9cc", 4, 7);
  addPendant(ctx, root, BED.x0 + 2.5, 46, ROOM_H, "#ffe2b8", 4, 8);

  // ================================================================ kitchen
  for (const x of FRONT_WINDOWS.filter((x) => x > KIT.x0 && x < KIT.x1)) innerWindow(ctx, root, doors, "z", FRONT, -1, x, "#d9c27a");
  innerWindow(ctx, root, doors, "x", HOUSE.x1 - 0.3, -1, SIDE_WINDOW_Z, "#d9c27a");
  // fitted units along the east wall: base cabinets with doors, worktop, sink, the stove,
  // wall cupboards, tiled splashback, fridge
  const unitMat = lit(ctx, { color: "#f0ece4", rough: 0.5 });
  const doorMat = lit(ctx, { color: "#e3dccd", rough: 0.45 });
  const worktop = lit(ctx, { color: "#3a3631", rough: 0.25, metal: 0.1 });
  const handle = lit(ctx, { color: "#b8bcc2", rough: 0.25, metal: 0.9 });
  const ux = KIT.x1 - 0.32;
  const unitZ0 = 42.2, unitZ1 = 49.6;
  const stoveZ = 45.4;
  box(ctx, 0.62, 0.86, unitZ1 - unitZ0, { parent: root, pos: [ux, Y + 0.43, (unitZ0 + unitZ1) / 2], cast: true, mat: unitMat });
  box(ctx, 0.66, 0.05, unitZ1 - unitZ0, { parent: root, pos: [ux, Y + 0.885, (unitZ0 + unitZ1) / 2], mat: worktop });
  for (let z = unitZ0 + 0.3; z < unitZ1; z += 0.6) {
    if (Math.abs(z - stoveZ) < 0.4) continue;
    box(ctx, 0.02, 0.78, 0.56, { parent: root, pos: [ux - 0.32, Y + 0.43, z], mat: doorMat });
    box(ctx, 0.03, 0.03, 0.2, { parent: root, pos: [ux - 0.34, Y + 0.72, z], mat: handle });
    // wall cupboards above
    box(ctx, 0.02, 0.62, 0.56, { parent: root, pos: [KIT.x1 - 0.39, Y + 2.25, z], mat: doorMat });
    box(ctx, 0.03, 0.18, 0.03, { parent: root, pos: [KIT.x1 - 0.41, Y + 2.05, z + 0.2], mat: handle });
  }
  box(ctx, 0.36, 0.66, unitZ1 - unitZ0, { parent: root, pos: [KIT.x1 - 0.2, Y + 2.25, (unitZ0 + unitZ1) / 2], cast: true, mat: unitMat });
  const tiles = canvasTexture(ctx, 128, 64, (g) => {
    g.fillStyle = "#e9eef0";
    g.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 3 === 0 ? "#3f6d8a" : "#f6f8f9";
        g.fillRect(i * 16 + 1, j * 16 + 1, 14, 14);
      }
  });
  tiles.uScale = 6;
  tiles.wrapU = tiles.wrapV = 1;
  const splash = lit(ctx, { rough: 0.3 });
  splash.albedoTexture = tiles;
  box(ctx, 0.02, 0.98, unitZ1 - unitZ0, { parent: root, pos: [KIT.x1 - 0.02, Y + 1.4, (unitZ0 + unitZ1) / 2], mat: splash });
  box(ctx, 0.5, 0.06, 0.8, { parent: root, pos: [ux, Y + 0.89, 47.8], mat: handle }); // sink
  cylinder(ctx, 0.02, 0.02, 0.35, 8, { parent: root, pos: [ux + 0.2, Y + 1.08, 47.8], mat: handle });
  box(ctx, 0.2, 0.03, 0.03, { parent: root, pos: [ux + 0.1, Y + 1.25, 47.8], mat: handle });
  colliders.push({ x: ux, z: (unitZ0 + unitZ1) / 2, hx: 0.35, hz: (unitZ1 - unitZ0) / 2 });
  model(ctx, root, "stove.glb", ux - 0.02, stoveZ, -Math.PI / 2, 1).catch(() => {});
  model(ctx, root, "pot.glb", ux + 0.05, stoveZ - 0.12, 0, 1.2, Y + 0.87).catch(() => {});
  buildCooking(ctx, root, { pot: new Vector3(ux + 0.05, Y + 0.87 + 0.22, stoveZ - 0.12), kettle: new Vector3(ux - 0.2, Y + 0.87 + 0.26, stoveZ + 0.18), burnerY: Y + 0.868 });
  model(ctx, root, "pan.glb", ux - 0.05, 46.4, 0.6, 1.2, Y + 0.91).catch(() => {});
  model(ctx, root, "kettle.glb", ux - 0.05, stoveZ + 0.18, -Math.PI / 2, 1, Y + 0.87).catch(() => {});
  model(ctx, root, "tea-set.glb", ux, 43.0, -Math.PI / 2, 0.6, Y + 0.91).catch(() => {});
  model(ctx, root, "cutting-board.glb", ux - 0.05, 46.6, 0.2, 1.2, Y + 0.91).catch(() => {});
  model(ctx, root, "jug.glb", ux + 0.05, 49.2, 0, 1, Y + 0.91).catch(() => {});
  model(ctx, root, "ceramic-vase.glb", ux + 0.1, 42.6, 0, 0.8, Y + 0.91).catch(() => {});
  // fridge
  box(ctx, 0.7, 1.95, 0.75, { parent: root, pos: [KIT.x1 - 0.38, Y + 0.975, 41.4], cast: true, mat: lit(ctx, { color: "#e9ecef", rough: 0.3, metal: 0.2 }) });
  box(ctx, 0.03, 0.6, 0.03, { parent: root, pos: [KIT.x1 - 0.74, Y + 1.3, 41.1], mat: handle });
  box(ctx, 0.03, 0.35, 0.03, { parent: root, pos: [KIT.x1 - 0.74, Y + 0.75, 41.1], mat: handle });
  colliders.push({ x: KIT.x1 - 0.38, z: 41.4, hx: 0.38, hz: 0.4 });

  // kitchen island with stools and a fruit bowl
  const ix = KIT.x1 - 3.4, iz = 45.6;
  box(ctx, 0.95, 0.88, 2.6, { parent: root, pos: [ix, Y + 0.44, iz], cast: true, mat: lit(ctx, { color: "#5a3b25", rough: 0.55 }) });
  box(ctx, 1.1, 0.05, 2.75, { parent: root, pos: [ix, Y + 0.905, iz], mat: worktop });
  colliders.push({ x: ix, z: iz, hx: 0.55, hz: 1.4 });
  for (const sz of [iz - 0.85, iz, iz + 0.85]) {
    model(ctx, root, "stool.glb", ix - 0.95, sz, Math.PI / 2, 1.5).catch(() => {});
    colliders.push({ x: ix - 0.95, z: sz, hx: 0.25, hz: 0.25 });
  }
  model(ctx, root, "bowl.glb", ix, iz - 0.6, 0, 1.3, Y + 0.93).catch(() => {});
  for (const [ax, az] of [[-0.05, -0.65], [0.06, -0.55], [0.02, -0.7]]) model(ctx, root, "apple.glb", ix + ax, iz + az, hash(ax, az) * 6, 1, Y + 0.98).catch(() => {});
  model(ctx, root, "lemon.glb", ix + 0.1, iz - 0.68, 0, 1, Y + 1.0).catch(() => {});
  model(ctx, root, "bananas.glb", ix, iz + 0.5, 1.2, 0.8, Y + 0.97).catch(() => {});

  // dining table with four chairs; tea, bread and a lagan on it
  const tx = KIT.x0 + 3.8, tz = 46;
  box(ctx, 3.2, 0.02, 3.8, { parent: root, pos: [tx, Y + 0.012, tz], mat: gilam(ctx, "#1f4a5a", "#e8c06a") });
  model(ctx, root, "dining-table.glb", tx, tz, Math.PI / 2, 1).catch(() => {});
  colliders.push({ x: tx, z: tz, hx: 0.75, hz: 1.2 });
  for (const [cx, cz, yaw] of [[tx - 1.0, tz - 0.6, Math.PI / 2], [tx - 1.0, tz + 0.6, Math.PI / 2], [tx + 1.0, tz - 0.6, -Math.PI / 2], [tx + 1.0, tz + 0.6, -Math.PI / 2]] as [number, number, number][]) {
    model(ctx, root, "dining-chair.glb", cx, cz, yaw, 1).catch(() => {});
    addSeat(ctx, doors, seatOf(cx, cz, yaw, Y));
    colliders.push({ x: cx, z: cz, hx: 0.3, hz: 0.3 });
  }
  const tableTop = Y + 0.87;
  cylinder(ctx, 0.3, 0.3, 0.02, 24, { parent: root, pos: [tx, tableTop + 0.01, tz - 0.55], mat: lit(ctx, { color: "#2f5d8a", rough: 0.3 }) }); // lagan
  model(ctx, root, "basket.glb", tx, tz - 0.55, 0.4, 1, tableTop + 0.02).catch(() => {});
  model(ctx, root, "tea-set.glb", tx, tz + 0.4, Math.PI / 2, 0.9, tableTop).catch(() => {});

  // dressers with the china along the back wall, a clock above
  for (const dx of [KIT.x0 + 1.2, KIT.x0 + 2.8]) {
    model(ctx, root, "kitchen-cabinet.glb", dx, BACK_Z + 0.4, 0, 1.2).catch(() => {});
    colliders.push({ x: dx, z: BACK_Z + 0.4, hx: 0.75, hz: 0.35 });
  }
  model(ctx, root, "ceramic-pot.glb", KIT.x0 + 1.2, BACK_Z + 0.4, 0, 0.6, Y + 2.26).catch(() => {});
  model(ctx, root, "wall-clock.glb", KIT.x0 + 5.6, BACK_Z + 0.12, 0, 1.4, Y + 2.4).catch(() => {});
  picture(ctx, root, KIT.x0 + 7.6, Y + 2.0, BACK_Z + 0.11, 0, 1.0, 0.7, 8);
  model(ctx, root, "potted-plant.glb", KIT.x0 + 0.6, FRONT - 0.6, 0, 1).catch(() => {});
  model(ctx, root, "succulent.glb", KIT.x0 + 6.0, BACK_Z + 0.3, 0, 1.2).catch(() => {});
  colliders.push({ x: KIT.x0 + 0.6, z: FRONT - 0.6, hx: 0.35, hz: 0.35 });
  addPendant(ctx, root, tx, tz, ROOM_H, "#ffe6c0", 6, 9);
  addPendant(ctx, root, ix, iz - 0.7, ROOM_H, "#fff0d8", 4, 7);
  addPendant(ctx, root, ix, iz + 0.7, ROOM_H, "#fff0d8", 4, 7);

  ctx.colliders.push(...colliders);
  return root;
}
