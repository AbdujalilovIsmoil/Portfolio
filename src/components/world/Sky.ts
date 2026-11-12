import { Color3, Mesh, MeshBuilder, StandardMaterial, Texture, Vector3, type Node, type ShaderMaterial } from "@babylonjs/core";
import { canvasTexture, glowTexture, group, hash, place, points, sprite, unlit, type Ctx } from "./core";

/** Direction toward the sun / the moon (World.tsx aims the directional light along these). */
// low in the west-south-west, so it is in view whenever you look along the yard or the garden
export const SUN_DIR = new Vector3(-0.82, 0.36, 0.45).normalize();
export const MOON_DIR = new Vector3(0.3, 0.42, 0.86).normalize();

function gradient(ctx: Ctx, stops: [number, string][]) {
  return canvasTexture(ctx, 8, 512, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 512);
    for (const [t, c] of stops) grd.addColorStop(t, c);
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 512);
  });
}

function dome(ctx: Ctx, tex: Texture, name: string) {
  const m = MeshBuilder.CreateSphere(name, { diameter: 900, segments: 24, sideOrientation: Mesh.BACKSIDE }, ctx.scene);
  const mat = new StandardMaterial(name, ctx.scene);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.emissiveTexture = tex;
  mat.fogEnabled = false;
  mat.disableDepthWrite = true;
  m.material = mat;
  m.infiniteDistance = true;
  m.isPickable = false;
  m.alwaysSelectAsActiveMesh = true;
  return { mesh: m, mat };
}

/** Distant mountain range (the Chimgan side of Tashkent), as an alpha-cut silhouette band. */
function mountainTexture(ctx: Ctx) {
  const W = 1024, H = 128;
  const t = canvasTexture(ctx, W, H, (g) => {
    g.clearRect(0, 0, W, H);
    const ridge = (amp: number, base: number, seed: number, alpha: number) => {
      g.fillStyle = `rgba(255,255,255,${alpha})`;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) {
        const u = x / W;
        // periodic in u so the band wraps seamlessly around the cylinder
        const y =
          base -
          amp *
            (0.55 * Math.max(0, Math.sin(u * Math.PI * 2 * 3 + seed)) +
              0.3 * Math.abs(Math.sin(u * Math.PI * 2 * 7 + seed * 2.1)) +
              0.15 * Math.sin(u * Math.PI * 2 * 19 + seed * 3.3));
        g.lineTo(x, y);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    };
    ridge(70, 118, 1.3, 0.55);
    ridge(48, 124, 4.1, 1);
  });
  t.hasAlpha = true;
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  return t;
}

