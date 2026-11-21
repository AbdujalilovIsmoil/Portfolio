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

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: none; }
`;
const rowIn = keyframes`
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: none; }
`;
const shine = keyframes`
  from { transform: translateX(-100%) skewX(-20deg); }
  to { transform: translateX(400%) skewX(-20deg); }
`;
const bannerIn = keyframes`
  0% { opacity: 0; transform: translateY(-50%) scaleY(0); }
  12% { opacity: 1; transform: translateY(-50%) scaleY(1); }
  85% { opacity: 1; transform: translateY(-50%) scaleY(1); }
  100% { opacity: 0; transform: translateY(-50%) scaleY(0.6); }
`;
const bigIn = keyframes`
  0% { opacity: 0; transform: scale(2.6); letter-spacing: 30px; }
  30% { opacity: 1; transform: scale(1); letter-spacing: 2px; }
  100% { opacity: 1; transform: scale(1.04); letter-spacing: 4px; }
`;
const glint = keyframes`
  0%, 100% { filter: drop-shadow(0 0 10px rgba(255, 196, 60, 0.5)); }
  50% { filter: drop-shadow(0 0 26px rgba(255, 210, 90, 0.95)); }
`;

/** The podium colours: gold, silver, bronze; after that plain. */
const MEDAL = ["linear-gradient(160deg, #fff3b0, #ffc53a 45%, #c98a12)", "linear-gradient(160deg, #ffffff, #c9d1dc 50%, #8d97a6)", "linear-gradient(160deg, #ffd2a8, #d98a4a 50%, #8f4f22)"];
const MEDAL_SOLID = ["#ffc53a", "#c9d1dc", "#d98a4a"];

/** "VICTORY": a band across the screen the moment you take the flag first. */
const Banner = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  top: 38%;
  z-index: 285;
  pointer-events: none;
  font-family: var(--font-nav);
  text-align: center;
  padding: 22px 16px 24px;
  background: linear-gradient(90deg, transparent, rgba(8, 10, 16, 0.86) 18%, rgba(8, 10, 16, 0.86) 82%, transparent);
  animation: ${bannerIn} 3.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  &::before,
  &::after {
    content: "";
    position: absolute;
    left: 12%;
    right: 12%;
    height: 10px;
    background: repeating-conic-gradient(#fff 0 25%, #111 0 50%) 0 0 / 10px 10px;
    opacity: 0.9;
  }
  &::before {
    top: 0;
  }
  &::after {
    bottom: 0;
  }
  .p {
    display: inline-block;
    font-size: clamp(16px, 2.2vw, 22px);
    font-weight: 900;
    letter-spacing: 6px;
    color: #ffd76a;
    text-transform: uppercase;
  }
  .big {
    display: block;
    font-size: clamp(54px, 11vw, 132px);
    line-height: 0.95;
    font-weight: 900;
    font-style: italic;
    text-transform: uppercase;
    background: ${MEDAL[0]};
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation:
      ${bigIn} 3.4s cubic-bezier(0.22, 1, 0.36, 1) both,
      ${glint} 1.2s ease-in-out 3;
  }
  .sub {
    margin-top: 8px;
    font-size: clamp(13px, 1.6vw, 16px);
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(238, 242, 250, 0.8);
  }
`;

/**
 * The result: a classification panel down the right, like a race broadcast — the chequered flag
 * along its top, where you finished (gold, silver, bronze), your time, best lap and the gap, then
 * the order with each car's time or gap and the fastest lap in purple. On a phone, a sheet at the bottom.
 */
