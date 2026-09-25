"use client";

import { useRef, useState } from "react";
import { WorldInputProvider } from "./WorldInputContext";
import WorldCanvas from "./WorldCanvas";
import Hud from "./Hud";
import Compass from "./Compass";
import AccentPicker from "./AccentPicker";
import MobileControls from "./MobileControls";
import Welcome from "./Welcome";
import TeleportFade from "./TeleportFade";
import AchievementToast from "./AchievementToast";
import { createTeleportSignal } from "./teleportSignal";
import { createNearPortalSignal } from "./nearPortalSignal";
import { createAchievementSignal } from "./achievementSignal";
import { createIntroSignal } from "./introSignal";
import { createPlayerAccent } from "./playerAccentSignal";
import { warmAudio } from "./footstepSynth";
import { createFlightSignal } from "./flightSignal";
import { createPsSignal } from "./psSignal";
import { createDoorSignal } from "./doorSignal";
import DoorHint from "./DoorHint";
import { createExhibitSignal } from "./exhibitSignal";
import ExhibitCard from "./ExhibitCard";
import { createWorkSignal } from "./workSignal";
import CssExercises from "./CssExercises";
import PlayStationGame from "./PlayStationGame";

const ACCENT = "#7c9bff";

export default function Experience() {
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const teleportRef = useRef(createTeleportSignal());
  const nearPortalRef = useRef(createNearPortalSignal());
  const achievementRef = useRef(createAchievementSignal());
  const introRef = useRef(createIntroSignal());
  const accentRef = useRef(createPlayerAccent());
  const flightRef = useRef(createFlightSignal());
  const psRef = useRef(createPsSignal());
  const doorRef = useRef(createDoorSignal());
  const exhibitRef = useRef(createExhibitSignal());
  const workRef = useRef(createWorkSignal());

  function handleStart() {
    warmAudio();
    setWelcomeOpen(false);
    introRef.current.value++;
  }

  return (
    <WorldInputProvider>
      <Hud />
      <Compass />
      <AccentPicker accentRef={accentRef} />

      <WorldCanvas
        accent={ACCENT}
        teleportRef={teleportRef}
        nearPortalRef={nearPortalRef}
        achievementRef={achievementRef}
        introRef={introRef}
        accentRef={accentRef}
        flightRef={flightRef}
        psRef={psRef}
        doorRef={doorRef}
        exhibitRef={exhibitRef}
        workRef={workRef}
      />

      <MobileControls />

      <TeleportFade signalRef={teleportRef} />
      <AchievementToast signalRef={achievementRef} />
      <PlayStationGame signalRef={psRef} />
      <DoorHint signalRef={doorRef} />
      <ExhibitCard signalRef={exhibitRef} />
      <CssExercises signalRef={workRef} />

      {welcomeOpen && <Welcome onStart={handleStart} />}
    </WorldInputProvider>
  );
}
