# Delta re-review: PR #1027's review fixes (full lane)

Head reviewed: `0b47e269` (`origin/claude/town-ranked`). The fixes are `git diff 32212077..0b47e269` (ffa83758, 5dcd2c9d, 0b47e269), checked
against `REVIEW.md` (head `88932296`). Read-only: no code changed. CI on the head when I looked: `check`, `unit`, `chess (1)` and
`chess (2)` were green; the 15 e2e shards were still running (`perf` is skipped in CI).

**Verdict: no blockers.** Every fix closes its finding as reported. All five of the first review's repros now fail on this head, which
means the bugs no longer reproduce: S2 0 ms (was 1502), S4 `{code}` (was `{}`), S3 no hub wait before the close, S1 1 welcome (was 500),
N2 not seated. One should-fix is left. S4's Cancel waits for the matchmaker's whole run, not just the ticket's own batch. Under a busy
queue, or a slow hub with town pairs coming in, that wait can pass the game's join window, and the dodge S4 fixed comes back (repro
below). There are three small nits.

## Blockers

None.

## Should-fix

**R1. S4's Cancel waits for the whole `form()` run, so under load it can come back after `joinSeconds`: the dodge returns.**
`packages/server/src/matchmaker.ts:168`: `while (this.forming && this.q.seatingNow(ticketId)) await this.forming;`. `this.forming` is
the promise for `kick()`'s whole `form()`, and `form()` loops (`for (;;)`) for as long as each `admit` finds a pair. Ann's ticket leaves
`seating` when her batch places it (`placeAll`). Her Cancel is still answered only after every later batch in the same run has finished.
Meanwhile her held ask has been handed the code, and `told()` → `delivered(ann)` makes a no-show her dodge. The Worker's `abandon` can
only come after the Cancel answers. If that's later than `joinBy`, the alarm has already called the no-show, `cancelled()` does nothing
(`duel-room.ts:409`, `if (this.end) return;`), Ann is charged the dodge, and Bob has waited out `joinSeconds`. Both of the brief's
conditions fail.
*Failing case* (the repro below, run on this head): a hub that doesn't answer `townMatch`, and one town pair arriving during each batch.
Ann's game is made at 0 ms and she's told at 1500 ms. Her Cancel is answered at **12004 ms**, after 9 games have been made, and
`joinSeconds` is 10. A healthy hub gets there too, under a steady stream of pairs (each batch costs its `create` calls, and any batch with
a pair keeps the run going). That's the launch load the queue is built for.
*Fix (small):* wait only while this ticket is being seated, for example
`while (this.forming && this.q.seatingNow(ticketId)) await Promise.race([this.forming, sleep(25)]);`, or a per-ticket hook that
`placeAll` and `putBack` resolve (`waiters` is taken: it's the held ask's). The failure path stays as it is: a ticket put back is out of
`seating` at once, then `q.cancel` takes it out of line.

## Nits

- **R2.** `packages/server/src/index.ts:590`. A guest's request to `/api/1v1/game/CODE/ws?watch=1` without `Upgrade: websocket` gets
  `refusedSocket`'s 101. On workerd that's a 500, "Worker tried to return a WebSocket in a response to a request which did not contain
  the header "Upgrade: websocket"" (checked on Miniflare 5). Before the fix it reached the game and got its 426. Only a crafted request
  hits it, but it's an uncaught runtime exception. Check `Upgrade` first, or answer a non-upgrade with JSON 403/426.
- **R3. N1 is closed for the case in the review, but the fallback can still pick the other table.** `matchmaker.ts:419` puts the town
  searcher first, and `town-tables.ts:89` still falls back to the other player's seat when the first one fails (their table is held,
  or they've stood up). The game is then drawn at the table where the home searcher's idle computer sits. This is the designed
  fallback ("the other's is used, else none"). Passing `town` per seat and skipping a non-town seat would close it fully. Low value,
  your call.
