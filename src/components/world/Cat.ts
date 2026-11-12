import type { AnimationGroup, Node, TransformNode } from "@babylonjs/core";
import { instantiate } from "./assets";
import { HALL } from "./Corridor";
import { OFFICE_REGION } from "./regions";
import { group, hash, lerp, setEuler, type Ctx, type Region } from "./core";

/** Measured once from cat.glb (its skinned bounds are in centimetre-ish units). */
const NATIVE = { min: [-87.3, -74.8, -168.1], max: [93.3, 90.8, 28.8] };
const LENGTH = 0.55; // nose to tail, metres

/**
 * The house cat (Quaternius, CC0): wanders between random spots in the living room and the hall,
 * stopping now and then to sit and look around, steering clear of furniture and of your feet.
 */
export function buildCat(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent, pos: [0, 0, 18] });
  const areas: Region[] = [OFFICE_REGION, HALL];
  const clear = (x: number, z: number) => !ctx.colliders.some((c) => Math.abs(x - c.x) < c.hx + 0.3 && Math.abs(z - c.z) < c.hz + 0.3);
  const pathClear = (x0: number, z0: number, x1: number, z1: number) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25);
    for (let i = 1; i <= n; i++) if (!clear(lerp(x0, x1, i / n), lerp(z0, z1, i / n))) return false;
    return true;
  };
  let x = 3, z = 18, yaw = 0, speed = 0;
  let tx = x, tz = z;
  let wait = 2;
  let k = 1;
  let model: TransformNode | null = null;
  let walk: AnimationGroup | undefined, idle: AnimationGroup | undefined;
  instantiate(ctx, "cat.glb", root, { background: true })
    .then((h) => {
      const s = LENGTH / (NATIVE.max[2] - NATIVE.min[2]);
      h.scaling.setAll(s);
      h.position.set(-((NATIVE.min[0] + NATIVE.max[0]) / 2) * s, -NATIVE.min[1] * s, -((NATIVE.min[2] + NATIVE.max[2]) / 2) * s);
      const tint = h.getChildMeshes();
      for (const m of tint) {
        m.isPickable = false;
        m.alwaysSelectAsActiveMesh = true; // its skinned bounds are unreliable
        if (ctx.shadow) ctx.shadow.addShadowCaster(m);
      }
      const anims = (h.metadata?.anims ?? []) as AnimationGroup[];
      walk = anims.find((a) => /Walk/.test(a.name));
      idle = anims.find((a) => /Idle/.test(a.name));
      anims.forEach((a) => a.stop());
      idle?.start(true);
      model = h;
    })
    .catch(() => {});

  let walking = false;
  ctx.onFrame((dt) => {
    const near = Math.hypot(ctx.player.x - x, ctx.player.z - z) < 30 && ctx.player.z < 41;
    root.setEnabled(near);
    if (!near || !model) return;
    if (wait > 0) {
      wait -= dt;
      speed = 0;
      if (wait <= 0) {
        // pick somewhere new it can walk to in a straight line
        for (let tries = 0; tries < 20; tries++) {
          const a = areas[Math.floor(hash(k++, 3) * areas.length)];
          const nx = a.x0 + 0.6 + hash(k++, 4) * (a.x1 - a.x0 - 1.2);
          const nz = a.z0 + 0.6 + hash(k++, 5) * (a.z1 - a.z0 - 1.2);
          if (Math.hypot(nx - x, nz - z) < 2 || Math.hypot(nx - x, nz - z) > 12) continue;
          if (clear(nx, nz) && pathClear(x, z, nx, nz)) {
            tx = nx;
            tz = nz;
            break;
          }
        }
      }
    }
    const dx = tx - x, dz = tz - z;
    const dist = Math.hypot(dx, dz);
    // keep out from under the player's feet
    const pd = Math.hypot(ctx.player.x - x, ctx.player.z - z);
    const want = wait > 0 || dist < 0.05 ? 0 : pd < 0.9 ? 0 : 0.55;
    speed = lerp(speed, want, 1 - Math.pow(0.02, dt));
    if (dist > 0.05 && wait <= 0) {
      const goal = Math.atan2(dx, dz);
      let d = goal - yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw += d * (1 - Math.pow(0.02, dt));
      const step = Math.min(dist, speed * dt);
      x += Math.sin(yaw) * step;
      z += Math.cos(yaw) * step;
      if (dist < 0.1) wait = 3 + hash(k++, 6) * 6;
    }
    const isWalking = speed > 0.08;
    if (isWalking !== walking) {
      walking = isWalking;
      (walking ? idle : walk)?.stop();
      (walking ? walk : idle)?.start(true, walking ? 1.1 : 1);
    }
    root.position.set(x, 0, z);
    setEuler(root, 0, yaw, 0);
  });
  return root;
}
