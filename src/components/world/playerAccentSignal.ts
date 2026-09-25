export interface PlayerAccent {
  color: string;
}

export const ACCENT_CHOICES = ["#7c9bff", "#7fe3ff", "#ff9d7a", "#c17cff", "#7fff9e", "#ff7a9d"];

export function createPlayerAccent(): PlayerAccent {
  return { color: ACCENT_CHOICES[0] };
}
