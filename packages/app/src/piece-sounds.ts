/**
 * The piece sounds a player picks in Settings → Sound: one for a move, one for a capture, chosen separately and kept
 * on the device. The first option of each is today's wooden knock, the default, so nothing changes for anyone who
 * doesn't pick. Files are in public/sounds/ (the new ones in sounds/pieces/, made by scripts/piece-sounds.py); where
 * each comes from and its licence: public/sounds/SOURCES.md.
 *
 * Pure (storage only): sound.ts plays them, Settings shows them.
 */

export type PieceSoundKind = "move" | "capture";

export interface PieceSoundOption {
  readonly id: string;
  /** What the picker shows. */
  readonly label: string;
  /** A few words beside it. */
  readonly note: string;
  /** The file, under public/. */
  readonly file: string;
}

export const MOVE_SOUNDS = [
  { id: "wood", label: "Wooden knock", note: "The default", file: "/sounds/move.mp3" },
  { id: "light-wood", label: "Light wood", note: "A small wooden tap", file: "/sounds/pieces/move-light-wood.mp3" },
  { id: "poker-chip", label: "Poker chip", note: "A chip set down", file: "/sounds/pieces/move-poker-chip.mp3" },
  { id: "click", label: "Click", note: "Crisp and bright", file: "/sounds/pieces/move-click.mp3" },
  { id: "soft", label: "Soft", note: "Felt on wood", file: "/sounds/pieces/move-soft.mp3" },
] as const satisfies readonly PieceSoundOption[];

export const CAPTURE_SOUNDS = [
  { id: "wood", label: "Double knock", note: "The default", file: "/sounds/capture.mp3" },
  { id: "heavy-wood", label: "Heavy wood", note: "A big wooden knock", file: "/sounds/pieces/capture-heavy-wood.mp3" },
  { id: "chips", label: "Chips", note: "Chip on chip", file: "/sounds/pieces/capture-chips.mp3" },
  { id: "clack", label: "Clack", note: "Piece hits piece", file: "/sounds/pieces/capture-clack.mp3" },
  { id: "thud", label: "Thud", note: "Low and heavy", file: "/sounds/pieces/capture-thud.mp3" },
] as const satisfies readonly PieceSoundOption[];

export const PIECE_SOUNDS: Record<PieceSoundKind, readonly PieceSoundOption[]> = { move: MOVE_SOUNDS, capture: CAPTURE_SOUNDS };

/** Where each pick is kept on the device. */
export const PIECE_SOUND_KEYS: Record<PieceSoundKind, string> = { move: "brc.moveSound", capture: "brc.captureSound" };

/** The default: today's sound, the first option. */
export const defaultPieceSound = (kind: PieceSoundKind): PieceSoundOption => PIECE_SOUNDS[kind][0]!;

/** The option with this id, or the default for anything else (an old or unknown id, nothing stored). */
export function pieceSoundOption(kind: PieceSoundKind, id: string | null | undefined): PieceSoundOption {
  return PIECE_SOUNDS[kind].find((o) => o.id === id) ?? defaultPieceSound(kind);
}

function readStored(kind: PieceSoundKind): string | null {
  try {
    return localStorage.getItem(PIECE_SOUND_KEYS[kind]);
  } catch {
    return null;
  }
}

const picked: Record<PieceSoundKind, PieceSoundOption> = {
  move: pieceSoundOption("move", readStored("move")),
  capture: pieceSoundOption("capture", readStored("capture")),
};
const listeners = new Set<() => void>();

/** The sound this device plays for a move or a capture. */
export const pieceSound = (kind: PieceSoundKind): PieceSoundOption => picked[kind];

/** Picks a sound (an unknown id picks the default) and keeps it on the device. */
export function setPieceSound(kind: PieceSoundKind, id: string): PieceSoundOption {
  const option = pieceSoundOption(kind, id);
  picked[kind] = option;
  try {
    localStorage.setItem(PIECE_SOUND_KEYS[kind], option.id);
  } catch {
    // Not important: it lasts until the page reloads.
  }
  listeners.forEach((l) => l());
  return option;
}

export function onPieceSoundChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
