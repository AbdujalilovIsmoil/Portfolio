import { MUSIC, type MusicId } from "./game";

/** The race music picked in the menu (remembered in this browser; the first track if none, or storage is blocked). */
const KEY = "race-music";

export function getMusic(): MusicId {
  try {
    const v = localStorage.getItem(KEY);
    if (v && MUSIC.some((m) => m.id === v)) return v as MusicId;
  } catch {}
  return MUSIC[0].id;
}

export function setMusic(id: MusicId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
}

/** The file to play for it ("" for none). */
export const musicFile = (id: MusicId = getMusic()) => MUSIC.find((m) => m.id === id)?.file ?? "";
