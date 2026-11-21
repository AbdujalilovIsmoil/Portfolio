import { afterAll, describe, expect, it } from "vitest";
import { MISSIONS, RACE_LAPS, TRACKS, TRACK_IDS } from "../src/components/world/game";
import { LapClock } from "../src/components/world/laps";
import { LAYOUT, TILE, TRACK, WALL_IN, WALL_T, buildTrack, onDeck, setLayout } from "../src/components/world/Track";

afterAll(() => setLayout(LAYOUT));

describe("the tracks", () => {
  for (const id of TRACK_IDS) {
    it(`${TRACKS[id].name}: a closed lap that never runs into itself, walls clear all the way`, () => {
      const t = buildTrack(TRACKS[id].layout);
      expect(t.end.p[0]).toBeCloseTo(0, 6);
      expect(t.end.p[1]).toBeCloseTo(0, 6);
      expect(t.end.h).toEqual([0, 1]);
      expect(t.end.level).toBeCloseTo(0, 6);
      expect(t.length).toBeGreaterThan(700);
      expect(t.length).toBeLessThan(2100);
      const S = t.samples, L = t.length;
      const onLoop = (s: number) => !!t.loop && s >= t.loop.s0 && s <= t.loop.s0 + t.loop.length;
      for (let a = 0; a < S.length; a += 2)
        for (let b = a + 1; b < S.length; b += 2) {
          const ds = Math.abs(S[a].s - S[b].s);
          if (Math.min(ds, L - ds) < 3 * TILE || Math.abs(S[a].y - S[b].y) > 3 || (onLoop(S[a].s) && onLoop(S[b].s))) continue;
          expect(Math.hypot(S[a].x - S[b].x, S[a].z - S[b].z), `s=${S[a].s.toFixed(0)} vs ${S[b].s.toFixed(0)}`).toBeGreaterThan(2 * (WALL_IN + WALL_T));
        }
      // a start straight with the grid and the gantry on it
      expect(t.pieces.some((p) => p.cmd === "START")).toBe(true);
    });
  }

  it("has bends up on the hills (all but the Grand Circuit), each standing on a deck under its road", () => {
    expect(buildTrack(LAYOUT).decks).toHaveLength(0);
    for (const id of ["speedway", "valley", "mountain"] as const) {
      const t = buildTrack(TRACKS[id].layout);
      expect(t.decks.length, id).toBe(4);
      for (const d of t.decks) expect(d.y, id).toBeCloseTo(0.5 * TILE, 6);
      // the bends' road runs over the decks, and nothing on a deck is anywhere but up on the hill
      const onAny = t.samples.filter((q) => t.decks.some((d) => onDeck(d.pts, q.x, q.z)));
      expect(onAny.length, id).toBeGreaterThan(20);
      expect(onAny.every((q) => q.y > 0.49 * TILE), id).toBe(true);
    }
  });

  it("can be switched: every module reads the one being driven", () => {
    setLayout(TRACKS.speedway.layout);
    expect(TRACK.length).toBeCloseTo(buildTrack(TRACKS.speedway.layout).length, 6);
    setLayout(LAYOUT);
    expect(TRACK.length).toBeCloseTo(buildTrack(LAYOUT).length, 6);
  });
});

describe("the missions", () => {
  it("are twelve different ones, each on a track, against the clock", () => {
    expect(MISSIONS).toHaveLength(12);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(12);
    expect(new Set(MISSIONS.map((m) => m.kind)).size).toBe(12);
    for (const m of MISSIONS) {
      expect(TRACK_IDS).toContain(m.track);
      expect(m.time).toBeGreaterThan(20);
      expect(m.target).toBeGreaterThan(0);
      expect(m.title.length).toBeGreaterThan(2);
    }
    // the maps differ
    expect(new Set(MISSIONS.map((m) => m.track)).size).toBeGreaterThanOrEqual(4);
  });

  it("each one's things fit on its own track", async () => {
    const { spread, straightSpots } = await import("../src/components/world/Missions");
    for (const m of MISSIONS) {
      setLayout(TRACKS[m.track].layout);
      const L = TRACK.length;
      if (m.kind === "gates" || m.kind === "coins" || m.kind === "smash") {
        const at = spread(m.target, TRACK.startS + 25, L - 45);
        expect(at).toHaveLength(m.target);
        for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1], m.id).toBeGreaterThan(10);
      }
      if (m.kind === "slalom") expect(straightSpots(m.target, 24).length, m.id).toBe(m.target);
      if (m.kind === "parking") expect(straightSpots(m.target, 150).length, m.id).toBe(m.target);
      if (m.kind === "speed") expect(straightSpots(2, 80, TRACK.startS + L * 0.35, L * 0.6).length, m.id).toBe(2);
      if (m.kind === "loops") expect(TRACK.loop, m.id).toBeTruthy();
    }
    setLayout(LAYOUT);
  });
});

describe("lap counting", () => {
  it("counts a lap only once you have been all the way round", () => {
    const L = 1000, start = 100;
    const c = new LapClock(L, start);
    let t = 0;
    const drive = (from: number, to: number, step = 5) => {
      for (let s = from; step > 0 ? s <= to : s >= to; s += step) c.update(((s % L) + L) % L, (t += 0.1));
    };
    drive(80, 120); // over the line from the grid: lap 1 starts
    expect(c.crossings).toBe(1);
    expect(c.laps).toBe(0);
    drive(120, 60, -5); // back over the line…
    drive(60, 140); // …and forward again: no lap
    expect(c.laps).toBe(0);
    drive(140, 1100); // all the way round
    expect(c.laps).toBe(1);
    expect(c.lastLap).toBeGreaterThan(0);
    drive(1100, 2100);
    expect(c.laps).toBe(2);
    expect(RACE_LAPS).toBe(3);
  });
});

describe("the rivals' racing line", () => {
  it("slows for hairpins and is flat out on the straights", async () => {
    const { speedProfile } = await import("../src/components/world/Opponents");
    setLayout(TRACKS.valley.layout);
    const v = speedProfile(16, 12, 30);
    expect(Math.max(...v)).toBeCloseTo(30, 3);
    expect(Math.min(...v)).toBeLessThan(21);
    expect(Math.min(...v)).toBeGreaterThan(8);
    setLayout(LAYOUT);
  });
});
