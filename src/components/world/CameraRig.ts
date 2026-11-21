import { Vector3 } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { TRACK, groundAt, loopView, startPose } from "./Track";
import { clamp, lerp, type Ctx } from "./core";
import type { IntroSignal } from "./introSignal";
import type { TeleportSignal } from "./teleportSignal";
import type { WorldInput } from "./WorldInputContext";

/** How far behind the car the camera sits — always, at any speed. */
const RADIUS = 9.5;
/** Pull the hit point back this far so the camera sits just in front of a hill, not inside it. */
const WALL_MARGIN = 0.3;
const MIN_RADIUS = 2.5;
const INTRO_DURATION = 2.8;
const FOV = (50 * Math.PI) / 180;
/** The loop is watched from the side through a slightly longer lens. */
const LOOP_FOV = (44 * Math.PI) / 180;
/** how much wider the view gets flat out on the nitro */
const RUSH_FOV = (9 * Math.PI) / 180;

const smooth = (k: number) => k * k * (3 - 2 * k);

/**
 * Chase camera: behind the car and a little above, swinging round behind it whenever it drives
 * (the mouse / look stick can look around; it eases back once you drive on). It keeps the same
 * distance at every speed: only its swing round the car is smoothed, never its distance, so the car
 * doesn't shrink away as you speed up. A spring arm keeps it in front of hills, and it never sinks
 * into one (both from the track's own height profile: no ray casts). On the loop-the-loop it moves
 * out to the side and watches you go round.
 */
