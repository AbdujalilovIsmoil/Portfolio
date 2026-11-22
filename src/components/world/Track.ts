/**
 * The race track, as data (no Babylon — unit-tested in tests/track.test.ts).
 *
 * The circuit is laid with Kenney's Racing Kit tiles (CC0). Every tile is 1 × 1 (corners 2 × 2 or
 * 3 × 3, the hairpin 3 × 1.5) with the road's centre line entering in the middle of one edge, so a
 * "turtle" can lay them one after another: straight on, turn, climb a ramp, cross a bridge…
 * Seen from above (as on the minimap: north up, +x on the LEFT in this right-handed scene):
 *
 *        ┌────── hill 1 (ramp · bridge · ramp) ──────┐     ┌─┐
 *        │                                            │     │ │   serpentine:
 *        │ main straight                              └─┐ ┌─┘ │   two hairpins
 *        │ (start / finish,                             │ │   │
 *        │  grandstands, pits)                          └─┘   └─┐ chicane
 *        │                                                     │
 *        └────── hill 2 (ramp · bridge · ramp) ────────────────┘
 */

/** Metres per Racing Kit tile: a 15 m wide road. */
export const TILE = 22;
/** Half the asphalt's width, in tiles (the kit's road runs from 0.155 to 0.845 of a tile). */
export const ROAD_HALF = 0.345;
/** Height of the bridges and hill tops, in tiles. */
const RISE = 0.5;
/** The concrete walls along both sides of the whole lap: inner face (metres from the centre line), thickness, height. */
export const WALL_IN = (ROAD_HALF + 0.085) * TILE;
export const WALL_T = 0.7;
export const WALL_H = 1.5;

/**
 * The kit's curved ramp ("roadRampLongCurved"): how far up (0–1) its road surface is at each 48th of
 * the way along it, measured off the model (ray-cast down its centre line). It eases in and out.
 */
const RAMP = [
  0, 0.0016, 0.0032, 0.0075, 0.0124, 0.0194, 0.0275, 0.0372, 0.0487, 0.0612, 0.076, 0.0913, 0.1095, 0.1278, 0.1494, 0.171, 0.196,
  0.2211, 0.2494, 0.2781, 0.3099, 0.3424, 0.3779, 0.4143, 0.4539, 0.4942, 0.5346, 0.575, 0.6117, 0.648, 0.6808, 0.7133, 0.7424,
  0.7712, 0.7969, 0.822, 0.8444, 0.866, 0.8853, 0.9035, 0.9198, 0.9346, 0.948, 0.9595, 0.9701, 0.9783, 0.9862, 0.9911, 1,
];
export function rampProfile(t: number) {
  const f = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(f));
  return RAMP[i] + (RAMP[i + 1] - RAMP[i]) * (f - i);
}

/**
 * One lap, as turtle commands. S straight · GRID/START the grid boxes and the start gantry (2 tiles)
 * · R2/R3 L2/L3 corners of radius 1.5 / 2.5 tiles · UP/DN smooth ramps (2 tiles, ½ tile of climb)
 * · BR a bridge tile on the hill top · HR/HL hairpins (U-turns two tiles over) · LOOP the
 * loop-the-loop (2 tiles on, and it comes out one tile to the left of where it went in).
 * A corner or a hairpin up on a hill (between an UP and a DN) stands on a concrete deck the size of
 * its tile: bends at the top, with a drop beside them.
 * Underground, straight on: SUB dives down an open cutting into a glass tunnel along the bottom of an
 * aquarium (a pool of sea water, fish and all) and climbs out again (11 tiles); TUN goes down into a
 * covered concrete tunnel under the lawn, lit by its lamps, and back up (10 tiles).
 */
export const LAYOUT = "S S S GRID START S S S R3 S UP BR BR DN S R2 S S S HL S S S HR S S S L2 R2 R2 L2 S S S R2 S S UP BR BR DN S LOOP S R3 S".split(" ");

// ------------------------------------------------------------------ underground

/** The underground pieces, in tiles: how long the way down is, the bottom, the way up — and how deep the bottom is. */
export const UNDER = {
  SUB: { down: 3, flat: 9, up: 3, depth: 0.7 },
  TUN: { down: 3, flat: 4, up: 3, depth: 0.45 },
} as const;
export type UnderCmd = keyof typeof UNDER;
export const isUnder = (cmd: string): cmd is UnderCmd => cmd === "SUB" || cmd === "TUN";

/** The aquarium's pool: half its width (m); the cuttings down to the tunnels: half theirs; the glass tube's radius. */
export const PIT_HALF = 30;
export const TRENCH_HALF = 11;
export const TUBE_R = 10.6;

