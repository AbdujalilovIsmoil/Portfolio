"use client";

import dynamic from "next/dynamic";
import styled from "styled-components";
import type { TeleportSignal } from "./teleportSignal";
import type { NearPortalSignal } from "./nearPortalSignal";
import type { AchievementSignal } from "./achievementSignal";
import type { IntroSignal } from "./introSignal";
import type { PlayerAccent } from "./playerAccentSignal";
import type { FlightSignal } from "./flightSignal";
import type { PsSignal } from "./psSignal";
import type { DoorSignal } from "./doorSignal";
import type { ExhibitSignal } from "./exhibitSignal";
import type { WorkSignal } from "./workSignal";

const World = dynamic(() => import("./World"), { ssr: false, loading: () => null });

const CanvasWrap = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;

  canvas {
    outline: none;
  }
`;

export default function WorldCanvas(props: {
  accent: string;
  teleportRef: React.MutableRefObject<TeleportSignal>;
  nearPortalRef: React.MutableRefObject<NearPortalSignal>;
  achievementRef: React.MutableRefObject<AchievementSignal>;
  introRef: React.MutableRefObject<IntroSignal>;
  accentRef: React.MutableRefObject<PlayerAccent>;
  flightRef: React.MutableRefObject<FlightSignal>;
  psRef: React.MutableRefObject<PsSignal>;
  doorRef: React.MutableRefObject<DoorSignal>;
  exhibitRef: React.MutableRefObject<ExhibitSignal>;
  workRef: React.MutableRefObject<WorkSignal>;
}) {
  return (
    <CanvasWrap>
      <World {...props} />
    </CanvasWrap>
  );
}
