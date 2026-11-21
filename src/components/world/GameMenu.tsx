"use client";

import { useEffect, useMemo, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { formatLap } from "./driveSignal";
import { MISSIONS, TRACKS, TRACK_IDS, type Mode, type Session, type TrackId } from "./game";
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

const Foot = styled.div`
  margin-top: 18px;
  font-size: 12px;
  color: rgba(238, 242, 250, 0.5);
  text-align: center;
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
  onPick: (mode: Mode, track: TrackId, mission: string | null) => void;
  onResume: () => void;
  screen: MenuScreen;
  onScreen: (s: MenuScreen) => void;
}) {
  const { pending, progress, canResume, onPick, onResume, screen, onScreen } = props;
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
                <p>Ismoil Abdujalilov · Frontend (React) Engineer — a portfolio you drive</p>
              </div>
              {canResume && <Resume onClick={onResume}>Resume ▸</Resume>}
            </Head>
            <Modes>
              <Tile $c="#ff3b6b" onClick={() => onScreen("race")}>
                <div className="icon">🏁</div>
                <h2>Race</h2>
                <p>Three laps against three rivals — four tracks to choose from. Just racing: no billboards.</p>
                <span className="tag">4 tracks · 3 laps</span>
              </Tile>
              <Tile $c="#39a0ff" $primary onClick={() => onPick("free", "circuit", null)}>
                <div className="icon">🚗</div>
                <h2>Free drive</h2>
                <p>Drive the Grand Circuit at your own pace. My experience, projects and skills stand on its billboards — their cards come up as you reach them.</p>
                <span className="tag">The portfolio</span>
              </Tile>
              <Tile $c="#ffb21f" onClick={() => onScreen("missions")}>
                <div className="icon">🎯</div>
                <h2>Missions</h2>
                <p>Twelve challenges on the different maps: gates, coins, slalom, drifting, parking, deliveries…</p>
                <span className="tag">{done} of 12 done</span>
              </Tile>
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
            <Grid $min={220}>
              {TRACK_IDS.map((id) => {
                const r = saved.races[id];
                return (
                  <Small key={id} $c="#ff3b6b" onClick={() => onPick("race", id, null)}>
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
        <Foot>W A S D / arrows — drive · Shift (hold) — nitro · Space — handbrake · R — back on the track · Esc — menu</Foot>
      </Panel>
    </Backdrop>
  );
}
