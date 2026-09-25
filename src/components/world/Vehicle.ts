import { Quaternion, type Node, type TransformNode } from "@babylonjs/core";
import type { MutableRefObject } from "react";
import { instantiateFit } from "./assets";
import { CITY_REGION, type CityApi } from "./City";
import type { DoorSignal } from "./doorSignal";
import type { WorldInput } from "./WorldInputContext";
import { CITY_Y } from "./Stairs";
import { clamp, group, inRegions, lerp, setEuler, type Ctx } from "./core";

/** Simple synthesized engine: pitch and loudness follow speed and throttle. */
function createEngineSound() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new AC();
  const master = ac.createGain();
  master.gain.value = 0;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 600;
  const saw = ac.createOscillator();
  saw.type = "sawtooth";
  const sub = ac.createOscillator();
  sub.type = "square";
  const subGain = ac.createGain();
  subGain.gain.value = 0.5;
  saw.connect(filter);
  sub.connect(subGain).connect(filter);
  filter.connect(master).connect(ac.destination);
  saw.start();
  sub.start();
  return {
    set(speed: number, throttle: number) {
      const s = Math.abs(speed);
      const f = 42 + s * 6.5 + throttle * 12;
      const t = ac.currentTime;
      saw.frequency.setTargetAtTime(f, t, 0.08);
      sub.frequency.setTargetAtTime(f / 2, t, 0.08);
      filter.frequency.setTargetAtTime(380 + s * 55 + throttle * 250, t, 0.1);
      master.gain.setTargetAtTime(0.035 + Math.min(1, s / 24) * 0.04 + throttle * 0.03, t, 0.1);
    },
    stop() {
      master.gain.setTargetAtTime(0, ac.currentTime, 0.06);
      setTimeout(() => ac.close(), 400);
    },
  };
}

const qx = (a: number) => new Quaternion(Math.sin(a / 2), 0, 0, Math.cos(a / 2));
const qz = (a: number) => new Quaternion(0, 0, Math.sin(a / 2), Math.cos(a / 2));
const mul = (a: Quaternion, b: Quaternion) => a.multiply(b);

const ENTER_R = 4.2;
const MAX_SPEED = 24;
const MAX_REV = 7;
const ACCEL = 13;
const BRAKE = 26;
const DRAG = 5;
const WHEELBASE = 2.7;
const MAX_STEER = 0.55;
const WHEEL_R = 0.36;
const CAR_R = 1.5;

interface Car {
  root: TransformNode;
  x: number;
  z: number;
  heading: number;
  speed: number;
  steer: number;
  spin: number;
  file: string;
  wheels: { fl?: TransformNode; fr?: TransformNode; rl?: TransformNode; rr?: TransformNode };
  base: Record<string, Quaternion>;
  col: { x: number; z: number; hx: number; hz: number };
  hasWheels: boolean;
  /** the model's own forward axis vs. ours */
  yawOffset: number;
  anims: { speedRatio: number; start(l?: boolean): void }[];
}

const colFor = (x: number, z: number, heading: number) => {
  const along = Math.abs(Math.sin(heading)) > 0.7; // pointing along x
  return { x, z, hx: along ? 2.5 : 1.25, hz: along ? 1.25 : 2.5 };
};

