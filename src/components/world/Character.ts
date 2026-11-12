import type { Node } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { buildAnimatedCharacter, type CharacterState } from "./AnimatedCharacter";
import { buildFootprints } from "./Effects";
import { group, inRegions, lerp, linear, lit, ring, type Ctx } from "./core";
import { trackLoad } from "./loadingSignal";
import { playFootstep, playSplash } from "./footstepSynth";
import { CITY_Y, POOL, POOL_LADDER, WATER_Y, inPool } from "./cityLayout";
import type { FlightSignal } from "./flightSignal";
import type { PlayerAccent } from "./playerAccentSignal";
import type { WorldInput } from "./WorldInputContext";

// Matched to the walk / run clips' stride (≈1.5 m/s and ≈3 m/s at speed 1) so the feet don't slide.
const SPEED = 1.75;
const RUN_MULTIPLIER = 2.2;
const GRAVITY = -22;
const JUMP_SPEED = 5.2;
const RADIUS = 0.35;
const STAIR_FOLLOW_SPEED = 6; // vertical m/s while easing onto a new stair tread
const FOOTSTEP_WALK_INTERVAL = 0.5;
const FOOTSTEP_RUN_INTERVAL = 0.3;
const SPAWN: [number, number] = [0.5, 0.8];

function matchAngle(current: number, target: number) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff;
}

export interface CharacterDeps {
  input: MutableRefObject<WorldInput>;
  accentRef: MutableRefObject<PlayerAccent>;
  flightRef: MutableRefObject<FlightSignal>;
}

