import type { Node } from "@babylonjs/core";
import { DOOR_W, type DoorSystem } from "./Doors";
import { CORRIDOR_X0, CORRIDOR_X1 } from "./Corridor";
import { ROOM_H } from "./Room";
import { box, canvasTexture, group, lit, staticLight, unlit, type Ctx, type Region } from "./core";
import { addPendant } from "./Lamps";

export const CITY_Y = -3.6;
export const STAIR_Z0 = 39;
const STEPS = 18;
const RISE = 0.2;
const RUN = 0.32;
export const STAIR_Z1 = STAIR_Z0 + STEPS * RUN; // 44.76
export const FRONT_Z = 50.1;
export const FRONT_DOOR_X = 3.0;
export const FACADE_X0 = -11;
export const FACADE_X1 = 16;

export const STAIRS_REGIONS: Region[] = [
  { x0: CORRIDOR_X0, x1: CORRIDOR_X1, z0: STAIR_Z0 - 1.5, z1: STAIR_Z1 + 1.5 },
  { x0: CORRIDOR_X0, x1: CORRIDOR_X1, z0: STAIR_Z1 - 1.5, z1: FRONT_Z - 0.05 },
  { x0: FRONT_DOOR_X - DOOR_W / 2, x1: FRONT_DOOR_X + DOOR_W / 2, z0: FRONT_Z - 1.4, z1: FRONT_Z + 2.2 },
];

/** Stepped floor height along the stairs; flat elsewhere. */
export function groundY(x: number, z: number) {
  if (z < STAIR_Z0) return 0;
  if (z >= STAIR_Z1) return CITY_Y;
  if (x < CORRIDOR_X0 - 0.2 || x > CORRIDOR_X1 + 0.2) return 0;
  return -Math.floor((z - STAIR_Z0) / RUN) * RISE;
}

export function facadeTexture(ctx: Ctx, hue: string, cols = 6, rows = 8) {
  return canvasTexture(ctx, 256, 256, (g) => {
    g.fillStyle = hue;
    g.fillRect(0, 0, 256, 256);
    const w = 256 / cols;
    const h = 256 / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const lit_ = ((r * 7 + c * 13) % 5) < 2;
        g.fillStyle = lit_ ? "#ffe9a8" : "#5b7fa6";
        g.fillRect(c * w + w * 0.2, r * h + h * 0.2, w * 0.6, h * 0.55);
        g.fillStyle = "rgba(255,255,255,0.25)";
        g.fillRect(c * w + w * 0.2, r * h + h * 0.2, w * 0.6, 3);
      }
  });
}

