"use client";

import "@babylonjs/loaders/glTF";
import { useEffect, useRef, useState } from "react";
import {
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  FreeCamera,
  HemisphericLight,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  ParticleSystem,
  PointLight,
  Ray,
  Scene,
  SceneLoader,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  Constants,
  type AnimationGroup,
  type AssetContainer,
  type PBRMaterial,
} from "@babylonjs/core";

// ---------------------------------------------------------------- tuning
const ARENA = 34;
const PLAYER_R = 0.4;
const EYE = 1.7;
const WALK = 3.9;
const RUN = 6.8;
const GRAVITY = 22;
const JUMP_V = 7.4;
const BOT_SPEED = 3.0;
const BOT_RUN = 5.2;

type WeaponId = "knife" | "pistol" | "rifle";
const WEAPONS: Record<WeaponId, { name: string; slot: number; mag: number; delay: number; reload: number; dmg: number; auto: boolean; range: number }> = {
  knife: { name: "Pichoq", slot: 1, mag: 0, delay: 0.5, reload: 0, dmg: 55, auto: false, range: 2.4 },
  pistol: { name: "Pistolet", slot: 2, mag: 12, delay: 0.24, reload: 1.3, dmg: 28, auto: false, range: 150 },
  rifle: { name: "Avtomat", slot: 3, mag: 30, delay: 0.1, reload: 1.9, dmg: 34, auto: true, range: 150 },
};

interface Bot {
  id: number;
  root: TransformNode;
  anims: Record<string, AnimationGroup | undefined>;
  cur: string;
  hp: number;
  alive: boolean;
  deathT: number;
  cd: number;
  target: Vector3;
  phase: number;
  flash: Mesh;
  flashT: number;
  gun: TransformNode;
  arms: ArmRig | null;
  kick: number;
}

interface ArmRig {
  rArm: TransformNode;
  rFore: TransformNode;
  rHand: TransformNode;
  lArm: TransformNode;
  lFore: TransformNode;
  lHand: TransformNode;
}

interface Hud {
  hp: number;
  ammo: number;
  mag: number;
  weapon: WeaponId;
  kills: number;
  wave: number;
  reloading: boolean;
  dead: boolean;
  locked: boolean;
  hit: number;
  hurt: number;
  alive: number;
  ready: boolean;
  tp: boolean;
}

