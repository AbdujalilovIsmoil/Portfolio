import { Color3, Mesh, MeshBuilder, type InstancedMesh, type Node, type StandardMaterial } from "@babylonjs/core";
import { musicFile } from "./musicChoice";
import type { MutableRefObject } from "react";
import { Countdown } from "./countdown";
import { formatLap, type DriveSignal } from "./driveSignal";
import type { MissionDef } from "./game";
import type { IntroSignal } from "./introSignal";
import { LapClock } from "./laps";
import { saveMission } from "./progress";
import { buildRace } from "./Race";
import type { PlaySignal } from "./raceSignal";
import { drawBoostPad } from "./RaceTrack";
import { playChime, playPickup } from "./sound";
import { ROAD_HALF, TILE, TRACK, lateralOf, onLoopClimb, pointAt, sampleIndexAt } from "./Track";
import { canvasTexture, group, hash, lit, unlit, type Ctx, type DynamicCollider } from "./core";

export interface MissionDeps {
  playRef: MutableRefObject<PlaySignal>;
  driveRef: MutableRefObject<DriveSignal>;
  introRef: MutableRefObject<IntroSignal>;
}

type Marker = DriveSignal["markers"][number];
/** the end, and why; `time`: the time that counts, when it isn't the time since GO (a hot lap's lap) */
type Over = { over: "won" | "lost"; why?: string; time?: number } | void;

/** A mission's own rules: what it puts on the track, and a step a frame while the clock runs. */
interface Rules {
  /** one step (`time`: seconds since GO); says when it is over */
  step(dt: number, time: number): Over;
  /** things that move whether or not the clock runs (coins spin, knocked cones fall) */
  idle?(dt: number, t: number): void;
  /** seconds left on the clock (default: the mission's time less the time since GO; null: no clock) */
  timeLeft?(time: number): number | null;
}

interface Env {
  ctx: Ctx;
  root: Node;
  def: MissionDef;
  play: PlaySignal;
  markers: Marker[];
  /** how far the car has driven along the lap, counting on past each lap (metres) */
  prog: () => number;
}

const WOOD: [number, number, number][] = [
  [0.42, 0.24, 0.1],
  [0.55, 0.33, 0.15],
  [0.3, 0.17, 0.07],
];

const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/** `n` spots spread round one lap, from `from` over `span` metres, none on the loop's climb. */
export function spread(n: number, from: number, span: number) {
  return Array.from({ length: n }, (_, k) => {
    let s = from + (k + 0.5) * (span / n);
    while (onLoopClimb(s)) s += 6;
    return s;
  });
}

/** `n` spots on straight road (for cones, bays, boost pads), at least `gap` metres apart, from `from` round the lap. */
export function straightSpots(n: number, gap: number, from = TRACK.startS + 30, span = TRACK.length - 60) {
  const ok: number[] = [];
  for (let s = from; s < from + span; s += 3) {
    const a = pointAt(s - 14), b = pointAt(s + 14);
    if (Math.abs(wrap(b.heading - a.heading)) < 0.03 && Math.abs(a.y - b.y) < 0.6 && !onLoopClimb(s - 20) && !onLoopClimb(s + 20)) ok.push(s);
  }
  const out: number[] = [];
  for (const s of ok) if (!out.length || s - out[out.length - 1] >= gap) out.push(s);
  // spread the picks evenly over what there is
  if (out.length <= n) return out;
  return Array.from({ length: n }, (_, k) => out[Math.floor((k + 0.5) * (out.length / n))]);
}

const hidden = (m: Mesh) => {
  m.isVisible = false;
  m.isPickable = false;
  return m;
};

function copy(m: Mesh, parent: Node, x: number, y: number, z: number, yaw = 0): InstancedMesh {
  const c = m.createInstance(m.name);
  c.parent = parent;
  c.position.set(x, y, z);
  c.rotation.y = yaw;
  c.isPickable = false;
  return c;
}

// ------------------------------------------------------------------ textures

