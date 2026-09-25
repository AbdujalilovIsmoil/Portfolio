"use client";

import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
  :root {
    --font-heading: var(--font-raleway), sans-serif;
    --font-body: var(--font-roboto), sans-serif;
    --font-nav: var(--font-poppins), sans-serif;

    --bg: #05070d;
    --bg-alt: #0a0e18;
    --bg-elevated: #0f1420;
    --surface: rgba(17, 22, 34, 0.5);
    --text: #e7ecf5;
    --text-muted: #9aa5b8;
    --heading: #f7f9fc;
    --accent: #7c9bff;
    --accent-soft: rgba(124, 155, 255, 0.14);
    --accent-2: #ff9d7a;
    --border: rgba(255, 255, 255, 0.08);
    --shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.7);
    --header-bg: rgba(5, 7, 13, 0.7);
    --canvas-fog: #05070d;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
  }

  body {
    font-family: var(--font-body);
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    transition: background-color 0.4s ease, color 0.4s ease;
    position: fixed;
    inset: 0;
    touch-action: none;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-heading);
    color: ${({ theme }) => theme.heading};
    font-weight: 700;
  }

  a {
    text-decoration: none;
    color: inherit;
  }

  ul {
    list-style: none;
  }

  img {
    max-width: 100%;
    display: block;
  }

  ::selection {
    background: ${({ theme }) => theme.accent};
    color: #fff;
  }

  ::-webkit-scrollbar {
    width: 10px;
  }
  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.bgAlt};
  }
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.accent};
    border-radius: 10px;
  }

  .container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }

  button {
    font-family: inherit;
  }
`;

export default GlobalStyle;
