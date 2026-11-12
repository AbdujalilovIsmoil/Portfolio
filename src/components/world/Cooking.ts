import { Color4, ParticleSystem, Vector3, type Node } from "@babylonjs/core";
import { peekCtx } from "./footstepSynth";
import { disc, glowTexture, lit, type Ctx } from "./core";

/**
 * Something cooking on the stove: glowing burners, steam rising from the pot and the kettle, and
 * the sound of it — a pot simmering (soft noise with bubbles popping) and the kettle coming to
 * the boil, both louder the closer you stand.
 */
export function buildCooking(ctx: Ctx, parent: Node, o: { pot: Vector3; kettle: Vector3; burnerY: number }) {
  // burners glowing red under the pot and the kettle
  const glow = lit(ctx, { color: "#300", emissive: "#ff3a12", ei: 1.6 });
  for (const p of [o.pot, o.kettle]) {
    const d = disc(ctx, 0.11, 24, { parent, pos: [p.x, o.burnerY, p.z], rot: [-Math.PI / 2, 0, 0], mat: glow });
    d.isPickable = false;
  }
  const steam = (at: Vector3, rate: number, size: number) => {
    const ps = new ParticleSystem("steam", 160, ctx.scene);
    ps.particleTexture = glowTexture(ctx);
    ps.emitter = at.clone();
    ps.minEmitBox = new Vector3(-0.05, 0, -0.05);
    ps.maxEmitBox = new Vector3(0.05, 0, 0.05);
    ps.color1 = new Color4(1, 1, 1, 0.22);
    ps.color2 = new Color4(0.95, 0.97, 1, 0.16);
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minSize = size * 0.5;
    ps.maxSize = size;
    ps.minScaleX = ps.minScaleY = 1;
    ps.addSizeGradient(0, size * 0.4);
    ps.addSizeGradient(1, size * 2.2);
    ps.minLifeTime = 1.4;
    ps.maxLifeTime = 2.6;
    ps.emitRate = rate;
    ps.direction1 = new Vector3(-0.08, 0.5, -0.08);
    ps.direction2 = new Vector3(0.08, 0.8, 0.08);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 0.5;
    ps.gravity = new Vector3(0.02, 0.15, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    return ps;
  };
  const centre = o.pot.add(o.kettle).scale(0.5);
  const potSteam = steam(o.pot, 18, 0.16);
  const kettleSteam = steam(o.kettle, 26, 0.1);

  // ---- sound
  let ac: AudioContext | null = null;
  let bus: GainNode | null = null;
  let whistle: { osc: OscillatorNode; g: GainNode } | null = null;
  let popClock = 0;
  const init = (a: AudioContext) => {
    ac = a;
    bus = a.createGain();
    bus.gain.value = 0;
    bus.connect(a.destination);
    // simmer: looping filtered noise
    const len = a.sampleRate * 2;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const g = a.createGain();
    g.gain.value = 0.05;
    src.connect(bp).connect(g).connect(bus);
    src.start();
    // kettle: a breathy rising whistle that comes and goes
    const osc = a.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1900;
    const wg = a.createGain();
    wg.gain.value = 0;
    osc.connect(wg).connect(bus);
    osc.start();
    whistle = { osc, g: wg };
  };
  const enabled = () => (parent as unknown as { isEnabled(): boolean }).isEnabled();
  let steaming = true;
  ctx.onFrame((dt, t) => {
    // steam only while you're in or by the kitchen (particle systems cost even when unseen)
    const on = enabled() && Vector3.DistanceSquared(ctx.player, centre) < 14 * 14;
    if (on !== steaming) {
      steaming = on;
      for (const p of [potSteam, kettleSteam]) {
        if (on) p.start();
        else p.stop();
      }
    }
    kettleSteam.emitRate = 26 + 20 * Math.max(0, Math.sin(t * 0.25));
    if (!ac) {
      const a = peekCtx();
      if (a) init(a);
      else return;
    }
    const a = ac!;
    const dist = Vector3.Distance(ctx.player, centre);
    const vol = on ? Math.max(0, 1 - dist / 9) ** 2 * 0.9 : 0;
    bus!.gain.setTargetAtTime(vol, a.currentTime, 0.3);
    if (vol < 0.01) return;
    // the kettle builds up to a whistle every ~25 s
    const boil = Math.max(0, Math.sin(t * 0.25));
    whistle!.g.gain.setTargetAtTime(0.018 * boil ** 3, a.currentTime, 0.2);
    whistle!.osc.frequency.setTargetAtTime(1700 + 500 * boil + Math.sin(t * 9) * 30, a.currentTime, 0.1);
    // bubbles popping in the pot
    popClock -= dt;
    if (popClock <= 0) {
      popClock = 0.05 + Math.random() * 0.18;
      const s = a.currentTime;
      const ob = a.createOscillator();
      ob.type = "sine";
      ob.frequency.setValueAtTime(250 + Math.random() * 300, s);
      ob.frequency.exponentialRampToValueAtTime(700 + Math.random() * 500, s + 0.04);
      const gb = a.createGain();
      gb.gain.setValueAtTime(0.0001, s);
      gb.gain.exponentialRampToValueAtTime(0.06, s + 0.005);
      gb.gain.exponentialRampToValueAtTime(0.0001, s + 0.06);
      ob.connect(gb).connect(bus!);
      ob.start(s);
      ob.stop(s + 0.07);
    }
  });
}
