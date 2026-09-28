import { Quaternion, type Node, type TransformNode } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import { CITY_Y } from "./Stairs";
import { colFor, mul, qx, WHEEL_R } from "./Vehicle";
import { STOP_X_MINUS, STOP_X_PLUS, trafficLight } from "./TrafficLights";
import { group, hash, lerp, type Ctx } from "./core";

const BRAKE_DIST = 14;

const X0 = -60;
const X1 = 75;

/** One lane each way, straddling the centre-line dashes City.ts paints at z = 61. */
const LANES: [number, number, number][] = [
  [59.2, Math.PI / 2, 9], // heading +x
  [62.8, -Math.PI / 2, 7.5], // heading -x
];

interface TrafficCar {
  x: number;
  z: number;
  laneZ: number;
  zOffset: number;
  heading: number;
  speed: number;
  spin: number;
  file: string;
  root: TransformNode | null;
  wheels: { fl?: TransformNode; fr?: TransformNode; rl?: TransformNode; rr?: TransformNode };
  base: Record<string, Quaternion>;
  hasWheels: boolean;
  col: { x: number; z: number; hx: number; hz: number };
  anims: { speedRatio: number; start(l?: boolean): void }[];
}

/** Cars that just drive by on the main road — no player control, pure ambience. */
export function buildTraffic(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const cars: TrafficCar[] = [];
  const specs: [string, number, number, boolean][] = [
    ["ferrari.glb", 4.6, 0, false],
    ["truck.glb", 5.6, Math.PI, false],
    ["ferrari.glb", 4.6, 0, true],
    ["truck.glb", 5.6, Math.PI, true],
  ];

  specs.forEach(([file, size, yawOffset, clone], i) => {
    const [z, heading, speed] = LANES[i % LANES.length];
    const x = X0 + hash(i, 81) * (X1 - X0);
    const car: TrafficCar = { x, z, laneZ: z, zOffset: 0, heading, speed, spin: 0, file, root: null, wheels: {}, base: {}, hasWheels: false, col: colFor(x, z, heading), anims: [] };
    ctx.colliders.push(car.col);
    cars.push(car);
    ctx.defer(() => {
      instantiateFit(ctx, file, root, { pos: [x, CITY_Y, z], size, yaw: heading + Math.PI + yawOffset, clone })
        .then((m) => {
          car.root = m;
          const names = m.getChildTransformNodes(false);
          const find = (n: string) => names.find((c) => c.name === n);
          car.wheels = { fl: find("wheel_fl"), fr: find("wheel_fr"), rl: find("wheel_rl"), rr: find("wheel_rr") };
          car.hasWheels = !!(car.wheels.fl && car.wheels.fr && car.wheels.rl && car.wheels.rr);
          for (const [k, n] of Object.entries(car.wheels)) if (n) car.base[k] = (n.rotationQuaternion ?? Quaternion.Identity()).clone();
          car.anims = ((m.metadata?.anims ?? []) as TrafficCar["anims"]).slice();
          car.anims.forEach((a) => a.start(true));
          if (clone) {
            m.getChildMeshes().forEach((mesh) => {
              const mat = mesh.material as { name?: string; albedoColor?: { r: number; g: number; b: number } } | null;
              if (mat?.name === "body" && mat.albedoColor) Object.assign(mat.albedoColor, { r: 0.75, g: 0.72, b: 0.1 });
            });
          }
        })
        .catch(() => {});
    });
  });

  ctx.onFrame((dt) => {
    if (ctx.player.z < 40) return;
    for (const c of cars) {
      // Swerve toward the centre line around anything parked in this lane (curb-side
      // parked cars sit close enough to the driving lanes that a straight path would
      // drive straight through them), easing out early and slowing slightly while
      // doing it — reads as yielding rather than a last-second dodge — then it settles
      // straight back into its own lane once clear.
      let avoid = 0;
      for (const obstacle of ctx.colliders) {
        if (obstacle === c.col) continue;
        if (Math.abs(obstacle.z - c.laneZ) > 2.6) continue;
        if (Math.abs(obstacle.x - c.x) > obstacle.hx + 4.5) continue;
        avoid = Math.sign(c.laneZ - obstacle.z) * 1.8 || 1.8;
        break;
      }
      c.zOffset = lerp(c.zOffset, avoid, 1 - Math.pow(0.0008, dt));
      const avoidT = Math.min(1, Math.abs(c.zOffset) / 1.8);

      // Stop for a red or yellow light at the avenue crossing — ease down to a halt at
      // the stop line, ignore the signal once already committed past it, and simply
      // drive on through while it's green.
      let signalFactor = 1;
      if (trafficLight.phase !== "green") {
        const dist = c.heading > 0 ? STOP_X_PLUS - c.x : c.x - STOP_X_MINUS;
        if (dist > 0 && dist < BRAKE_DIST) signalFactor = dist / BRAKE_DIST;
      }

      const effSpeed = c.speed * (1 - avoidT * 0.4) * signalFactor;

      c.x += Math.sin(c.heading) * effSpeed * dt;
      if (c.x > X1 + 6) c.x = X0 - 6;
      if (c.x < X0 - 6) c.x = X1 + 6;
      c.z = c.laneZ + c.zOffset;
      c.col.x = c.x;
      c.col.z = c.z;
      c.spin += (effSpeed * dt) / WHEEL_R;
      if (!c.root) continue;
      c.root.position.x = c.x;
      c.root.position.z = c.z;
      if (c.hasWheels) {
        const { fl, fr, rl, rr } = c.wheels;
        const roll = qx(c.spin);
        if (fl && fr) {
          fl.rotationQuaternion = mul(c.base.fl, roll);
          fr.rotationQuaternion = mul(c.base.fr, roll);
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