/**
 * Where the lawn is dug away for the underground pieces (axis-aligned rectangles x0, x1, z0, z1 —
 * the pieces run along x or z): each cutting, and the aquarium's pool. A covered tunnel has lawn on top.
 */
export function underHoles(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (const u of TRACK.unders) {
    const P = UNDER[u.cmd];
    const rect = (a0: number, a1: number, half: number) => {
      const pts = [
        [a0, -half],
        [a1, -half],
        [a0, half],
        [a1, half],
      ].map(([a, l]) => [u.x + u.fx * a + u.fz * l, u.z + u.fz * a - u.fx * l]);
      out.push([Math.min(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[1]))]);
    };
    const A1 = P.down * TILE, A2 = (P.down + P.flat) * TILE;
    if (u.cmd === "SUB") {
      rect(0, u.length, TRENCH_HALF);
      rect(A1, A2, PIT_HALF);
    } else {
      rect(0, A1, TRENCH_HALF);
      rect(A2, u.length, TRENCH_HALF);
    }
  }
  return out;
}

/**
 * How far underground the road is at s along the lap: 0 up on the lawn … 1 from 3 m down (the cars
 * switch their lights on as they go down into a tunnel or the aquarium, and off as they come up).
 */
export function undergroundAt(s: number) {
  const L = TRACK.length;
  const ss = ((s % L) + L) % L;
  for (const u of TRACK.unders)
    if (ss >= u.s0 && ss <= u.s0 + u.length) return Math.min(1, Math.max(0, (u.y0 - heightAt(ss)) / 3));
  return 0;
}

/** Is (x, z) over an underground piece's dig (or its covered tunnel), `margin` metres round it included? */
export function overUnder(x: number, z: number, margin = 0) {
  for (const u of TRACK.unders) {
    const P = UNDER[u.cmd];
    const dx = x - u.x, dz = z - u.z;
    const a = dx * u.fx + dz * u.fz, l = Math.abs(dx * u.fz - dz * u.fx);
    if (a < -margin || a > u.length + margin) continue;
    const pit = u.cmd === "SUB" && a > P.down * TILE - margin && a < (P.down + P.flat) * TILE + margin;
    if (l < (pit ? PIT_HALF : TRENCH_HALF) + margin) return true;
  }
  return false;
}

/** How far below where it started the road is (tiles, ≤ 0), u tiles along an underground piece: easing down, level, easing up. */
export function underProfile(cmd: UnderCmd, u: number) {
  const P = UNDER[cmd];
  if (u <= P.down) return -P.depth * rampProfile(u / P.down);
  if (u <= P.down + P.flat) return -P.depth;
  return -P.depth * (1 - rampProfile((u - P.down - P.flat) / P.up));
}

// ------------------------------------------------------------------ the loop (its shape)

/**
 * The loop-the-loop: a flat run in, once round a vertical teardrop (radius LOOP_R, gentler at the
 * bottom, tighter over the top — like a real one) while sliding one tile to the left so the way out
 * passes beside the way in, and a flat run out. All in metres: forward, left, up from where it starts.
 */
export const LOOP_R = 15;
/** metres of forward travel per radian round (what turns a circle into a teardrop) */
const LOOP_A = 2;
export const LOOP_SHIFT = TILE;
const LOOP_LEN = 2 * TILE;
const LOOP_RUN = (LOOP_LEN - 2 * Math.PI * LOOP_A) / 2;
/** where (as a fraction of the parameter u) the climb starts and ends */
const U1 = 0.12, U2 = 0.88;
/** 0 → 1 with zero slope and curvature at both ends */
const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
function loopLocal(u: number): [number, number, number] {
  if (u <= U1) return [LOOP_RUN * (u / U1), 0, 0];
  if (u >= U2) return [LOOP_LEN - LOOP_RUN * ((1 - u) / (1 - U2)), LOOP_SHIFT, 0];
  const k = (u - U1) / (U2 - U1);
  const th = 2 * Math.PI * k;
  return [LOOP_RUN + LOOP_R * Math.sin(th) + LOOP_A * th, LOOP_SHIFT * smoother(k), LOOP_R * (1 - Math.cos(th))];
}

