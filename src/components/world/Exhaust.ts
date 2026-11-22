import { Color4, Matrix, MeshBuilder, ParticleSystem, Vector3, type Mesh, type Node, type StandardMaterial } from "@babylonjs/core";
import { canvasTexture, glowTexture, lit, setAdditive, unlit, type Ctx } from "./core";

/** Where the two tailpipes come out (the car's own frame, metres: +z forward, the body ends at −2.24). */
const PIPES: [number, number, number][] = [
  [0.3, 0.42, -2.1],
  [-0.3, 0.42, -2.1],
];
const PIPE_LEN = 0.34;
/** the pipe's open end */
const TIP_Z = -2.1 - PIPE_LEN;

/**
 * The flame's colour along it (v: 0 at the pipe … 1 at the tip): white-hot at the nozzle, a blue
 * core with three bright "shock diamonds" in it, going orange and red, gone by the tip. Brighter
 * down the middle (u: round the cone, so the edges seen side on fade out).
 */
function flameTexture(ctx: Ctx, core: boolean) {
  const t = canvasTexture(ctx, 64, 256, (g) => {
    g.clearRect(0, 0, 64, 256);
    const grad = g.createLinearGradient(0, 0, 0, 256);
    if (core) {
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.18, "rgba(170,215,255,1)");
      grad.addColorStop(0.5, "rgba(80,140,255,0.85)");
      grad.addColorStop(1, "rgba(40,60,255,0)");
    } else {
      grad.addColorStop(0, "rgba(255,240,200,1)");
      grad.addColorStop(0.15, "rgba(255,190,80,1)");
      grad.addColorStop(0.45, "rgba(255,110,30,0.85)");
      grad.addColorStop(0.75, "rgba(220,40,10,0.4)");
      grad.addColorStop(1, "rgba(120,10,0,0)");
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 256);
    if (core)
      // the shock diamonds: bright bands, closer together and fainter down the jet
      for (const [y, a] of [
        [40, 0.9],
        [92, 0.65],
        [138, 0.4],
      ]) {
        const d = g.createLinearGradient(0, y - 12, 0, y + 12);
        d.addColorStop(0, "rgba(255,255,255,0)");
        d.addColorStop(0.5, `rgba(255,255,255,${a})`);
        d.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = d;
        g.fillRect(0, y - 12, 64, 24);
      }
    // fade towards the cone's sides (u = 0 and 1 are the same seam: bright in the middle of each half)
    const side = g.createLinearGradient(0, 0, 64, 0);
    side.addColorStop(0, "rgba(0,0,0,0.55)");
    side.addColorStop(0.25, "rgba(0,0,0,0)");
    side.addColorStop(0.75, "rgba(0,0,0,0)");
    side.addColorStop(1, "rgba(0,0,0,0.55)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = side;
    g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = "source-over";
  });
  return t;
}

/** A cone 1 m long, its wide end at the origin, pointing back (−z) out of the pipe. */
function jet(ctx: Ctx, name: string, width: number, mat: StandardMaterial, parent: Node) {
  const m = MeshBuilder.CreateCylinder(name, { height: 1, diameterTop: width * 0.25, diameterBottom: width, tessellation: 14, cap: 0 }, ctx.scene);
  // (y 0…1, then +y turned onto −z)
  m.bakeTransformIntoVertices(Matrix.Translation(0, 0.5, 0).multiply(Matrix.RotationX(-Math.PI / 2)));
  m.material = mat;
  m.parent = parent;
  m.isPickable = false;
  m.alwaysSelectAsActiveMesh = true;
  // (always on, shrunk to nothing when the nitro is off: drawn from the start, so its shader is
  // compiled while the race loads — not the first time Shift is pressed, mid-race)
  m.scaling.setAll(0);
  return m;
}

/**
 * Two chrome tailpipes on the back of the car, and the nitro: hold Shift and they light — a blue
 * core with shock diamonds inside an orange flame, flickering in length and width, a hot glow at
 * each nozzle, and sparks and flame tongues streaming out behind (left in the air as the car pulls
 * away). It lights up in a moment and dies away when you let go.
 */
