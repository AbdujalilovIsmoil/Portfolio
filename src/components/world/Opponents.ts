import { Quaternion, Texture, TransformNode, Vector3, type Node, type PBRMaterial, type Scene, type ShaderMaterial } from "@babylonjs/core";
import { CAR_FILE, CAR_HALF_L, CAR_HALF_W, SCALE, WHEELBASE, WHEEL_R } from "./Car";
import { instantiate } from "./assets";
import { ROAD_HALF, SURFACE, TILE, TRACK, heightAt, loopPose, undergroundAt } from "./Track";
import { clamp, group, points, setEuler, type Ctx, type DynamicCollider } from "./core";

const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/** Is s (metres along the lap) on the loop-the-loop's climb? */
function onLoopClimb(s: number) {
  const L = TRACK.loop;
  if (!L) return false;
  const d = s - L.s0;
  return d > L.climbIn && d < L.climbOut;
}

/**
 * How fast a car can go at each sample of the track: as fast as the bend there allows — `grip`, the
 * sideways grip (m/s²), or the top speed through a bend of a given radius — braking (`brake`) in time
 * for the ones coming. The racing line the rivals follow.
 */
export function speedProfile(grip: number | ((radius: number) => number) = 11, brake = 12, vmax = 40): Float32Array {
  const corner = typeof grip === "number" ? (r: number) => Math.sqrt(grip * r) : grip;
  const S = TRACK.samples;
  const n = S.length;
  const L = TRACK.length;
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // how sharply it turns over ±8 m (the loop's climb counts as straight: you keep your speed up)
    if (onLoopClimb(S[i].s)) {
      v[i] = vmax;
      continue;
    }
    const a = S[(i - 4 + n) % n], b = S[(i + 4) % n];
    const ds = (b.s - a.s + L) % L || 16;
    const k = Math.abs(wrap(b.heading - a.heading)) / ds;
    v[i] = k > 1e-4 ? Math.max(4, Math.min(vmax, corner(1 / k))) : vmax;
  }
  // brake in time: back round the lap (twice, so it wraps)
  for (let pass = 0; pass < 2; pass++)
    for (let i = n - 1; i >= 0; i--) {
      const j = (i + 1) % n;
      if (onLoopClimb(S[i].s)) continue;
      const ds = (S[j].s - S[i].s + L) % L || 2;
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * brake * ds));
    }
  return v;
}

/** The index of the sample at or before s. */
function sampleIndex(s: number) {
  const S = TRACK.samples;
  let lo = 0, hi = S.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (S[mid].s <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The race car's palette texture with its red bodywork painted another colour (the hue of `color`). */
export async function paintedTexture(scene: Scene, color: string): Promise<Texture | null> {
  try {
    const buf = new Uint8Array(await (await fetch(`/models/${CAR_FILE}`)).arrayBuffer());
    const dv = new DataView(buf.buffer);
    let off = 12;
    let json: { images: { bufferView: number; mimeType: string }[]; bufferViews: { byteOffset?: number; byteLength: number }[] } | null = null;
    let bin: Uint8Array | null = null;
    while (off < buf.length) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      const chunk = buf.subarray(off + 8, off + 8 + len);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
      else bin = chunk;
      off += 8 + len;
    }
    if (!json || !bin) return null;
    const view = json.bufferViews[json.images[0].bufferView];
    const png = bin.slice(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const img = await createImageBitmap(new Blob([png], { type: json.images[0].mimeType }));
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const g = canvas.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, img.width, img.height);
    const d = data.data;
    // the target hue
    const t = parseInt(color.slice(1), 16);
    const [tr, tg, tb] = [(t >> 16) & 255, (t >> 8) & 255, t & 255];
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
      // the reds (not the orange rims, not the greys): keep each pixel's lightness, take the new colour
      if (max < 90 || max - min < 70 || r !== max || gg > r * 0.62 || b > r * 0.62) continue;
      const k = max / 230;
      d[i] = Math.min(255, tr * k);
      d[i + 1] = Math.min(255, tg * k);
      d[i + 2] = Math.min(255, tb * k);
    }
    g.putImageData(data, 0, 0);
    return new Texture(canvas.toDataURL("image/png"), scene, false, false);
  } catch {
    return null;
  }
}

/** The lanes the rivals keep to (metres left of the centre line). */
const LANES = [-4.6, 0, 4.6];
const ACCEL = 12;
const BRAKE = 24;
// scratch for the wheels (nothing allocated per frame)
const qRoll = new Quaternion(), qSteer = new Quaternion(), qTmp = new Quaternion();
const AX_X = Vector3.Right(), AX_Y = Vector3.Up();

