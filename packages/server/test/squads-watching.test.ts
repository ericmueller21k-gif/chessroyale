import { beforeEach, describe, expect, it } from "vitest";
import { FRONT_DOOR, SQUADS, SQUADS_LOBBY } from "@chessroyale/core";
import { SQUADS_PROTOCOL, squadsVotes } from "@chessroyale/chess/squads";
import { clearTopCache } from "../src/squads-lobby.ts";
import { squadsLobby } from "./squads-fixture.ts";

/**
 * Who's watching (Eric, Oct 14; docs/areas/squads.md, "The server"): each screen says which board it shows full size
 * (`view`, only when it changes) and hears who's on that board ("viewers") when that changes, at most once every
 * SQUADS_LOBBY.watching.coalesceMs. Joining, switching, nobody, disconnecting, coming back, leaving, a burst of
 * switches, views that name no board, and an app that never says.
 */

const VOTES_MS = FRONT_DOOR.fillShowMs + squadsVotes().length * (SQUADS.voteSeconds + SQUADS.voteResultSeconds) * 1000;
const WINDOW = SQUADS_LOBBY.watching.coalesceMs;

beforeEach(() => clearTopCache());

/** A test lobby at round 1 with three people (and 29 bots), its first half begun, every inbox empty. */
function relay() {
  const L = squadsLobby({ seed: 3, test: { start: 0 }, fillInMs: 5_000 });
  const [a, b, c] = ["Ann", "Bo", "Cy"].map((n) => L.join(n));
  L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
  expect(L.core.allMatches().filter((m) => m.state === "half")).toHaveLength(4);
  L.clear();
  return { L, a: a!, b: b!, c: c! };
}

