import type { MutableRefObject } from "react";
import type { Node } from "@babylonjs/core";
import { box, canvasTexture, cylinder, group, lerp, lit, plane, setEuler, unlit, type Ctx } from "./core";
import type { DoorSignal } from "./doorSignal";
import type { WorldInput } from "./WorldInputContext";

export const DOOR_W = 1.4;
const DOOR_H = 2.3;

interface DoorInst {
  x: number;
  z: number;
  open: number;
  want: boolean;
  col: { x: number; z: number; hx: number; hz: number };
  blocking: boolean;
}

export interface DoorSystem {
  add(o: { parent: Node; y?: number; hinge: [number, number]; dir: [number, number]; side: 1 | -1; color?: string; label?: string; recess?: boolean }): void;
}

/**
 * Real-looking panelled doors that open with E when you stand next to them.
 * `dir` is the wall direction the leaf lies along when shut; `side` picks which
 * way it swings (+1 = towards the leaf's local +Z).
 */
export function createDoorSystem(ctx: Ctx, deps: { input: MutableRefObject<WorldInput>; doorRef: MutableRefObject<DoorSignal> }): DoorSystem {
  const { input, doorRef } = deps;
  const doors: (DoorInst & { hinge: ReturnType<typeof group>; swing: ReturnType<typeof group>; side: number })[] = [];
  let lastId = input.current.doorId;

  ctx.onFrame((dt) => {
    let best: (typeof doors)[number] | null = null;
    let bd = ctx.vehicle.driving ? 0 : 2.1;
    doorRef.current.label = undefined;
    for (const d of doors) {
      const dist = Math.hypot(ctx.player.x - d.x, ctx.player.z - d.z);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    doorRef.current.near = !!best && !input.current.locked;
    doorRef.current.open = !!best && best.want;
    if (input.current.doorId !== lastId) {
      lastId = input.current.doorId;
      // never slam a door shut while someone is standing in it
      if (best && !input.current.locked && !(best.want && Math.hypot(ctx.player.x - best.x, ctx.player.z - best.z) < 1.2)) best.want = !best.want;
    }
    for (const d of doors) {
      const goal = d.want ? 1 : 0;
      if (Math.abs(d.open - goal) < 0.0005 && d.open === goal) continue;
      d.open = Math.abs(d.open - goal) < 0.001 ? goal : lerp(d.open, goal, 1 - Math.pow(0.03, dt));
      // a closed (or still swinging) door is a solid wall; once it is open enough you can pass
      const shouldBlock = d.open < 0.6;
      if (shouldBlock !== d.blocking) {
        d.blocking = shouldBlock;
        if (shouldBlock) ctx.colliders.push(d.col);
        else {
          const at = ctx.colliders.indexOf(d.col);
          if (at >= 0) ctx.colliders.splice(at, 1);
        }
      }
      const inner = d.swing;
      setEuler(inner, 0, -d.side * d.open * (Math.PI / 2) * 0.96, 0);
    }
  });

  return {
    add({ parent, y = 0, hinge: [hx, hz], dir, side, color = "#7a5637", label, recess }) {
      const base = group(ctx, { parent, pos: [hx, y, hz], rot: [0, Math.atan2(-dir[1], dir[0]), 0] });
      const swing = group(ctx, { parent: base });
      const wood = lit(ctx, { color, rough: 0.5 });
      const metal = lit(ctx, { color: "#c8c8cc", rough: 0.25, metal: 0.9 });
      const frame = lit(ctx, { color: "#f0efe9", rough: 0.55 });
      const W = DOOR_W;
      // leaf + raised panels on both faces
      box(ctx, W - 0.04, DOOR_H, 0.05, { parent: swing, pos: [W / 2, DOOR_H / 2, 0], cast: true, mat: wood });
      for (const f of [-1, 1]) {
        for (const py of [0.6, 1.72]) {
          box(ctx, W - 0.4, 0.75, 0.014, { parent: swing, pos: [W / 2, py, f * 0.03], mat: lit(ctx, { color, rough: 0.35 }) });
        }
        box(ctx, W - 0.4, 0.4, 0.014, { parent: swing, pos: [W / 2, 1.16, f * 0.03], mat: lit(ctx, { color, rough: 0.35 }) });
        // lever handle
        cylinder(ctx, 0.02, 0.02, 0.06, 10, { parent: swing, pos: [W - 0.12, 1.05, f * 0.06], rot: [Math.PI / 2, 0, 0], mat: metal });
        box(ctx, 0.13, 0.025, 0.025, { parent: swing, pos: [W - 0.2, 1.05, f * 0.09], mat: metal });
      }
      // hinges
      for (const hy of [0.25, 1.15, 2.05]) cylinder(ctx, 0.018, 0.018, 0.12, 8, { parent: swing, pos: [0.005, hy, 0], mat: metal });

      // architrave on both sides of the wall + jamb
      for (const f of [-1, 1]) {
        box(ctx, 0.1, DOOR_H + 0.1, 0.04, { parent: base, pos: [-0.07, (DOOR_H + 0.1) / 2, f * 0.13], mat: frame });
        box(ctx, 0.1, DOOR_H + 0.1, 0.04, { parent: base, pos: [W + 0.07, (DOOR_H + 0.1) / 2, f * 0.13], mat: frame });
        box(ctx, W + 0.24, 0.1, 0.04, { parent: base, pos: [W / 2, DOOR_H + 0.05, f * 0.13], mat: frame });
      }
      box(ctx, 0.04, DOOR_H, 0.3, { parent: base, pos: [-0.02, DOOR_H / 2, 0], mat: frame });
      box(ctx, 0.04, DOOR_H, 0.3, { parent: base, pos: [W + 0.02, DOOR_H / 2, 0], mat: frame });
      box(ctx, W, 0.04, 0.3, { parent: base, pos: [W / 2, DOOR_H + 0.02, 0], mat: frame });

      if (recess) {
        // an unfinished, dark room behind the door
        const sign = canvasTexture(ctx, 256, 96, (g) => {
          g.fillStyle = "#0c0e14";
          g.fillRect(0, 0, 256, 96);
          g.fillStyle = "#9bb4ff";
          g.font = "bold 34px sans-serif";
          g.textAlign = "center";
          g.fillText(label ?? "Coming soon…", 128, 58);
        });
        const r = group(ctx, { parent: base, pos: [W / 2, 0, side * 0.9] });
        box(ctx, W, DOOR_H, 0.05, { parent: r, pos: [0, DOOR_H / 2, side * 0.6], mat: lit(ctx, { color: "#0b0d13", rough: 1 }) });
        plane(ctx, 1.0, 0.38, { parent: r, pos: [0, 1.5, side * 0.57], rot: [0, side > 0 ? Math.PI : 0, 0], mat: unlit(ctx, { map: sign, opaque: true, fog: false, double: true }) });
        box(ctx, W, 0.02, 1.4, { parent: r, pos: [0, 0.01, side * -0.1], mat: lit(ctx, { color: "#15181f", rough: 1 }) });
      }

      // door centre in world space (for the proximity test)
      const cx = hx + dir[0] * (W / 2) + 0;
      const cz = hz + dir[1] * (W / 2);
      const col = { x: cx, z: cz, hx: Math.abs(dir[0]) > 0.5 ? W / 2 : 0.12, hz: Math.abs(dir[0]) > 0.5 ? 0.12 : W / 2 };
      ctx.colliders.push(col);
      doors.push({ x: cx, z: cz, open: 0, want: false, hinge: base, swing, side, col, blocking: true });
    },
  };
}
