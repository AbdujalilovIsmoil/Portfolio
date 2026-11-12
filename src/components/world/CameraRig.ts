import { Ray, Vector3 } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { clamp, lerp, type Ctx } from "./core";
import { ROOM_H } from "./Room";
import { CITY_Y } from "./Stairs";
import { isOutdoors } from "./cityLayout";
import type { IntroSignal } from "./introSignal";
import type { TeleportSignal } from "./teleportSignal";
import type { WorldInput } from "./WorldInputContext";

const RADIUS = 6.0;
const CAR_RADIUS = 8.5;
/** Pull the hit point back this far so the camera sits just in front of the wall, not on it. */
const WALL_MARGIN = 0.25;
/** Absolute floor on the arm — keeps the camera from ever fully collapsing onto the pivot. */
const MIN_RADIUS = 0.8;
const INTRO_DURATION = 2.2;
const IDLE_DELAY = 9;
const IDLE_ORBIT_SPEED = 0.055;

export function buildCameraRig(
  ctx: Ctx,
  deps: { input: MutableRefObject<WorldInput>; teleportRef: MutableRefObject<TeleportSignal>; introRef: MutableRefObject<IntroSignal> }
) {
  const { input, teleportRef, introRef } = deps;
  const { camera, player } = ctx;
  const target = new Vector3();
  const desired = new Vector3();
  const lookTarget = new Vector3();
  const introStart = new Vector3();
  const rayDir = new Vector3();
  const ray = new Ray(Vector3.Zero(), Vector3.Up(), 1);
  let yaw = 0;
  let pitch = 0;
  let lastTeleport = teleportRef.current.value;
  let lastIntro = introRef.current.value;
  let introActive = false;
  let introElapsed = 0;
  let idleTime = 0;
  let idleOrbit = 0;
  let lastInputYaw = input.current.look.yaw;
  let lastInputPitch = input.current.look.pitch;
  let lastSeenJumpId = input.current.jumpId;
  // The arm's current reach in world units — a spring-arm collision distance,
  // kept separate from the per-frame position lerp below so a wall can pull
  // the camera in the same instant it appears (never show through a wall),
  // while opening back up afterwards still catches up quickly: it must never
  // visibly lag behind the player, just avoid an instant pop.
  let armDist = RADIUS;
  let seatYaw0 = 0;

  ctx.onFrame((delta, now) => {
    // Idle cinematic orbit: after a stretch with no input, drift around the character.
    const { move, joystick: joy, lookJoystick: lookJoy } = input.current;
    const yawMoved = Math.abs(input.current.look.yaw - lastInputYaw) > 0.0005;
    const pitchMoved = Math.abs(input.current.look.pitch - lastInputPitch) > 0.0005;
    const jumped = input.current.jumpId !== lastSeenJumpId;
    lastInputYaw = input.current.look.yaw;
    lastInputPitch = input.current.look.pitch;
    lastSeenJumpId = input.current.jumpId;

    const hasActivity =
      move.forward || move.backward || move.left || move.right ||
      joy.x !== 0 || joy.y !== 0 || lookJoy.x !== 0 || lookJoy.y !== 0 ||
      yawMoved || pitchMoved || jumped;

    if (hasActivity || introActive) {
      idleTime = 0;
      idleOrbit = 0;
    } else {
      idleTime += delta;
      if (idleTime > IDLE_DELAY) idleOrbit += delta * IDLE_ORBIT_SPEED;
    }

    const driving = ctx.vehicle.driving;
    if (driving && Math.abs(ctx.vehicle.speed) > 1.5) {
      // chase cam: swing behind the car
      const look = input.current.look;
      let diff = ctx.vehicle.heading + Math.PI - look.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      look.yaw += diff * Math.min(1, delta * 2.4);
      lastInputYaw = look.yaw;
    }
    const targetYaw = input.current.look.yaw + idleOrbit;
    const targetPitch = idleOrbit > 0 ? input.current.look.pitch + Math.sin(now * 0.2) * 0.04 : input.current.look.pitch;

    const smoothing = 1 - Math.pow(0.0015, delta);
    yaw = lerp(yaw, targetYaw, smoothing);
    pitch = lerp(pitch, targetPitch, smoothing);

    const R = driving ? CAR_RADIUS : RADIUS;
    const horizontal = R * Math.cos(pitch);
    desired.set(player.x + horizontal * Math.sin(yaw), player.y + R * Math.sin(pitch), player.z + horizontal * Math.cos(yaw));
    lookTarget.set(player.x, player.y + 1.1, player.z);

    // Spring-arm collision: cast a ray from the player's head toward the
    // orbit position and see how far it actually gets before a wall (or any
    // other pickable geometry — furniture included) blocks it. The player's
    // own body is excluded (isPickable = false in AnimatedCharacter.ts) so
    // the arm can't detect itself and collapse to 0 — the classic spring-arm
    // bug. Because the shortened arm still lands on this exact ray, the
    // camera keeps looking at the player from the same angle whether it's at
    // full reach in the open or pulled in tight at a doorway.
    rayDir.copyFrom(desired).subtractInPlace(lookTarget);
    const fullDist = rayDir.length();
    let allowed = fullDist;
    if (fullDist > 1e-4) {
      rayDir.scaleInPlace(1 / fullDist);
      ray.origin.copyFrom(lookTarget);
      ray.direction.copyFrom(rayDir);
      ray.length = fullDist;
      const hit = ctx.scene.pickWithRay(ray);
      if (hit?.hit && hit.distance > 0) allowed = Math.max(MIN_RADIUS, hit.distance - WALL_MARGIN);
    }

    const teleporting = teleportRef.current.value !== lastTeleport;
    // Pull in the instant a wall appears; ease back out so it doesn't pop.
    armDist = allowed < armDist || teleporting ? allowed : lerp(armDist, allowed, 1 - Math.pow(0.02, delta));
    armDist = clamp(armDist, MIN_RADIUS, Math.max(fullDist, MIN_RADIUS));
    if (fullDist > 1e-4) desired.set(lookTarget.x + rayDir.x * armDist, lookTarget.y + rayDir.y * armDist, lookTarget.z + rayDir.z * armDist);

    // Safety net only — the raycast above already keeps the camera out of
    // floors/ceilings/walls; this just covers the open street outside.
    const floorY = ctx.groundY(player.x, player.z);
    const outdoors = isOutdoors(player.x, player.z);
    desired.y = outdoors ? Math.max(desired.y, CITY_Y + 0.8) : clamp(desired.y, floorY + 0.7, ROOM_H - 0.35);

    // Scripted fly-in the moment the player presses "Boshlash".
    if (introRef.current.value !== lastIntro) {
      lastIntro = introRef.current.value;
      introActive = true;
      introElapsed = 0;
      introStart.set(6, ROOM_H - 0.4, 4.5);
    }

    // seated: eye-level view in the direction the seat faces (e.g. at the TV); the mouse can still
    // look around a little
    if (ctx.seat && !introActive) {
      const st = ctx.seat;
      const look = input.current.look.yaw - seatYaw0;
      const fy = st.yaw + clamp(look, -1, 1) * 0.8;
      const eye = 1.12;
      desired.set(player.x + Math.sin(st.yaw) * 0.12, player.y + eye + 0.05, player.z + Math.cos(st.yaw) * 0.12);
      lookTarget.set(desired.x + Math.sin(fy) * 4, desired.y - 0.15 + clamp(-input.current.look.pitch, -0.5, 0.5), desired.z + Math.cos(fy) * 4);
      Vector3.LerpToRef(camera.position, desired, 1 - Math.pow(0.002, delta), camera.position);
      Vector3.LerpToRef(target, lookTarget, 1 - Math.pow(0.002, delta), target);
      camera.setTarget(target);
      return;
    }
    seatYaw0 = input.current.look.yaw;
    if (introActive) {
      introElapsed += delta;
      const p = Math.min(1, introElapsed / INTRO_DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      Vector3.LerpToRef(introStart, desired, eased, camera.position);
      target.copyFrom(lookTarget);
      if (p >= 1) {
        introActive = false;
        lastTeleport = teleportRef.current.value;
      }
    } else if (teleportRef.current.value !== lastTeleport) {
      // A teleport moves the character hundreds of units in one frame: snap.
      lastTeleport = teleportRef.current.value;
      camera.position.copyFrom(desired);
      target.copyFrom(lookTarget);
    } else {
      Vector3.LerpToRef(camera.position, desired, 1 - Math.pow(0.0008, delta), camera.position);
      Vector3.LerpToRef(target, lookTarget, 1 - Math.pow(0.001, delta), target);
    }

    camera.setTarget(target);
  });
}
