import { Mesh, MeshBuilder, VertexData, type Node } from "@babylonjs/core";
import { group, hash, lit, setEuler, type Ctx } from "./core";

/** A swallow: slim body, forked tail, two swept wings that flap (separate meshes). */
function swallow(ctx: Ctx, parent: Node, body: ReturnType<typeof lit>, belly: ReturnType<typeof lit>) {
  const root = group(ctx, { parent });
  const b = MeshBuilder.CreateSphere("swallow", { diameter: 0.12, segments: 6 }, ctx.scene);
  b.scaling.set(0.7, 0.6, 2.2);
  b.parent = root;
  b.material = body;
  const chest = MeshBuilder.CreateSphere("chest", { diameter: 0.09, segments: 5 }, ctx.scene);
  chest.position.set(0, -0.015, 0.05);
  chest.scaling.set(0.8, 0.6, 1.4);
  chest.parent = root;
  chest.material = belly;
  // forked tail
  const tail = new Mesh("tail", ctx.scene);
  const vd = new VertexData();
  vd.positions = [0, 0, -0.1, -0.07, 0, -0.3, 0, 0, -0.18, 0.07, 0, -0.3];
  vd.indices = [0, 1, 2, 0, 2, 3];
  vd.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  vd.applyToMesh(tail);
  tail.parent = root;
  tail.material = body;
  const wing = (side: 1 | -1) => {
    const pivot = group(ctx, { parent: root, pos: [side * 0.03, 0.01, 0.02] });
    const w = new Mesh("wing", ctx.scene);
    const v = new VertexData();
    // a long, swept-back sickle wing
    v.positions = [0, 0, 0.05, side * 0.18, 0, 0.0, side * 0.36, 0, -0.12, 0, 0, -0.06];
    v.indices = side > 0 ? [0, 1, 3, 1, 2, 3] : [0, 3, 1, 1, 3, 2];
    v.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
    v.applyToMesh(w);
    w.parent = pivot;
    w.material = body;
    return pivot;
  };
  const wl = wing(-1);
  const wr = wing(1);
  for (const m of root.getChildMeshes()) m.isPickable = false;
  return { root, wl, wr };
}

/**
 * A flock of swallows (qaldirg'och) swooping over the garden by day: each one loops round a
 * moving centre with its own radius and height, banking into the turns, wings beating in bursts
 * and gliding in between — the way swallows fly.
 */
export function buildBirds(ctx: Ctx, parent: Node, centre: { x: number; y: number; z: number }) {
  const root = group(ctx, { parent });
  const body = lit(ctx, { color: "#1b2233", rough: 0.6, double: true });
  const belly = lit(ctx, { color: "#d9cfc0", rough: 0.8 });
  const N = ctx.lowPower ? 6 : 10;
  const birds = Array.from({ length: N }, (_, i) => ({
    ...swallow(ctx, root, body, belly),
    r: 8 + hash(i, 1) * 22,
    h: 6 + hash(i, 2) * 12,
    sp: (0.35 + hash(i, 3) * 0.35) * (i % 3 ? 1 : -1),
    ph: hash(i, 4) * Math.PI * 2,
    wob: 0.5 + hash(i, 5),
    flap: 0,
  }));
  ctx.onFrame((dt, t) => {
    const show = ctx.night < 0.6 && ctx.outdoor > 0.05;
    root.setEnabled(show);
    if (!show) return;
    const cx = centre.x + Math.sin(t * 0.05) * 12;
    const cz = centre.z + Math.cos(t * 0.04) * 10;
    for (const b of birds) {
      const a = t * b.sp + b.ph;
      const r = b.r * (1 + 0.25 * Math.sin(t * 0.3 * b.wob + b.ph));
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r * 0.8;
      const y = centre.y + b.h + Math.sin(t * 0.7 * b.wob + b.ph) * 2.5;
      b.root.position.set(x, y, z);
      // heading along the circle, banked into the turn
      const yaw = Math.atan2(-Math.sin(a) * Math.sign(b.sp), Math.cos(a) * 0.8 * Math.sign(b.sp));
      setEuler(b.root, Math.cos(t * 0.7 * b.wob + b.ph) * 0.2, yaw, -Math.sign(b.sp) * 0.5);
      // bursts of fast wing beats, then a glide
      const burst = Math.sin(t * 0.9 * b.wob + b.ph * 3) > -0.2 ? 1 : 0.15;
      b.flap += dt * 14 * burst;
      const f = Math.sin(b.flap) * 0.7 * burst + 0.1;
      b.wl.rotation.z = -f;
      b.wr.rotation.z = f;
    }
  });
  return root;
}
