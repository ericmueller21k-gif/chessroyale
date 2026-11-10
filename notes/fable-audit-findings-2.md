# HunChess: outside review, part 2 (Nov 10, 2026)

The last three area reviews: phone performance, the rules engine and bosses, and tests and dead weight. Part 1 is
`fable-audit-findings.md`. Nothing in the game was changed.

**Confidence.** These come from three read-only reviewers. I did not re-run their measurements. "Ran it" and
"measured" are theirs. Performance was measured on a desktop Chromium throttled 4x to stand in for a mid-range
phone, not on a real phone, so read the times as rough.

## Two corrections to part 1

- **The stylesheet is not worth splitting.** 96% of it is unused on home, but it parses in 27 ms; only 2% is
  dead. I had flagged its size as a problem.
- **The lobbies don't repeat each other's text.** Copy-paste is 0.08% of the code, all of it art. The four
  Durable Object shells share a shape (same 12 method names, about 150 lines each), not lines. The cost is rules
  drifting apart (Squads missing guards the main lobby has), not lines to delete.

## Phone performance (measured)

| What | Value |
| --- | --- |
| First content on home, phone-like CPU | 7.6 to 8.7 s (12.8 s on a slow connection) |
| Same, desktop CPU | 1.9 to 2.7 s |
| Boss art built at load | about 6 s phone-like; 1.45 s desktop; 17.6 MB of memory |
| Memory on home | 287 MB; 119 MB without the engine workers |
| Main script | 2,398 kB (836 kB compressed), one chunk |
| First-visit offline cache | 155 files, 9.2 MB |

1. **Boss art at load is about 6 s on a phone, not 1.4.** Your figure is right for a desktop. All of it is before
   anything shows. `characters/smudgy.ts:115-136` is a quarter of it (its stroke computes the same thing twice
   per pixel). The lazy-load fix in progress is the right one. *Saves about 6 s and 17 MB.*
2. **Home starts 3 or 4 Stockfish workers, about 56 MB each** (`App.tsx:530-532`, `engine.ts:48`). Warm one; start
   the rest when a match that judges begins. *Saves 110 to 170 MB.*
3. **The page is blank until the whole script has run.** A static shell in `index.html` (logo, PLAY outline) shows
   content at about 0.3 s whatever the script does.
4. **About half the main chunk isn't needed for home.** All imported up front in `App.tsx`: FAQ (`:43`) and Legal
   (`:49`), 147 kB for two imports; AutoChess (`:38`); Squads (`:59-60`); solo with the runner, chess.js and the
   boss rules (`:16`); the match screens (`:22-25`). Load them on entry, as Town and Colosseum already are.
   *Saves about 400 kB compressed: 2.4 s on a slow connection.*
5. **The town redraws every frame and never idles** (`Town.tsx:1148-1153`). Script alone was over the frame budget
   when throttled. Headless Chromium overstates this: confirm with `@perf` on a real phone before acting.
6. **The town cuts all 14 sidekick sheets into 875 canvases on entry** (`town/render.ts:305-320`), 13 MB. Cut a
   sheet when its sidekick first appears.
7. **The offline cache takes everything**, including the demo video in both formats (`vite.config.ts:82`). Drop
   one format; cache lazy art on first use. *Saves 0.7 to 3 MB of first-visit data.*
8. Small: home's art timers keep firing in a hidden tab (`home-art/Pic.tsx:45-51`); boss sprites wake 60 times a
   second for frames that last 100 ms (`BossCharacter.tsx:369`, `GodKing.tsx:83`).

**Already good:** no animation loop on home; Maia's 25 MB loads only near a boss battle; the 18 MB ambience is
streamed; the town and Colosseum stop when hidden.

## Rules engine and bosses

