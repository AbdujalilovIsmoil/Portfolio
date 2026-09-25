"use client";

import { useState } from "react";
import styled from "styled-components";
import { ACCENT_CHOICES, type PlayerAccent } from "./playerAccentSignal";

const Wrap = styled.div`
  position: fixed;
  top: 16px;
  right: 20px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
`;

const ToggleButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.headerBg};
  backdrop-filter: blur(10px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
`;

const Panel = styled.div<{ $open: boolean }>`
  display: ${({ $open }) => ($open ? "flex" : "none")};
  gap: 8px;
  padding: 10px;
  border-radius: 14px;
  background: ${({ theme }) => theme.headerBg};
  border: 1px solid ${({ theme }) => theme.border};
  backdrop-filter: blur(10px);
`;

const Swatch = styled.button<{ $color: string; $active: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  border: 2px solid ${({ $active }) => ($active ? "#fff" : "transparent")};
  cursor: pointer;
  box-shadow: 0 0 10px ${({ $color }) => $color}88;
`;

export default function AccentPicker({ accentRef }: { accentRef: React.MutableRefObject<PlayerAccent> }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(ACCENT_CHOICES[0]);

  return (
    <Wrap>
      <ToggleButton type="button" onClick={() => setOpen((v) => !v)} aria-label="Rangni tanlash">
        🎨
      </ToggleButton>
      <Panel $open={open}>
        {ACCENT_CHOICES.map((c) => (
          <Swatch
            key={c}
            type="button"
            $color={c}
            $active={active === c}
            onClick={() => {
              accentRef.current.color = c;
              setActive(c);
            }}
            aria-label={c}
          />
        ))}
      </Panel>
    </Wrap>
  );
}