const Result = styled.div`
  --medal: ${MEDAL_SOLID[0]};
  position: fixed;
  right: max(24px, 4vw);
  top: 50%;
  /* (centred with "translate", brought in with "transform": a resize never restarts the entrance) */
  translate: 0 -50%;
  z-index: 280;
  width: min(440px, calc(100vw - 28px));
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  border-radius: 6px 6px 18px 18px;
  font-family: var(--font-nav);
  color: #eef2fa;
  background: linear-gradient(170deg, rgba(22, 26, 38, 0.97), rgba(9, 11, 17, 0.97));
  box-shadow:
    0 40px 90px -30px rgba(0, 0, 0, 0.9),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  animation: ${slideIn} 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--delay, 0s);

  @media (max-width: 760px) {
    right: 14px;
    left: 14px;
    top: auto;
    bottom: 14px;
    width: auto;
    translate: none;
    max-height: calc(100vh - 28px);
  }

  .flag {
    height: 12px;
    background: repeating-conic-gradient(#f4f4f4 0 25%, #15171d 0 50%) 0 0 / 12px 12px;
  }
  .head {
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 22px 16px;
    overflow: hidden;
    background: radial-gradient(90% 120% at 0% 0%, color-mix(in srgb, var(--medal) 22%, transparent), transparent 70%);
  }
  .head .sweep {
    position: absolute;
    inset: 0 auto 0 0;
    width: 30%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
    animation: ${shine} 2.6s ease-in-out 0.6s 2;
  }
  .trophy {
    flex: none;
    width: 62px;
    height: 62px;
    animation: ${glint} 1.6s ease-in-out 3;
  }
  .kicker {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(238, 242, 250, 0.55);
  }
  .place {
    display: block;
    margin: 2px 0 2px;
    font-size: 50px;
    line-height: 1;
    font-weight: 900;
    font-style: italic;
    letter-spacing: -1px;
    text-transform: uppercase;
    background: var(--medal-grad, #fff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .verdict {
    font-size: 14px;
    font-weight: 700;
    color: rgba(238, 242, 250, 0.85);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    margin: 0 22px;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.08);
  }
  .stats > div {
    padding: 10px 12px;
    background: rgba(9, 11, 17, 0.9);
  }
  .stats small {
    display: block;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: rgba(238, 242, 250, 0.5);
  }
  .stats b {
    font-size: 17px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .stats .good {
    color: #5ee08a;
  }
  .stats .bad {
    color: #ff7a8a;
  }
  .cls {
    margin: 16px 22px 0;
  }
  .cls h3 {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(238, 242, 250, 0.5);
  }
  .row {
    display: grid;
    grid-template-columns: 34px 4px 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 0 10px 0 0;
    height: 40px;
    margin-bottom: 4px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    animation: ${rowIn} 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .row.you {
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
    font-weight: 800;
    color: #fff;
  }
  .pos {
    display: grid;
    place-items: center;
    height: 100%;
    border-radius: 6px 0 0 6px;
    font-weight: 900;
    font-size: 15px;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }
  .pos.m {
    color: #15110a;
  }
  .stripe {
    width: 4px;
    height: 22px;
    border-radius: 2px;
  }
  .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .time {
    text-align: right;
    min-width: 72px;
  }
  .best {
    text-align: right;
    min-width: 64px;
    font-size: 12px;
    color: rgba(238, 242, 250, 0.55);
  }
  .best.fl {
    color: #d48cff;
    font-weight: 800;
  }
  .best.fl::before {
    content: "FL ";
    font-size: 9.5px;
    padding: 1px 4px;
    margin-right: 3px;
    border-radius: 3px;
    background: #a43bff;
    color: #fff;
  }
  .msg {
    margin: 4px 22px 0;
    color: rgba(238, 242, 250, 0.75);
    font-size: 14px;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 18px 22px 22px;
  }
  button {
    flex: 1;
    min-width: 130px;
    border-radius: 10px;
    padding: 13px 14px;
    font: 800 13px var(--font-nav);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    transition:
      transform 0.15s ease,
      background 0.15s ease;
  }
  button:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.12);
  }
  button.main {
    border: none;
    background: var(--medal-grad, #fff);
    color: #12100a;
  }
`;

/** A trophy cup in the medal's colours. */
function Trophy({ place }: { place: number }) {
  const c = MEDAL_SOLID[place - 1] ?? "#8d97a6";
  return (
    <svg className="trophy" viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={`cup${place}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor={c} />
          <stop offset="1" stopColor={c} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path d="M18 10h28v10c0 9-6 16-14 16S18 29 18 20z" fill={`url(#cup${place})`} />
      <path d="M18 14H9c0 9 5 13 11 13M46 14h9c0 9-5 13-11 13" fill="none" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
      <rect x="29" y="35" width="6" height="9" fill={c} />
      <path d="M21 46h22l3 8H18z" fill={`url(#cup${place})`} />
      <text x="32" y="27" textAnchor="middle" fontSize="13" fontWeight="900" fill="#15110a" fontFamily="sans-serif">
        {place}
      </text>
    </svg>
  );
}

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
  /** the race's track (for the result) */
  trackName?: string;
  /** the result is up (the game waits for a button) or gone */
  onOver: (over: boolean) => void;
}) {
  const { playRef, missionId, onAgain, onNext, onMenu, onTracks, onOver, trackName } = props;
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

      {over && v.state === "won" && race && (
        <Banner key="banner">
          <span className="p">P1 · {trackName ?? "Race"}</span>
          <span className="big">Victory</span>
          <div className="sub">Chequered flag — first of {v.cars}</div>
        </Banner>
      )}
      {over && <ResultPanel v={v} race={race} racing={racing} mission={mission} trackName={trackName} onAgain={onAgain} onNext={onNext} onMenu={onMenu} onTracks={onTracks} />}
    </>
  );
}

