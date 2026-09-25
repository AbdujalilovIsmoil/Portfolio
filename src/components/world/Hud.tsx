"use client";

import styled from "styled-components";

const Bar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  padding: 16px 20px;
  pointer-events: none;
`;

const Logo = styled.div`
  font-family: var(--font-heading);
  font-weight: 800;
  font-size: 1.25rem;
  color: ${({ theme }) => theme.accent};
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: ${({ theme }) => theme.headerBg};
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.border};
`;

const Hint = styled.div`
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  padding: 8px 18px;
  border-radius: 999px;
  background: ${({ theme }) => theme.headerBg};
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.border};
  color: ${({ theme }) => theme.textMuted};
  font-size: 0.8rem;
  font-family: var(--font-nav);
  display: none;

  @media (min-width: 861px) and (pointer: fine) {
    display: block;
  }
`;

export default function Hud() {
  return (
    <>
      <Bar>
        <Logo>◆</Logo>
      </Bar>
      <Hint>WASD — yurish • Shift — yugurish • Space — sakrash • sichqoncha — qarash</Hint>
    </>
  );
}
