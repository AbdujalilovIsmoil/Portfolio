import { Color4, ParticleSystem, Vector3 } from "@babylonjs/core";
import { canvasTexture, glowTexture, type Ctx } from "./core";
import { playFanfare } from "./sound";

/** A shell's colours: the sparks start at `a`…`b` and burn out towards `dead`. */
const SHELLS: { a: string; b: string; dead: string; life: [number, number]; fall: number; size: number; crackle?: boolean }[] = [
  { a: "#ff2a3c", b: "#ff7a3a", dead: "#5a0a10", life: [1.3, 2], fall: 5, size: 0.99 },
  { a: "#2b8bff", b: "#7ad1ff", dead: "#0a1a5a", life: [1.3, 2], fall: 5, size: 0.99 },
  { a: "#3cff7a", b: "#b6ff5a", dead: "#0a4a1a", life: [1.3, 2], fall: 5, size: 0.99 },
  { a: "#c45bff", b: "#ff6ad5", dead: "#3a0a5a", life: [1.3, 2], fall: 5, size: 0.99 },
  { a: "#ffffff", b: "#cfe3ff", dead: "#404a60", life: [1.1, 1.7], fall: 5, size: 0.83 },
  // the gold willow: long, drooping trails that crackle as they fade
  { a: "#ffd36a", b: "#ffb02e", dead: "#5a2a00", life: [2.4, 3.4], fall: 9, size: 0.88, crackle: true },
];
/** sparks per shell: plenty to read as a burst, few enough for a modest laptop (they are CPU particles) */
const SPARKS = 170;
const ROCKET_SPEED = 46;

const c4 = (hex: string, a = 1) => {
  const n = parseInt(hex.slice(1), 16);
  return new Color4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a);
};

/**
 * A particle system whose particles are born where we say: each `emit(p, n)` queues `n` of them at
 * `p` (one system serves any number of rockets and bursts at once). Times are in seconds.
 */
function emitterSystem(ctx: Ctx, name: string, cap: number, setup: (ps: ParticleSystem) => void) {
  const ps = new ParticleSystem(name, cap, ctx.scene);
  ps.particleTexture = glowTexture(ctx);
  ps.emitter = Vector3.Zero();
  ps.emitRate = 0;
  ps.updateSpeed = 1 / 60;
  const queue: { x: number; y: number; z: number; n: number }[] = [];
  ps.startPositionFunction = (_m, pos) => {
    const q = queue[0];
    if (!q) return;
    pos.set(q.x, q.y, q.z);
    if (--q.n <= 0) queue.shift();
  };
  setup(ps);
  ps.start();
  return {
    ps,
    emit(x: number, y: number, z: number, n: number) {
      queue.push({ x, y, z, n });
      ps.manualEmitCount = Math.max(0, ps.manualEmitCount) + n;
    },
  };
}

