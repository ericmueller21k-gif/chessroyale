# Review: PR #1027, Ranked at the town tables (full lane, independent)

Head reviewed: `88932296` (`origin/claude/town-ranked`), diff `origin/main...origin/claude/town-ranked`. Read-only: no code changed.
CI on the head is green: `check`, `unit`, `chess`, all 15 e2e shards (`perf` is skipped in CI; the PR body has the author's local @perf run).

**Verdict: no blockers.** None of the findings shows up in normal use. Each one needs a slow hub, a rare collision, a badly timed tap
or someone acting in bad faith. S1 to S4 are worth fixing before launch, and each fix is small. Every repro below ran against this head
on the test fakes (the scratch file is in the appendix; it isn't committed anywhere else).

## Blockers

None.

## Should-fix

**S1. A watcher's messages are unthrottled and unauthenticated, so anyone can slow a ranked game's clocks.**
`packages/server/src/duel-do.ts:298` and `:306`. Every message on a `/ws?watch=1` socket wakes the game's object and is `JSON.parse`d
whatever its size. Every `hello` then builds the full view and sends it: `welcomeWatcher()` → `view()`, which calls `connected()`
twice, and each call deserializes every socket's attachment (up to 52). Clocks are timed on the server at the moment the object
handles a move, so a backlog of watcher messages ahead of a move costs the player to move.
*Failing case:* the game's code is public in the town's `tables` list, including to guests. A watcher opens a socket and sends `hello`
in a tight loop only while the victim is to move. The victim's moves queue behind thousands of welcomes and their bullet clock runs.
Repro "a watcher's messages": 500 hellos → 500 full welcomes, with no limit.
(A player could already flood their own socket with `sync`, but that socket is signed in and traceable. The watch path makes it
anonymous: up to 50 sockets per game, no account.)
*Fix (small):* for a watcher, drop any raw message longer than about 100 characters before parsing. Answer one hello per socket, or one
every few seconds. Close the socket on anything else.

**S2. The matchmaker waits on the hub inside its serial batch, so a slow hub holds up every pair behind a town pair.**
`packages/server/src/matchmaker.ts:410`. `form()` seats a batch's groups one at a time (`:213` loop), and `seatDuel` waits up to
`seatWaitMs` on `townMatch` for each pair with a town player. Every later pair in the batch waits too, town or not, and so does the
next batch (`kick` does nothing while `forming`). The hub is the single busiest object (every town beat, the live counts, chat). Its
constructor's `blockConcurrencyWhile` also reads D1, which holds every call at a cold start.
*Failing case:* the repro "a town pair's slow hub call holds back the next pair": two pairs in one batch, the first from a table, a hub
that doesn't answer. The second pair's game (neither player from the town) is made **1502 ms** after the first. With k town pairs ahead,
a pair waits up to k × 1.5 s. Once that passes `holdMs` (2.5 s), the held asks are answered "busy, you're in line" (`:136`,
`position` is 0 while seating), and the clients back off `retryMs` (3 s) before asking again. No match is lost, but the brief's bar was
"a slow or dead hub never blocks". A hub that fails fast is fine; a slow one blocks.
*Fix:* give the whole batch one deadline, set when the batch starts (`batchStart + seatWaitMs`), and have each town pair wait until
`min(answer, deadline)`. The total stall is then at most seatWaitMs per batch, not per pair. If you defer `placeAll` instead and let the
loop go on, note that `form()`'s failure path (`:219`) puts back **every** group's tickets that are still in `seating`. A deferred pair
would be put back in line and then placed as well: two games.

**S3. `closeIfDue` now awaits the hub, with no timeout, between its check and the close: a code's next game can be wiped.**
`packages/server/src/duel-do.ts:195`. Before this PR the check and the close ran with no await between them. The new last try,
`await liveHub(...).townMatchOver(...)`, sits between them, and other events run during an outgoing call.
*Failing case:* the repro "a code's next game ... is wiped":
1. A town game's `tellTown` fails, so the room's alarm at `closeAt` runs `closeIfDue` #1, which waits on the hub.
2. The matchmaker's `openLobbyCode` picks the same code. `create` → `closeIfDue` #2 → its hub call answers first, so it closes the
   old game, and `create` stores the new one (players cy and di).
3. #1 resumes and runs its `blockConcurrencyWhile` (`:200`), which sets `record = null` and calls `deleteAll`. The new game is gone:
   the players get "That game has ended", and if they were seated, the hub holds their table until the 180-minute backstop.

The collision is rare. The unbounded wait is the wider problem: with a hung hub, `create`, `exists`, `status`, `fetch`,
`webSocketMessage`, `abandon` and `delivered` all wait on it for a closing town game, including `create` inside the matchmaker's batch.
*Fix:* don't await it there. Send the last try with `this.ctx.waitUntil(...)` after the close (the code is known), or re-check
`this.record === r` after the await and bail.

**S4. Cancel during the seating window answers `{}`, and the canceled player is still handed the game: a dodge for pressing Cancel.**
`packages/server/src/queue.ts:194` and `packages/server/src/matchmaker.ts:410`. A ticket being seated is in neither the line nor
`placed`, so `cancel` returns no code and the Worker calls off nothing. The client stops, but its held ask is still out (`duel.ts`
`start` ignores the answer once stopped). `placeAll` then answers that ask, and `told()` → `delivered(uid)`. The player never connects,
so the no-show is charged as their dodge, and the other player waits out `joinSeconds`.
This bug predates the PR: the window used to be the duel object's `create` alone, tens of ms. The PR adds the hub wait for town
searches (normally ms, up to 1.5 s), and the town overlay's Cancel is the button pressed in exactly that state.
*Failing case:* the repro "Cancel pressed during the hub wait": `cancel` → `{}`, then Ann's held ask → `{code}`, and `told` contains
`CODE:ann`.
*Fix:* in `Matchmaker.cancel`, if the ticket is in `seating`, `await this.forming` first, then return `placedIn(ticket)`. The Worker
then calls `abandon`, and a player who never connected is excused, nobody's dodge (`cancelled` sets `excused`).

**S5. A refused watch is silent and retried forever.**
`packages/app/src/duel.ts:219`, and on the server `duel-do.ts:268-269`. The server refuses with 429 "Too many are watching this
game." (or 403, or an old server during a deploy). A refused WebSocket upgrade carries no reason. `duelStatus` says the game is open, so
`again()` retries with backoff (at most 8 s) for as long as the game lasts. The spectator sees the start position and "The players are
sitting down…", and is never told why ("nothing hidden"). Each retry also costs a Worker request, `stub.exists()` and a status GET.
*Fix:* accept the socket, then close it at once with its own code (for example `4029` "Too many are watching this game."). NetDuel's
watch mode shows that reason with Back to town and stops retrying.

**S6. Guests see both players' names in the spectator view (the director's call).** `packages/app/src/screens/Duel.tsx:738` and `:750`
(names in the strips, and "Ann won" / "Bo resigned."). The server sends them with no account check (`duel-do.ts:267`, `DuelView.players`).
The town's rule for guests is "outfits, no names or tags" (decision 2026-11-07-town-afk, #542), and the town chat says "Guests never get
players' lines". The town hides the names from a guest (`town-tables.ts:119`), and then the game's own socket gives them out.
*Options:* grey Spectate for a guest ("Make a free account to watch", as the chat's typing line does), or blank the names for a watcher
with no signed-in account on the server.

**S7. Tests are missing for the DuelGame object's side (`duel-do.ts`).** The hub (`town-tables.test.ts`) and `DuelCore`'s watcher feed
are tested, but the glue between them isn't:
- `tellTown`: the end tells the hub once; a failed tell is tried again on the next `persist` and at the close; `townTold` is stored.
- The watch path: 403 for a game not found from the town, 429 at `watchersMax`, any message but a hello does nothing.

`duel-do.test.ts`'s fake runtime takes these easily (see the appendix).

## Nits

- **N1.** `packages/server/src/town-tables.ts:84`. `found` looks up a seat for both players, whichever ticket searched from the town.
  Say B searches from home on the phone (the longer search) while B's computer sits idle at table 9, and A searches from table 3. The
  match is drawn at table 9. Try the town tickets' seats first: pass `town` per seat from the tickets.
- **N2.** `packages/server/src/live-hub.ts:344`. The hub keeps no word of a game that's over. If `townMatch` lands after
  `townMatchOver`, the table stays held until the backstop (repro "the hub keeps no word…"). Today this relies on RPC order. Remembering
  over codes for about `resultsKeepMinutes` would cost little.
- **N3.** `packages/core/src/settings.ts:4478`. The 180-minute backstop is far past the longest real game (rapid 10+5). A lost "over"
  hides both players from the town's walkers and holds the table for 3 hours. Consider about 90 minutes, or a sweep that asks the game's
  `status()` for claims older than an hour.
- **N4.** `settings.ts:4482`, `tableMax: 63` against the park's 20 tables. A forged seat `[40, 0]` makes a claim no client can draw
  (`applyTables` skips `TABLES[40]`), and its two players, the innocent opponent too, vanish from the town's walkers for the whole game.
  Clamp to the park's real count (move it into core) or drop such claims.
- **N5.** `found` doesn't check the other stool. A third pawn already sitting there (an old client, or a backgrounded phone) stays drawn
  on the opponent's stool for observers until its own device stands it up (`here-net.ts:137` steps off only locally).
- **N6.** `packages/server/src/duel-room.ts:132`. `joinBy` counts from `create`, before the hub wait, so up to `seatWaitMs` of the
  10-second join window is spent before the code goes out.
- **N7.** A watcher gets `left` (who dodged or left) in the game view (`duel-room.ts:199`), the penalty side of the outcome. It's
  harmless; blank it for watchers if "never outcomes" is meant strictly. Account ids go to guests in `tables[].seats[].uid`, as they
  already do in `others[].id` (`town-here.ts:156`).
- **N8.** Watcher slots per device are unbounded: one client can take all 50 of a game's, since the Worker's per-IP limit counts per
  instance.
- **N9.** Back from a Spectate longer than `enterRejoinMs` (2 minutes) posts "<name> has entered the town." again. The tower floor's
  return is exempt (`floor`, Eric, Nov 22); the director's call whether watching counts as staying in town.
- **N10.** Load: `away` → `tables.playing` loops over every claim for each entry shown, on every beat (`live-hub.ts:327`). That's fine
  at 20 tables; a per-room Set would make it O(1).

## Checked

- The whole diff: the server, protocol, settings, the app's `here-net`, `world`, `Town`, `App`, `Duel`, `duel` and `lazy`, the tests,
  the docs and the decision note.
- The unit tests run locally on the head: `town-tables.test.ts` and `duel-queue.test.ts`, 34 passed.
- Nothing a client sends can seat a game:
  - `townMatch` is reachable only from the matchmaker, as a Durable Object call.
  - A beat's `seat` places only the sender's own entry; it's validated by `readSeat` and dropped inside a shop.
  - `found` refuses a held table, a code already held, a self-pair and an out-of-range table.
  - `town=1` changes only the asker's own pairing.
- The watch socket:
  - Only for a game with `record.town`; the ban gate and the residents gate apply (Worker level).
  - `webSocketMessage` answers only a hello; `webSocketClose` ignores watchers.
  - `connected()`, the no-show and presence count only the players' sockets.
  - `post` (chat), `chatLog`, `chatNo`, `outcome` and `moveNo` go to players only; `both()` sends game, move, picks, draw and presence.
  - The view carries the visible rank only, never the hidden rating.
- A seat's lifetime: every end (a move, resign, draw, abort, no-show, flag, a called-off Cancel) sets `core.end`, then `persist`, then
  `tellTown`. A failed tell is tried again at `recorded()`'s persist and at the close. Claims survive a hub restart (storage, `restore`)
  and are swept at `matchMaxMinutes`, from their original `since`.
- Ranked results are unchanged: `takeFinished`, `recordDuel` and `withXp` read nothing new; `town` and `townTold` are fields of the
  record only; the tickets' new `pawn` and `town` are read only by `seatDuel`.
- Old clients and records: `others` is still there; `sit`, `tables` and `welcome.watch` are optional; `DUEL_PROTOCOL` is unchanged.
  A record from before the PR has no `town`, so it takes no watchers and tells nobody.
- The changed checks (the table card's Ranked enabled, Casual greyed; the busy-town @perf; the seat text) guard no rule in
  `docs/rules/eric.md`.

## Not reached

- The real Workers runtime: input gates during outgoing calls, call timeouts, the hub's real latency. Findings S2 to S4 are reasoned from
  the Durable Object model and shown on the fakes.
- e2e runs, stills and the @perf run, all run by the author and CI, not by me. Client drawing details (stool step-offs, card states)
  were read, not run.
- A load test of the hub with many seated games.

## Appendix: the repro file (scratch; drop it into `packages/server/test/` to run)

```ts
// REVIEW SCRATCH (PR #1027): repros for REVIEW.md. Never committed as a test.
import { afterEach, describe, expect, it, vi } from "vitest";
import { RANKED_1V1, TOWN_TABLES, rankView } from "@chessroyale/core";
import { DUEL_PROTOCOL, type DuelPlayerView, type DuelServerMessage } from "@chessroyale/chess/duel";
import { Matchmaker, type DuelPlayAnswer } from "../src/matchmaker.ts";
import { DuelGame } from "../src/duel-do.ts";
import { LiveHub } from "../src/live-hub.ts";

const info = (uid: string, rating: number) => ({ uid, rating, player: { uid, name: uid, look: null, rank: rankView(null) } satisfies DuelPlayerView });
const ticketOf = (a: DuelPlayAnswer) => ("ticket" in a ? a.ticket! : "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class TestMatchmaker extends Matchmaker {
  constructor(ctx: DurableObjectState, env: never) {
    super(ctx, env);
    this.holdMs = 60;
  }
  setHold(ms: number) {
    this.holdMs = ms;
  }
}

function setup(hub: Record<string, unknown>) {
  const creates: { code: string; at: number }[] = [];
  const told: string[] = [];
  const made = new Set<string>();
  const ns = {
    idFromName: (n: string) => n,
    get: (code: string) => ({
      async delivered(uid: string) {
        told.push(`${code}:${uid}`);
      },
      async create(c: string) {
        if (made.has(c)) return false;
        made.add(c);
        creates.push({ code: c, at: Date.now() });
        return true;
      },
    }),
  };
  const live = { idFromName: (n: string) => n, get: () => ({ async players() { return 2; }, ...hub }) };
  const store = new Map<string, unknown>();
  const ctx = { storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => void store.set(k, v) }, blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn() };
  const mm = new TestMatchmaker(ctx as unknown as DurableObjectState, { DUELS: ns, LIVE: live } as never);
  return { mm, creates, told };
}

describe("REVIEW repro: the matchmaker waits on the hub inside its batch", () => {
  it("a town pair's slow hub call holds back the next pair in the same batch (not from the town) by seatWaitMs", async () => {
    const { mm, creates } = setup({ townMatch: () => new Promise(() => {}) });
    const asks = [mm.duelNext(null, { ...info("a1", 1000), town: true }), mm.duelNext(null, info("b1", 1000)), mm.duelNext(null, info("a2", 2000)), mm.duelNext(null, info("b2", 2000))];
    await Promise.all(asks);
    await sleep(TOWN_TABLES.seatWaitMs + 300);
    expect(creates).toHaveLength(2);
    expect(creates[1]!.at - creates[0]!.at).toBeGreaterThanOrEqual(TOWN_TABLES.seatWaitMs - 20); // seen: 1502 ms
  });

  it("Cancel pressed during the hub wait: {} from the queue, then the game is handed to the canceled player anyway", async () => {
    const { mm, told } = setup({ townMatch: () => new Promise(() => {}) });
    const first = await mm.duelNext(null, { ...info("ann", 1500), town: true });
    mm.setHold(5000);
    const annAsk = mm.duelNext(ticketOf(first));
    const bobAsk = mm.duelNext(null, info("bob", 1500));
    await sleep(300);
    expect(await mm.cancel(ticketOf(first))).toEqual({});
    const [a] = await Promise.all([annAsk, bobAsk]);
    const code = "code" in a ? a.code : null;
    expect(code).toBeTruthy();
    expect(told).toContain(`${code}:ann`); // delivered: a no-show is Ann's dodge
  });
});

class FakeSocket {
  sent: DuelServerMessage[] = [];
  closed: number | null = null;
  private attachment: unknown = null;
  serializeAttachment(a: unknown) {
    this.attachment = JSON.parse(JSON.stringify(a));
  }
  deserializeAttachment() {
    return this.attachment;
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close(code: number) {
    this.closed = code;
  }
}

function gameRuntime(env: unknown) {
  const store = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const ctx = {
    storage: { get: async (k: string) => clone(store.get(k)), put: async (k: string, v: unknown) => void store.set(k, clone(v)), setAlarm: async () => undefined, deleteAlarm: async () => undefined, deleteAll: async () => store.clear() },
    getWebSockets: () => sockets.filter((s) => s.closed === null),
    waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
  };
  return { store, sockets, game: new DuelGame(ctx as unknown as DurableObjectState, env as never) };
}
const pv = (uid: string): DuelPlayerView => ({ uid, name: uid, look: null, rank: rankView(null) });

describe("REVIEW repro: closeIfDue awaits the hub between its check and the close", () => {
  afterEach(() => vi.useRealTimers());

  it("a code's next game, made while the old game's close waits on the hub, is wiped when that close resumes", async () => {
    const T0 = 1_800_000_000_000;
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
    const gates: (() => void)[] = [];
    let calls = 0;
    const hub = {
      async townMatchOver() {
        if (++calls === 1) throw new Error("hub busy"); // the game's own tellTown fails
        await new Promise<void>((ok) => gates.push(ok)); // the closing tries wait until let go
      },
    };
    const { store, game } = gameRuntime({ LIVE: { idFromName: (n: string) => n, get: () => hub } });
    await Promise.resolve();
    expect(await game.create("ABCDE", { w: pv("ann"), b: pv("bob") }, { town: true })).toBe(true);
    vi.setSystemTime(T0 + RANKED_1V1.joinSeconds * 1000 + 1);
    await game.alarm(); // nobody came: called off (an end; tellTown fails)
    vi.setSystemTime(T0 + RANKED_1V1.joinSeconds * 1000 + RANKED_1V1.resultsKeepMinutes * 60_000 + 10);
    const closing = game.alarm(); // close #1 waits on the hub
    await Promise.resolve();
    const made = game.create("ABCDE", { w: pv("cy"), b: pv("di") }); // the code reused: close #2 inside create
    for (let i = 0; i < 5 && gates.length < 2; i++) await Promise.resolve();
    gates[1]!();
    expect(await made).toBe(true);
    expect((store.get("game") as { players: { w: { uid: string } } }).players.w.uid).toBe("cy");
    gates[0]!(); // close #1 resumes
    await closing;
    expect(store.get("game")).toBeUndefined(); // the new game is gone
    expect(await game.exists()).toBe(false);
  });
});

describe("REVIEW repro: a watcher's messages", () => {
  it("every hello from an anonymous watcher is answered with the whole game (no limit)", async () => {
    const { sockets, game } = gameRuntime({});
    await Promise.resolve();
    await game.create("ABCDE", { w: pv("ann"), b: pv("bob") }, { town: true });
    const ws = new FakeSocket();
    ws.serializeAttachment({ color: null, watch: true });
    sockets.push(ws);
    for (let i = 0; i < 500; i++) await game.webSocketMessage(ws as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL }));
    expect(ws.sent.filter((m) => m.t === "welcome")).toHaveLength(500);
  });
});

describe("REVIEW repro: the hub keeps no word of a game already over", () => {
  it("townMatchOver before townMatch: the table is held until the backstop", async () => {
    const store = new Map<string, unknown>();
    const storage = {
      get: async (k: string) => store.get(k),
      put: async (k: string, v: unknown) => void store.set(k, structuredClone(v)),
      delete: async (k: string | string[]) => {
        for (const x of Array.isArray(k) ? k : [k]) store.delete(x);
      },
      list: async ({ prefix }: { prefix: string }) => new Map([...store].filter(([k]) => k.startsWith(prefix))),
      getAlarm: async () => null,
      setAlarm: async () => undefined,
    };
    let ready: Promise<unknown> = Promise.resolve();
    const hub = new LiveHub({ storage, blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()) } as unknown as DurableObjectState, {} as never);
    await ready;
    await hub.townHere("ann", "Ann", "town", { c: 1, r: 1, idleMs: 0, hidden: false, shop: null, seat: { table: 3, stool: 0 } });
    await hub.townMatchOver("ABCDE");
    expect(await hub.townMatch("ABCDE", [{ uid: "ann", name: "Ann", look: null, pawn: "white" }, { uid: "bo", name: "Bo", look: null, pawn: "white" }])).toBe(true);
    expect((await hub.townWatch("town")).tables.map((m) => m.code)).toEqual(["ABCDE"]);
  });
});
```
