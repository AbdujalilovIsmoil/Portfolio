"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Vector3, type TransformNode } from "@babylonjs/core";
import type { Ctx } from "./core";

interface Opts {
  transform?: boolean;
  distanceFactor?: number;
  zIndexRange?: [number, number];
  center?: boolean;
  /** Hide when the anchor node's +Z face points away from the camera or the camera is very close. */
  faceCull?: boolean;
}

const prepare = (el: HTMLElement, css: string) => {
  el.style.cssText = css;
};
const eps = (v: number) => (Math.abs(v) < 1e-10 ? 0 : v);
const CAMERA_MULT = [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1];
const css = (m: ArrayLike<number>, mult: number[]) => `matrix3d(${mult.map((k, i) => eps(k * m[i])).join(",")})`;
const objMult = (f: number) => [1 / f, 1 / f, 1 / f, 1, -1 / f, -1 / f, -1 / f, -1, 1 / f, 1 / f, 1 / f, 1, 1, 1, 1, 1];

/**
 * DOM label pinned to a Babylon node — same projection maths as drei's <Html>,
 * both the flat (distanceFactor) and the CSS3D `transform` variants.
 */
export default function HtmlAnchor({
  ctx,
  node,
  children,
  transform = false,
  distanceFactor,
  zIndexRange = [16777271, 0],
  center = true,
  faceCull = false,
}: { ctx: Ctx; node: TransformNode; children: React.ReactNode } & Opts) {
  const [el] = useState(() => document.createElement("div"));

  useEffect(() => {
    const { scene, camera, overlay } = ctx;
    const root = document.createElement("div");
    root.style.cssText = "position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:none;";
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    if (transform) {
      outer.style.cssText = "position:absolute;top:0;left:0;transform-style:preserve-3d;pointer-events:none;";
      inner.style.cssText = "position:absolute;pointer-events:none;";
      prepare(el, "pointer-events:none;");
      inner.appendChild(el);
      outer.appendChild(inner);
      root.appendChild(outer);
    } else {
      prepare(el, `position:absolute;${center ? "transform:translate3d(-50%,-50%,0);" : ""}`);
      root.appendChild(el);
    }
    overlay.appendChild(root);

    const world = new Vector3();
    const proj = new Vector3();
    const view = new Vector3();
    let hidden = false;

    const update = () => {
      const w = overlay.clientWidth || 1;
      const h = overlay.clientHeight || 1;
      const viewM = camera.getViewMatrix();
      const projM = camera.getProjectionMatrix();
      node.computeWorldMatrix(true);
      world.copyFrom(node.getAbsolutePosition());
      Vector3.TransformCoordinatesToRef(world, viewM, view);
      let behind = view.z > 0; // right-handed view space looks down -Z
      if (faceCull && !behind) {
        // Hide flat panels when seen from their back (or through a wall) instead of a dark slab.
        const m = node.getWorldMatrix().m;
        const cam = camera.position;
        const dot = m[8] * (cam.x - world.x) + m[9] * (cam.y - world.y) + m[10] * (cam.z - world.z);
        const d = Math.hypot(cam.x - world.x, cam.y - world.y, cam.z - world.z);
        // back side, too close, or edge-on → would smear into a huge dark slab
        if (dot < 0 || d < 2.4 || dot / Math.max(d, 1e-4) < 0.22) behind = true;
      }
      if (behind !== hidden) {
        hidden = behind;
        root.style.display = behind ? "none" : "block";
      }
      if (behind) return;

      const dist = view.length();
      const range = zIndexRange;
      const A = (range[1] - range[0]) / (camera.maxZ - camera.minZ);
      const B = range[1] - A * camera.maxZ;
      root.style.zIndex = String(Math.round(A * dist + B));

      if (transform) {
        const fov = projM.m[5] * (h / 2);
        root.style.width = w + "px";
        root.style.height = h + "px";
        root.style.perspective = `${fov}px`;
        outer.style.width = w + "px";
        outer.style.height = h + "px";
        outer.style.transform = `translateZ(${fov}px)${css(viewM.m, CAMERA_MULT)}translate(${w / 2}px,${h / 2}px)`;
        inner.style.transform = `translate(-50%,-50%)${css(node.getWorldMatrix().m, objMult((distanceFactor || 10) / 400))}`;
      } else {
        Vector3.TransformCoordinatesToRef(world, scene.getTransformMatrix(), proj);
        // TransformCoordinates already divides by w → NDC; convert to CSS pixels.
        const x = (proj.x * w) / 2 + w / 2;
        const y = (-proj.y * h) / 2 + h / 2;
        let scale = 1;
        if (distanceFactor !== undefined) {
          scale = (1 / (2 * Math.tan(camera.fov / 2) * dist)) * distanceFactor;
        }
        root.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
      }
    };

    scene.onAfterRenderObservable.add(update);
    return () => {
      scene.onAfterRenderObservable.removeCallback(update);
      root.remove();
    };
  }, [ctx, node, el, transform, distanceFactor, zIndexRange[0], zIndexRange[1], center, faceCull]); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(children, el);
}
