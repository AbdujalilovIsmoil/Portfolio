export interface ExhibitInfo {
  title: string;
  subtitle: string;
  lines: string[];
  tags?: string[];
  link?: string;
}

export interface ExhibitSignal {
  near: boolean;
  open: boolean;
  item: ExhibitInfo | null;
  /** small print under the card (default "F — close") */
  footer?: string;
  /** accent colour of the card */
  color?: string;
  /** what kind of card it is (e.g. "Experience") */
  label?: string;
  /** which card this is, out of how many (e.g. [7, 23]) */
  counter?: [number, number];
  /** how far past its billboard you are (0–1), for the progress strip */
  progress?: number;
}

export const createExhibitSignal = (): ExhibitSignal => ({ near: false, open: false, item: null });
