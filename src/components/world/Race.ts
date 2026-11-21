import type { Node } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import type { DriveSignal } from "./driveSignal";
import { RACE_LAPS, RIVALS } from "./game";
import { Countdown } from "./countdown";
import type { IntroSignal } from "./introSignal";
import { LapClock } from "./laps";
import { cornerSpeed } from "./Car";
import { Rival, speedProfile } from "./Opponents";
import type { PlaySignal } from "./raceSignal";
import { saveRace } from "./progress";
import { playChime } from "./sound";
import { TRACK, lateralOf, sampleIndexAt } from "./Track";
import { group, type Ctx } from "./core";

export interface RaceDeps {
  playRef: MutableRefObject<PlaySignal>;
  driveRef: MutableRefObject<DriveSignal>;
  introRef: MutableRefObject<IntroSignal>;
}

/**
 * Lights out and away: the camera flies in, 3 – 2 – 1 – GO, then `laps` laps against the rivals —
 * your position and lap as you go, the finishing order when you cross the line for the last time.
 * The rivals drive the racing line on their own (Opponents.ts), a little faster when they fall
 * well behind you and a little slower when they get well ahead (it stays a race).
 */
export function buildRace(ctx: Ctx, parent: Node, deps: RaceDeps, o: { laps?: number; rivals?: { name: string; color: string }[]; skills?: number[]; /** remember the result for this track */ track?: string } = {}) {
  const { playRef, driveRef, introRef } = deps;
  const laps = o.laps ?? RACE_LAPS;
  const who = o.rivals ?? RIVALS;
  const skills = o.skills ?? [0.95, 0.98, 1.0];
  const root = group(ctx, { parent });
  const play = playRef.current;
  const v = ctx.vehicle;
  const L = TRACK.length;
  // the rivals' racing line: the bends a little under what the car can take, braking early, up to
  // ≈ 230 km/h on the straights (a good lap on the nitro is some 10% quicker: they can be beaten)
  const profile = speedProfile((r) => cornerSpeed(r) * 0.7, 20, 64);
  // the grid: two rivals on the front row, one behind; you at the back (lane 0 is your side)
  const grid: [number, number][] = [
    [TRACK.startS - 5, 0],
    [TRACK.startS - 5, 2],
    [TRACK.startS - 11, 1],
  ];
  const rivals = who.map((r, i) => new Rival(ctx, root, r.name, r.color, grid[i % grid.length][0] - Math.floor(i / grid.length) * 12, grid[i % grid.length][1], skills[i % skills.length], profile));
  for (const r of rivals) ctx.dynamic.push(...r.colliders);

  Object.assign(play, { kind: "race", state: "intro", count: 3, time: 0, lap: 0, laps, position: rivals.length + 1, cars: rivals.length + 1, bestLap: null, title: "", objective: "", progress: 0, total: laps, timeLeft: null, status: "", message: "", results: [] });
  const countdown = new Countdown(ctx, introRef, play);
  const clock = new LapClock(L, TRACK.startS);
  const markers = rivals.map((r) => ({ x: 0, z: 0, color: r.color, ring: true }));
  driveRef.current.markers = markers;

  let raceTime = 0;
  let finishedAt: number | null = null;
  const playerProgress = () => (clock.crossings === 0 ? clock.progress(v.s) * L - L : (clock.crossings - 1) * L + clock.progress(v.s) * L);

  ctx.onFrame((dt) => {
    if (ctx.paused) return;
    countdown.update(dt);
    const going = play.state === "on" || play.state === "won" || play.state === "lost";
    if (going) raceTime += dt;
    play.time = raceTime;

    // the rivals: out of each other's way, and yours
    const me = { d: playerProgress() + TRACK.startS, lat: lateralOf(v.x, v.z, sampleIndexAt(v.s)), speed: Math.abs(v.speed) };
    const lead = playerProgress();
    for (const r of rivals) {
      const others = [me, ...rivals.filter((x) => x !== r).map((x) => ({ d: x.d, lat: x.lat, speed: x.speed }))];
      // rubber band: never hopelessly far ahead or behind
      const gap = r.progress - lead;
      const pace = gap > 150 ? 0.93 : gap > 60 ? 0.97 : gap < -150 ? 1.06 : gap < -60 ? 1.03 : 1;
      r.update(dt, going, others, pace, raceTime);
      if (r.finished === null && r.progress >= laps * L) r.finished = raceTime;
    }
    markers.forEach((m, i) => {
      m.x = rivals[i].x;
      m.z = rivals[i].z;
    });

    // you: laps, position
    const lap = clock.update(v.s, raceTime);
    if (lap !== null && finishedAt === null) playChime();
    play.bestLap = clock.bestLap;
    play.lap = Math.min(laps, Math.max(1, clock.crossings));
    const progress = playerProgress();
    if (finishedAt === null && clock.laps >= laps) {
      finishedAt = raceTime;
      v.frozen = true; // (coast to a stop)
    }
    const order = [
      { name: "You", color: "#ffffff", time: finishedAt, best: clock.bestLap, you: true, p: finishedAt !== null ? laps * L : progress },
      ...rivals.map((r) => ({ name: r.name, color: r.color, time: r.finished, best: r.bestLap, you: false, p: Math.min(r.progress, laps * L) })),
    ].sort((a, b) => (a.time !== null && b.time !== null ? a.time - b.time : a.time !== null ? -1 : b.time !== null ? 1 : b.p - a.p));
    play.position = order.findIndex((x) => x.you) + 1;
    if (finishedAt !== null && play.state === "on") {
      // the ones still out there: when they would get in at their pace
      play.results = order.map((x) => ({ name: x.name, color: x.color, you: x.you, best: x.best, time: x.time ?? raceTime + (laps * L - x.p) / Math.max(20, x.p / Math.max(1, raceTime)) }));
      play.state = play.position === 1 ? "won" : "lost";
      if (o.track) saveRace(o.track, finishedAt, play.state === "won");
    }
  });

  return { ready: Promise.all(rivals.map((r) => r.ready)), rivals };
}
