# Boss challenge: slower intros, players clear of the stools (and main's red town-chat test)

**Lane:** targeted (animation timing and the room's layout and camera, plus a shared e2e helper). CI's selection runs the whole
suite anyway: `e2e/helpers.ts` is traced to every spec that uses it.

## What Eric asked (Nov 2, after playing Big Boy's live)
"It happens so damn fast… slowly walk up to the chessboard, then say your line, then the tiles drop down, then the seats drop down.
Add a little delay between these things." And: "Big Boy and the pawn need to be a little more away from the table… Make sure they're
not standing where the chair blocks are; that looks like bad design."

## What changed
- **Pacing.** Every beat is now one number in `CHALLENGE_FEEL` (`packages/app/src/town/shops/challenge.ts`), laid out by `introBeats`.
  The line now comes on its own, **before** the board starts coming in (it used to play over the pyramid's rise and the blocks' stacking).

  | Beat | Before | After |
  |---|---|---|
  | Walk to the door in the town (you and the boss) | 90 ms a square (your run) | 200 ms a square (the town's walking pace) |
  | Inside the door before walking | 0 | 0.4 s (includes the 0.26 s fade-in) |
  | Walk up to the marks | 120 ms a square (0.84 s) | 180 ms a square (1.26 s) |
  | Settle onto the mark | 0.14 s | 0.25 s |
  | Facing each other before the line | 0 | 0.3 s |
  | The line | 1.8 s (the build started 0.4 s into it) | 2.5 s, alone |
  | Pause after the line | 0 | 0.3 s |
  | Big Boy: blocks stack, gap, board drops and plops, gap, stools drop | 1.64, 0, 0.18 + 0.41, 0, 0.69 s | 1.64, 0.3, 0.22 + 0.41, 0.3, 0.69 s |
  | Alfil: rise, hold, crack, crumble | 0.72, (to the line's end), 0.78, 0.76 s | 0.72, 0.6, 0.78, 0.76 s |
  | Default (Babur, Puddles): the table pops | during the line | 0.3 s after the pause |
  | The table alone | 0.35 s (none for the default) | 0.4 s |
  | Attack swung until the cover | from 2 s before the storm covered (default: 2 s, then 0.8 s of flash and wipe) | 2 s until covered, for every boss |
  | **Fight to covered** (3-square walk to the door; no loading) | **Big Boy 6.1 s, Alfil 6.1 s, default 6.5 s** | **Big Boy 12.2 s, Alfil 11.5 s, default 8.9 s** |

  Measured in the e2e run on a phone (local server, with the room's loading): Big Boy 12.8 to 13.9 s from the Fight tap to the swirl covering.
- **Standing clear of the stools: a little hop back** (Eric's second idea), not moved marks. You walk to and say the line on the drawn
  marks as before; as the stools come in (the default's pop, Big Boy's stools starting to drop, Alfil's table showing through the
  crumble) you and the boss each hop back (0.32 s, 0.3 squares up) to a clear place: you 2.2, the boss 2.6 squares from the table's
  middle (`CHALLENGE_FEEL.clear`, `Marks.youClear` / `bossClear`). It keeps the rooms' drawn marks meaningful (no art changes) and gives
  the stools' arrival a beat. One number for every boss: 2.6 is the widest need (Alfil's attack's feet); a unit test measures every
  boss's drawing, its attack's feet and the pawn against each table's stools.
- **Every boss's attack is swung in place** where it stands (Alfil's and Big Boy's used to drop in beside the table, which put Big Boy
  right on his B block). No drop-in from the sky over the boss's own spot.
- **The room's camera across is wider** (zoom 0.45 → 0.8, west 0.3 → 0.75): with both standing further out, the boss, both stools, the
  table and you all stay in view on a phone. Everyone looks a bit smaller in the room during a challenge.
- Lines, chat lines, the return to town and tokens are unchanged.
- Docs: `docs/areas/town-square.md` ("Challenging a boss"), `docs/decisions/2026-11-02-challenge-pacing.md`.

## Player-visible changes
- The walk to the boss's door is a walk, not a run; you both stand a beat inside, then walk slowly up to the table.
- The boss's line shows on its own for 2.5 s before anything appears on the table; each build step has a small gap after it.
- As the stools appear, you and the boss hop back a step; the B and W blocks (and the park stools) are fully in view.
- The boss's attack swings where it stands for about 2 s before the transition covers the screen.
- The room is framed wider during a challenge. No new text.

## main's red: `e2e/town-chat.spec.ts:1268` (phone, shard 5, 356dc03)
**Cause:** a race in the e2e helper, not in the app. The town square renders before the page's first `/api/me` answers (App.tsx returns
the town ahead of the account's splash), so `open()` can return while the page's own `/api/me` (which makes its guest account) is still in
flight. `asSignedIn` then asked `/api/me` through `page.request` without the page's session cookie, which made a **second** guest; the
email went on that one, and the page's own answer, landing after, put its cookie back. After the reload Bo was the first guest: typing
greyed "Sign in to chat with other players." The CI trace shows exactly that: Bo's context sent two cookieless `/api/me` (two
`Set-Cookie`s), and the reload's `/api/me` returned the first guest. Timing-dependent (Bo's town became ready within about 130 ms of its
`/api/me`), which is why it showed on 356dc03's shard and not before: nothing in #466 or #467 caused it.
**Fix:** `e2e/helpers.ts` `pageAccountId` waits for the page's own `hc_session` cookie before asking `/api/me` (used by `asSignedIn`,
`asServerAdmin`, `giveItems`, `backdateSoloBattle`). A focused check in `e2e/town-chat.spec.ts` holds the page's first `/api/me` back
1.5 s (answered from outside its cookies) and signs in: it fails without the fix ("Received: disabled") and passes with it.

## Checks changed (old → new)
`e2e/boss-challenge.spec.ts`:
- Babur's swing: `toMatchObject({ …, boss: [8, 12] })` → the boss's column `toBeCloseTo(9.5 - CHALLENGE_FEEL.clear.boss)` (he hopped back clear).
- Big Boy's "the table stands": step `/table|done/` → `/table|swing|done/` (the swing beat now follows the table's).
- Added `clearOfStools` (Alfil, Babur, Big Boy): once the stools are in, you and the boss stand at the clear places.
- Big Boy's GIF frames now start at the Fight tap, each with its ms (and the Fight-to-covered time is written with the stills).

