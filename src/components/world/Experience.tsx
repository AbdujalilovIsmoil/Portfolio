"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { WorldInputProvider, useWorldInput } from "./WorldInputContext";
import WorldCanvas from "./WorldCanvas";
import Minimap from "./Minimap";
import MobileControls from "./MobileControls";
import GameMenu, { type MenuScreen } from "./GameMenu";
import PlayHud from "./PlayHud";
import TeleportFade from "./TeleportFade";
import AchievementToast from "./AchievementToast";
import ExhibitCard from "./ExhibitCard";
import { createTeleportSignal } from "./teleportSignal";
import { createAchievementSignal } from "./achievementSignal";
import { createIntroSignal } from "./introSignal";
import { createExhibitSignal } from "./exhibitSignal";
import { createDriveSignal } from "./driveSignal";
import { createPlaySignal } from "./raceSignal";
import { FREE_SESSION, MISSIONS, TRACKS, type Mode, type Session, type TrackId } from "./game";
import { getLoading, subscribeLoading, useLoading } from "./loadingSignal";
import { warmAudio } from "./sound";

/** The pause button, top right (Esc does the same). */
const MenuButton = styled.button`
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 55;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(165deg, #171c28, #0b0e15);
  box-shadow:
    0 10px 26px -12px rgba(0, 0, 0, 0.7),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  color: #fff;
  font: 900 15px var(--font-nav);
  letter-spacing: 1px;
  cursor: pointer;
  @media (max-width: 860px) {
    top: 10px;
    right: 10px;
    width: 40px;
    height: 40px;
  }
`;

export default function Experience() {
  return (
    <WorldInputProvider>
      <Game />
    </WorldInputProvider>
  );
}

const sameGame = (a: Session, mode: Mode, track: TrackId, mission: string | null) => a.mode === mode && a.track === track && a.mission === mission;

/**
 * The game: the menu (how to play, which track, which mission), the 3D world built for the choice,
 * and the HUD for it — the minimap, the cards (free drive), the race / mission bar and results.
 */
function Game() {
  const input = useWorldInput();
  const teleportRef = useRef(createTeleportSignal());
  const achievementRef = useRef(createAchievementSignal());
  const introRef = useRef(createIntroSignal());
  const exhibitRef = useRef(createExhibitSignal());
  const driveRef = useRef(createDriveSignal());
  const playRef = useRef(createPlaySignal());
  const pauseRef = useRef(true);

  // what the world is built for; what was picked and is waiting to start (with the load it waits for)
  const [session, setSession] = useState<Session>({ ...FREE_SESSION });
  const [pending, setPending] = useState<{ s: Session; gen: number } | null>(null);
  const [menu, setMenu] = useState<{ open: boolean; screen: MenuScreen }>({ open: true, screen: "home" });
  const [started, setStarted] = useState(false);
  const { progress, generation } = useLoading();

  // the menu holds the game: no keys, no looking round, clocks stopped (and so does the result screen)
  const [over, setOver] = useState(false);
  // (the input is a ref shared with the 3D world: written here, read there)
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    pauseRef.current = menu.open;
    /* eslint-disable react-hooks/immutability */
    input.current.locked = menu.open || over;
    if (menu.open) {
      const mv = input.current.move;
      mv.forward = mv.backward = mv.left = mv.right = mv.run = false;
      input.current.spaceHeld = false;
    }
    /* eslint-enable react-hooks/immutability */
  }, [menu.open, over, input]);

  const pick = useCallback(
    (mode: Mode, track: TrackId, mission: string | null) => {
      warmAudio();
      if (sameGame(session, mode, track, mission) && !started) {
        // (already built behind the menu: start as soon as it is loaded)
        setPending({ s: session, gen: -1 });
        return;
      }
      if (sameGame(session, mode, track, mission) && mode === "free") {
        setMenu((m) => ({ ...m, open: false }));
        return;
      }
      const next = { mode, track, mission, key: Date.now() };
      setSession(next);
      setStarted(false);
      setPending({ s: next, gen: generation });
    },
    [session, started, generation]
  );

  // a pick that has finished loading: off we go (the camera flies in; a race or mission counts down)
  useEffect(() => {
    if (!pending || pending.s.key !== session.key) return;
    const check = () => {
      const l = getLoading();
      if (l.active || l.progress < 100 || l.generation <= pending.gen) return;
      setPending(null);
      setStarted(true);
      setMenu({ open: false, screen: "home" });
      introRef.current.value++;
    };
    const off = subscribeLoading(check);
    const t = setTimeout(check, 0);
    return () => {
      off();
      clearTimeout(t);
    };
  }, [pending, session.key]);

  // Esc: the menu
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== "Escape" || !started) return;
      setMenu((m) => ({ open: !m.open, screen: "home" }));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [started]);

  const again = () => pick(session.mode, session.track, session.mission);
  const missionIndex = MISSIONS.findIndex((m) => m.id === session.mission);
  const nextMission = session.mode === "mission" && missionIndex >= 0 && missionIndex < MISSIONS.length - 1 ? MISSIONS[missionIndex + 1] : null;
  const label = session.mode === "free" ? "Free drive · the portfolio" : session.mode === "race" ? `Race · ${TRACKS[session.track].name}` : `Mission ${missionIndex + 1} · ${MISSIONS[missionIndex]?.title ?? ""}`;
  const color = session.mode === "free" ? "#39a0ff" : session.mode === "race" ? "#ff3b6b" : "#ffb21f";

  return (
    <>
      <WorldCanvas key={session.key} session={session} teleportRef={teleportRef} achievementRef={achievementRef} introRef={introRef} exhibitRef={exhibitRef} driveRef={driveRef} playRef={playRef} pauseRef={pauseRef} />
      {!menu.open && <Minimap driveRef={driveRef} label={label} color={color} />}
      <MobileControls action={session.mode === "free"} />
      {started && !menu.open && (
        <MenuButton aria-label="Menu" onClick={() => setMenu({ open: true, screen: "home" })}>
          II
        </MenuButton>
      )}
      <TeleportFade signalRef={teleportRef} />
      <AchievementToast signalRef={achievementRef} />
      <ExhibitCard signalRef={exhibitRef} />
      {!menu.open && (
        <PlayHud
          playRef={playRef}
          missionId={session.mission}
          trackName={TRACKS[session.track].name}
          onAgain={again}
          onNext={nextMission ? () => pick("mission", nextMission.track, nextMission.id) : null}
          onMenu={() => setMenu({ open: true, screen: "missions" })}
          onTracks={() => setMenu({ open: true, screen: "race" })}
          onOver={setOver}
        />
      )}
      {menu.open && (
        <GameMenu
          session={session}
          pending={pending?.s ?? null}
          progress={pending ? progress : 100}
          canResume={started && !pending}
          onPick={pick}
          onResume={() => setMenu((m) => ({ ...m, open: false }))}
          screen={menu.screen}
          onScreen={(screen) => setMenu({ open: true, screen })}
        />
      )}
    </>
  );
}
