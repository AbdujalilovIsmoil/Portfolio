export interface NearPortalSignal {
  near: boolean;
}

export function createNearPortalSignal(): NearPortalSignal {
  return { near: false };
}
