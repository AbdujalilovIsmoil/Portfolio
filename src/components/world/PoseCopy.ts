import { Matrix, Quaternion, Vector3, type TransformNode } from "@babylonjs/core";

/**
 * Direction-based retargeting. Every frame, each target bone is turned so that it points the
 * same way (in its model's own space) as the matching bone of an animated source skeleton.
 *
 * Copying local rotations between two rigs only works when both share the same rest pose; these
 * avatars don't (different bind poses, different joint frames), which is what bent the arms
 * behind the back and spread the legs. Matching bone *directions* doesn't care about rest poses
 * or joint frames at all, only about the bone layout — which every Mixamo-style rig shares.
 */

/** [bone, child it points at] — parents before children. */
const CHAINS: [string, string][] = [
  ["Spine", "Spine1"],
  ["Spine1", "Spine2"],
  ["Spine2", "Neck"],
  ["Neck", "Head"],
  ["Head", "HeadTop_End"],
  ["LeftShoulder", "LeftArm"],
  ["LeftArm", "LeftForeArm"],
  ["LeftForeArm", "LeftHand"],
  ["LeftHand", "LeftHandMiddle1"],
  ["RightShoulder", "RightArm"],
  ["RightArm", "RightForeArm"],
  ["RightForeArm", "RightHand"],
  ["RightHand", "RightHandMiddle1"],
  ["LeftUpLeg", "LeftLeg"],
  ["LeftLeg", "LeftFoot"],
  ["LeftFoot", "LeftToeBase"],
  ["RightUpLeg", "RightLeg"],
  ["RightLeg", "RightFoot"],
  ["RightFoot", "RightToeBase"],
];

type Rig = { root: TransformNode; bones: Map<string, TransformNode> };

export function rigOf(root: TransformNode): Rig {
  const bones = new Map<string, TransformNode>();
  for (const n of root.getDescendants(false) as TransformNode[]) if (n.position) bones.set(n.name.replace(/^mixamorig:?/, ""), n);
  return { root, bones };
}

const tmpM = new Matrix();
const tmpM2 = new Matrix();
const tmpV = new Vector3();
const tmpV2 = new Vector3();
const tmpQ = new Quaternion();

/** Turn `node` by `angle` about a WORLD axis (applied on top of its current pose). */
export function rotateWorld(node: TransformNode | null | undefined, axis: Vector3, angle: number) {
  if (!node?.rotationQuaternion || !node.parent || Math.abs(angle) < 1e-5) return;
  const p = node.parent as TransformNode;
  p.computeWorldMatrix(true).invertToRef(tmpM);
  Vector3.TransformNormalToRef(axis, tmpM, tmpV);
  tmpV.normalize();
  Quaternion.RotationAxisToRef(tmpV, angle, tmpQ);
  tmpQ.multiplyToRef(node.rotationQuaternion, node.rotationQuaternion);
  node.computeWorldMatrix(true);
}

/** Direction from bone a to bone b, in the space of `root` (unit length). */
function dir(rig: Rig, a: TransformNode, b: TransformNode, out: Vector3) {
  a.computeWorldMatrix(true);
  b.computeWorldMatrix(true);
  b.getAbsolutePosition().subtractToRef(a.getAbsolutePosition(), tmpV2);
  rig.root.computeWorldMatrix(true).invertToRef(tmpM2);
  Vector3.TransformNormalToRef(tmpV2, tmpM2, out);
  return out.normalize();
}

export class PoseCopy {
  private rest = new Map<TransformNode, Quaternion>();
  private ds = new Vector3();
  private dt = new Vector3();
  private axis = new Vector3();
  constructor(
    private source: Rig,
    private target: Rig
  ) {
    for (const b of target.bones.values()) if (b.rotationQuaternion) this.rest.set(b, b.rotationQuaternion.clone());
  }

  /** Align target bone `a` (pointing at `b`) with the source; `twistRef` optionally fixes the roll. */
  private align(a: string, b: string, twistA?: string, twistB?: string) {
    const S = this.source.bones, T = this.target.bones;
    const sa = S.get(a), sb = S.get(b), ta = T.get(a), tb = T.get(b);
    if (!sa || !sb || !ta || !tb) return;
    dir(this.source, sa, sb, this.ds);
    dir(this.target, ta, tb, this.dt);
    this.turn(ta, this.dt, this.ds);
    if (twistA && twistB) {
      // roll about the bone so that a second direction (e.g. hip to hip) matches too
      const s1 = S.get(twistA), s2 = S.get(twistB), t1 = T.get(twistA), t2 = T.get(twistB);
      if (!s1 || !s2 || !t1 || !t2) return;
      const main = this.ds.clone();
      const proj = (v: Vector3) => v.subtract(main.scale(Vector3.Dot(v, main))).normalize();
      const ss = proj(dir(this.source, s1, s2, new Vector3()));
      const tt = proj(dir(this.target, t1, t2, new Vector3()));
      this.turn(ta, tt, ss);
    }
  }

  /** Rotate bone so that model-space direction `from` becomes `to`. */
  private turn(bone: TransformNode, from: Vector3, to: Vector3) {
    const d = Math.min(1, Math.max(-1, Vector3.Dot(from, to)));
    const ang = Math.acos(d);
    if (ang < 1e-4) return;
    Vector3.CrossToRef(from, to, this.axis);
    if (this.axis.lengthSquared() < 1e-10) return;
    this.axis.normalize();
    // model space → world space
    Vector3.TransformNormalToRef(this.axis, this.target.root.computeWorldMatrix(true), this.axis);
    rotateWorld(bone, this.axis.normalize(), ang);
  }

  /** Call once per frame, after the source's animations have been evaluated. */
  apply() {
    for (const [b, q] of this.rest) b.rotationQuaternion!.copyFrom(q);
    // hips: spine direction, then the hip-to-hip line for the facing
    this.align("Hips", "Spine", "LeftUpLeg", "RightUpLeg");
    for (const [a, b] of CHAINS) {
      if (a === "Spine2") this.align(a, b, "LeftShoulder", "RightShoulder");
      else if (a === "Head") this.align(a, b, "LeftEye", "RightEye");
      else this.align(a, b);
    }
  }
}
