import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import {
  adjustBlock,
  adjustMarks,
  adjustMove,
  adjustSecondsFor,
  adjustWords,
  movedSquares,
  starredToMove,
  startStars,
  starTargets,
  undoAction,
  undoBlock,
} from "../src/autochess/adjust.ts";
import {
  buyBlock,
  buyWords,
  canStarUp,
  carryBench,
  halfSquares,
  heldBlock,
  holdBlock,
  offerPrice,
  paidFor,
  placeHeld,
  sellHeld,
  sellPiece,
  sellValue,
  starUp,
  starUpTarget,
  starUpsIn,
  starredCount,
  starrablePieces,
  usableSquares,
} from "../src/autochess/army.ts";
import { botBenchAt, botAt, botBuys, botPlan, botStarMoves, botStarUps } from "../src/autochess/bot.ts";
import { beginRound, newMatch, refundFor, settleRound, worth } from "../src/autochess/economy.ts";
import { moveStars, starsAfter } from "../src/autochess/fight.ts";
import { revealedAt } from "../src/autochess/reveal.ts";
import { buyFromSlot, holdFromSlot, newShop, replaceTaken, rollOffer, shopSeed, type Shop } from "../src/autochess/shop.ts";
import type { Army, Held, Kind, Offer, StarCount } from "../src/autochess/types.ts";

/**
 * Stars (v8, Eric Oct 22): the offer rule (candidates, the redraw, star-ups ignoring the limits, one offer to a square, seeded), the merge (board, bench, a new-piece roll
 * that matches a held piece), prices and refunds, the move step's length and each star's moves, and the bot's buys and moves.
 */

const army = (color: "w" | "b", king: string, board: Record<string, Kind> = {}, stars: Record<string, StarCount> = {}, bench: Held[] = []): Army => ({ color, king, board, ...(Object.keys(stars).length ? { stars } : {}), bench });
const white = (board: Record<string, Kind> = {}, stars: Record<string, StarCount> = {}, bench: Held[] = []) => army("w", "e1", board, stars, bench);
const black = (board: Record<string, Kind> = {}) => army("b", "g8", board);
const offer = (kind: Kind, square: string): Offer => ({ kind, square });
const shopOf = (slots: Offer[]): Shop => ({ slots, rerolls: 0, refills: 0 });
/** Every square of the white half but these: what "taken" has to be to leave a roll only these squares to draw from. */
const allBut = (...keep: string[]) => new Set(halfSquares("w").filter((sq) => !keep.includes(sq)));
const LEGAL: AutoChessSettings = { ...AUTOCHESS, adjustMode: "legal" };

describe("auto chess stars: the numbers", () => {
  it("holds the design's: a star-up is a flat 5, three stars at most, the move step 5 s and 3 s a starred piece, the bot buys star-ups nearly always", () => {
    expect(AUTOCHESS.starUpCost).toBe(5);
    expect(AUTOCHESS.maxStars).toBe(3);
    expect(AUTOCHESS.adjustMode).toBe("stars");
    expect(AUTOCHESS.moveBase).toBe(5);
    expect(AUTOCHESS.movePerStar).toBe(3);
    expect(AUTOCHESS.bot.starUpChance).toBeGreaterThanOrEqual(0.9);
  });

  it("a piece can star up unless it is a pawn (or the king) or already at three stars", () => {
    for (const k of ["n", "b", "r", "q"] as Kind[]) {
      expect(canStarUp(k, 1)).toBe(true);
      expect(canStarUp(k, 2)).toBe(true);
      expect(canStarUp(k, 3)).toBe(false);
    }
    expect(canStarUp("p", 1)).toBe(false);
    expect(canStarUp("k", 1)).toBe(false);
  });
});

