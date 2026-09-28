import type { Node } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { buildAnimatedCharacter, type CharacterState } from "./AnimatedCharacter";
import { buildFootprints } from "./Effects";
import { group, inRegions, lerp, linear, lit, ring, type Ctx } from "./core";
import { trackLoad } from "./loadingSignal";
import { playFootstep } from "./footstepSynth";
import type { FlightSignal } from "./flightSignal";
import type { PlayerAccent } from "./playerAccentSignal";
import type { WorldInput } from "./WorldInputContext";

const SPEED = 2.6;
const RUN_MULTIPLIER = 2.0;
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

  const state: CharacterState = { moving: false, running: false, jumping: false, flying: false, superman: false };
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

  const blocked = (x: number, z: number) =>
    ctx.colliders.some((c) => Math.abs(x - c.x) < c.hx + RADIUS && Math.abs(z - c.z) < c.hz + RADIUS);

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
      const speed = SPEED * (move.run ? RUN_MULTIPLIER : 1);
      const nx = p.x + dx * speed * delta;
      if (inRegions(ctx.regions, nx, p.z, 0.4) && !blocked(nx, p.z)) p.x = nx;
      const nz = p.z + dz * speed * delta;
      if (inRegions(ctx.regions, p.x, nz, 0.4) && !blocked(p.x, nz)) p.z = nz;

      facing = lerp(facing, matchAngle(facing, Math.atan2(dx, dz)), 1 - Math.pow(0.001, delta));
      // The Soldier rig faces -Z in Babylon's right-handed scene, so add half a turn.
      g.rotation.y = facing + Math.PI;

      if (wasGrounded) {
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

    const floor = ctx.groundY(p.x, p.z);
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

    ctx.player.set(p.x, p.y, p.z);
  });

  return modelReady;
}