function bannerTexture(ctx: Ctx, color: string) {
  return canvasTexture(ctx, 256, 32, (g) => {
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? "#111318" : "#f4f4f4";
      g.fillRect(i * 16, 0, 16, 8);
      g.fillStyle = i % 2 ? "#f4f4f4" : "#111318";
      g.fillRect(i * 16, 24, 16, 8);
    }
    g.fillStyle = color;
    g.fillRect(0, 8, 256, 16);
  });
}

function crateTexture(ctx: Ctx) {
  return canvasTexture(ctx, 128, 128, (g) => {
    g.fillStyle = "#9a6a3c";
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? "rgba(70,40,15,0.35)" : "rgba(200,150,90,0.25)";
      g.fillRect(0, i * 21, 128, 21);
    }
    g.strokeStyle = "#5a3818";
    g.lineWidth = 12;
    g.strokeRect(6, 6, 116, 116);
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(118, 118);
    g.stroke();
  });
}

function bayTexture(ctx: Ctx) {
  const t = canvasTexture(ctx, 128, 224, (g) => {
    g.clearRect(0, 0, 128, 224);
    g.fillStyle = "rgba(40,140,255,0.28)";
    g.fillRect(0, 0, 128, 224);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 9;
    g.strokeRect(5, 5, 118, 214);
    g.fillStyle = "#ffffff";
    g.font = "bold 96px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("P", 64, 112);
  });
  return t;
}

// ------------------------------------------------------------------ the twelve kinds

/** Through every gate, in order. */
function gates(env: Env): Rules {
  const { ctx, root, def, play, markers } = env;
  const n = def.target;
  const L = TRACK.length;
  const at = spread(n, TRACK.startS + 25, L - 45);
  const half = ROAD_HALF * TILE + 0.7;
  const post = hidden(MeshBuilder.CreateCylinder("gatePost", { height: 6.6, diameter: 0.5, tessellation: 10 }, ctx.scene));
  post.material = lit(ctx, { color: "#2b303b", rough: 0.5, metal: 0.4 });
  post.parent = root;
  const banner = hidden(MeshBuilder.CreateBox("gateBanner", { width: half * 2 + 0.6, height: 1.3, depth: 0.35 }, ctx.scene));
  const bm = lit(ctx, { color: "#ffffff", rough: 0.6 });
  bm.albedoTexture = bannerTexture(ctx, "#e8e8e8");
  banner.material = bm;
  banner.parent = root;
  const glow = MeshBuilder.CreateBox("gateNext", { width: half * 2 + 0.9, height: 1.5, depth: 0.5 }, ctx.scene);
  glow.material = unlit(ctx, { map: bannerTexture(ctx, "#ff8a1f"), opaque: true });
  glow.parent = root;
  glow.isPickable = false;
  for (const m of [post, banner, glow]) ctx.shadow?.addShadowCaster(m, false);
  const list = at.map((s) => {
    const p = pointAt(s);
    const parts = [-1, 1].map((side) => copy(post, root, p.x + Math.cos(p.heading) * half * side, p.y + 3.3, p.z - Math.sin(p.heading) * half * side));
    parts.push(copy(banner, root, p.x, p.y + 6.2, p.z, p.heading));
    markers.push({ x: p.x, z: p.z, color: "#ffffff" });
    return { s, p, parts };
  });
  let next = 0;
  const show = () => {
    const g = list[next];
    glow.setEnabled(!!g);
    if (g) {
      glow.position.set(g.p.x, g.p.y + 6.2, g.p.z);
      glow.rotation.y = g.p.heading;
    }
    markers.forEach((m, i) => {
      m.color = i < next ? "rgba(255,255,255,0)" : i === next ? "#ff8a1f" : "#ffffff";
      m.ring = i === next;
    });
  };
  show();
  return {
    step() {
      while (next < n && env.prog() >= list[next].s) {
        list[next].parts.forEach((c) => c.setEnabled(false));
        next++;
        playPickup(1 + next * 0.03);
        show();
      }
      play.progress = next;
      play.status = next < n ? `Gate ${next + 1} of ${n}` : "";
      if (next >= n) return { over: "won" };
    },
  };
}

