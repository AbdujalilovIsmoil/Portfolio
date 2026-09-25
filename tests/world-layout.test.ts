import { describe, expect, it } from "vitest";
import { CITY_Y, FRONT_Z, STAIR_Z0, STAIR_Z1, groundY } from "../src/components/world/Stairs";
import { OFFICE_REGION, WALK_MARGIN, WALK_REGIONS } from "../src/components/world/regions";
import { ACH_REGION } from "../src/components/world/AchievementsRoom";
import { CITY_REGION } from "../src/components/world/City";
import { GAME_REGION } from "../src/components/world/GameRoom";
import { HISTORY_REGION } from "../src/components/world/HistoryRoom";
import { MUSEUM_REGION } from "../src/components/world/Museum";
import { TECH_REGION } from "../src/components/world/TechRoom";
import { TEST_REGION } from "../src/components/world/TestimonialsRoom";
import { inRegions, type Region } from "../src/components/world/core";

/** Can a character (kept WALK_MARGIN away from every edge) step from region a into region b? */
const connected = (a: Region, b: Region) => {
  const m = WALK_MARGIN;
  const x = a.x0 + m <= b.x1 - m && b.x0 + m <= a.x1 - m;
  const z = a.z0 + m <= b.z1 - m && b.z0 + m <= a.z1 - m;
  return x && z;
};

function reachable(from: Region) {
  const seen = new Set<Region>([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const r of WALK_REGIONS) if (!seen.has(r) && connected(cur, r)) seen.add(r), queue.push(r);
  }
  return seen;
}

describe("building layout", () => {
  const seen = reachable(OFFICE_REGION);

  it.each([
    ["game room", GAME_REGION],
    ["museum", MUSEUM_REGION],
    ["history hall", HISTORY_REGION],
    ["technology room", TECH_REGION],
    ["testimonials room", TEST_REGION],
    ["achievements room", ACH_REGION],
    ["the street", CITY_REGION],
  ] as [string, Region][])("%s is reachable from the office", (_, region) => {
    expect(seen.has(region)).toBe(true);
  });

  it("every walkable region is reachable (no orphaned areas)", () => {
    expect(seen.size).toBe(WALK_REGIONS.length);
  });

  it("the spawn point is walkable", () => {
    expect(inRegions(WALK_REGIONS, 0.5, 0.8, WALK_MARGIN)).toBe(true);
  });

  it("rooms do not overlap each other", () => {
    const rooms = [GAME_REGION, MUSEUM_REGION, HISTORY_REGION, TECH_REGION, TEST_REGION, ACH_REGION, OFFICE_REGION];
    for (let i = 0; i < rooms.length; i++)
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];
        const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
        expect(overlap, `room ${i} overlaps room ${j}`).toBe(false);
      }
  });
});

describe("stairs", () => {
  it("is flat upstairs and on the street", () => {
    expect(groundY(3, 10)).toBe(0);
    expect(groundY(3, STAIR_Z0 - 1)).toBe(0);
    expect(groundY(3, STAIR_Z1 + 1)).toBe(CITY_Y);
    expect(groundY(3, FRONT_Z + 5)).toBe(CITY_Y);
  });
  it("only ever goes down, in steps no bigger than the character can climb", () => {
    let prev = groundY(3, STAIR_Z0);
    for (let z = STAIR_Z0; z < STAIR_Z1; z += 0.05) {
      const y = groundY(3, z);
      expect(y).toBeLessThanOrEqual(prev + 1e-9);
      expect(prev - y).toBeLessThan(0.31);
      prev = y;
    }
    expect(prev).toBeCloseTo(CITY_Y + 0.2);
  });
});
