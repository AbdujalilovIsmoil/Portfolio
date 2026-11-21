import { Quaternion, Vector3, type Node, type ShaderMaterial, type TransformNode } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { instantiate } from "./assets";
import type { DriveSignal } from "./driveSignal";
import { createEngineSample, peekCtx, playImpactThud, playWhoosh, type EngineSound } from "./sound";
import type { TeleportSignal } from "./teleportSignal";
import { SURFACE, TRACK, WALL_IN, boostPad, heightAt, lateralOf, loopPose, startPose, trackS } from "./Track";
import type { WorldInput } from "./WorldInputContext";
import { Instancer, clamp, disc, group, lerp, points, setEuler, unlit, type Ctx } from "./core";

/** Kenney Car Kit "race" (CC0): 2.56 units long, wheels of radius 0.3, front towards +z. */
export const CAR_FILE = "race.glb";
const SCALE = 1.75; // → a 4.5 m race car
const WHEEL_R = 0.3 * SCALE;
const WHEELBASE = 1.52 * SCALE;

const MAX_SPEED = 26; // m/s on the asphalt (≈ 94 km/h)
const BOOST = 1.3; // Shift
const MAX_REV = 8;
const ACCEL = 13;
const BRAKE = 28;
const DRAG = 6; // coasting
const HANDBRAKE = 14;
const MAX_STEER = 0.55;
/** Two collision circles, over the front and the rear axle. */
const AXLE = 1.3;
const BODY_R = 1.05;
/** How far from the centre line the car's middle can get before its side touches a wall. */
const WALL_LIMIT = WALL_IN - 1.1;
/** The boost pad before the loop: the speed it sends you off at, and for how long the car may go that fast. */
const PAD_SPEED = 37;
const PAD_TIME = 3;
/** Round the top half of the loop the car never drops below this (it would fall off a real one). */
const LOOP_MIN = 12;

const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export interface CarDeps {
  input: MutableRefObject<WorldInput>;
  teleportRef: MutableRefObject<TeleportSignal>;
  driveRef: MutableRefObject<DriveSignal>;
}

/**
 * The race car: WASD / arrows (or the touch stick) to drive, Shift for a boost, Space for the
 * handbrake (it slides), R to get back on the track. Arcade physics: a speed along the way the car is
 * travelling, which follows the way it points more or less tightly (grip). It always sits on the
 * road: its height (and the way it tips on a hill) comes from the track's smooth profile, so kerbs,
 * tile seams and knocks against the walls can't throw it into the air. Hitting a wall knocks bits
 * off it (Debris.ts), as hard as you hit it. On the loop-the-loop the car is held to the road —
 * along it, across it, and turned over with it — with gravity slowing it up and speeding it down.
 */
