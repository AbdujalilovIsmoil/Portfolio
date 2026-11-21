"use client";

import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { formatLap } from "./driveSignal";
import { MISSIONS } from "./game";
import type { PlaySignal } from "./raceSignal";

const pop = keyframes`
  0% { opacity: 0; transform: translate(-50%, -50%) scale(1.8); }
  25% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
`;

const rise = keyframes`
  from { opacity: 0; transform: translate(-50%, -46%); }
  to { opacity: 1; transform: translate(-50%, -50%); }
`;

const Bar = styled.div`
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: stretch;
  gap: 2px;
  border-radius: 14px;
  overflow: hidden;
  font-family: var(--font-nav);
  color: #fff;
  pointer-events: none;
  box-shadow: 0 14px 34px -14px rgba(0, 0, 0, 0.7);

  > div {
    background: rgba(12, 15, 22, 0.9);
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 74px;
  }
  small {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.4px;
    color: rgba(238, 242, 250, 0.5);
    text-transform: uppercase;
  }
  b {
    font-size: 21px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }
  .accent {
    background: linear-gradient(160deg, #ff3b6b, #c8204c);
  }
  .amber {
    background: linear-gradient(160deg, #ffb21f, #e07b0c);
    color: #1a1206;
  }
  .amber small {
    color: rgba(26, 18, 6, 0.6);
  }
  .low b {
    color: #ff5b5b;
  }
  @media (max-width: 860px) {
    top: auto;
    bottom: 10px;
    > div {
      padding: 6px 10px;
      min-width: 56px;
    }
    b {
      font-size: 16px;
    }
  }
  /* (a phone held upright: no room between the two sticks — above them) */
  @media (max-width: 560px) {
    bottom: 152px;
  }
`;

const Status = styled.div`
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(12, 15, 22, 0.82);
  color: #fff;
  font: 700 13px var(--font-nav);
  pointer-events: none;
  white-space: nowrap;
  @media (max-width: 860px) {
    top: auto;
    bottom: 62px;
    font-size: 11.5px;
  }
  @media (max-width: 560px) {
    bottom: 204px;
  }
`;

const Count = styled.div`
  position: fixed;
  left: 50%;
  top: 42%;
  z-index: 70;
  font: 900 min(26vw, 200px) / 1 var(--font-nav);
  color: #fff;
  text-shadow:
    0 0 40px rgba(255, 59, 107, 0.65),
    0 6px 0 rgba(0, 0, 0, 0.35);
  pointer-events: none;
  animation: ${pop} 1s ease-out both;
`;

const Result = styled.div`
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 280;
  width: min(460px, calc(100vw - 28px));
  padding: 24px 24px 20px;
  border-radius: 20px;
  font-family: var(--font-nav);
  color: #eef2fa;
  background:
    radial-gradient(120% 70% at 100% 0%, color-mix(in srgb, var(--c) 30%, transparent), transparent 60%),
    linear-gradient(165deg, #181d29, #0c0f16);
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.85), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  animation: ${rise} 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;

  h2 {
    margin: 0;
    font-size: 28px;
    font-weight: 900;
    color: #fff;
  }
  p {
    margin: 6px 0 14px;
    color: rgba(238, 242, 250, 0.7);
    font-size: 14px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  td {
    padding: 7px 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }
  tr.you td {
    font-weight: 800;
    color: #fff;
  }
  .dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 8px;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  button {
    flex: 1;
    min-width: 120px;
    border-radius: 999px;
    padding: 11px 14px;
    font: 800 13.5px var(--font-nav);
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }
  button.main {
    border: none;
    background: #fff;
    color: #10131a;
  }
`;

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

type View = Pick<PlaySignal, "kind" | "state" | "count" | "lap" | "laps" | "position" | "cars" | "title" | "objective" | "progress" | "total" | "status" | "message" | "results">;

/**
 * The race / mission on screen: lap, position and time (or the mission's progress and clock) along
 * the top, the countdown, and the result at the end with what to do next.
 */