/**
 * A rival's car: it drives the racing line on its own — as fast as the bends allow (times its
 * `skill`), braking in time, keeping to a lane and moving over to pass — up the hills and round the
 * loop like you. It is solid and as heavy as your car: bump it and the two of you trade speed — run
 * into its back and it is shoved on, lean on its side and it is pushed off its line (then steers back).
 */
export class Rival {
  /** metres driven from the start of the lap (it keeps counting past each lap) */
  d: number;
  lat: number;
  lane: number;
  speed = 0;
  /** race time when it crossed the line for the last time (null until it finishes) */
  finished: number | null = null;
  bestLap: number | null = null;
  private lapStarted: number | null = null;
  private lastLapCount = 0;
  readonly root: TransformNode;
  private readonly tilt: TransformNode;
  private wheels: { node: TransformNode; base: Quaternion; front: boolean }[] = [];
  private spin = 0;
  /** the front wheels' steering angle (shown, a little more than the bend needs: you see it turn in) */
  private steer = 0;
  private yaw = 0;
  private pitch = 0;
  /** sideways speed from a knock (m/s, across the road), dying away */
  private knock = 0;
  private lamps: { mat: ShaderMaterial; op: number }[] = [];
  private lightsOn = 0;
  /** how fast it is moving across the road now (lane change + knock) */
  private latV = 0;
  /** knocked off its line: for this long it holds where it was put (doesn't steer back into you) */
  private hold = 0;
  readonly colliders: DynamicCollider[];
  readonly ready: Promise<unknown>;
  /** where it is (for the minimap and the others) */
  x = 0;
  z = 0;
  y = 0;
  heading = 0;

  constructor(
    private readonly ctx: Ctx,
    parent: Node,
    readonly name: string,
    readonly color: string,
    d0: number,
    lane: number,
    readonly skill: number,
    private readonly profile: Float32Array
  ) {
    this.d = d0;
    this.lane = this.lat = LANES[lane];
    this.root = group(ctx, { parent });
    this.tilt = group(ctx, { parent: this.root });
    // its lights, on only underground: headlamps in front, tail lights behind
    this.lamps = ([
      [2.18, "#fff4dc", 2.2, 0.9],
      [-2.22, "#ff3b30", 1.8, 0.45],
    ] as const).map(([z, color, size, op]) => {
      const p = points(ctx, { positions: new Float32Array([-0.58, 0.6, z, 0.58, 0.6, z]), sizes: new Float32Array([size, size]), phases: new Float32Array(2), color, opacity: 0, speed: 0, pixel: 4, attenuate: true });
      p.parent = this.tilt;
      p.isPickable = false;
      return { mat: p.material as ShaderMaterial, op };
    });
    this.ready = instantiate(ctx, CAR_FILE, this.tilt, { scale: SCALE, cast: true, clone: true }).then(async (holder) => {
      for (const m of holder.getChildMeshes()) m.isPickable = false;
      for (const n of holder.getDescendants(false) as TransformNode[]) {
        if (!/^wheel-(front|back)-(left|right)$/.test(n.name)) continue;
        this.wheels.push({ node: n, base: (n.rotationQuaternion ?? Quaternion.FromEulerVector(n.rotation)).clone(), front: n.name.includes("front") });
      }
      const tex = await paintedTexture(ctx.scene, color);
      if (tex)
        for (const m of holder.getChildMeshes()) {
          const mat = m.material as PBRMaterial | null;
          if (mat && "albedoTexture" in mat) mat.albedoTexture = tex;
        }
    });
    // its body: a box the size of the car (as the player's), turned with it
    this.colliders = [
      {
        x: 0,
        z: 0,
        r: CAR_HALF_L + 0.2,
        solid: true,
        vx: 0,
        vz: 0,
        box: { hw: CAR_HALF_W, hl: CAR_HALF_L, h: 0 },
        push: (dvx: number, dvz: number, ox: number, oz: number) => this.shove(dvx, dvz, ox, oz),
      },
    ];
    this.place(0);
  }

