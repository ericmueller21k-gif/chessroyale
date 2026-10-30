import { describe, expect, it } from "vitest";
import { RANKED_1V1, rankView } from "@chessroyale/core";
import { emblemHash, emblemRows } from "../../../scripts/bake-emblems.ts";
import { RANK_SET } from "../src/characters/rank-set.ts";
import { EMBLEMS, EMBLEM_HASH, EMBLEM_SHEET, EMBLEM_SIZE } from "../src/emblems/rank-emblems.ts";
import { rankFromSwitch } from "../src/ranked.ts";

/** Ranked 1 v 1's emblems (Oct 28): the baked sheet is Eric's drawing, and every rank has its emblem in it. */
describe("the rank emblems", () => {
  it("the baked sheet is the drawing as drawn (scripts/bake-emblems.ts), every frame's pixels", () => {
    // Stale after a change to the drawing: npx tsx scripts/bake-emblems.ts.
    expect(EMBLEM_HASH, "run npx tsx scripts/bake-emblems.ts").toBe(emblemHash(RANK_SET));
    expect([RANK_SET.w, RANK_SET.h, EMBLEM_SIZE]).toEqual([48, 48, 48]);
    expect(Object.keys(EMBLEMS)).toEqual(emblemRows().flat());
    for (const [id, c] of Object.entries(EMBLEMS)) {
      expect(c.frames, id).toBe(RANK_SET.anims[id]!.frames.length);
      expect(c.x + c.frames * EMBLEM_SIZE, id).toBeLessThanOrEqual(EMBLEM_SHEET.w);
      expect(c.y + EMBLEM_SIZE, id).toBeLessThanOrEqual(EMBLEM_SHEET.h);
    }
  });

  it("every rank shows an emblem of its own: each tier's divisions a still, the top two a 2 s loop of 8 frames", () => {
    const seen = new Set<string>();
    for (let ladder = 0; ladder < 2800; ladder++) {
      const v = rankView({ games: 9, ladder });
      expect(EMBLEMS[v.emblem!], v.label).toMatchObject({ frames: 1 });
      seen.add(v.emblem!);
    }
    expect(seen.size).toBe(RANKED_1V1.tiers.length * RANKED_1V1.divisions);
    for (const place of [1, 100, 101, 500]) {
      const v = rankView({ games: 9, ladder: 3000, place });
      expect(EMBLEMS[v.emblem!], v.label).toEqual({ x: 0, y: expect.any(Number), frames: 8, ms: 250 });
    }
    // Placements (and a bot) have none: the box stays empty.
    expect(rankView(null).emblem).toBeNull();
  });

  it("an admin's ?rank=: a tier and its division (5 to 1), or a top tier; anything else ignored", () => {
    expect(rankFromSwitch("gold-3")).toMatchObject({ tier: "Gold", division: 3, label: "Gold 3 · 45 RP", emblem: "gold-d3" });
    expect(rankFromSwitch("Wood-5")).toMatchObject({ label: "Wood 5 · 45 RP", emblem: "wood-d5" });
    expect(rankFromSwitch("radiant-1")).toMatchObject({ label: "Radiant 1 · 45 RP", emblem: "radiant-d1" });
    expect(rankFromSwitch("transcendent")).toMatchObject({ tier: "Transcendent", division: null, label: "Transcendent · 120 RP", emblem: "transcendent" });
    expect(rankFromSwitch("pearlescent")).toMatchObject({ label: "Pearlescent · 120 RP", emblem: "pearlescent" });
    for (const bad of [null, "", "gold", "gold-0", "gold-6", "iron-2", "transcendent-1", "gold-3x", "master"]) expect(rankFromSwitch(bad), String(bad)).toBeNull();
  });
});
