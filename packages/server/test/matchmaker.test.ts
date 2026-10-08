import { describe, expect, it } from "vitest";
import { MATCHMAKING } from "@chessroyale/core";
import { Matchmaker, queueName, type PlayAnswer } from "../src/matchmaker.ts";
import { openLobbyCode, randomCode } from "../src/codes.ts";
import { QueueCore, regionOf, type MatchRules, type QueueConfig } from "../src/queue.ts";

/**
 * "Play now": tickets seated in batches, never a used code, never an overfilled lobby, and a surge past the
 * admission rate or the overload limit told "busy, you're in line" (DECISIONS.md, "Capacity: built").
 */

/**
 * Lobbies by code. Codes are random, so the first `inUse` codes tried stand for lobbies that are still open (a match,
 * or its results): creating one again is refused. Each lobby has `size` seats and gives out reservations.
 */
function lobbies(inUse: number, size = 100) {
  const open = new Map<string, { joinable: boolean; seats: number; auto?: { fillAt: number | null; botsOff?: boolean }; hurried?: number }>();
  const tried: string[] = [];
  let calls = 0;
  const ns = {
    idFromName: (name: string) => name,
    get: (code: string) => ({
      async create(c: string, _o: unknown, auto?: { fillAt: number | null; botsOff?: boolean; reserve?: number }) {
        calls++;
        tried.push(c);
        if (tried.length <= inUse || open.has(c)) return false;
        const give = Math.min(auto?.reserve ?? 0, size);
        open.set(c, { joinable: true, seats: give, auto: auto && { fillAt: auto.fillAt, botsOff: auto.botsOff } });
        return auto?.reserve ? give : true;
      },
      async hurry(at: number) {
        calls++;
        open.get(code)!.hurried = at;
      },
      async joinable() {
        return open.get(code)?.joinable ?? false;
      },
      async reserve(n: number) {
        calls++;
        const l = open.get(code);
        if (!l?.joinable) return 0;
        const give = Math.min(n, size - l.seats);
        l.seats += give;
        return give;
      },
    }),
  };
  return { open, tried, ns, calls: () => calls };
}

class TestMatchmaker extends Matchmaker {
  constructor(ctx: DurableObjectState, env: never, q?: QueueCore, rules?: MatchRules) {
    super(ctx, env);
    this.holdMs = 60;
    if (q) this.q = q;
    if (rules) this.rules = rules;
  }
}

function matchmaker(ns: unknown, opts: { q?: QueueCore; players?: number; rules?: MatchRules } = {}) {
  const store = new Map<string, unknown>();
  const ctx = {
    storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => void store.set(k, v) },
    blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn(),
  };
  const live = opts.players === undefined ? undefined : { idFromName: () => "g", get: () => ({ players: async () => opts.players }) };
  return new TestMatchmaker(ctx as unknown as DurableObjectState, { LOBBIES: ns, LIVE: live } as never, opts.q, opts.rules);
}

const codeOf = (a: PlayAnswer) => ("code" in a ? a.code : null);
const cfg = (patch: Partial<QueueConfig> = {}): QueueConfig => ({ admitPerSecond: 300, admitBurst: 600, ticketTtlMs: 15_000, placedKeepMs: 60_000, retryMs: 3_000, maxPlayers: 20_000, ...patch });

