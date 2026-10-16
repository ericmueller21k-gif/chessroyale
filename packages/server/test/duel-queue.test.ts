import { describe, expect, it } from "vitest";
import { rankView } from "@chessroyale/core";
import type { DuelPlayerView } from "@chessroyale/chess/duel";
import { Matchmaker, type DuelPlayAnswer } from "../src/matchmaker.ts";
import { PAIR_BY_RATING, QueueCore, queueName, type QueueConfig } from "../src/queue.ts";

/**
 * Ranked 1 v 1's queue (queue.ts PAIR_BY_RATING, the Matchmaker's duel mode): pairs by the hidden rating with the
 * range widening as they wait, an account in line once, Cancel, "still looking" answers, and each pair's own game.
 */

const cfg = (patch: Partial<QueueConfig> = {}): QueueConfig => ({ admitPerSecond: 300, admitBurst: 600, ticketTtlMs: 15_000, placedKeepMs: 60_000, retryMs: 3_000, maxPlayers: 20_000, ...patch });
const T0 = 1_800_000_000_000;
let ids = 0;
const nextId = () => `t${++ids}`;
const info = (uid: string, rating: number, rd?: number) => ({ uid, rating, ...(rd === undefined ? {} : { rd }), player: { uid, name: uid, look: null, rank: rankView(null) } satisfies DuelPlayerView });

describe("pairing in the queue (PAIR_BY_RATING)", () => {
  it("close ratings pair at once; far ones only once the range has widened; the rest keep their place", () => {
    const q = new QueueCore(cfg(), T0, nextId);
    const a = q.enqueue(null, T0, info("a", 1500));
    const b = q.enqueue(null, T0, info("b", 1800));
    expect(q.admit(T0, 0, PAIR_BY_RATING)).toEqual([]);
    expect(q.waiting).toBe(2);
    // (They keep asking, as the app does: a ticket nobody asks about expires.)
    q.enqueue(a.id, T0 + 12_000);
    q.enqueue(b.id, T0 + 12_000);
    // 300 apart: in range after (300 - 100) / 10 = 20 s.
    expect(q.admit(T0 + 19_000, 0, PAIR_BY_RATING)).toEqual([]);
    const groups = q.admit(T0 + 20_000, 0, PAIR_BY_RATING);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.tickets.map((t) => t.info?.uid)).toEqual(["a", "b"]);
    expect(q.waiting).toBe(0);
  });

  it("uncertain ratings (each ticket's rd) meet sooner: 300 apart with deviations near 300 pair at once", () => {
    const q = new QueueCore(cfg(), T0, nextId);
    q.enqueue(null, T0, info("a", 1500, 290));
    q.enqueue(null, T0, info("b", 1800, 60));
    expect(q.admit(T0, 0, PAIR_BY_RATING)).toHaveLength(1);
  });

  it("an account is in line once: a second press (another tab) is the same ticket, never paired with itself", () => {
    const q = new QueueCore(cfg(), T0, nextId);
    const t1 = q.enqueue(null, T0, info("a", 1500));
    const t2 = q.enqueue(null, T0 + 10, info("a", 1500));
    expect(t2.id).toBe(t1.id);
    expect(q.waiting).toBe(1);
    expect(q.admit(T0 + 600_000, 0, PAIR_BY_RATING)).toEqual([]);
  });

  it("Cancel takes the ticket out of line (a paired one answers its game)", () => {
    const q = new QueueCore(cfg(), T0, nextId);
    const t = q.enqueue(null, T0, info("a", 1500));
    expect(q.cancel(t.id)).toBeUndefined();
    expect(q.waiting).toBe(0);
    const u = q.enqueue(null, T0, info("b", 1500));
    q.place([u], "GAMEX", T0);
    expect(q.cancel(u.id)).toBe("GAMEX");
  });

  it("a ticket being seated is known (an ask waits for it) until it's placed, put back or forgotten", () => {
    const q = new QueueCore(cfg(), T0, nextId);
    const a = q.enqueue(null, T0, info("a", 1500));
    const b = q.enqueue(null, T0, info("b", 1500));
    const [g] = q.admit(T0, 0, PAIR_BY_RATING);
    expect(g!.tickets).toHaveLength(2);
    expect(q.known(a.id)).toBe(true);
    // An ask meanwhile is that ticket, not a new one in line.
    expect(q.enqueue(a.id, T0 + 1).id).toBe(a.id);
    expect(q.waiting).toBe(0);
    q.place([g!.tickets[0]!], "ABCDE", T0 + 2);
    expect(q.placedIn(g!.tickets[0]!.id)).toBe("ABCDE");
    q.putBack([g!.tickets[1]!]);
    expect(q.waiting).toBe(1);
    q.enqueue(null, T0, info("c", 1500));
    const [h] = q.admit(T0 + 3, 0, PAIR_BY_RATING);
    expect(h!.tickets.map((t) => t.id)).toContain(b.id);
    q.forget(h!.tickets);
    expect(h!.tickets.some((t) => q.known(t.id))).toBe(false);
  });

  it("a ticket without its player is never paired (and two accounts on one device never meet)", () => {
    const q = new QueueCore(cfg(), T0, nextId);
    q.enqueue(null, T0, info("a", 1500));
    q.enqueue(null, T0, { uid: "b", rating: 1500 });
    q.enqueue(null, T0, { rating: 1500 });
    expect(q.admit(T0, 0, PAIR_BY_RATING)).toEqual([]);
    const d = new QueueCore(cfg(), T0, nextId);
    d.enqueue(null, T0, { ...info("a", 1500), device: "dev1" });
    d.enqueue(null, T0, { ...info("b", 1500), device: "dev1" });
    expect(d.admit(T0, 0, PAIR_BY_RATING)).toEqual([]);
    d.enqueue(null, T0, { ...info("c", 1500), device: "dev2" });
    expect(d.admit(T0, 0, PAIR_BY_RATING)).toHaveLength(1);
  });

  it("its own queue name", () => {
    expect(queueName("ranked1v1", "default")).toBe("ranked1v1-default");
    expect(queueName("ranked1v1", "default", "e2e-1")).toBe("ranked1v1-default-e2e-1");
  });
});

