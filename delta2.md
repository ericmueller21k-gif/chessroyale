# Delta review 2: PR #611's second fix round (claude/fable-b3, 08e5f52..e576a8e, and the director's a6ddc0c)

Independent, read-only. Read: CLAUDE.md, `delta.md` (this branch), `git diff 08e5f52 e576a8e`, `.review-fixes.md` at 5a01fb6, and
8bd72a1 (the director's Squads change on Eric's word; a6ddc0c merges main into it). Line numbers are at a6ddc0c.

**Proof tests** (`proof/delta2-review-fable-b3.test.ts` on this branch; copy into `packages/server/test/` and run
`npx vitest run packages/server/test/delta2-review-fable-b3.test.ts` from the repo root). Each passes by showing the failure it names:
P1 (N2, both brains) and P2 (N1). The harness is the PR's own (`delta-review-fable-b3.test.ts`).

## Verdict

No blocker. D1's three fixes do what `.review-fixes.md` says, move by move: `by` is heard only on Maia moves, the server's share
draw reaches both devices the same way, Maia against a fallback plays only within 0.25, and with no verdict the host's move plays,
unvouched. D3, D4, D6 and the director's Squads change hold. I found no new stall, double strike, or referee from the answering
party. D5's table matches the report's own arithmetic.

Two holes remain. Neither is new in kind, but both are cheap to close and I'd close them in this PR:

- **N1 (major).** The 0.25 cap is per move, and it compounds. Where the honest device falls back on every move, a liar still throws
  the battle in two or three boss moves, vouched and never struck. That happens when the host's Maia isn't loaded or has failed, as
  in a lobby of phones. The fix is a few lines in `checkBoss`.
- **N2 (major).** D2's least-code option lets a checker's extras replace the host's whenever its different move plays. A liar can
  arrange that on most turns with extras by sending a *better* move, and then chooses that turn's power: it cancels Wrangler's
  showdown every turn it's due, and misaims Moo's, the tiger's and Folio's powers. Before this round the same trick dropped the
  extras. Now the liar picks them.

## Major

### N1. D1's cap compounds: where the honest device falls back every move, a liar still throws the battle

- **Where.** `lobby.ts:1971-1972` (the Maia answer against a fallback plays within `maiaGap`). `:1751`: `maia` is decided without
  asking whether the host's Maia is loaded. `:1449-1452`: `maiaReady` is the app's own word.
- **A liar's best gain, stated plainly:**
  - **Nothing** on the Stockfish brain (2800 and up), on the bridge band's share, the King's strike, a power's `best` or the
    funhouse. Its move plays there only if it's better for the boss. Nothing either on a Maia move where the honest device played
    Maia: both say Maia, so the better move plays. Turns with extras are the exception (N2).
  - **Up to 0.25 a move** on a Maia move where the honest device answered "stockfish". From level, 0.25 is about a minor piece
    (3 pawns; a queen for nothing is about 0.48, as delta.md has it). The cap measures the gap *between the two moves*, not from level. So once the boss
    stands at 0.25 or less, every move is within 0.25 of the honest one, and from then on **any lie plays**.
  - **Over a 30-move raid with a computer host whose Maia is loaded:** the guarded brains play Maia's move 97% of the time
    (`reports/maia-boss.md`, "Boss moves by Maia"); the guard swaps out the rest. Add any move before the host's Maia is ready
    (move 1 on a slow download) and any move past the 1.5 s timeout. That's about one chance a raid: one lie of up to 0.25.
  - **With a host whose Maia never loads or fails:** a phone (the Oct 14 iPhone case, or one still downloading 40 MB), on every Maia
    move. The boss goes 0.5 → 0.25 → anything, and the battle is lost within two or three boss moves, vouched and never struck.
  - **In a lobby of phones the liar is the checker on every move.** A checker for a Maia move must be `maiaReady`, which is the app's
    word, and honest phones don't download Maia just to check (delta.md's E1 note). So the liar is the only one eligible, and it's
    drawn every time.
- **Failing case (proof P2).** Four phones; the host's Maia never loads (it never sent `maiaReady`, which the server knows); the
  liar says `maiaReady`. The liar checks 5 of 5 Maia moves, and each time its move, 0.25 worse, plays. Vouched, no strike.
