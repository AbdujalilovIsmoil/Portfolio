export interface DoorSignal {
  near: boolean;
  open: boolean;
  label?: string;
}
export const createDoorSignal = (): DoorSignal => ({ near: false, open: false });
