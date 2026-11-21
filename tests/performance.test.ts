import { describe, expect, it } from "vitest";
import { MeshBuilder, NullEngine, Scene, SubMesh, VertexBuffer } from "@babylonjs/core";
import { clusterLOD } from "../src/components/world/lod";
import { QUALITY, qualityFor } from "../src/components/world/performanceTier";

describe("how much the device can take", () => {
  const q = (gpu: string, cores = 8, memory = 8, phone = false) => qualityFor(gpu, cores, memory, phone);

  it("puts basic integrated graphics and software rendering on the light settings", () => {
    expect(q("ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("low");
    expect(q("ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("low");
    expect(q("ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("low");
    expect(q("ANGLE (NVIDIA, NVIDIA GeForce MX150 Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("low");
    expect(q("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)), SwiftShader driver)")).toBe("low");
    expect(q("ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("low");
  });

  it("gives capable integrated graphics the middle, and discrete cards and Apple silicon the full settings", () => {
    expect(q("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("medium");
    expect(q("ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("medium");
    expect(q("")).toBe("medium"); // the browser won't say
    expect(q("ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 (0x00001F91) Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("high");
    expect(q("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("high");
    expect(q("ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("high");
    expect(q("ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)")).toBe("high");
    expect(q("Apple GPU")).toBe("high");
  });

  it("goes lighter on few cores, little memory or a phone", () => {
    expect(q("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)", 4)).toBe("low");
    expect(q("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)", 8, 4)).toBe("low");
    expect(q("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)", 4)).toBe("medium");
    expect(q("Apple GPU", 8, 8, true)).toBe("low");
  });

  it("never drops anything at the lighter settings: only resolution, shadow detail and tree levels differ", () => {
    for (const level of ["low", "medium", "high"] as const) {
      const s = QUALITY[level];
      expect(s.shadow.cascades).toBeGreaterThanOrEqual(2); // shadows everywhere
      expect(s.minResolution).toBeGreaterThan(0.6);
      expect(s.treeLod[0]).toBeLessThan(s.treeLod[1]);
    }
    expect(QUALITY.low.maxDpr).toBeLessThanOrEqual(QUALITY.medium.maxDpr);
    expect(QUALITY.medium.maxDpr).toBeLessThanOrEqual(QUALITY.high.maxDpr);
  });
});

describe("levels of detail", () => {
  it("clusters a dense mesh down a lot, part by part, keeping its size and its attributes", () => {
    const scene = new Scene(new NullEngine());
    const m = MeshBuilder.CreateSphere("s", { diameter: 2, segments: 64 }, scene);
    // two parts with their own material slot, like a tree's bark and leaves
    const half = Math.floor(m.getTotalIndices() / 6) * 3;
    m.subMeshes = [];
    new SubMesh(0, 0, m.getTotalVertices(), 0, half, m);
    new SubMesh(1, 0, m.getTotalVertices(), half, m.getTotalIndices() - half, m);
    const before = m.getTotalIndices() / 3;
    const lod = clusterLOD(m, 0.2, "s_LOD1")!;
    const after = lod.getTotalIndices() / 3;
    expect(after).toBeLessThan(before / 8);
    expect(after).toBeGreaterThan(50);
    expect(lod.subMeshes.map((s) => s.materialIndex)).toEqual([0, 1]);
    for (const k of [VertexBuffer.NormalKind, VertexBuffer.UVKind]) expect(lod.isVerticesDataPresent(k)).toBe(true);
    const a = m.getBoundingInfo().boundingBox, b = lod.getBoundingInfo().boundingBox;
    expect(b.extendSize.x).toBeGreaterThan(a.extendSize.x * 0.85);
    expect(b.extendSize.y).toBeGreaterThan(a.extendSize.y * 0.85);
    scene.dispose();
  });
});
