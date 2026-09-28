import { Color3, PBRMaterial, type AnimationGroup, type Node } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import { CITY_Y } from "./Stairs";
import { box, group, lit, setEuler, type Ctx } from "./core";

function buildBenchFrame(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const wood = lit(ctx, { color: "#7a5233", rough: 0.7 });
  const iron = lit(ctx, { color: "#2b2e33", rough: 0.4, metal: 0.6 });
  for (const dz of [-0.62, 0.62]) {
    box(ctx, 0.06, 0.42, 0.06, { parent: root, pos: [-0.68, 0.21, dz], mat: iron });
    box(ctx, 0.06, 0.42, 0.06, { parent: root, pos: [0.68, 0.21, dz], mat: iron });
  }
  for (let i = 0; i < 4; i++) box(ctx, 1.5, 0.04, 0.09, { parent: root, pos: [0, 0.44, -0.32 + i * 0.21], mat: wood, receive: true, cast: true });
  box(ctx, 0.06, 0.42, 1.36, { parent: root, pos: [-0.68, 0.65, 0], mat: iron });
  box(ctx, 0.06, 0.42, 1.36, { parent: root, pos: [0.68, 0.65, 0], mat: iron });
  for (let i = 0; i < 3; i++) box(ctx, 1.5, 0.04, 0.09, { parent: root, pos: [0, 0.66 + i * 0.16, 0.5], rot: [0.35, 0, 0], mat: wood, cast: true });
  return root;
}

/** A handful of streetside benches, most occupied — some by an ordinary
 * passer-by taking a rest, a couple by an older-looking (greyed, slower)
 * pair, since no dedicated elderly model exists in the asset pack. */
export function buildBenches(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const spots: [number, number, number, string, boolean][] = [
    [-46, 51.9, Math.PI, "character-female-b.glb", false],
    [-6, 51.9, Math.PI, "character-male-c.glb", false],
    [30, 51.9, Math.PI, "character-female-e.glb", true], // "elderly" (tinted)
    [-38, 70.6, 0, "character-male-e.glb", true], // "elderly" (tinted)
    [10, 70.6, 0, "character-female-d.glb", false],
    [55, 70.6, 0, "character-male-a.glb", false],
  ];

  spots.forEach(([x, z, yaw, file, elderly]) => {
    const bench = buildBenchFrame(ctx, root);
    bench.position.set(x, CITY_Y, z);
    setEuler(bench, 0, yaw, 0);
    ctx.colliders.push({ x, z, hx: 0.75, hz: 0.7 });

    // seat position in front of the backrest, in the bench's own local frame
    const forward = [Math.sin(yaw), Math.cos(yaw)];
    const sx = x - forward[0] * 0.1;
    const sz = z - forward[1] * 0.1;

    ctx.defer(() => {
      instantiateFit(ctx, file, root, { pos: [sx, CITY_Y, sz], yaw, size: elderly ? 1.55 : 1.7 })
        .then((m) => {
          for (const mesh of m.getChildMeshes()) {
            mesh.isPickable = false;
            if (elderly) {
              const mat = mesh.material;
              if (mat instanceof PBRMaterial && mat.albedoColor) {
                const c = mat.albedoColor;
                const grey = (c.r + c.g + c.b) / 3;
                mat.albedoColor = new Color3(lerp3(c.r, grey, 0.55), lerp3(c.g, grey, 0.55), lerp3(c.b, grey, 0.55));
              }
            }
          }
          const anims = (m.metadata?.anims ?? []) as AnimationGroup[];
          const sit = anims.find((a) => a.name === "sit") ?? null;
          anims.forEach((a) => a.stop());
          sit?.start(true, 1);
        })
        .catch(() => {});
    });
  });

  return root;
}

function lerp3(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
