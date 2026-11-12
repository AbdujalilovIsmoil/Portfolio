/**
 * Plan of the grounds outside the house (all at y = CITY_Y).
 *
 *   z  -6 … 50  the house (one storey; every room is inside it)
 *   z 50 … 76  the front yard (hovli): lawn, pool, so'ri, grape trellis, flower beds
 *   the garden wraps round both sides of the house; a brick wall with a gate encloses it all,
 *   and beyond it lie fields, poplar rows and the mountains.
 */
export const CITY_Y = -0.6;
/** Street-side face of the house (the front door is in it, at FRONT_DOOR_X). */
export const FRONT_Z = 50.1;
export const FRONT_DOOR_X = 3.0;

/** The property wall. */
export const PLOT = { x0: -32, x1: 38, z0: -26, z1: 76 };
/** Gate in the front wall (opposite the front door). */
export const GATE_X0 = 0.8;
export const GATE_X1 = 5.2;

/** Our house's footprint (the rooms are all inside it). */
const HOUSE_X0 = -14.2;
const HOUSE_X1 = 19.2;
const HOUSE_Z0 = -5.6;

/** True anywhere in the garden, false inside the house (rooms, corridor, entrance hall). */
export function isOutdoors(x: number, z: number) {
  return z > FRONT_Z + 0.35 || z < HOUSE_Z0 || x < HOUSE_X0 || x > HOUSE_X1;
}

/** Walkable garden: the front yard, both sides of the house and the strip behind it. */
const IN = 0.35; // keep off the wall
export const YARD_REGION = { x0: PLOT.x0 + IN, x1: PLOT.x1 - IN, z0: FRONT_Z + 0.5, z1: PLOT.z1 - IN };
export const GARDEN_REGIONS = [
  { x0: PLOT.x0 + IN, x1: HOUSE_X0 - 0.1, z0: PLOT.z0 + IN, z1: PLOT.z1 - IN },
  { x0: HOUSE_X1 + 0.1, x1: PLOT.x1 - IN, z0: PLOT.z0 + IN, z1: PLOT.z1 - IN },
  { x0: PLOT.x0 + IN, x1: PLOT.x1 - IN, z0: PLOT.z0 + IN, z1: HOUSE_Z0 - 0.1 },
];

/** The swimming pool in the east garden (inner water rectangle), its water line and floor. */
export const POOL = { x0: 25, x1: 34, z0: 31, z1: 47 };
export const WATER_Y = CITY_Y - 0.12;
export const POOL_FLOOR_Y = CITY_Y - 2.6;
/** The ladder: the only way out of the pool (at the middle of the north end). */
export const POOL_LADDER = { x: (25 + 34) / 2, z: 47 };
export function inPool(x: number, z: number) {
  return x > POOL.x0 && x < POOL.x1 && z > POOL.z0 && z < POOL.z1;
}
