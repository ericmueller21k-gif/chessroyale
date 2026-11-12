# How the Hidden Boss works today (write-up for the director, Nov 12)

Written from the code on main (cb60a50) and the area pages. The deep detail is in `docs/areas/bosses.md` (his roster row;
"The Hidden Boss's phase 2"; "His chatter") and `docs/areas/crowd.md` ("The endings"). This page is the overview, so the
house/building work doesn't have to ask Eric how he works. **Eric's own words win wherever this page and he differ.**

## Who he is
- Roster entry (`packages/core/src/boss.ts`): `{ id: "recluse", name: "Hidden Boss", icon: "📕", kit: "Hidden Boss",
  powers: { passive: "nohelp", ultimate: "bullet" }, adminOnly: true, crowdFinal: true, the: true, levelUnknown: true }`.
  - `recluse` is a working id. His name is that one string, and Eric will name him later. Every screen reads it from there.
  - `adminOnly`: hidden from players. `crowdFinal`: the Crowd's boss final always meets him. `levelUnknown`: his level shows "LVL ???".
- **Never named, never shown plainly to players:**
  - On the Boss Battle select screen his tile is his figure as a black silhouette edged in violet, on a dark tile, with "???".
    Every way to play is locked. He has an ominous hum and Eric's two lines in turn: "Team up on me. It wouldn't be the first
    time anyone did that." and "You're not ready to fight me yet." The pick is never saved on the device.
  - He's never on home's rotating boss card, never in the town chat or the Colosseum stands, never chosen at random, and never
    in a player's boss menu.
- **His look:** a pixel-art man with a book (the spellbook he consults, slams shut and casts from). Art and frames:
  `packages/app/src/characters/recluse.ts`, effects `characters/effects/recluse.ts`, sounds `recluse-sounds.ts`, lines
  `recluse-lines.ts` (`RECLUSE_LINES`), the drawing component `components/Recluse.tsx`.
- **In the town today: only as a statue.** The marble statue left of the Colosseum gate is him in stone: his idle frame without
  the book, in marble shades (`town/houses/statues.ts`; `STATUES` in `town/world.ts`, its quote word for word, no
  attribution). He has **no home** in the town yet. The 14 homes are in `town/world.ts`, and none is his.
- **Writing rules for his lines** (`docs/rules/eric.md`, "Writing") and RULES.md "Real people": everything about him is original.
  The new building is an original building in the reference's style: no name, sign, plate or lettering from the photos.

## Where he can be fought today
1. **The Crowd 50 v 50's boss final, for everyone, solo and online.** When the pre-game vote picks the boss ending, the top 4
   players team up against him, and only him, whatever boss was picked or met last.
   - The rule: `crowdFinalBoss()` and the runner's `startBoss`.
   - The vote card: "Hidden Boss", 📕, "Top 4 team up against him" (`bossFinalOption` in `votes.ts`).
2. **Boss alone, for an admin only.** He's listed after every other boss in the admin's boss menu (`menuBosses`,
   `hiddenBosses`, `adminPlayable`).
   - Players can't pick him there.
   - URL triggers work for admins (e.g. `?side=b`, `?power=bullet`).

Not in a Boss raid, not by a lobby's creator, not at random. **No reward** comes from beating him: rewards come only via
Squads, per ROADMAP.md.

## Phase 1 (his fight everywhere he appears)
- **The start:** from the starting position, never a book opening (he has no memorized lines). He plays White and moves first
  (`?side=b` turns it around).
- **His brain is fixed** (`BOSS_BRAIN.fixed: { recluse: "maia-raw" }`): Maia-3 at its top rating, raw, with no guard and no
  Stockfish share. His strength is a fixed ~2650 (`fixedLevel`), whatever the difficulty, the crowd's rating or the Brain picker.
  The roster `offset` is unused.
