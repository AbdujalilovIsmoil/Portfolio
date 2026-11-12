import { Texture, Vector3, type Node, type PBRMaterial } from "@babylonjs/core";
import { POOL, WATER_Y, inPool } from "./cityLayout";
import { canvasTexture, group, lit, plane, type Ctx } from "./core";

/** A radial ripple as a normal map: concentric crests fading out towards the rim. */
function rippleNormals(ctx: Ctx) {
  const S = 256;
  const t = canvasTexture(ctx, S, S, (g) => {
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2);
        const r = Math.hypot(dx, dy);
        // slope of h = sin(14 r)·fade(r)
        const fade = r < 1 ? Math.pow(1 - r, 1.5) * Math.min(1, r * 4) : 0;
        const slope = Math.cos(r * 14) * 14 * fade * 0.06;
        const nx = r > 1e-4 ? (dx / r) * slope : 0;
        const ny = r > 1e-4 ? (dy / r) * slope : 0;
        const i = (y * S + x) * 4;
        img.data[i] = 128 + nx * 127;
        img.data[i + 1] = 128 + ny * 127;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
  t.hasAlpha = false;
  t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE;
  return t;
}

/** Soft, broken foam for the moment you plunge in. */
function foamTexture(ctx: Ctx) {
  return canvasTexture(ctx, 128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.6) * 54;
      const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
      const s = 2 + Math.random() * 6;
      const grd = g.createRadialGradient(x, y, 0, x, y, s);
      grd.addColorStop(0, "rgba(255,255,255,0.55)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/**
 * The water reacts to the swimmer the way real water does: rings of ripples spread out from the
 * body (they bend the light and reflections, no drawn outlines), bigger and faster when you jump
 * in, with a short-lived patch of foam where you went under.
 */
export function buildPoolFx(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const normals = rippleNormals(ctx);
  const N = 8;
  const ripples = Array.from({ length: N }, () => {
    const mat = lit(ctx, { color: "#2a8fbd", rough: 0.04, metal: 0.2, opacity: 0.0 });
    mat.bumpTexture = normals;
    mat.disableDepthWrite = true;
    const mesh = plane(ctx, 1, 1, { parent: root, rot: [-Math.PI / 2, 0, 0], mat });
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return { mesh, mat, t: 99, life: 2, size: 2 };
  });
  const foamMat = lit(ctx, { color: "#ffffff", rough: 0.6, opacity: 0 });
  foamMat.albedoTexture = foamTexture(ctx);
  foamMat.albedoTexture.hasAlpha = true;
  foamMat.useAlphaFromAlbedoTexture = true;
  foamMat.disableDepthWrite = true;
  const foam = plane(ctx, 1, 1, { parent: root, rot: [-Math.PI / 2, 0, 0], mat: foamMat });
  foam.isPickable = false;
  foam.setEnabled(false);
  let foamT = 99;

  let next = 0;
  const spawn = (x: number, z: number, size: number, life: number) => {
    const r = ripples[next];
    next = (next + 1) % N;
    r.mesh.position.set(x, WATER_Y + 0.02, z);
    r.t = 0;
    r.size = size;
    r.life = life;
    r.mesh.setEnabled(true);
  };

  let wasIn = false;
  let clock = 0;
  const last = new Vector3();
  ctx.onFrame((dt) => {
    const p = ctx.player;
    const inside = inPool(p.x, p.z) && p.y < WATER_Y;
    if (inside && !wasIn) {
      spawn(p.x, p.z, 5, 2.6);
      spawn(p.x, p.z, 3, 1.8);
      foam.position.set(p.x, WATER_Y + 0.03, p.z);
      foamT = 0;
      foam.setEnabled(true);
    }
    wasIn = inside;
    if (inside) {
      const moved = Vector3.Distance(last, p) > 0.01;
      clock -= dt;
      if (clock <= 0) {
        clock = moved ? 0.45 : 1.3;
        spawn(p.x, p.z, moved ? 2.6 : 1.8, moved ? 1.8 : 2.4);
      }
    }
    last.copyFrom(p);
    for (const r of ripples) {
      if (r.t > r.life) continue;
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) {
        r.mesh.setEnabled(false);
        continue;
      }
      const s = 0.3 + r.size * Math.sqrt(k);
      r.mesh.scaling.set(s, s, 1);
      (r.mat as PBRMaterial).alpha = 0.55 * (1 - k);
      const x = r.mesh.position.x, z = r.mesh.position.z;
      r.mesh.setEnabled(x - s / 2 > POOL.x0 - 0.5 && x + s / 2 < POOL.x1 + 0.5 && z - s / 2 > POOL.z0 - 0.5 && z + s / 2 < POOL.z1 + 0.5);
    }
    if (foamT < 1.6) {
      foamT += dt;
      const k = foamT / 1.6;
      foam.scaling.set(1.2 + k * 1.4, 1.2 + k * 1.4, 1);
      foamMat.alpha = 0.8 * (1 - k);
      if (k >= 1) foam.setEnabled(false);
    }
  });
  return root;
}
