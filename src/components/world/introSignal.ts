export interface IntroSignal {
  value: number;
}

export function createIntroSignal(): IntroSignal {
  return { value: 0 };
}