- **Passive, "No help"** (`nohelp`, `blocksKing`): the God King's move, strike and Last Stand never work against him.
  - Pressing "Play move" or "Strike" makes him slam the book shut and mock it (`mockKingHelp`, the God King's "blocked" line).
  - Each try still spends a charge, as if it had worked (`kingTried`). With none left, the God King can't be called.
  - Your move goes on. The Last Stand, which nobody calls, spends nothing.
- **No strikes** (`noStrikes`): he never knocks out the crowd's worst mover. His card counts the moves left instead
  ("12 moves left").
- **Ultimate, "Bullet"** (`bulletMeter`, his own meter, not the rage meter):
  - The meter is full at turn 7 (`bulletTurn`) and fires with no warning. He opens the book, slams it, says his line,
    "BULLET!", "No added time."
  - From then on every bank is 60 s (`bulletBankSeconds`) with no per-move cap. A bank that runs out loses on time
    (`bossOutOfTime`, "won on time").
  - After 3 plain moves (`bulletPlainMoves`) he grudgingly adds time: "+2 s a move from now on" (`bulletIncrementSeconds`), and
    the dock says "Bullet 1+2".
- **His chatter:** a line about every 15 s of play (`RECLUSE_TALK`: suspicious muttering, then accusations, then angry
  ranting) about the team and the God King against him. It's the lowest priority and never talks over another line
  (`recluse-talk.ts`).
- **Beaten:** the board holds 4.5 s while he collapses and mumbles (`fallMs`). Where phase 2 follows, only 1.8 s
  (`PHASE_CHANGE.fallMs`).
- **Online** (the Crowd final): the lobby runs all of this through the shared runner.
  - His brain runs on the host's device. The God King's tries go through `NetMatch.callKing`, and the lobby spends the charge.
  - The bullet clock and its increment come from each person's deadline (`allowedMsFor`), and a loss on time shows in the
    results' `timeout`.
  - Only the mock plays on the device that tried.

## Phase 2 (SOLO ONLY: an admin's Boss alone, and a solo Crowd final you reached)
**Not online yet.** It needs four boards online, his server-side Stockfish and fair-play hooks: a separate build. Online,
winning phase 1 is the crowd's victory.

- **The phase change** (`packages/app/src/recluse-phase2.ts` `PHASE_CHANGE`, drawn by `screens/Recluse2.tsx`): about 25 s,
  one timeline, not skippable.
  - **The absorption.** The God King raises his sword and gloats, and the kneeling boss says he'll take that power. A golden
    stream drains the God King into his raised hand, the God King cries out and fades away in light, and the boss's fist
    closes.
  - **His half-engine look** ignites from then on: a cold-blue left eye with faint circuit lines, an overlay that leaves the
    sprite unchanged.
  - **The cast.** He rages, leaps onto the board, throws the book down open and chants as light pours up. Blue arcs strike
    while the board cracks into four, each quarter growing into a whole board as the pieces fly to their Chess960 squares.
    He leaps back. "PHASE 2".
  - **The countdown:** 5-4-3-2-1 on every board, "2:00 on your clock", "No added time."
- **Phase 2 itself** (rules `packages/chess/src/bosses/recluse-phase2.ts`, screen `SimulScreen`):
  - **The boards:** four, each its own Chess960 start (all different, from the battle's seed). The players are White. You play
    board 0, and the other three finalists (bots) play the others.
  - **His brain:** Stockfish only (`phase2Brain`: Elo 2750, about 900 ms a move), one engine serving the boards in turn. He has
    no clock.
  - **Clocks:** each player has 120 s (`bankSeconds`), no increment.
  - **How a board ends:** mate, a draw, time or resigning. The others play on.
  - **Winning:** only with all four boards won (`phase2Outcome`). The result reads "won N of 4".
  - **What's gone:** no power-ups, no items, no God King (he was absorbed, and his place in the dock stays empty).
  - **The phase 2 ultimate, "5 SECONDS!":** any move longer than 5 s (anyone's, any board) is a "slow move" for the team, shown
    as red X marks beside your board. The team's 10th slow move brings it (`phase2Ult`). From then on every move has 5 s; out
    of time, a random legal move is played for that player (never a loss on time).
  - **His chatter** continues, and every third line mocks the engine he took.

## How it maps onto a building / 4-player challenge (for the house work)
- **The "four against him" idea already exists:** the Crowd final's top 4 is the only multi-player way to fight him today,
  and his phase 2 has exactly four boards, one per player.
  - Online today a group of 4 gets **phase 1 only** (the shared runner, the host's device for his brain).
  - Phase 2 online is unbuilt (four boards online, server Stockfish, fair play), so a "4 players from the room fight him"
    challenge would be **phase 1 online**, with phase 2 as the later build.
- **The town's homes:** `town/world.ts` (the list of homes, ids = roster ids) and `town/shops/shops.ts`.
  - `canChallengeInside(id)` lets a home's card offer Challenge only when the roster has that boss with a kit and powers
    (`adminPlayable`). With a home id `"recluse"` the Challenge would be live, because he has both, but only an admin can
    reach him today (`adminOnly`).
  - Opening him to the 4-player room challenge means a deliberate exception to `adminOnly`, like `crowdFinal`. That's
    Eric's call: his tile stays locked everywhere else?
- **Admins first:** new town content goes to admins first (`BOSS_ADMIN_FIRST`, as with Don Dough).
- **Sim:** phase 1 has never been sim-tested for balance (bosses.md says so).

## Code map
- **Rules:** `packages/chess/src/bosses/recluse.ts`, `recluse-phase2.ts`, plus `boss-powers.ts` and `boss-timing.ts`.
- **App:** `screens/Boss.tsx` (phase 1), `screens/Recluse2.tsx` (phase change and phase 2), `recluse-phase2.ts`,
  `recluse-talk.ts`, `components/Recluse.tsx`, `BossDock.tsx`, `BossPowers.tsx`, `solo.ts`, `godKing.ts`.
- **Characters:** `characters/recluse*.ts`, `characters/effects/recluse.ts`, `characters/boss-select.ts` (his locked tile and
  its lines).
- **Settings** (`packages/core/src/settings.ts`): `RECLUSE_TALK`, `RECLUSE_PHASE2`, `BOSS_BRAIN.fixed`, the bullet keys.
- **Tests:** e2e `recluse.spec.ts`, `crowd-hidden.spec.ts`, `boss-select.spec.ts`; unit `packages/app/test/recluse*.test.ts`,
  `packages/chess/test/recluse*.test.ts`.
