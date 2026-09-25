import type { Node } from "@babylonjs/core";
import { instantiate } from "./assets";
import { staticLight, type Ctx } from "./core";

export const LAMP_FILE = "lamp.glb";

/** A real pendant-lamp model hanging from the ceiling plus the light it casts. */
export function addPendant(ctx: Ctx, parent: Node, x: number, z: number, ceilY: number, color: string, intensity: number, range: number) {
  instantiate(ctx, LAMP_FILE, parent, { pos: [x, ceilY, z], scale: 4.5 }).catch((e) => console.error("lamp", e));
  staticLight(ctx, parent, [x, ceilY - 0.9, z], color, intensity, range);
}
