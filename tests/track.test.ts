import { describe, expect, it } from "vitest";
import { LAYOUT, LOOP_R, LOOP_SHIFT, ROAD_HALF, TILE, TRACK, WALL_IN, WALL_T, boostPad, buildTrack, loopAt, loopPose, loopView, nearestSample, onAsphalt, rampProfile, roadFrames, sampleAt, startPose } from "../src/components/world/Track";

/** Is s on the loop-the-loop (which passes over itself, by design)? */
const onLoop = (s: number) => s >= TRACK.loop!.s0 && s <= TRACK.loop!.s0 + TRACK.loop!.length;

describe("race track", () => {
  it("is a closed lap: the last tile ends where the first one starts", () => {
    const { end } = TRACK;
    expect(end.p[0]).toBeCloseTo(0, 6);
    expect(end.p[1]).toBeCloseTo(0, 6);
    expect(end.h).toEqual([0, 1]);
    expect(end.level).toBeCloseTo(0, 6);
  });

  it("is about a kilometre and a half long", () => {
    expect(TRACK.length).toBeGreaterThan(1300);
    expect(TRACK.length).toBeLessThan(1900);
  });

  it("never runs into itself (except over and under a bridge)", () => {
    const S = TRACK.samples;
    const L = TRACK.length;
    for (let a = 0; a < S.length; a += 2)
      for (let b = a + 1; b < S.length; b += 2) {
        const ds = Math.abs(S[a].s - S[b].s);
        if (Math.min(ds, L - ds) < 2.5 * TILE) continue;
        if (Math.abs(S[a].y - S[b].y) > 0.3 * TILE) continue;
        if (onLoop(S[a].s) && onLoop(S[b].s)) continue; // (tested on its own below)
        expect(Math.hypot(S[a].x - S[b].x, S[a].z - S[b].z), `s=${S[a].s.toFixed(0)} vs s=${S[b].s.toFixed(0)}`).toBeGreaterThan(1.05 * TILE);
      }
  });

  it("has hills, that ease in and out like the kit's curved ramp", () => {
    const top = Math.max(...TRACK.samples.filter((q) => !onLoop(q.s)).map((q) => q.y));
    expect(top).toBeCloseTo(0.5 * TILE, 3);
    expect(TRACK.pieces.filter((p) => p.cmd === "UP")).toHaveLength(2);
    expect(rampProfile(0)).toBe(0);
    expect(rampProfile(0.5)).toBeCloseTo(0.5, 1);
    expect(rampProfile(1)).toBe(1);
    for (let t = 0; t < 1; t += 0.02) expect(rampProfile(t + 0.02)).toBeGreaterThanOrEqual(rampProfile(t));
  });

  it("knows the road's height anywhere along the lap, and it never jumps", async () => {
    const { heightAt, trackS } = await import("../src/components/world/Track");
    let prev = heightAt(0);
    for (let s = 0.5; s < TRACK.length; s += 0.5) {
      const h = heightAt(s);
      // no steps: ≤ 0.4 m per half metre on the hills; on the loop, at most straight up
      expect(Math.abs(h - prev), `at s=${s}`).toBeLessThan(onLoop(s) ? 0.5001 : 0.4);
      prev = h;
    }
    // beside the centre line (up to the walls) it is the height of the centre line there
    for (const s of [100, 400, 777, 1200]) {
      const q = sampleAt(s);
      for (const lat of [-8, 0, 8]) {
        const x = q.x + Math.cos(q.heading) * lat, z = q.z - Math.sin(q.heading) * lat;
        expect(Math.abs(trackS(x, z).s - q.s)).toBeLessThan(2.5);
      }
    }
  });

  it("is wide, with walls all the way round", () => {
    expect(ROAD_HALF * TILE * 2).toBeGreaterThan(14); // a 15 m road
    expect(WALL_IN).toBeGreaterThan(ROAD_HALF * TILE); // the walls stand past the asphalt…
    expect(WALL_IN).toBeLessThan(0.5 * TILE); // …on the tile's verge
    // where the track comes back close to itself, the two walls between never touch
    const S = TRACK.samples;
    const L = TRACK.length;
    for (let a = 0; a < S.length; a += 3)
      for (let b = a + 1; b < S.length; b += 3) {
        const ds = Math.abs(S[a].s - S[b].s);
        if (Math.min(ds, L - ds) < 3 * TILE || Math.abs(S[a].y - S[b].y) > 3) continue;
        expect(Math.hypot(S[a].x - S[b].x, S[a].z - S[b].z)).toBeGreaterThan(2 * (WALL_IN + WALL_T));
      }
  });

  it("places one model per straight and three per corner (road + kerbs)", () => {
    const count = (c: string) => LAYOUT.filter((x) => x === c).length;
    const corners = count("R2") + count("R3") + count("L2") + count("L3");
    const hairpins = count("HR") + count("HL");
    const loops = count("LOOP"); // (our own geometry)
    expect(TRACK.models).toHaveLength(LAYOUT.length - corners - hairpins - loops + corners * 3 + hairpins * 2);
  });

  it("samples run continuously along the lap", () => {
    const S = TRACK.samples;
    for (let i = 1; i < S.length; i++) expect(Math.hypot(S[i].x - S[i - 1].x, S[i].z - S[i - 1].z)).toBeLessThan(3);
    const first = S[0], last = S[S.length - 1];
    expect(Math.hypot(first.x - last.x, first.z - last.z)).toBeLessThan(3);
  });

  it("finds where the car is along the lap", () => {
    for (const s of [0, 137, 420, 777, TRACK.length - 5]) {
      const q = sampleAt(s);
      const { i, d } = nearestSample(q.x + 1, q.z);
      expect(d).toBeLessThan(2.5);
      expect(Math.abs(TRACK.samples[i].s - q.s)).toBeLessThan(6);
    }
  });

  it("starts the car on the asphalt, on the grid", () => {
    const p = startPose();
    const { d } = nearestSample(p.x, p.z);
    expect(onAsphalt(d)).toBe(true);
    expect(TRACK.pieces.find((q) => q.cmd === "GRID")).toBeTruthy();
  });

  it("rejects an unknown piece", () => {
    expect(() => buildTrack(["S", "WARP"])).toThrow();
  });

  it("has a loop-the-loop: flat in and out, upside down at the top, its two sides never touching", () => {
    const L = TRACK.loop!;
    expect(L).toBeTruthy();
    // runs in and out on the level, along the track
    for (const d of [0, L.climbIn, L.climbOut, L.length]) {
      const q = loopPose(d);
      expect(q.pos[1]).toBeCloseTo(L.y0, 3);
      expect(q.up[1]).toBeCloseTo(1, 3);
    }
    // upside down at the top, 2 R up
    const top = loopPose((L.climbIn + L.climbOut) / 2);
    expect(top.up[1]).toBeCloseTo(-1, 2);
    expect(top.pos[1] - L.y0).toBeCloseTo(2 * LOOP_R, 1);
    // comes out a tile to the left: the way out passes beside the way in
    const a = loopPose(0).pos, b = loopPose(L.length).pos;
    expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeGreaterThan(LOOP_SHIFT);
    // the rails of the way up and the way down never meet (outer faces, top and foot)
    const R = WALL_IN + WALL_T;
    let closest = Infinity;
    for (let d1 = 0; d1 <= L.length / 2; d1 += 1)
      for (let d2 = L.length / 2; d2 <= L.length; d2 += 1)
        for (const h1 of [-0.5, 1.5])
          for (const h2 of [-0.5, 1.5]) {
            const p = loopAt(d1, R, h1), q = loopAt(d2, -R, h2);
            closest = Math.min(closest, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
          }
    expect(closest).toBeGreaterThan(1);
  });

  it("has a boost pad on the straight before the loop, on the asphalt", () => {
    const pad = boostPad()!;
    const L = TRACK.loop!;
    const before = TRACK.pieces[TRACK.pieces.findIndex((p) => p.cmd === "LOOP") - 1];
    expect(before.cmd).toBe("S");
    expect(pad.s0).toBeGreaterThanOrEqual(before.s0);
    expect(pad.s1).toBeLessThanOrEqual(L.s0);
    expect(pad.half).toBeLessThan(ROAD_HALF * TILE);
  });

  it("watches the loop from a spot clear of the track", () => {
    const v = loopView();
    const L = TRACK.loop!;
    for (const q of TRACK.samples) {
      const d = Math.hypot(q.x - v.cam.x, q.z - v.cam.z);
      if (q.s >= L.s0 && q.s <= L.s0 + L.length) expect(d).toBeGreaterThan(20); // the loop itself
      else expect(d, `s=${q.s.toFixed(0)}`).toBeGreaterThan(25);
    }
    expect(v.cam.y).toBeGreaterThan(L.y0 + 2);
  });

  it("knows the road's frame all the way round: every metre over the loop, square and unit", () => {
    const F = roadFrames();
    for (let i = 0; i < F.length; i++) {
      const a = F[i], b = F[(i + 1) % F.length];
      expect(Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]), `at s=${a.s.toFixed(0)}`).toBeLessThan(3);
      expect(Math.hypot(...a.up)).toBeCloseTo(1, 5);
      expect(Math.hypot(...a.left)).toBeCloseTo(1, 5);
      expect(a.up[0] * a.left[0] + a.up[1] * a.left[1] + a.up[2] * a.left[2]).toBeCloseTo(0, 5);
    }
    const L = TRACK.loop!;
    expect(F.filter((f) => f.s >= L.s0 && f.s < L.s0 + L.length).length).toBeGreaterThanOrEqual(Math.floor(L.length));
  });
});

