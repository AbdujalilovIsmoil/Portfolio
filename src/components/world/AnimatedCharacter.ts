import "@babylonjs/loaders/glTF";
import "./assets"; // self-hosted Draco/meshopt decoders
import { Color3, MeshBuilder, PBRMaterial, SceneLoader, TransformNode, Vector3, type AbstractMesh, type Node } from "@babylonjs/core";
import { loadContainer } from "./assets";
import { PoseCopy, rigOf, rotateWorld } from "./PoseCopy";
import { faceTrack } from "./faceTrack";
import type { MutableRefObject } from "react";
import { box, canvasTexture, clamp, cone, cylinder, group, lerp, lit, pointLight, setEuler, torus, unlit, type Ctx } from "./core";
import type { FlightSignal } from "./flightSignal";
import { PITCH_MAX, PITCH_MIN, type WorldInput } from "./WorldInputContext";

const MODEL_ROOT = "/models/";
/** The player's body: a realistic avatar (replace public/models/player.glb with your own
 * Mixamo-compatible avatar — e.g. one generated from a selfie — and it is picked up as is). */
const MODEL_FILE = "player.glb";
/** Where the walk / run / idle clips come from (retargeted onto the avatar at load). */
const CLIP_FILE = "anim-male.glb"; // the three.js "Xbot": a neutral, upright idle / walk / run
/** Swimming: body tilt when crawling flat on the water. */
const SWIM_TILT = 1.2; // body ~70° from upright: chest on the water, legs trailing a little lower

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
  /** in the pool */
  swimming: boolean;
  /** 0 = treading water upright … 1 = swimming flat */
  swimT: number;
  /** vertical speed (m/s), for the jump pose */
  vy: number;
  /** climbing the pool ladder; climbT counts rungs (fraction = progress through the current one) */
  climbing: boolean;
  climbT: number;
  /** sitting on a seat */
  sitting: boolean;
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

/**
 * Everyday clothes and a haircut for the stock avatar: burgundy quilted vest, dark jeans, short
 * black hair instead of its hat, clean-shaven but for a little stubble.
 */
function dressPlayer(ctx: Ctx, meshes: AbstractMesh[], nodes: TransformNode[]) {
  const byName = (re: RegExp) => meshes.filter((x) => re.test(x.name));
  const recolor = (re: RegExp, hex: string, keepTexture: boolean) => {
    for (const mesh of byName(re)) {
      const m = mesh.material;
      if (!(m instanceof PBRMaterial)) continue;
      if (!keepTexture) m.albedoTexture = null;
      m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
      m.roughness = 0.85;
    }
  };
  if (!byName(/Wolf3D_Outfit_Top/).length) return; // a custom avatar: leave it exactly as it is
  for (const mesh of byName(/Wolf3D_Headwear|Wolf3D_Beard/)) mesh.setEnabled(false);
  recolor(/Wolf3D_Outfit_Top/, "#3a1820", false);
  recolor(/Wolf3D_Outfit_Bottom/, "#1c2230", false);
  recolor(/Wolf3D_Outfit_Footwear/, "#151515", false);
  // a warmer, sun-tanned skin tone (the texture keeps its detail)
  for (const mesh of byName(/Wolf3D_(Head|Body)/)) {
    const m = mesh.material;
    if (m instanceof PBRMaterial) m.albedoColor = new Color3(0.86, 0.72, 0.6);
  }
  // short black hair: a snug cap on the head bone, a little longer at the back
  const head = nodes.find((n) => n.name.replace(/^mixamorig:?/, "") === "Head");
  if (head) {
    const hair = lit(ctx, { color: "#0d0b0a", rough: 0.75 });
    const cap = MeshBuilder.CreateSphere("hair", { diameter: 0.205, segments: 16, slice: 0.55 }, ctx.scene);
    cap.parent = head;
    cap.position.set(0, 0.125, -0.004);
    cap.scaling.set(1.0, 0.9, 1.08);
    cap.rotation.x = -0.32;
    cap.material = hair;
    cap.isPickable = false;
  }
}

