import { Color3, PBRMaterial, type DynamicTexture, type Node } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { instantiate, loadContainer, thinCopies } from "./assets";
import { aboutBoard, achievementBoard, arcadeBoard, codeBoard, contactBoard, educationBoard, gateSign, jobBoard, skillsBoard, testimonialBoard, workBoard } from "./billboards";
import { ACHIEVEMENTS, EDUCATION, JOBS, SKILL_GROUPS, TESTIMONIALS, WORKS } from "./content";
import type { AchievementSignal } from "./achievementSignal";
import { formatLap, type DriveSignal } from "./driveSignal";
import type { ExhibitSignal } from "./exhibitSignal";
import type { PsSignal } from "./psSignal";
import { FOOT, standAt } from "./RaceTrack";
import { playChime } from "./sound";
import { SURFACE, TRACK } from "./Track";
import type { WorkSignal } from "./workSignal";
import type { WorldInput } from "./WorldInputContext";
import { DISTRICT_COLORS, DISTRICT_LABELS, GARAGE, GARAGE_PAD_R, ZONES, garageSpots, zoneAt, type Zone } from "./Zones";
import { group, plane, ring, unlit, type Ctx } from "./core";

/** Billboards are the kit's low billboard at this scale: an 11 × 5.5 m face 2–7.6 m up. */
const BOARD = 11;

function textureFor(ctx: Ctx, z: Zone): DynamicTexture {
  switch (z.district) {
    case "about":
      return aboutBoard(ctx);
    case "experience":
      return jobBoard(ctx, JOBS[z.index]);
    case "projects":
      return workBoard(ctx, WORKS[z.index]);
    case "skills":
      return skillsBoard(ctx, SKILL_GROUPS[z.index]);
    case "testimonials":
      return testimonialBoard(ctx, TESTIMONIALS[z.index]);
    case "achievements":
      return achievementBoard(ctx, ACHIEVEMENTS[z.index]);
    case "education":
      return educationBoard(ctx, EDUCATION[z.index]);
    case "contact":
      return contactBoard(ctx);
  }
}

export interface RaceInfoDeps {
  input: MutableRefObject<WorldInput>;
  exhibitRef: MutableRefObject<ExhibitSignal>;
  psRef: MutableRefObject<PsSignal>;
  workRef: MutableRefObject<WorkSignal>;
  achievementRef: MutableRefObject<AchievementSignal>;
  driveRef: MutableRefObject<DriveSignal>;
}

/**
 * The portfolio along the track: a billboard per piece of content, and its card on screen while you
 * are at that billboard (nothing in between; F hides them). Lap times. The two pit garages with the
 * mini-games.
 */