/** Drivable cars parked on the street: E to get in, WASD to drive, E to get out. */
export function buildVehicles(
  ctx: Ctx,
  parent: Node,
  city: CityApi,
  deps: { input: MutableRefObject<WorldInput>; doorRef: MutableRefObject<DoorSignal> }
) {
  const { input, doorRef } = deps;
  const root = group(ctx, { parent });
  const cars: Car[] = [];
  const models: [string, number, boolean, number][] = [
    ["ferrari.glb", 4.6, false, 0],
    ["truck.glb", 5.6, false, Math.PI],
    ["ferrari.glb", 4.6, true, 0],
  ];
  city.spots.forEach((s, i) => {
    const [file, size, clone, yawOffset] = models[i % models.length];
    const car: Car = {
      root: group(ctx, { parent: root, pos: [s.x, CITY_Y, s.z] }),
      x: s.x,
      z: s.z,
      heading: s.heading,
      speed: 0,
      steer: 0,
      spin: 0,
      file,
      wheels: {},
      base: {},
      col: colFor(s.x, s.z, s.heading),
      hasWheels: false,
      yawOffset,
      anims: [],
    };
    ctx.colliders.push(car.col);
    cars.push(car);
    ctx.defer(() => {
      instantiateFit(ctx, file, root, { pos: [0, 0, 0], size, yaw: 0, clone, anim: false })
        .then((m) => {
          m.parent = car.root; // fitted around the origin first, then attached to the moving car
          const names = m.getChildTransformNodes(false);
          const find = (n: string) => names.find((x) => x.name === n);
          car.wheels = { fl: find("wheel_fl"), fr: find("wheel_fr"), rl: find("wheel_rl"), rr: find("wheel_rr") };
          car.hasWheels = !!(car.wheels.fl && car.wheels.fr && car.wheels.rl && car.wheels.rr);
          for (const [k, n] of Object.entries(car.wheels)) if (n) car.base[k] = (n.rotationQuaternion ?? Quaternion.Identity()).clone();
          car.anims = ((m.metadata?.anims ?? []) as Car["anims"]).slice();
          car.anims.forEach((a) => a.start(true));
          if (clone) {
            // give the second Ferrari its own paint job
            m.getChildMeshes().forEach((mesh) => {
              const mat = mesh.material as { name?: string; albedoColor?: { r: number; g: number; b: number } } | null;
              if (mat?.name === "body" && mat.albedoColor) Object.assign(mat.albedoColor, { r: 0.05, g: 0.2, b: 0.85 });
            });
          }
        })
        .catch((e) => console.error("car", e));
    });
  });

  let driving: Car | null = null;
  let engine: ReturnType<typeof createEngineSound> | null = null;
  let lastId = input.current.doorId;
  const v = ctx.vehicle;

  ctx.onFrame((dt) => {
    // ---- nearest car / prompts
    let near: Car | null = null;
    let nd = ENTER_R;
    if (!driving && ctx.player.z > 50) {
      for (const c of cars) {
        const d = Math.hypot(ctx.player.x - c.x, ctx.player.z - c.z);
        if (d < nd) {
          nd = d;
          near = c;
        }
      }
    }
    if (near) {
      doorRef.current.near = true;
      doorRef.current.label = "Get in the car";
    } else if (driving) {
      doorRef.current.near = true;
      doorRef.current.label = "Get out of the car";
      doorRef.current.open = false;
    }

    if (input.current.doorId !== lastId) {
      lastId = input.current.doorId;
      if (driving) {
        const c = driving;
        engine?.stop();
        engine = null;
        driving = null;
        v.driving = false;
        v.speed = 0;
        c.speed = 0;
        const side = c.heading + Math.PI / 2;
        v.exitAt = [c.x + Math.sin(side) * 2.6, c.z + Math.cos(side) * 2.6];
        c.col = colFor(c.x, c.z, c.heading);
        ctx.colliders.push(c.col);
      } else if (near) {
        driving = near;
        v.driving = true;
        try {
          engine = createEngineSound();
        } catch {
          engine = null; // audio is optional
        }
        const at = ctx.colliders.indexOf(near.col);
        if (at >= 0) ctx.colliders.splice(at, 1);
      }
    }

    // ---- driving physics
    if (driving) {
      const c = driving;
      const { move } = input.current;
      const throttle = (move.forward ? 1 : 0) - (move.backward ? 1 : 0);
      const top = MAX_SPEED * (move.run ? 1.3 : 1);
      if (throttle > 0) c.speed += (c.speed < 0 ? BRAKE : ACCEL) * dt;
      else if (throttle < 0) c.speed -= (c.speed > 0 ? BRAKE : ACCEL * 0.6) * dt;
      else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), DRAG * dt);
      c.speed = clamp(c.speed, -MAX_REV, top);

      const want = ((move.right ? 1 : 0) - (move.left ? 1 : 0)) * (MAX_STEER / (1 + Math.abs(c.speed) / 7));
      c.steer = lerp(c.steer, want, 1 - Math.pow(0.001, dt));
      c.heading -= (c.speed / WHEELBASE) * Math.tan(c.steer) * dt;

      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const hit = (x: number, z: number) =>
        !inRegions([CITY_REGION], x, z, CAR_R) || ctx.colliders.some((k) => Math.abs(x - k.x) < k.hx + CAR_R * 0.8 && Math.abs(z - k.z) < k.hz + CAR_R * 0.8);
      if (!hit(nx, c.z)) c.x = nx;
      else c.speed *= -0.25;
      if (!hit(c.x, nz)) c.z = nz;
      else c.speed *= -0.25;

      engine?.set(c.speed, Math.abs(throttle));
      c.spin += (-c.speed * dt) / WHEEL_R;
      v.x = c.x;
      v.z = c.z;
      v.heading = c.heading;
      v.speed = c.speed;
      ctx.player.set(c.x, CITY_Y, c.z);
    }

    // ---- visuals for every car
    for (const c of cars) {
      c.root.position.set(c.x, CITY_Y, c.z);
      setEuler(c.root, 0, c.heading + Math.PI + c.yawOffset, 0);
      if (c !== driving && Math.abs(c.speed) < 0.01) continue;
      if (c.hasWheels) {
        const { fl, fr, rl, rr } = c.wheels;
        const roll = qx(c.spin);
        const steerQ = qz(-c.steer);
        if (fl && fr) {
          fl.rotationQuaternion = mul(mul(c.base.fl, steerQ), roll);
          fr.rotationQuaternion = mul(mul(c.base.fr, steerQ), roll);
        }
        if (rl && rr) {
          rl.rotationQuaternion = mul(c.base.rl, roll);
          rr.rotationQuaternion = mul(c.base.rr, roll);
        }
      } else {
        for (const a of c.anims) a.speedRatio = Math.abs(c.speed) * 0.35;
      }
    }
  });
  return root;
}