export function buildCharacter(ctx: Ctx, parent: Node, deps: CharacterDeps) {
  const { input, accentRef, flightRef } = deps;
  const g = group(ctx, { parent, pos: [SPAWN[0], 0, SPAWN[1]] });
  ctx.player.set(SPAWN[0], 0, SPAWN[1]);

  const state: CharacterState = { moving: false, running: false, jumping: false, flying: false, superman: false, swimming: false, swimT: 0, vy: 0, climbing: false, climbT: 0, sitting: false };
  const modelReady = trackLoad(buildAnimatedCharacter(ctx, g, { input, flightRef, state }));

  const ringMat = lit(ctx, { color: "#7c9bff", emissive: "#7c9bff", ei: 1.6, opacity: 0.6 });
  ring(ctx, 0.4, 0.48, 32, { parent: g, pos: [0, 0.02, 0], rot: [-Math.PI / 2, 0, 0], mat: ringMat });
  let ringColor = "#7c9bff";

  const dustTrigger = { n: 0, yaw: 0 };
  buildFootprints(ctx, parent, dustTrigger);

  let facing = 0;
  let velocityY = 0;
  let lastJumpId = input.current.jumpId;
  let footstepTimer = 0;
  let wasGrounded = true;

  ctx.teleportPlayer = (x, z) => g.position.set(x, ctx.groundY(x, z), z);

  const blocked = (x: number, z: number) => {
    // out of the pool only by the ladder: its walls are too high to climb
    if (state.swimming && !inPool(x, z)) return true;
    const y = g.position.y;
    return ctx.colliders.some((c) => (c.top === undefined || y < c.top - 0.03) && Math.abs(x - c.x) < c.hx + RADIUS && Math.abs(z - c.z) < c.hz + RADIUS);
  };
  /** The floor under (x, z): the ground, or the top of something low you are standing on. */
  const floorAt = (x: number, z: number) => {
    let f = ctx.groundY(x, z);
    for (const c of ctx.colliders) if (c.top !== undefined && c.top > f && Math.abs(x - c.x) < c.hx + 0.15 && Math.abs(z - c.z) < c.hz + 0.15 && g.position.y >= c.top - 0.05) f = c.top;
    return f;
  };
  let climbT = -1;
  let wasSeated = false;

  ctx.onFrame((delta) => {
    const veh = ctx.vehicle;
    if (veh.exitAt) {
      g.position.set(veh.exitAt[0], ctx.groundY(veh.exitAt[0], veh.exitAt[1]), veh.exitAt[1]);
      veh.exitAt = null;
    }
    g.setEnabled(!veh.driving);
    if (veh.driving) {
      state.moving = state.running = state.jumping = false;
      wasGrounded = true;
      velocityY = 0;
      return;
    }
    const { move } = input.current;
    const joy = input.current.joystick;

    // ---- sitting: walk the last steps to the seat, turn round and sit; any movement stands up
    const seat = ctx.seat;
    if (seat) {
      const wantsUp = move.forward || move.backward || move.left || move.right || Math.abs(joy.x) + Math.abs(joy.y) > 0.3;
      if (wantsUp) {
        seat.onStand?.();
        ctx.seat = null;
      } else {
        const p = g.position;
        const k = 1 - Math.pow(0.004, delta);
        p.x = lerp(p.x, seat.x, k);
        p.z = lerp(p.z, seat.z, k);
        p.y = lerp(p.y, seat.y, k);
        facing = lerp(facing, matchAngle(facing, seat.yaw), k);
        g.rotation.y = facing + Math.PI;
        state.moving = state.running = state.jumping = state.swimming = false;
        state.sitting = true;
        wasSeated = true;
        velocityY = 0;
        ctx.player.set(p.x, p.y, p.z);
        return;
      }
    }
    if (wasSeated) {
      // step forward off the seat
      wasSeated = false;
      state.sitting = false;
      // step out in front of the seat: the first free spot ahead (then to the sides)
      const fx = Math.sin(facing), fz = Math.cos(facing);
      const base = { x: g.position.x, z: g.position.z };
      let placed = false;
      for (const side of [0, 0.5, -0.5, 1, -1])
        for (let d = 0.6; d <= 1.8 && !placed; d += 0.15) {
          const sx = base.x + fx * d + fz * side, sz = base.z + fz * d - fx * side;
          if (!blocked(sx, sz) && inRegions(ctx.regions, sx, sz, 0.4)) {
            g.position.set(sx, ctx.groundY(sx, sz), sz);
            placed = true;
          }
        }
    }

    // ---- climbing out of the pool on the ladder: facing the wall, rung by rung (each rung: reach
    // up with a hand, step up with the opposite foot, pull), then over the edge onto the deck
    if (climbT >= 0) {
      const RUNGS = 5;
      const CLIMB_S = 0.62; // per rung
      climbT += delta;
      const p = g.position;
      const climbDur = RUNGS * CLIMB_S;
      const startY = WATER_Y - 1.25;
      const topY = CITY_Y + 0.07;
      p.x = lerp(p.x, POOL_LADDER.x, 1 - Math.pow(0.001, delta));
      facing = lerp(facing, matchAngle(facing, 0), 1 - Math.pow(0.001, delta));
      g.rotation.y = facing + Math.PI;
      if (climbT < climbDur) {
        const r = climbT / CLIMB_S;
        const i = Math.floor(r), f = r - i;
        // the body rises during the pull (second half of each rung), not continuously
        const pull = f < 0.45 ? 0 : (1 - Math.cos(((f - 0.45) / 0.55) * Math.PI)) / 2;
        p.y = startY + ((i + pull) / RUNGS) * (topY - 0.25 - startY);
        p.z = POOL_LADDER.z - 0.42;
        state.climbing = true;
        state.climbT = r;
        state.moving = false;
      } else {
        // over the coping and two steps onto the deck
        const k = Math.min(1, (climbT - climbDur) / 0.9);
        const e = k * k * (3 - 2 * k);
        p.y = lerp(topY - 0.25, topY, Math.min(1, e * 1.6));
        p.z = POOL_LADDER.z - 0.42 + e * 1.3;
        state.climbing = k < 0.35;
        state.climbT = RUNGS;
        state.moving = k > 0.3;
        if (k >= 1) {
          climbT = -1;
          state.climbing = false;
          state.moving = false;
        }
      }
      state.swimming = false;
      state.jumping = false;
      ctx.player.set(p.x, p.y, p.z);
      return;
    }

    const forwardAxis = (move.forward ? 1 : 0) - (move.backward ? 1 : 0) - joy.y;
    const rightAxis = (move.right ? 1 : 0) - (move.left ? 1 : 0) + joy.x;

    const camYaw = input.current.look.yaw;
    let dx = -Math.sin(camYaw) * forwardAxis + Math.cos(camYaw) * rightAxis;
    let dz = -Math.cos(camYaw) * forwardAxis - Math.sin(camYaw) * rightAxis;
    const len = Math.hypot(dx, dz);
    const isMoving = len > 0.05;
    state.moving = isMoving;
    state.running = isMoving && move.run;

    const p = g.position;
    if (isMoving) {
      dx /= len;
      dz /= len;
      const speed = state.swimming ? SPEED * 0.7 : SPEED * (move.run ? RUN_MULTIPLIER : 1);
      // (if somehow already inside something, let the player walk out of it)
      const stuck = blocked(p.x, p.z);
      const nx = p.x + dx * speed * delta;
      if (inRegions(ctx.regions, nx, p.z, 0.4) && (stuck || !blocked(nx, p.z))) p.x = nx;
      const nz = p.z + dz * speed * delta;
      if (inRegions(ctx.regions, p.x, nz, 0.4) && (stuck || !blocked(p.x, nz))) p.z = nz;

      facing = lerp(facing, matchAngle(facing, Math.atan2(dx, dz)), 1 - Math.pow(0.001, delta));
      // The Soldier rig faces -Z in Babylon's right-handed scene, so add half a turn.
      g.rotation.y = facing + Math.PI;

      if (state.swimming) {
        footstepTimer -= delta;
        if (footstepTimer <= 0) {
          footstepTimer = 0.75;
          playSplash(0.05 + Math.random() * 0.03);
        }
      } else if (wasGrounded) {
        footstepTimer -= delta;
        if (footstepTimer <= 0) {
          footstepTimer = move.run ? FOOTSTEP_RUN_INTERVAL : FOOTSTEP_WALK_INTERVAL;
          playFootstep(0.12, 0.9 + Math.random() * 0.2);
          dustTrigger.yaw = Math.atan2(dx, dz);
          dustTrigger.n++;
        }
      }
    } else footstepTimer = 0;

    if (accentRef.current.color !== ringColor) {
      ringColor = accentRef.current.color;
      ringMat.albedoColor = ringMat.emissiveColor = linear(ringColor);
    }

    const floor = floorAt(p.x, p.z);

    // ---- swimming: in the pool and below the water line the body floats instead of falling.
    // Moving, it lies flat at the surface (crawl); still, it treads water upright, head above.
    const inWater = inPool(p.x, p.z) && p.y < WATER_Y - 0.05;
    if (inWater && !state.swimming) {
      playSplash(0.12 + Math.min(0.25, Math.abs(velocityY) * 0.04));
      velocityY *= 0.2;
    }
    state.swimming = inWater;
    if (inWater) {
      state.swimT = lerp(state.swimT, isMoving ? 1 : 0, 1 - Math.pow(0.05, delta));
      const floatY = WATER_Y - lerp(1.42, 0.22, state.swimT);
      // no jumping in water (Space does nothing); swim to the ladder and push on to climb out
      if (input.current.jumpId !== lastJumpId) lastJumpId = input.current.jumpId;
      const atLadder = Math.abs(p.x - POOL_LADDER.x) < 0.9 && POOL.z1 - p.z < 1.1 && dz > 0.5 && isMoving;
      if (atLadder) {
        climbT = 0;
        playSplash(0.08);
      }
      velocityY = 0;
      p.y = lerp(p.y, Math.max(floor, floatY), 1 - Math.pow(0.02, delta));
      wasGrounded = true;
      state.jumping = false;
      ctx.player.set(p.x, p.y, p.z);
      return;
    }
    state.swimT = 0;
    const onStairs = wasGrounded && velocityY <= 0 && Math.abs(p.y - floor) < 0.31;
    let jumped = false;
    if (input.current.jumpId !== lastJumpId) {
      lastJumpId = input.current.jumpId;
      if (onStairs || p.y <= floor + 0.0001) {
        velocityY = JUMP_SPEED;
        jumped = true;
      }
    }
    const glidingStairs = onStairs && !jumped;
    if (glidingStairs) {
      // Walking up/down stairs (or off a kerb): glide to the new tread's height at a
      // capped speed instead of popping there instantly. A single-frame teleport per
      // tread reads as a hop/jump; easing it over a couple of frames reads as a step.
      const diff = floor - p.y;
      const maxStep = STAIR_FOLLOW_SPEED * delta;
      p.y += Math.abs(diff) <= maxStep ? diff : Math.sign(diff) * maxStep;
    } else {
      velocityY += GRAVITY * delta;
      p.y = Math.max(floor, p.y + velocityY * delta);
      if (p.y <= floor) velocityY = 0;
    }
    wasGrounded = glidingStairs || p.y <= floor + 0.0001;
    state.jumping = !glidingStairs && p.y > floor + 0.02;
    state.vy = velocityY;

    ctx.player.set(p.x, p.y, p.z);
  });

  return modelReady;
}
