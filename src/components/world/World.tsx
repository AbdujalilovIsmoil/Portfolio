"use client";

import { useEffect, useRef, useState } from "react";
import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  FreeCamera,
  HemisphericLight,
  Light,
  PointLight,
  ImageProcessingConfiguration,
  Scene,
  ShadowGenerator,
  Vector3,
  type TransformNode,
} from "@babylonjs/core";
import { buildCameraRig } from "./CameraRig";
import { buildCharacter } from "./Character";
import { buildRoom } from "./Room";
import { buildGameRoom } from "./GameRoom";
import { buildMuseum } from "./Museum";
import { buildHistoryRoom } from "./HistoryRoom";
import { createExhibitSystem } from "./Exhibits";
import { createWorkSystem } from "./WorkSystem";
import type { WorkSignal } from "./workSignal";
import { buildTechRoom } from "./TechRoom";
import { buildTestimonialsRoom } from "./TestimonialsRoom";
import { buildAchievementsRoom } from "./AchievementsRoom";
import { buildCity, GROUNDS_REGION } from "./City";
import { FRONT_Z, isOutdoors } from "./cityLayout";
import { buildAmbience } from "./ambience";
import { MOON_DIR, SUN_DIR } from "./Sky";
import { timeOfDay } from "./timeOfDay";
import { OFFICE_REGION, PLACED, WALK_REGIONS } from "./regions";
import { EAST_DX, WEST_DX, shiftRegion } from "./plan";
import { buildStairs, groundY } from "./Stairs";
import { HOME_BOX, buildHomeRooms } from "./HomeRooms";
import { curtains } from "./decor";
import { buildTvCorner } from "./TvCorner";
import { buildCat } from "./Cat";
import { mergeStatic } from "./staticMerge";
import { ROOM_HZ } from "./Room";
import type { ExhibitSignal } from "./exhibitSignal";
import type { PsSignal } from "./psSignal";
import { HALL, buildCorridor } from "./Corridor";
import { createDoorSystem } from "./Doors";
import type { DoorSignal } from "./doorSignal";
import { LIGHT_SCALE, group, linear, type Anchor, type Ctx, type Region } from "./core";
import { getIsLowPowerDevice } from "./performanceTier";
import { criticalLoads, loadContainer } from "./assets";
import { resetLoading } from "./loadingSignal";
import { useWorldInput } from "./WorldInputContext";
import FloatingInfoPanel from "./FloatingInfoPanel";
import type { TeleportSignal } from "./teleportSignal";
import type { NearPortalSignal } from "./nearPortalSignal";
import type { AchievementSignal } from "./achievementSignal";
import type { IntroSignal } from "./introSignal";
import type { PlayerAccent } from "./playerAccentSignal";
import type { FlightSignal } from "./flightSignal";

const BG = "#12151d";
/** three.js' ACES divides exposure by 0.6; Babylon's doesn't. */
const EXPOSURE = 1 / 0.6;

interface Props {
  accent: string;
  teleportRef: React.MutableRefObject<TeleportSignal>;
  nearPortalRef: React.MutableRefObject<NearPortalSignal>;
  achievementRef: React.MutableRefObject<AchievementSignal>;
  introRef: React.MutableRefObject<IntroSignal>;
  accentRef: React.MutableRefObject<PlayerAccent>;
  flightRef: React.MutableRefObject<FlightSignal>;
  psRef: React.MutableRefObject<PsSignal>;
  doorRef: React.MutableRefObject<DoorSignal>;
  exhibitRef: React.MutableRefObject<ExhibitSignal>;
  workRef: React.MutableRefObject<WorkSignal>;
}