describe("matchmaker", () => {
  it("never hands out a code whose lobby is still open: it tries another", async () => {
    const L = lobbies(2);
    const mm = matchmaker(L.ns);
    const code = codeOf(await mm.next({}, 60_000))!;
    expect(L.tried).toHaveLength(3);
    expect(code).toBe(L.tried[2]);
    expect(L.open.get(code)).toMatchObject({ joinable: true, seats: 1 });
    // The next player joins the same lobby while it fills.
    expect(codeOf(await mm.next({}, 60_000))).toBe(code);
    expect(L.tried).toHaveLength(3);
    // Once it can't take more, the next player gets a new lobby (never the old code).
    L.open.get(code)!.joinable = false;
    const next = codeOf(await mm.next({}, 60_000));
    expect(next).not.toBe(code);
  });

  it("a surge of 250 at once: seated in batches, 100 a lobby, never more, a handful of calls", async () => {
    const L = lobbies(0);
    const mm = matchmaker(L.ns);
    const answers = await Promise.all(Array.from({ length: 250 }, () => mm.next({}, 60_000)));
    const per = new Map<string, number>();
    for (const a of answers) per.set(codeOf(a)!, (per.get(codeOf(a)!) ?? 0) + 1);
    expect([...per.values()].sort((a, b) => b - a)).toEqual([100, 100, 50]);
    for (const [code, n] of per) expect(L.open.get(code)!.seats).toBe(n);
    // One call for the first player's lobby, then a few per batch: not one (or two) per player.
    expect(L.calls()).toBeLessThan(15);
  });

  it("a seat freed in the filling lobby (someone cancelled) goes to the next player", async () => {
    const L = lobbies(0, 3);
    const mm = matchmaker(L.ns);
    const first = await Promise.all([mm.next({}, 60_000), mm.next({}, 60_000), mm.next({}, 60_000)]);
    const code = codeOf(first[0]!)!;
    expect(first.every((a) => codeOf(a) === code)).toBe(true);
    L.open.get(code)!.seats--;
    expect(codeOf(await mm.next({}, 60_000))).toBe(code);
    expect(codeOf(await mm.next({}, 60_000))).not.toBe(code);
  });

  it("past the admission rate: busy, in line with a ticket, about N s; asking again keeps the place, then a seat", async () => {
    const L = lobbies(0);
    const q = new QueueCore(cfg({ admitPerSecond: 0.001, admitBurst: 2 }), Date.now());
    const mm = matchmaker(L.ns, { q });
    const answers = await Promise.all(Array.from({ length: 5 }, () => mm.next({}, 60_000)));
    const seated = answers.filter((a) => "code" in a);
    const busy = answers.filter((a): a is Extract<PlayAnswer, { busy: true }> => "busy" in a);
    expect(seated).toHaveLength(2);
    expect(busy).toHaveLength(3);
    expect(busy.map((b) => b.position).sort()).toEqual([1, 2, 3]);
    for (const b of busy) {
      expect(b.message).toBe(`Servers are busy, you're in line: about ${b.waitSeconds} s`);
      expect(b.waitSeconds).toBeGreaterThanOrEqual(5);
      expect(b.retryMs).toBeGreaterThan(0);
    }
    // Asking again with the ticket keeps the place in line.
    const again = await mm.next({}, 60_000, {}, busy[2]!.ticket);
    expect("busy" in again && again.ticket).toBe(busy[2]!.ticket);
  });

  it("past the overload limit: nobody new is let in until people finish; players already seated are unaffected", async () => {
    const L = lobbies(0);
    const full = matchmaker(L.ns, { players: 20_000 });
    const a = await full.next({}, 60_000);
    expect("busy" in a && a.busy).toBe(true);
    expect(L.calls()).toBe(0);
    const fine = matchmaker(L.ns, { players: 19_000 });
    expect(codeOf(await fine.next({}, 60_000))).toMatch(/^[A-Z2-9]{5}$/);
  });

  it("matching rules (ranked's hook): groups never share a lobby; tickets left out wait", async () => {
    const L = lobbies(0);
    const rules: MatchRules = {
      group: (tickets) => [
        { key: "low", tickets: tickets.filter((t) => (t.info?.skill as number) < 1500) },
        { key: "high", tickets: tickets.filter((t) => (t.info?.skill as number) >= 1500 && (t.info?.skill as number) < 2500) },
      ],
    };
    const mm = matchmaker(L.ns, { rules });
    const [a, b, c, d] = await Promise.all([1200, 1800, 1300, 2600].map((skill) => mm.next({}, 60_000, {}, null, { skill })));
    expect(codeOf(a!)).toBe(codeOf(c!));
    expect(codeOf(b!)).not.toBe(codeOf(a!));
    expect("busy" in d!).toBe(true);
  });

  it("one queue per mode and type: Default and Bots off never share a lobby", () => {
    const names = [queueName("crowd", "default"), queueName("crowd", "botsoff"), queueName("raid", "default"), queueName("raid", "botsoff")];
    expect(new Set(names).size).toBe(4);
    expect(queueName("crowd", "botsoff", "tests-1")).toBe("crowd-botsoff-tests-1");
    // A pool that isn't a plain name is ignored.
    expect(queueName("crowd", "default", "../x")).toBe("crowd-default");
  });

  it("Bots off: a 50 v 50 lobby has no fill time (it waits until full); a raid's minute is when it may begin with enough people", async () => {
    const L = lobbies(0);
    const t0 = Date.now();
    const crowd = codeOf(await matchmaker(L.ns).next({}, 60_000, { botsOff: true, crowdWaitsForFull: true }))!;
    expect(L.open.get(crowd)!.auto).toEqual({ fillAt: null, botsOff: true });
    const raid = codeOf(await matchmaker(L.ns).next({}, 60_000, { botsOff: true }))!;
    expect(L.open.get(raid)!.auto!.botsOff).toBe(true);
    expect(L.open.get(raid)!.auto!.fillAt).toBeGreaterThanOrEqual(t0 + 60_000);
  });

  it("Bots off → Default keeps your wait: bots fill a minute after you first joined (into a new lobby, or the one filling)", async () => {
    const L = lobbies(0);
    const mm = matchmaker(L.ns);
    const now = Date.now();
    // Waited 40 s: a new Default lobby fills in about 20 s.
    const a = codeOf(await mm.next({}, 60_000, { since: now - 40_000 }))!;
    const at = L.open.get(a)!.auto!.fillAt!;
    expect(at).toBeGreaterThanOrEqual(now + 19_000);
    expect(at).toBeLessThanOrEqual(Date.now() + 21_000);
    // Someone else switching while it fills: it's told to fill a minute after their start.
    await mm.next({}, 60_000, { since: now - 300_000 });
    expect(L.open.get(a)!.hurried).toBe(now - 300_000 + 60_000);
    // Waited ages, new lobby: soon, but not at once.
    L.open.get(a)!.joinable = false;
    const b = codeOf(await mm.next({}, 60_000, { since: now - 600_000 }))!;
    expect(L.open.get(b)!.auto!.fillAt! - Date.now()).toBeGreaterThan(MATCHMAKING.switchMinWaitMs - 1000);
  });

  it("openLobbyCode: skips codes in use, gives up after its tries", async () => {
    const inUse = new Set(["AAAAA", "BBBBB"]);
    const codes = ["AAAAA", "BBBBB", "CCCCC", "DDDDD"];
    const made: string[] = [];
    const create = async (c: string) => (inUse.has(c) ? false : (made.push(c), inUse.add(c), true));
    let i = 0;
    expect(await openLobbyCode(create, 5, () => codes[i++]!)).toBe("CCCCC");
    expect(made).toEqual(["CCCCC"]);
    i = 0;
    expect(await openLobbyCode(create, 3, () => codes[i++]!)).toBeNull();
    expect(made).toEqual(["CCCCC"]);
    expect(randomCode()).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
  });
});