/** The result panel (race classification, or the mission's outcome) with what to do next. */
function ResultPanel(props: {
  v: View;
  race: boolean;
  racing: boolean;
  mission: (typeof MISSIONS)[number] | undefined;
  trackName?: string;
  onAgain: () => void;
  onNext: (() => void) | null;
  onMenu: () => void;
  onTracks: () => void;
}) {
  const { v, race, racing, mission, trackName, onAgain, onNext, onMenu, onTracks } = props;
  const won = v.state === "won";
  const classified = race || (racing && v.results.length > 1);
  // (where you are in the classification itself: the header and the table can never disagree)
  const place = classified ? v.results.findIndex((r) => r.you) + 1 || v.position : won ? 1 : 0;
  const medal = place >= 1 && place <= 3;
  const style = {
    ["--medal" as string]: medal ? MEDAL_SOLID[place - 1] : won ? "#5ee08a" : "#ff3b6b",
    ["--medal-grad" as string]: medal ? MEDAL[place - 1] : "#ffffff",
    // (a win: the banner first, then the panel)
    ["--delay" as string]: won && race ? "2.6s" : "0s",
  };
  const rows = v.results;
  const lead = rows[0]?.time ?? 0;
  const you = rows.find((r) => r.you);
  const fastest = rows.reduce<number | null>((m, r) => (r.best !== null && (m === null || r.best < m) ? r.best : m), null);
  const second = rows[1]?.time ?? null;
  const gapLabel = place === 1 && second !== null ? `−${(second - lead).toFixed(3)}` : you?.time != null ? `+${(you.time - lead).toFixed(3)}` : "—";
  const verdict = classified
    ? place === 1
      ? race
        ? `Victory — you beat all ${v.cars - 1} rivals`
        : "You beat the rival"
      : place <= 3
        ? `A podium finish — ${ordinal(place)} of ${v.cars}`
        : `${ordinal(place)} of ${v.cars} — the podium is close`
    : won
      ? "Mission complete"
      : v.message || "Try again";

  return (
    <Result style={style}>
      <div className="flag" />
      <div className="head">
        <span className="sweep" />
        {classified ? <Trophy place={place} /> : null}
        <div>
          <div className="kicker">{classified ? `${race ? "Race result" : "Duel"} · ${trackName ?? mission?.title ?? ""}` : `Mission · ${mission?.title ?? ""}`}</div>
          <span className="place">{classified ? (place === 1 ? "Winner" : `${ordinal(place)}`) : won ? "Complete" : "Failed"}</span>
          <div className="verdict">{verdict}</div>
        </div>
      </div>
      {classified ? (
        <>
          <div className="stats">
            <div>
              <small>Race time</small>
              <b>{you?.time != null ? formatLap(you.time) : "—"}</b>
            </div>
            <div>
              <small>Best lap</small>
              <b className={you?.best != null && you.best === fastest ? "good" : ""}>{you?.best != null ? formatLap(you.best) : "—"}</b>
            </div>
            <div>
              <small>{place === 1 ? "Margin" : "To winner"}</small>
              <b className={place === 1 ? "good" : "bad"}>{gapLabel}</b>
            </div>
          </div>
          <div className="cls">
            <h3>Classification</h3>
            {rows.map((r, i) => (
              <div
                key={r.name}
                className={`row${r.you ? " you" : ""}`}
                style={{
                  animationDelay: `calc(var(--delay) + ${0.25 + i * 0.08}s)`,
                }}
              >
                <span className={`pos${i < 3 ? " m" : ""}`} style={i < 3 ? { background: MEDAL[i] } : undefined}>
                  {i + 1}
                </span>
                <span className="stripe" style={{ background: r.color }} />
                <span className="name">{r.you ? "You" : r.name}</span>
                <span className="time">{r.time === null ? "—" : i === 0 ? formatLap(r.time) : `+${(r.time - lead).toFixed(3)}`}</span>
                <span className={`best${r.best !== null && r.best === fastest ? " fl" : ""}`}>{r.best !== null ? formatLap(r.best) : ""}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="msg">{won ? `Done in ${formatLap(v.results[0]?.time ?? 0)}` : "Have another go — the clock resets."}</p>
      )}
      <div className="buttons">
        <button className={won && onNext && !race ? "" : "main"} onClick={onAgain}>
          {race ? "Race again" : "Try again"}
        </button>
        {!race && onNext && won && (
          <button className="main" onClick={onNext}>
            Next mission ▸
          </button>
        )}
        <button onClick={race ? onTracks : onMenu}>{race ? "Change track" : "Missions"}</button>
      </div>
    </Result>
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
