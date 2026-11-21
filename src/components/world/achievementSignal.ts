export interface AchievementSignal {
  /** bump to show the toast */
  value: number;
  title: string;
  /** small line above the title (default "Achievement unlocked") */
  label?: string;
  icon?: string;
}

export function createAchievementSignal(): AchievementSignal {
  return { value: 0, title: "" };
}
