import { Texture, type Node } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import type { PsSignal } from "./psSignal";
import type { WorldInput } from "./WorldInputContext";
import { ROOM_H } from "./Room";
import { instantiate } from "./assets";
import { addPendant } from "./Lamps";
import { box, canvasTexture, cylinder, group, lit, plane, staticLight, setEuler, sphere, unlit, type Ctx, type Region } from "./core";

export const GAME_X0 = -10;
export const GAME_X1 = 1.3;
export const GAME_Z0 = 6.2;
export const GAME_Z1 = 15.8;
export const GAME_REGION: Region = { x0: GAME_X0, x1: GAME_X1, z0: GAME_Z0, z1: GAME_Z1 };

const WALL_X = GAME_X0 - 0.1;
const CZ = 11; // room's centre line (door + TV)
const CONSOLE = { x: -8.7, z: 12.4 };
const T = 0.2;

function tvTexture(ctx: Ctx) {
  return canvasTexture(ctx, 512, 300, (g) => {
    const grd = g.createLinearGradient(0, 0, 512, 300);
    grd.addColorStop(0, "#0b1a4a");
    grd.addColorStop(1, "#4a1f8a");
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 300);
    g.strokeStyle = "rgba(255,255,255,0.12)";
    g.lineWidth = 40;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(-40, 180 + i * 40);
      g.bezierCurveTo(140, 60 + i * 30, 300, 300, 560, 90 + i * 40);
      g.stroke();
    }
    g.fillStyle = "#ffffff";
    g.font = "bold 78px sans-serif";
    g.textAlign = "center";
    g.fillText("PlayStation", 256, 150);
    g.font = "26px sans-serif";
    g.fillText("F — play", 256, 210);
  });
}