export function buildCar(ctx: Ctx, parent: Node, deps: CarDeps) {
  const { input, teleportRef, driveRef } = deps;
  const v = ctx.vehicle;
  const start = startPose();
  v.driving = true;
  v.x = start.x;
  v.z = start.z;
  v.heading = start.heading;
  v.speed = 0;
  let y = SURFACE;
  let travel = v.heading; // the direction the car actually moves in (≠ heading while sliding)
  let steer = 0;
  let spin = 0;
  let pitch = 0;
  let roll = 0;
  let lastSpeed = 0;
  let lastReset = input.current.resetId;
  let lastBump = 0;
  let scrapeClock = 0;
  let hint = -1;
  /** on the loop: metres along it (−1: not on it), metres left of its centre line, which way the car faces along it, its turn off the road's line */
  let loopD = -1;
  let loopLat = 0;
  let loopDir = 1;
  let loopYaw = 0;
  let padTime = 0;
  let onPad = false;
  const LP = TRACK.loop;
  const LP_HEADING = LP ? Math.atan2(LP.fx, LP.fz) : 0;
  const PAD = boostPad();
  // scratch (nothing is allocated per frame)
  const qRoll = new Quaternion(), qSteer = new Quaternion(), qTmp = new Quaternion();
  const vF = new Vector3(), vU = new Vector3(), vL = new Vector3();
  const AX_X = Vector3.Right(), AX_Y = Vector3.Up();

  const root = group(ctx, { parent, pos: [v.x, 0, v.z] });
  const tilt = group(ctx, { parent: root });
  const wheels: { node: TransformNode; base: Quaternion; front: boolean }[] = [];
  const ready = instantiate(ctx, CAR_FILE, tilt, { scale: SCALE, cast: true }).then((holder) => {
    for (const mesh of holder.getChildMeshes()) mesh.isPickable = false; // the camera arm must not hit the car
    for (const n of holder.getDescendants(false) as TransformNode[]) {
      if (!/^wheel-(front|back)-(left|right)$/.test(n.name)) continue;
      wheels.push({ node: n, base: (n.rotationQuaternion ?? Quaternion.FromEulerVector(n.rotation)).clone(), front: n.name.includes("front") });
    }
    return holder;
  });

  // ---- brake lights
  const lamp = (xs: number[], ly: number, lz: number, color: string, size: number) => {
    const pos = new Float32Array(xs.length * 3);
    xs.forEach((x, i) => pos.set([x, ly, lz], i * 3));
    const p = points(ctx, { positions: pos, sizes: new Float32Array(xs.length).fill(size), phases: new Float32Array(xs.length), color, opacity: 0, speed: 0, pixel: 4, attenuate: true });
    p.parent = tilt;
    p.isPickable = false;
    return p.material as ShaderMaterial;
  };
  const tailGlow = lamp([-0.62, 0.62], 0.62, -2.22, "#ff3b30", 2.4);

  // ---- tyre smoke from the rear wheels when sliding
  const DUST = 48;
  const dustMesh = disc(ctx, 1, 8, { parent, mat: unlit(ctx, { color: "#d9cbb0", opacity: 0.32, depthWrite: false, double: true }) });
  dustMesh.isPickable = false;
  const dust = new Instancer(dustMesh, DUST);
  const puffs = Array.from({ length: DUST }, () => ({ x: 0, y: 0, z: 0, t: 9, dx: 0, dz: 0 }));
  let nextPuff = 0;
  let puffClock = 0;

  // ---- engine: a real recording, pitched by the speed (once audio is unlocked by the Start click)
  let engine: EngineSound | null = null;
  let engineLoading = false;
  const onHidden = () => engine?.set(0, 0, true);
  document.addEventListener("visibilitychange", onHidden);
  ctx.scene.onDisposeObservable.addOnce(() => {
    document.removeEventListener("visibilitychange", onHidden);
    engine?.dispose();
  });

  const B = TRACK.bounds;
  const circleBlocked = (cx: number, cz: number) => {
    if (cx < B.x0 - 30 || cx > B.x1 + 30 || cz < B.z0 - 30 || cz > B.z1 + 30) return true;
    for (const c of ctx.colliders) {
      const dx = Math.max(Math.abs(cx - c.x) - c.hx, 0);
      const dz = Math.max(Math.abs(cz - c.z) - c.hz, 0);
      if (dx * dx + dz * dz < BODY_R * BODY_R) return true;
    }
    return false;
  };
  /** two circles, over the front and the rear axle */
  const blocked = (x: number, z: number, h: number) =>
    circleBlocked(x + Math.sin(h) * AXLE, z + Math.cos(h) * AXLE) || circleBlocked(x - Math.sin(h) * AXLE, z - Math.cos(h) * AXLE);

  /** The road's height under (x, z): the smooth profile at that point of the lap. */
  const roadY = (x: number, z: number) => {
    const t = trackS(x, z, hint);
    hint = t.i;
    v.s = t.s;
    return heightAt(t.s) + SURFACE;
  };

  /** Back onto the track: the nearest point of the centre line, facing along the lap (off the loop: before it). */
  const reset = (anywhere = false) => {
    let q = anywhere ? startPose() : TRACK.samples[trackS(v.x, v.z, hint).i];
    if (!anywhere && LP && (loopD >= 0 || (TRACK.samples[hint]?.s ?? 0) > LP.s0 + LP.climbIn - 2 && (TRACK.samples[hint]?.s ?? 0) < LP.s0 + LP.climbOut)) {
      // back to the run-in, facing the loop
      const p = loopPose(LP.climbIn - 6);
      q = { x: p.pos[0], z: p.pos[2], heading: LP_HEADING } as typeof q;
    }
    loopD = -1;
    v.loop = -1;
    v.x = q.x;
    v.z = q.z;
    v.heading = travel = q.heading;
    v.speed = steer = 0;
    padTime = 0;
    hint = -1;
    y = roadY(q.x, q.z);
    teleportRef.current.value++;
  };
  ctx.teleportPlayer = (x, z) => {
    loopD = -1;
    v.loop = -1;
    v.x = x;
    v.z = z;
    v.speed = 0;
    hint = -1;
    y = roadY(x, z);
    teleportRef.current.value++;
  };

  /** Hit (or scrape along) a wall at (x, y, z) whose face looks along n, the road's up being `up`. */
  const wallHit = (p: [number, number, number], n: [number, number, number], up: [number, number, number], across: number, along: number, floor: number) => {
    if (across > 4 && lastBump <= 0) {
      playImpactThud(Math.min(1, across / 16));
      ctx.debris?.hit(p, n, up, across, floor, [Math.sin(travel) * v.speed, 0, Math.cos(travel) * v.speed]);
      lastBump = 0.4;
    } else if (Math.abs(along) > 6 && scrapeClock <= 0) {
      ctx.debris?.scrape(p, n, up, Math.abs(along), floor);
      scrapeClock = 0.06;
    }
  };

  /** Onto the loop at d metres along it, from the road. */
  const enterLoop = (d: number) => {
    const q = loopPose(d);
    loopD = d;
    loopLat = clamp((v.x - q.pos[0]) * q.left[0] + (v.z - q.pos[2]) * q.left[2], -WALL_LIMIT, WALL_LIMIT);
    loopDir = Math.cos(wrapAngle(v.heading - LP_HEADING)) >= 0 ? 1 : -1;
    loopYaw = clamp(wrapAngle(v.heading - LP_HEADING - (loopDir < 0 ? Math.PI : 0)), -0.35, 0.35);
    travel = v.heading;
  };

  /** One step on the loop: held to the road, gravity along it. Returns false once off it again. */
  const driveLoop = (dt: number, s: number, throttle: number) => {
    const L = LP!;
    let q = loopPose(loopD);
    // the tyres can't put much power down going up a wall: mostly it carries its speed round
    if (throttle > 0) s = v.speed + (s - v.speed) * 0.15;
    // gravity along the road (t is the way round the lap; the car faces loopDir · t)
    s -= 9.8 * q.t[1] * loopDir * dt;
    s = clamp(s, -MAX_REV - 6, Math.max(MAX_SPEED * BOOST, PAD_SPEED));
    // over the top half it can't stall: it would drop off a real one
    let w = s * loopDir;
    if (q.k > 0.15 && q.k < 0.85 && Math.abs(w) < LOOP_MIN) {
      w = (w >= 0 ? 1 : -1) * LOOP_MIN;
      s = w * loopDir;
    }
    // steering turns it a little across the road; the banked road lines it up again
    loopYaw = clamp((loopYaw - (s / WHEELBASE) * Math.tan(steer) * dt) * Math.pow(0.3, dt), -0.35, 0.35);
    loopLat += loopDir * s * Math.sin(loopYaw) * dt;
    loopD += w * Math.cos(loopYaw) * dt;
    // the rails
    if (Math.abs(loopLat) > WALL_LIMIT) {
      const sg = Math.sign(loopLat);
      const across = loopDir * s * Math.sin(loopYaw) * sg;
      const pq = loopPose(clamp(loopD, 0, L.length));
      const p: [number, number, number] = [pq.pos[0] + pq.left[0] * sg * WALL_IN + pq.up[0] * SURFACE, pq.pos[1] + pq.left[1] * sg * WALL_IN + pq.up[1] * SURFACE, pq.pos[2] + pq.left[2] * sg * WALL_IN + pq.up[2] * SURFACE];
      wallHit(p, [-pq.left[0] * sg, -pq.left[1] * sg, -pq.left[2] * sg], pq.up, across, w, L.y0);
      if (across > 4) s *= 0.8;
      loopLat = sg * WALL_LIMIT;
      loopYaw *= 0.3;
    }
    v.speed = s;
    if (loopD >= L.climbOut || loopD <= L.climbIn) {
      // back on the ground: the run-out (or the run-in, rolling back)
      const pq = loopPose(clamp(loopD, 0, L.length));
      v.x = pq.pos[0] + pq.left[0] * loopLat;
      v.z = pq.pos[2] + pq.left[2] * loopLat;
      v.heading = travel = LP_HEADING + (loopDir < 0 ? Math.PI : 0) + loopYaw;
      loopD = -1;
      v.loop = -1;
      hint = -1;
      y = roadY(v.x, v.z);
      return false;
    }
    q = loopPose(loopD);
    // the car's axes: forward (the road's way, turned by loopYaw about its up), up, left = up × forward
    const c = Math.cos(loopYaw), sn = Math.sin(loopYaw);
    vF.set((q.t[0] * c + q.left[0] * sn) * loopDir, (q.t[1] * c + q.left[1] * sn) * loopDir, (q.t[2] * c + q.left[2] * sn) * loopDir);
    vL.set((q.left[0] * c - q.t[0] * sn) * loopDir, (q.left[1] * c - q.t[1] * sn) * loopDir, (q.left[2] * c - q.t[2] * sn) * loopDir);
    vU.set(q.up[0], q.up[1], q.up[2]);
    root.position.set(q.pos[0] + q.left[0] * loopLat + q.up[0] * SURFACE, q.pos[1] + q.left[1] * loopLat + q.up[1] * SURFACE, q.pos[2] + q.left[2] * loopLat + q.up[2] * SURFACE);
    Quaternion.RotationQuaternionFromAxisToRef(vL, vU, vF, root.rotationQuaternion ?? (root.rotationQuaternion = new Quaternion()));
    roll = lerp(roll, clamp(-steer * s * 0.006, -0.05, 0.05), 1 - Math.pow(0.002, dt));
    pitch = lerp(pitch, clamp(-throttle * 0.02, -0.03, 0.03), 1 - Math.pow(0.002, dt));
    setEuler(tilt, pitch, 0, roll);
    v.x = root.position.x;
    v.z = root.position.z;
    y = root.position.y;
    if (Math.hypot(vF.x, vF.z) > 0.3) v.heading = Math.atan2(vF.x, vF.z);
    travel = v.heading;
    v.slope = 0;
    v.loop = clamp(q.k, 0, 1);
    v.s = L.s0 + loopD;
    return true;
  };

  ctx.onFrame((dt) => {
    const io = input.current;
    if (io.resetId !== lastReset) {
      lastReset = io.resetId;
      if (!io.locked) reset();
    }
    const { move, joystick: joy } = io;
    const locked = io.locked;
    const throttle = locked ? 0 : clamp((move.forward ? 1 : 0) - (move.backward ? 1 : 0) - joy.y, -1, 1);
    const steerIn = locked ? 0 : clamp((move.right ? 1 : 0) - (move.left ? 1 : 0) + joy.x, -1, 1);
    const handbrake = !locked && io.spaceHeld;
    const boost = !locked && move.run && throttle > 0;
    lastBump -= dt;
    scrapeClock -= dt;
    padTime -= dt;

    // ---- the pedals (gravity comes in below, along the road)
    const top = Math.max(MAX_SPEED * (boost ? BOOST : 1), padTime > 0 ? PAD_SPEED : 0);
    let s = v.speed;
    if (throttle > 0) s += (s < 0 ? BRAKE : ACCEL * (boost ? 1.3 : 1)) * throttle * dt;
    else if (throttle < 0) s -= (s > 0 ? BRAKE : ACCEL * 0.6) * -throttle * dt;
    else s -= Math.sign(s) * Math.min(Math.abs(s), DRAG * dt);
    if (handbrake) s -= Math.sign(s) * Math.min(Math.abs(s), HANDBRAKE * dt);
    if (s > top) s = Math.max(top, s - 6 * dt); // easing off a boost

    // ---- steering (less lock at speed); the handbrake turns the tail out
    const want = steerIn * (MAX_STEER / (1 + Math.abs(s) / 11)) * (handbrake ? 1.6 : 1);
    steer = lerp(steer, want, 1 - Math.pow(0.0008, dt));

    let slide = 0;
    const wasOnLoop = loopD >= 0 && !!LP;
    const onLoop = wasOnLoop && driveLoop(dt, s, throttle);
    if (!onLoop) {
      // (just come off the loop: it has already moved the car this frame)
      const mdt = wasOnLoop ? 0 : dt;
      if (wasOnLoop) s = v.speed;
      // ---- how steep the road is along the way the car points (uphill +)
      const here = trackS(v.x, v.z, hint);
      hint = here.i;
      const dhds = (heightAt(here.s + 1.5) - heightAt(here.s - 1.5)) / 3;
      const slope = Math.atan(dhds * Math.cos(wrapAngle(v.heading - TRACK.samples[here.i].heading)));
      s -= 9.8 * Math.sin(slope) * mdt * 0.7; // gravity pulls you back up a hill, and on down one
      // ---- the boost pad
      const lat0 = lateralOf(v.x, v.z, here.i);
      const ahead = Math.cos(wrapAngle(v.heading - TRACK.samples[here.i].heading));
      const nowOnPad = !!PAD && here.s > PAD.s0 && here.s < PAD.s1 && Math.abs(lat0) < PAD.half + 1 && ahead > 0.5 && s > 2;
      if (nowOnPad) {
        if (!onPad) playWhoosh();
        padTime = PAD_TIME;
        if (s < PAD_SPEED) s = Math.min(PAD_SPEED, s + 45 * mdt);
      }
      onPad = nowOnPad;
      s = clamp(s, -MAX_REV, Math.max(MAX_SPEED * BOOST, PAD_SPEED));

      const newHeading = v.heading - (s / WHEELBASE) * Math.tan(steer) * mdt;
      if (!blocked(v.x, v.z, newHeading)) v.heading = newHeading;
      const grip = handbrake && Math.abs(s) > 6 ? 2.2 : 14;
      travel += wrapAngle(v.heading - travel) * (1 - Math.exp(-grip * mdt));
      slide = Math.abs(wrapAngle(v.heading - travel));

      // ---- move, sliding along whatever we hit
      const dx = Math.sin(travel) * s * mdt * Math.cos(slope);
      const dz = Math.cos(travel) * s * mdt * Math.cos(slope);
      let hit = false;
      if (mdt === 0 || !blocked(v.x + dx, v.z + dz, v.heading)) {
        v.x += dx;
        v.z += dz;
      } else if (!blocked(v.x + dx, v.z, v.heading)) {
        v.x += dx;
        s *= Math.pow(0.35, dt); // scraping along something costs speed
        hit = Math.abs(dz) > Math.abs(dx) * 2;
      } else if (!blocked(v.x, v.z + dz, v.heading)) {
        v.z += dz;
        s *= Math.pow(0.35, dt);
        hit = Math.abs(dx) > Math.abs(dz) * 2;
      } else hit = true;
      if (hit) {
        if (Math.abs(s) > 3 && lastBump <= 0) {
          playImpactThud(Math.min(1, Math.abs(s) / 18));
          lastBump = 0.4;
        }
        s *= -0.25;
      }
      // ---- the walls: the car's side can't go past them; it slides along, losing speed — and the wall breaks a little
      const at = trackS(v.x, v.z, hint);
      const lat = lateralOf(v.x, v.z, at.i);
      if (Math.abs(lat) > WALL_LIMIT) {
        const q = TRACK.samples[at.i];
        const push = Math.abs(lat) - WALL_LIMIT;
        const sgn = Math.sign(lat);
        const lx = Math.cos(q.heading) * sgn, lz = -Math.sin(q.heading) * sgn;
        v.x -= lx * push;
        v.z -= lz * push;
        // how hard we went in: the part of the velocity towards that wall
        const across = Math.sin(wrapAngle(travel - q.heading)) * s * sgn;
        const alongWall = Math.cos(wrapAngle(travel - q.heading)) * s;
        const ry = heightAt(at.s) + SURFACE;
        wallHit([v.x + lx * (WALL_IN - WALL_LIMIT), ry, v.z + lz * (WALL_IN - WALL_LIMIT)], [-lx, 0, -lz], [0, 1, 0], across, alongWall, ry);
        s *= across > 4 ? 0.7 : Math.pow(0.5, dt);
        // turn the car (and its slide) back along the wall
        const along = Math.cos(wrapAngle(v.heading - q.heading)) >= 0 ? q.heading : q.heading + Math.PI;
        v.heading += wrapAngle(along - v.heading) * Math.min(1, dt * 4);
        travel += wrapAngle(along - travel) * Math.min(1, dt * 8);
      }
      v.speed = s;
      v.slope = slope;

      // ---- on the road, always: up and down with the hills
      y = roadY(v.x, v.z);

      // ---- onto the loop?
      if (LP) {
        const d = v.s - LP.s0;
        const alongLap = Math.cos(wrapAngle(travel - LP_HEADING)) * s;
        if ((d > LP.climbIn && d < LP.climbIn + 8 && alongLap > 0) || (d < LP.climbOut && d > LP.climbOut - 8 && alongLap < 0)) enterLoop(d);
      }

      // ---- the body: follows the slope, leans into turns, squats and dives with throttle and brakes
      const accel = (s - lastSpeed) / Math.max(dt, 1e-3);
      roll = lerp(roll, clamp(-steer * s * 0.011, -0.08, 0.08), 1 - Math.pow(0.002, dt));
      pitch = lerp(pitch, -slope + clamp(-accel * 0.003, -0.04, 0.04), 1 - Math.pow(0.0005, dt));
      root.position.set(v.x, y, v.z);
      setEuler(root, 0, v.heading, 0);
      setEuler(tilt, pitch, 0, roll);
    }
    s = v.speed;
    lastSpeed = s;

    // ---- wheels: roll with the distance travelled, the front pair steers
    spin += (s * dt) / WHEEL_R;
    Quaternion.RotationAxisToRef(AX_X, spin, qRoll);
    Quaternion.RotationAxisToRef(AX_Y, -steer, qSteer);
    for (const w of wheels) {
      const q = w.node.rotationQuaternion ?? (w.node.rotationQuaternion = new Quaternion());
      if (w.front) {
        w.base.multiplyToRef(qSteer, qTmp);
        qTmp.multiplyToRef(qRoll, q);
      } else w.base.multiplyToRef(qRoll, q);
    }

    // ---- brake lights
    const braking = (throttle < 0 && s > 0.5) || handbrake;
    tailGlow.setFloat("uOpacity", braking ? 0.95 : 0);

    // ---- tyre smoke when sliding
    const dusty = !onLoop && Math.abs(s) > 5 && slide > 0.2;
    puffClock -= dt;
    if (dusty && puffClock <= 0) {
      puffClock = 0.045;
      for (const side of [-1, 1]) {
        const p = puffs[nextPuff];
        nextPuff = (nextPuff + 1) % DUST;
        p.x = v.x - Math.sin(v.heading) * 1.7 + Math.cos(v.heading) * 0.8 * side;
        p.z = v.z - Math.cos(v.heading) * 1.7 - Math.sin(v.heading) * 0.8 * side;
        p.y = y;
        p.t = 0;
        p.dx = -Math.sin(travel) * 1.2 + (Math.random() - 0.5);
        p.dz = -Math.cos(travel) * 1.2 + (Math.random() - 0.5);
      }
    }
    let any = false;
    for (let i = 0; i < DUST; i++) {
      const p = puffs[i];
      p.t += dt;
      if (p.t > 0.9) {
        if (p.t - dt <= 0.9) dust.set(i, 0, -50, 0, 0.0001);
        continue;
      }
      any = true;
      const k = p.t / 0.9;
      dust.set(i, p.x + p.dx * p.t, p.y + 0.15 + k * 0.9, p.z + p.dz * p.t, (0.35 + k * 0.9) * (1 - k * 0.6), -Math.PI / 2);
    }
    if (any || dustMesh.isEnabled()) dust.flush();
    dustMesh.setEnabled(any);

    // ---- engine
    const ac = peekCtx();
    if (!engine && !engineLoading && ac) {
      engineLoading = true;
      createEngineSample(ac, "/sounds/engine.wav")
        .then((e) => (engine = e))
        .catch(() => {}); // sound is optional
    }
    engine?.set(s, Math.abs(throttle), locked || document.hidden);

    // ---- share where we are
    ctx.player.set(v.x, y, v.z);
    const d = driveRef.current;
    d.x = v.x;
    d.z = v.z;
    d.heading = v.heading;
    d.speed = s;
  });

  return { root, ready, reset: () => reset(true) };
}