export function buildRaceInfo(ctx: Ctx, parent: Node, deps: RaceInfoDeps) {
  const { input, exhibitRef, psRef, workRef, achievementRef, driveRef } = deps;
  const root = group(ctx, { parent });

  // ---- billboards (the kit's banner turned into a dark frame round our picture)
  loadContainer(ctx, "billboardLow.glb")
    .then((c) => {
      const banner = c.materials.find((m) => m.name === "tankco") as PBRMaterial | undefined;
      if (banner) {
        banner.albedoTexture = null;
        banner.albedoColor = new Color3(0.012, 0.016, 0.035);
      }
    })
    .catch(() => {});
  // (every board is a copy of the one model, drawn together)
  const boards = ZONES.map((z) => {
    const { pos, yaw } = standAt(FOOT.billboardLow, BOARD, z.board.x, z.board.z, z.board.yaw);
    const h = group(ctx, { parent: root, pos, rot: [0, yaw, 0], scale: BOARD });
    // our picture (1.6 : 1) on the kit's 2 : 1 face, which faces −z
    const pic = plane(ctx, 0.8, 0.5, { parent: h, pos: [-0.436, 0.44, -0.047], rot: [0, Math.PI, 0], mat: unlit(ctx, { map: textureFor(ctx, z), opaque: true, double: true }) });
    pic.isPickable = false;
    // a strip of the district's colour under it
    const strip = plane(ctx, 1.0, 0.025, { parent: h, pos: [-0.436, 0.175, -0.047], rot: [0, Math.PI, 0], mat: unlit(ctx, { color: DISTRICT_COLORS[z.district], double: true }) });
    strip.isPickable = false;
    ctx.colliders.push({ x: z.board.x, z: z.board.z, hx: 4.2, hz: 4.2 });
    return { pos, yaw, scale: BOARD };
  });
  thinCopies(ctx, "billboardLow.glb", root, boards, { cast: true, background: true }).catch((e) => console.error("billboard", e));

  // ---- the pit garages: ARCADE and CODE
  const G = garageSpots();
  const garage = (spot: ReturnType<typeof garageSpots>["arcade"], sign: string, color: string, board: DynamicTexture) => {
    const { pos, yaw } = standAt(FOOT.pitsGarage, GARAGE, spot.building.x, spot.building.z, spot.face);
    instantiate(ctx, "pitsGarage.glb", root, { pos, rot: [0, yaw, 0], scale: GARAGE, cast: true, background: true, instanced: true })
      .then((h) => {
        h.getChildMeshes().forEach((m) => (m.isPickable = false));
        const signMat = unlit(ctx, { map: gateSign(ctx, sign, color), opaque: true, double: true });
        plane(ctx, 1, 0.156, { parent: h, pos: [-0.5, 0.622, -0.097], rot: [0, Math.PI, 0], mat: signMat }).isPickable = false;
        // the game's poster at the back of the garage
        plane(ctx, 0.62, 0.3875, { parent: h, pos: [-0.5, 0.25, 0.9], rot: [0, Math.PI, 0], mat: unlit(ctx, { map: board, opaque: true, double: true }) }).isPickable = false;
      })
      .catch((e) => console.error("garage", e));
    ctx.colliders.push({ x: spot.building.x, z: spot.building.z, hx: GARAGE / 2 - 0.5, hz: GARAGE / 2 - 0.5 });
    const padMat = unlit(ctx, { color, opacity: 1, depthWrite: false, double: true, additive: true });
    // (on the asphalt, which is SURFACE up; pulled towards the camera in depth so it never flickers into it)
    padMat.zOffset = -2;
    const pad = ring(ctx, GARAGE_PAD_R - 0.3, GARAGE_PAD_R, 48, { parent: root, pos: [spot.pad.x, SURFACE + 0.02, spot.pad.z], rot: [-Math.PI / 2, 0, 0], mat: padMat });
    pad.isPickable = false;
    return padMat;
  };
  const arcadeMat = garage(G.arcade, "ARCADE", "#ff5d5d", arcadeBoard(ctx));
  const codeMat = garage(G.code, "CODE", "#2ee6c8", codeBoard(ctx));

  // ---- each frame: which card, lap times, the garages
  const drive = driveRef.current;
  const ex = exhibitRef.current;
  let cardsOn = true;
  const L = TRACK.length;
  let prevRel = -1;
  let lapStart: number | null = null;
  let armed = false;
  let lastInteract = input.current.interactId;
  const onPad = (p: { x: number; z: number }) => Math.hypot(ctx.player.x - p.x, ctx.player.z - p.z) < GARAGE_PAD_R + 0.4;
  const openGame = () => {
    ctx.vehicle.speed = 0;
    input.current.locked = true;
    const mv = input.current.move;
    mv.forward = mv.backward = mv.left = mv.right = mv.run = false;
    input.current.spaceHeld = false;
    input.current.joystick = { x: 0, y: 0 };
  };
  const toast = (icon: string, label: string, title: string) => {
    const a = achievementRef.current;
    a.icon = icon;
    a.label = label;
    a.title = title;
    a.value++;
  };

  ctx.onFrame((_, t) => {
    // where the car is along the lap (the walls keep it on the track)
    const s = ctx.vehicle.s;
    const onTrack = true;

    // the card of the billboard you are at, if you are at one (it keeps its content while it fades out)
    const at = zoneAt(s);
    const atArcade = onPad(G.arcade.pad);
    const atCode = onPad(G.code.pad);
    // (not while going round the loop: that's the show)
    const show = !!at && cardsOn && !input.current.locked && !atArcade && !atCode && ctx.vehicle.loop < 0;
    ex.near = false;
    ex.footer = "F — hide the cards";
    ex.open = show;
    if (at) {
      const z = at.zone;
      ex.item = z.info;
      ex.color = DISTRICT_COLORS[z.district];
      ex.label = DISTRICT_LABELS[z.district];
      ex.counter = [z.n, ZONES.length];
      ex.progress = at.k;
      if (show && !drive.visited.has(z.id)) {
        drive.visited.add(z.id);
        if (drive.visited.size === ZONES.length) toast("🏁", "You have seen it all", "Every card on the track");
      }
    }

    // lap times: a lap counts from the start line round to it again
    const rel = (s - TRACK.startS + L) % L;
    if (prevRel >= 0 && onTrack) {
      if (rel > L * 0.3 && rel < L * 0.7) armed = true;
      const crossedForward = prevRel > L * 0.9 && rel < L * 0.1;
      const crossedBack = prevRel < L * 0.1 && rel > L * 0.9;
      if (crossedForward) {
        if (lapStart !== null && armed) {
          const lap = t - lapStart;
          drive.laps++;
          drive.lastLap = lap;
          const best = drive.bestLap === null || lap < drive.bestLap;
          if (best) drive.bestLap = lap;
          toast(best ? "🏆" : "⏱", best ? `Lap ${drive.laps} · best lap!` : `Lap ${drive.laps}`, formatLap(lap));
          playChime();
        }
        lapStart = t;
        armed = false;
      } else if (crossedBack) {
        armed = false;
      }
    }
    prevRel = rel;
    drive.lapTime = lapStart === null ? null : t - lapStart;

    // the mini-games
    const ps = psRef.current;
    const work = workRef.current;
    ps.near = atArcade && !ps.playing;
    work.near = atCode && !work.open;
    const pulse = 0.65 + 0.35 * Math.sin(t * 3);
    arcadeMat.alpha = atArcade ? 1 : pulse;
    codeMat.alpha = atCode ? 1 : pulse;
    if (input.current.interactId !== lastInteract) {
      lastInteract = input.current.interactId;
      if (input.current.locked) return;
      if (atArcade && !ps.playing) {
        openGame();
        ps.playing = true;
      } else if (atCode && !work.open) {
        openGame();
        work.open = true;
        document.exitPointerLock?.();
      } else {
        cardsOn = !cardsOn;
      }
    }
  });

  return { root };
}
