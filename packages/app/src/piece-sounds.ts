/**
 * The piece sounds a player picks in Settings → Sound: one for a move, one for a capture, chosen separately and kept
 * on the device. Every option is wood (Eric, Oct 12). The first of each is the default: the classic knocks, PyChess's
 * (GPL-3.0, credited; Eric, Oct 12: back as the defaults), with their old ids ("wood"), so a device that picked them
 * before keeps them. Next, three close variations of each classic (pitch, EQ and decay changed a little; GPL-3.0 too),
 * then the other wooden options (Kenney's CC0, or ours). An old or unknown id reads as the default. Files: the classics
 * in public/sounds/, the rest in public/sounds/pieces/, made by scripts/piece-sounds.py; where each comes from and its
 * license: public/sounds/SOURCES.md.
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
  { id: "wood", label: "Classic knock", note: "The wooden knock (the default)", file: "/sounds/move.mp3" },
  { id: "classic-light", label: "Classic light", note: "The classic, a little higher", file: "/sounds/pieces/move-classic-light.mp3" },
  { id: "classic-deep", label: "Classic deep", note: "The classic, a little lower", file: "/sounds/pieces/move-classic-deep.mp3" },
  { id: "classic-soft", label: "Classic soft", note: "The classic, softer", file: "/sounds/pieces/move-classic-soft.mp3" },
  { id: "light-wood", label: "Light wood", note: "A small wooden tap", file: "/sounds/pieces/move-light-wood.mp3" },
  { id: "wood-tap", label: "Wooden tap", note: "Short and bright", file: "/sounds/pieces/move-wood-tap.mp3" },
  { id: "bright-wood", label: "Bright wood", note: "A smaller piece", file: "/sounds/pieces/move-bright-wood.mp3" },
  { id: "ringing-wood", label: "Ringing wood", note: "It rings a little", file: "/sounds/pieces/move-ringing-wood.mp3" },
  { id: "deep-wood", label: "Deep wood", note: "Lower and rounder", file: "/sounds/pieces/move-deep-wood.mp3" },
] as const satisfies readonly PieceSoundOption[];

export const CAPTURE_SOUNDS = [
  { id: "wood", label: "Classic double knock", note: "Piece on piece, then the board (the default)", file: "/sounds/capture.mp3" },
  { id: "classic-light-double", label: "Classic light double", note: "The classic, a little higher", file: "/sounds/pieces/capture-classic-light.mp3" },
  { id: "classic-deep-double", label: "Classic deep double", note: "The classic, a little lower", file: "/sounds/pieces/capture-classic-deep.mp3" },
  { id: "classic-soft-double", label: "Classic soft double", note: "The classic, softer", file: "/sounds/pieces/capture-classic-soft.mp3" },
  { id: "heavy-wood", label: "Heavy wood", note: "A big wooden knock", file: "/sounds/pieces/capture-heavy-wood.mp3" },
  { id: "double-knock", label: "Double knock", note: "A light knock, then a heavy one", file: "/sounds/pieces/capture-double-knock.mp3" },
  { id: "short-wood", label: "Short wood", note: "Heavy, and over quickly", file: "/sounds/pieces/capture-short-wood.mp3" },
  { id: "wood-block", label: "Wood block", note: "Hollow and bright", file: "/sounds/pieces/capture-wood-block.mp3" },
  { id: "big-wood", label: "Big wood", note: "Low and heavy", file: "/sounds/pieces/capture-big-wood.mp3" },
] as const satisfies readonly PieceSoundOption[];

/** Castling with the default move sound: the classic king-and-rook knock (with another pick, it plays twice). */
export const CASTLE_SOUND = "/sounds/castle.mp3";

export const PIECE_SOUNDS: Record<PieceSoundKind, readonly PieceSoundOption[]> = { move: MOVE_SOUNDS, capture: CAPTURE_SOUNDS };

/** Where each pick is kept on the device. */
export const PIECE_SOUND_KEYS: Record<PieceSoundKind, string> = { move: "brc.moveSound", capture: "brc.captureSound" };

/** The default: the first option. */
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