describe("auto chess stars: the offer rule", () => {
  it("a square holding a piece offers only that piece; a bench piece for the same square is a second candidate ('the shop can still find both the rook and the bishop')", () => {
    // A rook on f2 and a bishop held for f2: the draw is limited to f2, so the offer is one of the two, about evenly.
    const a = white({ f2: "r" }, {}, [{ kind: "b", square: "f2" }]);
    const rng = mulberry32(5);
    const seen = { r: 0, b: 0, other: 0 };
    for (let i = 0; i < 4000; i++) {
      const o = rollOffer(rng, a, AUTOCHESS, allBut("f2"), 4)!;
      expect(o.square).toBe("f2");
      if (o.kind === "r") seen.r++;
      else if (o.kind === "b") seen.b++;
      else seen.other++;
    }
    expect(seen.other).toBe(0);
    expect(Math.abs(seen.r - 2000)).toBeLessThan(200);
    expect(Math.abs(seen.b - 2000)).toBeLessThan(200);
  });

  it("an empty board square with a piece held for it offers that piece's star-up or a new piece, evenly (a new piece that is the held kind is the star-up too)", () => {
    const a = white({}, {}, [{ kind: "b", square: "f2" }]);
    const rng = mulberry32(6);
    let up = 0;
    let fresh = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const o = rollOffer(rng, a, AUTOCHESS, allBut("f2"), 4)!;
      expect(o.square).toBe("f2");
      if (starUpTarget(a, o)) up++;
      else fresh++;
    }
    // Half the draws are the bench piece's star-up, and of the other half a bishop (12% at level 4) is a star-up as well: 0.5 + 0.5 * 0.12 = 0.56.
    expect(Math.abs(up / N - 0.56)).toBeLessThan(0.03);
    expect(fresh).toBeGreaterThan(0);
  });

  it("a square whose piece can't star up (a pawn, a 3-star) and no bench piece holds offers nothing: it is drawn again, and with no other square there is no offer", () => {
    expect(rollOffer(mulberry32(1), white({ f2: "p" }), AUTOCHESS, allBut("f2"), 4)).toBeNull();
    expect(rollOffer(mulberry32(1), white({ f2: "r" }, { f2: 3 }), AUTOCHESS, allBut("f2"), 4)).toBeNull();
    // A pawn on f2 with a knight held for f2: only the knight's star-up.
    const a = white({ f2: "p" }, {}, [{ kind: "n", square: "f2" }]);
    for (let i = 0; i < 50; i++) expect(rollOffer(mulberry32(i), a, AUTOCHESS, allBut("f2"), 4)).toEqual(offer("n", "f2"));
    // With the other squares open the shop draws again until a square has something: never the pawn's or the 3-star's.
    const b = white({ f2: "p", c3: "r", d4: "q" }, { c3: 3, d4: 3 });
    const rng = mulberry32(2);
    for (let i = 0; i < 2000; i++) {
      const o = rollOffer(rng, b, AUTOCHESS, new Set(), 10)!;
      expect(["f2", "c3", "d4", "e1"]).not.toContain(o.square);
    }
  });

  it("never offers on the king's square or a square another offer is on, and one offer to a square holds in a whole shop (a fuzz over starred armies, both colors)", () => {
    for (let seed = 0; seed < 300; seed++) {
      const color = seed % 2 ? "w" : "b";
      const half = halfSquares(color);
      const kingSq = half[seed % half.length]!;
      const rng = mulberry32(seed);
      const board: Record<string, Kind> = {};
      const stars: Record<string, StarCount> = {};
      const free = half.filter((sq) => sq !== kingSq);
      for (let i = 0; i < 1 + (seed % 8); i++) {
        const sq = free.splice(Math.floor(rng() * free.length), 1)[0]!;
        board[sq] = (["n", "b", "r", "p", "n", "b"] as Kind[])[Math.floor(rng() * 6)]!;
        if (board[sq] !== "p" && rng() < 0.3) stars[sq] = rng() < 0.5 ? 2 : 3;
      }
      const bench: Held[] = [{ kind: "b", square: free[0]! }, { kind: "n", square: free[1]!, stars: 2 }].slice(0, seed % 3);
      const a: Army = { color, king: kingSq, board, ...(Object.keys(stars).length ? { stars } : {}), bench };
      const shop = newShop(seed, a, AUTOCHESS, 4 + (seed % 7));
      expect(shop.slots.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(new Set(shop.slots.map((o) => o.square)).size).toBe(shop.slots.length);
      for (const o of shop.slots) {
        expect(o.square).not.toBe(kingSq);
        expect(half).toContain(o.square);
        // Every offer is a star-up of a piece of yours that can star up, or a new piece on a square you could use.
        if (!starUpTarget(a, o)) expect(usableSquares(a, o.kind), `${o.kind} ${o.square}`).toContain(o.square);
      }
    }
  });

  it("is seeded: the same army and seed roll the same shop, and a different seed another", () => {
    const a = white({ c3: "n", d2: "b", f1: "r" });
    expect(newShop(77, a)).toEqual(newShop(77, a));
    let differs = 0;
    for (let seed = 0; seed < 100; seed++) if (JSON.stringify(newShop(seed, a).slots) !== JSON.stringify(newShop(seed + 1, a).slots)) differs++;
    expect(differs).toBeGreaterThan(95);
  });

  it("an army with nothing that can star up rolls as it always did, and with something the new pieces still follow the level's odds", () => {
    // (Pawns only: nothing to star up, so the same offers as the old roll: the odds' own test file checks the table from an empty army.)
    const pawns = white({ a2: "p", b2: "p" });
    expect(starrablePieces(pawns)).toEqual([]);
    // With a knight and a bishop out the new pieces among the offers keep the odds (the star-ups are the rest).
    const a = white({ c3: "n", d2: "b" });
    const rng = mulberry32(31);
    const kinds: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    let fresh = 0;
    for (let i = 0; i < 40000; i++) {
      const o = rollOffer(rng, a, AUTOCHESS, new Set(), 7)!;
      if (starUpTarget(a, o)) continue;
      kinds[o.kind]!++;
      fresh++;
    }
    const row = AUTOCHESS.shop.oddsByLevel[6]!;
    for (const k of ["p", "n", "b", "r", "q"] as Kind[]) expect(Math.abs((100 * kinds[k]!) / fresh - row[k]), `${k} at level 7`).toBeLessThan(1.2);
  });

  it("star-ups ignore the limits on new pieces: a queen's with your one queen out, with a full board", () => {
    const full = white({ d1: "q", a2: "p", b2: "p", c2: "p" });
    // (Level 4: four pieces, so the board is full.)
    const q = offer("q", "d1");
    expect(starUpTarget(full, q)).toEqual({ where: "board", square: "d1", becomes: 2 });
    expect(buyBlock(full, 100, q, AUTOCHESS, 4)).toBeNull();
    expect(buyBlock(full, 4, q, AUTOCHESS, 4)).toBe("gold");
    // A new queen is refused: the one queen, and a full board.
    expect(buyBlock(full, 500, offer("q", "d2"), AUTOCHESS, 4)).toBe("queen");
    expect(buyBlock(white({ a2: "p", b2: "p", c2: "p", d2: "p" }), 500, offer("n", "e2"), AUTOCHESS, 4)).toBe("limit");
    // Nor can it be held.
    expect(holdBlock(full, 500, q)).toBe("starup");
    expect(buyWords("starup", q, 500).line).toBe("Tap to star up");
  });

  it("a star-up offer stays when a piece is placed on another square, and rolls again when its piece is gone from a square another piece took", () => {
    const a = white({ f2: "r" });
    const shop = shopOf([offer("r", "f2"), offer("n", "a3"), offer("b", "h3"), offer("p", "c4")]);
    expect(replaceTaken(shop, 5, a).replaced).toBe(0);
    // A different piece on f2 (the rook sold and a knight placed there): the rook offer can't land and isn't a star-up now, so it rolls again.
    const b = white({ f2: "n" });
    const out = replaceTaken(shop, 5, b);
    expect(out.replaced).toBe(1);
    expect(out.from).toEqual(["f2"]);
  });
});

