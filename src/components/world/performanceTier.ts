/**
 * How much the device can take: "high" — Apple silicon and discrete graphics cards; "low" — phones,
 * basic integrated graphics (Intel HD / UHD, AMD Vega-class), software rendering, 4 cores or fewer;
 * "medium" — the rest (Iris Xe, recent Radeon iGPUs, or a GPU the browser won't name).
 *
 * Every level shows the same world — every model, the shadows, the effects. Only what can't be told
 * apart while driving changes: the render resolution, the shadow maps' detail, and how near the
 * trees switch to their coarser levels. `?quality=low|medium|high` in the URL overrides it.
 */
export type Quality = "low" | "medium" | "high";

/** The GPU's name as the browser reports it ("" when it won't say). */
export function gpuName(): string {
  if (typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  } catch {
    return "";
  }
}

/** The quality for a GPU name, core count, memory (GB) and whether it is a phone (pure: tested). */
export function qualityFor(gpu: string, cores: number, memory: number, phone: boolean): Quality {
  const g = gpu.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(g)) return "low";
  if (phone) return "low";
  // Apple silicon, discrete NVIDIA / AMD / Intel Arc cards
  const discrete =
    /apple (m\d|gpu)/.test(g) ||
    /rtx|quadro|titan|gtx\s?(9[6-9]\d|1[0-9][5-9]\d|16\d\d)|radeon\s?(rx|pro)|arc\(tm\) a\d|arc a\d/.test(g);
  // basic integrated graphics
  const basic =
    /intel.*(hd|uhd) graphics/.test(g) ||
    /intel\(r\) (hd|uhd)/.test(g) ||
    /radeon\(tm\) (r[2-7]|vega)|radeon vega|radeon r[2-7] /.test(g) ||
    /mali|adreno|powervr|videocore/.test(g) ||
    /geforce (mx1|mx2|gt\s?[1-9]\d{2}\b|gt 1030|9[0-4]\dm)/.test(g);
  if (discrete) return cores > 4 ? "high" : "medium";
  if (basic || cores <= 4 || memory <= 4) return "low";
  return "medium";
}

let cached: Quality | null = null;

export function detectQuality(): Quality {
  if (cached) return cached;
  if (typeof window === "undefined") return "medium";
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "low" || forced === "medium" || forced === "high") return (cached = forced);
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const phone = !!window.matchMedia?.("(pointer: coarse)").matches && window.innerWidth < 860;
  return (cached = qualityFor(gpuName(), cores, memory, phone));
}

/** What each level changes (all of it hard to see; none of it removes anything). */
export const QUALITY = {
  high: { maxDpr: 1.5, minResolution: 0.74, shadow: { cascades: 3, size: 2048, maxZ: 300, pcf: "medium", blend: 0.12 }, treeLod: [70, 150] },
  medium: { maxDpr: 1.25, minResolution: 0.7, shadow: { cascades: 2, size: 2048, maxZ: 240, pcf: "low", blend: 0.1 }, treeLod: [55, 120] },
  low: { maxDpr: 1, minResolution: 0.62, shadow: { cascades: 2, size: 1024, maxZ: 180, pcf: "low", blend: 0 }, treeLod: [40, 90] },
} as const satisfies Record<Quality, { maxDpr: number; minResolution: number; shadow: { cascades: number; size: number; maxZ: number; pcf: "low" | "medium"; blend: number }; treeLod: readonly [number, number] }>;
