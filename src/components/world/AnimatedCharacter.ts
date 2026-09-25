import "@babylonjs/loaders/glTF";
import { PBRMaterial, SceneLoader, TransformNode, type Node } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { box, canvasTexture, clamp, cone, cylinder, group, lerp, lit, pointLight, setEuler, torus, unlit, type Ctx } from "./core";
import type { FlightSignal } from "./flightSignal";
import { PITCH_MAX, PITCH_MIN, type WorldInput } from "./WorldInputContext";
import { setLoading } from "./loadingSignal";

const MODEL_ROOT = "/models/";
const MODEL_FILE = "soldier.glb";

const ARM_SWING = Math.PI * 0.62;
const BODY_TILT_BOOST = (Math.PI / 2) * 0.42;
const MODEL_SCALE = 1.0;
const ACCENT = "#7fe3ff";

export interface CharacterState {
  moving: boolean;
  running: boolean;
  jumping: boolean;
  flying: boolean;
  superman: boolean;
}

// ---- three.js "XYZ" Euler <-> quaternion, so arm overrides match the original.
function quatToEulerXYZ(q: { x: number; y: number; z: number; w: number }) {
  const { x, y, z, w } = q;
  const m11 = 1 - 2 * (y * y + z * z);
  const m12 = 2 * (x * y - z * w);
  const m13 = 2 * (x * z + y * w);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w);
  const m32 = 2 * (y * z + x * w);
  const m33 = 1 - 2 * (x * x + y * y);
  const ey = Math.asin(clamp(m13, -1, 1));
  if (Math.abs(m13) < 0.9999999) return [Math.atan2(-m23, m33), ey, Math.atan2(-m12, m11)] as const;
  return [Math.atan2(m32, m22), ey, 0] as const;
}

