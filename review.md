# Review: PR #611 (the boss and lone devices), branch claude/fable-b3 at a64a605

Independent, read-only review (full lane plus the boss kit). Read: the diff against main 6dea498, the decision note
`docs/decisions/2026-11-10-boss-and-lone-devices.md`, the PR body (commit 50c914f), and findings 2 and 5 of
`notes/fable-audit-findings.md`. Line numbers are on the PR branch.

**Proof tests** (in `proof/` on this branch; copy into `packages/server/test/` and run `npx vitest run <file>` from the repo root).
Each passes by showing the failure it names:
- `review-fable-b3.test.ts`: B1, M1, M2 (built on the PR's own `boss-check.test.ts` harness).
- `review-fable-b3-squads.test.ts`: M3, M4 (built on `squads-lone.test.ts`).

**Runs:** server unit suite 1058/1058; chess unit suite 1153 passed, 2 skipped; boss kit (`boss-kit.test.ts`) and
`boss-brain.test.ts` 55/55; my proof tests 5/5. On GitHub, `check` is green; the full e2e run (which includes
`e2e/boss-smoke.spec.ts`) was still running when I wrote this, so I didn't run boss-smoke locally.

## Verdict

The design is right: two devices, one seed, compare, and the engine server breaks ties. It does stop the review's lone
lying host when an engine server is up. But it treats any difference between two devices as one of them lying, and two
honest devices differ more often than the note assumes: Maia still loading, Maia failing beside Stockfish on a phone,
Maia's 1.5 s timeout on a phone, a checker that changed mid-battle, an app from before this PR, and every limited-strength
Stockfish move. In those cases an honest device gets struck and benched, and the boss plays the stronger of the two moves.
I'd fix B1 before merging. The rest can go in this PR or a follow-up.

## Blocker

### B1. Two honest devices that differ: the honest Maia device is struck and benched, and the boss plays the stronger move
- **Where.** `lobby.ts:1816-1835` (`bossServerScored`: "the better for him plays"; a strike at `gap >= BOSS_CHECK.strikeLoss`,
  line 1833); `settings.ts:2205` (`strikeLoss: 0.4`); `runner-tools.ts:492-542` (Maia not ready, `timeoutMs: 1500`, or a
  `share` draw: the device plays Stockfish's `playAtElo` instead of Maia).
- **The failing case** (proof: "an honest Maia host whose checker's Maia isn't ready…"). The host plays Maia's move, as the
  battle intends: no guard, so it sometimes gives away 40+ points. reports/maia-boss.md shows 21% of maia-raw moves give
  away 25+ points. The checker plays Stockfish's guarded move, because its Maia is still loading (the PR's own e2e saw
  this on move 1), failed to load beside Stockfish on a phone (the Oct 14 iPhone failure is why solo pauses Stockfish
  first; online nothing pauses), took longer than 1.5 s on a phone, or was only just told the brain after the checker
  changed (`keepChecker`, 1723). The server finds Maia's move 45 points worse: the honest host gets a strike. A second such
  move benches it, and it does no more hosting or judging this match. With a broken checker, every boss move differs. At
  about one Maia move in ten 40+ points worse, an honest host over a 30-move raid is benched about 80% of the time.
  Meanwhile every differing move plays the better of Maia and Stockfish, so the boss is stronger than the Maia level he
  was calibrated at (the crowd's ~0.30 score, Eric's "people read 'boss' and assume it's a challenge"). The same happens
  the other way round (a host whose Maia isn't ready strikes an honest checker).
- **Also.** With no engine server (ENGINE_OFF in e2e and dev, the container down or cold past 14 s, or the day's budget
  spent), move 1 of nearly every Maia raid differs, so every raid of 2+ people is unvouched from move 1 and pays as solo.
- **Fix.** (1) Have the app say which brain played (`bossMove.by: "maia" | "stockfish"`, from the `BrainNote` it already
  makes). When one device says Maia and the other a fallback, play the Maia device's move unless the server finds it a
  throw, and strike nobody. (2) Strike only at a throw-sized gap, measured above Maia's honest worst (for example a lost
  queen or more than 0.75), never at 0.4. (3) Pick as checker only a device that has reported Maia ready (a `maiaReady`
  message once `init` succeeds), and keep "unvouched" for when none has.

## Major

### M1. The host drops mid-move: the checker becomes the host, and its one answer counts as both devices'
- **Where.** `lobby.ts:967` (`disconnect`: `hostId = pickHost(...)`, which picks computers first, and the checker was chosen
  computers first too) and `:887` (the checker reconnecting while the host is away), then `resendHostWork` sends it the
  same request, and `settleBoss` (1786-1793) compares `answers[host]` with `answers[checker]`, which is the same entry.
- **The failing case** (proof: "the host drops mid-move…"). The host answers honestly, then its connection drops. The
  checker is now the host, and it throws. Its move plays at once, as "the same move from both". The host's honest answer is
  thrown away, no server is asked, and the match stays vouched (it ranks and pays in full).
- **Fix.** In `settleBoss`, count a host that is also the checker as one device. Better: whenever `hostId` changes during
  a checked move (disconnect, reconnect, `resendHostWork`), run `askBoss` again as `bossTimeout` already does (a fresh
  checker beside the new host, with the same seed). Keep the answers already in by device, so the dropped host's honest
  answer can still be compared.

### M2. A silent or slow checker is never replaced or struck: every boss move waits 4 s, and the raid is unvouched for free
- **Where.** `settleBoss(true)` (1805-1808) plays the host's move alone and unvouches the match. Nothing marks the checker
  that didn't answer, and `bossCheckerFor` (1737) keeps "this battle's checker again while it can".
- **The failing case** (proof: "a silent checker…"). The checker never answers: each of three boss moves waits
  `BOSS_CHECK.waitMs` (4 s) after the host's answer. The checker keeps its job with 0 strikes, and the raid is unvouched:
  everyone's win and minutes go under solo's daily caps, and a ranked raid (15+ people) becomes unranked. Honest causes: a
  phone in the background but still connected, or a phone checker on a heavy turn. Griefing causes: a player who is losing
  a ranked raid stays silent once and voids the ranking for all 15+ people, with no strike.
- **The heavy turns, specifically.** The checker gets the whole request, including Wrangler's showdown and drag, the
  tiger's hoops and balloon, Folio's Crease and Moo's beam. Those extras are never compared (only the move is), but the
  checker answers only after computing them. The server gives the host up to 15 s + 15 s for a showdown (`bossTimeoutMs`,
  606), and Wrangler's scout gives the host a head start (net.ts:941, host only). The checker gets 4 s after the host. On
  showdown turns an honest checker is routinely late, and the raid is unvouched.
- **Fix.** Send the checker a request with only what the move needs (no `pull`/`drag`/`showdown`/`hoops`/`balloon`/
  `crease`/`beam`). A checker that misses the window is dropped as checker (a new one next move), and two misses count as
  a strike. Before unvouching, ask a second checker, or the server, once.

### M3. Squads with two parties: a fast party's lie stands, and the honest late answer is dropped unread
- **Where.** `squads-lobby.ts:2351` (one answer stands `graceMs` = 400 ms after it arrives) and `:2277` (`botTop`: once
  `job.how` is set, a late answer is ignored: no comparison, no server, no strike). `noteAlone` (2183) doesn't fire,
  because another party's device is up.
- **The failing case** (proof: "a fast party's lie beats an honest slower device…"). Party A answers a bot job at once
  with the moves reordered so the worst is "best". Party B's honest device answers 0.5 s later (a phone's 250k-node search
  takes about that). A's lie plays, B's answer is dropped, nobody is struck, and the lobby pays coins and crates. The PR
  body's "Not done" says "the late answer blames it". That's true in the main lobby (`lateAnswer`), not in Squads. So
  finding 5's Squads hole is closed for one party but still open for any lobby with a second, slower party.
