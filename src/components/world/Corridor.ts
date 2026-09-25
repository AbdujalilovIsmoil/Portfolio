import type { Node } from "@babylonjs/core";
import { DOOR_X, ROOM_H, ROOM_HZ } from "./Room";
import { DOOR_W, type DoorSystem } from "./Doors";
import { addPendant } from "./Lamps";
import { box, group, lit, type Ctx, type Region } from "./core";

export const CORRIDOR_X0 = 1.5;
export const CORRIDOR_X1 = 4.5;
export const CORRIDOR_LEN = 34;
export const GAME_DOOR_Z = 11;
const Z1 = ROOM_HZ + CORRIDOR_LEN;
const T = 0.2;
const SIDE_DOOR_ZS = [11, 20, 29];

/** Walkable areas: doorways + corridor (the rooms add their own). */
export const CORRIDOR_REGIONS: Region[] = [
  { x0: DOOR_X - DOOR_W / 2, x1: DOOR_X + DOOR_W / 2, z0: ROOM_HZ - 1.0, z1: ROOM_HZ + 1.0 },
  { x0: CORRIDOR_X0, x1: CORRIDOR_X1, z0: ROOM_HZ, z1: Z1 },
  // doorway into the history / experience hall (left wall, second door)
  { x0: 0.4, x1: 2.6, z0: 20 - DOOR_W / 2, z1: 20 + DOOR_W / 2 },
  // doorway into the achievements room (left wall, third door)
  { x0: 0.4, x1: 2.6, z0: 29 - DOOR_W / 2, z1: 29 + DOOR_W / 2 },
  // doorway into the testimonials room (right wall, third door)
  { x0: 3.4, x1: 5.6, z0: 29 - DOOR_W / 2, z1: 29 + DOOR_W / 2 },
  // doorway into the technologies room (right wall, second door)
  { x0: 3.4, x1: 5.6, z0: 20 - DOOR_W / 2, z1: 20 + DOOR_W / 2 },
  // doorway into the museum (right wall)
  { x0: 3.4, x1: 5.6, z0: GAME_DOOR_Z - DOOR_W / 2, z1: GAME_DOOR_Z + DOOR_W / 2 },
  // doorway into the PlayStation room (left wall)
  { x0: 0.4, x1: 2.6, z0: GAME_DOOR_Z - DOOR_W / 2, z1: GAME_DOOR_Z + DOOR_W / 2 },
];

export function buildCorridor(ctx: Ctx, parent: Node, doors: DoorSystem) {
  const root = group(ctx, { parent });
  const cx = (CORRIDOR_X0 + CORRIDOR_X1) / 2;
  const w = CORRIDOR_X1 - CORRIDOR_X0;
  const len = Z1 - ROOM_HZ;
  const cz = (Z1 + ROOM_HZ) / 2;
  const wall = lit(ctx, { color: "#c9d2d6", rough: 0.9 });
  const trim = lit(ctx, { color: "#2f3a44", rough: 0.6 });

  box(ctx, w, 0.1, len, { parent: root, pos: [cx, -0.05, cz], receive: true, mat: lit(ctx, { color: "#3b4652", rough: 0.6 }) });
  box(ctx, 1.2, 0.012, len - 0.6, { parent: root, pos: [cx, 0.006, cz], mat: lit(ctx, { color: "#8a2f3a", rough: 1 }) });
  box(ctx, w, 0.1, len, { parent: root, pos: [cx, ROOM_H + 0.05, cz], mat: lit(ctx, { color: "#ecebe6", rough: 0.95 }) });

  // walls with door openings + lintels
  const wallWithDoors = (x: number, doorZs: number[]) => {
    let z = ROOM_HZ;
    const cuts = doorZs.map((d) => [d - DOOR_W / 2, d + DOOR_W / 2] as [number, number]);
    for (const [a, b] of [...cuts, [Z1, Z1] as [number, number]]) {
      if (a > z) {
        box(ctx, T, ROOM_H, a - z, { parent: root, pos: [x, ROOM_H / 2, (a + z) / 2], receive: true, mat: wall });
        box(ctx, 0.05, 0.14, a - z, { parent: root, pos: [x + (x < cx ? 0.12 : -0.12), 0.07, (a + z) / 2], mat: trim });
      }
      if (b > a) box(ctx, T, ROOM_H - 2.4, DOOR_W, { parent: root, pos: [x, 2.4 + (ROOM_H - 2.4) / 2, (a + b) / 2], mat: wall });
      z = b;
    }
  };
  wallWithDoors(CORRIDOR_X0 - T / 2, SIDE_DOOR_ZS);
  wallWithDoors(CORRIDOR_X1 + T / 2, SIDE_DOOR_ZS);

  // ---- doors (E to open)
  doors.add({ parent: root, hinge: [DOOR_X - DOOR_W / 2, ROOM_HZ], dir: [1, 0], side: 1, color: "#7a5637" });
  const lx = CORRIDOR_X0 - T / 2;
  const rx = CORRIDOR_X1 + T / 2;
  SIDE_DOOR_ZS.forEach((z, i) => {
    const hz = z - DOOR_W / 2;
    // left wall: first one is the PlayStation room (no dead-end recess), the rest are placeholders
    doors.add({ parent: root, hinge: [lx, hz], dir: [0, 1], side: 1, color: i === 0 ? "#2b2f45" : i === 1 ? "#4a3322" : "#6a5a1c", recess: i > 2 });
    doors.add({ parent: root, hinge: [rx, hz], dir: [0, 1], side: -1, color: i === 0 ? "#5a3b25" : i === 1 ? "#1f3a55" : "#6a2a34", recess: i > 2 });
  });
  for (let z = ROOM_HZ + 4; z < Z1 - 1; z += 8) addPendant(ctx, root, cx, z, ROOM_H, "#ffe6c0", 7, 10);
  return { root, cx, cz, len };
}
