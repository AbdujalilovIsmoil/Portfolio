import { Vector3 } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { clamp, lerp, nearestInRegions, type Ctx } from "./core";
import { ROOM_H } from "./Room";
import { CITY_Y } from "./Stairs";
import type { IntroSignal } from "./introSignal";
import type { TeleportSignal } from "./teleportSignal";
import type { WorldInput } from "./WorldInputContext";

const RADIUS = 5.2;
const CAR_RADIUS = 8.5;
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
    const [cx, cz] = nearestInRegions(ctx.regions, desired.x, desired.z, 0.35);
    const floorY = ctx.groundY(player.x, player.z);
    const outdoors = player.z > 50.6;
    desired.set(cx, outdoors ? Math.max(desired.y, CITY_Y + 0.8) : clamp(desired.y, floorY + 0.7, ROOM_H - 0.35), cz);
    lookTarget.set(player.x, player.y + 1.1, player.z);

    // Scripted fly-in the moment the player presses "Boshlash".
    if (introRef.current.value !== lastIntro) {
      lastIntro = introRef.current.value;
      introActive = true;
      introElapsed = 0;
      introStart.set(6, ROOM_H - 0.4, 4.5);
    }

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
