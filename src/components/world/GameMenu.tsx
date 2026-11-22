"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { formatLap } from "./driveSignal";
import { MISSIONS, MUSIC, TRACKS, TRACK_IDS, type Mode, type MusicId, type Session, type TrackId } from "./game";
import { getMusic, setMusic } from "./musicChoice";
import { useProgress } from "./progress";
import { buildTrack } from "./Track";

const rise = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(120% 90% at 50% 0%, rgba(20, 28, 48, 0.78), rgba(4, 6, 12, 0.9));
  overflow-y: auto;
  font-family: var(--font-nav);
  color: #eef2fa;

  @media (max-width: 700px), (max-height: 500px) {
    padding: 16px;
  }
`;

const Panel = styled.div`
  width: min(1020px, 100%);
  /* (centred while it fits; taller than the screen, it starts at the top and scrolls) */
  margin: auto 0;
  animation: ${rise} 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
`;

const Head = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;

  h1 {
    margin: 0;
    font-size: clamp(24px, 3.6vw, 36px);
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #fff;
  }
  p {
    margin: 6px 0 0;
    color: rgba(238, 242, 250, 0.62);
    font-size: 14px;
  }
`;

const Back = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  border-radius: 999px;
  padding: 9px 16px;
  font: 700 13px var(--font-nav);
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    background: rgba(255, 255, 255, 0.12);
  }
`;

const Modes = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

/** A big tile: the colour runs down its left edge and glows in its corner. */
const Tile = styled.button<{ $c: string; $primary?: boolean }>`
  --c: ${({ $c }) => $c};
  position: relative;
  text-align: left;
  border: 1px solid ${({ $primary }) => ($primary ? "color-mix(in srgb, var(--c) 60%, transparent)" : "rgba(255,255,255,0.09)")};
  border-radius: 18px;
  padding: 22px 22px 20px 26px;
  min-height: 190px;
  color: #eef2fa;
  cursor: pointer;
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--c) 28%, transparent), transparent 60%),
    linear-gradient(165deg, #171c28, #0c0f17);
  box-shadow: 0 20px 50px -24px rgba(0, 0, 0, 0.8);
  transition: transform 0.18s ease, border-color 0.18s ease;
  font-family: var(--font-nav);

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    background: var(--c);
    box-shadow: 0 0 18px var(--c);
  }
  &:hover,
  &:focus-visible {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--c) 70%, transparent);
    outline: none;
  }
  .icon {
    font-size: 34px;
  }
  h2 {
    margin: 12px 0 6px;
    font-size: 22px;
    font-weight: 800;
    color: #fff;
  }
  p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
    color: rgba(238, 242, 250, 0.7);
  }
  .tag {
    display: inline-block;
    margin-top: 14px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
  }
`;

const shine = keyframes`
  from { transform: translateX(-120%) skewX(-20deg); }
  to { transform: translateX(260%) skewX(-20deg); }
