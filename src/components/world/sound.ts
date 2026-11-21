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

/** The shared audio context if the user has already unlocked audio (clicked Start), else null. */
export function peekCtx(): AudioContext | null {
  return ctx && ctx.state === "running" ? ctx : null;
}

/** A heavy "thud" — a deep punchy sine drop plus a short noise crack — scaled by strength (0–1). */
export function playImpactThud(strength = 1) {
  const ac = peekCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const volume = 0.22 + strength * 0.3;

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(105, now);
  osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(volume, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
  osc.connect(oscGain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.34);

  const n = Math.floor(ac.sampleRate * 0.16);
  const buffer = ac.createBuffer(1, n, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noise.connect(filter).connect(noiseGain).connect(ac.destination);
  noise.start(now);
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
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.52);
  });
}

export interface EngineSound {
  /** speed in m/s, throttle 0–1; `mute` silences it (the menu is open, or the car is held at the start / finish) */
  set(speed: number, throttle: number, mute: boolean): void;
  dispose(): void;
}

/**
 * A real engine: a short recording looped (with its ends cross-faded so the seam doesn't click),
 * played faster as the car goes faster, a little louder and brighter on the throttle.
 */
export async function createEngineSample(ac: AudioContext, url: string): Promise<EngineSound> {
  const raw = await ac.decodeAudioData(await (await fetch(url)).arrayBuffer());
  // fold the last 60 ms over the first 60 ms: a seamless loop
  const fade = Math.floor(raw.sampleRate * 0.06);
  const n = raw.length - fade;
  const loop = ac.createBuffer(raw.numberOfChannels, n, raw.sampleRate);
  for (let c = 0; c < raw.numberOfChannels; c++) {
    const src = raw.getChannelData(c);
    const dst = loop.getChannelData(c);
    dst.set(src.subarray(0, n));
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      dst[i] = src[i] * Math.sin((k * Math.PI) / 2) + src[n + i] * Math.cos((k * Math.PI) / 2);
    }
  }
  const source = ac.createBufferSource();
  source.buffer = loop;
  source.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1600;
  filter.Q.value = 0.4;
  const gain = ac.createGain();
  gain.gain.value = 0;
  source.connect(filter).connect(gain).connect(ac.destination);
  source.start();
  return {
    set(speed, throttle, mute) {
      const k = Math.min(1, Math.abs(speed) / 34);
      // (past the throttle's top speed — the nitro — it keeps on climbing, a little)
      const over = Math.min(1, Math.max(0, Math.abs(speed) - 36) / 47);
      const t = ac.currentTime;
      source.playbackRate.setTargetAtTime(0.7 + k * 1.15 + over * 0.4 + throttle * 0.1, t, 0.08);
      filter.frequency.setTargetAtTime(1300 + k * 2200 + over * 1200 + throttle * 600, t, 0.1);
      gain.gain.setTargetAtTime(mute ? 0 : 0.16 + k * 0.14 + throttle * 0.1, t, 0.1);
    },
    dispose() {
      gain.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      setTimeout(() => {
        source.stop();
        gain.disconnect();
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
  out.gain.value = 0.1 + strength * 0.22;
  out.connect(ac.destination);
  // the crack: a burst of bright noise
  const n = Math.floor(ac.sampleRate * 0.28);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1400 + strength * 900;
  bp.Q.value = 0.7;
  src.connect(bp).connect(out);
  src.start(now);
  // the rattle: little clicks of grit landing, spread out over half a second
  const clicks = 4 + Math.round(strength * 10);
  const m = Math.floor(ac.sampleRate * 0.012);
  for (let c = 0; c < clicks; c++) {
    const cb = ac.createBuffer(1, m, ac.sampleRate);
    const cd = cb.getChannelData(0);
    for (let i = 0; i < m; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / m);
    const cs = ac.createBufferSource();
    cs.buffer = cb;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2500 + Math.random() * 2500;
    const g = ac.createGain();
    g.gain.value = 0.25 + Math.random() * 0.4;
    cs.connect(hp).connect(g).connect(out);
    cs.start(now + 0.12 + Math.random() * (0.25 + strength * 0.35));
  }
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
  src.connect(bp).connect(g).connect(ac.destination);
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
  o.connect(f).connect(g).connect(ac.destination);
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
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.3);
  });
}
