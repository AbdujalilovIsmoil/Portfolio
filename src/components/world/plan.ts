import type { Region } from "./core";

/**
 * Floor plan of the house — a "central hall" villa plan: front door → entrance hall (bedroom on
 * the left, kitchen on the right) → a wide, furnished central hall with the themed rooms opening
 * off both sides → the living room across the back.
 *
 * The themed rooms are built in their original coordinates and then shifted sideways as a whole
 * by these offsets, which is what opens the old 3 m corridor up into a 9 m hall.
 */
export const WEST_DX = -3;
export const EAST_DX = 3;

export const shiftRegion = (r: Region, dx: number): Region => ({ x0: r.x0 + dx, x1: r.x1 + dx, z0: r.z0, z1: r.z1 });