describe("the queue (pure)", () => {
  it("admits at the rate, oldest first; the rest keep their places and are told about how long", () => {
    let now = 0;
    let n = 0;
    const q = new QueueCore(cfg({ admitPerSecond: 10, admitBurst: 10 }), now, () => `t${++n}`);
    const ts = Array.from({ length: 25 }, () => q.enqueue(null, now));
    expect(q.admit(now, 0)[0]!.tickets.map((t) => t.id)).toEqual(ts.slice(0, 10).map((t) => t.id));
    expect(q.position("t11")).toBe(1);
    expect(q.estimateSeconds("t25", now, 0)).toBe(5); // 15th in line at 10 a second: 1.5 s, shown as about 5
    now += 500;
    expect(q.admit(now, 0)[0]!.tickets).toHaveLength(5);
    // Asking again keeps the place.
    expect(q.enqueue("t16", now).id).toBe("t16");
    expect(q.position("t16")).toBe(1);
  });

  it("a ticket nobody asks about expires; a placed one is remembered for a retry", () => {
    let now = 0;
    let n = 0;
    const q = new QueueCore(cfg({ admitPerSecond: 1, admitBurst: 1, ticketTtlMs: 10_000 }), now, () => `t${++n}`);
    q.enqueue(null, now);
    q.enqueue(null, now);
    const [g] = q.admit(now, 0);
    q.place(g!.tickets, "ABCDE", now);
    expect(q.placedIn("t1")).toBe("ABCDE");
    now += 11_000;
    expect(q.admit(now, 0)).toEqual([]);
    expect(q.waiting).toBe(0);
    expect(q.placedIn("t1")).toBe("ABCDE");
    now += 60_000;
    q.expire(now);
    expect(q.placedIn("t1")).toBeUndefined();
  });

  it("at the player cap nobody is admitted; the estimate follows how fast people actually got in", () => {
    let n = 0;
    const q = new QueueCore(cfg({ maxPlayers: 100 }), 0, () => `t${++n}`);
    for (let i = 0; i < 30; i++) q.enqueue(null, 0);
    expect(q.admit(0, 95)[0]!.tickets).toHaveLength(5);
    expect(q.admit(1, 100)).toEqual([]);
    // 5 got in during the last minute: 25th in line → about 300 s.
    expect(q.estimateSeconds("t30", 2, 100)).toBe(300);
  });

  it("queue names: per mode and type, a test pool, and a region only when that's on", () => {
    expect(queueName("crowd", "default")).toBe("crowd-default");
    expect(queueName("raid", "default", "e2e-a")).toBe("raid-default-e2e-a");
    expect(queueName("crowd", "default", "Bad Pool!")).toBe("crowd-default");
    expect(regionOf({ continent: "EU" })).toBeNull();
    expect(regionOf({ continent: "EU" }, true)).toBe("EU");
    expect(queueName("crowd", "botsoff", null, regionOf({ continent: "EU" }, true))).toBe("crowd-botsoff@EU");
    expect(regionOf({ continent: "XX" }, true)).toBeNull();
  });
});