describe("squads lobby: who's watching", () => {
  it("a screen hears who's on the board it shows at once; the others there hear it come and go; a screen elsewhere hears nothing", () => {
    const { L, a, b, c } = relay();
    L.core.message(a, { t: "view", key: "r0m0", board: 1 });
    expect(L.all(a, "viewers")).toEqual([expect.objectContaining({ boards: { "r0m0/1": [a] }, full: true })]);
    expect(L.all(b, "viewers")).toEqual([]);
    // Within the window: nothing more yet; then one message each.
    L.advance(100);
    L.core.message(b, { t: "view", key: "r0m0", board: 1 });
    expect(L.all(b, "viewers")).toEqual([]);
    L.advance(WINDOW);
    expect(L.last(b, "viewers")).toMatchObject({ boards: { "r0m0/1": [a, b] }, full: true });
    expect(L.last(a, "viewers")!.boards).toEqual({ "r0m0/1": [a, b] });
    expect(L.last(a, "viewers")!.full).toBeUndefined();
    // Ann moves to another board: hers whole; Bo hears she's gone.
    L.advance(WINDOW);
    L.core.message(a, { t: "view", key: "r0m2", board: 3 });
    expect(L.last(a, "viewers")).toMatchObject({ boards: { "r0m2/3": [a] }, full: true });
    expect(L.last(b, "viewers")!.boards).toEqual({ "r0m0/1": [b] });
    // The same board again: nothing. No board (the results): nothing to anyone (nobody else is on hers).
    L.advance(WINDOW);
    const before = L.all(a, "viewers").length + L.all(b, "viewers").length;
    L.core.message(a, { t: "view", key: "r0m2", board: 3 });
    L.core.message(a, { t: "view", key: null });
    L.advance(WINDOW);
    expect(L.all(a, "viewers").length + L.all(b, "viewers").length).toBe(before);
    expect(L.all(c, "viewers")).toEqual([]);
    // Nothing due: no alarm for it.
    expect(L.core.record.viewsDirty).toEqual([]);
    expect(L.core.record.viewsFresh).toEqual([]);
  });

  it("a burst of switches (people tapping, or a client spamming) is at most one message a window to anyone, ending where they ended", () => {
    const { L, a, b, c } = relay();
    L.core.message(c, { t: "view", key: "r0m1", board: 1 });
    L.advance(WINDOW);
    L.clear();
    const start = L.now;
    // 50 switches each from two people over 2 s (one every 40 ms), through Cy's board and others.
    for (let i = 0; i < 50; i++) {
      L.core.message(a, { t: "view", key: `r0m${i % 4}`, board: i % 4 });
      L.core.message(b, { t: "view", key: `r0m${(i + 1) % 4}`, board: (i + 2) % 4 });
      L.advance(40);
    }
    L.advance(WINDOW);
    for (const id of [a, b, c]) {
      const got = L.all(id, "viewers");
      expect(got.length).toBeLessThanOrEqual(Math.ceil((L.now - start) / WINDOW) + 1);
      for (let i = 1; i < got.length; i++) expect(got[i]!.now - got[i - 1]!.now).toBeGreaterThanOrEqual(WINDOW);
      // Small: one board's ids.
      for (const m of got) expect(Object.keys(m.boards)).toHaveLength(1);
    }
    // Where they ended (i = 49): Ann on r0m1/1, with Cy; Bo on r0m2/3. Cy's last word on her board says so.
    expect(L.last(c, "viewers")!.boards).toEqual({ "r0m1/1": [a, c] });
    expect(L.last(a, "viewers")!.boards).toEqual({ "r0m1/1": [a, c] });
    expect(L.last(b, "viewers")!.boards).toEqual({ "r0m2/3": [b] });
  });

  it("a view that names no board counts as none; only people view (bots never send it)", () => {
    const { L, a, b } = relay();
    L.core.message(b, { t: "view", key: "r0m0", board: 2 });
    L.core.message(a, { t: "view", key: "r0m0", board: 2 });
    for (const bad of [
      { key: "r9m9", board: 0 },
      { key: "r0m0", board: 4 },
      { key: "r0m0", board: 1.5 },
      { key: "r0m0", board: "2" },
      { key: 7, board: 0 },
    ]) {
      L.advance(WINDOW);
      L.core.message(a, { t: "view", ...(bad as object) } as never);
      expect(L.core.record.views?.[a]).toBeUndefined();
      L.advance(WINDOW);
      expect(L.last(b, "viewers")!.boards).toEqual({ "r0m0/2": [b] });
      // (Back on the board for the next case.)
      L.core.message(a, { t: "view", key: "r0m0", board: 2 });
    }
    L.advance(WINDOW);
    const bots = new Set(L.core.record.bots.map((x) => x.id));
    for (const m of L.all(b, "viewers")) for (const ids of Object.values(m.boards)) expect(ids.some((id) => bots.has(id))).toBe(false);
    expect(Object.keys(L.core.record.views ?? {}).sort()).toEqual([a, b].sort());
  });

  it("a viewer who disconnects drops out; back, the screen says again what it shows and hears it whole; one who leaves drops out", () => {
    const { L, a, b, c } = relay();
    for (const id of [a, b, c]) L.core.message(id, { t: "view", key: "r0m1", board: 0 });
    L.advance(WINDOW);
    expect(L.last(c, "viewers")!.boards).toEqual({ "r0m1/0": [a, b, c] });
    L.core.disconnect(a);
    L.advance(WINDOW);
    expect(L.last(c, "viewers")!.boards).toEqual({ "r0m1/0": [b, c] });
    // Back (a reload): nothing until the screen says what it shows, then that board whole.
    const token = L.core.record.humans.find((h) => h.id === a)!.token;
    L.clear(a);
    expect(L.core.connect(token, { v: SQUADS_PROTOCOL })).toEqual({ ok: true, playerId: a });
    expect(L.all(a, "viewers")).toEqual([]);
    L.core.message(a, { t: "view", key: "r0m1", board: 0 });
    L.advance(WINDOW);
    expect(L.last(a, "viewers")).toMatchObject({ boards: { "r0m1/0": [a, b, c] }, full: true });
    expect(L.last(c, "viewers")!.boards).toEqual({ "r0m1/0": [a, b, c] });
    // Leaving for good (resigning): gone from the board.
    L.core.message(b, { t: "leave" });
    L.advance(WINDOW);
    expect(L.last(c, "viewers")!.boards).toEqual({ "r0m1/0": [a, c] });
    expect(L.core.record.views?.[b]).toBeUndefined();
  });

  it("an app that never says what it shows is never shown watching, hears nothing of it, and still plays", () => {
    const { L, a, b, c } = relay();
    L.core.message(b, { t: "view", key: "r0m0", board: 0 });
    L.advance(30_000);
    expect(L.all(a, "viewers")).toEqual([]);
    expect(L.all(c, "viewers")).toEqual([]);
    expect(Object.keys(L.core.record.views ?? {})).toEqual([b]);
    expect(L.all(a, "half").length).toBeGreaterThan(0);
  });
});