- **Fix.** Port the main lobby's late-answer handling. When a late answer disagrees with the one that stood, ask the server
  for a verdict and strike the device further from it, so a liar is benched after `botWork.strikes`. Make the grace "at
  least, or this fraction of the first's time" as JUDGES does, so a phone has time to answer.

### M4. Squads' one-party rule refuses honest parties mid-lobby, for the whole lobby, and the text blames the wrong thing
- **Where.** `noteAlone` (2183-2190) sets `unvouched` for the whole lobby, and keeps it set, the first time a job is
  answered with no other party's device up. `rewardFor` (1886) then pays no coins or crates, and the placement says
  "No coins or crates: a lobby of only your party and bots doesn't pay them." (`Squads.tsx:198`).
- **The failing case** (proof: "two parties, the other one's device goes…"). Two parties start. The other party is knocked
  out and closes the page (or queues again). The next bot job unvouches the lobby. The remaining party then wins the
  final against bots and gets no 100 coins and no crate, and is told the lobby was "only your party and bots", which it
  wasn't. Placements decided earlier in the same lobby were paid. At launch, with a party or two per lobby, this will be
  the usual way a winning party ends a lobby.
- **Fix.** Decide it per squad, not per lobby: a squad's placement goes unpaid only if its own matches' bot work rested on
  its own party alone. Word the text "nobody outside your party checked the bots' moves". Separately, Eric should know that
  by design an honest party of friends alone with bots never earns Squads coins or crates.