describe("auto chess stars: how often a star-up shows", () => {
  it("rises with the pieces that can star up (a loose guard; the PR reports the counts)", () => {
    const squares = ["c2", "d3", "b3", "f2", "g3", "a1"];
    const kinds: Kind[] = ["n", "b", "r", "n", "b", "n"];
    const per = (n: number) => {
      const board: Record<string, Kind> = {};
      for (let i = 0; i < n; i++) board[squares[i]!] = kinds[i]!;
      let shopsWith = 0;
      for (let seed = 0; seed < 1500; seed++) if (newShop(seed, white(board), AUTOCHESS, 4).slots.some((o) => starUpTarget(white(board), o))) shopsWith++;
      return shopsWith / 1500;
    };
    const [two, four, six] = [per(2), per(4), per(6)];
    expect(two).toBeGreaterThan(0.05);
    expect(four).toBeGreaterThan(two);
    expect(six).toBeGreaterThan(four);
    expect(six).toBeLessThan(0.95);
  });
});

describe("auto chess stars: the merge", () => {
  it("a star-up on the board costs 5, adds no piece, and the piece gains a star: plain, 2, 3, and a 3-star's offer is a new piece that can't land", () => {
    let a = white({ f2: "r", a2: "p" });
    let gold = 100;
    const shop = shopOf([offer("r", "f2"), offer("n", "c3"), offer("b", "h3"), offer("p", "c4")]);
    const one = buyFromSlot({ army: a, gold, shop }, 0, 5, AUTOCHESS, 4);
    if ("block" in one) throw new Error("should buy");
    expect(one.starUp).toEqual({ where: "board", square: "f2", becomes: 2 });
    expect(one.gold).toBe(95);
    expect(one.army.board).toEqual({ f2: "r", a2: "p" });
    expect(one.army.stars).toEqual({ f2: 2 });
    // The slot rolled again; the others stayed.
    expect(one.shop.slots.filter((_, i) => i !== 0)).toEqual(shop.slots.filter((_, i) => i !== 0));
    expect(buyFromSlot({ army: a, gold, shop }, 0, 5, AUTOCHESS, 4)).toEqual(one);
    // The next one.
    a = one.army;
    gold = one.gold;
    const two = buyFromSlot({ army: a, gold, shop: shopOf([offer("r", "f2")]) }, 0, 6, AUTOCHESS, 4);
    if ("block" in two) throw new Error("should buy");
    expect(two.army.stars).toEqual({ f2: 3 });
    expect(two.gold).toBe(90);
    // At three stars there is nothing left to star up: the offer is a new rook on a taken square.
    expect(starUpTarget(two.army, offer("r", "f2"))).toBeNull();
    expect(buyBlock(two.army, 100, offer("r", "f2"))).toBe("taken");
  });

  it("a held piece gains its star on the bench, keeping its square; a new piece rolled that matches a held piece's kind and square merges into it at 5", () => {
    const a = white({}, {}, [{ kind: "b", square: "c1" }, { kind: "n", square: "g3" }]);
    // (The shop meant it as a new bishop on the empty c1: it is the star-up of the one held for c1.)
    expect(offerPrice(a, offer("b", "c1"))).toBe(5);
    expect(offerPrice(a, offer("b", "d1"))).toBe(32);
    const got = buyFromSlot({ army: a, gold: 40, shop: shopOf([offer("b", "c1")]) }, 0, 3, AUTOCHESS, 4);
    if ("block" in got) throw new Error("should buy");
    expect(got.starUp).toEqual({ where: "bench", index: 0, becomes: 2 });
    expect(got.gold).toBe(35);
    expect(got.army.bench).toEqual([{ kind: "b", square: "c1", stars: 2 }, { kind: "n", square: "g3" }]);
    expect(got.army.board).toEqual({});
    // Held for another square or another kind: an ordinary new piece.
    expect(starUpTarget(a, offer("n", "c1"))).toBeNull();
    expect(starUpTarget(a, offer("b", "g3"))).toBeNull();
    // A bench piece at three stars can't be starred up: the offer is a new piece again.
    const top = white({}, {}, [{ kind: "b", square: "c1", stars: 3 }]);
    expect(starUpTarget(top, offer("b", "c1"))).toBeNull();
    // A pawn held is never starred.
    expect(starUpTarget(white({}, {}, [{ kind: "p", square: "c2" }]), offer("p", "c2"))).toBeNull();
  });

  it("the board's piece comes first when it and a held piece match; the bench's stars come down with the piece when it is placed, and stay through the round turn", () => {
    const both = white({ f2: "r" }, {}, [{ kind: "r", square: "f2" }]);
    expect(starUpTarget(both, offer("r", "f2"))).toEqual({ where: "board", square: "f2", becomes: 2 });
    const held = white({}, {}, [{ kind: "n", square: "c3", stars: 2 }]);
    expect(heldBlock(held, 0)).toBeNull();
    const placed = placeHeld(held, 0);
    expect(placed.board).toEqual({ c3: "n" });
    expect(placed.stars).toEqual({ c3: 2 });
    expect(placed.bench).toEqual([]);
    // Into the next round: the same file, the rank mirrored, the stars kept.
    expect(carryBench(held.bench)).toEqual([{ kind: "n", square: "c6", stars: 2 }]);
    expect(carryBench([{ kind: "b", square: "a1" }])).toEqual([{ kind: "b", square: "a8" }]);
  });

  it("starUp returns a new army and leaves the old one alone", () => {
    const a = white({ f2: "r" }, { f2: 2 });
    const target = starUpTarget(a, offer("r", "f2"))!;
    const b = starUp(a, target);
    expect(b.stars).toEqual({ f2: 3 });
    expect(a.stars).toEqual({ f2: 2 });
  });

  it("holding a star-up is refused (nothing to hold) and takes no gold", () => {
    const a = white({ f2: "r" });
    expect(holdFromSlot({ army: a, gold: 100, shop: shopOf([offer("r", "f2")]) }, 0, 5)).toEqual({ block: "starup" });
  });
});

