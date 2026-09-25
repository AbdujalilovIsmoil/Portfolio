export interface WorkSignal {
  near: boolean;
  open: boolean;
}
export const createWorkSignal = (): WorkSignal => ({ near: false, open: false });