describe("info along the track", () => {
  it("has a card for every piece of content, in order round the lap", async () => {
    const ZONES = (await import("../src/components/world/Zones")).getZones();
    const { JOBS, WORKS, SKILL_GROUPS, TESTIMONIALS, ACHIEVEMENTS, EDUCATION } = await import("../src/components/world/content");
    expect(ZONES).toHaveLength(1 + JOBS.length + WORKS.length + SKILL_GROUPS.length + TESTIMONIALS.length + ACHIEVEMENTS.length + EDUCATION.length + 1);
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(ZONES.length);
    for (const z of ZONES) {
      expect(z.info.title.length).toBeGreaterThan(0);
      expect(z.info.lines.length).toBeGreaterThan(0);
    }
  });

  it("every skill group names real technologies", async () => {
    const { SKILL_GROUPS, TECHS } = await import("../src/components/world/content");
    const names = SKILL_GROUPS.flatMap((g) => g.names);
    for (const n of names) expect(TECHS.map((t) => t.name)).toContain(n);
    expect(new Set(names).size).toBe(TECHS.length);
  });

  it("a card shows only at its own billboard, and nothing in between", async () => {
    const { getZones, zoneAt } = await import("../src/components/world/Zones");
    for (const z of getZones()) expect(zoneAt(z.s)?.zone.id).toBe(z.id);
    const L = TRACK.length;
    let gaps = 0;
    for (let s = 0; s < L; s += 2) {
      const at = zoneAt(s);
      if (!at) {
        gaps++;
        continue;
      }
      const d = Math.abs(s - at.zone.s);
      expect(Math.min(d, L - d), `at s=${s}`).toBeLessThan(30); // you are by that billboard
      expect(at.k).toBeGreaterThanOrEqual(0);
      expect(at.k).toBeLessThanOrEqual(1);
    }
    expect(gaps).toBeGreaterThan(L / 2 / 4); // most of the lap has no card up
  });

  it("billboards stand beside the track, never on it", async () => {
    const { getZones } = await import("../src/components/world/Zones");
    for (const z of getZones()) {
      const near = Math.min(...TRACK.samples.map((q) => Math.hypot(q.x - z.board.x, q.z - z.board.z)));
      expect(near, z.id).toBeGreaterThan(0.5 * TILE + 5);
    }
  });
});

describe("start area", () => {
  it("keeps the billboards off the grandstands and the loop", async () => {
    const { getZones, reserved } = await import("../src/components/world/Zones");
    for (const z of getZones()) expect(reserved(z.board.x, z.board.z), z.id).toBe(false);
  });
});

describe("the start", () => {
  it("shows the About card on the grid", async () => {
    const { zoneAt } = await import("../src/components/world/Zones");
    const { startPose } = await import("../src/components/world/Track");
    const p = startPose();
    const { i } = nearestSample(p.x, p.z);
    expect(zoneAt(TRACK.samples[i].s)?.zone.id).toBe("about");
  });
});
