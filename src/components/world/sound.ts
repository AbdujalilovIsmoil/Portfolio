"use client";

/** All sound is synthesized (no audio files): one shared AudioContext, unlocked by the Start click. */
let ctx: AudioContext | null = null;

export function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Create the audio context up-front (on the Start click) so the first sound doesn't stall. */
export function warmAudio() {
  const c = getCtx();
  if (c.state === "suspended") void c.resume();
}

/**
 * Everything the game plays goes through this one bus to the speakers: a low-pass that is wide open
 * normally and closes down under the water (the aquarium) — the muffled way things sound underwater.
 */
let busNode: BiquadFilterNode | null = null;
function bus(ac: AudioContext): AudioNode {
  if (!busNode || busNode.context !== ac) {
    busNode = ac.createBiquadFilter();
    busNode.type = "lowpass";
    busNode.frequency.value = 20000;
    busNode.Q.value = 0.5;
    busNode.connect(ac.destination);
  }
  return busNode;
}

/** How far under the water the listener is: 0 (dry) … 1 (in the aquarium's tube) — muffles everything. */
export function setUnderwater(k: number) {
  if (!busNode) return;
  const f = 20000 * Math.pow(700 / 20000, Math.max(0, Math.min(1, k)));
  busNode.frequency.setTargetAtTime(f, busNode.context.currentTime, 0.25);
}

/** The shared audio context if the user has already unlocked audio (clicked Start), else null. */
export function peekCtx(): AudioContext | null {
  return ctx && ctx.state === "running" ? ctx : null;
}

/** A short bright two-note chime (a new stop discovered). */
export function playChime() {
  const ac = peekCtx();
  if (!ac) return;
  const now = ac.currentTime;
  [784, 1175].forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = ac.createGain();
    const t = now + i * 0.09;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(bus(ac));
    o.start(t);
    o.stop(t + 0.52);
  });
}

export interface EngineSound {
  /** speed in m/s, throttle 0–1; `mute` silences it (the menu is open, or the car is held at the start / finish); `boost` 0–1: the nitro is lit */
  set(speed: number, throttle: number, mute: boolean, boost?: number): void;
  dispose(): void;
}

/**
 * A real engine: a short recording looped (with its ends cross-faded so the seam doesn't click),
 * played faster as the car goes faster, a little louder and brighter on the throttle.
 */
/**
 * The engine, synthesized: no recording looped (a short loop repeats audibly — a "tick, tick" a few
 * times a second at speed). The firing note (and its octave and sub-octave) climbs with the revs, a
 * low-pass opens with them, a little rough intake rumble underneath. Nothing in it repeats.
 */
export function createSynthEngine(ac: AudioContext): EngineSound {
  const out = ac.createGain();
  out.gain.value = 0;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 3;
  out.connect(comp).connect(bus(ac));
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 800;
  lp.Q.value = 1.2;
  lp.connect(out);
  const voice = (type: OscillatorType, mult: number, level: number, detune = 0) => {
    const o = ac.createOscillator();
    o.type = type;
    o.detune.value = detune;
    const g = ac.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
    o.start();
    return { o, mult };
  };
  const voices = [voice("sawtooth", 1, 0.5), voice("sawtooth", 1, 0.35, 9), voice("square", 0.5, 0.35), voice("sawtooth", 2, 0.18, -6)];
  // intake rumble: brown noise, low-passed with the revs
  const len = ac.sampleRate * 3;
  const nb = ac.createBuffer(1, len, ac.sampleRate);
  const nd = nb.getChannelData(0);
  let w = 0;
  for (let i = 0; i < len; i++) {
    w = (w + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    nd[i] = w * 3;
  }
  const fade = Math.floor(ac.sampleRate * 0.1);
  for (let i = 0; i < fade; i++) nd[i] = nd[i] * (i / fade) + nd[len - fade + i] * (1 - i / fade);
  const noise = ac.createBufferSource();
  noise.buffer = nb;
  noise.loop = true;
  noise.loopEnd = (len - fade) / ac.sampleRate;
  const nlp = ac.createBiquadFilter();
  nlp.type = "lowpass";
  nlp.frequency.value = 300;
  const ng = ac.createGain();
  ng.gain.value = 0.25;
  noise.connect(nlp).connect(ng).connect(out);
  noise.start();
  return {
    set(speed, throttle, mute, boost = 0) {
      const k = Math.min(1, Math.abs(speed) / 37);
      // (past the throttle's top speed — the nitro — it keeps on climbing, a little)
      const over = Math.min(1, Math.max(0, Math.abs(speed) - 37) / 46);
      const t = ac.currentTime;
      const f = 42 + k * 120 + over * 45 + throttle * 6 + boost * 10;
      for (const v of voices) v.o.frequency.setTargetAtTime(f * v.mult, t, 0.09);
      lp.frequency.setTargetAtTime(500 + k * 1500 + over * 700 + throttle * 500 + boost * 400, t, 0.12);
      nlp.frequency.setTargetAtTime(200 + k * 500, t, 0.2);
      out.gain.setTargetAtTime(mute ? 0 : 0.05 + k * 0.05 + throttle * 0.035 + boost * 0.025, t, 0.12);
    },
    dispose() {
      out.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      setTimeout(() => {
        for (const v of voices) v.o.stop();
        noise.stop();
        out.disconnect();
      }, 300);
    },
  };
}

/** Concrete breaking and grit raining down after it — `strength` 0–1. */
export function playCrunch(strength = 1) {
  const ac = peekCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const out = ac.createGain();
  out.gain.value = 0.05 + strength * 0.14;
  out.connect(bus(ac));
  // the crack: a short burst of noise, low and dull (no rattle, no ring)
  const n = Math.floor(ac.sampleRate * 0.14);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 700 + strength * 400;
  bp.Q.value = 0.6;
  src.connect(bp).connect(out);
  src.start(now);
}

/** A rising rush of air: the boost pad. */
export function playWhoosh() {
  const ac = peekCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const n = Math.floor(ac.sampleRate * 0.9);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(400, now);
  bp.frequency.exponentialRampToValueAtTime(2600, now + 0.7);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.001, now);
  g.gain.exponentialRampToValueAtTime(0.28, now + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
  src.connect(bp).connect(g).connect(bus(ac));
  src.start(now);
}

/** A countdown beep: low for 3-2-1, high for GO. */
export function playBeep(high = false) {
  const ac = peekCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "square";
  o.frequency.value = high ? 880 : 440;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.09, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + (high ? 0.6 : 0.25));
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 2400;
  o.connect(f).connect(g).connect(bus(ac));
  o.start(now);
  o.stop(now + 0.62);
}

