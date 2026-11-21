"use client";

import dynamic from "next/dynamic";
import styled from "styled-components";
import type { WorldProps } from "./World";

const World = dynamic(() => import("./World"), { ssr: false, loading: () => null });

const CanvasWrap = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;

  canvas {
    outline: none;
    /* (drag to look round the car) */
    cursor: grab;
  }
`;

export default function WorldCanvas(props: WorldProps) {
  return (
    <CanvasWrap>
      <World {...props} />
    </CanvasWrap>
  );
}