/** Pick up the coins. */
function coins(env: Env): Rules {
  const { ctx, root, def, play, markers } = env;
  const n = def.target;
  const at = spread(n, TRACK.startS + 25, TRACK.length - 40);
  const coin = MeshBuilder.CreateCylinder("coin", { height: 0.18, diameter: 1.5, tessellation: 28 }, ctx.scene);
  coin.rotation.x = Math.PI / 2;
  coin.bakeCurrentTransformIntoVertices();
  coin.material = lit(ctx, { color: "#ffd24a", metal: 0.6, rough: 0.25, emissive: "#b07a00", ei: 1.1 });
  coin.parent = root;
  hidden(coin);
  const list = at.map((s, k) => {
    const p = pointAt(s, Math.sin(k * 1.7) * 5);
    markers.push({ x: p.x, z: p.z, color: "#ffc531" });
    return { c: copy(coin, root, p.x, p.y + 1.3, p.z), x: p.x, y: p.y + 1.3, z: p.z, got: false };
  });
  let got = 0;
  return {
    idle(_, t) {
      list.forEach((c, k) => {
        if (c.got) return;
        c.c.rotation.y = t * 2.6 + k;
        c.c.position.y = c.y + Math.sin(t * 2 + k) * 0.15;
      });
    },
    step() {
      const p = ctx.player;
      list.forEach((c, i) => {
        if (c.got || Math.hypot(p.x - c.x, p.z - c.z) > 2.6 || Math.abs(p.y + 0.8 - c.y) > 3) return;
        c.got = true;
        c.c.setEnabled(false);
        markers[i].color = "rgba(0,0,0,0)";
        got++;
        playPickup(1 + (got % 5) * 0.06);
      });
      play.progress = got;
      play.status = `${got} of ${n} coins`;
      if (got >= n) return { over: "won" };
    },
  };
}

/** One lap under the target time, from crossing the line. */
function hotlap(env: Env): Rules {
  const { ctx, def, play } = env;
  const clock = new LapClock(TRACK.length, TRACK.startS);
  let lap: number | null = null;
  return {
    step(_, time) {
      const done = clock.update(ctx.vehicle.s, time);
      lap = clock.lapStart === null ? null : time - clock.lapStart;
      play.progress = clock.laps;
      play.status = lap === null ? "Cross the line to start the clock" : `Lap ${formatLap(lap)} · beat ${formatLap(def.time)}`;
      if (done !== null) return done <= def.time ? { over: "won", time: done } : { over: "lost", why: `${formatLap(done)} — too slow` };
      if (lap !== null && lap > def.time) return { over: "lost", why: `Over ${formatLap(def.time)}` };
      if (time > def.time * 2) return { over: "lost", why: "Time's up" };
    },
    timeLeft: () => (lap === null ? null : def.time - lap),
  };
}

/** A whole lap without touching a wall. */
function clean(env: Env): Rules {
  const { ctx, play } = env;
  const clock = new LapClock(TRACK.length, TRACK.startS);
  let hits = -1;
  return {
    step(_, time) {
      clock.update(ctx.vehicle.s, time);
      if (clock.crossings >= 1 && hits < 0) hits = ctx.vehicle.wallHits;
      if (hits >= 0 && ctx.vehicle.wallHits > hits) return { over: "lost", why: "You touched the wall" };
      play.progress = clock.laps;
      play.status = clock.crossings === 0 ? "Cross the line — then keep off the walls" : `Lap ${Math.min(env.def.target, clock.laps + 1)} of ${env.def.target} — clean so far`;
      if (clock.laps >= env.def.target) return { over: "won" };
    },
  };
}

