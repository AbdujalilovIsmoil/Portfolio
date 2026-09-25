import { ACH_REGION } from "./AchievementsRoom";
import { CITY_REGION } from "./City";
import { CORRIDOR_REGIONS } from "./Corridor";
import { GAME_REGION } from "./GameRoom";
import { HISTORY_REGION } from "./HistoryRoom";
import { MUSEUM_REGION } from "./Museum";
import { ROOM_HX, ROOM_HZ } from "./Room";
import { STAIRS_REGIONS } from "./Stairs";
import { TECH_REGION } from "./TechRoom";
import { TEST_REGION } from "./TestimonialsRoom";
import type { Region } from "./core";

export const OFFICE_REGION: Region = { x0: -ROOM_HX, x1: ROOM_HX, z0: -ROOM_HZ, z1: ROOM_HZ };

/** Everywhere the player may stand. Rooms connect through the doorway regions in between. */
export const WALK_REGIONS: Region[] = [
  OFFICE_REGION,
  ...CORRIDOR_REGIONS,
  GAME_REGION,
  MUSEUM_REGION,
  HISTORY_REGION,
  TECH_REGION,
  TEST_REGION,
  ACH_REGION,
  ...STAIRS_REGIONS,
  CITY_REGION,
];

/** How far the character's centre must stay from a region's edge. */
export const WALK_MARGIN = 0.4;
