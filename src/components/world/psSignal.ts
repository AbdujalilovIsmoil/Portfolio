export interface PsSignal {
  near: boolean;
  playing: boolean;
}
export const createPsSignal = (): PsSignal => ({ near: false, playing: false });
