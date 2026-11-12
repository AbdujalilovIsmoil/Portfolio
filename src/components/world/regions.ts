import { ACH_REGION } from "./AchievementsRoom";
import { CITY_REGION, GARDEN_REGIONS } from "./City";
import { CORRIDOR_REGIONS } from "./Corridor";
import { GAME_REGION } from "./GameRoom";
import { HISTORY_REGION } from "./HistoryRoom";
import { MUSEUM_REGION } from "./Museum";
import { ROOM_HX, ROOM_HZ } from "./Room";
import { STAIRS_REGIONS } from "./Stairs";
import { HOME_REGIONS } from "./HomeRooms";
import { TECH_REGION } from "./TechRoom";
import { TEST_REGION } from "./TestimonialsRoom";
import { EAST_DX, WEST_DX, shiftRegion } from "./plan";
import type { Region } from "./core";

export const OFFICE_REGION: Region = { x0: -ROOM_HX, x1: ROOM_HX, z0: -ROOM_HZ, z1: ROOM_HZ };

/** The themed rooms where they actually stand (shifted sideways off the central hall, see plan.ts). */
export const PLACED = {
  game: shiftRegion(GAME_REGION, WEST_DX),
  history: shiftRegion(HISTORY_REGION, WEST_DX),
  achievements: shiftRegion(ACH_REGION, WEST_DX),
  museum: shiftRegion(MUSEUM_REGION, EAST_DX),
  tech: shiftRegion(TECH_REGION, EAST_DX),
  testimonials: shiftRegion(TEST_REGION, EAST_DX),
};

/** Everywhere the player may stand. Rooms connect through the doorway regions in between. */
export const WALK_REGIONS: Region[] = [
  OFFICE_REGION,
  ...CORRIDOR_REGIONS,
  ...Object.values(PLACED),
  ...STAIRS_REGIONS,
  ...HOME_REGIONS,
  CITY_REGION,
  ...GARDEN_REGIONS,
];

/** How far the character's centre must stay from a region's edge. */
export const WALK_MARGIN = 0.4;
