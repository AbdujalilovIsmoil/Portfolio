export function getIsLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const coarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const smallScreen = typeof window !== "undefined" && window.innerWidth < 860;
  return cores <= 4 || (coarsePointer && smallScreen);
}