export default function PlayHud(props: {
  playRef: React.MutableRefObject<PlaySignal>;
  missionId: string | null;
  onAgain: () => void;
  onNext: (() => void) | null;
  onMenu: () => void;
  onTracks: () => void;
  /** the result is up (the game waits for a button) or gone */
  onOver: (over: boolean) => void;
}) {
  const { playRef, missionId, onAgain, onNext, onMenu, onTracks, onOver } = props;
  const [v, setV] = useState<View | null>(null);
  const timeRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLElement>(null);
  const leftBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      const p = playRef.current;
      const key = [p.kind, p.state, p.count, p.lap, p.position, p.progress, p.status, p.message, p.results.length].join("|");
      if (key !== last) {
        last = key;
        setV({ kind: p.kind, state: p.state, count: p.count, lap: p.lap, laps: p.laps, position: p.position, cars: p.cars, title: p.title, objective: p.objective, progress: p.progress, total: p.total, status: p.status, message: p.message, results: p.results.slice() });
      }
      // the clocks tick every frame: straight on the DOM
      if (timeRef.current) timeRef.current.textContent = formatLap(p.time);
      if (leftRef.current) leftRef.current.textContent = p.timeLeft === null ? "—" : formatLap(Math.max(0, p.timeLeft));
      leftBox.current?.classList.toggle("low", p.timeLeft !== null && p.timeLeft < 10);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playRef]);

  const over = !!v && (v.state === "won" || v.state === "lost");
  useEffect(() => {
    onOver(over);
  }, [over, onOver]);

  if (!v || !v.kind) return null;
  const race = v.kind === "race";
  const racing = v.cars > 0; // (a duel mission is a race too)
  const mission = MISSIONS.find((m) => m.id === missionId);
  const big = v.state === "countdown" ? String(v.count || "") : "";

  return (
    <>
      {(v.state === "countdown" || v.state === "on") && (
        <Bar>
          {racing && (
            <>
              <div className="accent">
                <small>Pos</small>
                <b>
                  {v.position}/{v.cars}
                </b>
              </div>
              <div>
                <small>Lap</small>
                <b>
                  {Math.max(1, v.lap)}/{v.laps}
                </b>
              </div>
            </>
          )}
          {!race && !racing && (
            <div className="amber">
              <small>{mission?.title ?? "Mission"}</small>
              <b>
                {v.progress}
                {v.total > 1 && v.total < 1000 ? `/${v.total}` : ""}
              </b>
            </div>
          )}
          <div>
            <small>Time</small>
            <b ref={timeRef}>0:00.0</b>
          </div>
          {!race && (
            <div ref={leftBox}>
              <small>Left</small>
              <b ref={leftRef}>—</b>
            </div>
          )}
        </Bar>
      )}
      {v.state === "on" && v.status && <Status>{v.status}</Status>}
      {v.state === "countdown" && v.count > 0 && <Count key={big}>{big}</Count>}
      {v.state === "on" && <GoFlash />}

      {over && (
        <Result style={{ ["--c" as string]: v.state === "won" ? "#5ee08a" : "#ff3b6b" }}>
          {race || (racing && v.results.length > 1) ? (
            <>
              <h2>{v.position === 1 ? "🏆 You won!" : `You finished ${ordinal(v.position)}`}</h2>
              <p>{race ? "The finishing order" : v.state === "won" ? "You beat the rival." : "The rival got there first."}</p>
              <table>
                <tbody>
                  {v.results.map((r, i) => (
                    <tr key={r.name} className={r.you ? "you" : ""}>
                      <td>{i + 1}.</td>
                      <td>
                        <span className="dot" style={{ background: r.color }} />
                        {r.name}
                      </td>
                      <td style={{ textAlign: "right" }}>{r.time !== null ? formatLap(r.time) : "—"}</td>
                      <td style={{ textAlign: "right", opacity: 0.6 }}>{r.best !== null ? `best ${formatLap(r.best)}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <>
              <h2>{v.state === "won" ? "✅ Mission complete!" : "Mission failed"}</h2>
              <p>{v.state === "won" ? `${mission?.title ?? ""} — in ${formatLap(v.results[0]?.time ?? 0)}` : v.message || "Try again"}</p>
            </>
          )}
          <div className="buttons">
            <button className={v.state === "won" && onNext ? "" : "main"} onClick={onAgain}>
              {race ? "Race again" : "Try again"}
            </button>
            {!race && onNext && v.state === "won" && (
              <button className="main" onClick={onNext}>
                Next mission ▸
              </button>
            )}
            <button onClick={race ? onTracks : onMenu}>{race ? "Change track" : "Missions"}</button>
          </div>
        </Result>
      )}
    </>
  );
}

/** "GO!" for a moment when the lights go out. */
function GoFlash() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 900);
    return () => clearTimeout(t);
  }, []);
  return on ? <Count style={{ color: "#5ee08a" }}>GO!</Count> : null;
}
