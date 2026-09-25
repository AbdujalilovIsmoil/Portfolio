export interface AchievementSignal {
  value: number;
  title: string;
}

export function createAchievementSignal(): AchievementSignal {
  return { value: 0, title: "" };
}