`;

/**
 * A game-mode card, like a racing game's main menu: a real shot from that mode fills it, the name
 * sits big and slanted over a dark fade at the bottom, and on hover the shot pushes in and a light
 * sweeps across.
 */
const ModeCard = styled.button<{ $c: string; $img: string; $pos: string }>`
  --c: ${({ $c }) => $c};
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 470px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  overflow: hidden;
  isolation: isolate;
  text-align: left;
  color: #fff;
  cursor: pointer;
  background: #0b0e15;
  box-shadow: 0 24px 60px -28px rgba(0, 0, 0, 0.9);
  font-family: var(--font-nav);
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease, box-shadow 0.25s ease;

  /* the shot */
  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: var(--shot, 66%);
    z-index: -2;
    background: url(${({ $img }) => $img}) ${({ $pos }) => $pos} / cover no-repeat;
    transform: scale(1.02);
    transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s ease;
    filter: saturate(1.05) brightness(0.92);
  }
  /* the shot fades into the dark the text sits on, tinted with the mode's colour at the bottom */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      linear-gradient(180deg, rgba(5, 7, 12, 0.4) 0%, transparent 18%, transparent calc(var(--shot, 66%) - 26%), #070a11 var(--shot, 66%)),
      linear-gradient(0deg, color-mix(in srgb, var(--c) 22%, transparent), transparent 40%);
  }
  .sweep {
    position: absolute;
    inset: 0 auto 0 0;
    width: 45%;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
    transform: translateX(-120%) skewX(-20deg);
  }
  .num {
    position: absolute;
    top: 14px;
    left: 16px;
    padding: 4px 10px 4px 9px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    background: var(--c);
    color: #0b0e15;
    clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
  }
  .badge {
    position: absolute;
    top: 14px;
    right: 14px;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    background: rgba(5, 7, 12, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(6px);
  }
  .body {
    position: relative;
    padding: 0 22px 22px;
  }
  h2 {
    margin: 0;
    color: #fff;
    font-size: clamp(34px, 3.8vw, 44px);
    line-height: 0.95;
    font-weight: 900;
    font-style: italic;
    text-transform: uppercase;
    letter-spacing: -1px;
    text-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
  }
  .bar {
    width: 56px;
    height: 5px;
    margin: 12px 0 12px;
    background: var(--c);
    box-shadow: 0 0 16px var(--c);
    transform: skewX(-25deg);
    transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
  p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
    color: rgba(238, 242, 250, 0.78);
  }
  .go {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(238, 242, 250, 0.7);
  }
  .go b {
    color: var(--c);
    transition: transform 0.25s ease;
  }

  &:hover,
  &:focus-visible {
    transform: translateY(-6px);
    border-color: var(--c);
    box-shadow: 0 30px 70px -30px color-mix(in srgb, var(--c) 70%, black), 0 0 0 1px var(--c);
    outline: none;
  }
  &:hover::before,
  &:focus-visible::before {
    transform: scale(1.1);
    filter: saturate(1.15) brightness(1);
  }
  &:hover .sweep,
  &:focus-visible .sweep {
    animation: ${shine} 0.9s ease;
  }
  &:hover .bar,
  &:focus-visible .bar {
    width: 96px;
  }
  &:hover .go b,
  &:focus-visible .go b {
    transform: translateX(4px);
  }

  @media (prefers-reduced-motion: reduce) {
    &,
    &::before,
    .bar,
    .go b {
      transition: none;
    }
    &:hover .sweep {
      animation: none;
    }
  }
  @media (max-width: 820px) {
    --shot: 210px;
    min-height: 0;
    padding-top: 150px;
    h2 {
      font-size: 32px;
    }
  }
`;

/** A row of choices before the tracks: how many players, which music. */
const Options = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 18px 28px;
  align-items: flex-start;
  margin: -6px 0 18px;
  .label {
    display: block;
    margin-bottom: 7px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: rgba(238, 242, 250, 0.55);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  button {
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.05);
    color: #eef2fa;
    border-radius: 10px;
    padding: 8px 12px;
    font: 700 13px var(--font-nav);
    cursor: pointer;
    text-align: left;
  }
  button small {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: rgba(238, 242, 250, 0.55);
  }
  button.on {
    border-color: #ff3b6b;
    background: color-mix(in srgb, #ff3b6b 22%, transparent);
  }
  .keys {
    margin-top: 8px;
    font-size: 12px;
    color: rgba(238, 242, 250, 0.6);
    line-height: 1.6;
  }
  .keys b {
    color: #fff;
  }
`;

const Grid = styled.div<{ $min: number }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${({ $min }) => $min}px, 1fr));
  gap: 14px;
`;

const Small = styled(Tile)`
  min-height: 0;
  padding: 16px 16px 14px 20px;
  h2 {
    margin: 8px 0 4px;
    font-size: 17px;
  }
  p {
    font-size: 12.5px;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 10px;
    font-size: 11.5px;
    font-weight: 700;
    color: rgba(238, 242, 250, 0.55);
  }
  .done {
    color: #5ee08a;
  }
  canvas {
    display: block;
    width: 100%;
    height: 110px;
    margin-bottom: 4px;
  }
`;

const Loading = styled.div`
  margin-top: 26px;
  text-align: center;
  font-weight: 700;
  font-size: 14px;
  color: rgba(238, 242, 250, 0.8);
  .bar {
    height: 4px;
    margin: 12px auto 0;
    max-width: 360px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #ff8a1f, #ff3b6b);
    transition: width 0.2s ease;
  }
`;

const Resume = styled.button`
  border: none;
  border-radius: 999px;
  padding: 11px 22px;
  font: 800 14px var(--font-nav);
  color: #10131a;
  background: #fff;
  cursor: pointer;
  white-space: nowrap;
