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
  Viewport,
} from "@babylonjs/core";
import { buildCameraRig } from "./CameraRig";
import { buildCar } from "./Car";
import { buildDebris } from "./Debris";
import { buildMission } from "./Missions";
import { buildRace } from "./Race";
import { paintedTexture } from "./Opponents";
import { musicFile } from "./musicChoice";
import { createTeleportSignal } from "./teleportSignal";
import { createDriveSignal } from "./driveSignal";
import { buildRaceInfo } from "./RaceInfo";
import { buildRaceTrack } from "./RaceTrack";
import { buildUnderworld } from "./Underworld";
import { TRACK, boostPad, heightAt, loopPose, sampleAt, setLayout, startPose, trackS } from "./Track";
import { getZones } from "./Zones";
import { TRACKS, missionById, type Session } from "./game";
import { SUN_DIR } from "./Sky";
import { LIGHT_SCALE, group, linear, type Ctx, type VehicleState } from "./core";
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
/** How far into the night it is (0 day … 1 deep night): dusk — the sky going violet, the city's windows lit, still light enough to drive by. */
const NIGHT = 0.22;
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

  // (the effect writes the shared input ref: split screen on or off)
  // eslint-disable-next-line react-hooks/immutability
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
    // split screen (a race for two): player 1 in the top half, player 2 in the bottom, each with a camera of their own
    const split = session.mode === "race" && session.players === 2;
    // (the input is a ref shared with the menu: written here, read by the keyboard handler)
    const io = input.current;
    // eslint-disable-next-line react-hooks/immutability
    io.split = split;
    const secondCamera = () => {
      const c = new FreeCamera("cam2", camera.position.clone(), scene);
      c.fov = camera.fov;
      c.minZ = camera.minZ;
      c.maxZ = camera.maxZ;
      c.viewport = new Viewport(0, 0, 1, 0.5);
      camera.viewport = new Viewport(0, 0.5, 1, 0.5);
      scene.activeCameras = [camera, c];
      return c;
    };
    const camera2 = split ? secondCamera() : null;

    // ---- lights (intensities converted from three.js' physical units): the sky and the sun
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.specular = Color3.Black();

    // (the sun, low in the west at dusk: it lights the scene and casts the long shadows)
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
    // (two cameras render the scene twice — and with it the shadow map, though it is the same map for
    // both: refreshed on every other render, it is drawn once a frame)
    if (split) {
      const map = shadow.getShadowMap();
      if (map) map.refreshRate = 2;
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
      vehicle: { driving: true, x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading, speed: 0, slope: 0, s: 0, loop: -1, frozen: false, celebrate: false, wallHits: 0, slide: 0, exitAt: null },
      dynamic: [],
      boostPads: boostPad() ? [boostPad()!] : [],
      paused: false,
      colliders: [],
      exhibits: [],
      groundY: () => 0,
      regions: [TRACK.bounds],
      time: 0,
      // (dusk in the city: a violet sky, the first stars, the windows lit)
      night: NIGHT,
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

    // Dusk in the city: light enough to drive without headlights — a low, warm sun with long
    // shadows, a violet sky, the first windows lit — a soft evening haze.
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.001;
    scene.fogColor = Color3.FromHexString("#8f87a3");
    sun.intensity = 6 * LIGHT_SCALE;
    sun.diffuse = new Color3(1, 0.74, 0.55);
    // the sky's light and an even fill, as one hemispheric light: the two are linear, so their sum is
    // exactly the same light — and every material does one light less per pixel
    const sky = linear("#b4b8dc").scale(2.6), skyGround = linear("#8a7466").scale(2.2);
    const fill = 0.45;
    hemi.intensity = LIGHT_SCALE;
    hemi.diffuse = new Color3(sky.r + fill, sky.g + fill, sky.b + fill);
    hemi.groundColor = new Color3(skyGround.r + fill, skyGround.g + fill, skyGround.b + fill);

    // Deferred tasks: one a frame behind the start screen; should any be
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
    buildUnderworld(ctx, root);
    driveRef.current.markers = [];
    Object.assign(playRef.current, { kind: "", state: "intro", results: [] });
    exhibitRef.current.open = false;
    let mode: { ready?: Promise<unknown> } = {};
    if (session.mode === "free") buildRaceInfo(ctx, root, { input, exhibitRef, achievementRef, driveRef });
    // (split screen: player 2's own car state, position and signals)
    const v2: VehicleState = { driving: true, x: 0, z: 0, heading: 0, speed: 0, slope: 0, s: 0, loop: -1, frozen: false, celebrate: false, wallHits: 0, slide: 0, exitAt: null };
    const player2 = new Vector3();
    const p2Input = { current: io.p2 };
    const p2Teleport = { current: createTeleportSignal() };
    const players = split
      ? [
          { vehicle: ctx.vehicle, name: "Player 1", color: "#ff3b30" },
          { vehicle: v2, name: "Player 2", color: "#ffc21a" },
        ]
      : undefined;
    if (session.mode === "race") mode = buildRace(ctx, root, { playRef, driveRef, introRef }, { track: session.track, players, music: musicFile() });
    else if (mission) mode = buildMission(ctx, root, { playRef, driveRef, introRef }, mission);
    const car = buildCar(ctx, root, { input, teleportRef, driveRef, lateral: split ? 3.2 : 0, solid: split });
    // player 2: beside player 1 on the grid, painted yellow
    const car2 = split ? buildCar(ctx, root, { input: p2Input, teleportRef: p2Teleport, driveRef: { current: createDriveSignal() }, vehicle: v2, player: player2, lateral: -3.2, main: false, solid: true }) : null;
    car2?.ready
      .then(async (holder) => {
        const tex = await paintedTexture(scene, "#ffc21a");
        if (tex) for (const m of holder.getChildMeshes()) if (m.material && "albedoTexture" in m.material) (m.material as { albedoTexture: unknown }).albedoTexture = tex;
      })
      .catch(() => {});
    const debris = buildDebris(ctx, root);
    criticalLoads.end();
    buildCameraRig(ctx, { input, teleportRef, introRef });
    if (camera2) buildCameraRig(ctx, { input: p2Input, teleportRef: p2Teleport, introRef, camera: camera2, vehicle: v2, player: player2 });
    ctx.afterBuild.forEach((fn) => fn());
    // dev-only handle for poking at the world from the console / automated screenshots
    if (process.env.NODE_ENV !== "production" || new URLSearchParams(location.search).has("debug")) (window as unknown as { __world?: unknown }).__world = { ctx, input, engine, loadContainer, TRACK, sampleAt, heightAt, trackS, loopPose, quality, gpu: gpuName(), play: playRef.current, session, drive: driveRef.current, mode, vehicle2: split ? v2 : null };
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
      // (not while the fireworks go up for a win: a burst of a few seconds must not leave the
      // picture soft for the rest of the visit — the result screen is up anyway)
      slow = fps < 45 && !ctx.vehicle.celebrate ? slow + dt : 0;
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
      io.split = false;
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
      {session.mode === "race" && session.players === 2 && <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 3, marginTop: -1.5, background: "#0b0e15", boxShadow: "0 0 0 1px rgba(255,255,255,0.15)", pointerEvents: "none" }} />}
    </div>
  );
}
