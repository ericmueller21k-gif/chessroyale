import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { buyOffer, emptyArmy, halfSquares, heldBlock, kindBlock, placeBlock, placeHeld, squareBlock, usableSquares } from "../src/autochess/army.ts";
import { beginRound, newMatch, roundSeed } from "../src/autochess/economy.ts";
import { buyFromSlot, holdFromSlot, newShop, refillSlot, replaceTaken, rerollBlock, rerollFor, rerollShop, rerollWords, rollOffer, shopSeed, type Shop } from "../src/autochess/shop.ts";
import { KINDS, type Army, type Kind, type Offer } from "../src/autochess/types.ts";

const share = (kinds: readonly Kind[]) => Object.fromEntries(KINDS.map((k) => [k, (100 * kinds.filter((x) => x === k).length) / kinds.length])) as Record<Kind, number>;
const king = (color: "w" | "b" = "w") => emptyArmy(color, color === "w" ? "e1" : "e8");
const offer = (kind: Kind, square: string): Offer => ({ kind, square });
const shopOf = (slots: Offer[]): Shop => ({ slots, rerolls: 0, refills: 0 });

describe("auto chess: the shop (v6)", () => {
  it("holds the design's numbers: 5 offers, pawn 75% knight 10% bishop 8% rook 5% queen 2%, a reroll for 2, prices unchanged", () => {
    expect(AUTOCHESS.shop).toEqual({ slots: 5, odds: { p: 75, n: 10, b: 8, r: 5, q: 2 }, rerollCost: 2 });
    expect(Object.values(AUTOCHESS.shop.odds).reduce((a, b) => a + b, 0)).toBe(100);
    expect(AUTOCHESS.prices).toEqual({ p: 10, n: 30, b: 32, r: 50, q: 90 });
  });

  it("rolls pieces at the odds, over many rolls (single rolls, and the offers of many seeded shops)", () => {
    const rng = mulberry32(12345);
    const rolled = Array.from({ length: 40000 }, () => rollOffer(rng, king())!.kind);
    for (const k of KINDS) expect(Math.abs(share(rolled)[k] - AUTOCHESS.shop.odds[k]), `${k} rolled`).toBeLessThan(1);
    const slots = Array.from({ length: 6000 }, (_, seed) => newShop(shopSeed(seed), king()).slots.map((o) => o.kind)).flat();
    expect(slots).toHaveLength(30000);
    for (const k of KINDS) expect(Math.abs(share(slots)[k] - AUTOCHESS.shop.odds[k]), `${k} in shops`).toBeLessThan(1);
    // The odds are a setting: all queens when the setting says so.
    const queens = { ...AUTOCHESS, shop: { ...AUTOCHESS.shop, odds: { p: 0, n: 0, b: 0, r: 0, q: 1 } } };
    expect(newShop(7, king(), queens).slots.map((o) => o.kind)).toEqual(["q", "q", "q", "q", "q"]);
  });

  it("every offer is on a square you could use: empty, your half, not your king's; pawns on your 2nd to 4th rank only", () => {
    for (const color of ["w", "b"] as const) {
      const a: Army = { ...king(color), board: color === "w" ? { a2: "p", c3: "n", d1: "q" } : { a7: "p", c6: "n", d8: "q" } };
      for (let seed = 0; seed < 400; seed++) {
        for (const o of newShop(seed, a).slots) {
          expect(squareBlock(a, o.kind, o.square), `${o.kind} ${o.square}`).toBeNull();
          expect(halfSquares(color)).toContain(o.square);
          if (o.kind === "p") expect(color === "w" ? ["2", "3", "4"] : ["7", "6", "5"]).toContain(o.square[1]);
        }
      }
    }
    // Pieces other than pawns are rolled anywhere on the half: over many rolls every square of an empty half shows up, the back rank too.
    const seen = new Set<string>();
    const rng = mulberry32(3);
    for (let i = 0; i < 4000; i++) seen.add(rollOffer(rng, king(), { ...AUTOCHESS, shop: { ...AUTOCHESS.shop, odds: { p: 0, n: 1, b: 0, r: 0, q: 0 } } })!.square);
    expect(seen.size).toBe(31);
  });

  it("only what the legal-position limits allow is offered: with 8 pawns no pawn, with a queen no second queen; the others keep their odds", () => {
    const eight: Army = { ...king(), board: { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", h3: "p" } };
    const rng = mulberry32(9);
    const kinds = Array.from({ length: 6000 }, () => rollOffer(rng, eight)!.kind);
    expect(kinds).not.toContain("p");
    expect(kindBlock(eight, "p")).toBe("pawns");
    const withQueen: Army = { ...king(), board: { d1: "q" } };
    const rng2 = mulberry32(10);
    const after = Array.from({ length: 6000 }, () => rollOffer(rng2, withQueen)!.kind);
    expect(after).not.toContain("q");
    // (The odds of the others, renormalized: pawn 75 of 98.)
    expect(Math.abs(share(after).p - (75 / 98) * 100)).toBeLessThan(2);
  });

  it("a round's shop has 5 offers and is the same for the same seed; another round shows another shop", () => {
    const a = newShop(shopSeed(99), king());
    expect(a.slots).toHaveLength(5);
    expect(a).toEqual(newShop(shopSeed(99), king()));
    let differs = 0;
    for (let seed = 0; seed < 100; seed++) {
      const m1 = beginRound(newMatch(seed)).match;
      const m2 = beginRound(m1).match;
      expect(newShop(shopSeed(roundSeed(m1)), king()).slots).toHaveLength(5);
      if (JSON.stringify(newShop(shopSeed(roundSeed(m1)), king()).slots) !== JSON.stringify(newShop(shopSeed(roundSeed(m2)), king()).slots)) differs++;
    }
    expect(differs).toBeGreaterThan(95);
  });

  it("buying an offer puts the piece on its square, takes the price, rolls a new offer into that slot only, and is repeatable", () => {
    const army = king();
    const shop = shopOf([offer("p", "a3"), offer("n", "c3"), offer("r", "h1"), offer("p", "d4"), offer("q", "d1")]);
    const bought = buyFromSlot({ army, gold: 100, shop }, 1, 5);
    if ("block" in bought) throw new Error("should buy");
    expect(bought.army.board).toEqual({ c3: "n" });
    expect(bought.gold).toBe(70);
    expect(bought.replaced).toBe(0);
    expect(bought.shop.slots).toHaveLength(5);
    // Only slot 1 changed, and its new offer isn't on the bought square.
    expect(bought.shop.slots.filter((_, i) => i !== 1)).toEqual([offer("p", "a3"), offer("r", "h1"), offer("p", "d4"), offer("q", "d1")]);
    expect(bought.shop.slots[1]!.square).not.toBe("c3");
    expect(buyFromSlot({ army, gold: 100, shop }, 1, 5)).toEqual(bought);
    // Buying the same slot again rolls again (the refill count moves the seed on): over many buys it isn't always the same offer.
    let s = shop;
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      s = refillSlot(s, 0, 5, army);
      seen.add(`${s.slots[0]!.kind}${s.slots[0]!.square}`);
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(s.refills).toBe(40);
    // An offer you can't buy stays as it is, with the usual reason.
    expect(buyFromSlot({ army, gold: 60, shop }, 4, 5)).toEqual({ block: "gold" });
    expect(buyFromSlot({ army: { ...army, board: { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", h3: "p" } }, gold: 500, shop: shopOf([offer("p", "a2")]) }, 0, 5)).toEqual({ block: "pawns" });
    expect(buyFromSlot({ army: { ...army, board: { d2: "q" } }, gold: 500, shop }, 4, 5)).toEqual({ block: "queen" });
  });

  it("holding an offer pays, puts the piece on the bench with its square, rolls a new offer into the slot, and leaves other offers on that square alone", () => {
    const army = king();
    const shop = shopOf([offer("p", "c2"), offer("b", "c2"), offer("r", "h1"), offer("p", "d4"), offer("n", "g3")]);
    const held = holdFromSlot({ army, gold: 100, shop }, 1, 77);
    if ("block" in held) throw new Error("should hold");
    expect(held.gold).toBe(68);
    expect(held.army.bench).toEqual([offer("b", "c2")]);
    expect(held.army.board).toEqual({});
    expect(held.shop.slots).toHaveLength(5);
    // Only slot 1 changed (nothing stands on c2, so the pawn offered there is still good).
    expect(held.shop.slots.filter((_, i) => i !== 1)).toEqual([offer("p", "c2"), offer("r", "h1"), offer("p", "d4"), offer("n", "g3")]);
    expect(holdFromSlot({ army, gold: 100, shop }, 1, 77)).toEqual(held);
    // The bench's reasons: gold, a full bench, the limits (a held queen is the one queen).
    expect(holdFromSlot({ army, gold: 20, shop }, 1, 77)).toEqual({ block: "gold" });
    const full = { ...army, bench: [offer("p", "a2"), offer("p", "b2"), offer("p", "e2"), offer("p", "f2")] };
    expect(holdFromSlot({ army: full, gold: 100, shop }, 1, 77)).toEqual({ block: "bench" });
    expect(holdFromSlot({ army: { ...army, bench: [offer("q", "d1")] }, gold: 500, shop: shopOf([offer("q", "d2")]) }, 0, 77)).toEqual({ block: "queen" });
    // What is held counts as owned when the shop rolls: with a queen on the bench no queen is offered.
    const withQueen = { ...army, bench: [offer("q", "d1")] };
    for (let seed = 0; seed < 300; seed++) for (const o of newShop(seed, withQueen).slots) expect(o.kind).not.toBe("q");
    // A bought offer has no hold left to give: a full board still takes a hold.
    const fullBoard: Army = { ...army, board: { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", h3: "p", b1: "n", g1: "n" } };
    expect(buyFromSlot({ army: fullBoard, gold: 100, shop }, 1, 77)).toEqual({ block: "limit" });
    expect(holdFromSlot({ army: fullBoard, gold: 100, shop }, 1, 77)).toMatchObject({ gold: 68 });
  });

  it("an offer whose square gets taken is replaced by a new roll (not greyed), and the new offers are usable", () => {
    const army = king();
    // Two offers on c2 (a pawn and a bishop): buying one takes the square, so the other rolls again.
    const shop = shopOf([offer("p", "c2"), offer("b", "c2"), offer("r", "h1"), offer("p", "d4"), offer("n", "g3")]);
    const bought = buyFromSlot({ army, gold: 100, shop }, 0, 77);
    if ("block" in bought) throw new Error("should buy");
    expect(bought.army.board).toEqual({ c2: "p" });
    expect(bought.replaced).toBe(1);
    expect(bought.shop.slots).toHaveLength(5);
    expect(bought.shop.slots.map((o) => o.square)).not.toContain("c2");
    // The ones that weren't on c2 stayed.
    expect([bought.shop.slots[2], bought.shop.slots[3], bought.shop.slots[4]]).toEqual([offer("r", "h1"), offer("p", "d4"), offer("n", "g3")]);
    for (const o of bought.shop.slots) expect(squareBlock(bought.army, o.kind, o.square)).toBeNull();
    expect(replaceTaken(bought.shop, 77, bought.army).replaced).toBe(0);
    // Three on one square: two replaced.
    const three = shopOf([offer("p", "c2"), offer("b", "c2"), offer("r", "c2"), offer("p", "d4"), offer("n", "g3")]);
    const b3 = buyFromSlot({ army, gold: 100, shop: three }, 2, 5);
    if ("block" in b3) throw new Error("should buy");
    expect(b3.replaced).toBe(2);
    expect(b3.shop.slots.map((o) => o.square)).not.toContain("c2");
  });

  it("a reroll costs 2 for all five offers, is refused under 2, and is seeded by the reroll count", () => {
    const army = king();
    const shop = newShop(shopSeed(3), army);
    const next = rerollFor({ gold: 12, shop, army }, shopSeed(3));
    if ("block" in next) throw new Error("should reroll");
    expect(next.gold).toBe(10);
    expect(next.shop.slots).toHaveLength(5);
    expect(next.shop.rerolls).toBe(1);
    expect(rerollFor({ gold: 12, shop, army }, shopSeed(3))).toEqual(next);
    expect(rerollFor({ gold: 1, shop, army }, shopSeed(3))).toEqual({ block: "gold" });
    expect(rerollFor({ gold: 2, shop, army }, shopSeed(3))).toMatchObject({ gold: 0 });
    expect(rerollBlock(1)).toBe("gold");
    expect(rerollBlock(2)).toBeNull();
    expect(rerollWords(1)).toBe("Not enough gold: a reroll costs 2 and you have 1.");
    // Each reroll shows a different roll of all the offers.
    let changed = 0;
    for (let seed = 0; seed < 200; seed++) {
      const a = newShop(seed, army);
      const b = rerollShop(a, seed, army);
      const c = rerollShop(b, seed, army);
      const key = (s: Shop) => JSON.stringify(s.slots);
      if (key(a) !== key(b) && key(b) !== key(c)) changed++;
    }
    expect(changed).toBeGreaterThan(190);
    // A reroll after buys starts the refill count over.
    const bought = refillSlot(shop, 2, shopSeed(3), army);
    expect(rerollShop(bought, shopSeed(3), army).refills).toBe(0);
    expect(rerollShop(bought, shopSeed(3), army)).toEqual(rerollShop(shop, shopSeed(3), army));
  });

  it("the shop refills free at each round's start: new offers, and gold only from the round's income", () => {
    const m1 = beginRound(newMatch(21)).match;
    expect(m1.you.gold).toBe(100);
    const m2 = beginRound(m1).match;
    // (Gold: the saved 100 + 10 interest + 120 income; the new shop cost nothing.)
    expect(m2.you.gold).toBe(100 + 10 + 120);
    expect(newShop(shopSeed(roundSeed(m2)), king("b")).slots).toHaveLength(5);
  });

  it("buying everything it can leaves only legal armies: never past the pawn, queen or square rules (a fuzz of a few hundred buys)", () => {
    for (let seed = 0; seed < 60; seed++) {
      let army = king();
      let shop = newShop(seed, army);
      let gold = 1000;
      for (let i = 0; i < 12; i++) {
        const rng = mulberry32(seed * 100 + i);
        const slot = Math.floor(rng() * shop.slots.length);
        const bought = buyFromSlot({ army, gold, shop }, slot, seed);
        if ("block" in bought) {
          if (bought.block === "limit") break;
          continue;
        }
        expect(placeBlock(army, shop.slots[slot]!.kind, shop.slots[slot]!.square)).toBeNull();
        ({ army, gold, shop } = bought);
        expect(Object.keys(army.board).length).toBeLessThanOrEqual(AUTOCHESS.levels.max);
      }
      expect(Object.values(army.board).filter((k) => k === "q").length).toBeLessThanOrEqual(1);
      expect(Object.values(army.board).filter((k) => k === "p").length).toBeLessThanOrEqual(8);
    }
    expect(buyOffer(king(), offer("p", "a2")).board).toEqual({ a2: "p" });
  });
});

describe("auto chess: one offer to a square (Eric, Oct 21: 'pieces should never be duplicate on one spot')", () => {
  const squares = (shop: Shop) => shop.slots.map((o) => o.square);
  /** The whole rule, after any change: five offers, each on its own square, on a square you could use (so not your pieces', not your king's). */
  const expectOneEach = (shop: Shop, army: Army, where: string) => {
    expect(shop.slots, `${where}: a full shop`).toHaveLength(AUTOCHESS.shop.slots);
    expect(new Set(squares(shop)).size, `${where}: ${squares(shop)}`).toBe(shop.slots.length);
    for (const o of shop.slots) expect(usableSquares(army, o.kind), `${where}: ${o.kind} ${o.square}`).toContain(o.square);
  };

  it("no two offers share a square: over many seeds, rounds, rerolls, buys, holds and placings, for either color and from a bare board to a full one", () => {
    const starts: Army[] = [
      king(),
      king("b"),
      { ...king(), board: { a2: "p", b2: "p", c2: "n", d1: "q", h4: "r" } },
      { ...king("b"), board: { a7: "p", b7: "p", c7: "n", d8: "q", h5: "r" } },
    ];
    let steps = 0;
    for (const [n, start] of starts.entries()) {
      for (let seed = 0; seed < 220; seed++) {
        const shopSeed0 = shopSeed(seed * 7919 + n);
        let army = start;
        let shop = newShop(shopSeed0, army);
        expectOneEach(shop, army, `seed ${seed}, first roll`);
        const rng = mulberry32(seed * 31 + n);
        for (let i = 0; i < 24; i++) {
          const roll = rng();
          if (roll < 0.15) {
            // A reroll (more than one in a row now and then).
            shop = rerollShop(shop, shopSeed0, army);
            expectOneEach(shop, army, `seed ${seed}, reroll`);
          } else if (roll < 0.75) {
            // A buy onto the board: the slot refills and anything that can't use its square rolls again.
            const bought = buyFromSlot({ army, gold: 1000, shop }, Math.floor(rng() * shop.slots.length), shopSeed0);
            if ("block" in bought) continue;
            ({ army, shop } = bought);
            expectOneEach(shop, army, `seed ${seed}, buy`);
          } else if (roll < 0.9) {
            // A hold: the offer waits on the bench with its square.
            const held = holdFromSlot({ army, gold: 1000, shop }, Math.floor(rng() * shop.slots.length), shopSeed0);
            if ("block" in held) continue;
            ({ army, shop } = held);
            expectOneEach(shop, army, `seed ${seed}, hold`);
          } else if (army.bench.length) {
            // A held piece placed on its square: any offer on it rolls again.
            const index = Math.floor(rng() * army.bench.length);
            if (heldBlock(army, index)) continue;
            army = placeHeld(army, index);
            shop = replaceTaken(shop, shopSeed0, army).shop;
            expectOneEach(shop, army, `seed ${seed}, a held piece placed`);
          }
          steps++;
        }
      }
    }
    expect(steps).toBeGreaterThan(10000);
  });

  it("the roll draws its square from those free of the other offers: with every other square taken it is the last one, and a kind with none free gives way to another", () => {
    const army = king();
    const usable = usableSquares(army, "n");
    const taken = new Set(usable.slice(1));
    for (let seed = 0; seed < 50; seed++) {
      const only = { ...AUTOCHESS, shop: { ...AUTOCHESS.shop, odds: { p: 0, n: 1, b: 0, r: 0, q: 0 } } };
      expect(rollOffer(mulberry32(seed), army, only, taken)).toEqual({ kind: "n", square: usable[0] });
    }
    // Every square of the half is taken: nothing can be offered.
    const only = { ...AUTOCHESS, shop: { ...AUTOCHESS.shop, odds: { p: 0, n: 1, b: 0, r: 0, q: 0 } } };
    expect(rollOffer(mulberry32(1), army, only, new Set(usable))).toBeNull();
    expect(rollOffer(mulberry32(1), army, AUTOCHESS, new Set(usable))).toBeNull();
    // Every square a pawn could take is taken (ranks 2 to 4): no pawn is offered, the others are, on the squares left (the back rank).
    const pawnSquares = new Set(usableSquares(army, "p"));
    for (let seed = 0; seed < 300; seed++) {
      const o = rollOffer(mulberry32(seed), army, AUTOCHESS, pawnSquares)!;
      expect(o).not.toBeNull();
      expect(o.kind).not.toBe("p");
      expect(pawnSquares.has(o.square)).toBe(false);
      expect(o.square[1]).toBe("1");
    }
  });

  it("a shop that was built with two offers on one square is put right by replaceTaken (the later one rolls again), and one with none changes nothing", () => {
    const army = king();
    const doubled = shopOf([offer("p", "c2"), offer("b", "c2"), offer("r", "h1"), offer("p", "d4"), offer("n", "d4")]);
    const fixed = replaceTaken(doubled, 11, army);
    expect(fixed.replaced).toBe(2);
    expect(fixed.from).toEqual(["c2", "d4"]);
    expectOneEach(fixed.shop, army, "after replaceTaken");
    // The earlier offer of each pair, and the one that wasn't doubled, stayed.
    expect([fixed.shop.slots[0], fixed.shop.slots[2], fixed.shop.slots[3]]).toEqual([offer("p", "c2"), offer("r", "h1"), offer("p", "d4")]);
    const fine = shopOf([offer("p", "c2"), offer("b", "d2"), offer("r", "h1"), offer("p", "d4"), offer("n", "g3")]);
    expect(replaceTaken(fine, 11, army)).toEqual({ shop: fine, replaced: 0, from: [] });
  });

  it("the squares an offer is rolled for are as evenly spread as ever: a pawn lands on each of its 24 squares about as often (the first roll, and a refill beside four others)", () => {
    const only = { ...AUTOCHESS, shop: { ...AUTOCHESS.shop, odds: { p: 1, n: 0, b: 0, r: 0, q: 0 } } };
    const army = king();
    const counts = new Map<string, number>();
    const N = 6000;
    for (let seed = 0; seed < N; seed++) {
      const shop = refillSlot(newShop(seed, army, only), 2, seed, army, only);
      expectOneEach(shop, army, `seed ${seed}`);
      const o = shop.slots[2]!;
      counts.set(o.square, (counts.get(o.square) ?? 0) + 1);
    }
    // (Ranks 2 to 4, minus the king's e1 which isn't among them: 24 squares, each 1/24 of 6000 = 250, give or take.)
    expect(counts.size).toBe(24);
    for (const [square, n] of counts) expect(Math.abs(n - N / 24), square).toBeLessThan(70);
  });

  it("an offer rolled where nothing else was keeps its roll: a first shop with no doubled square is the shop of old (so seeded fixtures hold where nothing collided)", () => {
    const army = king();
    let same = 0;
    let collided = 0;
    for (let seed = 0; seed < 600; seed++) {
      // The roll as it was before: five offers one after another from the round's stream, squares drawn from every usable one.
      const rng = mulberry32((seed ^ Math.imul(1, 0x9e3779b1) ^ Math.imul(1, 0x85ebca6b)) >>> 0);
      const old = Array.from({ length: 5 }, () => rollOffer(rng, army)!);
      if (new Set(old.map((o) => o.square)).size < 5) {
        collided++;
        continue;
      }
      expect(newShop(seed, army).slots, `seed ${seed}`).toEqual(old);
      same++;
    }
    // (About a third of first shops had two offers on a square: those are the ones that change.)
    expect(collided).toBeGreaterThan(100);
    expect(same).toBeGreaterThan(300);
  });
});