No high-severity bug. The rules checked out: Glicko math, the draw, cuts, team finals, mate attribution. A
lockstep test of all 17 bosses (one runner in memory, one saved and restored after every step) matched at every
step but for the two items below. The judge is deterministic. No boss was found to make a broken position or a
soft lock, though 12 bosses were checked by search and test only, not read.

1. **Online, the King's strike comes more easily than solo (ran it).** The bots' backing for a strike is drawn
   once per move, but it isn't saved, and the server restores the runner on every event (`runner.ts:725, 1385`;
   `lobby.ts:2170`). Each new caller re-rolls the bots. In 300 seeded runs the count shown went down 24 times and
   the King struck 64 times where he would not have solo.
2. **The boss's last move is lost between events online (ran it).** It isn't in the saved state
   (`runner.ts:344-352, 1395`), so later messages carry `lastMove: null`. The line "his only move went through
   the saw / pie / block" (`Play.tsx:210`) can never show online on the crowd's turn.
3. **A host's scores aren't checked for type or range (ran it; host path only).** `expectedAfter: { a2a4: "x" }`
   turns every player's score on that board into "not a number" for the rest of the match, and the cut becomes
   arbitrary; a value of 7 costs another player 650 points (`lobby.ts:2372-2400`). The judges' path is checked
   (`judge.ts:185`). This is part 1's finding 5 again, from the other side.
4. **A tie at the last cut is decided by rounding (ran it).** `match.ts:473` compares raw sums; 0.1 + 0.2 and 0.3
   are "different", so the stated rule (a tie goes to less raw loss) isn't applied. Use the same `sameScore`
   check the other cuts use (`match.ts:520`).
5. **A missed move inherits the worst picker's streak bonus** (`scoring.ts:352-355`; ran it). At most 1 point.
6. **Unchecked message fields.** `bossMove.move` is never type-checked and can throw in the gardener's watering
   step (`gardener.ts:646`). `botPlan` picks are shown to everyone as the bots' live votes as sent
   (`lobby.ts:1294, 2281`). Any player can append to the log without limit through `crossCheck`
   (`lobby.ts:1286-1290`). The three Durable Objects cast parsed JSON straight to the message type
   (`lobby-do.ts:464`); one small validator at the door would cover all of these.