/** Through every pair of cones; miss one and it's over. Knocking them over is allowed. */
function slalom(env: Env): Rules {
  const { ctx, root, def, play, markers } = env;
  const n = def.target;
  const at = straightSpots(n, 24);
  const cone = hidden(MeshBuilder.CreateCylinder("cone", { diameterTop: 0.06, diameterBottom: 0.52, height: 0.9, tessellation: 14 }, ctx.scene));
  cone.material = lit(ctx, { color: "#ff6a13", rough: 0.6 });
  cone.parent = root;
  const band = hidden(MeshBuilder.CreateCylinder("coneBand", { diameterTop: 0.25, diameterBottom: 0.34, height: 0.16, tessellation: 14 }, ctx.scene));
  band.material = lit(ctx, { color: "#f2f2f2", rough: 0.5 });
  band.parent = root;
  type Cone = { a: InstancedMesh; b: InstancedMesh; x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; down: boolean; floor: number };
  const cones: Cone[] = [];
  const list = at.map((s, k) => {
    const centre = (k % 2 ? 1 : -1) * 3.3;
    for (const side of [-1, 1]) {
      const p = pointAt(s, centre + side * 3.4);
      const c: Cone = { a: copy(cone, root, p.x, p.y + 0.45, p.z), b: copy(band, root, p.x, p.y + 0.5, p.z), x: p.x, y: p.y + 0.45, z: p.z, vx: 0, vy: 0, vz: 0, spin: 0, down: false, floor: p.y };
      cones.push(c);
      const col: DynamicCollider = {
        x: p.x,
        z: p.z,
        r: 0.35,
        solid: false,
        hit(speed, nx, nz) {
          if (c.down || speed < 0.5) return;
          // knocked flying
          c.down = true;
          c.vx = nx * (2 + speed * 0.6);
          c.vz = nz * (2 + speed * 0.6);
          c.vy = 2 + speed * 0.15;
          c.spin = 4 + speed * 0.4;
        },
      };
      ctx.dynamic.push(col);
    }
    const m = pointAt(s, centre);
    markers.push({ x: m.x, z: m.z, color: "#ff6a13" });
    return { s, centre };
  });
  let next = 0;
  return {
    idle(dt) {
      for (const c of cones) {
        if (!c.down) continue;
        c.vy -= 14 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z += c.vz * dt;
        if (c.y < c.floor + 0.25) {
          c.y = c.floor + 0.25;
          c.vy = 0;
          c.vx *= Math.pow(0.02, dt);
          c.vz *= Math.pow(0.02, dt);
          c.spin *= Math.pow(0.05, dt);
        }
        for (const m of [c.a, c.b]) {
          m.position.set(c.x, c.y, c.z);
          m.rotation.z = Math.min(Math.PI / 2, (m.rotation.z || 0) + c.spin * dt);
        }
      }
    },
    step() {
      while (next < n && env.prog() >= list[next].s) {
        const v = ctx.vehicle;
        const lat = lateralOf(v.x, v.z, sampleIndexAt(v.s));
        // (through the middle: the car's whole width between the cones, not clipping one on the way)
        if (Math.abs(lat - list[next].centre) > 2.5) return { over: "lost", why: `Missed gate ${next + 1}` };
        markers[next].color = "rgba(0,0,0,0)";
        next++;
        playPickup(1 + next * 0.03);
      }
      markers.forEach((m, i) => (m.ring = i === next));
      play.progress = next;
      play.status = next < n ? `Gate ${next + 1} of ${n} — ${list[next].centre > 0 ? "keep left" : "keep right"}` : "";
      if (next >= n) return { over: "won" };
    },
  };
}

/** Smash the crates. */
function smash(env: Env): Rules {
  const { ctx, root, def, play, markers } = env;
  const n = def.target;
  const at = spread(n, TRACK.startS + 40, TRACK.length - 70);
  const crate = hidden(MeshBuilder.CreateBox("crate", { size: 1.6 }, ctx.scene));
  const cm = lit(ctx, { rough: 0.85 });
  cm.albedoTexture = crateTexture(ctx);
  crate.material = cm;
  crate.parent = root;
  ctx.shadow?.addShadowCaster(crate, false);
  let broken = 0;
  at.forEach((s, k) => {
    const p = pointAt(s, (hash(k, 91) - 0.5) * 10);
    const c = copy(crate, root, p.x, p.y + 0.8, p.z, hash(k, 92) * 6.28);
    markers.push({ x: p.x, z: p.z, color: "#c58a4a" });
    const col: DynamicCollider = {
      x: p.x,
      z: p.z,
      r: 1.05,
      solid: false,
      hit(speed, nx, nz) {
        if (!c.isEnabled()) return;
        c.setEnabled(false);
        markers[k].color = "rgba(0,0,0,0)";
        broken++;
        ctx.debris?.hit([p.x, p.y + 0.3, p.z], [nx, 0, nz], [0, 1, 0], Math.max(9, speed + 6), p.y, undefined, WOOD);
      },
    };
    ctx.dynamic.push(col);
  });
  return {
    step() {
      play.progress = broken;
      play.status = `${broken} of ${n} crates`;
      if (broken >= n) return { over: "won" };
    },
  };
}

