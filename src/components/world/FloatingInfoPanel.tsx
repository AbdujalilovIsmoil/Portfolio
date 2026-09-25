"use client";

import type { TransformNode } from "@babylonjs/core";
import HtmlAnchor from "./HtmlAnchor";
import type { Ctx } from "./core";

export default function FloatingInfoPanel({
  ctx,
  node,
  eyebrow,
  title,
  lines,
  accent = "#7c9bff",
  factor = 9,
}: {
  ctx: Ctx;
  node: TransformNode;
  eyebrow: string;
  title: string;
  lines: string[];
  accent?: string;
  factor?: number;
}) {
  return (
    <>
      <HtmlAnchor ctx={ctx} node={node} distanceFactor={factor} zIndexRange={[15, 0]} faceCull>
        <div
          style={{
            width: 220,
            padding: "16px 18px",
            borderRadius: 16,
            background: "rgba(12, 16, 24, 0.62)",
            border: `1px solid ${accent}`,
            boxShadow: `0 0 24px ${accent}55`,
            backdropFilter: "blur(6px)",
            fontFamily: "var(--font-nav)",
            color: "#fff",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: accent,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{title}</div>
          {lines.map((line, i) => (
            <div key={i} style={{ fontSize: 11.5, lineHeight: 1.6, color: "#c9d2e0", marginBottom: 2 }}>
              {line}
            </div>
          ))}
        </div>
      </HtmlAnchor>
    </>
  );
}
