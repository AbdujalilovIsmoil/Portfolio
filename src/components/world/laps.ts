/**
 * Counts laps from the car's distance along the track: a lap runs from crossing the start line
 * forwards to crossing it forwards again, having been round (past the far side of the lap) — so
 * wiggling back and forth over the line, or reversing round, never counts.
 */
export class LapClock {
  private prevRel = -1;
  private armed = false;
  /** forward crossings of the line so far (the first one starts lap 1) */
  crossings = 0;
  /** time the current lap began (null before the first crossing) */
  lapStart: number | null = null;
  lastLap: number | null = null;
  bestLap: number | null = null;

  constructor(
    private readonly length: number,
    private readonly startS: number
  ) {}

  /** Laps finished. */
  get laps() {
    return Math.max(0, this.crossings - 1);
  }

  /** Feed it the car's distance along the lap and the time; returns a lap's time on the frame it is finished. */
  update(s: number, t: number): number | null {
    const L = this.length;
    const rel = (((s - this.startS) % L) + L) % L;
    let done: number | null = null;
    if (this.prevRel >= 0) {
      if (rel > L * 0.3 && rel < L * 0.7) this.armed = true;
      const forward = this.prevRel > L * 0.9 && rel < L * 0.1;
      const back = this.prevRel < L * 0.1 && rel > L * 0.9;
      if (forward && (this.crossings === 0 || this.armed)) {
        if (this.lapStart !== null) {
          done = t - this.lapStart;
          this.lastLap = done;
          if (this.bestLap === null || done < this.bestLap) this.bestLap = done;
        }
        this.crossings++;
        this.lapStart = t;
        this.armed = false;
      } else if (back) this.armed = false;
    }
    this.prevRel = rel;
    return done;
  }

  /** How far round the current lap the car is (0–1), counting from the line. */
  progress(s: number) {
    const L = this.length;
    return ((((s - this.startS) % L) + L) % L) / L;
  }
}
