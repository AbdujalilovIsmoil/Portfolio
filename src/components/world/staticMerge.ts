import { Matrix, Mesh, Quaternion, Vector3, type TransformNode } from "@babylonjs/core";
import type { Ctx } from "./core";

/**
 * Static batching: the plain boxes / cylinders / planes hung directly under a room's root are
 * merged into one mesh per material — hundreds of draw calls become a few dozen. Anything that
 * moves, swaps material, billboards or is skinned lives in a sub-group (doors, curtains, models,
 * the TV…) or is skipped, so only truly static geometry is touched. The merged mesh stays under
 * the root, so switching the room off still hides it.
 */
export function mergeStatic(ctx: Ctx, root: TransformNode) {
  root.computeWorldMatrix(true);
  const casters = new Set(ctx.shadow?.getShadowMap()?.renderList ?? []);
  const groups = new Map<string, Mesh[]>();
  for (const n of root.getChildren()) {
    if (!(n instanceof Mesh) || n.getClassName() !== "Mesh") continue;
    if (!n.material || n.skeleton || n.billboardMode !== 0 || n.hasThinInstances || n.getTotalVertices() === 0 || n.getChildren().length) continue;
    if (n.material.getClassName() === "ShaderMaterial" || !n.isVerticesDataPresent("uv") || !n.isVerticesDataPresent("normal")) continue;
    if (n.isVerticesDataPresent("color")) continue;
    const key = `${n.material.uniqueId}|${casters.has(n)}|${n.isEnabled(false)}|${n.receiveShadows}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }
  const inv = root.getWorldMatrix().clone().invert();
  const s = new Vector3(), p = new Vector3(), q = new Quaternion();
  inv.decompose(s, q, p);
  let saved = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const cast = casters.has(list[0]);
    const receive = list[0].receiveShadows;
    const pickable = list.some((m) => m.isPickable);
    const merged = Mesh.MergeMeshes(list, true, true, undefined, false, false);
    if (!merged) continue;
    merged.parent = root;
    merged.position.copyFrom(p);
    merged.rotationQuaternion = q.clone();
    merged.scaling.copyFrom(s);
    merged.receiveShadows = receive;
    merged.isPickable = pickable;
    if (cast) ctx.shadow?.addShadowCaster(merged, false);
    merged.computeWorldMatrix(true);
    merged.freezeWorldMatrix();
    saved += list.length - 1;
  }
  void Matrix;
  return saved;
}
