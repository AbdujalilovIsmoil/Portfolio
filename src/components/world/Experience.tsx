"use client";

import { useRef, useState } from "react";
import { WorldInputProvider } from "./WorldInputContext";
import WorldCanvas from "./WorldCanvas";
import Hud from "./Hud";
import Minimap from "./Minimap";
import MobileControls from "./MobileControls";
import Welcome from "./Welcome";
import TeleportFade from "./TeleportFade";
import AchievementToast from "./AchievementToast";
import ExhibitCard from "./ExhibitCard";
import CssExercises from "./CssExercises";
import PlayStationGame from "./PlayStationGame";
import { createTeleportSignal } from "./teleportSignal";
import { createAchievementSignal } from "./achievementSignal";
import { createIntroSignal } from "./introSignal";
import { createPsSignal } from "./psSignal";
import { createExhibitSignal } from "./exhibitSignal";
import { createWorkSignal } from "./workSignal";
import { createDriveSignal } from "./driveSignal";
import { warmAudio } from "./sound";

export default function Experience() {
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const teleportRef = useRef(createTeleportSignal());
  const achievementRef = useRef(createAchievementSignal());
  const introRef = useRef(createIntroSignal());
  const psRef = useRef(createPsSignal());
  const exhibitRef = useRef(createExhibitSignal());
  const workRef = useRef(createWorkSignal());
  const driveRef = useRef(createDriveSignal());

  function handleStart() {
    warmAudio();
    setWelcomeOpen(false);
    introRef.current.value++;
  }

  return (
    <WorldInputProvider>
      <Hud />

      <WorldCanvas
        teleportRef={teleportRef}
        achievementRef={achievementRef}
        introRef={introRef}
        psRef={psRef}
        exhibitRef={exhibitRef}
        workRef={workRef}
        driveRef={driveRef}
      />

      <Minimap driveRef={driveRef} />
      <MobileControls />

      <TeleportFade signalRef={teleportRef} />
      <AchievementToast signalRef={achievementRef} />
      <PlayStationGame signalRef={psRef} />
      <ExhibitCard signalRef={exhibitRef} />
      <CssExercises signalRef={workRef} />

      {welcomeOpen && <Welcome onStart={handleStart} />}
    </WorldInputProvider>
  );
}