- **R4. N2's "over" mark can block a reused code's next game from its table.** `town-tables.ts:105` marks a code over for
  `resultsKeepMinutes` from when the hub hears it. When only the close's last try reaches the hub (`duel-do.ts:217`, `tellTown`
  having failed throughout), the mark starts at the close. That's exactly when the code becomes free again, so for 10 minutes a new
  town game under the same code is never seated at a table. Codes are random from about 45 million, so it's practically never.
  Noted only so nobody relies on the mark for reused codes.

## Each finding, closed?

| Finding | Closed | How checked |
|---|---|---|
| S1 watcher flood | Yes | `watcherMessage` (`duel-do.ts:369`). Size checked before parsing, one hello per socket, anything else closes with 1008, never reaching `closeIfDue` or the game. First review's repro: 1 welcome, not 500. New test covers a move, resign, bad JSON and an oversize hello. A player's socket never has `watch`: the only writers are `fetch`'s watcher branch, `fetch`'s player branch and the residents' pause, and only the first sets it. The app sends only its hello when watching (`duel.ts:260`), and 1008 just reconnects it. A flood now needs a fresh signed-in upgrade per welcome, at most 50 at a time. |
| S2 per-pair hub wait | Yes | One `townBy` per batch (`form`), each town pair waits at most `townBy - now`. `placeAll` still runs inside `seatDuel` before it returns, so `form()`'s failure path (`putBack` of tickets still in `seating`) never sees a placed pair: never two games, never a lost ticket. Repro: next pair +0 ms. A late `townMatch` still goes out before the code (fire, `.catch`), and the hub hears it before the players' "left" beats. |
| S3 close order | Yes | No await between the check and `record = null` (both in the same sync run; `blockConcurrencyWhile`'s callback nulls the record before its first await). Last try is `waitUntil` after the close. `tellTown`'s late `.then` checks `this.record !== r`, so it never re-stores a closed game. Repro no longer reaches its second close. New test: a hung hub holds nothing and the code's next game is kept. |
| S4 Cancel while seating | Partly: **R1** | Correct when the run is short. Placed: `q.cancel` answers the code even after `deliver` (placements are kept `placedKeepMs`). `abandon` → `cancelled` → `excused`, `conduct {}` for both, whichever of `delivered` and `abandon` lands first. Failed: put back, then taken out of line; never paired after (new test). Not bounded by the batch: R1. |
| S5 silent refusal | Yes | `refusedSocket` (accept, close with code and reason, 101). On workerd (Miniflare 5) the client sees `open`, then `close 4029 "Too many are watching this game."`, which is what NetDuel's `onclose` expects (`opened` is true, and the watch branch runs before `again()`). `goneNow` shows it and stops. 4003 for a game not from the town. |
| S6 guests' names | Yes | Worker refuses a guest's watch before asking the game (unit test). Card: Spectate greyed with `WATCH_GUEST`, e2e on the phone. Guests still see "A ranked game" on the card (`view(…, names=false)` blanks the names). |
| S7 tests | Yes | `duel-do.test.ts`: tellTown once, stored; retried at the next change; last try after the close; watcher S1; refusals S5; Worker S6. |
| N1 / N2 / N3 / N4 | Yes (R3, R4 nits) | N1 test. N2 test plus the first repro. N3 90 min beats a rapid 10+5. N4 `parkTables` 12, and the app test checks `TABLES.length`. `readSeat` and `found` both use it. |
| N9 floor on return | Yes | `floor` only skips `fresh` (the arrival line, `town-here.ts:103`). The flag is set only by `backFromWatch` and read once. e2e checks Cy's first beat back. |

## Checked

- The whole delta: server (`duel-do`, `index`, `live-hub`, `matchmaker`, `queue`, `town-here-api`, `town-tables`), core settings, the app
  (`duel.ts`, `App`, `Town`, `TownPage`), the tests, docs, and the decision note (108 words).
- The first review's five repros, re-run on this head: all five now fail, so each bug is gone.
- A Cancel's interleavings: `delivered` before or after `abandon`; another device's ask; a failed seating then the next `kick` (held, so
  no immediate re-admit before Cancel takes the ticket out of line).
- The changed checks guard no rule in `docs/rules/eric.md`.

## Not reached

- The real Workers runtime for anything but the refused socket (input gates, call timeouts, real hub latency). R1 is shown on the fakes
  and reasoned from `duel-room.ts`'s no-show.
- The e2e run on this head (still running when I looked), stills and @perf.

## Appendix: R1's repro (scratch; drop it into `packages/server/test/` to run, about 12 s)

```ts
import { describe, expect, it } from "vitest";
import { RANKED_1V1, TOWN_TABLES, rankView } from "@chessroyale/core";
import type { DuelPlayerView } from "@chessroyale/chess/duel";
import { Matchmaker, type DuelPlayAnswer } from "../src/matchmaker.ts";

const info = (uid: string, rating: number) => ({ uid, rating, player: { uid, name: uid, look: null, rank: rankView(null) } satisfies DuelPlayerView });
const ticketOf = (a: DuelPlayAnswer) => ("ticket" in a ? a.ticket! : "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
class TestMatchmaker extends Matchmaker {
  constructor(ctx: DurableObjectState, env: never) { super(ctx, env); this.holdMs = 60; }
  setHold(ms: number) { this.holdMs = ms; }
}
function setup(hub: Record<string, unknown>) {
  const creates: { code: string; at: number; w: string; b: string }[] = [];
  const told: { code: string; uid: string; at: number }[] = [];
  const made = new Set<string>();
  const ns = { idFromName: (n: string) => n, get: (code: string) => ({
    async delivered(uid: string) { told.push({ code, uid, at: Date.now() }); },
    async create(c: string, p: { w: { uid: string }; b: { uid: string } }) {
      if (made.has(c)) return false;
      made.add(c); creates.push({ code: c, at: Date.now(), w: p.w.uid, b: p.b.uid }); return true;
    } }) };
  const live = { idFromName: (n: string) => n, get: () => ({ async players() { return 2; }, ...hub }) };
  const store = new Map<string, unknown>();
  const ctx = { storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => void store.set(k, v) }, blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn(), waitUntil: () => undefined };
  return { mm: new TestMatchmaker(ctx as unknown as DurableObjectState, { DUELS: ns, LIVE: live } as never), creates, told };
}

describe("REVIEW2 repro R1: S4's Cancel waits for the whole form() run", () => {
  it("town pairs batch after batch (a slow hub): Ann's Cancel is answered after joinSeconds since her game was made", async () => {
    const { mm, creates, told } = setup({ townMatch: () => new Promise(() => {}) });
    const first = await mm.duelNext(null, { ...info("ann", 1500), town: true });
    mm.setHold(30_000);
    const annAsk = mm.duelNext(ticketOf(first));
    const bobAsk = mm.duelNext(null, info("bob", 1500));
    await sleep(200);
    let cancelAt = 0;
    const cancelled = mm.cancel(ticketOf(first)).then((a) => ((cancelAt = Date.now()), a));
    for (let i = 0; i < 8 && !cancelAt; i++) {
      void mm.duelNext(null, { ...info(`x${i}`, 3000 + i * 500), town: true });
      void mm.duelNext(null, info(`y${i}`, 3000 + i * 500));
      await sleep(TOWN_TABLES.seatWaitMs - 100);
    }
    const answer = await cancelled;
    await Promise.all([annAsk, bobAsk]);
    const annGame = creates.find((c) => c.w === "ann" || c.b === "ann")!;
    expect(answer.code).toBe(annGame.code);
    expect(told.find((t) => t.uid === "ann")!.at - annGame.at).toBeLessThan(TOWN_TABLES.seatWaitMs + 200); // delivered: 1500 ms
    expect(cancelAt - annGame.at).toBeGreaterThan(RANKED_1V1.joinSeconds * 1000); // seen: 12004 ms, 9 games made first
  }, 40_000);
});
```
