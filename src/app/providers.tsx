"use client";

import React from "react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { appTheme } from "@/styles/theme";
import GlobalStyle from "@/styles/GlobalStyle";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StyledThemeProvider theme={appTheme}>
      <GlobalStyle />
      {children}
    </StyledThemeProvider>
  );
}
