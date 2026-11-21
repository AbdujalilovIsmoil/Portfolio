"use client";

import { useEffect, useRef } from "react";
import {
  CascadedShadowGenerator,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  FreeCamera,
  HemisphericLight,
  ImageProcessingConfiguration,
  Scene,
  ShadowGenerator,
  Vector3,
} from "@babylonjs/core";
import { buildCameraRig } from "./CameraRig";
import { buildCar } from "./Car";
import { buildDebris } from "./Debris";
import { buildMission } from "./Missions";
import { buildRace } from "./Race";
import { buildRaceInfo } from "./RaceInfo";
import { buildRaceTrack } from "./RaceTrack";
import { TRACK, boostPad, heightAt, loopPose, sampleAt, setLayout, startPose, trackS } from "./Track";
import { getZones } from "./Zones";
import { TRACKS, missionById, type Session } from "./game";
import { buildAmbience } from "./ambience";
import { SUN_DIR } from "./Sky";
import { LIGHT_SCALE, group, linear, type Ctx } from "./core";
import { QUALITY, detectQuality, gpuName } from "./performanceTier";
import { criticalLoads, loadContainer } from "./assets";
import { resetLoading, trackLoad } from "./loadingSignal";
import { useWorldInput } from "./WorldInputContext";
import type { AchievementSignal } from "./achievementSignal";
import type { DriveSignal } from "./driveSignal";
import type { ExhibitSignal } from "./exhibitSignal";
import type { IntroSignal } from "./introSignal";
import type { PlaySignal } from "./raceSignal";
import type { TeleportSignal } from "./teleportSignal";

const BG = "#12151d";
/** three.js' ACES divides exposure by 0.6; Babylon's doesn't. */
const EXPOSURE = 1 / 0.6;

export interface WorldProps {
  /** what is being played: the world is built for it (and rebuilt — remounted — for the next) */
  session: Session;
  teleportRef: React.MutableRefObject<TeleportSignal>;
  achievementRef: React.MutableRefObject<AchievementSignal>;
  introRef: React.MutableRefObject<IntroSignal>;
  exhibitRef: React.MutableRefObject<ExhibitSignal>;
  driveRef: React.MutableRefObject<DriveSignal>;
  playRef: React.MutableRefObject<PlaySignal>;
  /** true while the menu is open over the game */
  pauseRef: React.MutableRefObject<boolean>;
}

