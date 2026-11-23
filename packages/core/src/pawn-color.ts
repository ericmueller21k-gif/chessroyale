/**
 * A player's default pawn color (Eric, Nov 7): the color your pawn is drawn in wherever no game sets it (the town, home,
 * the locker, your profile and the queue). Inside a match the side decides it. Saved on the account when signed in
 * (`users.pawn_color`, NULL: white) and on the device for a guest.
 */
export const PAWN_COLORS = ["white", "black"] as const;
export type PawnColor = (typeof PAWN_COLORS)[number];
export const DEFAULT_PAWN_COLOR: PawnColor = "white";

/** The color a value means: "white" or "black"; anything else (nothing, junk) is the default, white. */
export const pawnColorOf = (v: unknown): PawnColor => (PAWN_COLORS as readonly unknown[]).includes(v) ? (v as PawnColor) : DEFAULT_PAWN_COLOR;

/** A value to save: only "white" or "black" (null: not a pawn color, nothing is saved). */
export const cleanPawnColor = (v: unknown): PawnColor | null => ((PAWN_COLORS as readonly unknown[]).includes(v) ? (v as PawnColor) : null);

/**
 * The black default pawn's outline (Eric, Nov 8: a black silhouette vanished on the locker's blue and the town's night sky): a
 * warm off-white, the weight of the white pawn's black outline. Only the default color's black pawn; a match's black pieces keep theirs.
 */
export const PAWN_OUTLINE_ON_BLACK = "#f5efe0";

/** A pawn color as the figure's side (components/Items.tsx: "w" or "b"). */
export const sideOfPawn = (c: PawnColor): "w" | "b" => (c === "black" ? "b" : "w");
