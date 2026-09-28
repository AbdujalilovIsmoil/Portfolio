import type { Node } from "@babylonjs/core";
import { instantiate } from "./assets";
import { CITY_Y } from "./Stairs";
import { box, cylinder, disc, group, lit, staticLight, unlit, type Ctx } from "./core";

/** A Tashkent TV-Tower-style silhouette: wide base, tapering shaft, an
 * observation-deck "saucer", then a thin mast and spire — instantly reads as
 * a real-world landmark rather than another glass box, and towers over the
 * skyline the way the real Toshkent teleminorasi does over the city. */
function buildTvTower(ctx: Ctx, parent: Node, x: number, z: number) {
  const root = group(ctx, { parent, pos: [x, CITY_Y, z] });
  const concrete = lit(ctx, { color: "#d8d3c8", rough: 0.7 });
  const steel = lit(ctx, { color: "#aeb4bb", rough: 0.35, metal: 0.6 });
  const red = lit(ctx, { color: "#c33", emissive: "#c33", ei: 0.4 });
  const glass = lit(ctx, { color: "#8fb8c9", rough: 0.2, metal: 0.3 });

  // splayed tripod legs rising into the tapered shaft (the real tower's signature)
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    const leg = cylinder(ctx, 0.55, 1.3, 42, 10, { parent: root, mat: concrete });
    leg.position.set(Math.cos(a) * 4.5, 21, Math.sin(a) * 4.5);
    leg.rotation.z = Math.cos(a) * 0.16;
    leg.rotation.x = -Math.sin(a) * 0.16;
  }
  cylinder(ctx, 3.1, 3.6, 4, 16, { parent: root, pos: [0, 42, 0], mat: concrete });
  cylinder(ctx, 1.7, 3.1, 34, 16, { parent: root, pos: [0, 61, 0], mat: concrete });
  // observation-deck saucer
  cylinder(ctx, 8, 6.5, 4.5, 20, { parent: root, pos: [0, 80, 0], mat: steel });
  cylinder(ctx, 8.3, 8.3, 0.4, 20, { parent: root, pos: [0, 82.4, 0], mat: red });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    box(ctx, 1.6, 1.8, 0.06, { parent: root, pos: [Math.cos(a) * 7.9, 80, Math.sin(a) * 7.9], rot: [0, -a, 0], mat: glass });
  }
  cylinder(ctx, 1.1, 1.7, 24, 12, { parent: root, pos: [0, 94, 0], mat: concrete });
  cylinder(ctx, 0.35, 0.9, 16, 10, { parent: root, pos: [0, 114, 0], mat: steel });
  cylinder(ctx, 0.03, 0.3, 8, 6, { parent: root, pos: [0, 124, 0], mat: red });
  staticLight(ctx, root, [0, 125, 0], "#ff3b3b", 4, 6); // aviation warning light
  staticLight(ctx, root, [0, 80, 0], "#ffe6c0", 6, 14);
  return root;
}

/** A bronze equestrian statue on a granite plinth — the Amir Temur Square
 * silhouette every Tashkent local would recognise — built from the horse
 * model already in the asset pack plus procedural stonework. */
function buildEquestrianMonument(ctx: Ctx, parent: Node, x: number, z: number) {
  const root = group(ctx, { parent, pos: [x, CITY_Y, z] });
  const granite = lit(ctx, { color: "#6b6a63", rough: 0.5 });
  const marble = lit(ctx, { color: "#cfcabe", rough: 0.4 });
  const bronze = lit(ctx, { color: "#5a4326", rough: 0.35, metal: 0.75 });

  // Kept small (~5m across) — it sits in the narrow sidewalk strip between the
  // building's front door and the kerb, not out on the open avenue.
  disc(ctx, 2.5, 32, { parent: root, pos: [0, 0.02, 0], rot: [-Math.PI / 2, 0, 0], mat: marble });
  cylinder(ctx, 1.5, 1.65, 0.3, 20, { parent: root, pos: [0, 0.15, 0], mat: granite });
  box(ctx, 1.2, 1.0, 1.0, { parent: root, pos: [0, 0.8, 0], mat: granite });
  box(ctx, 1.5, 0.15, 1.15, { parent: root, pos: [0, 1.38, 0], mat: marble });

  // horse.glb has morph-target geometry that breaks Babylon's automatic bounding-box
  // fit (instantiateFit) — every measurement comes back wrong, sometimes placing a
  // giant, oddly-scaled horse elsewhere in the scene. Its real size, straight from the
  // glTF accessor bounds, is hand-computed here instead of trusting the runtime fit.
  const NATIVE_MIN = { x: -28.5, y: 0.8, z: -187.4 };
  const NATIVE_MAX = { x: 32.6, y: 183.1, z: 134.9 };
  const NATIVE_EXT = Math.max(NATIVE_MAX.x - NATIVE_MIN.x, NATIVE_MAX.y - NATIVE_MIN.y, NATIVE_MAX.z - NATIVE_MIN.z);
  const HORSE_SIZE = 1.9;
  const s = HORSE_SIZE / NATIVE_EXT;
  instantiate(ctx, "horse.glb", root, { pos: [0, 0, 0] }).then((m) => {
    m.scaling.setAll(s);
    m.position.set(-((NATIVE_MIN.x + NATIVE_MAX.x) / 2) * s, 1.45 - NATIVE_MIN.y * s, -((NATIVE_MIN.z + NATIVE_MAX.z) / 2) * s);
    for (const mesh of m.getChildMeshes()) {
      mesh.material = bronze;
      mesh.isPickable = false;
    }
  }).catch(() => {});

  // four low flag posts around the plinth, in the national colours
  const poleMat = lit(ctx, { color: "#2a2d33", rough: 0.4, metal: 0.5 });
  const flagTex = unlit(ctx, { color: "#1eb53a" });
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const px = Math.cos(a) * 2.1;
    const pz = Math.sin(a) * 2.1;
    cylinder(ctx, 0.05, 0.05, 2.2, 8, { parent: root, pos: [px, 1.1, pz], mat: poleMat });
    box(ctx, 0.5, 0.32, 0.02, { parent: root, pos: [px + 0.25, 1.95, pz], rot: [0, -a, 0], mat: flagTex });
  }
  staticLight(ctx, root, [0, 2.6, 0], "#ffe6c0", 5, 8);
  ctx.colliders.push({ x, z, hx: 0.8, hz: 0.7 });
  return root;
}

export function buildLandmarks(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  buildTvTower(ctx, root, 70, 150);
  buildEquestrianMonument(ctx, root, 15, 53.2);
  return root;
}