export function buildGameRoom(
  ctx: Ctx,
  parent: Node,
  deps: { input: MutableRefObject<WorldInput>; psRef: MutableRefObject<PsSignal> }
) {
  const { input, psRef } = deps;
  const root = group(ctx, { parent });
  const colliders: { x: number; z: number; hx: number; hz: number }[] = [];
  const midX = (GAME_X0 + GAME_X1) / 2;
  const midZ = (GAME_Z0 + GAME_Z1) / 2;
  const wall = lit(ctx, { color: "#3a4060", rough: 0.9 });
  const dark = lit(ctx, { color: "#15171f", rough: 0.5, metal: 0.4 });
  const white = lit(ctx, { color: "#f2f4f8", rough: 0.35 });

  // shell
  box(ctx, GAME_X1 - GAME_X0, 0.1, GAME_Z1 - GAME_Z0, { parent: root, pos: [midX, -0.05, midZ], receive: true, mat: lit(ctx, { color: "#2a2d3a", rough: 0.55 }) });
  box(ctx, GAME_X1 - GAME_X0, 0.1, GAME_Z1 - GAME_Z0, { parent: root, pos: [midX, ROOM_H + 0.05, midZ], mat: lit(ctx, { color: "#1b1e2b", rough: 0.95 }) });
  box(ctx, T, ROOM_H, GAME_Z1 - GAME_Z0, { parent: root, pos: [WALL_X, ROOM_H / 2, midZ], receive: true, mat: wall });
  box(ctx, GAME_X1 - GAME_X0, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, GAME_Z0 - T / 2], receive: true, mat: wall });
  box(ctx, GAME_X1 - GAME_X0, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, GAME_Z1 + T / 2], receive: true, mat: wall });
  box(ctx, 0.05, 0.14, GAME_Z1 - GAME_Z0, { parent: root, pos: [GAME_X0 + 0.03, 0.07, midZ], mat: dark });

  // ---- TV + cabinet on the far (west) wall
  const cab = group(ctx, { parent: root, pos: [GAME_X0 + 0.45, 0, CZ] });
  box(ctx, 0.7, 0.5, 3.4, { parent: cab, pos: [0, 0.25, 0], cast: true, receive: true, mat: lit(ctx, { color: "#2f2f3a", rough: 0.5 }) });
  box(ctx, 0.05, 0.85, 1.55, { parent: cab, pos: [-0.05, 0.93, 0], cast: true, mat: dark });
  plane(ctx, 1.45, 0.77, { parent: cab, pos: [-0.019, 0.93, 0], rot: [0, Math.PI / 2, 0], mat: unlit(ctx, { map: tvTexture(ctx), opaque: true, fog: false, double: true }) });
  box(ctx, 0.2, 0.05, 0.6, { parent: cab, pos: [0.05, 0.53, 0], mat: dark });
  colliders.push({ x: GAME_X0 + 0.45, z: CZ, hx: 0.4, hz: 1.7 });

  // speakers
  for (const dz of [-1.9, 1.9]) box(ctx, 0.3, 1.1, 0.3, { parent: cab, pos: [-0.05, 0.55, dz], cast: true, mat: dark });

  // PlayStation console (white shell + black core) + controller
  const ps = group(ctx, { parent: root, pos: [GAME_X0 + 0.45, 0.5, CZ + 1.35] });
  box(ctx, 0.14, 0.42, 0.34, { parent: ps, pos: [0, 0.21, 0], mat: dark });
  box(ctx, 0.05, 0.42, 0.36, { parent: ps, pos: [0.08, 0.21, 0], mat: white });
  box(ctx, 0.05, 0.42, 0.36, { parent: ps, pos: [-0.08, 0.21, 0], mat: white });
  const led = lit(ctx, { color: "#6ab0ff", emissive: "#3f8cff", ei: 2.4 });
  box(ctx, 0.02, 0.3, 0.02, { parent: ps, pos: [0.108, 0.21, 0], mat: led });
  const pad = group(ctx, { parent: root, pos: [GAME_X0 + 0.65, 0.53, CZ - 0.9], rot: [0, 0.4, 0] });
  box(ctx, 0.2, 0.05, 0.13, { parent: pad, mat: white });
  box(ctx, 0.05, 0.05, 0.1, { parent: pad, pos: [-0.08, 0, 0.08], mat: white });
  box(ctx, 0.05, 0.05, 0.1, { parent: pad, pos: [0.08, 0, 0.08], mat: white });
  // LED strip behind the cabinet
  box(ctx, 0.03, 0.04, 3.6, { parent: root, pos: [GAME_X0 + 0.03, 0.9, CZ], mat: lit(ctx, { color: "#7a4dff", emissive: "#7a4dff", ei: 2.4 }) });

  // ---- framed portrait hanging above the TV
  const fr = group(ctx, { parent: root, pos: [GAME_X0 + 0.04, 2.3, CZ], rot: [0, Math.PI / 2, 0] });
  const gold = lit(ctx, { color: "#c9a24a", rough: 0.3, metal: 0.85 });
  const S = 1.15;
  const B = 0.16;
  box(ctx, S + B * 2, B, 0.1, { parent: fr, pos: [0, (S + B) / 2, 0], cast: true, mat: gold });
  box(ctx, S + B * 2, B, 0.1, { parent: fr, pos: [0, -(S + B) / 2, 0], cast: true, mat: gold });
  box(ctx, B, S, 0.1, { parent: fr, pos: [(S + B) / 2, 0, 0], cast: true, mat: gold });
  box(ctx, B, S, 0.1, { parent: fr, pos: [-(S + B) / 2, 0, 0], cast: true, mat: gold });
  box(ctx, S + 0.04, S + 0.04, 0.03, { parent: fr, pos: [0, 0, -0.03], mat: lit(ctx, { color: "#f4efe2", rough: 0.9 }) });
  plane(ctx, S - 0.14, S - 0.14, { parent: fr, pos: [0, 0, 0.001], mat: unlit(ctx, { map: new Texture("/img/abdujalilov-ismoil.jpg", ctx.scene), opaque: true, fog: false, double: true }) });
  // small brass name plaque under the portrait
  const plaque = canvasTexture(ctx, 512, 100, (g) => {
    const grd = g.createLinearGradient(0, 0, 512, 100);
    grd.addColorStop(0, "#e2c46a");
    grd.addColorStop(0.5, "#f6e39a");
    grd.addColorStop(1, "#c9a24a");
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 100);
    g.strokeStyle = "rgba(90,60,10,0.6)";
    g.lineWidth = 4;
    g.strokeRect(6, 6, 500, 88);
    g.fillStyle = "#3a2708";
    g.font = "600 44px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("Abdujalilov Ismoil", 256, 54);
  });
  box(ctx, 0.66, 0.13, 0.035, { parent: fr, pos: [0, -(S / 2 + B + 0.13), 0.0], mat: gold });
  plane(ctx, 0.6, 0.1, { parent: fr, pos: [0, -(S / 2 + B + 0.13), 0.02], mat: unlit(ctx, { map: plaque, opaque: true, fog: false, double: true }) });
  // hanging wires meeting at a nail
  const nailY = S / 2 + B + 0.22;
  sphere(ctx, 0.03, 8, { parent: fr, pos: [0, nailY, -0.02], mat: gold });
  for (const s of [-1, 1]) {
    const dx = 0.5 * s;
    const dy = nailY - (S / 2 + B / 2);
    const len = Math.hypot(dx, dy);
    const cord = box(ctx, 0.012, len, 0.012, { parent: fr, pos: [dx / 2, S / 2 + B / 2 + dy / 2, -0.02], mat: dark });
    setEuler(cord, 0, 0, Math.atan2(dx, dy));
  }
  staticLight(ctx, root, [GAME_X0 + 1.2, 3.0, CZ], "#ffe2b0", 8, 5);

  // ---- real sofa model facing the TV
  instantiate(ctx, "sofa.glb", root, { pos: [-4.7, 0, CZ], rot: [0, -Math.PI / 2, 0], scale: 1.5, cast: true, background: true }).catch((e) => console.error("sofa", e));
  colliders.push({ x: -4.7, z: CZ, hx: 0.75, hz: 1.7 });
  box(ctx, 0.9, 0.05, 1.5, { parent: root, pos: [-6.9, 0.42, CZ], cast: true, mat: lit(ctx, { color: "#3a2a20", rough: 0.5 }) });
  for (const [ax, az] of [[-0.35, -0.65], [0.35, -0.65], [-0.35, 0.65], [0.35, 0.65]]) box(ctx, 0.05, 0.4, 0.05, { parent: root, pos: [-6.9 + ax, 0.2, CZ + az], mat: dark });
  cylinder(ctx, 0.06, 0.05, 0.11, 12, { parent: root, pos: [-6.9, 0.48, CZ + 0.3], mat: lit(ctx, { color: "#e8e8e8", rough: 0.4 }) });
  colliders.push({ x: -6.9, z: CZ, hx: 0.5, hz: 0.8 });
  box(ctx, 5.0, 0.02, 3.6, { parent: root, pos: [-6.6, 0.011, CZ], mat: lit(ctx, { color: "#3b2f6a", rough: 1 }) });

  // ---- lights (pendant lamp models)
  for (const [lx, lz, col] of [[-7, 8.4, "#8a6bff"], [-7, 13.6, "#4d9bff"], [-2.5, 11, "#ffd7f5"]] as [number, number, string][]) addPendant(ctx, root, lx, lz, ROOM_H, col, 30, 12);

  // ---- play interaction
  let lastInteract = input.current.interactId;
  ctx.onFrame(() => {
    const d = Math.hypot(ctx.player.x - (GAME_X0 + 1.4), ctx.player.z - CONSOLE.z + 1.2);
    const near = d < 3.4 && ctx.player.x < GAME_X1 - 0.5;
    psRef.current.near = near && !psRef.current.playing;
    if (input.current.interactId !== lastInteract) {
      lastInteract = input.current.interactId;
      if (near && !psRef.current.playing) {
        psRef.current.playing = true;
        input.current.locked = true;
        const m = input.current.move;
        m.forward = m.backward = m.left = m.right = m.run = false;
        input.current.spaceHeld = false;
      }
    }
  });

  return { colliders, root };
}