  /**
   * Hit by the player's car: `dv` the change to its velocity, `o` how far it is pushed (world x/z).
   * Along the road it goes into its speed and distance; across, into a knock it steers out of.
   */
  shove(dvx: number, dvz: number, ox: number, oz: number) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const across = dvx * fz - dvz * fx;
    this.speed = Math.max(0, this.speed + dvx * fx + dvz * fz);
    this.knock = clamp(this.knock + across, -12, 12);
    this.latV += across;
    this.d += ox * fx + oz * fz;
    this.lat = clamp(this.lat + ox * fz - oz * fx, -(ROAD_HALF * TILE - 1.4), ROAD_HALF * TILE - 1.4);
    // pushed sideways: it takes the new line for a moment, as a driver would, rather than lean back on you
    if (Math.abs(across) > 0.2 || Math.abs(ox * fz - oz * fx) > 0.01) {
      this.lane = this.lat;
      this.hold = 1.2;
    }
    // at once: the player's other end may touch it in the same frame, and must see it already moving
    this.velocity();
  }

  /** its velocity (for judging a hit), onto its colliders: along its nose, plus across the road */
  private velocity() {
    const vx = Math.sin(this.heading) * this.speed + Math.cos(this.heading) * this.latV;
    const vz = Math.cos(this.heading) * this.speed - Math.sin(this.heading) * this.latV;
    for (const c of this.colliders) {
      c.vx = vx;
      c.vz = vz;
    }
  }

  /** where it is along the lap */
  get s() {
    const L = TRACK.length;
    return ((this.d % L) + L) % L;
  }

  /**
   * One step. `go`: racing (else held on the grid); `others`: everyone else's distance and lane, to
   * keep clear of; `pace`: rubber band (above 1 when it is far behind you, below when far ahead).
   */
  update(dt: number, go: boolean, others: { d: number; lat: number; speed: number }[], pace: number, t: number) {
    if (go) {
      const i = sampleIndex(this.s);
      let target = this.profile[i] * this.skill * pace;
      if (onLoopClimb(this.s)) target = Math.max(target, 17);
      // someone ahead in our lane? pass them on a free lane, else sit behind
      // (looking further ahead the faster it goes — and as far as it takes to brake down to a slower
      // car's speed: a car stopped on the road is seen in time)
      const look = (o: { speed: number }) => 14 + this.speed * 0.4 + Math.max(0, this.speed * this.speed - o.speed * o.speed) / (2 * BRAKE);
      /** is that line clear of everyone near and ahead of us? */
      const clear = (l: number) => others.every((o) => Math.abs(o.lat - l) > 2.8 || o.d - this.d < -9 || o.d - this.d > look(o));
      let blocked: { d: number; lat: number; speed: number } | null = null;
      for (const o of others) {
        const gap = o.d - this.d;
        // in the lane it is going for, or on the line it is on now (moving over, it is still there)
        const inWay = Math.abs(o.lat - this.lane) < 2.7 || Math.abs(o.lat - this.lat) < 2.7;
        if (gap > 0 && gap < look(o) && inWay && (!blocked || gap < blocked.d - this.d)) blocked = o;
      }
      // back from a knock: to the nearest lane that is clear (else stay on this line)
      if (this.hold > 0 && (this.hold -= dt) <= 0) {
        const near = [...LANES].sort((a, b) => Math.abs(a - this.lat) - Math.abs(b - this.lat));
        const ok = near.find(clear);
        if (ok !== undefined) this.lane = ok;
        else this.hold = 0.3;
      }
      if (this.hold <= 0 && blocked && blocked.speed < target) {
        if (Math.abs(blocked.lat - this.lane) < 2.7) {
          // it's in our lane: over to a clear one, else sit behind it
          const free = LANES.find((l) => l !== this.lane && clear(l));
          if (free !== undefined && !onLoopClimb(this.s)) this.lane = free;
          else target = Math.min(target, blocked.speed - 0.5);
        } else {
          // already moving out of its way: slow enough to be past it before we get there
          const tClear = Math.abs(this.lane - this.lat) / 4 + 0.3;
          target = Math.min(target, blocked.speed + Math.max(0, blocked.d - this.d - 6) / tClear);
        }
      }
      this.speed = this.speed < target ? Math.min(target, this.speed + ACCEL * dt) : Math.max(target, this.speed - BRAKE * dt);
      this.d += this.speed * dt;
      // over to the lane, smoothly (not on the loop); knocked sideways, it slides and then steers back
      const lat0 = this.lat;
      if (!onLoopClimb(this.s)) this.lat += clamp(this.lane - this.lat, -4 * dt, 4 * dt);
      if (this.hold > 0) this.lane = clamp(this.lane + this.knock * dt, -(ROAD_HALF * TILE - 1.4), ROAD_HALF * TILE - 1.4);
      this.lat += this.knock * dt;
      this.knock *= Math.exp(-4 * dt);
      this.lat = clamp(this.lat, -(ROAD_HALF * TILE - 1.4), ROAD_HALF * TILE - 1.4);
      this.latV = dt > 0 ? (this.lat - lat0) / dt : 0;
      // laps (the line is at startS)
      const laps = Math.floor((this.d - TRACK.startS) / TRACK.length);
      if (laps > this.lastLapCount) {
        if (this.lapStarted !== null) {
          const lap = t - this.lapStarted;
          if (this.bestLap === null || lap < this.bestLap) this.bestLap = lap;
        }
        this.lapStarted = t;
        this.lastLapCount = laps;
      }
      if (this.lapStarted === null && this.d >= TRACK.startS) {
        this.lapStarted = t;
        this.lastLapCount = Math.max(this.lastLapCount, 0);
      }
    }
    this.place(dt);
  }

  /** race distance past the start line (negative on the grid) */
  get progress() {
    return this.d - TRACK.startS;
  }

  private place(dt: number) {
    // (lights on underground, eased)
    this.lightsOn += (undergroundAt(this.s) - this.lightsOn) * Math.min(1, dt * 4);
    for (const l of this.lamps) l.mat.setFloat("uOpacity", l.op * this.lightsOn);
    const S = TRACK.samples;
    const L = TRACK.length;
    const s = this.s;
    if (onLoopClimb(s)) {
      // round the loop: held to the road, turned over with it
      const q = loopPose(s - TRACK.loop!.s0);
      this.root.position.set(q.pos[0] + q.left[0] * this.lat + q.up[0] * SURFACE, q.pos[1] + q.left[1] * this.lat + q.up[1] * SURFACE, q.pos[2] + q.left[2] * this.lat + q.up[2] * SURFACE);
      Quaternion.RotationQuaternionFromAxisToRef(new Vector3(...q.left), new Vector3(...q.up), new Vector3(...q.t), this.root.rotationQuaternion ?? (this.root.rotationQuaternion = new Quaternion()));
      setEuler(this.tilt, 0, 0, 0);
      if (Math.hypot(q.t[0], q.t[2]) > 0.3) this.heading = Math.atan2(q.t[0], q.t[2]);
    } else {
      const i = sampleIndex(s);
      const a = S[i], b = S[(i + 1) % S.length];
      const span = (b.s - a.s + L) % L || 1;
      const f = clamp((s - a.s) / span, 0, 1);
      const h = a.heading + wrap(b.heading - a.heading) * f;
      const cx = a.x + (b.x - a.x) * f, cz = a.z + (b.z - a.z) * f;
      const y = heightAt(s) + SURFACE;
      this.root.position.set(cx + Math.cos(h) * this.lat, y, cz - Math.sin(h) * this.lat);
      // turned a little into a lane change; nose up or down with the hill
      const latV = clamp(this.lane - this.lat, -3, 3) * (Math.abs(this.lane - this.lat) > 0.05 ? 1 : 0);
      const laneYaw = Math.atan2(latV, Math.max(this.speed, 4));
      // (the shorter way round: where the road's heading wraps from +π to −π, straight on is straight on —
      // the plain difference made the car spin round there)
      this.yaw += wrap(h + laneYaw - this.yaw) * Math.min(1, dt * 10 || 1);
      this.yaw = h + wrap(this.yaw - h);
      // the front wheels: into the bend (its curvature, as the wheelbase needs it) and the lane change
      const bend = wrap(b.heading - a.heading) / span;
      const wantSteer = clamp(-Math.atan(bend * WHEELBASE) * 2.5 - laneYaw * 1.5, -0.45, 0.45);
      this.steer += (wantSteer - this.steer) * Math.min(1, dt * 8 || 1);
      const slope = Math.atan((heightAt(s + 1.5) - heightAt(s - 1.5)) / 3);
      this.pitch += (-slope - this.pitch) * Math.min(1, dt * 8 || 1);
      setEuler(this.root, 0, this.yaw, 0);
      setEuler(this.tilt, this.pitch, 0, 0);
      this.heading = this.yaw;
    }
    this.x = this.root.position.x;
    this.y = this.root.position.y;
    this.z = this.root.position.z;
    for (const c of this.colliders) {
      c.x = this.x;
      c.z = this.z;
      c.box!.h = this.heading;
    }
    this.velocity();
    // wheels roll with the distance; the front pair steers
    this.spin += (this.speed * dt) / WHEEL_R;
    Quaternion.RotationAxisToRef(AX_X, this.spin, qRoll);
    Quaternion.RotationAxisToRef(AX_Y, -this.steer, qSteer);
    for (const w of this.wheels) {
      const q = w.node.rotationQuaternion ?? (w.node.rotationQuaternion = new Quaternion());
      if (w.front) {
        w.base.multiplyToRef(qSteer, qTmp);
        qTmp.multiplyToRef(qRoll, q);
      } else w.base.multiplyToRef(qRoll, q);
    }
  }
}
