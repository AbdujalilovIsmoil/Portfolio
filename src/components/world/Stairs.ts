import type { Node } from "@babylonjs/core";
import { DOOR_W, type DoorSystem } from "./Doors";
import { CORRIDOR_X0, CORRIDOR_X1 } from "./Corridor";
import { ROOM_H } from "./Room";
import { box, group, lit, staticLight, type Ctx, type Region } from "./core";
import { addPendant } from "./Lamps";
import { buildHouseFront } from "./House";
import { HOME_DOOR_Z } from "./HomeRooms";

import { CITY_Y, FRONT_DOOR_X, FRONT_Z, POOL_FLOOR_Y, inPool, isOutdoors } from "./cityLayout";
export { CITY_Y, FRONT_DOOR_X, FRONT_Z };
export const STAIR_Z0 = 39;
const STEPS = 3; // the rooms sit on a 0.6 m plinth above the yard
const RISE = 0.2;
const RUN = 0.32;
export const STAIR_Z1 = STAIR_Z0 + STEPS * RUN; // 39.96
export const FACADE_X0 = -11;
export const FACADE_X1 = 16;

export const STAIRS_REGIONS: Region[] = [
  { x0: CORRIDOR_X0, x1: CORRIDOR_X1, z0: STAIR_Z0 - 1.5, z1: STAIR_Z1 + 1.5 },
  // Landing + front door, at full corridor width: the door's own collider (see Doors.ts)
  // already restricts passage to its actual opening, so this can safely reach past the
  // door and overlap CITY_REGION — narrowing it here previously left a margin-shrunk gap
  // right at the doorway that could stop the player from stepping off the stairs.
  { x0: CORRIDOR_X0, x1: CORRIDOR_X1, z0: STAIR_Z1 - 1.5, z1: FRONT_Z + 3 },
];

/** Stepped floor height along the stairs; flat elsewhere. */
export function groundY(x: number, z: number) {
  // outdoors you stand on the lawn / paving, which sit a few centimetres above the base level
  if (isOutdoors(x, z)) return inPool(x, z) ? POOL_FLOOR_Y : CITY_Y + 0.07;
  if (z < STAIR_Z0) return 0;
  if (z >= STAIR_Z1) return CITY_Y;
  if (x < CORRIDOR_X0 - 0.2 || x > CORRIDOR_X1 + 0.2) return 0;
  return -Math.floor((z - STAIR_Z0) / RUN) * RISE;
}

export function buildStairs(ctx: Ctx, parent: Node, doors: DoorSystem) {
  const root = group(ctx, { parent });
  const cx = (CORRIDOR_X0 + CORRIDOR_X1) / 2;
  const w = CORRIDOR_X1 - CORRIDOR_X0;
  const wall = lit(ctx, { color: "#e6d9c2", rough: 0.9, double: true });
  const stepMat = lit(ctx, { color: "#7a5234", rough: 0.6 });

  for (let i = 0; i < STEPS; i++) {
    const top = -i * RISE;
    const h = top - CITY_Y;
    box(ctx, w, h, RUN, { parent: root, pos: [cx, CITY_Y + h / 2, STAIR_Z0 + i * RUN + RUN / 2], receive: true, mat: stepMat });
  }
  // landing floor + stairwell shell
  // Raised a hair above CITY_Y so its top doesn't sit exactly coplanar with the City.ts
  // sidewalk slab outside the front door — same Y on both caused z-fighting (flickering)
  // right under the doorway when the two floors overlapped.
  const len = FRONT_Z - STAIR_Z1;
  box(ctx, w, 0.1, len, { parent: root, pos: [cx, CITY_Y - 0.04, STAIR_Z1 + len / 2], receive: true, mat: lit(ctx, { color: "#8a6a4a", rough: 0.55 }) });
  const shellLen = FRONT_Z - STAIR_Z0;
  const shellH = ROOM_H - CITY_Y;
  // hall walls, each with a doorway: bedroom on the left, kitchen on the right (HomeRooms.ts)
  const dz0 = HOME_DOOR_Z, dz1 = HOME_DOOR_Z + DOOR_W;
  for (const x of [CORRIDOR_X0 - 0.1, CORRIDOR_X1 + 0.1]) {
    box(ctx, 0.2, shellH, dz0 - STAIR_Z0, { parent: root, pos: [x, CITY_Y + shellH / 2, (STAIR_Z0 + dz0) / 2], receive: true, mat: wall });
    box(ctx, 0.2, shellH, FRONT_Z - dz1, { parent: root, pos: [x, CITY_Y + shellH / 2, (dz1 + FRONT_Z) / 2], receive: true, mat: wall });
    box(ctx, 0.2, shellH - 2.4, DOOR_W, { parent: root, pos: [x, CITY_Y + 2.4 + (shellH - 2.4) / 2, (dz0 + dz1) / 2], mat: wall });
  }
  box(ctx, w, 0.1, shellLen, { parent: root, pos: [cx, ROOM_H + 0.05, STAIR_Z0 + shellLen / 2], mat: lit(ctx, { color: "#ecebe6", rough: 0.95 }) });
  // handrails
  const rail = lit(ctx, { color: "#20242b", rough: 0.35, metal: 0.8 });
  for (const x of [CORRIDOR_X0 + 0.12, CORRIDOR_X1 - 0.12]) {
    const rl = box(ctx, 0.05, 0.05, Math.hypot(STEPS * RUN, STEPS * RISE), { parent: root, pos: [x, -STEPS * RISE * 0.5 + 0.95, STAIR_Z0 + (STEPS * RUN) / 2], mat: rail });
    rl.rotation.x = Math.atan2(STEPS * RISE, STEPS * RUN);
  }

  // ---- the street face of the house (always drawn: it is also this stairwell's end wall)
  buildHouseFront(ctx, root, DOOR_W);

  doors.add({ parent: root, y: CITY_Y, hinge: [FRONT_DOOR_X - DOOR_W / 2, FRONT_Z + 0.1], dir: [1, 0], side: -1, color: "#2a3a4f" });

  // wall lantern beside the front door
  box(ctx, 0.22, 0.34, 0.22, { parent: root, pos: [FRONT_DOOR_X - 1.3, CITY_Y + 2.3, FRONT_Z + 0.45], mat: lit(ctx, { color: "#1d1f24", emissive: "#ffd79a", ei: 0.8 }) });
  staticLight(ctx, root, [FRONT_DOOR_X, CITY_Y + 2.4, FRONT_Z + 0.9], "#fff0d0", 6, 8);

  addPendant(ctx, root, cx, STAIR_Z0 + 1.5, ROOM_H, "#ffe6c0", 7, 10);
  addPendant(ctx, root, cx, FRONT_Z - 2.2, ROOM_H, "#ffe6c0", 7, 10);
  return root;
}