export function buildStairs(ctx: Ctx, parent: Node, doors: DoorSystem) {
  const root = group(ctx, { parent });
  const cx = (CORRIDOR_X0 + CORRIDOR_X1) / 2;
  const w = CORRIDOR_X1 - CORRIDOR_X0;
  const wall = lit(ctx, { color: "#c9d2d6", rough: 0.9, double: true });
  const stepMat = lit(ctx, { color: "#8a8f99", rough: 0.55 });
  const nosing = lit(ctx, { color: "#39d0ff", emissive: "#39d0ff", ei: 0.9 });

  for (let i = 0; i < STEPS; i++) {
    const top = -i * RISE;
    const h = top - CITY_Y;
    box(ctx, w, h, RUN, { parent: root, pos: [cx, CITY_Y + h / 2, STAIR_Z0 + i * RUN + RUN / 2], receive: true, mat: stepMat });
    box(ctx, w, 0.02, 0.04, { parent: root, pos: [cx, top + 0.01, STAIR_Z0 + i * RUN + 0.03], mat: nosing });
  }
  // landing floor + stairwell shell
  const len = FRONT_Z - STAIR_Z1;
  box(ctx, w, 0.1, len, { parent: root, pos: [cx, CITY_Y - 0.05, STAIR_Z1 + len / 2], receive: true, mat: lit(ctx, { color: "#4a505c", rough: 0.4 }) });
  const shellLen = FRONT_Z - STAIR_Z0;
  const shellH = ROOM_H - CITY_Y;
  for (const x of [CORRIDOR_X0 - 0.1, CORRIDOR_X1 + 0.1]) box(ctx, 0.2, shellH, shellLen, { parent: root, pos: [x, CITY_Y + shellH / 2, STAIR_Z0 + shellLen / 2], receive: true, mat: wall });
  box(ctx, w, 0.1, shellLen, { parent: root, pos: [cx, ROOM_H + 0.05, STAIR_Z0 + shellLen / 2], mat: lit(ctx, { color: "#ecebe6", rough: 0.95 }) });
  // handrails
  const rail = lit(ctx, { color: "#20242b", rough: 0.35, metal: 0.8 });
  for (const x of [CORRIDOR_X0 + 0.12, CORRIDOR_X1 - 0.12]) {
    const rl = box(ctx, 0.05, 0.05, Math.hypot(STEPS * RUN, STEPS * RISE), { parent: root, pos: [x, -STEPS * RISE * 0.5 + 0.95, STAIR_Z0 + (STEPS * RUN) / 2], mat: rail });
    rl.rotation.x = Math.atan2(STEPS * RISE, STEPS * RUN);
  }

  // exit sign on the front wall
  box(ctx, 0.9, 0.28, 0.04, { parent: root, pos: [cx + 1.0, CITY_Y + 2.7, FRONT_Z - 0.2], mat: lit(ctx, { color: "#39d98a", emissive: "#39d98a", ei: 2 }) });

  // ---- front facade of the whole building (double-sided so the inside is visible too)
  const fac = lit(ctx, { double: true, rough: 0.8 });
  fac.albedoTexture = facadeTexture(ctx, "#8d7f72", 10, 6);
  const fH = 17.6;
  const fY = CITY_Y + fH / 2;
  const front = (x0: number, x1: number, y: number, h: number) => {
    const m = box(ctx, x1 - x0, h, 0.3, { parent: root, pos: [(x0 + x1) / 2, y, FRONT_Z + 0.15], receive: true, mat: fac });
    const uv = m.getVerticesData("uv");
    if (uv) {
      for (let i = 0; i < uv.length; i += 2) {
        uv[i] *= (x1 - x0) / 10;
        uv[i + 1] *= h / 6;
      }
      m.setVerticesData("uv", uv);
    }
    return m;
  };
  const dx0 = FRONT_DOOR_X - DOOR_W / 2 - 0.1;
  const dx1 = FRONT_DOOR_X + DOOR_W / 2 + 0.1;
  front(FACADE_X0, dx0, fY, fH);
  front(dx1, FACADE_X1, fY, fH);
  front(dx0, dx1, CITY_Y + 2.45 + (fH - 2.45) / 2, fH - 2.45);

  doors.add({ parent: root, y: CITY_Y, hinge: [FRONT_DOOR_X - DOOR_W / 2, FRONT_Z + 0.1], dir: [1, 0], side: -1, color: "#2a3a4f" });

  // canopy + lamp above the exit door
  box(ctx, 2.6, 0.12, 1.2, { parent: root, pos: [FRONT_DOOR_X, CITY_Y + 2.75, FRONT_Z + 0.9], mat: lit(ctx, { color: "#20242b", rough: 0.4, metal: 0.6 }) });
  box(ctx, 0.4, 0.05, 0.4, { parent: root, pos: [FRONT_DOOR_X, CITY_Y + 2.68, FRONT_Z + 0.9], mat: unlit(ctx, { color: "#fff6dc" }) });
  staticLight(ctx, root, [FRONT_DOOR_X, CITY_Y + 2.4, FRONT_Z + 0.9], "#fff0d0", 6, 8);

  addPendant(ctx, root, cx, STAIR_Z0 + 1.5, ROOM_H, "#ffe6c0", 7, 10);
  addPendant(ctx, root, cx, FRONT_Z - 2.2, ROOM_H, "#ffe6c0", 7, 10);
  return root;
}