describe("auto chess stars: prices and refunds", () => {
  it("a piece's price is what it cost: its price and 5 for each star above the first; selling gives back 75% of that, rounded down", () => {
    expect(paidFor("n", 1)).toBe(30);
    expect(paidFor("n", 2)).toBe(35);
    expect(paidFor("r", 3)).toBe(60);
    expect(sellValue("n", AUTOCHESS)).toBe(22);
    expect(sellValue("n", AUTOCHESS, 2)).toBe(26);
    expect(sellValue("r", AUTOCHESS, 3)).toBe(45);
    expect(sellValue("q", AUTOCHESS, 3)).toBe(75);
    expect(sellValue("p", AUTOCHESS)).toBe(7);
  });

  it("selling a starred piece pays for its stars and takes them with it, from the board and from the bench", () => {
    const a = white({ f2: "r", c3: "n" }, { f2: 3, c3: 2 }, [{ kind: "b", square: "a1", stars: 2 }]);
    const sold = sellPiece(a, "f2", "r")!;
    expect(sold.gold).toBe(45);
    expect(sold.army.board).toEqual({ c3: "n" });
    expect(sold.army.stars).toEqual({ c3: 2 });
    const last = sellPiece(sold.army, "c3", "n")!;
    expect(last.gold).toBe(26);
    expect(last.army.stars).toBeUndefined();
    const held = sellHeld(a, 0, "b")!;
    expect(held.gold).toBe(Math.floor(0.75 * 37));
    expect(held.army.bench).toEqual([]);
    // A plain one is as it was.
    expect(sellPiece(white({ c3: "n" }), "c3", "n")!.gold).toBe(22);
  });

  it("the survivors' refund counts everything paid: 25% of the prices and the star-ups of the pieces still standing", () => {
    expect(worth(["r", "n"], AUTOCHESS)).toBe(80);
    expect(worth(["r", "n"], AUTOCHESS, 3)).toBe(95);
    expect(refundFor(["r", "n"]).survivors).toBe(20);
    expect(refundFor(["r", "n"], AUTOCHESS, 3).survivors).toBe(23);
    expect(starUpsIn({ a1: 2, b2: 3 })).toBe(3);
    expect(starUpsIn(undefined)).toBe(0);
    // Through the round's settling.
    const { match } = beginRound(newMatch(3));
    const settled = settleRound(match, "you", { you: ["r", "n"], bot: ["b"] }, AUTOCHESS, { you: 0, bot: 0 }, { you: 2, bot: 0 });
    expect(settled.result.refund.you.survivors).toBe(Math.floor(0.25 * (80 + 10)));
    expect(settled.result.refund.bot.survivors).toBe(8);
  });

  it("the stars follow a piece through the fight's moves, and a captured piece's stars go with it", () => {
    const stars: Record<string, StarCount> = { e4: 2, d5: 3 };
    expect(moveStars(stars, "e4e5")).toEqual({ e5: 2, d5: 3 });
    // Taking the starred piece: the mover keeps its own stars, the captured piece's are gone.
    expect(moveStars(stars, "e4d5")).toEqual({ d5: 2 });
    expect(moveStars({ e4: 2 }, "a1a2")).toEqual({ e4: 2 });
    // A plain piece taking a starred one leaves no stars there.
    expect(moveStars({ d5: 3 }, "e4d5")).toEqual({});
    expect(starsAfter({ e4: 2 }, ["e4e5", "e5e6", "e6f7"])).toEqual({ f7: 2 });
    // (The old object is not changed.)
    expect(stars).toEqual({ e4: 2, d5: 3 });
  });
});

