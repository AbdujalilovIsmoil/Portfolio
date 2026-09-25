import { describe, expect, it } from "vitest";
import { Quaternion, Vector3, TransformNode } from "@babylonjs/core";
import { clamp, hash, inRegions, lerp, nearestInRegions, setEuler, type Region } from "../src/components/world/core";

const R: Region[] = [
  { x0: 0, x1: 10, z0: 0, z1: 10 },
  { x0: 20, x1: 30, z0: 0, z1: 10 },
];

describe("math helpers", () => {
  it("hash is deterministic and in [0,1)", () => {
    for (let i = 0; i < 200; i++) {
      const h = hash(i, 7);
      expect(h).toBe(hash(i, 7));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
  it("clamp and lerp", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });
});

describe("setEuler (three.js XYZ order)", () => {
  const node = () => ({ rotationQuaternion: null }) as unknown as TransformNode;
  it("single-axis rotation matches the axis-angle quaternion", () => {
    const n = node();
    setEuler(n, 0, Math.PI / 2, 0);
    const q = Quaternion.RotationAxis(Vector3.Up(), Math.PI / 2);
    expect(n.rotationQuaternion!.x).toBeCloseTo(q.x);
    expect(n.rotationQuaternion!.y).toBeCloseTo(q.y);
    expect(n.rotationQuaternion!.w).toBeCloseTo(q.w);
  });
  it("produces a unit quaternion for combined angles", () => {
    const n = node();
    setEuler(n, 0.3, 1.1, -0.7);
    const q = n.rotationQuaternion!;
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1);
  });
});

describe("walkable regions", () => {
  it("respects the margin", () => {
    expect(inRegions(R, 5, 5, 0.4)).toBe(true);
    expect(inRegions(R, 0.2, 5, 0.4)).toBe(false);
    expect(inRegions(R, 15, 5, 0.4)).toBe(false);
    expect(inRegions(R, 25, 5, 0.4)).toBe(true);
  });
  it("nearestInRegions snaps to the closest region", () => {
    expect(nearestInRegions(R, 14, 5, 0.5)).toEqual([9.5, 5]);
    expect(nearestInRegions(R, 17, 5, 0.5)).toEqual([20.5, 5]);
    expect(nearestInRegions(R, 5, 5, 0.5)).toEqual([5, 5]);
  });
});