export function buildExhaust(ctx: Ctx, parent: Node) {
  const chrome = lit(ctx, { color: "#c9ced6", metal: 0.95, rough: 0.22 });
  const soot = lit(ctx, { color: "#121214", rough: 0.9 });
  const coreMat = unlit(ctx, { map: flameTexture(ctx, true), additive: true, depthWrite: false, double: true });
  const outerMat = unlit(ctx, { map: flameTexture(ctx, false), additive: true, depthWrite: false, double: true });
  const glowMat = unlit(ctx, { map: glowTexture(ctx, true), additive: true, depthWrite: false, double: true });

  const flames: { core: Mesh; outer: Mesh; glow: Mesh; tip: Mesh; seed: number }[] = [];
  PIPES.forEach(([x, y, z], i) => {
    // the pipe: a chrome tube, a sooty inside, a slightly flared lip
    const pipe = MeshBuilder.CreateCylinder("tailpipe", { height: PIPE_LEN, diameter: 0.17, tessellation: 18 }, ctx.scene);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, y, z - PIPE_LEN / 2);
    pipe.material = chrome;
    pipe.parent = parent;
    pipe.isPickable = false;
    ctx.shadow?.addShadowCaster(pipe, false);
    const lip = MeshBuilder.CreateTorus("tailpipeLip", { diameter: 0.17, thickness: 0.035, tessellation: 18 }, ctx.scene);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(x, y, TIP_Z);
    lip.material = chrome;
    lip.parent = parent;
    lip.isPickable = false;
    const hole = MeshBuilder.CreateDisc("tailpipeHole", { radius: 0.07, tessellation: 18 }, ctx.scene);
    hole.position.set(x, y, TIP_Z + 0.02);
    hole.rotation.y = Math.PI;
    hole.material = soot;
    hole.parent = parent;
    hole.isPickable = false;
    // the flame, at the open end
    const tip = MeshBuilder.CreateBox("pipeTip", { size: 0.01 }, ctx.scene);
    tip.position.set(x, y, TIP_Z - 0.03);
    tip.parent = parent;
    tip.isVisible = false;
    tip.isPickable = false;
    const outer = jet(ctx, "nitroFlame", 0.42, outerMat, tip);
    const core = jet(ctx, "nitroCore", 0.17, coreMat, tip);
    const glow = MeshBuilder.CreatePlane("nitroGlow", { size: 1 }, ctx.scene);
    glow.billboardMode = 7;
    glow.material = glowMat;
    glow.parent = tip;
    glow.isPickable = false;
    glow.scaling.setAll(0);
    flames.push({ core, outer, glow, tip, seed: i * 17.3 });
  });

  // flame tongues and sparks thrown out behind, left hanging in the air
  const tongues = flames.map((f, i) => {
    const ps = new ParticleSystem(`nitroTongues${i}`, 260, ctx.scene);
    ps.particleTexture = glowTexture(ctx);
    ps.emitter = f.tip;
    ps.updateSpeed = 1 / 60;
    ps.minEmitBox = new Vector3(-0.03, -0.03, 0);
    ps.maxEmitBox = new Vector3(0.03, 0.03, 0);
    // (in the pipe's own frame: straight out the back, spreading a little)
    ps.direction1 = new Vector3(-0.12, -0.05, -1);
    ps.direction2 = new Vector3(0.12, 0.15, -1);
    ps.minEmitPower = 6;
    ps.maxEmitPower = 12;
    ps.minLifeTime = 0.08;
    ps.maxLifeTime = 0.2;
    ps.addSizeGradient(0, 0.16);
    ps.addSizeGradient(0.4, 0.34);
    ps.addSizeGradient(1, 0.06);
    ps.addColorGradient(0, new Color4(1, 0.72, 0.32, 0.9));
    ps.addColorGradient(0.2, new Color4(1, 0.55, 0.18, 0.9));
    ps.addColorGradient(0.65, new Color4(1, 0.28, 0.05, 0.8));
    ps.addColorGradient(1, new Color4(0.3, 0.05, 0, 0));
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.emitRate = 0;
    ps.start();
    return ps;
  });

  let level = 0;
  let t = 0;
  return {
    /** Every frame: `on` while the nitro is lit; `speed` (m/s) stretches the flame. */
    update(dt: number, on: boolean, speed: number) {
      t += dt;
      // lights in a blink, dies away a little slower
      level += ((on ? 1 : 0) - level) * Math.min(1, dt * (on ? 14 : 7));
      const shown = level > 0.02;
      for (const f of flames) {
        if (!shown) {
          f.core.scaling.setAll(0);
          f.outer.scaling.setAll(0);
          f.glow.scaling.setAll(0);
          continue;
        }
        // flicker: a jet that roars, never a steady cone
        const n1 = Math.sin(t * 61 + f.seed) * 0.5 + Math.sin(t * 37.7 + f.seed * 2) * 0.5;
        const n2 = Math.random();
        const len = level * (0.9 + Math.min(speed, 80) / 160) * (0.8 + 0.25 * n1 + 0.15 * n2);
        f.outer.scaling.set(level * (0.85 + 0.25 * n2), level * (0.85 + 0.25 * n2), len * 1.55);
        f.core.scaling.set(level * (0.9 + 0.15 * n1), level * (0.9 + 0.15 * n1), len * 0.85);
        f.glow.scaling.setAll(0.45 + 0.25 * n2 * level);
      }
      setAdditive(outerMat, "#ffffff", 0.75 * level + 0.25 * level * Math.random());
      setAdditive(coreMat, "#ffffff", level);
      setAdditive(glowMat, "#ffa64d", 0.9 * level);
      for (const ps of tongues) ps.emitRate = on ? 140 : 0;
    },
  };
}
