import { describe, expect, it, vi } from "vitest";
import { CAPACITY, rankView } from "@chessroyale/core";
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

  it("putBack: only tickets still being seated go back, in order (one placed keeps its seat; one back in line or dropped is left)", () => {
    const q = new QueueCore(cfg(), T0, nextId);
    const [a, b, c, d] = ["a", "b", "c", "d"].map((u, i) => q.enqueue(null, T0 + i, info(u, 1500)));
    const groups = q.admit(T0 + 10, 0, PAIR_BY_RATING);
    expect(groups.map((g) => g.tickets.map((t) => t.info?.uid))).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    q.place([a!], "GAME1", T0 + 11);
    q.forget([d!]);
    q.putBack(groups.flatMap((g) => g.tickets));
    // (Again: already in line, so nothing changes.)
    q.putBack([b!, c!]);
    expect(q.waiting).toBe(2);
    expect([q.position(b!.id), q.position(c!.id)]).toEqual([1, 2]);
    expect(q.placedIn(a!.id)).toBe("GAME1");
    expect(q.position(a!.id)).toBe(0);
    expect(q.known(d!.id)).toBe(false);
  });

  it("an account's first ask while its ticket is being seated (its other device) is that ticket: never a second one to pair", () => {
    const q = new QueueCore(cfg(), T0, nextId);
    const a = q.enqueue(null, T0, { ...info("a", 1500), device: "phone" });
    q.enqueue(null, T0, info("b", 1500));
    const [g] = q.admit(T0, 0, PAIR_BY_RATING);
    expect(q.enqueue(null, T0 + 1, { ...info("a", 1500), device: "computer" }).id).toBe(a.id);
    expect(q.waiting).toBe(0);
    // The seating fails: one ticket for the account back in line, not two.
    q.putBack(g!.tickets);
    expect(q.enqueue(null, T0 + 2, { ...info("a", 1500), device: "computer" }).id).toBe(a.id);
    expect(q.waiting).toBe(2);
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

/**
 * Games by code: each create succeeds unless its code is taken. The first `throws` creates throw instead, as a call to
 * an object that's being reset does.
 */
function duels(throws = 0) {
  const made = new Map<string, { w: DuelPlayerView; b: DuelPlayerView; testSeconds: number | null }>();
  const D = { made, ns: {} as unknown, calls: 0 };
  D.ns = {
    idFromName: (name: string) => name,
    get: (code: string) => ({
      async create(c: string, players: { w: DuelPlayerView; b: DuelPlayerView }, opts: { testSeconds?: number | null }) {
        if (++D.calls <= throws) throw new Error("Durable Object reset because its code was updated.");
        if (made.has(c)) return false;
        made.set(c, { ...players, testSeconds: opts.testSeconds ?? null });
        return true;
      },
    }),
  };
  return D;
}

class TestMatchmaker extends Matchmaker {
  constructor(ctx: DurableObjectState, env: never, q?: QueueCore) {
    super(ctx, env);
    this.holdMs = 60;
    if (q) this.q = q;
  }
}

function matchmaker(ns: unknown, q?: QueueCore) {
  const store = new Map<string, unknown>();
  const ctx = {
    storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => void store.set(k, v) },
    blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn(),
  };
  return new TestMatchmaker(ctx as unknown as DurableObjectState, { DUELS: ns } as never, q);
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

  it("a game whose opening throws: the pair is back in line at once, in order and still known; their next asks get one game", async () => {
    const D = duels(1);
    const q = new QueueCore(cfg(), Date.now());
    const mm = matchmaker(D.ns, q);
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ann = await mm.duelNext(null, info("ann", 1500));
    const [annAgain, bob] = await Promise.all([mm.duelNext(ticketOf(ann)), mm.duelNext(null, info("bob", 1500))]);
    logged.mockRestore();
    expect(D.calls).toBe(1);
    expect(D.made.size).toBe(0);
    // Still searching (never stuck "being seated" for a minute), Ann first as she queued first.
    expect(annAgain).toMatchObject({ searching: true, ticket: ticketOf(ann) });
    expect(bob).toMatchObject({ searching: true });
    expect([q.position(ticketOf(ann)), q.position(ticketOf(bob))]).toEqual([1, 2]);
    expect(q.known(ticketOf(ann)) && q.known(ticketOf(bob))).toBe(true);
    const both = await Promise.all([mm.duelNext(ticketOf(ann)), mm.duelNext(ticketOf(bob))]);
    const codes = both.map((a) => ("code" in a ? a.code : null));
    expect(codes[0]).toBeTruthy();
    expect(codes[1]).toBe(codes[0]);
    expect(D.made.size).toBe(1);
    const g = D.made.get(codes[0]!)!;
    expect([g.w.uid, g.b.uid].sort()).toEqual(["ann", "bob"]);
  });

  it("a throw on a batch's first pair puts back the pairs after it too, never left being seated; then each pair gets its game", async () => {
    const D = duels(1);
    const q = new QueueCore(cfg(), Date.now());
    const mm = matchmaker(D.ns, q);
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const first = await Promise.all([info("ann", 1500), info("bob", 1500), info("cat", 2000), info("dan", 2000)].map((p) => mm.duelNext(null, p)));
    logged.mockRestore();
    expect(D.calls).toBe(1);
    for (const a of first) expect(a).toMatchObject({ searching: true });
    // (All four in line again; pressed in the same millisecond, their order is the pairing's.)
    expect(first.map((a) => q.position(ticketOf(a))).sort()).toEqual([1, 2, 3, 4]);
    const again = await Promise.all(first.map((a) => mm.duelNext(ticketOf(a))));
    const codes = again.map((a) => ("code" in a ? a.code : null));
    expect(codes[0]).toBe(codes[1]);
    expect(codes[2]).toBe(codes[3]);
    expect(codes[0]).not.toBe(codes[2]);
    expect(D.made.size).toBe(2);
  });

  it("a game that always throws: tried again about once a second, never at once; every ask still answered within its hold", async () => {
    vi.useFakeTimers();
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const D = duels(Infinity);
      const mm = matchmaker(D.ns);
      const annP = mm.duelNext(null, info("ann", 1500));
      await vi.advanceTimersByTimeAsync(100);
      const ann = await annP;
      const pair = Promise.all([mm.duelNext(ticketOf(ann)), mm.duelNext(null, info("bob", 1500))]);
      await vi.advanceTimersByTimeAsync(100);
      for (const a of await pair) expect(a).toMatchObject({ searching: true });
      expect(D.calls).toBe(1);
      // Nobody asks for 5 s: the batch is tried again once every CAPACITY.queue.formEveryMs (a second).
      await vi.advanceTimersByTimeAsync(5_000);
      expect(D.calls).toBe(1 + Math.floor(5_200 / CAPACITY.queue.formEveryMs));
      // Asking again: searching, within the hold, with the same tickets.
      const asks = Promise.all([mm.duelNext(ticketOf(ann)), mm.duelNext(null, info("bob", 1500))]);
      await vi.advanceTimersByTimeAsync(100);
      const [a, b] = await asks;
      expect(a).toMatchObject({ searching: true, ticket: ticketOf(ann) });
      expect(b).toMatchObject({ searching: true });
      expect(D.made.size).toBe(0);
    } finally {
      logged.mockRestore();
      vi.useRealTimers();
    }
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