/** A spark: a hard bright core with a short soft edge (a soft blob reads as dust against a day sky). */
function sparkTexture(ctx: Ctx) {
  return canvasTexture(ctx, 64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.45, "rgba(255,255,255,1)");
    grd.addColorStop(0.7, "rgba(255,255,255,0.45)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
}

/** A little paper rectangle (confetti): white, tinted per particle. */
function paperTexture(ctx: Ctx) {
  return canvasTexture(ctx, 32, 32, (g) => {
    g.clearRect(0, 0, 32, 32);
    g.fillStyle = "#fff";
    g.fillRect(4, 9, 24, 14);
  });
}

/**
 * The winner's celebration: fireworks going up all round the car — rockets with sparking tails,
 * bursting into red, blue, green, violet, silver and gold-willow shells, the bang arriving after the
 * flash as it would from that far — ticker-tape confetti raining down on the car, and a fanfare. `start()` sets it off; it goes on for a good while, then dies down.
 */
export function buildCelebration(ctx: Ctx) {
  const spark = sparkTexture(ctx);
  const burstSys = SHELLS.map((s, i) =>
    emitterSystem(ctx, `shell${i}`, SPARKS * 3, (ps) => {
      // each spark a streak along the way it flies, as a firework's stars look to the eye
      ps.particleTexture = spark;
      ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
      ps.minScaleY = 3;
      ps.maxScaleY = 4.5;
      ps.color1 = c4(s.a);
      ps.color2 = c4(s.b);
      ps.colorDead = c4(s.dead, 0);
      ps.minLifeTime = s.life[0];
      ps.maxLifeTime = s.life[1];
      ps.minSize = s.size * 0.7;
      ps.maxSize = s.size;
      // (born small at the centre — a tight knot, not a blob — then full size as they fly out)
      ps.addSizeGradient(0, s.size * 0.3);
      ps.addSizeGradient(0.08, s.size);
      ps.addSizeGradient(0.7, s.size * 0.7);
      ps.addSizeGradient(1, s.size * 0.25);
      ps.gravity = new Vector3(0, -s.fall, 0);
      ps.addDragGradient(0, 0.045);
      ps.addDragGradient(1, 0.02);
      ps.minEmitPower = 26;
      ps.maxEmitPower = 31;
      // every way at once: a sphere of sparks
      ps.startDirectionFunction = (_m, dir) => {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        dir.set(r * Math.cos(a), u, r * Math.sin(a));
      };
      // (by day, added light would wash out to white against the sky: drawn as coloured sparks, they
      // show in daylight and at night alike)
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    })
  );
  // the flash of a burst, and the rockets' sparking tails
  const flash = emitterSystem(ctx, "fwFlash", 24, (ps) => {
    ps.color1 = new Color4(1, 0.95, 0.85, 1);
    ps.color2 = new Color4(1, 0.9, 0.7, 1);
    ps.colorDead = new Color4(1, 0.8, 0.5, 0);
    ps.minLifeTime = ps.maxLifeTime = 0.22;
    ps.minSize = 11;
    ps.maxSize = 15;
    ps.minEmitPower = ps.maxEmitPower = 0;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  });
  const trail = emitterSystem(ctx, "fwTrail", 900, (ps) => {
    ps.color1 = new Color4(1, 0.85, 0.55, 1);
    ps.color2 = new Color4(1, 0.6, 0.25, 1);
    ps.colorDead = new Color4(0.6, 0.2, 0.05, 0);
    ps.minLifeTime = 0.35;
    ps.maxLifeTime = 0.7;
    ps.minSize = 0.25;
    ps.maxSize = 0.45;
    ps.gravity = new Vector3(0, -6, 0);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 2;
    ps.direction1 = new Vector3(-1, -1, -1);
    ps.direction2 = new Vector3(1, 0, 1);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  });
  // the willow's glitter: white pin-pricks that wink on and off as the gold falls
  const glitter = emitterSystem(ctx, "fwGlitter", 700, (ps) => {
    ps.color1 = new Color4(1, 1, 0.9, 1);
    ps.color2 = new Color4(1, 0.95, 0.7, 1);
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minLifeTime = 0.08;
    ps.maxLifeTime = 0.18;
    ps.minSize = 0.35;
    ps.maxSize = 0.6;
    ps.minEmitPower = ps.maxEmitPower = 0;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  });
  // ticker tape: paper squares fluttering down round the car
  const paper = paperTexture(ctx);
  const confetti = [
    ["#ffd23a", "#ffffff"],
    ["#ff3b6b", "#2b8bff"],
    ["#3cff7a", "#ff8a1f"],
  ].map(([a, b], i) =>
    emitterSystem(ctx, `confetti${i}`, 220, (ps) => {
      ps.particleTexture = paper;
      ps.color1 = c4(a);
      ps.color2 = c4(b);
      ps.colorDead = c4(b, 0);
      ps.minLifeTime = 4;
      ps.maxLifeTime = 6;
      ps.minSize = 0.16;
      ps.maxSize = 0.26;
      ps.minScaleX = 0.6;
      ps.maxScaleX = 1.4;
      ps.minScaleY = 0.5;
      ps.maxScaleY = 1;
      ps.minAngularSpeed = -6;
      ps.maxAngularSpeed = 6;
      ps.gravity = new Vector3(0, -1.6, 0);
      ps.addDragGradient(0, 0.06);
      ps.minEmitPower = 1;
      ps.maxEmitPower = 4;
      ps.direction1 = new Vector3(-1, 0.6, -1);
      ps.direction2 = new Vector3(1, 1.6, 1);
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    })
  );

  type Rocket = { x: number; y: number; z: number; vx: number; vz: number; top: number; shell: number; dist: number };
  const rockets: Rocket[] = [];
  /** willows still glittering: where, and for how long */
  const sparkles: { x: number; y: number; z: number; left: number }[] = [];
  let on = false;
  let elapsed = 0;
  let nextLaunch = 0;
  let confettiLeft = 0;

  /**
   * One rocket from somewhere round the car (out on the grass, 85–140 m off), bursting 34–56 m up —
   * far enough out and low enough that the camera, down by the car, sees the bursts over it.
   */
  const launch = () => {
    // mostly where the camera is looking (a show behind it is a show nobody sees), now and then anywhere
    const cam = ctx.camera.position, fwd = ctx.camera.getDirection(Vector3.Forward(ctx.scene.useRightHandedSystem)); // (the scene is right-handed)
    const look = Math.atan2(fwd.x, fwd.z);
    const a = Math.random() < 0.8 ? look + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
    const d = 85 + Math.random() * 55;
    const x = cam.x + Math.sin(a) * d, z = cam.z + Math.cos(a) * d;
    const ground = ctx.player.y - 0.3;
    const shell = Math.floor(Math.random() * SHELLS.length);
    rockets.push({ x, y: ground, z, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, top: ground + 34 + Math.random() * 22, shell, dist: d });
  };

  ctx.onFrame((dt) => {
    if (!on) return;
    elapsed += dt;
    // a volley at first, then a steady show, thinning out after half a minute
    nextLaunch -= dt;
    if (elapsed < 40 && nextLaunch <= 0) {
      launch();
      if (elapsed < 3 && Math.random() < 0.35) launch();
      nextLaunch = elapsed < 3 ? 0.5 : elapsed < 25 ? 0.8 + Math.random() * 0.8 : 1.5 + Math.random() * 1.5;
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      // up, slowing a little near the top, wobbling as it goes
      const vy = ROCKET_SPEED * Math.max(0.4, (r.top - r.y) / 20);
      r.y += vy * dt;
      r.x += (r.vx + Math.sin(elapsed * 23 + i) * 1.2) * dt;
      r.z += (r.vz + Math.cos(elapsed * 19 + i) * 1.2) * dt;
      trail.emit(r.x, r.y, r.z, 1);
      if (r.y < r.top) continue;
      rockets.splice(i, 1);
      const s = SHELLS[r.shell];
      burstSys[r.shell].emit(r.x, r.y, r.z, SPARKS);
      flash.emit(r.x, r.y, r.z, 1);
      if (s.crackle) sparkles.push({ x: r.x, y: r.y, z: r.z, left: 2.6 });
    }
    // the gold willow glitters as it falls: winks scattered through where its sparks now are
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const g = sparkles[i];
      g.left -= dt;
      if (g.left <= 0) {
        sparkles.splice(i, 1);
        continue;
      }
      const age = 2.6 - g.left;
      for (let k = 0; k < 2; k++) {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
        const reach = 9 + age * 3;
        glitter.emit(g.x + rr * Math.cos(a) * reach, g.y + u * reach - age * age * 3, g.z + rr * Math.sin(a) * reach, 1);
      }
    }
    // confetti over the car for the first seconds
    if (confettiLeft > 0) {
      confettiLeft -= dt;
      for (const c of confetti) {
        if (Math.random() < 0.5) continue; // (≈ 30 a second from each)
        const a = Math.random() * Math.PI * 2, d = Math.random() * 7;
        c.emit(ctx.player.x + Math.cos(a) * d, ctx.player.y + 7 + Math.random() * 3, ctx.player.z + Math.sin(a) * d, 1);
      }
    }
  });

  return {
    /** The race is won: let it all go. */
    start() {
      if (on) return;
      on = true;
      elapsed = 0;
      nextLaunch = 0.15;
      confettiLeft = 6;
      // the car's tail end: a cannon of confetti right away
      for (const c of confetti) c.emit(ctx.player.x, ctx.player.y + 1.5, ctx.player.z, 60);
      playFanfare();
    },
  };
}