export async function buildAnimatedCharacter(
  ctx: Ctx,
  parent: Node,
  deps: { input: MutableRefObject<WorldInput>; flightRef: MutableRefObject<FlightSignal>; state: CharacterState }
) {
  const { input, flightRef, state } = deps;
  const tilt = group(ctx, { parent });
  const scaled = group(ctx, { parent: tilt, scale: MODEL_SCALE });

  buildJetpack(ctx, tilt, flightRef); // (on the tilt group: the body inside `scaled` may be turned round, see below)

  const [result, clipSource] = await Promise.all([SceneLoader.ImportMeshAsync("", MODEL_ROOT, MODEL_FILE, ctx.scene), loadContainer(ctx, CLIP_FILE)]);
  result.animationGroups.forEach((g) => g.stop());
  const root = result.meshes[0];
  root.parent = scaled;

  for (const mesh of result.meshes) {
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.receiveShadows = true;
    // Excluded from the camera's spring-arm raycast (CameraRig.ts) — otherwise
    // the arm detects the player's own body as a wall and collapses to 0.
    mesh.isPickable = false;
    if (ctx.shadow) ctx.shadow.addShadowCaster(mesh);
    const m = mesh.material;
    if (m instanceof PBRMaterial) {
      m.environmentIntensity = 0.3;
      m.maxSimultaneousLights = 8;
    }
  }
  dressPlayer(ctx, result.meshes, result.transformNodes);

  // ---- motion: a hidden Xbot plays the clips; its pose is copied bone-by-bone onto the avatar
  // (PoseCopy.ts). The avatar's glTF faces +Z, our "forward" is the tilt group's -Z.
  scaled.rotation.y = Math.PI;
  const src = clipSource.instantiateModelsToScene((n) => n, false);
  const srcRoot = src.rootNodes[0] as TransformNode;
  srcRoot.parent = tilt;
  for (const m of srcRoot.getChildMeshes()) {
    m.isVisible = false;
    m.isPickable = false;
  }
  const clip = (n: string) => src.animationGroups.find((g) => g.name === n);
  const clips = { Idle: clip("idle"), Walk: clip("walk"), Run: clip("run") };
  src.animationGroups.forEach((g) => g.stop());
  Object.values(clips).forEach((c) => {
    if (!c) return;
    c.enableBlending = true;
    c.blendingSpeed = 0.08;
  });
  const targetRig = rigOf(root as unknown as TransformNode);
  const copy = new PoseCopy(rigOf(srcRoot), targetRig);
  const B = (n: string) => targetRig.bones.get(n) ?? null;
  let current: keyof typeof clips | null = null;

  ctx.scene.onBeforeAnimationsObservable.add(() => {
    const target: keyof typeof clips = state.swimming || state.jumping ? "Idle" : state.running ? "Run" : state.moving ? "Walk" : "Idle";
    // clip speed follows ground speed: walk clip ≈1.5 m/s, run clip ≈3.0 m/s at ratio 1
    const ratio = state.swimming ? 0.6 : target === "Walk" ? 1.75 / 1.5 : target === "Run" ? (1.75 * 2.2) / 3.0 : 1;
    if (target === current) {
      if (clips[target]) clips[target]!.speedRatio = ratio;
      return;
    }
    clips[current ?? "Idle"]?.stop();
    clips[target]?.start(true, ratio);
    current = target;
  });

  // reusable vectors
  const fwd = new Vector3();
  const right = new Vector3();
  const up = Vector3.Up();
  let poseT = 0;
  let tiltT = 0;
  let swimTilt = 0;
  let swimW = 0;
  let jumpW = 0;
  let headYaw = 0, headPitch = 0, headRoll = 0;
  let sitW = 0;
  let climbW = 0;
  const lf = new Vector3();
  const rf = new Vector3();
  /** Turn the thighs in until the ankles are hip-width apart (≈ 22 cm), whatever the source does. */
  function narrowStance() {
    const L = B("LeftFoot"), R = B("RightFoot"), LU = B("LeftUpLeg"), RU = B("RightUpLeg");
    if (!L || !R || !LU || !RU) return;
    L.computeWorldMatrix(true);
    R.computeWorldMatrix(true);
    lf.copyFrom(L.getAbsolutePosition());
    rf.copyFrom(R.getAbsolutePosition());
    const d = rf.subtract(lf);
    d.y = 0;
    const sep = d.length();
    const excess = sep - 0.26;
    // only standing still: in a walk or run the source's own foot placement is right
    if (excess <= 0.01 || state.swimming || state.moving || state.jumping || sitW > 0.5) return;
    d.scaleInPlace(1 / sep);
    // turning a down-pointing leg about (down × d) moves its foot along d: each foot towards the other
    const k = Vector3.Cross(new Vector3(0, -1, 0), d).normalize();
    const a = Math.atan2(excess / 2, 0.85);
    rotateWorld(LU, k, a);
    rotateWorld(RU, k, -a);
  }
  let stroke = 0;
  let footLift = 0;
  const TAU = Math.PI * 2;

  ctx.scene.onAfterAnimationsObservable.add(() => {
    const dt = Math.min(ctx.scene.getEngine().getDeltaTime() / 1000, 0.1);
    const smoothing = 1 - Math.pow(0.0008, dt);
    copy.apply();

    const ry = (tilt.parent as TransformNode).rotation.y;
    fwd.set(-Math.sin(ry), 0, -Math.cos(ry));
    right.set(-fwd.z, 0, fwd.x);

    // ---- flight: arms raised, body diving forward on boost
    poseT = lerp(poseT, state.flying ? 1 : 0, smoothing);
    tiltT = lerp(tiltT, state.superman ? 1 : 0, smoothing);
    const pitchT = clamp((input.current.look.pitch - PITCH_MIN) / (PITCH_MAX - PITCH_MIN), 0, 1);
    rotateWorld(B("LeftArm"), right, ARM_SWING * 1.6 * poseT);
    rotateWorld(B("RightArm"), right, ARM_SWING * 1.6 * poseT * (1 - pitchT));

    // ---- swimming
    swimTilt = lerp(swimTilt, state.swimming ? state.swimT * SWIM_TILT : 0, smoothing);
    swimW = lerp(swimW, state.swimming ? 1 : 0, 1 - Math.pow(0.01, dt));
    stroke += dt * (state.moving ? 4.2 : 2.4);
    if (swimW > 0.01) swimPose();

    // ---- stance: the source idle stands with its feet wide apart — bring them under the hips
    narrowStance();

    // ---- jumping: legs together; on the way up the arms swing forward and up, the legs extend;
    // over the top and coming down the arms lower and the knees bend ready to land
    jumpW = lerp(jumpW, state.jumping && !state.flying && !state.swimming ? 1 : 0, 1 - Math.pow(0.0005, dt));
    if (jumpW > 0.01) {
      const j = jumpW;
      const up = clamp(state.vy / 4, -1, 1); // +1 rising fast … -1 falling
      const rise = Math.max(0, up), fall = Math.max(0, -up);
      rotateWorld(B("Spine"), right, -0.08 * j);
      for (const s of ["Left", "Right"]) {
        const out = s === "Left" ? -1 : 1;
        rotateWorld(B(`${s}Arm`), right, (0.5 + 1.9 * rise + 0.3 * fall) * j);
        rotateWorld(B(`${s}Arm`), fwd, out * 0.15 * j);
        rotateWorld(B(`${s}ForeArm`), right, (0.25 + 0.25 * fall) * j);
        rotateWorld(B(`${s}UpLeg`), right, (0.12 + 0.5 * fall) * j);
        rotateWorld(B(`${s}Leg`), right, -(0.15 + 0.75 * fall) * j);
        rotateWorld(B(`${s}Foot`), right, (-0.35 * rise + 0.2 * fall) * j);
      }
    }

    // ---- sitting: thighs level, shins down, hands on the knees, back upright
    sitW = lerp(sitW, state.sitting ? 1 : 0, 1 - Math.pow(0.004, dt));
    if (sitW > 0.01) {
      for (const s of ["Left", "Right"]) {
        rotateWorld(B(`${s}UpLeg`), right, 1.45 * sitW);
        rotateWorld(B(`${s}Leg`), right, -1.45 * sitW);
        rotateWorld(B(`${s}Arm`), right, 0.35 * sitW);
        rotateWorld(B(`${s}ForeArm`), right, 0.9 * sitW);
      }
    }

    // ---- climbing the ladder: both hands on the rails in front of the chest; on each rung one hand
    // reaches higher while the opposite knee lifts to the next step, then the body pulls up
    climbW = lerp(climbW, state.climbing ? 1 : 0, 1 - Math.pow(0.002, dt));
    if (climbW > 0.01) {
      const r = state.climbT;
      const i = Math.floor(r), f = r - i;
      const lead = i % 2 === 0 ? "Left" : "Right";
      const other = lead === "Left" ? "Right" : "Left";
      const reach = Math.sin(Math.min(1, f / 0.45) * Math.PI * 0.5); // hand reaching / knee lifting
      const settle = f < 0.45 ? 0 : (f - 0.45) / 0.55; // pulling up: everything goes back to grip pose
      const lift = reach * (1 - settle);
      const w = climbW;
      rotateWorld(B("Spine"), right, -0.12 * w); // chest to the ladder
      rotateWorld(B(`${lead}Arm`), right, (1.35 + 0.55 * lift) * w);
      rotateWorld(B(`${other}Arm`), right, 1.35 * w);
      for (const s of ["Left", "Right"]) {
        rotateWorld(B(`${s}ForeArm`), right, 0.75 * w);
        // hands in towards the rails (shoulder width)
        rotateWorld(B(`${s}Arm`), fwd, (s === "Left" ? 1 : -1) * 0.12 * w);
      }
      rotateWorld(B(`${other}UpLeg`), right, (0.25 + 1.0 * lift) * w); // opposite foot steps up
      rotateWorld(B(`${other}Leg`), right, -(0.3 + 1.2 * lift) * w);
      rotateWorld(B(`${lead}UpLeg`), right, 0.25 * w);
      rotateWorld(B(`${lead}Leg`), right, -0.3 * w);
    }

    // ---- your head, from the webcam (faceTrack.ts): the character looks where you look
    if (faceTrack.status === "tracking" || Math.abs(headYaw) + Math.abs(headPitch) > 0.01) {
      const on = faceTrack.status === "tracking" ? 1 : 0;
      const k = 1 - Math.pow(0.0005, dt);
      headYaw = lerp(headYaw, on * clamp(faceTrack.yaw, -1.1, 1.1), k);
      headPitch = lerp(headPitch, on * clamp(faceTrack.pitch, -0.6, 0.6), k);
      headRoll = lerp(headRoll, on * clamp(faceTrack.roll, -0.5, 0.5), k);
      // split between neck and head, like a real head turn
      rotateWorld(B("Neck"), up, headYaw * 0.4);
      rotateWorld(B("Head"), up, headYaw * 0.6);
      rotateWorld(B("Head"), right, headPitch * 1.4);
      rotateWorld(B("Head"), fwd, -headRoll);
    }

    // body lean (the model is turned round, so tilt's +X lean brings the head forward)
    setEuler(tilt, -(tiltT * BODY_TILT_BOOST + swimTilt), 0, 0);

    // ---- keep the feet on the ground: the lowest toe sits just above the floor
    if (swimW < 0.05) {
      const g = tilt.parent as TransformNode;
      let low = Infinity;
      for (const n of ["LeftToeBase", "RightToeBase", "LeftFoot", "RightFoot"]) {
        const bn = B(n);
        if (!bn) continue;
        bn.computeWorldMatrix(true);
        low = Math.min(low, bn.getAbsolutePosition().y - (n.endsWith("Foot") ? 0.07 : 0.025));
      }
      if (Number.isFinite(low)) {
        const err = g.position.y - low;
        footLift = lerp(footLift, footLift + err, 0.6);
        footLift = clamp(footLift, state.sitting || sitW > 0.05 ? -0.7 : -0.3, 0.3);
        scaled.position.y = footLift;
      }
    } else {
      footLift = lerp(footLift, 0, 0.2);
      scaled.position.y = footLift;
    }
  });

  /** Front crawl when moving (with a breath to the side every other stroke and body roll);
   * treading water — upright, sculling arms, cycling legs — when still. */
  function swimPose() {
    const c = state.swimT * swimW;
    const t = (1 - state.swimT) * swimW;
    // crawl: arms circle (recovery over the water, catch ahead of the head, pull underneath)
    rotateWorld(B("LeftArm"), right, (2.2 - (stroke % TAU)) * c);
    rotateWorld(B("RightArm"), right, (2.2 - ((stroke + Math.PI) % TAU)) * c);
    rotateWorld(B("LeftForeArm"), right, 0.4 * Math.max(0, Math.sin(stroke)) * c);
    rotateWorld(B("RightForeArm"), right, 0.4 * Math.max(0, Math.sin(stroke + Math.PI)) * c);
    rotateWorld(B("LeftUpLeg"), right, 0.22 * Math.sin(stroke * 2.4) * c);
    rotateWorld(B("RightUpLeg"), right, -0.22 * Math.sin(stroke * 2.4) * c);
    // body roll with each stroke; the head looks forward-down, turning to breathe on one side
    const roll = Math.sin(stroke) * 0.25;
    rotateWorld(B("Spine"), fwd, roll * c);
    const breath = Math.max(0, Math.sin(stroke * 0.5)) ** 3;
    // head up, face forward above the water (not buried face-down), a small turn to breathe
    rotateWorld(B("Neck"), right, 0.5 * c);
    rotateWorld(B("Head"), right, 0.75 * c);
    rotateWorld(B("Head"), up, (0.35 * breath - roll * 0.2) * c);
    // treading water
    const scull = Math.sin(stroke * 1.6);
    rotateWorld(B("LeftArm"), fwd, 1.15 * t);
    rotateWorld(B("RightArm"), fwd, -1.15 * t);
    rotateWorld(B("LeftArm"), up, 0.45 * scull * t);
    rotateWorld(B("RightArm"), up, -0.45 * scull * t);
    rotateWorld(B("LeftUpLeg"), right, (0.55 + 0.35 * Math.sin(stroke)) * t);
    rotateWorld(B("RightUpLeg"), right, (0.55 + 0.35 * Math.sin(stroke + Math.PI)) * t);
    rotateWorld(B("LeftLeg"), right, -(0.75 + 0.3 * Math.sin(stroke + 0.8)) * t);
    rotateWorld(B("RightLeg"), right, -(0.75 + 0.3 * Math.sin(stroke + Math.PI + 0.8)) * t);
  }

  return tilt;
}
