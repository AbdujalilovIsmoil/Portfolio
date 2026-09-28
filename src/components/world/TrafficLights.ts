import type { Node } from "@babylonjs/core";
import { CITY_Y } from "./Stairs";
import { box, cylinder, group, lit, type Ctx } from "./core";

export type LightPhase = "green" | "yellow" | "red";

const GREEN_S = 8;
const YELLOW_S = 2;
const RED_S = 5;
const CYCLE = GREEN_S + YELLOW_S + RED_S;

/** Where through-traffic on the main road must stop for a red light, just
 * short of the avenue crossing (City.ts's AVE_X0/AVE_X1 = 30/40). */
export const STOP_X_PLUS = 27; // eastbound (heading +x) stops here
export const STOP_X_MINUS = 43; // westbound (heading -x) stops here

/** Shared signal state — one phase for the whole crossing (there's no cross
 * traffic modelled yet, so this just gives through-traffic something real to
 * obey rather than a light no one looks at). */
export const trafficLight: { phase: LightPhase; t: number } = { phase: "green", t: 0 };

function buildHead(ctx: Ctx, parent: Node, x: number, z: number, yaw: number) {
  ctx.colliders.push({ x, z, hx: 0.15, hz: 0.15 });
  const root = group(ctx, { parent, pos: [x, CITY_Y, z], rot: [0, yaw, 0] });
  const pole = lit(ctx, { color: "#2a2d33", rough: 0.4, metal: 0.55 });
  cylinder(ctx, 0.07, 0.09, 3.4, 10, { parent: root, pos: [0, 1.7, 0], mat: pole });
  box(ctx, 0.32, 1.0, 0.28, { parent: root, pos: [0, 3.15, 0.1], mat: lit(ctx, { color: "#1a1c20", rough: 0.5 }) });

  const off = lit(ctx, { color: "#2a1010", rough: 0.6 });
  const redOn = lit(ctx, { color: "#ff3b30", emissive: "#ff3b30", ei: 2.2 });
  const yellowOn = lit(ctx, { color: "#ffd23b", emissive: "#ffd23b", ei: 2.2 });
  const greenOn = lit(ctx, { color: "#33d17a", emissive: "#33d17a", ei: 2.2 });
  const red = box(ctx, 0.22, 0.22, 0.05, { parent: root, pos: [0, 3.55, 0.25], mat: off });
  const yellow = box(ctx, 0.22, 0.22, 0.05, { parent: root, pos: [0, 3.15, 0.25], mat: off });
  const green = box(ctx, 0.22, 0.22, 0.05, { parent: root, pos: [0, 2.75, 0.25], mat: off });
  return { red, yellow, green, offMat: off, redOn, yellowOn, greenOn };
}

/** Two signal heads facing the two through lanes on the main road, cycling
 * green → yellow → red like a real light; Traffic.ts reads `trafficLight`
 * to decide whether to stop at STOP_X_PLUS / STOP_X_MINUS. */
export function buildTrafficLights(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const heads = [
    buildHead(ctx, root, STOP_X_PLUS, 55.3, 0), // faces +x traffic approaching the crossing
    buildHead(ctx, root, STOP_X_MINUS, 66.7, Math.PI), // faces -x traffic approaching the crossing
  ];

  const apply = () => {
    for (const h of heads) {
      h.red.material = trafficLight.phase === "red" ? h.redOn : h.offMat;
      h.yellow.material = trafficLight.phase === "yellow" ? h.yellowOn : h.offMat;
      h.green.material = trafficLight.phase === "green" ? h.greenOn : h.offMat;
    }
  };
  apply();

  ctx.onFrame((dt) => {
    trafficLight.t += dt;
    if (trafficLight.t >= CYCLE) trafficLight.t -= CYCLE;
    const phase: LightPhase = trafficLight.t < GREEN_S ? "green" : trafficLight.t < GREEN_S + YELLOW_S ? "yellow" : "red";
    if (phase !== trafficLight.phase) {
      trafficLight.phase = phase;
      apply();
    }
  });

  return root;
}
