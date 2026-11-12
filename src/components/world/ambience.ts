import { peekCtx } from "./footstepSynth";
import { hash, type Ctx } from "./core";

/**
 * Synthesized ambience (no audio files): crickets chirping at night — loud on the street, faint
 * indoors — and the odd bird call outside by day. Starts once the player has unlocked audio.
 */
export function buildAmbience(ctx: Ctx) {
  let ac: AudioContext | null = null;
  let crickets: GainNode;
  let birds: GainNode;
  const voices: { g: GainNode; next: number; period: number; pulses: number; amp: number }[] = [];
  let nextBird = 0;
  let clock = 0;

  const init = (a: AudioContext) => {
    ac = a;
    crickets = a.createGain();
    crickets.gain.value = 0;
    // a gentle high-pass keeps the chirps crisp without any low rumble
    const hp = a.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2500;
    crickets.connect(hp).connect(a.destination);
    birds = a.createGain();
    birds.gain.value = 0;
    birds.connect(a.destination);
    for (let i = 0; i < 6; i++) {
      const osc = a.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 4100 + hash(i, 1) * 1300;
      const g = a.createGain();
      g.gain.value = 0;
      const pan = a.createStereoPanner();
      pan.pan.value = -0.85 + (i / 5) * 1.7;
      osc.connect(g).connect(pan).connect(crickets);
      osc.start();
      voices.push({ g, next: a.currentTime + hash(i, 2) * 1.5, period: 0.55 + hash(i, 3) * 0.6, pulses: 2 + Math.floor(hash(i, 4) * 3), amp: 0.5 + hash(i, 5) * 0.5 });
    }
  };

  const chirp = (v: (typeof voices)[number], t: number) => {
    const p = v.g.gain;
    for (let k = 0; k < v.pulses; k++) {
      const s = t + k * 0.045;
      p.setValueAtTime(0, s);
      p.linearRampToValueAtTime(v.amp, s + 0.006);
      p.setValueAtTime(v.amp, s + 0.02);
      p.linearRampToValueAtTime(0, s + 0.03);
    }
  };

  const bird = (a: AudioContext, t: number) => {
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1400;
    for (let k = 0; k < notes; k++) {
      const s = t + k * (0.11 + Math.random() * 0.05);
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.09);
      const g = a.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.5, s + 0.01);
      g.gain.linearRampToValueAtTime(0, s + 0.09);
      const pan = a.createStereoPanner();
      pan.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(g).connect(pan).connect(birds);
      o.start(s);
      o.stop(s + 0.1);
    }
  };

  ctx.onFrame((dt) => {
    clock -= dt;
    if (clock > 0) return;
    clock = 0.1;
    if (!ac) {
      const a = peekCtx();
      if (!a) return;
      init(a);
    }
    const a = ac!;
    const now = a.currentTime;
    const n = ctx.night;
    const out = ctx.outdoor;
    crickets.gain.setTargetAtTime(Math.max(0, n - 0.3) * (0.012 + out * 0.05), now, 0.4);
    birds.gain.setTargetAtTime((1 - n) * out * 0.05, now, 0.5);
    if (n > 0.3)
      for (const v of voices)
        if (v.next < now + 0.25) {
          const t = Math.max(v.next, now + 0.02);
          chirp(v, t);
          v.next = t + v.period * (0.85 + Math.random() * 0.3);
        }
    if (n < 0.5 && out > 0.5 && now > nextBird) {
      bird(a, now + 0.05);
      nextBird = now + 2.5 + Math.random() * 6;
    }
  });
}