/** A coin, a gate, a parcel: a bright little pling. */
export function playPickup(pitch = 1) {
  const ac = peekCtx();
  if (!ac) return;
  const now = ac.currentTime;
  [1, 1.5].forEach((m, i) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = 988 * pitch * m;
    const g = ac.createGain();
    const t = now + i * 0.07;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(bus(ac));
    o.start(t);
    o.stop(t + 0.3);
  });
}

/** A victory fanfare: a short brassy rising call and a held major chord. */
export function playFanfare() {
  const ac = peekCtx();
  if (!ac) return;
  const now = ac.currentTime + 0.05;
  const out = ac.createGain();
  out.gain.value = 0.11;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2600;
  lp.Q.value = 0.7;
  lp.connect(out).connect(bus(ac));
  // (C major: G4 C5 E5 — G5 — then C5 E5 G5 C6 together)
  const notes: [number[], number, number][] = [
    [[392], 0, 0.16],
    [[523], 0.17, 0.16],
    [[659], 0.34, 0.16],
    [[784], 0.51, 0.34],
    [[659], 0.88, 0.14],
    [[784], 1.03, 0.14],
    [[523, 659, 784, 1047], 1.2, 1.6],
  ];
  for (const [fs, at, len] of notes)
    for (const f of fs)
      for (const det of [-6, 6]) {
        const o = ac.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = det;
        const g = ac.createGain();
        const t = now + at;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5 / fs.length, t + 0.03);
        g.gain.setValueAtTime(0.45 / fs.length, t + len * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + len + 0.02);
      }
}


export interface NitroSound {
  /** `on` while the nitro burns; `speed` (m/s) lifts the turbo's whine */
  set(on: boolean, speed: number): void;
  dispose(): void;
}

/**
 * The nitro: a deep, steady roar of flame out of the pipes (dark, low-passed noise — no hiss, no
 * flutter), a turbo whine rising with the speed, and a soft "whoomp" as it lights.
 */
