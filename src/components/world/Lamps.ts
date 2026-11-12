import type { Node } from "@babylonjs/core";
import { instantiate } from "./assets";
import { staticLight, type Ctx } from "./core";

/** Real ceiling-light models (Poly Haven, metres; origin at the floor, so they are hung by their top). */
const PENDANT = { file: "ceiling-lamp.glb", top: 1.17 };
const CHANDELIER = { file: "chandelier.glb", top: 0.91 };

function hang(ctx: Ctx, parent: Node, kind: { file: string; top: number }, x: number, z: number, ceilY: number, scale: number) {
  instantiate(ctx, kind.file, parent, { pos: [x, ceilY - kind.top * scale, z], scale, background: true })
    .then((h) => {
      for (const m of h.getChildMeshes()) m.isPickable = false;
    })
    .catch((e) => console.error("lamp", e));
}

/** A pendant ceiling lamp plus the light it casts. */
export function addPendant(ctx: Ctx, parent: Node, x: number, z: number, ceilY: number, color: string, intensity: number, range: number) {
  hang(ctx, parent, PENDANT, x, z, ceilY, 0.9);
  staticLight(ctx, parent, [x, ceilY - 0.9, z], color, intensity, range);
}

/** A crystal chandelier for the big rooms. */
export function addChandelier(ctx: Ctx, parent: Node, x: number, z: number, ceilY: number, color: string, intensity: number, range: number) {
  hang(ctx, parent, CHANDELIER, x, z, ceilY, 1.3);
  staticLight(ctx, parent, [x, ceilY - 0.9, z], color, intensity, range);
}
