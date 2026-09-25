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
import { buildGameRoom, GAME_REGION } from "./GameRoom";
import { buildMuseum, MUSEUM_REGION } from "./Museum";
import { buildHistoryRoom, HISTORY_REGION } from "./HistoryRoom";
import { createExhibitSystem } from "./Exhibits";
import { createWorkSystem } from "./WorkSystem";
import type { WorkSignal } from "./workSignal";
import { buildTechRoom, TECH_REGION } from "./TechRoom";
import { buildTestimonialsRoom, TEST_REGION } from "./TestimonialsRoom";
import { buildAchievementsRoom, ACH_REGION } from "./AchievementsRoom";
import { buildCity, CITY_REGION } from "./City";
import { buildVehicles } from "./Vehicle";
import { OFFICE_REGION, WALK_REGIONS } from "./regions";
import { buildStairs, groundY } from "./Stairs";
import type { ExhibitSignal } from "./exhibitSignal";
import type { PsSignal } from "./psSignal";
import { buildCorridor } from "./Corridor";
import { createDoorSystem } from "./Doors";
import type { DoorSignal } from "./doorSignal";
import { LIGHT_SCALE, group, linear, type Anchor, type Ctx, type Region } from "./core";
import { getIsLowPowerDevice } from "./performanceTier";
import { criticalLoads } from "./assets";
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
    engine.setHardwareScalingLevel(1 / Math.min(Math.max(window.devicePixelRatio || 1, 1), lowPower ? 1 : 1.25));

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
      shadow.bias = 0.0008;
      shadow.normalBias = 0.02;
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
    // Daylight outdoors: bright warm sun from the south, stronger sky light.
    let day = 0;
    const indoorDir = new Vector3(-0.3, -1, -0.2).normalize();
    const outDir = new Vector3(0.35, -0.5, -0.65).normalize();
    ctx.onFrame((dt) => {
      const goal = ctx.player.z > 47 ? 1 : 0;
      day += (goal - day) * Math.min(1, dt * 3);
      sun.intensity = (0.8 + 3.4 * day) * LIGHT_SCALE;
      hemi.intensity = (1.0 + 1.6 * day) * LIGHT_SCALE;
      ambient.intensity = (0.45 + 0.5 * day) * LIGHT_SCALE;
      Vector3.LerpToRef(indoorDir, outDir, day, sun.direction);
      sun.direction.normalize();
      sun.diffuse.set(1, 1 - 0.08 * day, 1 - 0.28 * day);
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
      const ranked = ctx.lights.map((l) => ({ l, d: Vector3.DistanceSquared(l.pos, p) })).sort((a, b) => a.d - b.d);
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
    buildCorridor(ctx, root, doors);
    buildStairs(ctx, root, doors);
    const game = buildGameRoom(ctx, root, { input, psRef });
    const museum = buildMuseum(ctx, root);
    const history = buildHistoryRoom(ctx, root);
    const tech = buildTechRoom(ctx, root);
    const testimonials = buildTestimonialsRoom(ctx, root);
    const ach = buildAchievementsRoom(ctx, root);
    const city = buildCity(ctx, root);
    buildVehicles(ctx, root, city, { input, doorRef });
    createWorkSystem(ctx, { input, workRef });
    createExhibitSystem(ctx, { input, exhibitRef });
    ctx.colliders.push(...room.colliders, ...game.colliders, ...museum.colliders, ...history.colliders, ...tech.colliders, ...testimonials.colliders, ...ach.colliders);
    const anchors: Anchor[] = room.anchors;
    const modelReady = buildCharacter(ctx, root, { input, accentRef, flightRef });
    buildCameraRig(ctx, { input, teleportRef, introRef });
    ctx.afterBuild.forEach((fn) => fn());
    criticalLoads.end();
    setBuilt({ ctx, anchors });
    modelReady.catch((e) => {
      console.error("Character failed to load", e);
    });

    // Rooms far from the player are switched off entirely (no draw calls, no shadow casting).
    const gated: { node: TransformNode; region: Region }[] = [
      { node: room.root, region: OFFICE_REGION },
      { node: game.root, region: GAME_REGION },
      { node: museum.root, region: MUSEUM_REGION },
      { node: history.root, region: HISTORY_REGION },
      { node: tech.root, region: TECH_REGION },
      { node: testimonials.root, region: TEST_REGION },
      { node: ach.root, region: ACH_REGION },
      { node: city.root, region: CITY_REGION },
    ];
    let gateClock = 0;
    ctx.onFrame((dt) => {
      gateClock -= dt;
      if (gateClock > 0) return;
      gateClock = 0.25;
      const { x, z } = ctx.player;
      for (const g of gated) {
        const margin = g.node === city.root ? 14 : 9;
        const near = x > g.region.x0 - margin && x < g.region.x1 + margin && z > g.region.z0 - margin && z < g.region.z1 + margin;
        if (g.node.isEnabled(false) !== near) g.node.setEnabled(near);
      }
    });

    // Adaptive resolution: if the frame rate sags below ~60, render fewer pixels; recover when there is headroom.
    const baseScale = 1 / Math.min(Math.max(window.devicePixelRatio || 1, 1), lowPower ? 1 : 1.25);
    let scale = baseScale;
    let qualityClock = 2;
    ctx.onFrame((dt) => {
      qualityClock -= dt;
      if (qualityClock > 0 || document.hidden) return;
      qualityClock = 1.2;
      const fps = engine.getFps();
      let next = scale;
      if (fps < 54 && scale < baseScale * 1.8) next = scale * 1.1;
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
