import type { Node } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import type { DriveSignal } from "./driveSignal";
import { RACE_LAPS, RIVALS } from "./game";
import { buildCelebration } from "./Celebration";
import { Countdown } from "./countdown";
import type { IntroSignal } from "./introSignal";
import { LapClock } from "./laps";
import { CAR_HALF_L, CAR_HALF_W, cornerSpeed } from "./Car";
import { Rival, speedProfile } from "./Opponents";
import type { PlaySignal } from "./raceSignal";
import { saveRace } from "./progress";
import { createRaceMusic, peekCtx, playChime, type Music } from "./sound";
import { TRACK, lateralOf, sampleIndexAt } from "./Track";
import { boxHit, group, type Ctx, type VehicleState } from "./core";

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
/** A driver in the race (you — or, split screen, each of the two players): their car's state, their name and colour. */
export interface RacePlayer {
  vehicle: VehicleState;
  name: string;
  color: string;
}

export function buildRace(
  ctx: Ctx,
  parent: Node,
  deps: RaceDeps,
  o: { laps?: number; rivals?: { name: string; color: string }[]; skills?: number[]; /** remember the result for this track */ track?: string; /** music to play (a file under /sounds) */ music?: string; /** split screen: both players */ players?: RacePlayer[] } = {}
) {
  const { playRef, driveRef, introRef } = deps;
  const laps = o.laps ?? RACE_LAPS;
  const who = o.rivals ?? RIVALS;
  const skills = o.skills ?? [0.95, 0.98, 1.0];
  const root = group(ctx, { parent });
  const play = playRef.current;
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
  const celebration = buildCelebration(ctx);

  // the drivers: you (or both players), each with a lap clock of their own
  const players = (o.players ?? [{ vehicle: ctx.vehicle, name: "You", color: "#ffffff" }]).map((p) => ({ ...p, clock: new LapClock(L, TRACK.startS), finishedAt: null as number | null }));
  const split = players.length > 1;
  const cars = rivals.length + players.length;
  Object.assign(play, { kind: "race", state: "intro", count: 3, time: 0, lap: 0, laps, position: cars, cars, bestLap: null, title: "", objective: "", progress: 0, total: laps, timeLeft: null, status: "", message: "", results: [], players: [] });
  const countdown = new Countdown(ctx, introRef, play, players.map((p) => p.vehicle));
  // (on the map: the rivals, and in split screen the second player too)
  const markers = [...rivals.map((r) => ({ x: 0, z: 0, color: r.color, ring: true })), ...players.slice(1).map((p) => ({ x: 0, z: 0, color: p.color, ring: true }))];
  driveRef.current.markers = markers;

  // (made once and updated in place every frame: nothing for the garbage collector to sweep up mid-race)
  const mes = players.map(() => ({ d: 0, lat: 0, speed: 0 }));
  const rivalInfo = rivals.map(() => ({ d: 0, lat: 0, speed: 0 }));
  const othersOf = rivals.map((_, i) => [...mes, ...rivalInfo.filter((_, j) => j !== i)]);
  type Entry = { name: string; color: string; time: number | null; best: number | null; you: boolean; p: number; who: (typeof players)[number] | null; rival: Rival | null };
  const order: Entry[] = [
    ...players.map((p) => ({ name: p.name, color: p.color, time: null, best: null, you: true, p: 0, who: p, rival: null })),
    ...rivals.map((r) => ({ name: r.name, color: r.color, time: null, best: null, you: false, p: 0, who: null, rival: r })),
  ];
  const byPlace = (a: Entry, b: Entry) => (a.time !== null && b.time !== null ? a.time - b.time : a.time !== null ? -1 : b.time !== null ? 1 : b.p - a.p);
  const hud = players.map((p) => ({ name: p.name, color: p.color, lap: 1, position: cars, speed: 0, finished: false }));

  let raceTime = 0;
  const progressOf = (p: (typeof players)[number]) => (p.clock.crossings === 0 ? p.clock.progress(p.vehicle.s) * L - L : (p.clock.crossings - 1) * L + p.clock.progress(p.vehicle.s) * L);

  // ---- the music: in at GO, down while the menu is open, out at the flag
  let music: Music | null = null;
  let musicState = "";
  ctx.scene.onDisposeObservable.addOnce(() => music?.stop());
  ctx.onFrame(() => {
    const want = play.state === "on" ? (ctx.paused ? "pause" : "play") : play.state === "won" || play.state === "lost" ? "stop" : "";
    if (want === musicState) return;
    if (want === "play" && !music) {
      const ac = peekCtx();
      if (!ac || !o.music) return;
      music = createRaceMusic(ac, `/sounds/${o.music}`);
    }
    musicState = want;
    if (!music) return;
    if (want === "play") music.play();
    else if (want === "pause") music.pause();
    else if (want === "stop") music.stop();
  });

  ctx.onFrame((dt) => {
    if (ctx.paused) return;
    countdown.update(dt);
    const going = play.state === "on" || play.state === "won" || play.state === "lost";
    if (going) raceTime += dt;
    play.time = raceTime;

    // the rivals: out of each other's way, and the players'
    let lead = -Infinity;
    players.forEach((p, i) => {
      const pr = progressOf(p);
      mes[i].d = pr + TRACK.startS;
      mes[i].lat = lateralOf(p.vehicle.x, p.vehicle.z, sampleIndexAt(p.vehicle.s));
      mes[i].speed = Math.abs(p.vehicle.speed);
      if (pr > lead) lead = pr;
    });
    rivals.forEach((r, i) => {
      rivalInfo[i].d = r.d;
      rivalInfo[i].lat = r.lat;
      rivalInfo[i].speed = r.speed;
    });
    for (let ri = 0; ri < rivals.length; ri++) {
      const r = rivals[ri];
      const others = othersOf[ri];
      // rubber band: never hopelessly far ahead or behind
      const gap = r.progress - lead;
      const pace = gap > 150 ? 0.93 : gap > 60 ? 0.97 : gap < -150 ? 1.06 : gap < -60 ? 1.03 : 1;
      r.update(dt, going, others, pace, raceTime);
      if (r.finished === null && r.progress >= laps * L) r.finished = raceTime;
    }
    // the rivals against each other: bodies that meet are pushed apart and trade speed (never through)
    for (let i = 0; i < rivals.length; i++)
      for (let j = i + 1; j < rivals.length; j++) {
        const a = rivals[i].colliders[0], b = rivals[j].colliders[0];
        if (Math.hypot(a.x - b.x, a.z - b.z) > a.r + b.r) continue;
        const hit = boxHit(a.x, a.z, a.box!.h, a.box!.hw, a.box!.hl, b.x, b.z, b.box!.h, b.box!.hw, b.box!.hl);
        if (!hit) continue;
        const { nx, nz, depth } = hit;
        const closing = -((a.vx! - b.vx!) * nx + (a.vz! - b.vz!) * nz);
        const J = closing > 0 ? (closing * 1.3) / 2 : 0;
        rivals[i].shove(nx * J, nz * J, (nx * depth) / 2, (nz * depth) / 2);
        rivals[j].shove(-nx * J, -nz * J, (-nx * depth) / 2, (-nz * depth) / 2);
      }
    // and against each player, now that they have moved (the cars checked them before they did): a
    // rival that has come into one is put back out at once, and the two trade speed as equal masses
    for (const { vehicle: v } of players) {
      if (v.loop >= 0) continue;
      for (const r of rivals) {
        const c = r.colliders[0];
        if (Math.hypot(c.x - v.x, c.z - v.z) > c.r + CAR_HALF_L + 0.5) continue;
        const hit = boxHit(c.x, c.z, c.box!.h, c.box!.hw, c.box!.hl, v.x, v.z, v.heading, CAR_HALF_W, CAR_HALF_L);
        if (!hit) continue;
        const { nx, nz, depth } = hit; // (from the player towards it)
        const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
        const closing = -((c.vx! - fx * v.speed) * nx + (c.vz! - fz * v.speed) * nz);
        const J = closing > 0 ? (closing * 1.3) / 2 : 0;
        r.shove(nx * J, nz * J, nx * depth, nz * depth);
        if (J > 0) v.speed -= (nx * fx + nz * fz) * J;
      }
    }
    rivals.forEach((r, i) => {
      markers[i].x = r.x;
      markers[i].z = r.z;
    });
    players.slice(1).forEach((p, i) => {
      markers[rivals.length + i].x = p.vehicle.x;
      markers[rivals.length + i].z = p.vehicle.z;
    });

    // the players: laps, finishing
    for (const p of players) {
      const lap = p.clock.update(p.vehicle.s, raceTime);
      if (lap !== null && p.finishedAt === null) playChime();
      if (p.finishedAt === null && p.clock.laps >= laps) {
        p.finishedAt = raceTime;
        p.vehicle.frozen = true; // (it drives itself to a stop)
      }
    }
    for (const e of order) {
      if (e.who) {
        e.time = e.who.finishedAt;
        e.best = e.who.clock.bestLap;
        e.p = e.who.finishedAt !== null ? laps * L : progressOf(e.who);
      } else if (e.rival) {
        e.time = e.rival.finished;
        e.best = e.rival.bestLap;
        e.p = Math.min(e.rival.progress, laps * L);
      }
    }
    order.sort(byPlace);
    // (the HUD: the first player's place and lap; split screen, each player's)
    const first = players[0];
    play.bestLap = first.clock.bestLap;
    play.lap = Math.min(laps, Math.max(1, first.clock.crossings));
    play.position = order.findIndex((x) => x.who === first) + 1;
    if (split) {
      players.forEach((p, i) => {
        const h = hud[i];
        h.lap = Math.min(laps, Math.max(1, p.clock.crossings));
        h.position = order.findIndex((x) => x.who === p) + 1;
        h.speed = Math.abs(p.vehicle.speed);
        h.finished = p.finishedAt !== null;
      });
      play.players = hud;
    } else play.players = [];
    if (play.state === "on" && players.every((p) => p.finishedAt !== null)) {
      // the ones still out there: when they would get in at their pace
      play.results = order.map((x) => ({ name: x.name, color: x.color, you: x.you, best: x.best, time: x.time ?? raceTime + (laps * L - x.p) / Math.max(20, x.p / Math.max(1, raceTime)) }));
      const best = order.find((x) => x.you)!;
      play.position = order.indexOf(best) + 1;
      play.state = play.position === 1 ? "won" : "lost";
      if (play.state === "won") {
        best.who!.vehicle.celebrate = true;
        celebration.start();
      }
      if (o.track && !split) saveRace(o.track, first.finishedAt!, play.state === "won");
    }
  });

  return { ready: Promise.all(rivals.map((r) => r.ready)), rivals };
}