**Where boss code leaks into shared files** (lines that name one boss's own symbols):

| | runner | protocol | lobby | net | solo | total |
| --- | --- | --- | --- | --- | --- | --- |
| Chub & Chirp | 35 | 5 | 10 | 6 | 7 | 63 |
| Hollow | 26 | 3 | 2 | 8 | 18 | 57 |
| Dash | 8 | 3 | 6 | 10 | 11 | 38 |

Others run from 35 (Big Boy, Alfil) down to 0 (Ginger). The boss message type has about 70 fields, nearly all for
one boss each. Hooks that would move most of it out, biggest first: (1) `turnSteps`, a step before his move or
the crowd's, replacing about 50 hand-over methods (`runner.ts:548-1919`) and the if-chain at
`lobby.ts:1877-1960`; (2) one widened `asks` and `answer()` for the host's extras; (3) `wins(boss)`; (4)
`clock(boss)`; (5) `judge.job(boss, fen)`.

**Cost at 100 players is fine** (7.8 ms a round). Two items: `lastGroupmates` is 39% of the saved match state in
50 v 50 and never read there (`match.ts:403`); each vote message rebuilds the standings once per person, about
21 ms (`lobby.ts:1569`).

## Tests and dead weight

**There is little to delete.** One dead file (`components/PauseMenu.tsx`) and about 200 lines; a dozen functions
never called (`setBotThink`, `crowdMayPlay`, `startsWithSnack`, `startsDark`, `halfPawns`, `boardSawn`,
`buildReaction`, `honestFindChance`, `inviteLink`, four `*Events`). **Do not trust a dead-code tool here:** knip
reports 11,700 unused lines, nearly all of it art that registers itself when imported
(`town/shops/alfil-art.ts:111`) or the sidekick sources a bake script reads.

1. **About a quarter of e2e time tests logic through a browser (measured).** 34 specs with under 5% layout checks
   cost 6,545 of 25,322 test-seconds. A solo match already runs without a browser in 9 unit files
   (`packages/app/test/boss-clock.test.ts:34`). Clearest: `crowd-hidden.spec.ts` (447 s, no layout checks);
   `king-save-altered.spec.ts` (has a unit twin); `boss-challenge.spec.ts` (765 s polling step names two unit
   files already cover); `squads.spec.ts` (uses no page: a socket test inside Playwright); `xp-rewards.spec.ts`.
   20 to 30% could move with no loss. Almost nothing can simply be deleted.
2. **The typecheck skips 75,000 lines of tests (measured).** `packages/app/tsconfig.json` covers only `src`; e2e
   and scripts have none. Checked with a temporary config: 91 errors in 30 app test files, 75 in e2e. Test
   fixtures have drifted from the real shapes unseen.
3. **E2e never runs the server as production does (read).** `playwright.config.ts:37` always has the test
   switches on and the engine off, and no sign-in, so every online match in tests is played by guests;
   production refuses guests. Sign-in, the guest merge and the engine server's re-check have unit tests only.
   No Safari-engine (WebKit) run, for a phone-first app. No test drops the connection. No test sends a message
   with a wrong-typed field.
4. **Tests that can't fail.** `boss-bubble-header.spec.ts:70` swallows its own assertion. `judges.spec.ts`
   compares deep re-checks only if one happened and never asserts one did. `dash.spec.ts:314-366`,
   `formats.spec.ts:105` and `crowd-scoring.spec.ts:193` check only when the game happens to go a certain way.
   About 50 unit tests are searches of source text (`battle-desktop.test.ts:20`).
5. **The main lobby is the only room that doesn't retry a failed save.** Squads queues and retries
   (`squads-do.ts:144-152`), 1 v 1 retries; the lobby sets `resultsSaved` first and swallows the error
   (`lobby-do.ts:165, 189`). Same root as part 1's finding 9.
6. **Test switches are properly gated.** No path lets a normal player change a real match or reward. Two notes:
   an admin's ultimate trigger in a public match removes XP for everyone in it (`lobby.ts:1266`); and
   `keep_vars: true` means a `TEST_SWITCHES` set in the Cloudflare dashboard would survive deploys, so check it
   isn't set there.
7. **Repo weight.** 330 images (121 MB) under docs/ and reports/ that no file names; a leftover `public/engine/`
   at the repo root (1.8 MB, nothing reads it); `scripts/boss-art/out/` (2,012 committed lines of output).
8. **Docs are accurate but heavy.** A boss helper following CLAUDE.md reads about 73,000 tokens before any code
   (bosses page 54k). Stale: `ops.md:158` cites a deleted file; `ops.md:153-154` says one switch check, the code
   has 13 direct ones; `matchmaking.md` says `MATCH_FILL_SECONDS` is in `wrangler.jsonc`, it isn't;
   `town-square.md:657`, `bosses.md:658` and `colosseum.md:155` cite files that don't exist.
9. **No linter.** Strict TypeScript is on. `sharp` is used by 10 scripts and declared nowhere.

## Quick wins from this part (under an hour each)

1. Save `strikeBots` and `bossLast` in the runner's snapshot.
2. Range-check the host's scores as the judges' are (`okScore`).
3. Use `sameScore` at the last cut.
4. Type-check `bossMove.move`; cap `crossCheck`.
5. Warm one engine on home, not four.
6. Load FAQ and Legal on demand.
7. A static shell in `index.html`.
8. One video format in the offline cache.
9. Fix the swallowed assertion in `boss-bubble-header.spec.ts:70`.
10. Delete the root `public/engine/` and `PauseMenu.tsx`.
11. Check `TEST_SWITCHES` isn't set in the Cloudflare dashboard (Eric).