- **Fix (a few lines).** Decide `maia` from the host's Maia too: in `checkBoss`,
  `maia = brain && !share && !!this.human(host)?.maiaReady`. When the host's Maia isn't ready, send no brain to anyone, as for the
  share. Both devices then play the seeded Stockfish move the host would have fallen back to anyway. Any seeded device can check,
  and nobody's `by` is heard. The boss plays as it does today, since the host falls back regardless. That leaves a liar only the
  honest Maia device's own per-move fallbacks (the guard's swaps, about 3%, and a phone's timeouts). Optionally, the app withdraws
  `maiaReady` when its Maia fails (`failed()`), so a phone whose Maia breaks after loading counts as not loaded.

### N2. D2: a liar buys the turn's power with a better move (the checker's extras replace the host's)

- **Where.** `lobby.ts:2025`: a checker's request is whole on a turn with extras. `:1967` and `:1972`: the better move plays.
  `:1975`: the move that plays brings its own extras.
- **What holds:** on the same move, the host's extras play (`:1888-1889`). On different moves, the pick's own extras play. That part
  is unavoidable, since the host's extras were worked out after its own move. But the "the better plays" rule lets a liar decide
  which move that is:
  - The liar sends a move the engine server scores higher than the honest one: the engine's best. On a Maia move it also says Maia,
    so both devices say Maia and the better move plays.
  - It attaches any extras the rules accept: `showdown: ""` (no showdown this turn; his meter stays full, so it can do the same next
    turn), or a legal line-up of its own (`checkLineup` checks the shape, not the worth). The same goes for a misaimed drag, Moonbeam
    lines, balloon square, hoops or Crease.
  - Its move plays and its extras come with it. Nobody is struck: nothing was thrown, and the boss's move was the better one.
- **How often:** whenever the honest move isn't the engine's best. That's most Maia moves (Maia gives away 10.8 points a move
  unguarded, 1 to 3 guarded), and on the Stockfish brain every move where the seeded draw didn't pick its top move. A checker is kept
  for the whole battle. So one liar drawn as checker can cancel Wrangler's showdown on most of the turns it's due, and the same for
  Moo's, the tiger's and Folio's powers.
- **Not new in kind.** Before this round the same trick *dropped* the extras: the bare request, delta.md's D2 seen from the honest
  side. The fix turned dropping into choosing.
- **Failing case (proof P1, Stockfish brain and Maia brain).** Wrangler's showdown turn. The honest host sends its move and its
  line-up. The liar sends another move, scored 0.53 against 0.50, with `showdown: ""`. The liar's move plays, `applyBossMove` gets
  `showdown: ""`, and nobody is struck.
- **Fix.** This is delta.md's first D2 option. When the move that plays isn't the host's, the turn has extras and the host is still
  up, ask the host for that move's extras: the whole request again, with `allowed: [move]` and the same seed. Use the checker's
  extras only if the host can't answer in its time.
- **Aside.** On the same move with the host not among the first two answers (it missed its window), the "fuller" extras win by
  number of keys (`:1889`). A liar can pad keys to win that. It's rare (it needs an honest host that was late), and the same re-ask
  covers it.

## Minor

- **N3. Squads: comments still say a lone party isn't paid.** `squads-lobby.ts:293-294` (`SquadsReward.solo`: "XP pays as a solo
  game's"), `:352-355` (`SquadsRecord.unvouched`: "pays no coins or crates … XP as a solo game's"), `:1068-1069` ("Its squads'
  placements pay no coins or crates"), and `squads-do.ts:648-649` (a lobby of one party: XP as solo). Nothing sets `solo` any more,
  and the code pays a lone party like any other. The player-facing texts (`NO_REWARD`), the protocol (`why?: "daily"`),
  `docs/areas/squads.md`, the decision file and the FAQ all agree with the code. Only these comments, and the dead `solo` path,
  are left over.
- **N4. D5: the table is the report's arithmetic, not a measurement at the new T.**
  - **The arithmetic checks out.** I re-derived 0.79, 1.27, 1.27 and 1.21 from the report's numbers: the exact mean times 0.866,
    brought to UCI's, through a two-point power law. 0.8/1.25/1.25/1.25 follows.
  - **It's a soft fit.** Each factor is fitted through two points only 4-8% apart in scale (0.96 to 1 at 2500), on two-decimal
    numbers, then extrapolated to about 1.25. Rounding alone puts 2500's factor anywhere from about 1.16 to 1.63.
  - **Strength is still near UCI's.** The loss moves much less than T does here (exponents 0.36 to 0.52 at 1600-2500: 25% more T is
    about 10% more loss). So the boss stays within about 10% of UCI's loss a move, inside the run's own error (about 8%): "near
    UCI's" holds as an estimate.
  - **To confirm cheaply:** run `elo-draw.ts` once more. Its "a move" column now measures real seeded moves at the table's T, because
    the script goes through `eloDrawT`. A re-run overwrites the report's hand-written derivation, which the script doesn't write.
  - **Above 2800** (every move on the Stockfish brain) the factor is held at 1.25, unmeasured. 2800's own fit was 1.21 (1.44 at the
    others' slope).
