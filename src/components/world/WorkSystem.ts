import type { MutableRefObject } from "react";
import { WORK_SPOTS } from "./Room";
import type { WorkSignal } from "./workSignal";
import type { WorldInput } from "./WorldInputContext";
import type { Ctx } from "./core";

/** Press F next to any office computer to open the CSS exercises. */
export function createWorkSystem(ctx: Ctx, deps: { input: MutableRefObject<WorldInput>; workRef: MutableRefObject<WorkSignal> }) {
  const { input, workRef } = deps;
  let last = input.current.interactId;
  ctx.onFrame(() => {
    const sig = workRef.current;
    const p = ctx.player;
    const inOffice = p.z < 5 && Math.abs(p.x) < 7;
    const near = inOffice && !sig.open && WORK_SPOTS.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 1.7);
    sig.near = near;
    if (input.current.interactId !== last) {
      last = input.current.interactId;
      if (near && !input.current.locked) {
        sig.open = true;
        input.current.locked = true;
        const m = input.current.move;
        m.forward = m.backward = m.left = m.right = m.run = false;
        input.current.spaceHeld = false;
        document.exitPointerLock?.();
      }
    }
  });
}