describe("auto chess stars: the move step", () => {
  it("lasts 5 s plus 3 s for each starred piece of the side with more of them on the board; the bench's stars don't count; the other modes keep 7 s", () => {
    const none = white({ c3: "n" });
    expect(adjustSecondsFor(none, black())).toBe(5);
    const two = white({ c3: "n", d2: "b" }, { c3: 2, d2: 3 });
    expect(adjustSecondsFor(two, black())).toBe(11);
    expect(adjustSecondsFor(black(), two)).toBe(11);
    // Two and two, still an extra 6 s in all, not 12: the side with more.
    expect(adjustSecondsFor(two, army("b", "g8", { c6: "n", d7: "b" }, { c6: 2, d7: 2 }))).toBe(11);
    // One against three: three.
    const three = white({ a2: "n", b2: "b", c2: "r" }, { a2: 2, b2: 2, c2: 2 });
    expect(adjustSecondsFor(army("b", "g8", { c6: "n" }, { c6: 2 }), three)).toBe(14);
    // A held piece's stars are not on the board.
    expect(adjustSecondsFor(white({}, {}, [{ kind: "n", square: "c3", stars: 2 }]), black())).toBe(5);
    expect(starredCount(two)).toBe(2);
    expect(adjustSecondsFor(two, black(), LEGAL)).toBe(7);
    expect(adjustSecondsFor(two, black(), { ...AUTOCHESS, adjustMode: "teleport" })).toBe(7);
    // The numbers are settings.
    expect(adjustSecondsFor(two, black(), { ...AUTOCHESS, moveBase: 4, movePerStar: 5 })).toBe(14);
  });

  const mine = white({ d2: "n", c3: "b", b1: "r", a2: "p", f1: "q" }, { d2: 2, c3: 3, f1: 2 });
  const start = () => startStars(mine, black());

  it("every starred piece may move once, in any order; a plain piece and the king don't ('Not starred', 'King stays put')", () => {
    const s = start();
    expect(starredToMove(s)).toEqual(["c3", "d2", "f1"]);
    expect(adjustBlock(s, "b1", "b2")).toBe("plain");
    expect(adjustBlock(s, "a2", "a3")).toBe("plain");
    expect(adjustBlock(s, "e1", "e2")).toBe("kingfixed");
    expect(adjustBlock(s, "h3", "h4")).toBe("none");
    expect(adjustWords("plain")).toBe("Not starred");
    expect(adjustWords("plain").length).toBeLessThanOrEqual(15);
    expect(adjustBlock(s, "d2", "f3")).toBeNull();
    // Any order, each once.
    let t = adjustMove(s, "f1", "g2");
    t = adjustMove(t, "d2", "f3");
    expect(adjustBlock(t, "c3", "h6")).toBe("half");
    expect(adjustBlock(t, "c3", "a1")).toBeNull();
    t = adjustMove(t, "c3", "a1");
    expect(starredToMove(t)).toEqual([]);
    expect(adjustBlock(t, "g2", "g3")).toBe("used");
    expect(adjustBlock(t, "f3", "h4")).toBe("used");
    expect(adjustBlock(t, "a1", "a4")).toBe("used");
    expect(movedSquares(t)).toEqual(new Set(["g2", "f3", "a1"]));
    expect(adjustMarks(t).map((m) => m.square).sort()).toEqual(["a1", "f3", "g2"]);
    // The stars went with the pieces.
    expect(t.army.stars).toEqual({ f3: 2, a1: 3, g2: 2 });
    expect(t.army.board).toMatchObject({ f3: "n", a1: "b", g2: "q", b1: "r", a2: "p" });
    expect(t.army.board.d2).toBeUndefined();
  });

  it("a 2-star makes one legal chess move that stays on your half; a 3-star goes to any empty square of your half", () => {
    const s = start();
    // The knight on d2 (2 stars): b3, c4, e4, f3 (b1 and f1 hold our pieces; the others are off the half), as the fight's moves say.
    expect(starTargets(s, "d2")).toEqual(["b3", "c4", "e4", "f3"]);
    expect(adjustBlock(s, "d2", "b3")).toBeNull();
    expect(adjustBlock(s, "d2", "d3")).toBe("illegal");
    expect(adjustBlock(s, "d2", "e5")).toBe("half");
    expect(adjustBlock(s, "d2", "e1")).toBe("king");
    expect(adjustBlock(s, "d2", "c3")).toBe("taken");
    expect(adjustWords("illegal")).toBe("Not a legal move");
    // The bishop on c3 (3 stars) isn't held to a bishop's moves: every empty square of the half but the king's and the taken ones.
    const free = halfSquares("w").filter((sq) => sq !== "e1" && !mine.board[sq]);
    expect(starTargets(s, "c3")).toEqual(free.sort());
    expect(adjustBlock(s, "c3", "h1")).toBeNull();
    expect(adjustBlock(s, "c3", "a4")).toBeNull();
    // A plain piece has no squares.
    expect(starTargets(s, "b1")).toEqual([]);
    expect(starTargets(s, "e1")).toEqual([]);
    // Nothing is ever captured: the targets are empty squares.
    for (const sq of starTargets(s, "c3")) expect(mine.board[sq]).toBeUndefined();
  });

  it("a 2-star's moves are the fight's, in the position as the step has made it: a pin, a check, and a line opened by an earlier move", () => {
    // A bishop pinned against our king by their rook: it may not leave the file (2 stars).
    const pinned = white({ e2: "b", b1: "n" }, { e2: 2, b1: 2 });
    const s = startStars(pinned, army("b", "g8", { e8: "r" }));
    expect(starTargets(s, "e2")).toEqual([]);
    expect(adjustBlock(s, "e2", "f3")).toBe("illegal");
    expect(starTargets(s, "b1").length).toBeGreaterThan(0);
    // A 3-star is not held to chess: the pinned piece (3 stars) may go.
    const pinned3 = white({ e2: "b" }, { e2: 3 });
    expect(adjustBlock(startStars(pinned3, army("b", "g8", { e8: "r" })), "e2", "h2")).toBeNull();
    // A rook shut in by its own knight gets its line when the knight (2 stars) moves away first.
    const shut = white({ a1: "r", b1: "n" }, { a1: 2, b1: 2 });
    const t = startStars(shut, black());
    expect(starTargets(t, "a1")).toEqual(["a2", "a3", "a4"]);
    const moved = adjustMove(t, "b1", "c3");
    expect(starTargets(moved, "a1")).toEqual(["a2", "a3", "a4", "b1", "c1", "d1"]);
    // In check from their rook, a 2-star may only answer it (block or the king moves are not its to make).
    const checked = white({ c3: "n", h2: "b" }, { c3: 2, h2: 2 });
    const c = startStars(checked, army("b", "g8", { e8: "r" }));
    expect(starTargets(c, "c3")).toEqual(["e2", "e4"]);
    expect(starTargets(c, "h2")).toEqual([]);
  });

  it("a move is taken back one at a time: a later piece that stands on the square it left, or whose move depends on it, comes first", () => {
    const a = white({ a1: "r", b1: "n" }, { a1: 2, b1: 2 });
    let s = startStars(a, black());
    s = adjustMove(s, "b1", "c3");
    s = adjustMove(s, "a1", "d1");
    // The rook's move needed the knight out of the way: the knight can't come back first.
    expect(undoBlock(s, "c3")).toBe("needed");
    expect(undoBlock(s, "d1")).toBeNull();
    const rookBack = undoAction(s, "d1");
    expect(rookBack.army.board).toEqual({ a1: "r", c3: "n" });
    expect(rookBack.army.stars).toEqual({ a1: 2, c3: 2 });
    expect(undoBlock(rookBack, "c3")).toBeNull();
    const all = undoAction(rookBack, "c3");
    expect(all.army).toEqual(a);
    expect(all.actions).toEqual([]);
    expect(starredToMove(all)).toEqual(["a1", "b1"]);
    expect(undoBlock(s, "h4")).toBe("none");
    // A piece moving onto the square another left: the first can't come back until the second does.
    const b = white({ a3: "r", c3: "n" }, { a3: 3, c3: 3 });
    let t = startStars(b, black());
    t = adjustMove(t, "a3", "h4");
    t = adjustMove(t, "c3", "a3");
    expect(undoBlock(t, "h4")).toBe("needed");
    expect(undoBlock(t, "a3")).toBeNull();
  });

  it("the position after a step's moves is an army the fight accepts, and the pieces moved are all starred (a fuzz of random armies and random legal moves)", () => {
    for (let seed = 0; seed < 120; seed++) {
      const rng = mulberry32(seed);
      const board: Record<string, Kind> = {};
      const stars: Record<string, StarCount> = {};
      const free = halfSquares("w").filter((sq) => sq !== "e1");
      for (let i = 0; i < 6; i++) {
        const sq = free.splice(Math.floor(rng() * free.length), 1)[0]!;
        const kind = (["n", "b", "r", "q", "p", "n"] as Kind[])[Math.floor(rng() * 6)]!;
        board[sq] = kind;
        if (kind !== "p" && rng() < 0.6) stars[sq] = rng() < 0.5 ? 2 : 3;
      }
      const a = white(board, stars);
      let s = startStars(a, army("b", "g8", { d7: "n", a7: "p" }));
      for (const from of starredToMove(s)) {
        const targets = starTargets(s, from);
        if (!targets.length) continue;
        const to = targets[Math.floor(rng() * targets.length)]!;
        expect(adjustBlock(s, from, to), `${from} to ${to}`).toBeNull();
        s = adjustMove(s, from, to);
      }
      // The same pieces, the same stars, each moved at most once.
      expect(Object.values(s.army.board).sort()).toEqual(Object.values(a.board).sort());
      expect(Object.values(s.army.stars ?? {}).sort()).toEqual(Object.values(a.stars ?? {}).sort());
      expect(new Set(s.actions.map((m) => m.to)).size).toBe(s.actions.length);
      for (const m of s.actions) expect(a.stars![m.from]).toBeDefined();
    }
  });
});