/** Score drift points: slide, the longer the better. */
function drift(env: Env): Rules {
  const { ctx, def, play } = env;
  const v = ctx.vehicle;
  let score = 0, chain = 0, held = 0, idle = 0, hits = v.wallHits, mult = 1;
  return {
    step(dt) {
      const sliding = v.slide > 0.2 && Math.abs(v.speed) > 7 && v.loop < 0;
      if (v.wallHits > hits) {
        // (into the wall: that chain is lost)
        hits = v.wallHits;
        chain = 0;
        held = 0;
      }
      if (sliding) {
        held += dt;
        idle = 0;
        mult = 1 + Math.min(2, held / 1.5);
        chain += (v.slide - 0.15) * Math.abs(v.speed) * dt * 40 * mult;
      } else {
        idle += dt;
        if (idle > 0.5 && chain > 0) {
          score += chain;
          chain = 0;
          held = 0;
          playPickup(0.8);
        }
      }
      play.progress = Math.floor(score + chain);
      play.status = chain > 0 ? `Drift +${Math.round(chain)} ×${mult.toFixed(1)}` : "Hold Space through a bend to slide";
      if (score + chain >= def.target) return { over: "won" };
    },
  };
}

/** Reach the target speed — boost pads on the far side help. */
function speed(env: Env): Rules {
  const { ctx, root, def, play, markers } = env;
  const L = TRACK.length;
  for (const s of straightSpots(2, 80, TRACK.startS + L * 0.35, L * 0.6)) {
    const pad = { s0: s - 7, s1: s + 7, half: 5 };
    ctx.boostPads.push(pad);
    drawBoostPad(ctx, root, pad);
    const p = pointAt(s);
    markers.push({ x: p.x, z: p.z, color: "#5ad8ff", ring: true });
  }
  let top = 0;
  return {
    step() {
      const kmh = Math.abs(ctx.vehicle.speed) * 3.6;
      top = Math.max(top, kmh);
      play.progress = Math.round(top);
      play.status = `${Math.round(kmh)} km/h · best ${Math.round(top)}`;
      if (top >= def.target) return { over: "won" };
    },
  };
}

/** Round the loop-the-loop, again and again. */
function loops(env: Env): Rules {
  const { ctx, def, play, markers } = env;
  const L = TRACK.loop;
  if (L) {
    const p = pointAt(L.s0 + L.climbIn);
    markers.push({ x: p.x, z: p.z, color: "#ff8a1f", ring: true });
  }
  let count = 0, on = false, last = -1;
  return {
    step() {
      const k = ctx.vehicle.loop;
      if (k >= 0) {
        on = true;
        last = k;
      } else if (on) {
        on = false;
        if (last > 0.9) {
          count++;
          playPickup(1.1);
        }
      }
      play.progress = count;
      play.status = `${count} of ${def.target} loops`;
      if (count >= def.target) return { over: "won" };
    },
  };
}

