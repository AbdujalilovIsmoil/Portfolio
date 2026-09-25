export interface FlightSignal {
  active: boolean;
}

export function createFlightSignal(): FlightSignal {
  return { active: false };
}