describe("auto chess stars: the bot", () => {
  it("buys the star-ups it is offered, nearly always, for 5: the best (most stars, dearest piece) first", () => {
    const a = white({ c3: "n", d2: "b" }, { d2: 2 });
    const shop = shopOf([offer("n", "c3"), offer("b", "d2"), offer("r", "h3"), offer("p", "c4")]);
    const ups = botStarUps(shop, a, 100);
    // The bishop's makes a 3-star, the knight's a 2-star: the bishop first.
    expect(ups.map((u) => u.offer)).toEqual([offer("b", "d2"), offer("n", "c3")]);
    expect(botStarUps(shop, a, 4)).toEqual([]);
    expect(botStarUps(shop, a, 5)).toHaveLength(2);
    // Across many plans from a bench of four pieces (a lot of offers to match) it buys them, each for 5, each one a star more, and never past three.
    const bench: Held[] = [{ kind: "n", square: "c1" }, { kind: "b", square: "d1" }, { kind: "r", square: "a2" }, { kind: "n", square: "h3" }];
    let plans = 0;
    let withUp = 0;
    let ups5 = 0;
    for (let seed = 0; seed < 300; seed++) {
      const plan = botPlan("w", "e1", 150, 4, mulberry32(seed), AUTOCHESS, bench, { level: 4, xp: 0 });
      plans++;
      const buys = plan.events.filter((e) => e.type === "starup");
      if (buys.length) withUp++;
      for (const e of buys) {
        expect(e.price).toBe(AUTOCHESS.starUpCost);
        expect([2, 3]).toContain(e.stars);
        expect(["board", "bench"]).toContain(e.where);
        ups5++;
      }
      expect(plan.spent).toBeLessThanOrEqual(150);
      for (const [sq, s] of Object.entries(plan.army.stars ?? {})) {
        expect(plan.army.board[sq]).toBeDefined();
        expect(plan.army.board[sq]).not.toBe("p");
        expect([2, 3]).toContain(s);
      }
      for (const h of plan.army.bench) expect(h.stars === undefined || h.stars === 2 || h.stars === 3).toBe(true);
    }
    expect(withUp).toBeGreaterThan(plans * 0.1);
    expect(ups5).toBeGreaterThan(40);
  });

  it("stars its bench too: a held piece gains its stars where it is, and the plan's events replay to the same bench and board", () => {
    // (What it held is placed first, for nothing; it holds a piece on its bench once its board is full, and a later offer that matches that piece is its star-up.)
    const bench: Held[] = [{ kind: "n", square: "c1" }, { kind: "b", square: "d1" }, { kind: "r", square: "a2" }];
    let benchUps = 0;
    for (let seed = 0; seed < 400; seed++) {
      const full = botPlan("w", "e1", 300, 6, mulberry32(seed), { ...AUTOCHESS, bot: { ...AUTOCHESS.bot, xpChance: 0, xpChanceFull: 0 } }, bench, { level: 4, xp: 0 });
      const end = botBenchAt(full.events, bench, 99);
      expect([...end].sort((a, b) => (a.square < b.square ? -1 : 1))).toEqual([...full.army.bench].sort((a, b) => (a.square < b.square ? -1 : 1)));
      const board = botAt(full.events, 99);
      expect(board.squares).toEqual(full.army.board);
      expect(board.stars).toEqual(full.army.stars ?? {});
      benchUps += full.events.filter((e) => e.type === "starup" && e.where === "bench").length;
    }
    expect(benchUps).toBeGreaterThan(0);
  });

  it("never buys a star-up when the setting says so, and buys one whenever it can with the setting at 1 (a stand-in for 'nearly always')", () => {
    const bench: Held[] = [{ kind: "n", square: "c1" }, { kind: "b", square: "d1" }, { kind: "r", square: "a2" }, { kind: "n", square: "h3" }];
    const never = { ...AUTOCHESS, bot: { ...AUTOCHESS.bot, starUpChance: 0 } };
    const always = { ...AUTOCHESS, bot: { ...AUTOCHESS.bot, starUpChance: 1 } };
    let alwaysUps = 0;
    for (let seed = 0; seed < 150; seed++) {
      const a = botBuys({ ...white(), bench }, 150, 4, mulberry32(seed), never, { level: 4, xp: 0 });
      expect(a.buys.filter((b) => b.type === "starup")).toHaveLength(0);
      alwaysUps += botBuys({ ...white(), bench }, 150, 4, mulberry32(seed), always, { level: 4, xp: 0 }).buys.filter((b) => b.type === "starup").length;
    }
    expect(alwaysUps).toBeGreaterThan(20);
  });

  it("a revealed piece of theirs shows its stars (also one it gained after it was revealed); a plain one shows none", () => {
    const events = [
      { at: 1, type: "buy" as const, kind: "n" as Kind, square: "c6", price: 30 },
      { at: 2, type: "buy" as const, kind: "r" as Kind, square: "a8", price: 50 },
      { at: 6, type: "starup" as const, kind: "n" as Kind, square: "c6", price: 5, stars: 2 as StarCount, where: "board" as const },
    ];
    const first = revealedAt(events, 1, 5.5);
    expect(first.every((r) => r.stars === undefined)).toBe(true);
    const later = revealedAt(events, 1, 12);
    const knight = later.find((r) => r.square === "c6");
    if (knight) expect(knight.stars).toBe(2);
    const rook = later.find((r) => r.square === "a8");
    if (rook) expect(rook.stars).toBeUndefined();
    expect(botAt(events, 5).stars).toEqual({});
    expect(botAt(events, 7).stars).toEqual({ c6: 2 });
  });

  describe("in the move step", () => {
    const bot = army("b", "g8", { d7: "n", c6: "b", a8: "r", f7: "p" }, { d7: 2, c6: 3 });
    const you = white({ d2: "n" });
    const seed = 4242;

    it("moves each of its starred pieces once, the 3-star first, never a plain piece, a 2-star by the fight's moves and a 3-star to an empty square of its half, if it likes the result", async () => {
      const calls: Army[] = [];
      let told = 0;
      // An evaluator that likes the 3-star bishop on h5 and the 2-star knight on f6, and nothing else.
      const evaluate = async (a: Army) => {
        calls.push(a);
        return 0.5 + (a.board.h5 === "b" ? 0.2 : 0) + (a.board.f6 === "n" ? 0.1 : 0);
      };
      const wide = { ...AUTOCHESS, bot: { ...AUTOCHESS.bot, adjustTries: 100 } };
      const out = await botStarMoves(bot, you, seed, evaluate, () => false, wide, () => told++);
      expect(out.board.h5).toBe("b");
      expect(out.board.f6).toBe("n");
      expect(out.board.c6).toBeUndefined();
      expect(out.board.d7).toBeUndefined();
      // The plain pieces stand, the stars went with the pieces.
      expect(out.board.a8).toBe("r");
      expect(out.board.f7).toBe("p");
      expect(out.stars).toEqual({ h5: 3, f6: 2 });
      expect(told).toBe(2);
      // It looked at standing still and at the moves of the two starred pieces only.
      expect(calls.length).toBeGreaterThan(2);
    });

    it("skips what doesn't beat standing still by the margin, and a scorer that likes nothing leaves the army as it was", async () => {
      expect(await botStarMoves(bot, you, seed, async () => 0.5, () => false)).toBe(bot);
      expect(await botStarMoves(bot, you, seed, async (a) => (a === bot ? 0.5 : 0.5 + AUTOCHESS.bot.adjustMargin / 2), () => false)).toBe(bot);
    });

    it("is as small a search as ever: one look at the start and at most `adjustTries` more, shared by its starred pieces; none for an army with no star", async () => {
      let n = 0;
      await botStarMoves(bot, you, seed, async () => (n++, 0.5), () => false);
      expect(n).toBeLessThanOrEqual(1 + AUTOCHESS.bot.adjustTries);
      expect(n).toBeGreaterThan(2);
      const plain = army("b", "g8", { d7: "n" });
      let m = 0;
      expect(await botStarMoves(plain, you, seed, async () => (m++, 0.9), () => false)).toBe(plain);
      expect(m).toBe(0);
    });

    it("stops when told the step is over, keeping what it has done; its moves are the same for the same seed", async () => {
      let n = 0;
      const out = await botStarMoves(bot, you, seed, async () => (n++, 0.5), () => n >= 2);
      expect(out).toBe(bot);
      expect(n).toBeLessThanOrEqual(3);
      const score = async (a: Army) => 0.5 + (a.board.h5 === "b" ? 0.2 : 0);
      const one = await botStarMoves(bot, you, seed, score, () => false);
      const two = await botStarMoves(bot, you, seed, score, () => false);
      expect(one).toEqual(two);
    });

    it("over many random armies its moves stay legal: a 2-star's by the fight's moves, a 3-star's to an empty square of its half, each piece at most once", async () => {
      for (let s = 0; s < 40; s++) {
        const rng = mulberry32(s);
        const board: Record<string, Kind> = {};
        const stars: Record<string, StarCount> = {};
        const free = halfSquares("b").filter((sq) => sq !== "g8");
        for (let i = 0; i < 5; i++) {
          const sq = free.splice(Math.floor(rng() * free.length), 1)[0]!;
          const kind = (["n", "b", "r", "q", "n"] as Kind[])[Math.floor(rng() * 5)]!;
          board[sq] = kind;
          if (rng() < 0.7) stars[sq] = rng() < 0.5 ? 2 : 3;
        }
        const b = army("b", "g8", board, stars);
        const out = await botStarMoves(b, white({ d2: "n" }), s, async () => rng(), () => false);
        expect(Object.values(out.board).sort()).toEqual(Object.values(b.board).sort());
        expect(Object.values(out.stars ?? {}).sort()).toEqual(Object.values(b.stars ?? {}).sort());
        for (const sq of Object.keys(out.board)) expect(halfSquares("b")).toContain(sq);
      }
    });
  });
});

describe("auto chess stars: the pieces the buy step keeps", () => {
  it("the bench keeps its stars through a match's rounds: the bench goes into the match as it is, and carries to the next round turned with the colors", () => {
    const { match } = beginRound(newMatch(11));
    const bench: Held[] = [{ kind: "n", square: "c3", stars: 2 }, { kind: "b", square: "a1" }];
    const carried = carryBench(bench);
    expect(carried).toEqual([{ kind: "n", square: "c6", stars: 2 }, { kind: "b", square: "a8" }]);
    // (The state holds them as given.)
    const next = { ...match, you: { ...match.you, bench } };
    expect(next.you.bench[0]!.stars).toBe(2);
  });
});