/** Park in each bay: stopped inside it, lined up with it, for a second. */
function parking(env: Env): Rules {
  const { ctx, root, def, play, markers } = env;
  const n = def.target;
  const mat = unlit(ctx, { map: bayTexture(ctx), depthWrite: false });
  mat.zOffset = -2;
  const bays = straightSpots(n, 150).map((s, k) => {
    const lat = (k % 2 ? 1 : -1) * 3.8;
    const p = pointAt(s, lat);
    const m = MeshBuilder.CreateGround("bay", { width: 4.2, height: 7.2 }, ctx.scene);
    m.material = mat;
    m.parent = root;
    m.isPickable = false;
    m.position.set(p.x, p.y + 0.03, p.z);
    m.rotation.y = p.heading;
    markers.push({ x: p.x, z: p.z, color: "#3d9bff" });
    return { ...p, m };
  });
  let cur = 0, hold = 0;
  const show = () => {
    bays.forEach((b, i) => {
      b.m.setEnabled(i >= cur);
      b.m.visibility = i === cur ? 1 : 0.35;
      markers[i].color = i < cur ? "rgba(0,0,0,0)" : "#3d9bff";
      markers[i].ring = i === cur;
    });
  };
  show();
  return {
    idle(_, t) {
      const b = bays[cur];
      if (b) b.m.visibility = 0.75 + 0.25 * Math.sin(t * 5);
    },
    step(dt) {
      const b = bays[cur];
      if (!b) return { over: "won" };
      const v = ctx.vehicle;
      const dx = v.x - b.x, dz = v.z - b.z;
      const along = dx * Math.sin(b.heading) + dz * Math.cos(b.heading);
      const across = dx * Math.cos(b.heading) - dz * Math.sin(b.heading);
      const angle = Math.min(Math.abs(wrap(v.heading - b.heading)), Math.abs(wrap(v.heading - b.heading - Math.PI)));
      // (a tight bay: square in it, the whole car inside its lines, held still for 1.5 s)
      const inside = Math.abs(along) < 1.6 && Math.abs(across) < 0.75 && angle < 0.22;
      hold = inside && Math.abs(v.speed) < 0.5 ? hold + dt : 0;
      if (hold >= 1.5) {
        cur++;
        hold = 0;
        playPickup(1.2);
        show();
      }
      play.progress = cur;
      if (cur >= n) return { over: "won" };
      play.status = inside ? (Math.abs(v.speed) < 0.7 ? `Hold it… ${Math.max(0, 1.5 - hold).toFixed(1)} s` : "Now stop!") : `Bay ${cur + 1} of ${n}`;
    },
  };
}

/** Parcels: pick each one up and take it where it has to go. */
function courier(env: Env): Rules {
  const { ctx, root, def, play, markers } = env;
  const L = TRACK.length;
  const fr = [0.14, 0.58, 0.72, 0.28, 0.42, 0.9, 0.64, 0.06].slice(0, def.target * 2);
  const stops = fr.map((f, k) => {
    let s = TRACK.startS + f * L;
    while (onLoopClimb(s)) s += 8;
    return { ...pointAt(s), pickup: k % 2 === 0 };
  });
  const beam = MeshBuilder.CreateCylinder("beacon", { diameter: 4, height: 30, tessellation: 24, cap: Mesh.NO_CAP }, ctx.scene);
  const beamMat = unlit(ctx, { color: "#38e1ff", opacity: 0.3, depthWrite: false, double: true });
  beam.material = beamMat;
  beam.parent = root;
  beam.isPickable = false;
  const parcel = MeshBuilder.CreateBox("parcel", { width: 1.1, height: 0.8, depth: 0.9 }, ctx.scene);
  const pm = lit(ctx, { rough: 0.85 });
  pm.albedoTexture = crateTexture(ctx);
  parcel.material = pm;
  parcel.parent = root;
  parcel.isPickable = false;
  parcel.setEnabled(false);
  const mark: Marker = { x: 0, z: 0, color: "#38e1ff", ring: true };
  markers.push(mark);
  let cur = 0, delivered = 0, carrying = false;
  const show = () => {
    const st = stops[cur];
    beam.setEnabled(!!st);
    if (!st) return;
    beam.position.set(st.x, st.y + 15, st.z);
    const c = st.pickup ? "#38e1ff" : "#ff4fd8";
    (beamMat as StandardMaterial).emissiveColor = Color3.FromHexString(c);
    mark.x = st.x;
    mark.z = st.z;
    mark.color = c;
  };
  show();
  return {
    idle(_, t) {
      beam.rotation.y = t;
      if (carrying) {
        parcel.position.set(ctx.player.x, ctx.player.y + 1.7, ctx.player.z);
        parcel.rotation.y = ctx.vehicle.heading;
      }
    },
    step() {
      const st = stops[cur];
      const p = ctx.player;
      if (st && Math.hypot(p.x - st.x, p.z - st.z) < 7 && Math.abs(p.y - st.y) < 6) {
        carrying = st.pickup;
        if (!st.pickup) delivered++;
        parcel.setEnabled(carrying);
        cur++;
        playPickup(st.pickup ? 0.9 : 1.25);
        show();
      }
      play.progress = delivered;
      play.status = delivered >= def.target ? "" : carrying ? `Deliver parcel ${delivered + 1} of ${def.target} (pink)` : `Pick up parcel ${delivered + 1} of ${def.target} (blue)`;
      if (delivered >= def.target) return { over: "won" };
    },
  };
}

