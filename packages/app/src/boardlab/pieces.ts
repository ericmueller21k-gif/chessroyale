/**
 * Board lab (throwaway): the piece set its cm-chessboard board shows, as image URLs keyed "wp", "bk", ...: the game's
 * own pieces (the cburnett set, board/pieces/: BSD). (Its non-commercial "Staunty" set was dropped, Oct 12, 2026: only
 * the game's own pieces, which may ship.)
 */
const FILES = import.meta.glob("../board/pieces/cburnett/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export type PieceSet = "game";
export type PieceCode = `${"w" | "b"}${"p" | "n" | "b" | "r" | "q" | "k"}`;

/** The game's pieces: one URL per piece. */
export const GAME_PIECES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(FILES)) {
    const m = /Chess_([pnbrqk])([ld])t45\.svg$/.exec(path);
    if (m) out[(m[2] === "l" ? "w" : "b") + m[1]] = url;
  }
  return out;
})();

let gameSprite: string | null = null;

/** A cm-chessboard sprite (40 × 40 tiles, ids "wp" …) of the game's pieces, as a URL. */
export function spriteUrl(_set: PieceSet): string {
  if (!gameSprite) {
    const tiles = Object.entries(GAME_PIECES)
      .map(([id, src]) => `<g id="${id}"><image href="${new URL(src, location.href).href}" x="0" y="0" width="40" height="40"/></g>`)
      .join("");
    gameSprite = URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${tiles}</svg>`], { type: "image/svg+xml" }));
  }
  return gameSprite;
}