`e2e/town-chat.spec.ts`: one test added (above). `e2e/helpers.ts`: the sign-in helpers wait for the page's own account.

`packages/app/test/boss-challenge.test.ts`:
- Alfil's timeline "the line, the pyramid rising under it…" → "facing each other, the line alone, a pause, the pyramid rising, holding, cracking, crumbling, the table alone, his attack".
- Big Boy's timeline "the line, the blocks building under it…" → "…the line alone, a pause, the blocks stacking, a gap, the board…, a gap, the stools…".
- The three "is short: … under 6 s" checks → "about 10 to 12 s from Fight to the cover: Big Boy's and Alfil's 11 to 12.5, the default's 8.5 to 11".
- "starts attackLeadMs before the storm covers" and Big Boy's "his attack from 2 s before the swirl covers" → the attack starts after the table's beat, `swingMs` (2 s) before covered.
- The default's "the line, then the attack swung in place" and "the table pops in during the line" → face, line, pause, pop, table, swing; the pop after the line.
- The walk in "≤ 1.2 s" → "1 to 2 s" (a slow walk).
- The marks check adds the clear places; the clear-squares check covers them.
- New: each beat's numbers, the hop back's timing, and no figure near the floor in front of a stool (every boss's drawing, its attack's feet, the pawn; per table).

None of these guards a rule in `docs/rules/eric.md`.

## Tests run locally
- `npx vitest run test/boss-challenge.test.ts` (packages/app): 39 passed. `npm run typecheck`: clean.
- `e2e/boss-challenge.spec.ts`, phone and computer: 6 passed. The town-chat test at 1268 and the new check, phone and computer: 4 passed
  (and the new check failing without the fix).

## Visuals
- `docs/challenge-pacing/bigboy-table-phone.png`, `alfil-table-phone.png`, `babur-table-phone.png`, `puddles-table-phone.png`: each boss at
  the table, both stools in full view (phone).
- `docs/challenge-pacing/bigboy-intro-phone.gif`: Big Boy's whole challenge from the Fight tap to the swirl covering, at real timing (a
  frame every 0.25 s; where the phone's screenshots lagged, during the room's loading, the last frame holds).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
