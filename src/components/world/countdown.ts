import type { MutableRefObject } from "react";
import type { IntroSignal } from "./introSignal";
import type { PlaySignal } from "./raceSignal";
import { playBeep } from "./sound";
import type { Ctx } from "./core";

/** How long after Start (the camera's fly-in) the countdown begins. */
const INTRO = 2.6;

/**
 * Start → the camera flies in → 3 – 2 – 1 – GO. Holds the car until GO; `update` says whether
 * the clock is running (from GO on).
 */
export class Countdown {
  private introAt: number;
  private since = -1;
  private lastBeat = 4;

  constructor(
    private readonly ctx: Ctx,
    private readonly introRef: MutableRefObject<IntroSignal>,
    private readonly play: PlaySignal,
    /** the cars held until GO (you; split screen, both players) */
    private readonly cars = [ctx.vehicle]
  ) {
    this.introAt = introRef.current.value;
    for (const c of cars) c.frozen = true;
    play.state = "intro";
    play.count = 3;
  }

  update(dt: number) {
    const play = this.play;
    if (this.introRef.current.value !== this.introAt) {
      this.introAt = this.introRef.current.value;
      this.since = 0;
    }
    if (this.since < 0 || play.state === "on" || play.state === "won" || play.state === "lost") return play.state === "on";
    this.since += dt;
    if (play.state === "intro" && this.since > INTRO) play.state = "countdown";
    if (play.state === "countdown") {
      const left = 3 - (this.since - INTRO);
      const beat = Math.ceil(left);
      if (beat !== this.lastBeat && beat >= 0) {
        this.lastBeat = beat;
        playBeep(beat === 0);
      }
      play.count = Math.max(0, beat);
      if (left <= 0) {
        play.state = "on";
        play.count = 0;
        for (const c of this.cars) c.frozen = false;
      }
    }
    return play.state === "on";
  }
}
