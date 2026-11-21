import { Color4, Matrix, MeshBuilder, ParticleSystem, Quaternion, Texture, Vector3, VertexBuffer, type Node } from "@babylonjs/core";
import { playCrunch } from "./sound";
import { canvasTexture, glowTexture, hash, lit, unlit, type Ctx, type DebrisApi } from "./core";

type V3 = [number, number, number];

/** Linear colours of what flies off: the wall's concrete and its red and white paint, asphalt, soil. */
const CONCRETE: V3 = [0.48, 0.47, 0.42];
const RED: V3 = [0.58, 0.03, 0.026];
const WHITE: V3 = [0.86, 0.85, 0.8];
const ASPHALT: V3 = [0.045, 0.048, 0.055];
const SOIL: V3 = [0.15, 0.09, 0.05];

const G = 9.8 * 1.5; // a touch heavier than real: chunks that fly and land, not float

/** A rough, faceted lump of about 1 m: the shape every chunk is (scaled down a lot). */
function chunkMesh(ctx: Ctx) {
  const m = MeshBuilder.CreateIcoSphere("chunk", { radius: 0.5, subdivisions: 1, flat: true }, ctx.scene);
  const pos = m.getVerticesData(VertexBuffer.PositionKind)!;
  // squash and dent it (the same dent for the same corner, so the faces stay closed)
  for (let i = 0; i < pos.length; i += 3) {
    const k = Math.round(pos[i] * 97 + pos[i + 1] * 57 + pos[i + 2] * 31);
    const r = 0.7 + hash(k, 3) * 0.55;
    pos[i] *= r * 1.15;
    pos[i + 1] *= r * 0.7;
    pos[i + 2] *= r;
  }
  m.setVerticesData(VertexBuffer.PositionKind, pos);
  const nor: number[] = [];
  const idx = m.getIndices()!;
  // flat normals again after the dents
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    // (the icosphere's winding: keep normals pointing out)
    const cx = pos[a] + pos[b] + pos[c], cy = pos[a + 1] + pos[b + 1] + pos[c + 1], cz = pos[a + 2] + pos[b + 2] + pos[c + 2];
    const s = nx * cx + ny * cy + nz * cz < 0 ? -1 : 1;
    for (const v of [a, b, c]) {
      nor[v] = nx * s;
      nor[v + 1] = ny * s;
      nor[v + 2] = nz * s;
    }
  }
  m.setVerticesData(VertexBuffer.NormalKind, nor);
  return m;
}

/** A crack in the concrete with the paint chipped off round it and a black tyre scuff. */
function crackTexture(ctx: Ctx) {
  const S = 256;
  const t = canvasTexture(ctx, S, S, (g) => {
    g.clearRect(0, 0, S, S);
    // tyre scuff
    const scuff = g.createRadialGradient(S / 2, S * 0.62, 4, S / 2, S * 0.62, S * 0.42);
    scuff.addColorStop(0, "rgba(12,12,14,0.55)");
    scuff.addColorStop(1, "rgba(12,12,14,0)");
    g.fillStyle = scuff;
    g.beginPath();
    g.ellipse(S / 2, S * 0.62, S * 0.46, S * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    // chipped paint and dust round the point of impact
    for (let i = 0; i < 70; i++) {
      const a = hash(i, 5) * Math.PI * 2, r = Math.pow(hash(i, 6), 1.6) * S * 0.3;
      g.fillStyle = hash(i, 7) > 0.5 ? "rgba(70,66,60,0.55)" : "rgba(150,146,138,0.5)";
      const w = 2 + hash(i, 8) * 9;
      g.fillRect(S / 2 + Math.cos(a) * r - w / 2, S / 2 + Math.sin(a) * r - w / 2, w, w * (0.5 + hash(i, 9)));
    }
    // the cracks: jagged lines out from the middle, forking
    g.strokeStyle = "rgba(18,16,14,0.9)";
    g.lineCap = "round";
    const crack = (x: number, y: number, a: number, len: number, w: number, seed: number, depth: number) => {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        a += (hash(seed + k, 11) - 0.5) * 0.9;
        x += Math.cos(a) * len / 6;
        y += Math.sin(a) * len / 6;
        g.lineTo(x, y);
        if (depth < 2 && hash(seed + k, 12) > 0.72) crack(x, y, a + (hash(seed + k, 13) - 0.5) * 1.6, len * 0.5, w * 0.6, seed * 7 + k, depth + 1);
      }
      g.stroke();
    };
    for (let i = 0; i < 7; i++) crack(S / 2, S / 2, (i / 7) * Math.PI * 2 + hash(i, 14), S * (0.22 + hash(i, 15) * 0.2), 3, i * 31 + 1, 0);
    // a dark dent in the middle
    const dent = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.1);
    dent.addColorStop(0, "rgba(20,18,16,0.85)");
    dent.addColorStop(1, "rgba(20,18,16,0)");
    g.fillStyle = dent;
    g.fillRect(0, 0, S, S);
  });
  t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE;
  return t;
}