export interface Placement {
  /** model file in public/models */
  file: string;
  /** world position of the model's origin (metres) and its turn about +y */
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface Sample {
  x: number;
  y: number;
  z: number;
  /** direction of travel (yaw: 0 = +z) */
  heading: number;
  /** distance from the start of the lap (metres) */
  s: number;
}

type V = [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
/** right of a heading in this right-handed scene (+z → −x) */
const rightOf = (h: V): V => [-h[1], h[0]];
const leftOf = (h: V): V => [h[1], -h[0]];
/** yaw that turns +z onto the heading */
export const yawOf = (h: V) => Math.atan2(h[0], h[1]);
/** rotate a vector by a yaw (the same turn Babylon gives a node with that rotation about +y) */
const rot = (v: V, yaw: number): V => [v[0] * Math.cos(yaw) + v[1] * Math.sin(yaw), -v[0] * Math.sin(yaw) + v[1] * Math.cos(yaw)];

interface Raw {
  cmd: string;
  models: { file: string; origin: V; yaw: number; base: number }[];
  pts: [number, number, number][];
  length: number;
  elevated: boolean;
  /** the loop's way in, its heading and its left (tile units) */
  loop?: { entry: V; h: V; left: V; level: number };
  /** up on a hill: the tile's footprint (its four corners, tile units), the deck it stands on */
  deck?: V[];
  /** underground: where it starts and the way it runs (tile units) */
  under?: { entry: V; h: V };
}

/** Points evenly spaced along a parametric path (by 3D arc length); returns that length. */
function resample(path: (u: number) => [number, number, number], into: [number, number, number][], n: number) {
  const D = 2000;
  const dense = Array.from({ length: D + 1 }, (_, k) => path(k / D));
  const cum = [0];
  for (let k = 1; k <= D; k++) cum.push(cum[k - 1] + Math.hypot(dense[k][0] - dense[k - 1][0], dense[k][1] - dense[k - 1][1], dense[k][2] - dense[k - 1][2]));
  const total = cum[D];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const target = (k / n) * total;
    while (j < D - 1 && cum[j + 1] < target) j++;
    const t = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const a = dense[j], b = dense[j + 1];
    into.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  return total;
}

/** Lays the tiles in tile units; the caller centres and scales. */
function lay(cmds: string[]): Raw[] {
  let p: V = [0, 0];
  let h: V = [0, 1];
  let level = 0;
  const out: Raw[] = [];
  /**
   * A model whose canonical entry — the middle of the road where it crosses the tile's z = 0 edge,
   * at x = −0.5 in the kit (−0.63 on the start tile, whose gantry sticks out) — sits at `entry`.
   */
  const at = (file: string, entry: V, yaw: number, base: number, centre = 0.5) => ({ file, origin: add(entry, rot([centre, 0], yaw)), yaw, base });
  for (const cmd of cmds) {
    const p0 = p, h0 = h;
    const pts: [number, number, number][] = [];
    const N = 24;
    const line = (len: number, dy: number) => {
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        // the curved ramps ease in and out; turned round for the way down, the ramp measures
        // exactly 1 − (the way up) at the same point along it
        const e = dy === 0 ? 0 : rampProfile(t);
        pts.push([p[0] + h[0] * len * t, p[1] + h[1] * len * t, level + dy * e]);
      }
    };
    const arc = (R: number, sweep: number, side: 1 | -1) => {
      const r = rightOf(h);
      for (let k = 0; k <= N; k++) {
        const th = (k / N) * sweep;
        const fw = R * Math.sin(th);
        const sd = R * (1 - Math.cos(th)) * side;
        pts.push([p[0] + h[0] * fw + r[0] * sd, p[1] + h[1] * fw + r[1] * sd, level]);
      }
    };
    const yaw = yawOf(h);
    let models: Raw["models"] = [];
    let length = 0;
    let elevated = false;
    let loop: Raw["loop"];
    switch (cmd) {
      case "LOOP": {
        // our own geometry (RaceTrack.ts builds it): up and over, upside down at the top, down again a tile to the left
        const left = leftOf(h);
        const [p0, h0, lv] = [p, h, level];
        length = resample((u) => {
          const [f, l, y] = loopLocal(u);
          return [p0[0] + (h0[0] * f + left[0] * l) / TILE, p0[1] + (h0[1] * f + left[1] * l) / TILE, lv + y / TILE];
        }, pts, 220);
        loop = { entry: p0, h: h0, left, level: lv };
        p = add(add(p, mul(h, LOOP_LEN / TILE)), mul(left, LOOP_SHIFT / TILE));
        elevated = true;
        break;
      }
      case "S":
      case "GRID":
      case "START": {
        const len = cmd === "S" ? 1 : 2;
        const file = cmd === "S" ? "roadStraight.glb" : cmd === "GRID" ? "roadStartPositions.glb" : "roadStart.glb";
        models = [at(file, p, yaw, level, cmd === "START" ? 0.63 : 0.5)];
        line(len, 0);
        p = add(p, mul(h, len));
        length = len;
        break;
      }
      case "SUB":
      case "TUN": {
        // our own road (Underworld.ts builds it), straight on: down, along the bottom, up again
        const P = UNDER[cmd];
        const n = P.down + P.flat + P.up;
        const M = n * 12;
        for (let k = 0; k <= M; k++) {
          const u = (k / M) * n;
          pts.push([p[0] + h[0] * u, p[1] + h[1] * u, level + underProfile(cmd, u)]);
        }
        p = add(p, mul(h, n));
        length = n;
        break;
      }
      case "BR":
        // the bridge tile's deck is ½ tile up, with walls down to the ground
        models = [at("roadStraightBridge.glb", p, yaw, level - RISE)];
        line(1, 0);
        p = add(p, h);
        length = 1;
        elevated = true;
        break;
      case "UP":
        models = [at("roadRampLongCurved.glb", p, yaw, level)];
        line(2, RISE);
        p = add(p, mul(h, 2));
        level += RISE;
        length = 2;
        elevated = true;
        break;
      case "DN": {
        // the same ramp, turned round, its low end where we come off it
        const end = add(p, mul(h, 2));
        models = [at("roadRampLongCurved.glb", end, yaw + Math.PI, level - RISE)];
        line(2, -RISE);
        p = end;
        level -= RISE;
        length = 2;
        elevated = true;
        break;
      }
      case "R2":
      case "R3":
      case "L2":
      case "L3": {
        const R = cmd.endsWith("2") ? 1.5 : 2.5;
        const big = cmd.endsWith("3");
        const files = big ? ["roadCornerLarger.glb", "roadCornerLargerBorder.glb", "roadCornerLargerBorderInner.glb"] : ["roadCornerLarge.glb", "roadCornerLargeBorder.glb", "roadCornerLargeBorderInner.glb"];
        if (cmd[0] === "R") {
          // the kit's corners turn right: in at (0, 0) heading +z, out at (−R, R) heading −x
          models = files.map((f) => at(f, p, yaw, level));
          arc(R, Math.PI / 2, 1);
          p = add(add(p, mul(h, R)), mul(rightOf(h), R));
          h = rightOf(h);
        } else {
          // a left turn is the same tile driven the other way: its exit edge is our way in
          const y2 = yaw - Math.PI / 2;
          const origin = add(p, mul(rot([-R, R], y2), -1));
          models = files.map((f) => ({ file: f, origin: add(origin, rot([0.5, 0], y2)), yaw: y2, base: level }));
          arc(R, Math.PI / 2, -1);
          p = add(add(p, mul(h, R)), mul(leftOf(h), R));
          h = leftOf(h);
        }
        length = (R * Math.PI) / 2;
        break;
      }
      case "HR":
      case "HL": {
        // hairpin: the kit's half circle goes round to the right, two tiles over
        if (cmd === "HR") {
          models = ["roadHalfCircle.glb", "roadHalfCircleBorder.glb"].map((f) => at(f, p, yaw, level));
          arc(1, Math.PI, 1);
          p = add(p, mul(rightOf(h), 2));
        } else {
          // driven the other way round: in at its far end, which sits two tiles to our left
          const origin = add(p, mul(leftOf(h), 2));
          models = ["roadHalfCircle.glb", "roadHalfCircleBorder.glb"].map((f) => at(f, origin, yaw, level));
          arc(1, Math.PI, -1);
          p = origin;
        }
        h = [-h[0], -h[1]];
        length = Math.PI;
        break;
      }
      default:
        throw new Error(`unknown track piece ${cmd}`);
    }
    // a bend up on a hill: its tile's square, to stand it on (forward 0…f, out to the side it turns −½…w)
    let deck: V[] | undefined;
    if (level > 1e-6 && /^(R|L|H)/.test(cmd)) {
      const [f, w] = cmd[0] === "H" ? [1.5, 2.5] : cmd.endsWith("2") ? [2, 1.5] : [3, 2.5];
      const side = cmd === "HL" || cmd[0] === "L" ? leftOf(h0) : rightOf(h0);
      const at2 = (a: number, b: number) => add(add(p0, mul(h0, a)), mul(side, b));
      deck = [at2(0, -0.5), at2(f, -0.5), at2(f, w), at2(0, w)];
      elevated = true;
    }
    out.push({ cmd, models, pts, length, elevated, loop, deck, under: isUnder(cmd) ? { entry: p0, h: h0 } : undefined });
  }
  return out;
}

/** The loop in world terms (see loopPose). */
export interface LoopInfo {
  /** where it starts along the lap, and its length (m, along the road) */
  s0: number;
  length: number;
  /** its way in (world), the way it runs and its left (unit vectors on the ground), and the road level */
  x: number;
  z: number;
  fx: number;
  fz: number;
  lx: number;
  lz: number;
  y0: number;
  /** u (the shape's parameter, 0–1) at each metre along it */
  uAt: number[];
  /** metres along it where the climb starts and where it is back on the ground */
  climbIn: number;
  climbOut: number;
}

export interface Track {
  /** every piece: where it starts along the lap (m), how long it is, and its road level at the start (m) */
  pieces: { cmd: string; s0: number; length: number; elevated: boolean; y0: number }[];
  loop: LoopInfo | null;
  models: Placement[];
  samples: Sample[];
  /** one lap, metres */
  length: number;
  /** where the lap starts: the start gantry */
  startS: number;
  bounds: { x0: number; x1: number; z0: number; z1: number };
  /** where the turtle ended up (tiles, before centring) — (0, 0) heading +z for a closed lap */
  end: { p: V; h: V; level: number };
  /** the concrete decks under the bends up on the hills: four corners (world x, z) and the height of their top (m) */
  decks: { pts: [number, number][]; y: number }[];
  /** the underground pieces: where each starts (along the lap and in the world), the way it runs (a unit axis), its ground level (m) */
  unders: { cmd: UnderCmd; s0: number; length: number; x: number; z: number; fx: number; fz: number; y0: number }[];
}

export function buildTrack(cmds: string[] = LAYOUT): Track {
  const raw = lay(cmds);
  // the turtle's end pose, for the closure test
  let p: V = [0, 0];
  let h: V = [0, 1];
  let level = 0;
  {
    const last = raw[raw.length - 1].pts;
    const q = last[last.length - 1];
    p = [q[0], q[1]];
    level = q[2];
    const prev = last[last.length - 2];
    const d = Math.hypot(q[0] - prev[0], q[1] - prev[1]) || 1;
    h = [Math.round((q[0] - prev[0]) / d), Math.round((q[1] - prev[1]) / d)];
  }
  // centre the circuit on the origin
  const all = raw.flatMap((r) => r.pts);
  const minX = Math.min(...all.map((q) => q[0])), maxX = Math.max(...all.map((q) => q[0]));
  const minZ = Math.min(...all.map((q) => q[1])), maxZ = Math.max(...all.map((q) => q[1]));
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const W = (x: number) => (x - cx) * TILE;
  const Z = (z: number) => (z - cz) * TILE;

  const models: Placement[] = [];
  const decks: Track["decks"] = [];
  const unders: Track["unders"] = [];
  const samples: Sample[] = [];
  const pieces: Track["pieces"] = [];
  let loop: LoopInfo | null = null;
  let s = 0;
  let startS = 0;
  let y0 = 0;
  for (const r of raw) {
    for (const m of r.models) models.push({ file: m.file, x: W(m.origin[0]), y: m.base * TILE, z: Z(m.origin[1]), yaw: m.yaw });
    if (r.under && isUnder(r.cmd)) unders.push({ cmd: r.cmd, s0: s, length: r.length * TILE, x: W(r.under.entry[0]), z: Z(r.under.entry[1]), fx: r.under.h[0], fz: r.under.h[1], y0 });
    if (r.deck) decks.push({ pts: r.deck.map((q) => [W(q[0]), Z(q[1])] as [number, number]), y: r.pts[0][2] * TILE });
    pieces.push({ cmd: r.cmd, s0: s, length: r.length * TILE, elevated: r.elevated, y0 });
    if (r.cmd === "UP") y0 += RISE * TILE;
    if (r.cmd === "DN") y0 -= RISE * TILE;
    if (r.cmd === "START") startS = s + TILE; // the gantry stands in the middle of the 2-tile start piece
    if (r.loop) {
      const L = r.length * TILE;
      const info: LoopInfo = { s0: s, length: L, x: W(r.loop.entry[0]), z: Z(r.loop.entry[1]), fx: r.loop.h[0], fz: r.loop.h[1], lx: r.loop.left[0], lz: r.loop.left[1], y0: r.loop.level * TILE, uAt: [], climbIn: 0, climbOut: 0 };
      // invert arc length → u, a metre at a time
      const D = 4000;
      let acc = 0;
      let prev = loopPoint(info, 0);
      let next = 0;
      for (let k = 1; k <= D; k++) {
        const u = k / D;
        const q = loopPoint(info, u);
        const seg = Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
        while (next <= acc + seg && next <= L) {
          info.uAt.push((k - 1 + (next - acc) / (seg || 1)) / D);
          next++;
        }
        acc += seg;
        prev = q;
      }
      while (info.uAt.length <= Math.ceil(L) + 1) info.uAt.push(1);
      // the run-in is straight and flat, LOOP_RUN long; the run-out likewise
      info.climbIn = LOOP_RUN;
      info.climbOut = L - LOOP_RUN;
      loop = info;
    }
    // samples every ~2 m
    const n = Math.max(2, Math.round((r.length * TILE) / 2));
    for (let k = 0; k < n; k++) {
      const f = (k / n) * (r.pts.length - 1);
      const i = Math.floor(f);
      const a = r.pts[i], b = r.pts[Math.min(i + 1, r.pts.length - 1)];
      const t = f - i;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = a[2] + (b[2] - a[2]) * t;
      const heading = Math.atan2(b[0] - a[0], b[1] - a[1]);
      samples.push({ x: W(x), y: y * TILE, z: Z(z), heading, s: s + (k / n) * r.length * TILE });
    }
    s += r.length * TILE;
  }
  const xs = samples.map((q) => q.x), zs = samples.map((q) => q.z);
  return {
    pieces,
    loop,
    models,
    samples,
    length: s,
    startS,
    bounds: { x0: Math.min(...xs) - TILE, x1: Math.max(...xs) + TILE, z0: Math.min(...zs) - TILE, z1: Math.max(...zs) + TILE },
    end: { p, h, level },
    decks,
    unders,
  };
}

/** The track being driven (the Grand Circuit unless setLayout picked another). */
export let TRACK = buildTrack();
let current = LAYOUT;

/** Drive a different track from now on (the 3D world is rebuilt round it). */
export function setLayout(layout: string[]) {
  if (layout === current) return;
  current = layout;
  TRACK = buildTrack(layout);
}

/** Is the Grand Circuit (the one with the portfolio on it) the track being driven? */
export const onMainCircuit = () => current === LAYOUT;

/** Where the car starts: on the grid, just behind the start gantry, facing along the track. */
export function startPose(lateral = 0) {
  const s = sampleAt(TRACK.startS - TILE * 0.8);
  // (lateral: metres to the left of the centre line — split screen, the two players side by side)
  return { x: s.x + Math.cos(s.heading) * lateral, z: s.z - Math.sin(s.heading) * lateral, heading: s.heading };
}

/** The sample at distance s along the lap (wraps). */
export function sampleAt(s: number): Sample {
  const L = TRACK.length;
  const ss = ((s % L) + L) % L;
  const arr = TRACK.samples;
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid].s <= ss) lo = mid;
    else hi = mid - 1;
  }
  return arr[lo];
}