export function createNitroSound(ac: AudioContext): NitroSound {
  // brown noise (a random walk): all rumble, no sizzle
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  // (the loop's ends faded together: no click each time round)
  const fade = Math.floor(ac.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    d[i] = d[i] * k + d[len - fade + i] * (1 - k);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopEnd = (len - fade) / ac.sampleRate;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  lp.Q.value = 0.8;
  const roar = ac.createGain();
  roar.gain.value = 0;
  // (steady: a flutter on it read as a rapid ticking)
  src.connect(lp).connect(roar).connect(bus(ac));
  src.start();
  // the turbo: a thin whine, quiet, rising with the speed
  const whine = ac.createOscillator();
  whine.type = "triangle";
  whine.frequency.value = 900;
  const wg = ac.createGain();
  wg.gain.value = 0;
  whine.connect(wg).connect(bus(ac));
  whine.start();
  let was = false;
  return {
    set(on, speed) {
      const t = ac.currentTime;
      roar.gain.setTargetAtTime(on ? 0.34 : 0, t, on ? 0.06 : 0.18);
      wg.gain.setTargetAtTime(on ? 0.018 : 0, t, on ? 0.15 : 0.12);
      whine.frequency.setTargetAtTime(900 + Math.min(speed, 85) * 22, t, 0.3);
      if (on && !was) {
        // lighting up: a soft low "whoomp"
        const n = Math.floor(ac.sampleRate * 0.4);
        const b = ac.createBuffer(1, n, ac.sampleRate);
        const bd = b.getChannelData(0);
        let w = 0;
        for (let i = 0; i < n; i++) {
          w = (w + 0.03 * (Math.random() * 2 - 1)) / 1.03;
          bd[i] = w * 6 * Math.sin((Math.PI * i) / n);
        }
        const s = ac.createBufferSource();
        s.buffer = b;
        const f = ac.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(220, t);
        f.frequency.exponentialRampToValueAtTime(900, t + 0.35);
        const g = ac.createGain();
        g.gain.value = 0.45;
        s.connect(f).connect(g).connect(bus(ac));
        s.start(t);
      }
      was = on;
    },
    dispose() {
      const t = ac.currentTime;
      roar.gain.setTargetAtTime(0, t, 0.05);
      wg.gain.setTargetAtTime(0, t, 0.05);
      setTimeout(() => {
        src.stop();
        whine.stop();
      }, 300);
    },
  };
}

export interface Music {
  /** fade in (or back up) */
  play(): void;
  /** fade down (the menu is open) */
  pause(): void;
  /** fade out for good (the race is over) */
  stop(): void;
}

/**
 * The race music: one of the tracks in game.ts' MUSIC (all CC0, from OpenGameArt), picked in the
 * menu. It loops; loaded when the race starts (a moment: until then, none).
 */
export function createRaceMusic(ac: AudioContext, url: string): Music {
  const LEVEL = 0.85;
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(bus(ac));
  const track = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => ac.decodeAudioData(b))
    .catch(() => null);
  let src: AudioBufferSourceNode | null = null;
  let stopped = false;
  const fade = (v: number, tc: number) => master.gain.setTargetAtTime(v, ac.currentTime, tc);
  return {
    play() {
      if (stopped) return;
      if (!src)
        void track.then((buf) => {
          if (!buf || stopped || src) return;
          src = ac.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(master);
          src.start();
        });
      fade(LEVEL, 0.3);
    },
    pause() {
      fade(LEVEL * 0.25, 0.3);
    },
    stop() {
      stopped = true;
      fade(0, 1.2);
      setTimeout(() => {
        src?.stop();
        master.disconnect();
      }, 6000);
    },
  };
}

export interface WaterSound {
  /** 0 (away from it) … 1 (in the glass tunnel, under the water) */
  set(level: number): void;
  dispose(): void;
}

/**
 * Under the aquarium (with everything else muffled — see setUnderwater): a calm, low, slowly moving
 * tone, like the hush of deep water, and now and then a soft round bubble. No noise in it at all.
 */
export function createWaterSound(ac: AudioContext): WaterSound {
  const out = ac.createGain();
  out.gain.value = 0;
  // (straight to the speakers: it is the sound of the water itself, not muffled by it)
  out.connect(ac.destination);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  lp.connect(out);
  // a soft open chord (A, E, A) drifting very slowly in and out of tune
  const tones = [110, 164.81, 220].map((f, i) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = [0.5, 0.3, 0.18][i];
    const drift = ac.createOscillator();
    drift.frequency.value = 0.05 + i * 0.03;
    const dg = ac.createGain();
    dg.gain.value = 3;
    drift.connect(dg).connect(o.detune);
    // and a slow swell, each at its own pace
    const sw = ac.createOscillator();
    sw.frequency.value = 0.07 + i * 0.04;
    const sg = ac.createGain();
    sg.gain.value = 0.35 * g.gain.value;
    sw.connect(sg).connect(g.gain);
    o.connect(g).connect(lp);
    for (const n of [o, drift, sw]) n.start();
    return [o, drift, sw];
  });
  // a bubble: a gentle "bloop", a sine gliding up, rounded off
  const bloop = (t: number) => {
    const o = ac.createOscillator();
    o.type = "sine";
    const f0 = 260 + Math.random() * 200;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (1.6 + Math.random() * 0.5), t + 0.14);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.03, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.24);
  };
  let level = 0;
  let nextBloop = 0;
  return {
    set(v) {
      const t = ac.currentTime;
      if (Math.abs(v - level) > 0.01) out.gain.setTargetAtTime(v * 0.22, t, 0.6);
      level = v;
      if (v > 0.5 && t > nextBloop) {
        bloop(t + 0.02);
        nextBloop = t + 1.8 + Math.random() * 3;
      }
    },
    dispose() {
      out.gain.setTargetAtTime(0, ac.currentTime, 0.1);
      setTimeout(() => {
        for (const ns of tones) for (const n of ns) n.stop();
        out.disconnect();
      }, 500);
    },
  };
}
