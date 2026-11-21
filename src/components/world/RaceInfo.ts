import { Color3, PBRMaterial, type DynamicTexture, type Node } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { loadContainer, thinCopies } from "./assets";
import { aboutBoard, achievementBoard, contactBoard, educationBoard, jobBoard, skillsBoard, testimonialBoard, workBoard } from "./billboards";
import { ACHIEVEMENTS, EDUCATION, JOBS, SKILL_GROUPS, TESTIMONIALS, WORKS } from "./content";
import type { AchievementSignal } from "./achievementSignal";
import { formatLap, type DriveSignal } from "./driveSignal";
import type { ExhibitSignal } from "./exhibitSignal";
import { FOOT, standAt } from "./RaceTrack";
import { playChime } from "./sound";
import { LapClock } from "./laps";
import { TRACK } from "./Track";
import type { WorldInput } from "./WorldInputContext";
import { DISTRICT_COLORS, DISTRICT_LABELS, getZones, zoneAt, type Zone } from "./Zones";
import { group, plane, unlit, type Ctx } from "./core";

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
  achievementRef: MutableRefObject<AchievementSignal>;
  driveRef: MutableRefObject<DriveSignal>;
}

/**
 * Free drive: the portfolio along the Grand Circuit — a billboard per piece of content, and its card
 * on screen while you are at that billboard (nothing in between; F hides them) — and lap times.
 */
export function buildRaceInfo(ctx: Ctx, parent: Node, deps: RaceInfoDeps) {
  const { input, exhibitRef, achievementRef, driveRef } = deps;
  const root = group(ctx, { parent });
  const zones = getZones();

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
  const boards = zones.map((z) => {
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
  // the billboards on the minimap
  driveRef.current.markers = zones.map((z) => ({ x: z.board.x, z: z.board.z, color: DISTRICT_COLORS[z.district], id: z.id }));

  // ---- each frame: which card, lap times
  const drive = driveRef.current;
  const ex = exhibitRef.current;
  let cardsOn = true;
  const clock = new LapClock(TRACK.length, TRACK.startS);
  let lastInteract = input.current.interactId;
  const toast = (icon: string, label: string, title: string) => {
    const a = achievementRef.current;
    a.icon = icon;
    a.label = label;
    a.title = title;
    a.value++;
  };

  let t = 0; // (driving time: not while the menu is open)
  ctx.onFrame((dt) => {
    if (!ctx.paused) t += dt;
    // where the car is along the lap (the walls keep it on the track)
    const s = ctx.vehicle.s;

    // the card of the billboard you are at, if you are at one (it keeps its content while it fades out)
    const at = zoneAt(s);
    // (not while going round the loop: that's the show)
    const show = !!at && cardsOn && !input.current.locked && ctx.vehicle.loop < 0;
    ex.near = false;
    ex.footer = "F — hide the cards";
    ex.open = show;
    if (at) {
      const z = at.zone;
      ex.item = z.info;
      ex.color = DISTRICT_COLORS[z.district];
      ex.label = DISTRICT_LABELS[z.district];
      ex.counter = [z.n, zones.length];
      ex.progress = at.k;
      if (show && !drive.visited.has(z.id)) {
        drive.visited.add(z.id);
        if (drive.visited.size === zones.length) toast("🏁", "You have seen it all", "Every card on the track");
      }
    }

    // lap times: a lap counts from the start line round to it again
    const lap = clock.update(s, t);
    if (lap !== null) {
      drive.laps = clock.laps;
      drive.lastLap = lap;
      const best = clock.bestLap === lap;
      drive.bestLap = clock.bestLap;
      toast(best ? "🏆" : "⏱", best ? `Lap ${clock.laps} · best lap!` : `Lap ${clock.laps}`, formatLap(lap));
      playChime();
    }
    drive.lapTime = clock.lapStart === null ? null : t - clock.lapStart;

    // F: the cards on / off
    if (input.current.interactId !== lastInteract) {
      lastInteract = input.current.interactId;
      if (!input.current.locked) cardsOn = !cardsOn;
    }
  });

  return { root };
}