function blip(freq: number, dur: number, vol = 0.05, type: OscillatorType = "square") {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const a = new AC();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.3), a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
    setTimeout(() => a.close(), dur * 1000 + 200);
  } catch {
    /* audio is optional */
  }
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export default function CsGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<Hud>({ hp: 100, ammo: 30, mag: 30, weapon: "rifle", kills: 0, wave: 1, reloading: false, dead: false, locked: false, hit: 0, hurt: 0, alive: 0, ready: false, tp: false });
  const api = useRef<{ restart: () => void; lock: () => void } | null>(null);

  useEffect(() => {
    let disposed = false;
    const canvas = canvasRef.current!;
    const engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: true }, true);
    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString("#a9c4dcff");
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogColor = Color3.FromHexString("#c9d6de");
    scene.fogStart = 40;
    scene.fogEnd = 110;

    const pos = new Vector3(0, EYE, 28); // the player (the camera follows it)
    const camera = new FreeCamera("cam", pos.clone(), scene);
    camera.minZ = 0.03;
    camera.fov = 1.1;
    const hemi = new HemisphericLight("h", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.62;
    hemi.groundColor = new Color3(0.5, 0.42, 0.32);
    const sun = new DirectionalLight("s", new Vector3(-0.5, -1, -0.35), scene);
    sun.intensity = 0.85;

    // ------------------------------------------------ procedural textures
    const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const t = new DynamicTexture("t", { width: w, height: h }, scene, true);
      draw(t.getContext() as CanvasRenderingContext2D);
      t.update();
      t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
      return t;
    };
    const speckle = (g: CanvasRenderingContext2D, w: number, h: number, base: string, n: number, spread: number) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < n; i++) {
        const v = Math.floor(rnd(-spread, spread));
        g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
        g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 6), rnd(1, 6));
      }
    };
    const texPlaster = canvasTex(256, 256, (g) => {
      speckle(g, 256, 256, "#c9a877", 1800, 40);
      g.fillStyle = "rgba(120,90,50,0.10)";
      for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 3);
    });
    const texBrick = canvasTex(256, 256, (g) => {
      speckle(g, 256, 256, "#b98a55", 1200, 35);
      g.strokeStyle = "rgba(70,45,25,0.55)";
      g.lineWidth = 3;
      for (let y = 0; y <= 256; y += 32) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(256, y);
        g.stroke();
        for (let x = (y / 32) % 2 ? 0 : 32; x < 256; x += 64) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 32);
          g.stroke();
        }
      }
    });
    const texFloor = canvasTex(256, 256, (g) => speckle(g, 256, 256, "#b39a69", 2600, 45));
    const texCrate = canvasTex(256, 256, (g) => {
      speckle(g, 256, 256, "#8b6236", 900, 30);
      g.strokeStyle = "#4b3319";
      g.lineWidth = 12;
      g.strokeRect(6, 6, 244, 244);
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(6, 6);
      g.lineTo(250, 250);
      g.moveTo(250, 6);
      g.lineTo(6, 250);
      g.stroke();
      g.lineWidth = 3;
      for (let y = 64; y < 256; y += 64) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(256, y);
        g.stroke();
      }
    });
    const texMetal = canvasTex(256, 256, (g) => {
      speckle(g, 256, 256, "#476048", 700, 25);
      g.fillStyle = "rgba(0,0,0,0.25)";
      for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 6, 256);
    });
    const texSiteA = canvasTex(256, 256, (g) => {
      g.clearRect(0, 0, 256, 256);
      g.fillStyle = "rgba(255,200,40,0.9)";
      g.font = "bold 220px sans-serif";
      g.textAlign = "center";
      g.fillText("A", 128, 210);
    });
    const glowTex = canvasTex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, "rgba(255,255,255,1)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    });
    const starTex = canvasTex(128, 128, (g) => {
      g.translate(64, 64);
      const r = g.createRadialGradient(0, 0, 0, 0, 0, 60);
      r.addColorStop(0, "rgba(255,255,230,1)");
      r.addColorStop(0.3, "rgba(255,190,70,0.9)");
      r.addColorStop(1, "rgba(255,120,0,0)");
      g.fillStyle = r;
      for (let i = 0; i < 6; i++) {
        g.rotate(Math.PI / 3);
        g.beginPath();
        g.moveTo(0, -6);
        g.lineTo(60, 0);
        g.lineTo(0, 6);
        g.closePath();
        g.fill();
      }
      g.beginPath();
      g.arc(0, 0, 22, 0, Math.PI * 2);
      g.fill();
    });

    const std = (hex: string, spec = 0, power = 32) => {
      const m = new StandardMaterial("m", scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.specularColor = new Color3(spec, spec, spec);
      m.specularPower = power;
      return m;
    };
    const texMat = (t: Texture, spec = 0.05) => {
      const m = new StandardMaterial("tm", scene);
      m.diffuseTexture = t;
      m.specularColor = new Color3(spec, spec, spec);
      return m;
    };
    const matCache = new Map<Texture, StandardMaterial>();
    const matFor = (t: Texture) => {
      let m = matCache.get(t);
      if (!m) matCache.set(t, (m = texMat(t)));
      return m;
    };
    /** Tile a mesh's texture (shared material) by scaling its UVs. */
    const tileUV = (mesh: Mesh, u: number, v: number) => {
      const uv = mesh.getVerticesData("uv");
      if (!uv) return;
      for (let i = 0; i < uv.length; i += 2) {
        uv[i] *= u;
        uv[i + 1] *= v;
      }
      mesh.setVerticesData("uv", uv);
    };

    // ------------------------------------------------------------- map
    const floor = MeshBuilder.CreateGround("floor", { width: ARENA * 2 + 8, height: ARENA * 2 + 8 }, scene);
    floor.material = matFor(texFloor);
    tileUV(floor, 30, 30);
    floor.isPickable = false;
    const solids: Mesh[] = [];
    const aabbs: { x0: number; x1: number; z0: number; z1: number }[] = [];
    const wall = (x: number, z: number, w: number, d: number, h: number, kind: "plaster" | "brick" | "crate" | "metal", solid = true, y0 = 0) => {
      const mesh = MeshBuilder.CreateBox("solid", { width: w, depth: d, height: h }, scene);
      mesh.position.set(x, y0 + h / 2, z);
      const len = Math.max(w, d);
      const t = kind === "plaster" ? texPlaster : kind === "brick" ? texBrick : kind === "crate" ? texCrate : texMetal;
      mesh.material = matFor(t);
      tileUV(mesh, kind === "crate" ? Math.max(1, len / 2.4) : Math.max(1, len / 4), Math.max(1, h / 4));
      if (solid) {
        solids.push(mesh);
        aabbs.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
      }
      return mesh;
    };
    const A = ARENA;
    wall(0, -A - 1, A * 2 + 4, 2, 6, "plaster");
    wall(0, A + 1, A * 2 + 4, 2, 6, "plaster");
    wall(-A - 1, 0, 2, A * 2, 6, "plaster");
    wall(A + 1, 0, 2, A * 2, 6, "plaster");
    // mid buildings with a doorway tunnel (lintels above head height)
    for (const sx of [-1, 1]) {
      wall(sx * 9, -11, 8, 11, 5.5, "brick");
      wall(sx * 9, 5, 8, 11, 5.5, "brick");
      wall(sx * 9, -4.5, 8, 4.4, 2.4, "brick", false, 3.1);
      wall(sx * 9, -4.5, 8, 4.4, 5.5, "plaster", false, 5.5);
    }
    // Long A corridor + B tunnels
    wall(18, -12, 1.2, 30, 5, "plaster");
    wall(-19, -6, 1.2, 30, 5, "plaster");
    wall(-27, 4, 1.2, 20, 5, "plaster");
    wall(-23, -22, 7, 1.2, 5, "brick");
    // site A: platform of crates
    for (const [x, z, s, k] of [[22, 16, 3, "crate"], [25.5, 19, 2.2, "crate"], [29, 15, 2.6, "metal"], [24, 26, 2.2, "crate"], [30, 25, 3, "metal"], [20, 24, 2, "crate"]] as [number, number, number, "crate" | "metal"][]) wall(x, z, s, s, s, k);
    wall(31, 20, 1.4, 12, 4, "brick");
    const siteA = MeshBuilder.CreateGround("siteA", { width: 8, height: 8 }, scene);
    siteA.position.set(25, 0.02, 21.5);
    const sm = new StandardMaterial("sa", scene);
    sm.diffuseTexture = texSiteA;
    texSiteA.hasAlpha = true;
    sm.useAlphaFromDiffuseTexture = true;
    sm.emissiveColor = new Color3(0.7, 0.55, 0.1);
    siteA.material = sm;
    siteA.isPickable = false;
    // cover + spawn
    for (const [x, z, w, d, h] of [
      [-6, 26, 4, 1.2, 2.4], [6, 26, 4, 1.2, 2.4], [0, 14, 2.4, 2.4, 2.4], [-13, 18, 2.4, 2.4, 2.4],
      [13, 20, 3, 1.2, 2.6], [-14, -14, 2.4, 2.4, 2.4], [14, -22, 3, 1.2, 2.6], [0, -12, 6, 1.2, 2.6],
      [-4, -22, 2.4, 2.4, 2.4], [6, -28, 4, 1.2, 2.6], [-24, 20, 2.4, 2.4, 2.4], [8, 8, 2.2, 2.2, 2.2],
    ] as number[][]) wall(x, z, w, d, h, "crate");

    const blocked = (x: number, z: number, r: number) =>
      Math.abs(x) > A - r || Math.abs(z) > A - r || aabbs.some((a) => x > a.x0 - r && x < a.x1 + r && z > a.z0 - r && z < a.z1 + r);

    // ------------------------------------------------------- weapons
    const metal = std("#2a2d33", 0.7, 80);
    const steel = std("#b9bec6", 0.9, 96);
    const wood = std("#6a4322", 0.15, 16);
    const grip = std("#15161a", 0.2, 16);
    const box = (p: TransformNode, w: number, h: number, d: number, x: number, y: number, z: number, m: StandardMaterial, rx = 0) => {
      const b = MeshBuilder.CreateBox("wp", { width: w, height: h, depth: d }, scene);
      b.parent = p;
      b.position.set(x, y, z);
      b.rotation.x = rx;
      b.material = m;
      b.isPickable = false;
      return b;
    };
    const cyl = (p: TransformNode, r: number, len: number, x: number, y: number, z: number, m: StandardMaterial) => {
      const c = MeshBuilder.CreateCylinder("wp", { diameter: r * 2, height: len, tessellation: 14 }, scene);
      c.parent = p;
      c.rotation.x = Math.PI / 2;
      c.position.set(x, y, z);
      c.material = m;
      c.isPickable = false;
      return c;
    };
    const makeWeapon = (kind: WeaponId) => {
      const root = new TransformNode("w_" + kind, scene);
      const muzzle = new TransformNode("muzzle", scene);
      muzzle.parent = root;
      if (kind === "knife") {
        box(root, 0.012, 0.055, 0.26, 0, 0.01, 0.22, steel);
        box(root, 0.012, 0.03, 0.06, 0, 0.0, 0.37, steel, 0.4);
        box(root, 0.03, 0.03, 0.13, 0, 0, 0.03, grip);
        box(root, 0.07, 0.02, 0.02, 0, 0, 0.1, metal);
        muzzle.position.set(0, 0, 0.4);
      } else if (kind === "pistol") {
        box(root, 0.036, 0.05, 0.24, 0, 0.045, 0.06, metal); // slide
        box(root, 0.034, 0.035, 0.2, 0, 0.005, 0.04, grip); // frame
        box(root, 0.034, 0.12, 0.055, 0, -0.06, -0.03, grip, 0.22); // grip
        box(root, 0.02, 0.02, 0.03, 0, 0.078, 0.14, steel); // front sight
        box(root, 0.02, 0.018, 0.02, 0, 0.078, -0.04, steel); // rear sight
        cyl(root, 0.011, 0.05, 0, 0.045, 0.2, steel);
        muzzle.position.set(0, 0.045, 0.24);
      } else {
        box(root, 0.05, 0.075, 0.42, 0, 0, 0.05, metal); // receiver
        cyl(root, 0.013, 0.42, 0, 0.02, 0.44, steel); // barrel
        box(root, 0.058, 0.055, 0.26, 0, -0.005, 0.28, wood); // handguard
        box(root, 0.04, 0.16, 0.06, 0, -0.12, 0.06, metal, 0.35); // magazine
        box(root, 0.042, 0.09, 0.3, 0, -0.01, -0.3, wood, -0.1); // stock
        box(root, 0.034, 0.1, 0.05, 0, -0.08, -0.08, grip, 0.3); // grip
        box(root, 0.02, 0.035, 0.03, 0, 0.055, 0.6, steel); // front sight
        box(root, 0.03, 0.03, 0.04, 0, 0.055, -0.02, steel); // rear sight
        cyl(root, 0.02, 0.07, 0, 0.02, 0.66, metal); // muzzle brake
        muzzle.position.set(0, 0.02, 0.7);
      }
      return { root, muzzle };
    };
    const flashMat = new StandardMaterial("fm", scene);
    flashMat.diffuseTexture = starTex;
    starTex.hasAlpha = true;
    flashMat.useAlphaFromDiffuseTexture = true;
    flashMat.emissiveColor = new Color3(1, 1, 1);
    flashMat.disableLighting = true;
    flashMat.alphaMode = Constants.ALPHA_ADD;
    const makeFlash = (parent: TransformNode, size: number) => {
      const f = MeshBuilder.CreatePlane("flash", { size }, scene);
      f.parent = parent;
      f.billboardMode = Mesh.BILLBOARDMODE_ALL;
      f.material = flashMat;
      f.isPickable = false;
      f.setEnabled(false);
      return f;
    };

    const views: Record<WeaponId, { root: TransformNode; muzzle: TransformNode; flash: Mesh }> = {} as never;
    const viewPose: Record<WeaponId, [number, number, number, number]> = { knife: [0.24, -0.22, 0.45, 0.35], pistol: [0.2, -0.2, 0.45, 0], rifle: [0.19, -0.2, 0.5, 0] };
    (Object.keys(WEAPONS) as WeaponId[]).forEach((k) => {
      const w = makeWeapon(k);
      w.root.parent = camera;
      w.root.position.set(viewPose[k][0], viewPose[k][1], viewPose[k][2]);
      w.root.setEnabled(false);
      views[k] = { ...w, flash: makeFlash(w.muzzle, 0.28) };
    });
    const muzzleLight = new PointLight("ml", Vector3.Zero(), scene);
    muzzleLight.diffuse = new Color3(1, 0.7, 0.3);
    muzzleLight.intensity = 0;
    muzzleLight.range = 12;
    muzzleLight.parent = camera;
    muzzleLight.position.set(0.2, -0.1, 0.9);

    const tracer = MeshBuilder.CreateBox("tracer", { width: 0.012, height: 0.012, depth: 1 }, scene);
    const trm = new StandardMaterial("tr", scene);
    trm.emissiveColor = new Color3(1, 0.85, 0.4);
    trm.disableLighting = true;
    tracer.material = trm;
    tracer.isPickable = false;
    tracer.setEnabled(false);
    let tracerT = 0;

    // --------------------------------------------------------- blood
    const blood = new ParticleSystem("blood", 700, scene);
    blood.particleTexture = glowTex;
    blood.emitter = new Vector3(0, -50, 0);
    blood.minEmitBox = new Vector3(-0.05, -0.05, -0.05);
    blood.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
    blood.color1 = new Color4(0.95, 0.02, 0.02, 1);
    blood.color2 = new Color4(0.7, 0, 0, 1);
    blood.colorDead = new Color4(0.2, 0, 0, 0);
    blood.minSize = 0.05;
    blood.maxSize = 0.16;
    blood.minLifeTime = 0.35;
    blood.maxLifeTime = 0.9;
    blood.emitRate = 0;
    blood.gravity = new Vector3(0, -14, 0);
    blood.direction1 = new Vector3(-1.5, 1.5, -1.5);
    blood.direction2 = new Vector3(1.5, 3.5, 1.5);
    blood.minEmitPower = 1.2;
    blood.maxEmitPower = 4.2;
    blood.updateSpeed = 0.02;
    blood.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    blood.start();
    const spurt = (p: Vector3, n: number) => {
      blood.emitter = p.clone();
      blood.manualEmitCount = n;
    };
    const poolMat = new StandardMaterial("pool", scene);
    poolMat.diffuseColor = new Color3(0.32, 0.02, 0.02);
    poolMat.specularColor = new Color3(0.5, 0.15, 0.15);
    poolMat.alpha = 0.92;
    const pools: { mesh: Mesh; t: number; s: number }[] = [];
    const addPool = (x: number, z: number) => {
      const m = MeshBuilder.CreateDisc("pool", { radius: 1, tessellation: 20 }, scene);
      m.rotation.x = Math.PI / 2;
      m.position.set(x, 0.015 + pools.length * 0.0005, z);
      m.scaling.setAll(0.05);
      m.material = poolMat;
      m.isPickable = false;
      pools.push({ mesh: m, t: 0, s: rnd(0.5, 0.9) });
      if (pools.length > 14) pools.shift()!.mesh.dispose();
    };

    // ---------------------------------------------------- humans
    let container: AssetContainer | null = null;
    const bots: Bot[] = [];
    let nextId = 1;
    const tint = (root: TransformNode, c: Color3) => {
      root.getChildMeshes().forEach((m) => {
        const mt = m.material as PBRMaterial | null;
        if (mt && "albedoColor" in mt) mt.albedoColor = mt.albedoColor.multiply(c);
      });
    };
    const spawnHuman = (id: number, team: Color3, gunKind: WeaponId) => {
      const res = container!.instantiateModelsToScene((n) => `${n}_${id}`, true);
      const root = new TransformNode("human" + id, scene);
      const model = res.rootNodes[0] as TransformNode;
      model.parent = root;
      tint(model, team);
      const anims: Record<string, AnimationGroup | undefined> = {};
      for (const g of res.animationGroups) {
        g.stop();
        const base = g.name.replace(/_\d+$/, "");
        anims[base] = g;
      }
      const nodes = model.getChildTransformNodes(false);
      const bone = (n: string) => nodes.find((x) => x.name.endsWith(`${n}_${id}`));
      const rig = { rArm: bone("RightArm"), rFore: bone("RightForeArm"), rHand: bone("RightHand"), lArm: bone("LeftArm"), lFore: bone("LeftForeArm"), lHand: bone("LeftHand") };
      const arms = Object.values(rig).every(Boolean) ? (rig as ArmRig) : null;
      // rifle held ready in front of the chest (barrel forward), always level with the body
      const gun = makeWeapon(gunKind);
      gun.root.parent = root;
      gun.root.rotation.y = Math.PI;
      gun.root.position.set(-0.1, 1.3, -0.42);
      const flash = makeFlash(gun.muzzle, 0.5);
      return { root, anims, flash, model, gun: gun.root, arms };
    };
    const play = (anims: Record<string, AnimationGroup | undefined>, cur: string, next: string) => {
      if (cur === next) return cur;
      anims[cur]?.stop();
      anims[next]?.start(true, 1);
      return next;
    };

    let hero: ReturnType<typeof spawnHuman> | null = null;
    let heroAnim = "Idle";

    const game = {
      hp: 100, kills: 0, wave: 1, dead: false, yaw: Math.PI, pitch: 0, hit: 0, hurt: 0, kick: 0, tp: false,
      keys: new Set<string>(), vy: 0, air: 0, sprint: false, down: false, locked: false, weapon: "rifle" as WeaponId, cd: 0, reloading: 0, swap: 0, swing: 0,
      ammo: { pistol: 12, rifle: 30, knife: 0 } as Record<WeaponId, number>,
    };

    const spawnPoint = () => {
      for (let i = 0; i < 60; i++) {
        const x = rnd(-A + 3, A - 3);
        const z = rnd(-A + 3, 8);
        if (!blocked(x, z, 1.2) && Math.hypot(x - pos.x, z - pos.z) > 24) return new Vector3(x, 0, z);
      }
      return new Vector3(0, 0, -25);
    };
    const pickTarget = (b: Bot) => {
      for (let i = 0; i < 25; i++) {
        const x = rnd(-A + 3, A - 3);
        const z = rnd(-A + 3, A - 3);
        if (!blocked(x, z, 1)) return b.target.set(x, 0, z);
      }
      return b.target;
    };
    const hitboxMat = new StandardMaterial("hb", scene);
    const makeBot = () => {
      const id = nextId++;
      const h = spawnHuman(id, new Color3(1, 0.62, 0.5), "rifle");
      const bot: Bot = { id, root: h.root, anims: h.anims, cur: "", hp: 100, alive: true, deathT: 0, cd: rnd(1, 2), target: new Vector3(), phase: rnd(0, 6), flash: h.flash, flashT: 0, gun: h.gun, arms: h.arms, kick: 0 };
      bot.cur = play(bot.anims, "", "Idle");
      const body = MeshBuilder.CreateBox("hitbody", { width: 0.75, height: 1.25, depth: 0.5 }, scene);
      body.parent = h.root;
      body.position.y = 0.85;
      const head = MeshBuilder.CreateSphere("hithead", { diameter: 0.32 }, scene);
      head.parent = h.root;
      head.position.y = 1.62;
      for (const [m, isHead] of [[body, false], [head, true]] as [Mesh, boolean][]) {
        m.material = hitboxMat;
        m.visibility = 0;
        m.isPickable = true;
        m.metadata = { bot, head: isHead };
      }
      return bot;
    };
    const startWave = () => {
      bots.forEach((b) => b.root.dispose(false, true));
      bots.length = 0;
      const n = Math.min(9, 4 + game.wave);
      for (let i = 0; i < n; i++) {
        const b = makeBot();
        b.root.position.copyFrom(spawnPoint());
        pickTarget(b);
        bots.push(b);
      }
    };
    const setWeapon = (w: WeaponId) => {
      if (game.weapon === w || game.dead) return;
      game.weapon = w;
      game.reloading = 0;
      game.swap = 1;
      (Object.keys(views) as WeaponId[]).forEach((k) => views[k].root.setEnabled(k === w && !game.tp));
    };
    const restart = () => {
      game.hp = 100;
      game.kills = 0;
      game.wave = 1;
      game.dead = false;
      game.ammo = { pistol: 12, rifle: 30, knife: 0 };
      game.reloading = 0;
      pos.set(0, EYE, 28);
      game.yaw = Math.PI;
      game.pitch = 0;
      pools.splice(0).forEach((p) => p.mesh.dispose());
      if (container) startWave();
    };

    (async () => {
      try {
        container = await SceneLoader.LoadAssetContainerAsync("/models/", "soldier.glb", scene);
        if (disposed) return;
        hero = spawnHuman(0, new Color3(0.55, 0.72, 1), "rifle");
        hero.root.setEnabled(false);
        heroAnim = play(hero.anims, "", "Idle");
        views.rifle.root.setEnabled(true);
        startWave();
        setHud((h) => ({ ...h, ready: true }));
      } catch (e) {
        console.error("cs models", e);
      }
    })();

    const lock = () => canvas.requestPointerLock?.();
    api.current = { restart, lock };

    // ------------------------------------------------------- shooting
    const doHit = (bot: Bot, head: boolean, dmg: number, at: Vector3) => {
      if (!bot.alive) return;
      bot.hp -= head ? 100 : dmg;
      game.hit = head ? 2 : 1;
      spurt(at, head ? 40 : 22);
      blip(head ? 900 : 520, 0.06, 0.05, "triangle");
      if (bot.hp <= 0) {
        bot.alive = false;
        bot.deathT = 0;
        bot.cur = play(bot.anims, bot.cur, "Idle");
        bot.anims.Idle?.pause();
        game.kills++;
        spurt(bot.root.position.add(new Vector3(0, 1.2, 0)), 90);
        addPool(bot.root.position.x, bot.root.position.z);
      }
    };
    const fire = () => {
      const W = WEAPONS[game.weapon];
      if (game.dead || game.reloading > 0 || game.cd > 0 || !game.locked || game.swap > 0.6) return;
      if (game.weapon === "knife") {
        game.cd = W.delay;
        game.swing = 1;
        blip(320, 0.09, 0.03, "sawtooth");
        const ray = scene.createPickingRay(engine.getRenderWidth() / 2, engine.getRenderHeight() / 2, null, camera);
        ray.length = W.range;
        const hit = scene.pickWithRay(ray, (m) => m.isPickable && !!m.metadata?.bot);
        const bot = hit?.pickedMesh?.metadata?.bot as Bot | undefined;
        if (bot && hit?.pickedPoint) doHit(bot, false, W.dmg, hit.pickedPoint);
        return;
      }
      if (game.ammo[game.weapon] <= 0) {
        game.reloading = W.reload;
        return;
      }
      game.ammo[game.weapon]--;
      game.cd = W.delay;
      game.kick = 1;
      const v = views[game.weapon];
      if (!game.tp) v.flash.setEnabled(true);
      muzzleLight.intensity = 2.2;
      blip(game.weapon === "pistol" ? 260 : 190, 0.12, 0.06, "sawtooth");
      const spread = (game.weapon === "pistol" ? 0.004 : 0.008) + game.kick * 0.004 + (game.keys.size > 1 ? 0.006 : 0);
      const ray = scene.createPickingRay(engine.getRenderWidth() / 2, engine.getRenderHeight() / 2, null, camera);
      ray.direction.x += rnd(-spread, spread);
      ray.direction.y += rnd(-spread, spread);
      ray.length = W.range;
      const hit = scene.pickWithRay(ray, (m) => m.isPickable && m.isEnabled() && (!!m.metadata?.bot || solids.includes(m as Mesh)));
      const end = hit?.pickedPoint ?? ray.origin.add(ray.direction.scale(60));
      // tracer from the muzzle
      const from = game.tp && hero ? hero.root.position.add(new Vector3(0, 1.4, 0)) : v.muzzle.getAbsolutePosition();
      const dir = end.subtract(from);
      tracer.position.copyFrom(from.add(dir.scale(0.5)));
      tracer.scaling.z = dir.length();
      tracer.lookAt(end);
      tracer.setEnabled(true);
      tracerT = 0.05;
      const bot = hit?.pickedMesh?.metadata?.bot as Bot | undefined;
      if (bot && hit?.pickedPoint) doHit(bot, !!hit.pickedMesh!.metadata.head, W.dmg, hit.pickedPoint);
      game.pitch -= game.weapon === "pistol" ? 0.012 : 0.004;
      if (game.ammo[game.weapon] === 0) game.reloading = W.reload;
    };

    // ---------------------------------------------------------- input
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Digit1") setWeapon("knife");
      if (e.code === "Digit2") setWeapon("pistol");
      if (e.code === "Digit3") setWeapon("rifle");
      if (e.code === "Space" && !e.repeat && !game.dead && game.air <= 0.001) game.vy = JUMP_V;
      if (e.code === "KeyV") {
        game.tp = !game.tp;
        (Object.keys(views) as WeaponId[]).forEach((k) => views[k].root.setEnabled(k === game.weapon && !game.tp));
      }
      const W = WEAPONS[game.weapon];
      if (e.code === "KeyR" && !game.dead && game.reloading <= 0 && W.mag && game.ammo[game.weapon] < W.mag) game.reloading = W.reload;
      if (e.code === "Enter" && game.dead) restart();
      game.keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => game.keys.delete(e.code);
    const onMove = (e: MouseEvent) => {
      if (!game.locked) return;
      game.yaw += e.movementX * 0.0022;
      game.pitch = Math.max(-1.4, Math.min(1.4, game.pitch + e.movementY * 0.0022));
    };
    const onDown = () => (game.locked ? (game.down = true) : lock());
    const onUp = () => (game.down = false);
    const onLockChange = () => {
      game.locked = document.pointerLockElement === canvas;
      if (!game.locked) game.down = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("pointerlockchange", onLockChange);
    lock();

    // ---- procedural arm aiming: after the clips run, swing both arms so the hands reach the rifle
    const AIMT = { rUp: [0.45, 0.3, -0.85], rFore: [0.92, -0.3, 0.12], lUp: [0.5, -0.25, -0.85], lFore: [0.97, 0.12, 0.1] };
    const qTmp = new Quaternion();
    const mR = new Matrix();
    let ikVariant = -1;
    const aimBone = (bone: TransformNode, child: TransformNode, dir: Vector3) => {
      bone.computeWorldMatrix(true);
      child.computeWorldMatrix(true);
      const cur = child.getAbsolutePosition().subtract(bone.getAbsolutePosition());
      if (cur.lengthSquared() < 1e-10) return;
      cur.normalize();
      Quaternion.FromUnitVectorsToRef(cur, dir, qTmp);
      qTmp.toRotationMatrix(mR);
      const parent = bone.parent as TransformNode;
      parent.computeWorldMatrix(true);
      const pw = parent.getWorldMatrix();
      const pwi = pw.clone().invert();
      const lq = bone.rotationQuaternion ?? Quaternion.FromEulerVector(bone.rotation);
      const lfull = Matrix.Compose(bone.scaling, lq, bone.position);
      const w = lfull.multiply(pw);
      const p = bone.getAbsolutePosition();
      const t1 = Matrix.Translation(-p.x, -p.y, -p.z);
      const t2 = Matrix.Translation(p.x, p.y, p.z);
      const mRi = mR.clone().invert();
      const measure = () => {
        bone.computeWorldMatrix(true);
        child.computeWorldMatrix(true);
        return child.getAbsolutePosition().subtract(bone.getAbsolutePosition()).normalize();
      };
      const sc = new Vector3();
      const ps = new Vector3();
      const tryR = (R: Matrix) => {
        const q = new Quaternion();
        w.multiply(t1).multiply(R).multiply(t2).multiply(pwi).decompose(sc, q, ps);
        bone.rotationQuaternion = q;
        return { q, d: Vector3.Dot(measure(), dir) };
      };
      const order = ikVariant >= 0 ? [ikVariant] : [0, 1];
      let best = { q: lq.clone(), d: -2 };
      for (const k of order) {
        const r = tryR(k === 0 ? mR : mRi);
        if (r.d > best.d) {
          best = r;
          if (ikVariant < 0 && r.d > 0.99 && Vector3.Dot(cur, dir) < 0.9) ikVariant = k;
        }
      }
      bone.rotationQuaternion = best.q;
      measure();
    };
    const armDir = (a: number[], f: Vector3, r: Vector3) => new Vector3(f.x * a[0] + r.x * a[1], a[2], f.z * a[0] + r.z * a[1]).normalize();
    scene.onAfterAnimationsObservable.add(() => {
      for (const b of bots) {
        if (!b.alive || !b.arms) continue;
        const ry = b.root.rotation.y;
        const f = new Vector3(-Math.sin(ry), 0, -Math.cos(ry));
        const r = new Vector3(f.z, 0, -f.x);
        const A = b.arms;
        aimBone(A.rArm, A.rFore, armDir(AIMT.rUp, f, r));
        aimBone(A.rFore, A.rHand, armDir(AIMT.rFore, f, r));
        aimBone(A.lArm, A.lFore, armDir(AIMT.lUp, f, r));
        aimBone(A.lFore, A.lHand, armDir(AIMT.lFore, f, r));
      }
    });

    // ----------------------------------------------------------- frame
    let waveTimer = 0;
    let moving = false;
    const eye = new Vector3();
    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
      const W = WEAPONS[game.weapon];
      game.cd = Math.max(0, game.cd - dt);
      game.hit = Math.max(0, game.hit - dt * 4);
      game.hurt = Math.max(0, game.hurt - dt * 1.8);
      game.kick = Math.max(0, game.kick - dt * 9);
      game.swap = Math.max(0, game.swap - dt * 3.2);
      game.swing = Math.max(0, game.swing - dt * 5);
      muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 40);
      Object.values(views).forEach((v) => v.flash.isEnabled() && game.kick < 0.55 && v.flash.setEnabled(false));
      if (tracerT > 0 && (tracerT -= dt) <= 0) tracer.setEnabled(false);
      if (game.reloading > 0) {
        game.reloading -= dt;
        if (game.reloading <= 0 && W.mag) game.ammo[game.weapon] = W.mag;
      }
      if (game.down && (W.auto || game.cd === 0)) {
        fire();
        if (!W.auto) game.down = false;
      }

      moving = false;
      if (!game.dead) {
        const k = game.keys;
        const f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
        const s = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
        const len = Math.hypot(f, s) || 1;
        moving = f !== 0 || s !== 0;
        const sprint = (k.has("ShiftLeft") || k.has("ShiftRight")) && f > 0;
        const sp = (sprint ? RUN : WALK) * (game.weapon === "knife" ? 1.12 : 1);
        game.sprint = sprint;
        const dx = ((Math.sin(game.yaw) * f + Math.cos(game.yaw) * s) / len) * sp * dt;
        const dz = ((Math.cos(game.yaw) * f - Math.sin(game.yaw) * s) / len) * sp * dt;
        if (!blocked(pos.x + dx, pos.z, PLAYER_R)) pos.x += dx;
        if (!blocked(pos.x, pos.z + dz, PLAYER_R)) pos.z += dz;
      }
      game.vy -= GRAVITY * dt;
      game.air = Math.max(0, game.air + game.vy * dt);
      if (game.air <= 0) game.vy = Math.max(0, game.vy);
      const px = pos.x;
      const pz = pos.z;
      const bob = moving && game.air <= 0.001 ? Math.sin(performance.now() / (game.sprint ? 85 : 120)) * (game.sprint ? 0.045 : 0.03) : 0;
      camera.fov += ((game.sprint && moving ? 1.2 : 1.1) - camera.fov) * Math.min(1, dt * 8);
      camera.rotation.y = game.yaw;
      camera.rotation.x = game.pitch;
      if (game.tp && hero) {
        const fx = Math.sin(game.yaw);
        const fz = Math.cos(game.yaw);
        camera.position.set(px - fx * 3.2 + fz * 0.6, EYE + 0.5 + bob + game.air, pz - fz * 3.2 - fx * 0.6);
        hero.root.setEnabled(true);
        hero.root.position.set(px, game.air, pz);
        hero.root.rotation.y = game.yaw + Math.PI;
        heroAnim = play(hero.anims, heroAnim, game.dead ? "Idle" : moving ? (game.sprint ? "Run" : "Walk") : "Idle");
      } else {
        camera.position.set(px, EYE + bob + game.air, pz);
        hero?.root.setEnabled(false);
      }
      // view-model kick / swap / knife swing
      const v = views[game.weapon];
      const pose = viewPose[game.weapon];
      v.root.position.set(pose[0], pose[1] - game.swap * 0.25 + game.kick * 0.012, pose[2] - game.kick * 0.05);
      v.root.rotation.set(-game.kick * 0.06 - game.swing * 0.9 + (game.weapon === "knife" ? pose[3] : 0), game.swing * 0.5, game.swing * -0.4);

      // pools grow
      for (const p of pools) {
        p.t = Math.min(1, p.t + dt * 1.4);
        p.mesh.scaling.setAll(0.05 + p.s * p.t);
      }

      // ---- bots
      eye.set(px, EYE + game.air, pz);
      let aliveCount = 0;
      for (const b of bots) {
        const p = b.root.position;
        if (!b.alive) {
          b.deathT = Math.min(1, b.deathT + dt * 2.2);
          b.root.rotation.x = -b.deathT * (Math.PI / 2 - 0.1);
          b.root.position.y = 0.12 * b.deathT;
          continue;
        }
        aliveCount++;
        const dx = eye.x - p.x;
        const dz = eye.z - p.z;
        const dist = Math.hypot(dx, dz);
        let sees = false;
        if (!game.dead && dist < 55) {
          const from = new Vector3(p.x, 1.6, p.z);
          const dir = new Vector3(dx, eye.y - 1.6, dz);
          const ray = new Ray(from, dir.normalize(), dist);
          const h = scene.pickWithRay(ray, (m) => solids.includes(m as Mesh));
          sees = !h?.hit;
        }
        let moveX = 0;
        let moveZ = 0;
        let speed = BOT_SPEED;
        let anim = "Idle";
        if (sees) {
          b.root.rotation.y = Math.atan2(dx, dz) + Math.PI;
          if (dist > 14) {
            moveX = dx / dist;
            moveZ = dz / dist;
            anim = "Walk";
          } else if (dist > 5) {
            b.phase += dt;
            const sgn = Math.sin(b.phase * 0.7) > 0 ? 1 : -1;
            moveX = (dz / dist) * sgn * 0.7;
            moveZ = (-dx / dist) * sgn * 0.7;
            anim = "Walk";
          }
          b.cd -= dt;
          if (b.cd <= 0) {
            b.cd = rnd(0.45, 1.1);
            b.kick = 1;
            b.flashT = 0.06;
            b.flash.setEnabled(true);
            blip(150 + rnd(0, 40), 0.1, 0.03, "sawtooth");
            const chance = Math.max(0.1, Math.min(0.5, 0.62 - dist / 70)) * (1 + game.wave * 0.05);
            if (Math.random() < chance) {
              game.hp -= 6 + Math.floor(Math.random() * 5);
              game.hurt = 1;
              if (game.hp <= 0 && !game.dead) {
                game.hp = 0;
                game.dead = true;
                document.exitPointerLock?.();
              }
            }
          }
        } else {
          const tx = b.target.x - p.x;
          const tz = b.target.z - p.z;
          const td = Math.hypot(tx, tz);
          if (td < 1) pickTarget(b);
          else {
            moveX = tx / td;
            moveZ = tz / td;
            b.root.rotation.y = Math.atan2(tx, tz) + Math.PI;
            anim = "Run";
            speed = BOT_RUN;
          }
        }
        if (b.flashT > 0 && (b.flashT -= dt) <= 0) b.flash.setEnabled(false);
        b.kick = Math.max(0, b.kick - dt * 8);
        b.gun.position.z = -0.42 + b.kick * 0.06;
        const nx = p.x + moveX * speed * dt;
        const nz = p.z + moveZ * speed * dt;
        if (!blocked(nx, p.z, 0.5)) p.x = nx;
        else pickTarget(b);
        if (!blocked(p.x, nz, 0.5)) p.z = nz;
        b.cur = play(b.anims, b.cur, anim);
      }
      if (aliveCount === 0 && bots.length && container) {
        waveTimer += dt;
        if (waveTimer > 2.5) {
          waveTimer = 0;
          game.wave++;
          game.hp = Math.min(100, game.hp + 30);
          startWave();
        }
      }
    });

    engine.runRenderLoop(() => scene.render());
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    const hudTimer = setInterval(() => {
      const W = WEAPONS[game.weapon];
      setHud({
        hp: game.hp,
        ammo: game.ammo[game.weapon],
        mag: W.mag,
        weapon: game.weapon,
        kills: game.kills,
        wave: game.wave,
        reloading: game.reloading > 0,
        dead: game.dead,
        locked: game.locked,
        hit: game.hit,
        hurt: game.hurt,
        alive: bots.filter((b) => b.alive).length,
        ready: !!container,
        tp: game.tp,
      });
    }, 80);

    return () => {
      disposed = true;
      clearInterval(hudTimer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.exitPointerLock?.();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  const btn: React.CSSProperties = { padding: "10px 22px", borderRadius: 10, border: "1px solid #7c9bff", background: "rgba(20,26,50,0.9)", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  const txt: React.CSSProperties = { color: "#fff", fontFamily: "var(--font-nav)", fontWeight: 800, textShadow: "0 2px 8px #000" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", outline: "none", cursor: "crosshair" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: `inset 0 0 160px 40px rgba(255,0,0,${hud.hurt * 0.55})` }} />
      {!hud.dead && !hud.tp && (
        <div style={{ position: "absolute", left: "50%", top: "50%", pointerEvents: "none", transform: "translate(-50%,-50%)" }}>
          <div style={{ width: 22, height: 22, position: "relative", opacity: 0.9 }}>
            {[[10, 0, 2, 7], [10, 15, 2, 7], [0, 10, 7, 2], [15, 10, 7, 2]].map(([x, y, w, h], i) => (
              <div key={i} style={{ position: "absolute", left: x, top: y, width: w, height: h, background: hud.hit ? (hud.hit > 1 ? "#ff3b3b" : "#ffd23b") : "#39ff88" }} />
            ))}
          </div>
        </div>
      )}
      <div style={{ ...txt, position: "absolute", left: 24, bottom: 22, fontSize: 30 }}>❤ {Math.max(0, Math.round(hud.hp))}</div>
      <div style={{ ...txt, position: "absolute", right: 24, bottom: 22, fontSize: 30, textAlign: "right" }}>
        <div style={{ fontSize: 14, opacity: 0.85 }}>{["1  Pichoq", "2  Pistolet", "3  Avtomat"].map((s, i) => (
          <span key={s} style={{ marginLeft: 14, padding: "2px 8px", borderRadius: 6, background: ["knife", "pistol", "rifle"][i] === hud.weapon ? "rgba(124,155,255,0.6)" : "transparent" }}>{s}</span>
        ))}</div>
        {hud.reloading ? "Zaryadlanmoqda…" : hud.mag ? `${hud.ammo} / ${hud.mag}` : "∞"}
      </div>
      <div style={{ ...txt, position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", fontSize: 16, textAlign: "center" }}>
        Raund {hud.wave} • Botlar: {hud.alive} • O&apos;ldirildi: {hud.kills}
      </div>
      <div style={{ ...txt, position: "absolute", top: 18, right: 24, fontSize: 12, opacity: 0.8 }}>V — uchinchi shaxs</div>
      {!hud.ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", ...txt, fontSize: 22 }}>Modellar yuklanmoqda…</div>
      )}
      {hud.dead && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "rgba(80,0,0,0.55)", ...txt }}>
          <div style={{ fontSize: 40, fontWeight: 900 }}>Siz o&apos;ldingiz</div>
          <div>Natija: {hud.kills} ta bot • Raund {hud.wave}</div>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={btn} onClick={() => { api.current?.restart(); api.current?.lock(); }}>Qaytadan (Enter)</button>
            <button style={btn} onClick={onExit}>PlayStation&apos;dan chiqish</button>
          </div>
        </div>
      )}
      {hud.ready && !hud.locked && !hud.dead && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "rgba(0,0,0,0.6)", ...txt }}>
          <div style={{ fontSize: 34, fontWeight: 900 }}>Counter-Strike: Botlar</div>
          <div style={{ opacity: 0.85, textAlign: "center", lineHeight: 1.7, fontWeight: 600 }}>
            WASD — yurish • Sichqoncha — qarash • Chap tugma — otish • R — zaryadlash<br />
            1 — pichoq • 2 — pistolet • 3 — avtomat • V — o&apos;zingizni ko&apos;rish • Shift — sekin yurish
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={btn} onClick={() => api.current?.lock()}>O&apos;yinni davom ettirish</button>
            <button style={btn} onClick={onExit}>PlayStation&apos;dan chiqish</button>
          </div>
        </div>
      )}
    </div>
  );
}
