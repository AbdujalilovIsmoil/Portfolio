import type { MutableRefObject } from "react";
import type { ExhibitSignal } from "./exhibitSignal";
import type { WorldInput } from "./WorldInputContext";
import { inRegions, type Ctx } from "./core";

/** One shared "press F to read about it" system for every gallery room. */
export function createExhibitSystem(ctx: Ctx, deps: { input: MutableRefObject<WorldInput>; exhibitRef: MutableRefObject<ExhibitSignal> }) {
  const { input, exhibitRef } = deps;
  let lastInteract = input.current.interactId;
  ctx.onFrame(() => {
    const px = ctx.player.x;
    const pz = ctx.player.z;
    let best: (typeof ctx.exhibits)[number] | null = null;
    let bd = Infinity;
    for (const e of ctx.exhibits) {
      if (!inRegions([e.region], px, pz, 0)) continue;
      const d = Math.hypot(px - e.pos[0], pz - e.pos[1]);
      if (d < e.radius && d < bd) {
        bd = d;
        best = e;
      }
    }
    const sig = exhibitRef.current;
    sig.near = !!best && !input.current.locked;
    if ((best?.info ?? null) !== sig.item) sig.open = false;
    sig.item = best ? best.info : null;
    if (input.current.interactId !== lastInteract) {
      lastInteract = input.current.interactId;
      if (best && !input.current.locked) sig.open = !sig.open;
    }
  });
}
