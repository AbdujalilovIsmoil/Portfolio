"use client";

import styled from "styled-components";

const Hint = styled.div`
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  padding: 8px 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid ${({ theme }) => theme.border};
  color: ${({ theme }) => theme.textMuted};
  font-size: 0.8rem;
  font-family: var(--font-nav);
  display: none;
  pointer-events: none;

  @media (min-width: 861px) and (pointer: fine) {
    display: block;
  }
`;

export default function Hud() {
  return <Hint>W/S gas · A/D steer · Shift boost · Space handbrake · F cards on/off · R back on track</Hint>;
}
