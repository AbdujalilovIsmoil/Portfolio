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
}

export const createExhibitSignal = (): ExhibitSignal => ({ near: false, open: false, item: null });