`;

/** A track's shape, drawn small (north up, like the minimap). */
function TrackShape({ id, color }: { id: TrackId; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useMemo(() => buildTrack(TRACKS[id].layout), [id]);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (c.width = Math.round(c.clientWidth * dpr));
    const h = (c.height = Math.round(c.clientHeight * dpr));
    const g = c.getContext("2d")!;
    const B = t.bounds;
    const k = Math.min((w - 16 * dpr) / (B.x1 - B.x0), (h - 16 * dpr) / (B.z1 - B.z0));
    const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    g.lineJoin = g.lineCap = "round";
    const path = () => {
      g.beginPath();
      t.samples.forEach((q, i) => (i ? g.lineTo(w / 2 - (q.x - cx) * k, h / 2 - (q.z - cz) * k) : g.moveTo(w / 2 - (q.x - cx) * k, h / 2 - (q.z - cz) * k)));
      g.closePath();
    };
    g.strokeStyle = "rgba(255,255,255,0.14)";
    g.lineWidth = 9 * dpr;
    path();
    g.stroke();
    g.strokeStyle = color;
    g.lineWidth = 3 * dpr;
    path();
    g.stroke();
  }, [t, color]);
  return <canvas ref={ref} />;
}

const trackLength = (id: TrackId) => buildTrack(TRACKS[id].layout).length;

export type MenuScreen = "home" | "race" | "missions";

/**
 * The menu over the game: how to play (race, free drive, missions), then the track or the mission.
 * Also the pause menu (Esc). While a choice loads, its progress.
 */
export default function GameMenu(props: {
  session: Session;
  /** the world being built for `pending` (null: nothing to wait for) */
  pending: Session | null;
  progress: number;
  /** a game is going on behind the menu (it can be resumed) */
  canResume: boolean;
  onPick: (mode: Mode, track: TrackId, mission: string | null, players?: 1 | 2) => void;
  onResume: () => void;
  screen: MenuScreen;
  onScreen: (s: MenuScreen) => void;
}) {
  const { pending, progress, canResume, onPick, onResume, screen, onScreen } = props;
  // a race: one player or two (split screen), and the music (remembered)
  const [players, setPlayers] = useState<1 | 2>(1);
  const [music, setMusicState] = useState<MusicId>(() => getMusic());
  const saved = useProgress();
  const lengths = useMemo(() => Object.fromEntries(TRACK_IDS.map((id) => [id, trackLength(id)])) as Record<TrackId, number>, []);
  const done = MISSIONS.filter((m) => saved.missions[m.id]).length;

  const loading = pending && (
    <Loading>
      Loading {pending.mode === "mission" ? MISSIONS.find((m) => m.id === pending.mission)?.title : pending.mode === "race" ? TRACKS[pending.track].name : "the Grand Circuit"}… {Math.round(progress)}%
      <div className="bar">
        <i style={{ width: `${Math.max(4, progress)}%` }} />
      </div>
    </Loading>
  );

  return (
    <Backdrop data-menu="">
      <Panel key={screen}>
        {screen === "home" && (
          <>
            <Head>
              <div>
                <h1>{canResume ? "Paused" : "Pick how to play"}</h1>
              </div>
              {canResume && <Resume onClick={onResume}>Resume ▸</Resume>}
            </Head>
            <Modes>
              <ModeCard $c="#ff3b6b" $img="/img/menu/race.webp" $pos="62% 50%" onClick={() => onScreen("race")}>
                <span className="sweep" />
                <span className="num">01</span>
                <span className="badge">4 tracks · 3 laps</span>
                <div className="body">
                  <h2>Race</h2>
                  <div className="bar" />
                  <p>Three laps against three rivals — four tracks to choose from. Just racing: no billboards.</p>
                  <div className="go">
                    <span>Pick a track</span>
                    <b>▶</b>
                  </div>
                </div>
              </ModeCard>
              <ModeCard $c="#39a0ff" $img="/img/menu/free.webp" $pos="64% 50%" onClick={() => onPick("free", "circuit", null)}>
                <span className="sweep" />
                <span className="num">02</span>
                <span className="badge">The portfolio</span>
                <div className="body">
                  <h2>Free drive</h2>
                  <div className="bar" />
                  <p>Drive the Grand Circuit at your own pace. My experience, projects and skills stand on its billboards — their cards come up as you reach them.</p>
                  <div className="go">
                    <span>Start driving</span>
                    <b>▶</b>
                  </div>
                </div>
              </ModeCard>
              <ModeCard $c="#ffb21f" $img="/img/menu/missions.webp" $pos="50% 50%" onClick={() => onScreen("missions")}>
                <span className="sweep" />
                <span className="num">03</span>
                <span className="badge">{done} of 12 done</span>
                <div className="body">
                  <h2>Missions</h2>
                  <div className="bar" />
                  <p>Twelve challenges on the different maps: gates, coins, slalom, drifting, parking, deliveries…</p>
                  <div className="go">
                    <span>Pick a mission</span>
                    <b>▶</b>
                  </div>
                </div>
              </ModeCard>
            </Modes>
          </>
        )}

        {screen === "race" && (
          <>
            <Head>
              <div>
                <h1>Race · pick a track</h1>
                <p>3 laps, you start at the back of the grid. Hold Shift for the nitro.</p>
              </div>
              <Back onClick={() => onScreen("home")}>← Back</Back>
            </Head>
            <Options>
              <div>
                <span className="label">Players</span>
                <div className="chips">
                  <button className={players === 1 ? "on" : ""} onClick={() => setPlayers(1)}>
                    1 player
                  </button>
                  <button className={players === 2 ? "on" : ""} onClick={() => setPlayers(2)}>
                    2 players<small>split screen</small>
                  </button>
                </div>
                {players === 2 && (
                  <div className="keys">
                    <b>Top · Player 1:</b> W A S D · Left Shift nitro · Space handbrake · R back on track
                    <br />
                    <b>Bottom · Player 2:</b> Arrows · Right Shift nitro · Enter handbrake · Backspace back on track
                  </div>
                )}
              </div>
              <div>
                <span className="label">Music</span>
                <div className="chips">
                  {MUSIC.map((m) => (
                    <button
                      key={m.id}
                      className={music === m.id ? "on" : ""}
                      onClick={() => {
                        setMusic(m.id);
                        setMusicState(m.id);
                      }}
                    >
                      {m.name}
                      <small>{m.style}</small>
                    </button>
                  ))}
                </div>
              </div>
            </Options>
            <Grid $min={220}>
              {TRACK_IDS.map((id) => {
                const r = saved.races[id];
                return (
                  <Small key={id} $c="#ff3b6b" onClick={() => onPick("race", id, null, players)}>
                    <TrackShape id={id} color="#ff3b6b" />
                    <h2>{TRACKS[id].name}</h2>
                    <p>{TRACKS[id].blurb}</p>
                    <div className="meta">
                      <span>{(lengths[id] / 1000).toFixed(2)} km</span>
                      <span className={r?.wins ? "done" : ""}>{r?.best ? `best ${formatLap(r.best)}${r.wins ? ` · ${r.wins}🏆` : ""}` : "not raced yet"}</span>
                    </div>
                  </Small>
                );
              })}
            </Grid>
          </>
        )}

        {screen === "missions" && (
          <>
            <Head>
              <div>
                <h1>Missions · {done} of 12 done</h1>
                <p>Each on its own map, against the clock.</p>
              </div>
              <Back onClick={() => onScreen("home")}>← Back</Back>
            </Head>
            <Grid $min={210}>
              {MISSIONS.map((m, i) => {
                const best = saved.missions[m.id]?.best;
                return (
                  <Small key={m.id} $c="#ffb21f" onClick={() => onPick("mission", m.track, m.id)}>
                    <div className="icon" style={{ fontSize: 26 }}>
                      {m.icon}
                    </div>
                    <h2>
                      {i + 1}. {m.title}
                    </h2>
                    <p>{m.brief}</p>
                    <div className="meta">
                      <span>{TRACKS[m.track].name}</span>
                      <span className={best !== undefined ? "done" : ""}>{best !== undefined ? `✓ ${formatLap(best)}` : `${Math.floor(m.time / 60)}:${String(m.time % 60).padStart(2, "0")} limit`}</span>
                    </div>
                  </Small>
                );
              })}
            </Grid>
          </>
        )}

        {loading}
      </Panel>
    </Backdrop>
  );
}
