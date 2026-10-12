/**
 * Board lab (throwaway): the two piece sets it can show, as image URLs keyed "wp", "bk", ...
 * - "game": the game's own pieces (the cburnett set, as the game draws them today), read from the stylesheet it uses.
 * - "cm": cm-chessboard's default set (lichess "Staunty", CC BY-NC-SA 4.0: fine to try, not to ship).
 */
import gameCss from "chessground/assets/chessground.cburnett.css?raw";
import stauntySprite from "cm-chessboard/assets/pieces/staunty.svg?raw";

export type PieceSet = "game" | "cm";
export type PieceCode = `${"w" | "b"}${"p" | "n" | "b" | "r" | "q" | "k"}`;

const ROLE: Record<string, string> = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };

/** The game's pieces: data URIs, one per piece. */
export const GAME_PIECES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const re = /piece\.(\w+)\.(white|black)\s*\{\s*background-image:\s*url\('([^']+)'\)/g;
  for (const m of gameCss.matchAll(re)) out[(m[2] === "white" ? "w" : "b") + ROLE[m[1]!]] = m[3]!;
  return out;
})();

const blobUrl = (svg: string) => URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

let gameSprite: string | null = null;
let cmSprite: string | null = null;
let cmImages: Record<string, string> | null = null;

/** A cm-chessboard sprite (40 × 40 tiles, ids "wp" …) for a set, as a URL. */
export function spriteUrl(set: PieceSet): string {
  if (set === "cm") return (cmSprite ??= blobUrl(stauntySprite));
  if (!gameSprite) {
    const tiles = Object.entries(GAME_PIECES)
      .map(([id, src]) => `<g id="${id}"><image href="${src}" x="0" y="0" width="40" height="40"/></g>`)
      .join("");
    gameSprite = blobUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${tiles}</svg>`);
  }
  return gameSprite;
}

/** One image per piece for a set (for the board written here). */
export function pieceImages(set: PieceSet): Record<string, string> {
  if (set === "game") return GAME_PIECES;
  if (!cmImages) {
    // Cut each piece's group out of the sprite into its own small SVG.
    const doc = new DOMParser().parseFromString(stauntySprite, "image/svg+xml");
    const defs = [...doc.querySelectorAll("defs")].map((d) => new XMLSerializer().serializeToString(d)).join("");
    cmImages = {};
    for (const id of ["wp", "wn", "wb", "wr", "wq", "wk", "bp", "bn", "bb", "br", "bq", "bk"]) {
      const g = doc.getElementById(id);
      if (!g) continue;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="40" viewBox="0 0 40 40">${defs}${new XMLSerializer().serializeToString(g)}</svg>`;
      cmImages[id] = blobUrl(svg);
    }
  }
  return cmImages;
}
