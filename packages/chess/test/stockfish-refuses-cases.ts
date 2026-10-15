import { START_FEN } from "../src/index.ts";

/**
 * The positions `stockfishRefuses` is checked on, shared by two tests:
 * - `stockfish-refuses.test.ts` checks `refused` against `stockfishRefuses`, and `sf19` (Stockfish 19's own verdict:
 *   `refused` unless written) against the browsers' engine itself;
 * - `engine-container.test.ts` sends every case to the engine server's own Stockfish (its container, through its HTTP
 *   interface, in CI: `.github/workflows/engine-container.yml`): each one `stockfishRefuses` lets through must be
 *   searched and leave the server answering.
 */
export interface RefusalCase {
  fen: string;
  /** Whether `stockfishRefuses` turns it away (never sent to any engine). */
  refused: boolean;
  /** Whether Stockfish 19 (the browsers' build) refuses it, where that differs from `refused`. */
  sf19?: boolean;
}

export const CASES: Record<string, RefusalCase> = {
  start: { fen: START_FEN, refused: false },
  ninePawns: { fen: "4k3/8/8/8/8/P7/PPPPPPPP/4K3 w - - 0 1", refused: true },
  nineBlackPawns: { fen: "4k3/pppppppp/p7/8/8/8/8/4K3 b - - 0 1", refused: true },
  thirtyThreePieces: { fen: "rnbqkbnr/pppppppp/8/8/8/P7/PPPPPPPP/RNBQKBNR w KQkq - 0 1", refused: true },
  pawnOnEighth: { fen: "P3k3/8/8/8/8/8/8/4K3 w - - 0 1", refused: true },
  pawnOnFirst: { fen: "4k3/8/8/8/8/8/8/p3K3 b - - 0 1", refused: true },
  noBlackKing: { fen: "8/8/8/8/8/8/8/4K3 w - - 0 1", refused: true },
  twoWhiteKings: { fen: "4k3/8/8/8/8/8/8/3KK3 w - - 0 1", refused: true },
  sideNotToMoveInCheck: { fen: "4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1", refused: true },
  sideToMoveInDoubleCheck: { fen: "4k3/8/8/8/8/8/8/1r2K2r w - - 0 1", refused: false },
  sideToMoveInTripleCheck: { fen: "4k3/8/8/8/8/5n2/8/1r2K2r w - - 0 1", refused: false },
  tooManyQueens: { fen: "4k3/8/8/8/8/8/QQQQQQQQ/QQ2K3 w - - 0 1", refused: true },
  nineKnightsNoPawns: { fen: "4k3/8/8/8/8/8/NNNNNNNN/N3K3 w - - 0 1", refused: false },
  extraKnightEightPawns: { fen: "4k3/8/8/8/8/N7/PPPPPPPP/RNBQKBNR w - - 0 1", refused: true },
  extraKnightSevenPawns: { fen: "4k3/8/8/8/8/N7/PPPPPPP1/RNBQKBNR w - - 0 1", refused: false },
  threeRooksEightPawns: { fen: "4k3/8/8/8/8/8/PPPPPPPP/RR2K2R w - - 0 1", refused: true },
  twoQueensSevenPawns: { fen: "4k3/8/8/8/8/8/PPPPPPP1/QQ2K3 w - - 0 1", refused: false },
  twoSameColorBishops: { fen: "4k3/8/8/8/8/8/PPPPPPPP/1B1BK3 w - - 0 1", refused: false },
  unknownPiece: { fen: "4k3/8/8/8/8/8/8/3XK3 w - - 0 1", refused: true },
  noSideToMove: { fen: "4k3/8/8/8/8/8/8/4K3", refused: true },
  epWrongRankWhite: { fen: "4k3/8/8/8/8/8/8/4K3 w - e3 0 1", refused: true },
  epWrongRankBlack: { fen: "4k3/8/8/8/8/8/8/4K3 b - e6 0 1", refused: true },
  epNotAFile: { fen: "4k3/8/8/8/8/8/8/4K3 w - x6 0 1", refused: true },
  epNoCapturer: { fen: "4k3/8/8/4p3/8/8/8/4K3 w - e6 0 1", refused: false },
  epNoPawnInFront: { fen: "4k3/8/8/8/8/8/8/4K3 w - e6 0 1", refused: false },
  epLegal: { fen: "4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1", refused: false },
  epPinned: { fen: "8/8/8/K2Pp2r/8/8/8/4k3 w - e6 0 1", refused: false },
  castlingAll: { fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", refused: false },
  castlingKingOnD1: { fen: "4k3/8/8/8/8/8/8/R2K3R w KQ - 0 1", refused: false },
  castlingWithoutRook: { fen: "4k3/8/8/8/8/8/8/4K3 w K - 0 1", refused: true, sf19: false },
  castlingQueenSideWithoutRook: { fen: "4k3/8/8/8/8/8/8/4K3 w Q - 0 1", refused: true, sf19: false },
  castlingBlackWithoutRooks: { fen: "4k3/8/8/8/8/8/8/4K3 b kq - 0 1", refused: true, sf19: false },
  castlingRookOnOtherSide: { fen: "4k3/8/8/8/8/8/8/R3K3 w K - 0 1", refused: true, sf19: false },
  castlingRookOffBackRank: { fen: "4k3/8/8/8/8/8/7R/4K3 w K - 0 1", refused: true, sf19: false },
  castlingKingOffBackRank: { fen: "4k3/8/8/8/8/8/4K3/R6R w KQ - 0 1", refused: true, sf19: false },
  castlingFileWithoutRook: { fen: "4k3/8/8/8/8/8/8/4K3 w H - 0 1", refused: true, sf19: false },
  castlingRookBesideCorner: { fen: "4k3/8/8/8/8/8/8/1R2K3 w Q - 0 1", refused: false },
  castlingBlackQueenSide: { fen: "r3k3/8/8/8/8/8/8/4K3 b q - 0 1", refused: false },
  castlingQueenSideRookOnKingSide: { fen: "4k3/8/8/8/8/8/8/4K2R w Q - 0 1", refused: true, sf19: false },
  castlingKingInCorner: { fen: "4k3/8/8/8/8/8/8/K6R w K - 0 1", refused: true, sf19: false },
  castlingFileOpponentRook: { fen: "4k3/8/8/8/8/8/8/1R2K1r1 w G - 0 1", refused: true, sf19: false },
  fiveCastlingRights: { fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkqK - 0 1", refused: true },
  unreadableCastling: { fen: "r3k2r/8/8/8/8/8/8/R3K2R w Kx - 0 1", refused: true },
  bigCounters: { fen: "4k3/8/8/8/8/8/8/4K3 w - - 1000 900", refused: false },
  largestCounters: { fen: "4k3/8/8/8/8/8/8/4K3 w - - 32767 100000", refused: false },
  halfmoveCountTooBig: { fen: "4k3/8/8/8/8/8/8/4K3 w - - 32768 1", refused: true },
  moveNumberTooBig: { fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 100001", refused: true },
  chess960: { fen: "bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9", refused: false },
  chess960Castling: { fen: "1r2k1r1/pppppppp/8/8/8/8/PPPPPPPP/1R2K1R1 w GBgb - 0 1", refused: false },
};