export default function World({ teleportRef, introRef, accentRef, flightRef, psRef, doorRef, exhibitRef, workRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const input = useWorldInput();
  const [built, setBuilt] = useState<{ ctx: Ctx; anchors: Anchor[] } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const overlay = overlayRef.current!;
    const lowPower = getIsLowPowerDevice();

    const engine = new Engine(canvas, true, { powerPreference: "high-performance", stencil: false, alpha: false, preserveDrawingBuffer: false }, false);
    engine.setHardwareScalingLevel(1 / Math.min(Math.max(window.devicePixelRatio || 1, 1), lowPower ? 1 : 1.5));

    const scene = new Scene(engine);
    scene.useRightHandedSystem = true; // keep three.js coordinates/rotations 1:1
    scene.clearColor = Color4.FromHexString(BG + "ff");
    scene.skipPointerMovePicking = true;
    scene.autoClearDepthAndStencil = true;
    const ipc = scene.imageProcessingConfiguration;
    ipc.toneMappingEnabled = true;
    ipc.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ipc.exposure = EXPOSURE;

    const camera = new FreeCamera("cam", new Vector3(0, 7.4, 21.6), scene);
    camera.fov = (48 * Math.PI) / 180;
    camera.minZ = 0.3;
    camera.maxZ = 1000;
    camera.setTarget(Vector3.Zero());

    // ---- lights (intensities converted from three.js' physical units)
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.diffuse = linear("#c9d4ea");
    hemi.groundColor = linear("#6a5644");
    hemi.specular = Color3.Black();
    hemi.intensity = 1.0 * LIGHT_SCALE;
    const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    ambient.diffuse = ambient.groundColor = Color3.White();
    ambient.specular = Color3.Black();
    ambient.intensity = 0.45 * LIGHT_SCALE;

    const sun = new DirectionalLight("sun", new Vector3(-0.3, -1, -0.2).normalize(), scene);
    sun.intensity = 0.8 * LIGHT_SCALE;
    sun.autoUpdateExtends = false;
    sun.orthoLeft = -16;
    sun.orthoRight = 16;
    sun.orthoTop = 16;
    sun.orthoBottom = -16;
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 80;

    let shadow: ShadowGenerator | null = null;
    if (!lowPower) {
      shadow = new ShadowGenerator(1024, sun);
      shadow.usePercentageCloserFiltering = true;
      shadow.bias = 0.0015;
      shadow.normalBias = 0.035;
      shadow.darkness = 0.35;
      shadow.getShadowMap()!.refreshRate = 2;
    }

    // ---- shared context + frame loop
    const deferred: (() => void)[] = [];
    const frameFns = new Set<(dt: number, t: number) => void>();
    const ctx: Ctx = {
      scene,
      camera,
      lowPower,
      shadow,
      player: new Vector3(0, 0, 11),
      overlay,
      vehicle: { driving: false, x: 0, z: 0, heading: 0, speed: 0, exitAt: null },
      colliders: [],
      exhibits: [],
      groundY,
      regions: WALK_REGIONS,
      time: 0,
      night: timeOfDay.blend,
      outdoor: 0,
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
      frameFns.forEach((fn) => fn(dt, ctx.time));
    });

    // Sun (and its shadow frustum) follows the player.
    ctx.onFrame(() => {
      sun.position.set(ctx.player.x + 6, ctx.player.y + 20, ctx.player.z + 4);
    });
    // Light, fog and sky follow two eased blends: indoors ⇄ street, and day ⇄ night (header toggle).
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0;
    const indoorDir = new Vector3(-0.3, -1, -0.2).normalize();
    const sunDir = SUN_DIR.negate();
    const moonDir = MOON_DIR.negate();
    const outDir = new Vector3();
    const fogDay = Color3.FromHexString("#b4d4f4");
    const fogNight = Color3.FromHexString("#0c1326");
    const sunDay = new Color3(1, 0.93, 0.74);
    const sunNight = new Color3(0.55, 0.66, 1);
    const hemiDay = linear("#c9d4ea");
    const hemiNight = linear("#3b4b7a");
    const groundDay = linear("#6a5644");
    const groundNight = linear("#1a1b26");
    const hemiIn = linear("#c9d4ea");
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    ctx.onFrame((dt) => {
      const goal = isOutdoors(ctx.player.x, ctx.player.z) ? 1 : 0;
      ctx.outdoor += (goal - ctx.outdoor) * Math.min(1, dt * 3);
      timeOfDay.blend += ((timeOfDay.night ? 1 : 0) - timeOfDay.blend) * Math.min(1, dt * 1.6);
      ctx.night = timeOfDay.blend;
      const o = ctx.outdoor;
      const n = ctx.night;
      // outdoors by day: a strong sun and a modest sky fill, for crisp light and real shadows
      sun.intensity = mix(0.8, mix(5.2, 0.6, n), o) * LIGHT_SCALE;
      hemi.intensity = mix(1.0 * (1 - 0.2 * n), mix(1.5, 0.55, n), o) * LIGHT_SCALE;
      ambient.intensity = mix(0.45 * (1 - 0.25 * n), mix(0.3, 0.12, n), o) * LIGHT_SCALE;
      Vector3.LerpToRef(sunDir, moonDir, n, outDir);
      Vector3.LerpToRef(indoorDir, outDir, o, sun.direction);
      sun.direction.normalize();
      Color3.LerpToRef(sunDay, sunNight, n, sun.diffuse);
      Color3.LerpToRef(hemiIn, n > 0 ? Color3.Lerp(hemiDay, hemiNight, n) : hemiDay, o, hemi.diffuse);
      Color3.LerpToRef(groundDay, groundNight, n * o, hemi.groundColor);
      Color3.LerpToRef(fogDay, fogNight, n, scene.fogColor);
      // a whisper of aerial perspective by day (no milky haze), deeper by night
      scene.fogDensity = o * mix(0.0011, 0.005, n);
      if (shadow) shadow.darkness = mix(0.35, 0.6, n * o);
    });

    // Room lights are data only; a FIXED pool of real lights is re-pointed at the nearest ones.
    // (Enabling/disabling lights would change the shader every time -> a visible hitch.)
    const POOL = 5;
    const pool = Array.from({ length: POOL }, (_, i) => {
      const l = new PointLight("pool" + i, Vector3.Zero(), scene);
      l.falloffType = Light.FALLOFF_GLTF;
      l.intensity = 0;
      l.range = 10;
      return l;
    });
    let poolClock = 0;
    ctx.onFrame((dt) => {
      poolClock -= dt;
      if (poolClock > 0) return;
      poolClock = 0.15;
      const p = ctx.player;
      const ranked = ctx.lights.filter((l) => l.intensity > 0).map((l) => ({ l, d: Vector3.DistanceSquared(l.pos, p) })).sort((a, b) => a.d - b.d);
      pool.forEach((real, i) => {
        const pick = ranked[i];
        if (!pick || pick.d > 18 * 18) {
          real.intensity = 0;
          return;
        }
        real.position.copyFrom(pick.l.pos);
        real.diffuse.copyFrom(pick.l.color);
        real.specular.copyFrom(pick.l.color);
        real.range = pick.l.range;
        real.intensity = pick.l.intensity;
      });
    });

    // Compile every material once, in the background, so entering a new room never stalls on shaders.
    let warmed = false;
    const warmUpShaders = () => {
      if (warmed) return;
      warmed = true;
      setTimeout(() => {
        const seen = new Set<unknown>();
        scene.meshes.forEach((m) => {
          if (!m.material || seen.has(m.material) || m.getTotalVertices() === 0) return;
          seen.add(m.material);
          m.material.forceCompilationAsync(m).catch(() => {});
        });
      }, 1500);
    };

    // Model loading trickles in one task at a time in the background.
    let deferClock = 0;
    ctx.onFrame((dt) => {
      deferClock -= dt;
      if (deferClock > 0 || deferred.length === 0) return;
      deferClock = 0.12;
      deferred.shift()!();
      if (deferred.length === 0) warmUpShaders();
    });

    // ---- build the world (order = per-frame update order, as before)
    const root = group(ctx);
    resetLoading();
    criticalLoads.begin(); // office, lamps, sofa and the character gate the start button
    const room = buildRoom(ctx, root);
    const doors = createDoorSystem(ctx, { input, doorRef });
    const hall = buildCorridor(ctx, root, doors);
    buildStairs(ctx, root, doors);
    const home = buildHomeRooms(ctx, root, doors);
    buildTvCorner(ctx, room.root, doors);
    buildCat(ctx, root);
    // curtains on the living-room window (it opens onto the back garden)
    curtains(ctx, room.root, doors, { axis: "z", at: -ROOM_HZ + 0.1, inward: 1, u: 1, y: 1.78, w: 3.4, h: 1.65, color: "#6a3a2a" });
    // The themed rooms are built in their own coordinates and shifted sideways as a whole to open
    // up the central hall (plan.ts): their colliders and exhibits move with them.
    const offsetDone = new WeakSet<object>();
    const placed = <R extends { colliders: { x: number }[] }>(dx: number, build: (p: TransformNode) => R): R => {
      const wrap = group(ctx, { parent: root, pos: [dx, 0, 0] });
      wrap.computeWorldMatrix(true);
      const c0 = ctx.colliders.length;
      const e0 = ctx.exhibits.length;
      const r = build(wrap);
      for (const c of [...ctx.colliders.slice(c0), ...r.colliders]) {
        if (offsetDone.has(c)) continue;
        offsetDone.add(c);
        c.x += dx;
      }
      for (const e of ctx.exhibits.slice(e0)) {
        e.pos = [e.pos[0] + dx, e.pos[1]];
        e.region = shiftRegion(e.region, dx);
      }
      return r;
    };
    const game = placed(WEST_DX, (p) => buildGameRoom(ctx, p, { input, psRef }));
    const museum = placed(EAST_DX, (p) => buildMuseum(ctx, p));
    const history = placed(WEST_DX, (p) => buildHistoryRoom(ctx, p));
    const tech = placed(EAST_DX, (p) => buildTechRoom(ctx, p));
    const testimonials = placed(EAST_DX, (p) => buildTestimonialsRoom(ctx, p));
    const ach = placed(WEST_DX, (p) => buildAchievementsRoom(ctx, p));
    const city = buildCity(ctx, root);
    buildAmbience(ctx);
    createWorkSystem(ctx, { input, workRef });
    createExhibitSystem(ctx, { input, exhibitRef });
    ctx.colliders.push(...room.colliders, ...game.colliders, ...museum.colliders, ...history.colliders, ...tech.colliders, ...testimonials.colliders, ...ach.colliders);
    const anchors: Anchor[] = room.anchors;
    const modelReady = buildCharacter(ctx, root, { input, accentRef, flightRef });
    buildCameraRig(ctx, { input, teleportRef, introRef });
    ctx.afterBuild.forEach((fn) => fn());
    // static batching of every room's plain geometry (see staticMerge.ts)
    for (const r of [room.root, hall.root, home, game.root, museum.root, history.root, tech.root, testimonials.root, ach.root]) mergeStatic(ctx, r);
    criticalLoads.end();
    setBuilt({ ctx, anchors });
    // dev-only handle for poking at the world from the console / automated screenshots
    if (process.env.NODE_ENV !== "production" || new URLSearchParams(location.search).has("debug")) (window as unknown as { __world?: unknown }).__world = { ctx, input, engine, loadContainer };
    modelReady.catch((e) => {
      console.error("Character failed to load", e);
    });

    // Rooms far from the player are switched off entirely (no draw calls, no shadow casting).
    const gated: { node: TransformNode; region: Region }[] = [
      { node: room.root, region: OFFICE_REGION },
      { node: game.root, region: PLACED.game },
      { node: museum.root, region: PLACED.museum },
      { node: history.root, region: PLACED.history },
      { node: tech.root, region: PLACED.tech },
      { node: testimonials.root, region: PLACED.testimonials },
      { node: ach.root, region: PLACED.achievements },
      { node: city.root, region: GROUNDS_REGION },
      { node: hall.root, region: HALL },
      { node: home, region: HOME_BOX },
    ];
    let gateClock = 0;
    ctx.onFrame((dt) => {
      gateClock -= dt;
      if (gateClock > 0) return;
      gateClock = 0.25;
      const { x, z } = ctx.player;
      // Standing in the central hall you can look down it through any open door: keep every themed
      // room on (otherwise a far one shows the sky through its doorway). The bedroom and kitchen are
      // seen through their windows from the front yard too.
      const inHall = x > HALL.x0 - 0.5 && x < HALL.x1 + 0.5 && z > HALL.z0 - 1 && z < HALL.z1 + 1.5;
      const doorOf = new Map<TransformNode, [number, number]>([
        [game.root, [HALL.x0, 11]], [history.root, [HALL.x0, 20]], [ach.root, [HALL.x0, 29]],
        [museum.root, [HALL.x1, 11]], [tech.root, [HALL.x1, 20]], [testimonials.root, [HALL.x1, 29]],
      ]);
      for (const g of gated) {
        const door = doorOf.get(g.node);
        if (inHall && door && doors.isOpenAt(door[0], door[1])) {
          if (!g.node.isEnabled(false)) g.node.setEnabled(true);
          continue;
        }
        if (g.node === home) {
          // also seen through the front windows from the yard
          const fromYard = z > FRONT_Z && z < FRONT_Z + 10 && x > -16 && x < 21;
          const nearRooms = x > g.region.x0 - 4 && x < g.region.x1 + 4 && z > g.region.z0 - 4 && z < g.region.z1 + 4;
          if (g.node.isEnabled(false) !== (fromYard || nearRooms)) g.node.setEnabled(fromYard || nearRooms);
          continue;
        }
        const margin = g.node === city.root ? 14 : 9;
        const near = x > g.region.x0 - margin && x < g.region.x1 + margin && z > g.region.z0 - margin && z < g.region.z1 + margin;
        if (g.node.isEnabled(false) !== near) g.node.setEnabled(near);
      }
    });

    // Adaptive resolution: if the frame rate sags below ~60, render fewer pixels; recover when there is headroom.
    const baseScale = 1 / Math.min(Math.max(window.devicePixelRatio || 1, 1), lowPower ? 1 : 1.5);
    let scale = baseScale;
    let qualityClock = 2;
    ctx.onFrame((dt) => {
      qualityClock -= dt;
      if (qualityClock > 0 || document.hidden) return;
      qualityClock = 1.2;
      const fps = engine.getFps();
      let next = scale;
      // (never below ~75% resolution: lower than that the picture visibly goes soft)
      if (fps < 56 && scale < Math.max(1, baseScale) * 1.3) next = scale * 1.08;
      else if (fps > 59 && scale > baseScale) next = Math.max(baseScale, scale / 1.05);
      if (next !== scale) {
        scale = next;
        engine.setHardwareScalingLevel(scale);
      }
    });

    engine.runRenderLoop(() => {
      if (!psRef.current.playing) scene.render();
    });
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      engine.stopRenderLoop();
      setBuilt(null);
      scene.dispose();
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none", outline: "none" }} />
      <div ref={overlayRef} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
      {built &&
        built.anchors.map((a, i) => {
          const { ctx } = built;
          switch (a.kind) {
            case "panel":
              return <FloatingInfoPanel key={i} ctx={ctx} node={a.node} eyebrow={a.eyebrow} title={a.title} lines={a.lines} accent={a.accent} factor={a.factor} />;
            default:
              return null;
          }
        })}
    </div>
  );
}
