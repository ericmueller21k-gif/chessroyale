# A seating that throws puts its players back in line (Oct 17, 2026)

A follow-up from the review of #255 (Ranked 1 v 1). How it works now: [matchmaking.md](../areas/matchmaking.md), "A
seating that fails".

## The bug

The matchmaker's `form()` admits a batch (`QueueCore.admit` moves its tickets into `seating`) and seats each group:
`seatDuel`, `seatSquads` or the crowd path. Each path handled a `create()` that answered no (`mm.createFailed`, then
`putBack`), but a call that **threw** (`create`, or the storage write after it) escaped `seat()` and `form()`, and
`kick()` only logged it. Those tickets stayed in `seating` until `SEATING_KEEP_MS` (60 s) forgot them: for a minute
the players' asks waited on a seat that never came, then they started afresh at the back of the line. In Ranked 1 v 1
that was a pair stuck on "Searching" for a minute after one failed Durable Object call.

Found while fixing it: a seating that answered no also stopped its batch without putting back the groups after it.
A 1 v 1 batch can hold several pairs, so the pairs after the failed one were left in `seating` for the same minute.

## What changed

- **Caught once, in one place:** `form()` catches each `seat()` call. A throw is logged as before (`serverError`,
  kind `Matchmaker.form`) and counted as `mm.seatThrew`, a new counter. `mm.createFailed` still counts a create that
  answered no. A throw can also come from the storage write after a create succeeded, so it gets its own count.
- **Put back in one place:** any failed seating, a throw or a no, stops the batch. `form()` then puts the whole batch
  back with `putBack`. `QueueCore.putBack` now moves only tickets still being seated. A ticket already placed keeps
  its seat, so it is never seated twice. That happens when the crowd path fills a lobby and then fails to open the
  next one, or when a Squads lobby takes the parties that fit. A ticket already back in line, or dropped, is left as
  it is. The seat paths no longer put tickets back themselves.
- **The retry, never hot:** a stopped batch reports "held back", as a create that answered no did before. The next
  batch starts after `CAPACITY.queue.formEveryMs` (1 s), or at the next ask. A throw that never stops costs one try a
  second, plus one per ask (each ask waits up to `holdMs`, 2.5 s). Every call gets a fresh stub and every create a new
  code (a new object), in line with Cloudflare's advice to make a new stub after an exception.
- **Anything else that escapes a batch** now waits the same second. Before, it started the next batch at once. A throw
  before admission (the live hub's count throwing synchronously) would have looped with no pause.
- **Every waiter settles:** an ask waiting for a put-back ticket still ends within its own `holdMs`. Its ticket is
  back in line, so a 1 v 1 ask answers `searching` and others answer "busy, in line" with their place in line.

## My calls

- **One ticket per account while it's being seated, too.** `enqueue` looked for an account's ticket only in the line.
  A first ask from the account's other device while its ticket was being seated made a second ticket. If that seating
  failed, putting the first ticket back left two tickets for one account in line. `pairUp` keeps an account away from
  its own other ticket, but it could pair the two tickets with two different opponents: two games at once. Now that
  ask gets the ticket being seated.
- **Stop the batch, don't skip the pair** (as the brief said: like a create that answers no). A pair whose game could
  never open would be tried first every second, and every pair behind it would wait. Nothing makes one pair fail every
  time today. `DuelGame.create` throws on purpose only for a seat without its player, which `seatDuel` filters out
  first, or for one account on both sides, which `pairUp` never pairs. Stopping also means a failing namespace isn't
  called once for every pair. If the `Matchmaker.form` error ever shows up steadily, about once a second, look here
  first.
- **`SEATING_KEEP_MS` stays at 60 s.** The brief's rule: lower it only if a slow but healthy seating can't outlast it.
  If a ticket were forgotten while its seating still ran, its next ask would make a new ticket while the old one was
  being placed: a double seat. From the code:
  1. That can't happen today at any value. `SEATING_KEEP_MS` is only checked in `QueueCore.expire()`, which only
     `admit()` calls. Only `form()` calls `admit()`, at the start of a batch. A batch only starts once the last one has
     finished: `kick()` returns while one is forming, and `form()` seats every group before admitting again.
  2. With the catch, every seating ends with each ticket placed, back in line or dropped. Nothing reaches the backstop
     now; it stays for a bug we haven't seen.
  3. A healthy seating's length can't be bounded. Our calls have no timeout. Cloudflare's limits page gives Durable
     Object RPC and HTTP calls unlimited wall time while the caller stays connected; only CPU is limited (30 s per
     invocation). A batch makes its calls one after another, all timed from when it began. It holds up to
     `admitBurst` (600) tickets. A raid batch can make a reserve, a hurry, then up to 12 new 50-seat lobbies at up to
     5 creates each, with a storage write per lobby. A 1 v 1 batch can make up to 300 pairs at up to 5 creates each.
  4. A lower value buys nothing (nothing reaches it). It would matter only if `expire()` ever ran mid-batch, and there
     it would cause the double seat. So it stays at 60 s.
- **A call that hangs isn't helped by any value.** A hung call holds `form()`, and with it every batch of that queue.
  No `expire()` runs, and the whole queue waits for that one call. Only a time limit on the calls themselves would
  bound a hang. That limit brings its own double seat: a late answer still opens the game after its players were put
  back. Not done here; noted for the director.
- **The cancel edge, unchanged:** a Cancel that arrives while its ticket is being seated still finds nothing to take
  out. If that seating fails, the ticket goes back in line, as it did when a create answered no. It may be paired
  before its 15 s run out, and the other player then sees a no-show after 10 s.

## Tests

- `matchmaker.test.ts`: 250 at once, the second lobby's create throws. The first 100 keep their seats, and the 150
  are back in line at once, in order (places 1 to 150). Their next asks seat them in new lobbies: 250 seats in all,
  nobody twice. The throw is logged and counted. A throw before admission retries once a second, not 50 times at once.
- `duel-queue.test.ts`: a pair whose game throws is back in line in order, still known and still searching, and their
  next asks get one game. A batch of two pairs whose first throws puts the second pair back too. A game that always
  throws is tried once a second, and every ask still answers within its hold. `putBack` leaves a placed ticket placed
  and a dropped one dropped. An account's other device, while its ticket is being seated, gets that ticket.
- `squads-queue.test.ts`: the filling lobby takes 7 of 8 parties and the new lobby's create throws. The 7 keep their
  seats, the eighth is back in line and its next ask gets a lobby of its own. Each party is in one lobby.
- All of these fail on the code before this change.