- **N5. The admins' debug line loses the share.** A request's brain no longer carries `stockfishShare`, and `hostBoss` → `useBrain`
  overwrites `bossPlan` with it (`net.ts:909`, `:974`). So after the first boss move the line drops "· N% Stockfish", and a share
  move's note has no share. A checker device now gets a `bossPlan` too, so an admin's checker shows a brain line. This is cosmetic
  and admins only. Fix: `this.bossPlan ??= plan` for a request's brain, keeping the `bossBrain` message's plan.
- **D7** wasn't done (the director's call) and is unchanged.

## Checked, fine

- **D1, `by`.**
  - Heard only with `bossCheck.maia` (`lobby.ts:1434`). That's true only for `elo`/`stumble` on a Maia brain, and not on a share move
    (`:1748-1751`).
  - The app asks Maia only for those kinds: not the strike or `best` (`pickBossMove`), and the funhouse, extra moves and picks get no
    brain (`:2035`).
  - The share is drawn once for each ask in `checkBoss` (`jrng`) and sent as `share: true` with no brain to the host and the checker
    alike, on `reaskBoss` too. A brain sent never carries `stockfishShare` (`:2036`), so no device draws the share again. After a
    timeout, a new host gets a fresh draw with a fresh seed.
- **D1, the cap and the verdict.** `pick` and `bossDefault` work as described, and `throwLoss` only strikes. "The host's" means the
  current host: with no engine server, a checker promoted when the host drops gets its own move played, unvouched, as it would have
  before the check.
- **D2's time.**
  - `checkMs` adds the extras' allowance. After the host's answer it only ever shortens the host's window (`:1864-1865`).
  - The second device and a fresh checker each wait at most `checkMs` (4 s, plus the showdown's 15 s or 25 s under the test
    trigger, plus hoops and Crease), once each a move.
  - Worst case on a showdown turn: about 15 s longer than before this round, and only when the checker misses. No stall.
- **D3.** The window restarts once per device per move (`hosts`), and only with no answer in. `at` is set on the first ask and never
  reset. A device spared by the `waitMs` rule is counted at the next deadline if it still hasn't answered, once (`missed`). No double
  strike, no unbounded wait.
- **D4.** The late referee is drawn with the answering devices excluded, and their parties too (`pickDevices`' `parties`; everyone
  has a party, `s:<id>` alone). `n` is 1, so no same-party checker is added. Only the referee's `~late` answer counts. The outvoted
  device is struck, and so is a referee whose answer doesn't hold together. With no referee to draw, it's logged. Nothing waits on
  it, so no stall; an unanswered referee only leaves its small `lateChecks` entry behind.
- **D6.** A checker gets the brain only on Maia moves, with `check: true`, and the app loads Maia for a check as
  `useBrain(…, true)` does (a phone only if saved).
- **a6ddc0c / 8bd72a1.** `rewardFor` no longer reads `unvouched`, both reward-queue pushes drop `solo`, and `resendTo` goes through
  `rewardFor`. `why` is only "daily" in the server, the protocol and the app, and `noteAlone` only logs. Nothing else withholds a lone
  party's coins, crates or XP.

## Not checked

- Wrangler's long pull (his first move, a three-square string) against a liar's Maia claim: whether the engine server can score it.
  If it can't, there's no verdict and the host's move plays, unvouched. That's how it was before this round, and it happens once a
  battle at most.

## Runs

- Server unit suite at a6ddc0c: 1089/1089 (the PR body's 1087 plus main's merge). My proofs: 3/3.
- Chess unit suite: 1155 passed, 2 skipped (real Stockfish). Boss kit (`boss-kit.test.ts`) 22/22; `boss-brain.test.ts` 35/35.
- `npm run typecheck`: clean.
- I didn't run e2e.