export function buildSky(ctx: Ctx, parent: Node) {
  const sky = group(ctx, { parent });

  const day = dome(ctx, gradient(ctx, [[0, "#1559c4"], [0.3, "#2f80e6"], [0.45, "#6eb0f5"], [0.52, "#8fc2f5"], [0.6, "#a2cdf5"], [1, "#a2cdf5"]]), "skyDay");
  const night = dome(ctx, gradient(ctx, [[0, "#02040c"], [0.3, "#060b1f"], [0.48, "#101a3a"], [0.58, "#1c2747"], [1, "#1c2747"]]), "skyNight");
  night.mat.alpha = 0;
  night.mesh.alphaIndex = 0;

  // ---- sun
  const sun = place(ctx, MeshBuilder.CreateSphere("sun", { diameter: 46, segments: 16 }, ctx.scene), {
    parent: sky,
    pos: [SUN_DIR.x * 800, SUN_DIR.y * 800, SUN_DIR.z * 800],
    mat: unlit(ctx, { color: "#fff4c2", fog: false }),
  });
  sun.isPickable = false;
  const sunMat = sun.material as StandardMaterial;
  const sunGlow = sprite(ctx, glowTexture(ctx, true), { parent: sky, pos: [SUN_DIR.x * 790, SUN_DIR.y * 790, SUN_DIR.z * 790], color: "#ffe9a0", opacity: 0.9, additive: true, size: [520, 520], fog: false });
  // a second, tighter halo: the dazzling ring round the disc
  const sunCore = sprite(ctx, glowTexture(ctx, true), { parent: sky, pos: [SUN_DIR.x * 795, SUN_DIR.y * 795, SUN_DIR.z * 795], color: "#fffbe8", opacity: 1, additive: true, size: [150, 150], fog: false });
  sunCore.isPickable = false;
  const sunGlowMat = sunGlow.material as StandardMaterial;

  // ---- moon
  // a real moon map (NASA LRO imagery, via the three.js examples)
  const moonTex = new Texture("/img/moon.jpg", ctx.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  const moonMat = unlit(ctx, { map: moonTex, opaque: true, fog: false });
  moonMat.emissiveColor = new Color3(1.15, 1.15, 1.2);
  const moon = place(ctx, MeshBuilder.CreateSphere("moon", { diameter: 62, segments: 32 }, ctx.scene), {
    parent: sky,
    pos: [MOON_DIR.x * 760, MOON_DIR.y * 760, MOON_DIR.z * 760],
    rot: [0, 2.2, 0.3],
    mat: moonMat,
  });
  moon.isPickable = false;
  const moonGlow = sprite(ctx, glowTexture(ctx, true), { parent: sky, pos: [MOON_DIR.x * 750, MOON_DIR.y * 750, MOON_DIR.z * 750], color: "#9fb4ff", opacity: 0.5, additive: true, size: [300, 300], fog: false });
  const moonGlowMat = moonGlow.material as StandardMaterial;

  // ---- stars (upper hemisphere), twinkling
  const N = 1400;
  const positions = new Float32Array(N * 3);
  const sizes = new Float32Array(N);
  const phases = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = hash(i, 101) * Math.PI * 2;
    const el = Math.asin(0.04 + hash(i, 102) * 0.96);
    positions[i * 3] = Math.cos(a) * Math.cos(el) * 400;
    positions[i * 3 + 1] = Math.sin(el) * 400;
    positions[i * 3 + 2] = Math.sin(a) * Math.cos(el) * 400;
    sizes[i] = 0.5 + Math.pow(hash(i, 103), 6) * 2.4;
    phases[i] = hash(i, 104);
  }
  const stars = points(ctx, { positions, sizes, phases, color: "#ffffff", opacity: 0, speed: 0.6, pixel: 2.2 });
  stars.parent = sky;
  const starMat = stars.material as ShaderMaterial;

  // ---- clouds: soft cumulus puffs, each one a single billboard
  const cloudTex = canvasTexture(ctx, 256, 128, (g) => {
    g.clearRect(0, 0, 256, 128);
    for (let i = 0; i < 26; i++) {
      const x = 40 + hash(i, 61) * 176;
      const y = 50 + hash(i, 62) * 40 - Math.sin(((x - 40) / 176) * Math.PI) * 22;
      const r = 18 + hash(i, 63) * 26;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,255,255,0.95)");
      grd.addColorStop(0.6, "rgba(250,252,255,0.7)");
      grd.addColorStop(1, "rgba(235,242,252,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // a slightly grey, flat underside
    const under = g.createLinearGradient(0, 70, 0, 110);
    under.addColorStop(0, "rgba(180,190,205,0)");
    under.addColorStop(1, "rgba(160,172,190,0.35)");
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = under;
    g.fillRect(0, 70, 256, 58);
    g.globalCompositeOperation = "source-over";
  });
  const clouds: StandardMaterial[] = [];
  for (let i = 0; i < 26; i++) {
    const a = hash(i, 31) * Math.PI * 2;
    const el = 0.08 + hash(i, 32) * 0.4;
    const r = 700;
    const w = 220 + hash(i, 33) * 200;
    const s = sprite(ctx, cloudTex, {
      parent: sky,
      pos: [Math.cos(a) * r * Math.cos(el), Math.sin(el) * r, Math.sin(a) * r * Math.cos(el)],
      color: "#ffffff",
      opacity: 0.95,
      size: [w, w * 0.45],
      fog: false,
    });
    clouds.push(s.material as StandardMaterial);
  }

  // ---- mountains on the horizon
  const band = MeshBuilder.CreateCylinder("mountains", { diameter: 840, height: 70, tessellation: 64, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE }, ctx.scene);
  band.parent = sky;
  band.position.y = 22;
  band.isPickable = false;
  band.setEnabled(false); // replaced by real 3D mountains (Mountains.ts)
  const bandMat = unlit(ctx, { map: mountainTexture(ctx), color: "#8fa6c0", fog: false, double: true });
  bandMat.disableDepthWrite = true;
  band.material = bandMat;
  const uvs = band.getVerticesData("uv")!;
  for (let i = 0; i < uvs.length; i += 2) uvs[i] *= 2;
  band.setVerticesData("uv", uvs);

  const hazeDay = Color3.FromHexString("#7f9fc4");
  const hazeNight = Color3.FromHexString("#141c33");
  const cloudDay = new Color3(1, 1, 1);
  const cloudNight = Color3.FromHexString("#3a4561");
  ctx.onFrame(() => {
    // also drawn indoors: the living room's window looks out onto the garden
    const out = true;
    sky.setEnabled(out);
    day.mesh.setEnabled(out);
    night.mesh.setEnabled(out && ctx.night > 0.002);
    if (!out) return;
    sky.position.copyFrom(ctx.camera.position);
    const n = ctx.night;
    night.mat.alpha = n;
    const dayVis = Math.max(0, 1 - n * 1.6);
    sun.setEnabled(dayVis > 0.01);
    sunCore.setEnabled(dayVis > 0.01);
    sun.visibility = dayVis;
    // HDR-bright disc: through ACES tone mapping it reads as a blazing white-gold sun
    sunMat.emissiveColor.set(3.2 * dayVis, 2.8 * dayVis, 1.9 * dayVis);
    sunGlow.setEnabled(dayVis > 0.01);
    sunGlowMat.emissiveColor.set(dayVis * 0.9, dayVis * 0.83, dayVis * 0.56);
    const moonVis = Math.max(0, n * 1.6 - 0.6);
    moon.setEnabled(moonVis > 0.01);
    moon.visibility = Math.min(1, moonVis);
    moonGlow.setEnabled(moonVis > 0.01);
    moonGlowMat.emissiveColor.set(0.31 * moonVis, 0.35 * moonVis, 0.5 * moonVis);
    stars.setEnabled(n > 0.05);
    starMat.setFloat("uOpacity", Math.max(0, n * 1.3 - 0.3));
    Color3.LerpToRef(cloudDay, cloudNight, n, clouds[0].emissiveColor);
    for (const c of clouds) {
      c.emissiveColor.copyFrom(clouds[0].emissiveColor);
      c.alpha = 0.95 - n * 0.55;
    }
    Color3.LerpToRef(hazeDay, hazeNight, n, bandMat.emissiveColor);
  });
  return sky;
}