export function buildCameraRig(
  ctx: Ctx,
  deps: { input: MutableRefObject<WorldInput>; teleportRef: MutableRefObject<TeleportSignal>; introRef: MutableRefObject<IntroSignal> }
) {
  const { input, teleportRef, introRef } = deps;
  const { camera, player } = ctx;
  const v = ctx.vehicle;
  const desired = new Vector3();
  const lookTarget = new Vector3();
  /** where the spring arm starts: just above the car itself (the look-ahead point may be inside a hill) */
  const pivot = new Vector3();
  const introStart = new Vector3();
  const rayDir = new Vector3();
  let hint = -1;
  /** the camera and what it looks at, relative to the car (smoothed): the car's own motion is never lagged */
  const offset = new Vector3();
  const lookOffset = new Vector3();
  const chasePos = new Vector3();
  const chaseTarget = new Vector3();
  const sidePos = new Vector3();
  const sideTarget = new Vector3();
  const target = new Vector3(player.x, 1.2, player.z);
  input.current.look.yaw = startPose().heading + Math.PI;
  let yaw = input.current.look.yaw;
  let pitch = input.current.look.pitch;
  let lastTeleport = teleportRef.current.value;
  let lastIntro = introRef.current.value;
  let introActive = false;
  let introElapsed = 0;
  let armDist = RADIUS;
  let lead = 0;
  let primed = false;
  /** extra pitch while the car goes downhill, so the arm stays clear of the road rising behind it */
  let downhill = 0;
  /** 0 = chasing the car … 1 = watching the loop from the side */
  let loopBlend = 0;
  /** 0 … 1: how far past the throttle's top speed the car is going (the nitro) */
  let rush = 0;
  const view = TRACK.loop ? loopView() : null;
  const loopHeading = TRACK.loop ? Math.atan2(TRACK.loop.fx, TRACK.loop.fz) : 0;

  ctx.onFrame((delta) => {
    const look = input.current.look;
    const speed = Math.abs(v.speed);
    const onLoop = v.loop >= 0;
    if (onLoop) {
      // on the loop the car turns over: wait behind the way it comes out
      let diff = loopHeading + Math.PI - look.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      look.yaw += diff * Math.min(1, delta * 3);
    } else if (speed > 1.2) {
      let diff = v.heading + Math.PI - look.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      look.yaw += diff * Math.min(1, delta * (1.2 + Math.min(speed, 20) * 0.07));
    }
    const smoothing = 1 - Math.pow(0.0015, delta);
    yaw = lerp(yaw, look.yaw, smoothing);
    pitch = lerp(pitch, look.pitch, smoothing);

    downhill = lerp(downhill, Math.max(0, -v.slope) * 1.2, 1 - Math.pow(0.02, delta));
    const pitchNow = Math.min(pitch + downhill, 1.3);
    const horizontal = RADIUS * Math.cos(pitchNow);
    // look a little ahead of the car when it is moving — up or down the slope, along the road
    lead = lerp(lead, clamp(v.speed * 0.14, -1.5, 3.5), 1 - Math.pow(0.05, delta));
    lookTarget.set(player.x + Math.sin(v.heading) * lead, player.y + 1.25 + Math.tan(v.slope) * lead, player.z + Math.cos(v.heading) * lead);
    pivot.set(player.x, player.y + 1.6, player.z);
    desired.set(pivot.x + horizontal * Math.sin(yaw), pivot.y + RADIUS * Math.sin(pitchNow), pivot.z + horizontal * Math.cos(yaw));

    // spring arm: stop short of a hill between the car and the camera (props, walls and gantries
    // don't count: the camera looks over them or passes under them) — stepping out along the arm
    // until a point would be in the ground
    rayDir.copyFrom(desired).subtractInPlace(pivot);
    const fullDist = rayDir.length();
    let allowed = fullDist;
    if (fullDist > 1e-4) {
      rayDir.scaleInPlace(1 / fullDist);
      for (let d = 0.75; d < fullDist + 0.75; d += 0.75) {
        const k = Math.min(d, fullDist);
        const x = pivot.x + rayDir.x * k, y = pivot.y + rayDir.y * k, z = pivot.z + rayDir.z * k;
        const g = groundAt(x, z, hint);
        hint = g.i;
        if (y < g.y + 0.6) {
          allowed = Math.max(MIN_RADIUS, k - 0.75 - WALL_MARGIN);
          break;
        }
      }
    }
    const teleporting = teleportRef.current.value !== lastTeleport;
    // pulls in quickly but smoothly, eases back out
    armDist = teleporting ? allowed : lerp(armDist, allowed, 1 - Math.pow(allowed < armDist ? 1e-5 : 0.02, delta));
    armDist = clamp(armDist, Math.min(MIN_RADIUS, fullDist), Math.max(fullDist, MIN_RADIUS));
    if (fullDist > 1e-4) desired.set(pivot.x + rayDir.x * armDist, pivot.y + rayDir.y * armDist, pivot.z + rayDir.z * armDist);
    // never inside a hill or a bridge behind the car
    desired.y = Math.max(desired.y, groundAt(desired.x, desired.z, hint).y + 1.0);

    // the chase position, relative to the car: smoothed as an offset, so it swings but never lags behind
    const snap = teleporting || !primed;
    desired.subtractToRef(player, rayDir);
    if (snap) offset.copyFrom(rayDir);
    else Vector3.LerpToRef(offset, rayDir, 1 - Math.pow(0.0006, delta), offset);
    lookTarget.subtractToRef(player, rayDir);
    if (snap) lookOffset.copyFrom(rayDir);
    else Vector3.LerpToRef(lookOffset, rayDir, 1 - Math.pow(0.0008, delta), lookOffset);
    primed = true;
    player.addToRef(offset, chasePos);
    player.addToRef(lookOffset, chaseTarget);

    // on the loop: out to the side, watching it (a little ahead of the loop's middle, towards the car);
    // off it, a cut straight back behind the car (easing back would fly the camera through the loop)
    loopBlend = teleporting || !onLoop ? (onLoop ? 1 : 0) : lerp(loopBlend, 1, 1 - Math.pow(0.015, delta));
    if (view && loopBlend > 0.001) {
      const along = (player.x - view.centre.x) * view.fx + (player.z - view.centre.z) * view.fz;
      sidePos.set(view.cam.x + view.fx * along * 0.3, view.cam.y + (player.y - view.centre.y) * 0.15, view.cam.z + view.fz * along * 0.3);
      sideTarget.set(lerp(view.centre.x, player.x, 0.6), lerp(view.centre.y, player.y + 1, 0.6), lerp(view.centre.z, player.z, 0.6));
      const k = smooth(loopBlend);
      Vector3.LerpToRef(chasePos, sidePos, k, chasePos);
      Vector3.LerpToRef(chaseTarget, sideTarget, k, chaseTarget);
    }
    // (flat out on the nitro the view widens a little: you feel the speed)
    rush = lerp(rush, clamp((speed - 37) / 46, 0, 1), 1 - Math.pow(0.2, delta));
    camera.fov = lerp(FOV + rush * RUSH_FOV, LOOP_FOV, smooth(loopBlend));

    // scripted fly-in the moment the player presses Start
    if (introRef.current.value !== lastIntro) {
      lastIntro = introRef.current.value;
      introActive = true;
      introElapsed = 0;
      introStart.set(player.x + 40, player.y + 48, player.z - 70);
    }
    if (introActive) {
      introElapsed += delta;
      const p = Math.min(1, introElapsed / INTRO_DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      Vector3.LerpToRef(introStart, chasePos, eased, camera.position);
      target.copyFrom(chaseTarget);
      if (p >= 1) {
        introActive = false;
        lastTeleport = teleportRef.current.value;
      }
    } else {
      if (teleporting) lastTeleport = teleportRef.current.value;
      camera.position.copyFrom(chasePos);
      target.copyFrom(chaseTarget);
    }
    camera.setTarget(target);
  });
}
