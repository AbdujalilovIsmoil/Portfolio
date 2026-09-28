import type { AnimationGroup, Node, TransformNode } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import { CITY_Y } from "./Stairs";
import { group, hash, setEuler, type Ctx } from "./core";

const LINES = [51.2, 70.7];
const X0 = -50;
const X1 = 70;
const FILES = ["animal-dog.glb", "animal-cat.glb", "animal-dog.glb", "animal-cat.glb", "animal-dog.glb", "animal-cat.glb"];
const COUNT = FILES.length;

interface Pet {
  x: number;
  z: number;
  segX0: number;
  segX1: number;
  dir: 1 | -1;
  speed: number;
  model: TransformNode | null;
  col: { x: number; z: number; hx: number; hz: number };
}

/** A handful of dogs and cats (Kenney's CC0 "Cube Pets" pack) pacing short
 * stretches of sidewalk — small, low to the ground, easy to miss but a nice
 * bit of life underfoot. */
export function buildPets(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const pets: Pet[] = [];
  const segLen = (X1 - X0) / COUNT;

  for (let i = 0; i < COUNT; i++) {
    const segX0 = X0 + i * segLen;
    const segX1 = segX0 + segLen * (0.6 + hash(i, 91) * 0.4);
    const z = LINES[i % LINES.length] + (hash(i, 92) - 0.5) * 0.8;
    const startX = segX0 + hash(i, 93) * Math.max(0.1, segX1 - segX0);
    const p: Pet = {
      x: startX,
      z,
      segX0,
      segX1,
      dir: hash(i, 94) > 0.5 ? 1 : -1,
      speed: 0.6 + hash(i, 95) * 0.9,
      model: null,
      col: { x: startX, z, hx: 0.22, hz: 0.22 },
    };
    ctx.colliders.push(p.col);
    pets.push(p);

    ctx.defer(() => {
      instantiateFit(ctx, FILES[i], root, { pos: [0, CITY_Y, 0], size: 0.55 })
        .then((m) => {
          for (const mesh of m.getChildMeshes()) mesh.isPickable = false;
          const anims = (m.metadata?.anims ?? []) as AnimationGroup[];
          const walk = anims.find((a) => a.name === "walk") ?? null;
          anims.forEach((a) => a.stop());
          walk?.start(true, 1.1 + hash(i, 96) * 0.4);
          p.model = m;
        })
        .catch(() => {});
    });
  }

  const blocked = (p: Pet, x: number) =>
    ctx.colliders.some((c) => c !== p.col && Math.abs(x - c.x) < c.hx + 0.2 && Math.abs(p.z - c.z) < c.hz + 0.2);

  ctx.onFrame((dt) => {
    if (ctx.player.z < 40) return;
    for (const p of pets) {
      const nx = p.x + p.dir * p.speed * dt;
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