### E1. Eric's call: Maia's 40 MB on a second device (cost and data)
- **Who gets picked** (`bossCheckerFor`, 1733-1738): any judging device that isn't the host's account, computers first
  (by the device's own claim at hello), then the fastest by claimed speed. Phones are picked when no other computer is up,
  which in a phone-first game is most small raids. That phone downloads about 40 MB (25.2 MB model, 14.2 MB WebAssembly;
  less compressed, cached afterwards) at the battle's intro, maybe on mobile data, with no notice. It then loads Maia
  beside Stockfish, which solo avoids on phones because it failed on Eric's iPhone.
- **When it can't load:** every boss move differs, so there's a server search a move (up to ~40 a raid) and B1's strikes
  and stronger boss. Without a server, the raid is unvouched.
- **Options:** (a) as built: phones may check (one more player per raid downloads 40 MB; say so on screen); (b) computers
  only, and phone-only raids are unvouched (pay as solo); (c) phones only if Maia is already cached or loaded (report it),
  else (b). I'd take (c). The engine server can't stand in for a Maia check (it scores at most 8 listed moves and can't
  judge Maia's unguarded picks), unless Maia runs on the server, which is a hosting cost for Eric.
- **Engine-server cost, as built:** Maia raids about 1 search a raid (move 1) plus one per move whenever a device falls
  back (B1); raids in the bridge band and Stockfish-level raids about one a boss move (m1), each holding the boss's move up
  to `SERVER_WAIT_MS` (14 s).

## Minor

- **m1. Limited-strength Stockfish isn't seeded.** `playAtElo` (`uci.ts:396`, UCI_LimitStrength) picks with Stockfish's own
  time-seeded random draw, so two honest devices differ on most such moves: every Stockfish-brain raid move, the bridge
  band's share moves (`runner-tools.ts:492`, 542) and any move where Maia isn't asked. `BOSS_CHECK`'s comment ("Stockfish's
  searches are exact at a node count") doesn't hold for these. The PR body counts the cost, not the strength: the better
  of two draws plays, so the boss is stronger than its UCI_Elo. Fix: draw those moves with the seeded rng over the top-8
  search (as `stumble` does), or have the server play them.
- **m2. Apps from before this PR ignore `draw`.** Open tabs and installed apps keep running the old code until they
  reload, and there's no version handshake. They report speed, so they can be host or checker, and they play unseeded, so
  every move differs (B1) until they reload. Fix: a `seeded: true` flag with `speed`; only flagged devices check or get
  compared.
- **m3. The checker is predictable and can be chosen by the players.** It's the fastest claimed computer (speed claims are
  capped at 3M, and ties go to the lower id), the host is the first computer to join, and only the host's *account* is
  excluded. So two accounts (one person on two browsers) can be host and checker. In a Boss Battle party every checker
  is in the host's party, so "a host can't throw the battle" doesn't hold there, while Squads treats a one-party lobby as
  unvouched. Little is at stake (a party picks its own difficulty, and its wins already pay uncapped XP: `xpOpponents`
  is `[]` for raids, `lobby.ts:3643`), but it should be consistent. Fix: draw the checker at random (`jrng`) among eligible
  devices, never from the host's party; a party raid with no outside device is unvouched.
- **m4. Unvouched matches still feed fair play.** `writeResult` records `rec.fair` (the lone host's numbers) as for any
  match. With enforcement at "review" the harm is a review entry, but "one device's word" shouldn't build a case. Skip
  them, or tag them.
- **m5. Players aren't told why.** An unvouched online raid or Crowd shows solo wording ("Daily solo limit") and "unranked"
  with no reason. Nothing hidden: one line, e.g. "Only one device checked this match: it pays as a solo game."
- **m6. The double play's only real-Maia proof never runs in CI.** The changed `e2e/maia.spec.ts` test is
  `@phone-only` and skipped off desktop. Everything else uses scripted engines, so a seed that stops reaching Maia
  (B1's every-move case) would pass CI.
- **m7. The "daily" notice can be lost.** The cap's "placed" notice reaches the player only if the lobby is still in
  memory when the write runs (`squads-do.ts`, `this.record === rec`). A retry hours later leaves a card showing coins they
  didn't get.

## Does it close findings 2 and 5?

- **Finding 2 (a raider plays the boss):** closed for a lone lying host, another account checking, and an engine server up
  (proved by the PR's turned-around test, which I re-ran). Still open: M1 (a host change makes one device both), m3 (two
  accounts, or a party), the server down (the host's move plays, unvouched, by design), and the powers' picks (the PR's
  "Not done").
- **Finding 5 (one device scores or moves the bots):** main lobby closed as designed (a host scoring alone, or a judges'
  dispute with no verdict, unvouches the match). Squads closed for a lobby of one party, but not for two parties where
  one answers faster (M3). The PR body says otherwise.

## Checked, fine

- **Seed plumbing:** `draw` (1 to 2^31−1, from the judges' rng) goes to host and checker alike and again on reconnect;
  mulberry32 for the move's rng; Maia's `Seed` is set for each call and back to 0 for unseeded calls; the Maia box on main
  supports `Seed`.
- **Determinism of the other checked kinds:** single-threaded lite Stockfish, fixed nodes, `ucinewgame` (cleared hash)
  before every search. `stumble`, `stagger`, `best` and the funhouse (`funhouseMoveFrom` has no randomness) agree on
  honest devices.
- **No stall:** every checked state has a timer (first answer + 4 s; server 14 s; no answer: a new host, fresh seed and
  checker, then a random move), and a server answer after its timeout falls through harmlessly (`serverScored`).
- **Answers:** a junk answer gets a strike and is dropped; a stranger's answer is ignored; one answer per device; the
  funhouse's sign is right (lower for the crowd).
- **Squads' daily cap:** in the reward's own INSERT (same statement); `created_at` and the day start are both ms; it counts
  each paying lobby once (reason `reward`, leg 0, `squads:` keys); a retry of a paid lobby is "replay", not "refused" (no
  double count, no false notice); two lobbies at once can't both pass; resign rows (0 coins) never touch it.
- **Squads' bracket check** uses `partyId`, which is always set (`s:<id>` for someone queueing alone).
- **`ranked()` and XP:** `ranked()` and `lobbyXpGame` read `unvouched` at the end. Quests follow the solo caps (a boss-win
  quest moves only if the capped win went in).