const RULES: Record<Exclude<MissionDef["kind"], "duel">, (env: Env) => Rules> = { gates, coins, hotlap, clean, slalom, smash, drift, speed, loops, parking, courier };

/**
 * A mission: its things on the track, the camera's fly-in, 3 – 2 – 1 – GO, then its rules until it
 * is won or lost (or the clock runs out). A pass is remembered (progress.ts).
 */
export function buildMission(ctx: Ctx, parent: Node, deps: MissionDeps, def: MissionDef) {
  const root = group(ctx, { parent });
  const play = deps.playRef.current;
  const v = ctx.vehicle;
  Object.assign(play, { kind: "mission", state: "intro", count: 3, time: 0, lap: 0, laps: 0, position: 0, cars: 0, bestLap: null, title: def.title, objective: def.brief, progress: 0, total: def.target, timeLeft: def.time, status: "", message: "", results: [] });

  // the duel is a one-lap race against one rival
  if (def.kind === "duel") {
    const race = buildRace(ctx, root, deps, { laps: 2, rivals: [{ name: "The Rival", color: "#ff3b6b" }], skills: [1.04], music: musicFile() });
    Object.assign(play, { kind: "mission", title: def.title, objective: def.brief });
    let saved = false;
    ctx.onFrame(() => {
      play.status = play.state === "on" ? (play.position === 1 ? "You're ahead" : "Catch the rival!") : "";
      if (!saved && play.state === "won") {
        saved = true;
        saveMission(def.id, play.time);
      }
    });
    return race;
  }

  const markers: Marker[] = [];
  deps.driveRef.current.markers = markers;
  const L = TRACK.length;
  let prevS = TRACK.startS - 0.8 * TILE;
  let prog = prevS;
  const env: Env = { ctx, root, def, play, markers, prog: () => prog };
  const rules = RULES[def.kind](env);
  const countdown = new Countdown(ctx, deps.introRef, play);
  let time = 0;
  const finish = (over: "won" | "lost", why = "", at = time) => {
    play.state = over;
    play.message = why;
    v.frozen = true;
    play.results = [{ name: "You", color: "#ffffff", time: at, best: null, you: true }];
    if (over === "won") {
      saveMission(def.id, at);
      playChime();
    }
  };

  ctx.onFrame((dt, t) => {
    rules.idle?.(dt, t);
    if (ctx.paused) return;
    // how far the car has come along the lap (on past the line)
    const ds = v.s - prevS;
    prog += ds - Math.round(ds / L) * L;
    prevS = v.s;
    if (!countdown.update(dt)) return;
    time += dt;
    play.time = time;
    const r = rules.step(dt, time);
    play.timeLeft = rules.timeLeft ? rules.timeLeft(time) : def.time - time;
    if (r) finish(r.over, r.why, r.time);
    else if (play.timeLeft !== null && play.timeLeft <= 0) finish("lost", "Time's up");
  });

  return { ready: Promise.resolve() };
}