export default function World({ session, teleportRef, achievementRef, introRef, exhibitRef, driveRef, playRef, pauseRef }: WorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const input = useWorldInput();

  useEffect(() => {
    // the track for this session (every module reads the one being driven)
    setLayout(TRACKS[session.track].layout);
    const mission = session.mode === "mission" ? missionById(session.mission) : null;
    const SPAWN = startPose();
    const canvas = canvasRef.current!;
    const overlay = overlayRef.current!;
    // how much the device can take: the same world everywhere, cheaper where it can't be seen
    const quality = detectQuality();
    const Q = QUALITY[quality];

    const engine = new Engine(canvas, true, { powerPreference: "high-performance", stencil: false, alpha: false, preserveDrawingBuffer: false }, false);
    engine.setHardwareScalingLevel(1 / Math.min(Math.max(window.devicePixelRatio || 1, 1), Q.maxDpr));

    const scene = new Scene(engine);
    scene.useRightHandedSystem = true; // keep three.js coordinates/rotations 1:1
    scene.clearColor = Color4.FromHexString(BG + "ff");
    scene.skipPointerMovePicking = true;
    scene.autoClearDepthAndStencil = true;
    const ipc = scene.imageProcessingConfiguration;
    ipc.toneMappingEnabled = true;
    ipc.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ipc.exposure = EXPOSURE;

    const camera = new FreeCamera("cam", new Vector3(SPAWN.x + 34, 42, SPAWN.z - 58), scene);
    camera.fov = (50 * Math.PI) / 180;
    // (nothing is ever nearer than ~2 m: a near plane this far out keeps the depth buffer precise
    // enough that the ground and the road far off don't flicker into each other)
    camera.minZ = 0.6;
    camera.maxZ = 1600;
    camera.setTarget(new Vector3(SPAWN.x, 0, SPAWN.z));

    // ---- lights (intensities converted from three.js' physical units): the sky and the sun
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.specular = Color3.Black();

    const sun = new DirectionalLight("sun", SUN_DIR.negate(), scene);
    sun.position.set(0, 120, 0);

    // Shadows in cascades over everything up to a few hundred metres from the camera — fine near the
    // car, coarser further off — redrawn every frame (so they never lag behind the car) and
    // "stabilized": each cascade moves in whole texels, so shadow edges hold still instead of crawling
    // as you drive. On every device; a weaker one gets fewer, smaller shadow maps.
    let shadow: ShadowGenerator;
    if (CascadedShadowGenerator.IsSupported) {
      const csm = new CascadedShadowGenerator(Q.shadow.size, sun, undefined, camera);
      csm.numCascades = Q.shadow.cascades;
      csm.lambda = 0.85;
      csm.shadowMaxZ = Q.shadow.maxZ;
      csm.stabilizeCascades = true;
      csm.depthClamp = true;
      csm.cascadeBlendPercentage = Q.shadow.blend;
      csm.usePercentageCloserFiltering = true;
      csm.filteringQuality = Q.shadow.pcf === "medium" ? ShadowGenerator.QUALITY_MEDIUM : ShadowGenerator.QUALITY_LOW;
      // (the light's depth range spans every caster on the lap — hundreds of metres — so the bias is small)
      csm.bias = 0.0004;
      csm.normalBias = 0.012;
      csm.darkness = 0.28;
      shadow = csm;
    } else {
      // An old GPU where the browser only offers WebGL 1 (no cascades): one shadow map over the whole
      // circuit, standing still — softer, but nothing pops or crawls.
      const B = TRACK.bounds;
      const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
      const half = Math.max(B.x1 - B.x0, B.z1 - B.z0) * 0.75;
      sun.autoUpdateExtends = false;
      sun.orthoLeft = sun.orthoBottom = -half;
      sun.orthoRight = sun.orthoTop = half;
      sun.position.set(cx - sun.direction.x * half * 1.5, -sun.direction.y * half * 1.5, cz - sun.direction.z * half * 1.5);
      sun.shadowMinZ = 1;
      sun.shadowMaxZ = half * 3;
      shadow = new ShadowGenerator(2048, sun);
      shadow.usePercentageCloserFiltering = true;
      shadow.bias = 0.002;
      shadow.normalBias = 0.02;
      shadow.darkness = 0.28;
    }

    // ---- shared context + frame loop
    const deferred: (() => unknown)[] = [];
    const frameFns = new Set<(dt: number, t: number) => void>();
    const ctx: Ctx = {
      scene,
      camera,
      quality,
      shadow,
      player: new Vector3(SPAWN.x, 0, SPAWN.z),
      overlay,
      vehicle: { driving: true, x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading, speed: 0, slope: 0, s: 0, loop: -1, frozen: false, wallHits: 0, slide: 0, exitAt: null },
      dynamic: [],
      boostPads: boostPad() ? [boostPad()!] : [],
      paused: false,
      colliders: [],
      exhibits: [],
      groundY: () => 0,
      regions: [TRACK.bounds],
      time: 0,
      night: 0,
      outdoor: 1,
      onFrame(fn) {
        frameFns.add(fn);
        return () => frameFns.delete(fn);
      },
      lights: [],
      defer: (task) => deferred.push(task),
      afterBuild: [],
    };
    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
      ctx.time += dt;
      ctx.paused = pauseRef.current;
      frameFns.forEach((fn) => fn(dt, ctx.time));
    });

    // A clear, sunny day: a strong sun and a modest sky fill, for crisp light and real shadows,
    // and a whisper of aerial perspective (no milky haze).
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0009;
    scene.fogColor = Color3.FromHexString("#b4d4f4");
    sun.intensity = 5.2 * LIGHT_SCALE;
    sun.diffuse = new Color3(1, 0.93, 0.74);
    // the sky's light and an even fill, as one hemispheric light: the two are linear, so their sum is
    // exactly the same light — and every material does one light less per pixel
    const sky = linear("#c9d4ea").scale(1.5), skyGround = linear("#6a5644").scale(1.5);
    const fill = 0.3;
    hemi.intensity = LIGHT_SCALE;
    hemi.diffuse = new Color3(sky.r + fill, sky.g + fill, sky.b + fill);
    hemi.groundColor = new Color3(skyGround.r + fill, skyGround.g + fill, skyGround.b + fill);

    // Deferred tasks (trees, shrubs, flowers): one a frame behind the start screen; should any be
    // left once you drive, one every 0.12 s.
    const introAtStart = introRef.current.value;
    const pending: Promise<unknown>[] = [];
    let deferClock = 0;
    ctx.onFrame((dt) => {
      if (deferred.length === 0) return;
      if (introRef.current.value !== introAtStart) {
        deferClock -= dt;
        if (deferClock > 0) return;
        deferClock = 0.12;
      }
      const r = deferred.shift()!();
      if (r instanceof Promise) pending.push(r);
    });

    // ---- build the world (order = per-frame update order)
    const root = group(ctx);
    resetLoading();
    criticalLoads.begin(); // the road tiles and the car gate the start button
    // free drive: the portfolio's billboards round the Grand Circuit; races and missions: none
    const boards = session.mode === "free" ? getZones().map((z) => z.board) : [];
    const track = buildRaceTrack(ctx, root, { boards });
    driveRef.current.markers = [];
    Object.assign(playRef.current, { kind: "", state: "intro", results: [] });
    exhibitRef.current.open = false;
    let mode: { ready?: Promise<unknown> } = {};
    if (session.mode === "free") buildRaceInfo(ctx, root, { input, exhibitRef, achievementRef, driveRef });
    else if (session.mode === "race") mode = buildRace(ctx, root, { playRef, driveRef, introRef }, { track: session.track });
    else if (mission) mode = buildMission(ctx, root, { playRef, driveRef, introRef }, mission);
    buildAmbience(ctx);
    const car = buildCar(ctx, root, { input, teleportRef, driveRef });
    const debris = buildDebris(ctx, root);
    criticalLoads.end();
    buildCameraRig(ctx, { input, teleportRef, introRef });
    ctx.afterBuild.forEach((fn) => fn());
    // dev-only handle for poking at the world from the console / automated screenshots
    if (process.env.NODE_ENV !== "production" || new URLSearchParams(location.search).has("debug")) (window as unknown as { __world?: unknown }).__world = { ctx, input, engine, loadContainer, TRACK, sampleAt, heightAt, trackS, loopPose, quality, gpu: gpuName(), play: playRef.current, session, drive: driveRef.current, mode };
    car.ready.catch((e) => console.error("The car failed to load", e));

    // The start button waits until everything is loaded AND every shader is compiled — the
    // materials of every mesh and the shadow casters' depth passes — so nothing compiles (and
    // stalls a frame) for the first time while you drive.
    const until = (ok: () => boolean, ms: number) =>
      new Promise<void>((res) => {
        const t0 = performance.now();
        const tick = () => (ok() || performance.now() - t0 > ms ? res() : setTimeout(tick, 50));
        tick();
      });
    trackLoad(
      (async () => {
        await Promise.allSettled([track.ready, car.ready, mode.ready]);
        await until(() => deferred.length === 0, 60000);
        await Promise.allSettled(pending);
        await Promise.race([scene.whenReadyAsync(), new Promise((r) => setTimeout(r, 15000))]);
        await until(() => debris.ready(), 5000);
      })()
    );

    // Adaptive resolution, carefully: fewer pixels only when the frame rate stays low for seconds
    // (never on one hiccup), a step at a time, and back up only after a long stretch with headroom —
    // it never see-saws (each change re-allocates the canvas: a hitch of its own).
    const baseScale = 1 / Math.min(Math.max(window.devicePixelRatio || 1, 1), Q.maxDpr);
    const maxScale = Math.max(1, baseScale) / Q.minResolution; // (no lower than this: the picture would go soft)
    let scale = baseScale;
    let slow = 0;
    let fast = 0;
    let cooldown = 5;
    ctx.onFrame((dt) => {
      if (document.hidden) return;
      cooldown -= dt;
      const fps = engine.getFps();
      slow = fps < 45 ? slow + dt : 0;
      fast = fps > 58 ? fast + dt : 0;
      if (cooldown > 0) return;
      let next = scale;
      if (slow > 3 && scale < maxScale) next = Math.min(maxScale, scale * 1.15);
      else if (fast > 12 && scale > baseScale) next = Math.max(baseScale, scale / 1.15);
      if (next !== scale) {
        scale = next;
        engine.setHardwareScalingLevel(scale);
        cooldown = 6;
        slow = fast = 0;
      }
    });

    engine.runRenderLoop(() => scene.render());
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none", outline: "none" }} />
      <div ref={overlayRef} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
    </div>
  );
}
