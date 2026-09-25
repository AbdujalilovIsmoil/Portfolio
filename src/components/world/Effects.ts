import { Instancer, canvasTexture, disc, group, hash, plane, setEuler, unlit, type Ctx } from "./core";
import type { Node } from "@babylonjs/core";

// ---------------------------------------------------------------- footprints

const PRINTS = 28;
const PRINT_LIFE = 5;

/** Boot-sole silhouette with tread lines; toe points to the top of the texture. */
function soleTexture(ctx: Ctx) {
  return canvasTexture(ctx, 128, 256, (g) => {
    g.fillStyle = "rgba(30,26,24,0.85)";
    g.beginPath();
    g.ellipse(64, 78, 44, 66, 0, 0, Math.PI * 2); // forefoot
    g.fill();
    g.beginPath();
    g.moveTo(34, 120);
    g.quadraticCurveTo(64, 132, 94, 120);
    g.lineTo(84, 168);
    g.lineTo(44, 168);
    g.closePath(); // arch
    g.fill();
    g.beginPath();
    g.ellipse(64, 200, 32, 44, 0, 0, Math.PI * 2); // heel
    g.fill();
    g.globalCompositeOperation = "destination-out";
    g.lineWidth = 6;
    for (let y = 30; y < 118; y += 16) {
      g.beginPath();
      g.moveTo(28, y);
      g.lineTo(100, y - 6);
      g.stroke();
    }
    g.fillRect(36, 148, 56, 8);
    for (let y = 176; y < 236; y += 14) {
      g.beginPath();
      g.moveTo(40, y);
      g.lineTo(88, y);
      g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  });
}

export interface StepSignal {
  n: number;
  yaw: number;
}

/** Leaves a boot-sole footprint (alternating left/right) at every footstep, fading out. */
export function buildFootprints(ctx: Ctx, parent: Node, step: StepSignal) {
  const tex = soleTexture(ctx);
  const prints = Array.from({ length: PRINTS }, () => {
    const mat = unlit(ctx, { map: tex, opacity: 0, depthWrite: false, double: true });
    mat.zOffset = -2;
    const holder = group(ctx, { parent });
    const mesh = plane(ctx, 0.16, 0.34, { parent: holder, rot: [-Math.PI / 2, 0, 0], mat });
    holder.setEnabled(false);
    return { holder, mesh, mat, t: PRINT_LIFE + 1 };
  });
  let next = 0;
  let last = 0;
  let right = false;
  ctx.onFrame((dt) => {
    if (step.n !== last) {
      last = step.n;
      right = !right;
      const p = prints[next];
      next = (next + 1) % PRINTS;
      const th = step.yaw;
      const side = right ? 1 : -1;
      // right vector for a facing angle th is (-cos th, sin th)
      p.holder.position.set(ctx.player.x + -Math.cos(th) * 0.13 * side, ctx.player.y + 0.012, ctx.player.z + Math.sin(th) * 0.13 * side);
      setEuler(p.holder, 0, th + Math.PI, 0);
      p.mesh.scaling.x = side; // mirror for the left foot
      p.t = 0;
      p.holder.setEnabled(true);
    }
    for (const p of prints) {
      if (p.t > PRINT_LIFE) continue;
      p.t += dt;
      if (p.t > PRINT_LIFE) {
        p.holder.setEnabled(false);
        continue;
      }
      const k = p.t / PRINT_LIFE;
      p.mat.alpha = 0.55 * Math.min(1, p.t / 0.08) * (1 - k * k);
    }
  });
}

// ----------------------------------------------------------- impact effect

export interface ImpactSignal {
  trigger: number;
  x: number;
  z: number;
  strength: number;
}

export const createImpactSignal = (): ImpactSignal => ({ trigger: 0, x: 0, z: 0, strength: 0 });

const CRACK_COUNT = 3;
const CRACK_LIFE = 5;
const CRACK_DUST = 34;
const CRACK_DUST_LIFE = 1;

function crackTexture(ctx: Ctx) {
  const size = 256;
  return canvasTexture(ctx, size, size, (g) => {
    const cx = size / 2, cy = size / 2;
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, size * 0.34);
    glow.addColorStop(0, "rgba(15,15,17,0.45)");
    glow.addColorStop(1, "rgba(15,15,17,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(18,18,20,0.85)";
    g.lineWidth = 2.2;
    const cracks = 9;
    for (let i = 0; i < cracks; i++) {
      let angle = (i / cracks) * Math.PI * 2 + hash(i, 41) * 0.4;
      let x = cx, y = cy;
      g.beginPath();
      g.moveTo(x, y);
      const len = size * 0.26 + hash(i, 42) * size * 0.2;
      let dist = 0;
      while (dist < len) {
        const step = 7 + hash(i, 43 + dist) * 12;
        angle += (hash(i, 50 + dist) - 0.5) * 0.7;
        x += Math.cos(angle) * step;
        y += Math.sin(angle) * step;
        dist += step;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

/** Cracked-ground decal plus a dust burst wherever the player lands hard. */
export function buildImpactEffect(ctx: Ctx, parent: Node, sig: ImpactSignal) {
  const tex = crackTexture(ctx);
  const cracks = Array.from({ length: CRACK_COUNT }, () => {
    const mat = unlit(ctx, { map: tex, opacity: 0, depthWrite: false, double: true });
    const mesh = plane(ctx, 2.4, 2.4, { parent, rot: [-Math.PI / 2, 0, 0], mat });
    mesh.setEnabled(false);
    return { mesh, mat, active: false, t: 0, x: 0, z: 0, scale: 1 };
  });
  const dustBase = disc(ctx, 1, 8, { parent, mat: unlit(ctx, { color: "#cbb896", opacity: 0.32, depthWrite: false, double: true }) });
  dustBase.setEnabled(false);
  const inst = new Instancer(dustBase, CRACK_DUST);
  let dust = Array.from({ length: CRACK_DUST }, () => ({ x: 0, z: 0, t: CRACK_DUST_LIFE + 1, angle: 0, speed: 0 }));
  let next = 0;
  let last = 0;

  ctx.onFrame((dt) => {
    if (sig.trigger !== last) {
      last = sig.trigger;
      const { x, z, strength } = sig;
      const c = cracks[next];
      next = (next + 1) % CRACK_COUNT;
      Object.assign(c, { active: true, t: 0, x, z, scale: 0.7 + strength * 0.9 });
      dust = Array.from({ length: CRACK_DUST }, (_, k) => ({
        x,
        z,
        t: 0,
        angle: hash(k, 71) * Math.PI * 2,
        speed: (1.4 + hash(k, 72) * 3.2) * (0.6 + strength * 0.5),
      }));
    }
    for (const c of cracks) {
      if (!c.active) continue;
      c.t += dt;
      if (c.t > CRACK_LIFE) {
        c.active = false;
        c.mesh.setEnabled(false);
        continue;
      }
      c.mesh.setEnabled(true);
      c.mesh.position.set(c.x, 0.02, c.z);
      const p = c.t / CRACK_LIFE;
      const fadeIn = Math.min(1, p / 0.05);
      const fadeOut = Math.max(0, 1 - Math.max(0, (p - 0.55) / 0.45));
      c.mat.alpha = 0.75 * fadeIn * fadeOut;
      c.mesh.scaling.setAll(c.scale * (0.85 + fadeIn * 0.15));
    }
    let any = false;
    dust.forEach((p, i) => {
      p.t += dt;
      if (p.t > CRACK_DUST_LIFE) return inst.set(i, 0, -50, 0, 0.0001);
      any = true;
      const r = p.speed * p.t;
      const prog = p.t / CRACK_DUST_LIFE;
      inst.set(i, p.x + Math.cos(p.angle) * r, 0.05 + prog * 0.7, p.z + Math.sin(p.angle) * r, (0.16 + prog * 0.4) * (1 - prog), -Math.PI / 2, 0, p.angle);
    });
    inst.flush();
    dustBase.setEnabled(any);
  });
}
