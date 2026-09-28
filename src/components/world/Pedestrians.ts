import type { AnimationGroup, Node, TransformNode } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import { CITY_Y } from "./Stairs";
import { group, hash, setEuler, type Ctx } from "./core";

/** Two sidewalk lines, one on each side of the main road (see City.ts's ROAD_Z0/ROAD_Z1). */
const LINES = [51.6, 70.3];
const X0 = -54;
const X1 = 74;

/** Kenney's "Mini Characters" pack (CC0) — six women, six men, each a genuinely
 * different model rather than one rig recoloured. */
const CHAR_FILES = [
  "character-female-a.glb",
  "character-male-a.glb",
  "character-female-b.glb",
  "character-male-b.glb",
  "character-female-c.glb",
  "character-male-c.glb",
  "character-female-d.glb",
  "character-male-d.glb",
  "character-female-e.glb",
  "character-male-e.glb",
  "character-female-f.glb",
  "character-male-f.glb",
];
const COUNT = CHAR_FILES.length;

interface Pedestrian {
  x: number;
  z: number;
  segX0: number;
  segX1: number;
  dir: 1 | -1;
  speed: number;
  model: TransformNode | null;
  col: { x: number; z: number; hx: number; hz: number };
}

/** Twelve passers-by pacing the sidewalks, each a distinct model+animation from
 * Kenney's CC0 "Mini Characters" pack — six women, six men, not one rig recoloured. */
export function buildPedestrians(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const people: Pedestrian[] = [];
  const segLen = (X1 - X0) / COUNT;

  for (let i = 0; i < COUNT; i++) {
    const segX0 = X0 + i * segLen;
    const segX1 = segX0 + segLen * (0.75 + hash(i, 71) * 0.4);
    const z = LINES[i % LINES.length] + (hash(i, 72) - 0.5) * 1.2;
    const startX = segX0 + hash(i, 73) * Math.max(0.1, segX1 - segX0);
    const p: Pedestrian = {
      x: startX,
      z,
      segX0,
      segX1,
      dir: hash(i, 74) > 0.5 ? 1 : -1,
      speed: 0.85 + hash(i, 75) * 0.7,
      model: null,
      col: { x: startX, z, hx: 0.3, hz: 0.3 },
    };
    ctx.colliders.push(p.col);
    people.push(p);

    ctx.defer(() => {
      instantiateFit(ctx, CHAR_FILES[i], root, { pos: [0, CITY_Y, 0], size: 1.7 })
        .then((m) => {
          for (const mesh of m.getChildMeshes()) mesh.isPickable = false;
          const anims = (m.metadata?.anims ?? []) as AnimationGroup[];
          const walk = anims.find((a) => a.name === "walk") ?? null;
          anims.forEach((a) => a.stop());
          walk?.start(true, 0.75 + hash(i, 79) * 0.3);
          p.model = m;
        })
        .catch(() => {});
    });
  }

  const blocked = (p: Pedestrian, x: number) =>
    ctx.colliders.some((c) => c !== p.col && Math.abs(x - c.x) < c.hx + 0.35 && Math.abs(p.z - c.z) < c.hz + 0.35);

  ctx.onFrame((dt) => {
    if (ctx.player.z < 40) return; // no one to see them indoors — skip the work
    for (const p of people) {
      const nx = p.x + p.dir * p.speed * dt;
      // Turn back at the segment ends, and at anything actually in the way (buildings,
      // the monument, trees, billboard posts…) instead of walking straight through it.
      if (nx > p.segX1 || nx < p.segX0 || blocked(p, nx)) p.dir = p.dir === 1 ? -1 : 1;
      else p.x = nx;
      p.col.x = p.x;
      if (p.model) {
        p.model.position.set(p.x, CITY_Y, p.z);
        setEuler(p.model, 0, Math.atan2(p.dir, 0) + Math.PI, 0);
      }
    }
  });

  return root;
}