function flameTexture(ctx: Ctx) {
  return canvasTexture(ctx, 128, 128, (g) => {
    const s = 128;
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,250,220,1)");
    grd.addColorStop(0.35, "rgba(255,170,60,0.9)");
    grd.addColorStop(0.7, "rgba(255,90,40,0.5)");
    grd.addColorStop(1, "rgba(255,60,30,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

/** Wing-shaped jetpack at the waist; only visible while flight mode is active. */
function buildJetpack(ctx: Ctx, parent: Node, flightRef: MutableRefObject<FlightSignal>) {
  const root = group(ctx, { parent, pos: [0, 1.04, -0.05] });
  root.setEnabled(false);
  const g = group(ctx, { parent: root, scale: 0.58 });
  const dark = () => lit(ctx, { color: "#20242c", rough: 0.35, metal: 0.7 });
  const accent = (ei: number) => lit(ctx, { color: ACCENT, emissive: ACCENT, ei });

  box(ctx, 0.34, 0.4, 0.24, { parent: g, mat: dark() });
  box(ctx, 0.2, 0.05, 0.02, { parent: g, pos: [0, 0.08, 0.13], mat: accent(1.8) });
  const ringMat = accent(1.7);
  torus(ctx, 0.1, 0.015, 20, { parent: g, pos: [0, -0.03, 0.13], rot: [0, 0, Math.PI / 2], mat: ringMat });

  for (const side of [1, -1]) {
    const w = group(ctx, { parent: g, pos: [0.18 * side, 0.18, -0.08], rot: [0.1, side * 0.12, side * -0.32] });
    box(ctx, 1.35, 0.07, 0.58, { parent: w, pos: [0.78 * side, 0.05, -0.16], rot: [0, side * 0.12, 0], mat: lit(ctx, { color: "#20242c", rough: 0.3, metal: 0.75 }) });
    box(ctx, 0.95, 0.05, 0.4, { parent: w, pos: [0.58 * side, 0.2, -0.04], rot: [0.32, side * 0.1, side * 0.15], mat: lit(ctx, { color: "#282d37", rough: 0.3, metal: 0.7 }) });
    box(ctx, 1.3, 0.03, 0.035, { parent: w, pos: [0.78 * side, 0.05, -0.45], rot: [0, side * 0.12, 0], mat: accent(1.9) });
  }

  cylinder(ctx, 0.11, 0.15, 0.2, 12, { parent: g, pos: [0, -0.08, -0.28], rot: [Math.PI / 2, 0, 0], mat: lit(ctx, { color: "#1c1f26", rough: 0.4, metal: 0.75 }) });
  const cone_ = cone(ctx, 0.22, 1.1, 12, { parent: g, pos: [0, -0.08, -0.85], rot: [Math.PI / 2, 0, 0], mat: unlit(ctx, { color: "#ffb347", map: flameTexture(ctx), opacity: 0.9, additive: true, depthWrite: false, double: true, fog: false }) }, true);
  const light = pointLight(ctx, g, [0, -0.08, -0.8], "#ff9d4a", 1.8, 4.5);
  light.setEnabled(false);

  ctx.onFrame((_, t) => {
    const active = flightRef.current.active;
    root.setEnabled(active);
    light.setEnabled(active);
    if (!active) return;
    const flare = 0.85 + Math.sin(t * 32) * 0.12 + Math.random() * 0.08;
    cone_.scaling.set(flare, 1.05 + Math.random() * 0.2, flare);
    light.intensity = (1.8 + flare * 1.3) / Math.PI;
    ringMat.emissiveIntensity = 1.7 + Math.sin(t * 6) * 0.5;
  });
}

export async function buildAnimatedCharacter(
  ctx: Ctx,
  parent: Node,
  deps: { input: MutableRefObject<WorldInput>; flightRef: MutableRefObject<FlightSignal>; state: CharacterState }
) {
  const { input, flightRef, state } = deps;
  const tilt = group(ctx, { parent });
  const scaled = group(ctx, { parent: tilt, scale: MODEL_SCALE });

  buildJetpack(ctx, scaled, flightRef);

  setLoading(0, true);
  const result = await SceneLoader.ImportMeshAsync("", MODEL_ROOT, MODEL_FILE, ctx.scene, (e) => {
    if (e.lengthComputable && e.total > 0) setLoading(Math.min(99, (e.loaded / e.total) * 100), true);
  });
  result.animationGroups.forEach((g) => g.stop());
  const root = result.meshes[0];
  root.parent = scaled;

  for (const mesh of result.meshes) {
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.receiveShadows = true;
    if (ctx.shadow) ctx.shadow.addShadowCaster(mesh);
    const m = mesh.material;
    if (m instanceof PBRMaterial) {
      m.environmentIntensity = 0.3;
      m.maxSimultaneousLights = 8;
    }
  }

  const bone = (name: string) => result.transformNodes.find((n: TransformNode) => n.name.replace(":", "") === name) ?? null;
  const armL = bone("mixamorigLeftArm");
  const armR = bone("mixamorigRightArm");
  const restL = armL?.rotationQuaternion ? quatToEulerXYZ(armL.rotationQuaternion)[0] : 0;
  const restR = armR?.rotationQuaternion ? quatToEulerXYZ(armR.rotationQuaternion)[0] : 0;

  // Full-body Mixamo clips; Babylon's blending smooths every switch.
  const clip = (n: string) => result.animationGroups.find((g) => g.name === n);
  const clips = { Idle: clip("Idle"), Walk: clip("Walk"), Run: clip("Run") };
  Object.values(clips).forEach((c) => {
    if (c) c.enableBlending = true;
    if (c) c.blendingSpeed = 0.08;
  });
  let current: keyof typeof clips | null = null;

  let poseT = 0;
  let tiltT = 0;
  const applyArm = (node: TransformNode | null, rest: number, amount: number) => {
    if (!node?.rotationQuaternion) return;
    const [, ey, ez] = quatToEulerXYZ(node.rotationQuaternion);
    setEuler(node, rest - amount, ey, ez);
  };

  ctx.scene.onBeforeAnimationsObservable.add(() => {
    const target: keyof typeof clips = state.jumping ? "Idle" : state.running ? "Run" : state.moving ? "Walk" : "Idle";
    if (target === current) return;
    clips[current ?? "Idle"]?.stop();
    clips[target]?.start(true, 1);
    current = target;
  });

  ctx.scene.onAfterAnimationsObservable.add(() => {
    const dt = Math.min(ctx.scene.getEngine().getDeltaTime() / 1000, 0.1);
    const smoothing = 1 - Math.pow(0.0008, dt);
    // Arms stay raised for the whole flight; only the body tilt is tied to the boost dive.
    poseT = lerp(poseT, state.flying ? 1 : 0, smoothing);
    tiltT = lerp(tiltT, state.superman ? 1 : 0, smoothing);
    // As the camera pitches overhead the right arm eases out of the raised pose.
    const pitchT = clamp((input.current.look.pitch - PITCH_MIN) / (PITCH_MAX - PITCH_MIN), 0, 1);
    applyArm(armL, restL, ARM_SWING * poseT);
    applyArm(armR, restR, ARM_SWING * poseT * (1 - pitchT));
    setEuler(tilt, tiltT * BODY_TILT_BOOST, 0, 0);
  });

  setLoading(100, false);
  return tilt;
}
