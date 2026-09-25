export interface TeleportSignal {
  value: number;
}

export function createTeleportSignal(): TeleportSignal {
  return { value: 0 };
}