/** Games by code: each create succeeds unless its code is taken. */
function duels() {
  const made = new Map<string, { w: DuelPlayerView; b: DuelPlayerView; testSeconds: number | null }>();
  const ns = {
    idFromName: (name: string) => name,
    get: (code: string) => ({
      async create(c: string, players: { w: DuelPlayerView; b: DuelPlayerView }, opts: { testSeconds?: number | null }) {
        if (made.has(c)) return false;
        made.set(c, { ...players, testSeconds: opts.testSeconds ?? null });
        return true;
      },
    }),
  };
  return { made, ns };
}

class TestMatchmaker extends Matchmaker {
  constructor(ctx: DurableObjectState, env: never) {
    super(ctx, env);
    this.holdMs = 60;
  }
}

function matchmaker(ns: unknown) {
  const store = new Map<string, unknown>();
  const ctx = {
    storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => void store.set(k, v) },
    blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn(),
  };
  return new TestMatchmaker(ctx as unknown as DurableObjectState, { DUELS: ns } as never);
}

const ticketOf = (a: DuelPlayAnswer) => ("ticket" in a ? a.ticket! : "");

describe("the Matchmaker's 1 v 1 queue", () => {
  it("alone: still looking (with the ticket); a second player close in rating: both get the same game, its players from the tickets", async () => {
    const D = duels();
    const mm = matchmaker(D.ns);
    const first = await mm.duelNext(null, info("ann", 1500));
    expect(first).toMatchObject({ searching: true });
    const both = await Promise.all([mm.duelNext(ticketOf(first)), mm.duelNext(null, { ...info("bob", 1550), testSeconds: 9 })]);
    const codes = both.map((a) => ("code" in a ? a.code : null));
    expect(codes[0]).toBeTruthy();
    expect(codes[1]).toBe(codes[0]);
    const g = D.made.get(codes[0]!)!;
    expect([g.w.uid, g.b.uid].sort()).toEqual(["ann", "bob"]);
    expect(g.testSeconds).toBe(9);
  });

  it("a ticket asked about after it went (a phone asleep past its time, or one made up) is expired: never a new, empty ticket", async () => {
    const D = duels();
    const mm = matchmaker(D.ns);
    const first = await mm.duelNext(null, info("ann", 1500));
    expect(first).toMatchObject({ searching: true });
    const realNow = Date.now;
    const t0 = Date.now();
    Date.now = () => t0 + 20_000;
    try {
      // Bob arrives 20 s later; Ann's ticket, unasked-about, goes as the queue forms.
      const bob = await mm.duelNext(null, info("bob", 1500));
      expect(bob).toMatchObject({ searching: true });
      // Ann's app wakes and asks with her old ticket: expired (her app asks afresh, with her player).
      expect(await mm.duelNext(ticketOf(first))).toEqual({ expired: true });
      // A made-up ticket, or a first ask without the player: the same.
      expect(await mm.duelNext("anything8")).toEqual({ expired: true });
      expect(await mm.duelNext(null, { uid: "eve", rating: 1500 })).toEqual({ expired: true });
      expect(D.made.size).toBe(0);
      // Asking afresh, she meets Bob.
      const again = await Promise.all([mm.duelNext(null, info("ann", 1500)), mm.duelNext(ticketOf(bob))]);
      expect(again[0]).toMatchObject({ code: expect.any(String) });
      const g = [...D.made.values()][0]!;
      expect([g.w.uid, g.b.uid].sort()).toEqual(["ann", "bob"]);
    } finally {
      Date.now = realNow;
    }
  });

  it("an ask while its pair's game is being opened waits for it: the same game, never expired", async () => {
    // A create that waits until released: the moment between the pairing and the game being open.
    const made = new Map<string, { w: DuelPlayerView; b: DuelPlayerView }>();
    let release: (() => void) | null = null;
    let entered: () => void = () => {};
    const inCreate = new Promise<void>((r) => (entered = r));
    const ns = {
      idFromName: (n: string) => n,
      get: () => ({
        async create(c: string, players: { w: DuelPlayerView; b: DuelPlayerView }) {
          entered();
          await new Promise<void>((r) => (release = r));
          made.set(c, players);
          return true;
        },
      }),
    };
    const mm = matchmaker(ns);
    const ann = await mm.duelNext(null, info("ann", 1500));
    expect(ann).toMatchObject({ searching: true });
    const bobP = mm.duelNext(null, info("bob", 1500));
    await inCreate;
    // Ann's app asks again with her ticket in that moment.
    const annP = mm.duelNext(ticketOf(ann));
    await new Promise((r) => setTimeout(r, 5));
    release!();
    const [bob, annAgain] = await Promise.all([bobP, annP]);
    expect(annAgain).not.toEqual({ expired: true });
    expect(annAgain).toMatchObject({ code: expect.any(String), ticket: ticketOf(ann) });
    expect("code" in bob && bob.code).toBe("code" in annAgain && annAgain.code);
    expect(made.size).toBe(1);
  });

  it("Cancel: out of line, never paired after", async () => {
    const D = duels();
    const mm = matchmaker(D.ns);
    const first = await mm.duelNext(null, info("ann", 1500));
    expect(await mm.cancel(ticketOf(first))).toEqual({});
    const second = await mm.duelNext(null, info("bob", 1500));
    expect(second).toMatchObject({ searching: true });
    expect(D.made.size).toBe(0);
  });
});