/**
 * Hit a wall and it breaks: chunks of concrete and paint and bits of the road fly off — how many,
 * how big and how fast depends on how hard you hit — tumble, bounce and settle, then crumble away;
 * a puff of dust, sparks, and a crack left in the wall. Scraping along a wall throws sparks and grit.
 * Everything is pooled: no allocation while driving.
 */
export function buildDebris(ctx: Ctx, parent: Node) {
  const N = 140;
  // ---- chunks: one thin-instanced mesh, a colour per chunk
  const mesh = chunkMesh(ctx);
  mesh.parent = parent;
  const mat = lit(ctx, { color: "#ffffff", rough: 0.92 });
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  mesh.alwaysSelectAsActiveMesh = true;
  const mats = new Float32Array(N * 16);
  const cols = new Float32Array(N * 4).fill(1);
  mesh.thinInstanceSetBuffer("matrix", mats, 16, false);
  mesh.thinInstanceSetBuffer("color", cols, 4, false);
  const P = new Float32Array(N * 3), Vv = new Float32Array(N * 3), W = new Float32Array(N * 3);
  const Q = Array.from({ length: N }, () => new Quaternion());
  const size = new Float32Array(N), life = new Float32Array(N), floor = new Float32Array(N);
  const resting = new Uint8Array(N);
  let next = 0;
  let alive = 0;
  const tmpM = new Matrix(), tmpS = new Vector3(), tmpP = new Vector3(), dq = new Quaternion();
  const zero = Matrix.Scaling(0, 0, 0);
  for (let i = 0; i < N; i++) zero.copyToArray(mats, i * 16);
  mesh.thinInstanceBufferUpdated("matrix");

  // ---- dust and sparks
  const dust = new ParticleSystem("dust", 320, ctx.scene);
  dust.particleTexture = glowTexture(ctx);
  dust.emitter = new Vector3(0, -100, 0);
  dust.emitRate = 0;
  dust.minLifeTime = 0.9;
  dust.maxLifeTime = 1.8;
  dust.minSize = 0.7;
  dust.maxSize = 1.8;
  dust.addSizeGradient(0, 0.6);
  dust.addSizeGradient(1, 2.4);
  dust.color1 = new Color4(0.62, 0.59, 0.53, 0.5);
  dust.color2 = new Color4(0.5, 0.47, 0.42, 0.42);
  dust.colorDead = new Color4(0.55, 0.52, 0.47, 0);
  dust.gravity = new Vector3(0, 0.5, 0);
  dust.minEmitPower = 0.6;
  dust.maxEmitPower = 2.6;
  dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  dust.minAngularSpeed = -1;
  dust.maxAngularSpeed = 1;
  dust.start();

  const sparks = new ParticleSystem("sparks", 260, ctx.scene);
  sparks.particleTexture = glowTexture(ctx);
  sparks.emitter = new Vector3(0, -100, 0);
  sparks.emitRate = 0;
  sparks.minLifeTime = 0.18;
  sparks.maxLifeTime = 0.5;
  sparks.minSize = 0.05;
  sparks.maxSize = 0.14;
  sparks.color1 = new Color4(1, 0.86, 0.5, 1);
  sparks.color2 = new Color4(1, 0.55, 0.15, 1);
  sparks.colorDead = new Color4(0.8, 0.2, 0.02, 0);
  sparks.gravity = new Vector3(0, -12, 0);
  sparks.minEmitPower = 3;
  sparks.maxEmitPower = 11;
  sparks.blendMode = ParticleSystem.BLENDMODE_ADD;
  sparks.start();

  const burst = (ps: ParticleSystem, p: V3, dir: V3, spread: number, count: number) => {
    (ps.emitter as Vector3).set(p[0], p[1], p[2]);
    ps.direction1.set(dir[0] - spread, dir[1] - spread * 0.3, dir[2] - spread);
    ps.direction2.set(dir[0] + spread, dir[1] + spread, dir[2] + spread);
    ps.manualEmitCount = Math.max(ps.manualEmitCount, 0) + count;
  };

  // ---- cracks left in the wall
  const DECALS = 10;
  const crackMat = unlit(ctx, { map: crackTexture(ctx), depthWrite: false, double: true });
  crackMat.zOffset = -3; // drawn just in front of the wall face, never flickering into it
  const decals = Array.from({ length: DECALS }, () => {
    // (its 1.3 : 1 shape is in the mesh: scaled uniformly, it never needs another shader variant)
    const d = MeshBuilder.CreatePlane("crack", { width: 1.3, height: 1 }, ctx.scene);
    d.parent = parent;
    d.material = crackMat;
    d.isPickable = false;
    d.rotationQuaternion = new Quaternion();
    d.setEnabled(false);
    return { mesh: d, age: 0 };
  });
  let nextDecal = 0;

  const spawn = (p: V3, v: V3, s: number, c: V3, lifeS: number, fl: number) => {
    const i = next;
    next = (next + 1) % N;
    P[i * 3] = p[0];
    P[i * 3 + 1] = p[1];
    P[i * 3 + 2] = p[2];
    Vv[i * 3] = v[0];
    Vv[i * 3 + 1] = v[1];
    Vv[i * 3 + 2] = v[2];
    const spin = 4 + Math.random() * 10;
    W[i * 3] = (Math.random() - 0.5) * spin;
    W[i * 3 + 1] = (Math.random() - 0.5) * spin;
    W[i * 3 + 2] = (Math.random() - 0.5) * spin;
    Quaternion.RotationYawPitchRollToRef(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3, Q[i]);
    size[i] = s;
    life[i] = lifeS;
    floor[i] = fl;
    resting[i] = 0;
    cols[i * 4] = c[0] * (0.85 + Math.random() * 0.3);
    cols[i * 4 + 1] = c[1] * (0.85 + Math.random() * 0.3);
    cols[i * 4 + 2] = c[2] * (0.85 + Math.random() * 0.3);
  };

  const api: DebrisApi = {
    hit(p, n, up, speed, fl, carVel) {
      if (speed < 3) return;
      const k = Math.min(1, (speed - 3) / 22); // 0 a knock … 1 flat out
      // along the wall
      const a: V3 = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]];
      // the car's momentum carries the bits on along the wall (not through it)
      const cvIn = carVel ?? [0, 0, 0];
      const cvA = cvIn[0] * a[0] + cvIn[1] * a[1] + cvIn[2] * a[2];
      const cv: V3 = [a[0] * cvA, a[1] * cvA, a[2] * cvA];
      const count = Math.round(4 + k * 34);
      for (let j = 0; j < count; j++) {
        const along = (Math.random() - 0.5) * (0.8 + k * 2.4);
        const high = 0.1 + Math.random() * 1.3;
        const pos: V3 = [p[0] + a[0] * along + up[0] * high + n[0] * 0.08, p[1] + a[1] * along + up[1] * high + n[1] * 0.08, p[2] + a[2] * along + up[2] * high + n[2] * 0.08];
        const out = 1.5 + Math.random() * (2 + speed * 0.32);
        const lift = 1 + Math.random() * (1.5 + speed * 0.28);
        const side = (Math.random() - 0.5) * (1 + speed * 0.3);
        const vel: V3 = [n[0] * out + up[0] * lift + a[0] * side + cv[0] * 0.35, n[1] * out + up[1] * lift + a[1] * side + cv[1] * 0.35, n[2] * out + up[2] * lift + a[2] * side + cv[2] * 0.35];
        const r = Math.random();
        const colour = high > 1.05 ? (r < 0.5 ? RED : WHITE) : r < 0.75 ? CONCRETE : r < 0.88 ? RED : WHITE; // the top band is painted
        spawn(pos, vel, 0.07 + Math.pow(Math.random(), 2.2) * (0.1 + k * 0.38), colour, 3.5 + Math.random() * 3, fl);
      }
      // bits of the road surface where the wheels dug in
      const grit = Math.round(2 + k * 14);
      for (let j = 0; j < grit; j++) {
        const along = (Math.random() - 0.5) * 2.5;
        const off = 0.4 + Math.random() * 1.6;
        const pos: V3 = [p[0] + a[0] * along + n[0] * off, fl + 0.05, p[2] + a[2] * along + n[2] * off];
        const vel: V3 = [n[0] * (1 + Math.random() * 3) + cv[0] * 0.25 + (Math.random() - 0.5) * 2, 2 + Math.random() * (2 + speed * 0.2), n[2] * (1 + Math.random() * 3) + cv[2] * 0.25 + (Math.random() - 0.5) * 2];
        spawn(pos, vel, 0.04 + Math.random() * 0.09, Math.random() < 0.7 ? ASPHALT : SOIL, 2.5 + Math.random() * 2, fl);
      }
      const mid: V3 = [p[0] + up[0] * 0.6 + n[0] * 0.3, p[1] + up[1] * 0.6 + n[1] * 0.3, p[2] + up[2] * 0.6 + n[2] * 0.3];
      burst(dust, mid, [n[0] * 1.2 + up[0], n[1] * 1.2 + up[1], n[2] * 1.2 + up[2]], 0.9, Math.round(6 + k * 30));
      burst(sparks, mid, [n[0] + up[0] * 0.6, n[1] + up[1] * 0.6, n[2] + up[2] * 0.6], 0.8, Math.round(8 + k * 46));
      // a crack where it hit, bigger for a harder hit
      if (speed > 6) {
        const d = decals[nextDecal];
        nextDecal = (nextDecal + 1) % DECALS;
        const sz = 1 + k * 2;
        d.mesh.scaling.setAll(sz);
        d.mesh.position.set(p[0] + up[0] * 0.55 + n[0] * 0.03, p[1] + up[1] * 0.55 + n[1] * 0.03, p[2] + up[2] * 0.55 + n[2] * 0.03);
        // the plane's x along the wall, y up, its face out of the wall
        Quaternion.RotationQuaternionFromAxisToRef(new Vector3(a[0], a[1], a[2]), new Vector3(up[0], up[1], up[2]), new Vector3(n[0], n[1], n[2]), d.mesh.rotationQuaternion!);
        d.mesh.visibility = 1;
        d.age = 0;
        d.mesh.setEnabled(true);
      }
      playCrunch(k);
    },
    scrape(p, n, up, speed, fl) {
      if (speed < 6) return;
      const k = Math.min(1, (speed - 6) / 20);
      burst(sparks, [p[0] + up[0] * 0.35 + n[0] * 0.1, p[1] + up[1] * 0.35 + n[1] * 0.1, p[2] + up[2] * 0.35 + n[2] * 0.1], [n[0] * 0.6 + up[0] * 0.5, n[1] * 0.6 + up[1] * 0.5, n[2] * 0.6 + up[2] * 0.5], 0.6, Math.round(2 + k * 7));
      if (Math.random() < 0.35) burst(dust, [p[0] + up[0] * 0.4, p[1] + up[1] * 0.4, p[2] + up[2] * 0.4], [n[0] * 0.5 + up[0] * 0.6, n[1] * 0.5 + up[1] * 0.6, n[2] * 0.5 + up[2] * 0.6], 0.5, 1);
      if (Math.random() < 0.25 + k * 0.4) {
        const v: V3 = [n[0] * (1 + Math.random() * 2) + up[0] * 2, n[1] * (1 + Math.random() * 2) + up[1] * 2, n[2] * (1 + Math.random() * 2) + up[2] * 2];
        spawn([p[0] + up[0] * 0.4 + n[0] * 0.1, p[1] + up[1] * 0.4 + n[1] * 0.1, p[2] + up[2] * 0.4 + n[2] * 0.1], v, 0.05 + Math.random() * 0.06, Math.random() < 0.6 ? CONCRETE : RED, 2 + Math.random() * 1.5, fl);
      }
    },
  };
  ctx.debris = api;

  ctx.onFrame((dt) => {
    // ---- chunks: fly, tumble, bounce, settle, crumble away
    alive = 0;
    let dirty = false;
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      dirty = true;
      life[i] -= dt;
      if (life[i] <= 0) {
        zero.copyToArray(mats, i * 16);
        continue;
      }
      alive++;
      const o = i * 3;
      const s = size[i];
      if (!resting[i]) {
        Vv[o + 1] -= G * dt;
        // a little air drag
        const drag = Math.pow(0.85, dt);
        Vv[o] *= drag;
        Vv[o + 2] *= drag;
      }
      P[o] += Vv[o] * dt;
      P[o + 1] += Vv[o + 1] * dt;
      P[o + 2] += Vv[o + 2] * dt;
      const bottom = floor[i] + s * 0.3;
      if (P[o + 1] < bottom) {
        P[o + 1] = bottom;
        if (Vv[o + 1] < 0) {
          // bounce, losing most of it; then roll to a stop
          Vv[o + 1] = -Vv[o + 1] * 0.3;
          Vv[o] *= 0.6;
          Vv[o + 2] *= 0.6;
          W[o] *= 0.55;
          W[o + 1] *= 0.55;
          W[o + 2] *= 0.55;
          if (Vv[o + 1] < 0.9) {
            Vv[o + 1] = 0;
            resting[i] = 1;
          }
        }
      }
      if (resting[i]) {
        const f = Math.pow(0.004, dt);
        Vv[o] *= f;
        Vv[o + 2] *= f;
        W[o] *= f;
        W[o + 1] *= f;
        W[o + 2] *= f;
      }
      // tumble
      const wl = Math.hypot(W[o], W[o + 1], W[o + 2]);
      if (wl > 1e-3) {
        Quaternion.RotationAxisToRef(tmpP.set(W[o] / wl, W[o + 1] / wl, W[o + 2] / wl), wl * dt, dq);
        dq.multiplyToRef(Q[i], Q[i]);
      }
      // crumble away at the end
      const sc = s * Math.min(1, life[i] / 0.6);
      tmpS.setAll(sc);
      tmpP.set(P[o], P[o + 1], P[o + 2]);
      Matrix.ComposeToRef(tmpS, Q[i], tmpP, tmpM);
      tmpM.copyToArray(mats, i * 16);
    }
    if (dirty) {
      mesh.thinInstanceBufferUpdated("matrix");
      mesh.thinInstanceBufferUpdated("color");
    }
    mesh.setEnabled(alive > 0);

    // ---- cracks: stay a while, then fade
    for (const d of decals) {
      if (!d.mesh.isEnabled()) continue;
      d.age += dt;
      if (d.age > 25) {
        d.mesh.visibility = Math.max(0, 1 - (d.age - 25) / 5);
        if (d.mesh.visibility <= 0) d.mesh.setEnabled(false);
      }
    }
  });

  return {
    /** For the start screen: true once the dust and sparks' shaders are compiled. */
    ready: () => dust.isReady() && sparks.isReady(),
  };
}
