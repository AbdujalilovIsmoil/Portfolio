"use client";

let ctx: AudioContext | null = null;

/** Create the audio context up-front (on the start click) so the first footstep doesn't stall. */
export function warmAudio() {
  const c = getCtx();
  if (c.state === "suspended") void c.resume();
}

/** The shared audio context if the user has already unlocked audio (clicked Start), else null. */
export function peekCtx(): AudioContext | null {
  return ctx && ctx.state === "running" ? ctx : null;
}

export function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** A soft, muffled footstep — a low sine thump layered with a short filtered
 * noise burst — synthesized so it stays gentle no matter how often it repeats,
 * instead of a repurposed UI "click" sound. */
export function playFootstep(volume = 0.16, pitch = 1) {
  const audioCtx = getCtx();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(55 * pitch, now + 0.1);

  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(volume, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(oscGain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.13);

  const bufferSize = Math.floor(audioCtx.sampleRate * 0.07);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420 * pitch;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.45, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  noise.connect(filter).connect(noiseGain).connect(audioCtx.destination);
  noise.start(now);
}

/** A heavy landing "thud" — a deep punchy sine drop plus a broadband noise
 * crack — for hitting the ground hard, scaled by impact strength (0-1). */
export function playImpactThud(strength = 1) {
  const audioCtx = getCtx();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  const now = audioCtx.currentTime;
  const volume = 0.28 + strength * 0.32;

  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(105, now);
  osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(volume, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
  osc.connect(oscGain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.34);

  const bufferSize = Math.floor(audioCtx.sampleRate * 0.16);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  noise.connect(filter).connect(noiseGain).connect(audioCtx.destination);
  noise.start(now);
}

/** A watery splash — filtered noise with a falling band-pass, for jumping in and swimming strokes. */
export function playSplash(volume = 0.15) {
  const audioCtx = getCtx();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  const now = audioCtx.currentTime;
  const len = Math.floor(audioCtx.sampleRate * 0.45);
  const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const bp = audioCtx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(2200, now);
  bp.frequency.exponentialRampToValueAtTime(500, now + 0.4);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  noise.connect(bp).connect(gain).connect(audioCtx.destination);
  noise.start(now);
}