/**
 * The closest centre-line sample to (x, z) — searched near `hint` (the last answer) first, which
 * is all that's needed while driving; a full search when that is far off. (Plan distance only: the
 * lap never passes over or under itself.)
 */
export function nearestSample(x: number, z: number, hint = -1): { i: number; d: number } {
  const arr = TRACK.samples;
  const score = (q: Sample) => Math.hypot(q.x - x, q.z - z);
  let best = -1;
  let bd = Infinity;
  if (hint >= 0) {
    for (let k = -40; k <= 40; k++) {
      const i = (hint + k + arr.length) % arr.length;
      const d = score(arr[i]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (bd < TILE * 1.2) return { i: best, d: Math.hypot(arr[best].x - x, arr[best].z - z) };
  }
  for (let i = 0; i < arr.length; i++) {
    const d = score(arr[i]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return { i: best, d: Math.hypot(arr[best].x - x, arr[best].z - z) };
}

/** The index of the sample at or before s (wraps). */
export function sampleIndexAt(s: number) {
  const L = TRACK.length;
  const ss = ((s % L) + L) % L;
  const arr = TRACK.samples;
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid].s <= ss) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Is s (wrapped) on the loop-the-loop's climb (off the ground)? */
export function onLoopClimb(s: number) {
  const L = TRACK.loop;
  if (!L) return false;
  const d = (((s - L.s0) % TRACK.length) + TRACK.length) % TRACK.length;
  return d > L.climbIn - 2 && d < L.climbOut + 2;
}

/** The point `lat` metres left of the centre line `s` metres along the lap, on the road surface (not on the loop). */
export function pointAt(s: number, lat = 0) {
  const L = TRACK.length;
  const ss = ((s % L) + L) % L;
  const S = TRACK.samples;
  const i = sampleIndexAt(ss);
  const a = S[i], b = S[(i + 1) % S.length];
  const span = (b.s - a.s + L) % L || 1;
  const f = Math.min(1, Math.max(0, (ss - a.s) / span));
  let dh = b.heading - a.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const heading = a.heading + dh * f;
  const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
  return { x: x + Math.cos(heading) * lat, y: heightAt(ss) + SURFACE, z: z - Math.sin(heading) * lat, heading, s: ss };
}

/** Is (x, z) on the asphalt (not the grass verge)? */
export const onAsphalt = (d: number) => d < ROAD_HALF * TILE + 0.4;

/** Signed distance of (x, z) from the centre line at sample i: + to the left of the way round. */
export function lateralOf(x: number, z: number, i: number) {
  const q = TRACK.samples[i];
  return (x - q.x) * Math.cos(q.heading) - (z - q.z) * Math.sin(q.heading);
}

/** How high the road's centre line is at distance s along the lap — smooth (the exact ramp profile). */
export function heightAt(s: number): number {
  const L = TRACK.length;
  const ss = ((s % L) + L) % L;
  const P = TRACK.pieces;
  let lo = 0, hi = P.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (P[mid].s0 <= ss) lo = mid;
    else hi = mid - 1;
  }
  const p = P[lo];
  const t = (ss - p.s0) / p.length;
  if (p.cmd === "LOOP") return loopPose(ss - p.s0).pos[1];
  if (p.cmd === "UP") return p.y0 + RISE * TILE * rampProfile(t);
  if (p.cmd === "DN") return p.y0 - RISE * TILE * rampProfile(t); // the ramp turned round (measured: 1 − the way up)
  if (isUnder(p.cmd)) return p.y0 + underProfile(p.cmd, (t * p.length) / TILE) * TILE;
  return p.y0;
}

/** The kit's asphalt is 1 % of a tile above the level it is laid at. */
export const SURFACE = 0.01 * TILE;

/**
 * How high the solid ground is under (x, z): within a tile's width of the centre line, the road at
 * its level (the hills and bridges are solid underneath); else the lawn. (The loop is hollow: under
 * it, the lawn.) For the camera — exact and far cheaper than ray casts.
 */
export function groundAt(x: number, z: number, hint = -1): { y: number; i: number } {
  const t = trackS(x, z, hint);
  const L = TRACK.loop;
  const d = L ? t.s - L.s0 : -1;
  if (L && d > L.climbIn && d < L.climbOut) return { y: 0, i: t.i };
  const lat = Math.abs(lateralOf(x, z, t.i));
  if (lat < TILE * 0.5 + 0.5) return { y: heightAt(t.s) + SURFACE, i: t.i };
  // beside a bend up on a hill: the top of the deck it stands on
  const deck = TRACK.decks.find((d) => onDeck(d.pts, x, z));
  return { y: deck ? deck.y : 0, i: t.i };
}

/** Is (x, z) on a deck's footprint (a convex quad), `margin` metres round it included? */
export function onDeck(pts: [number, number][], x: number, z: number, margin = 0) {
  // (inside every edge, whichever way round the corners go)
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const ex = bx - ax, ez = bz - az, len = Math.hypot(ex, ez) || 1;
    const c = (ex * (z - az) - ez * (x - ax)) / len;
    if (!sign) sign = Math.sign(c) || 1;
    if (c * sign < -margin) return false;
  }
  return true;
}

/**
 * Exactly how far along the lap (x, z) is: the nearest centre-line sample (searched near `hint`),
 * then projected onto the stretch of centre line beside it.
 */
export function trackS(x: number, z: number, hint = -1): { i: number; s: number; d: number } {
  const { i, d } = nearestSample(x, z, hint);
  const arr = TRACK.samples;
  const n = arr.length;
  const L = TRACK.length;
  const a = arr[i], b = arr[(i + 1) % n], p = arr[(i - 1 + n) % n];
  const along = (u: Sample, v: Sample) => {
    const dx = v.x - u.x, dz = v.z - u.z;
    return ((x - u.x) * dx + (z - u.z) * dz) / (dx * dx + dz * dz || 1);
  };
  const ahead = along(a, b);
  const s = ahead >= 0 ? a.s + Math.min(1, ahead) * ((b.s - a.s + L) % L) : p.s + Math.max(0, Math.min(1, along(p, a))) * ((a.s - p.s + L) % L);
  return { i, s: ((s % L) + L) % L, d };
}

// ------------------------------------------------------------------ the loop (in the world)

/** World position (m) of the loop's centre line at u. */
function loopPoint(L: LoopInfo, u: number): [number, number, number] {
  const [f, l, y] = loopLocal(u);
  return [L.x + L.fx * f + L.lx * l, L.y0 + y, L.z + L.fz * f + L.lz * l];
}

export interface LoopPose {
  /** the road's centre line (the car's wheels sit SURFACE above it, along `up`) */
  pos: [number, number, number];
  /** the way along the road, the road's "up" (towards the middle of the loop on the climb) and its left — unit vectors */
  t: [number, number, number];
  up: [number, number, number];
  left: [number, number, number];
  /** 0 → 1 once round (the climb), < 0 on the run-in, > 1 on the run-out */
  k: number;
}

/** Where on the loop piece you are, `d` metres along it (0 – TRACK.loop.length). */
export function loopPose(d: number): LoopPose {
  const L = TRACK.loop!;
  const m = Math.max(0, Math.min(L.uAt.length - 1.0001, d));
  const i = Math.floor(m);
  const u = L.uAt[i] + (L.uAt[i + 1] - L.uAt[i]) * (m - i);
  const e = 1e-4;
  const a = loopPoint(L, Math.max(0, u - e)), b = loopPoint(L, Math.min(1, u + e));
  let t: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const tl = Math.hypot(...t) || 1;
  t = [t[0] / tl, t[1] / tl, t[2] / tl];
  // left: the loop's sideways axis, made square to the way along; up = along × left (+z × +x = +y)
  const dot = L.lx * t[0] + L.lz * t[2];
  let lf: [number, number, number] = [L.lx - dot * t[0], -dot * t[1], L.lz - dot * t[2]];
  const ll = Math.hypot(...lf) || 1;
  lf = [lf[0] / ll, lf[1] / ll, lf[2] / ll];
  const up: [number, number, number] = [t[1] * lf[2] - t[2] * lf[1], t[2] * lf[0] - t[0] * lf[2], t[0] * lf[1] - t[1] * lf[0]];
  return { pos: loopPoint(L, u), t, up, left: lf, k: (u - U1) / (U2 - U1) };
}

/** The point `lat` metres to the left of the centre line and `rise` above the road, `d` metres along the loop. */
export function loopAt(d: number, lat: number, rise: number) {
  const q = loopPose(d);
  return [q.pos[0] + q.left[0] * lat + q.up[0] * rise, q.pos[1] + q.left[1] * lat + q.up[1] * rise, q.pos[2] + q.left[2] * lat + q.up[2] * rise] as [number, number, number];
}

/** The loop's top, middle (for the camera that watches it from the side). */
export function loopTop() {
  const L = TRACK.loop!;
  const [f, l, y] = loopLocal(0.5);
  return { x: L.x + L.fx * f + L.lx * l, y: L.y0 + y, z: L.z + L.fz * f + L.lz * l };
}

/**
 * Where the camera watches the loop from while you are on it: off to the right of the way in
 * (the sun is behind it there, so the loop is lit), looking at the loop's middle.
 */
export function loopView() {
  const L = TRACK.loop!;
  const [f, l] = loopLocal(0.5);
  const centre = { x: L.x + L.fx * f + L.lx * l, y: L.y0 + LOOP_R, z: L.z + L.fz * f + L.lz * l };
  const D = 42;
  return { centre, cam: { x: centre.x - L.lx * D, y: L.y0 + 12, z: centre.z - L.lz * D }, fx: L.fx, fz: L.fz };
}

/** Is (x, z) where the loop stands, or between it and the camera that watches it? (Kept clear of trees and boards.) */
export function nearLoop(x: number, z: number, margin = 0) {
  if (!TRACK.loop) return false;
  const v = loopView();
  // the loop's footprint, roughly: a circle round its middle
  if (Math.hypot(x - v.centre.x, z - v.centre.z) < 40 + margin) return true;
  // the corridor from the camera to the loop (and a little round the camera)
  const ax = v.cam.x, az = v.cam.z, bx = v.centre.x, bz = v.centre.z;
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < 22 + margin;
}

export interface Frame {
  pos: [number, number, number];
  left: [number, number, number];
  up: [number, number, number];
  s: number;
}

/**
 * The road's frame — its centre line (at the level it is laid at), its left and its up — all the way
 * round: at every sample, and every metre round the loop (where the road turns over). Walls and the
 * loop's own deck are built along these.
 */
export function roadFrames(): Frame[] {
  const out: Frame[] = [];
  const L = TRACK.loop;
  let loopDone = false;
  for (const q of TRACK.samples) {
    if (L && q.s >= L.s0 - 1e-6 && q.s < L.s0 + L.length - 1e-6) {
      if (!loopDone) {
        loopDone = true;
        for (let d = 0; d < L.length; d += 1) {
          const p = loopPose(d);
          out.push({ pos: p.pos, left: p.left, up: p.up, s: L.s0 + d });
        }
      }
      continue;
    }
    out.push({ pos: [q.x, q.y, q.z], left: [Math.cos(q.heading), 0, -Math.sin(q.heading)], up: [0, 1, 0], s: q.s });
  }
  return out;
}

/** The boost pad on the straight before the loop: where along the lap it starts and ends, and its half width (m). */
export function boostPad() {
  const L = TRACK.loop;
  return L ? { s0: L.s0 - 19, s1: L.s0 - 5, half: 5 } : null;
}
