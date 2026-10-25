# The opening plays out with Animations off too, and the vote's gear has Motion trail (Oct 25, 2026)

**Eric, Oct 25, on the 50 v 50 vote screen's gear list:** "it's missing the motion trail… let's get this set like the other
one." And on the opening: "when you disable animations, it shouldn't just glitch your piece. It should still be showing the
opening back and forth… It should play it out very quickly on both sides, and then the game should start. That's how we've
always done it."

**Eric, Oct 25, the same thread, the rule for the opening:** "that should be overriding that. You should always be showing the
players the opening sequence of moves." So the opening plays out exactly as it does with Animations on, whatever the setting.
The setting doesn't reach it.

## What we saw

Reproduced in a 50 v 50 with a Random opening (`?format=team&start=random`, the test switch that skips the votes and starts
the vote's Random opening; `&anim=0` for Animations off). The board was read from the drawn pieces and the last-move
highlight, each time either changed. Before the fix:

| The first screen of the game | Animations | What the board showed |
| --- | --- | --- |
| Play (your team moves first) | on | The start, then the four moves a side in, one ply at a time (8 plies in about 1.4 s), gliding. |
| Play | off | The same: the start, then 8 plies in about 1.4 s, gliding. |
| Watching (your team moves second: White to move, you're Black) | on | The position after the opening, at once. No replay: 5 to 7 frames, the next change at about 7 s (White's pick revealed). |
| Watching | off | The same as on. |

Eric saw the watching case with Animations off, and it also happens with Animations on. A vote-path run (the gear switched off on
the vote screen) started on Normal, the bots having outvoted the Random opening, so it isn't evidence either way; the direct
switch is used for the tests.

## The cause

It isn't the Animations setting. The setting reaches only the vote's board, the crowd's ghosts, the shade moves, the duel
vote and Auto chess. The opening is replayed by `useReplay` (`packages/app/src/hooks.ts`), in the play screen: it plays the
moves since you last saw a board, or all of them from the start on a board new to you.

The screen you watch from (`WatchScreen`, `packages/app/src/screens/Crowd.tsx`), which shows a board when your team isn't
moving on it, wrote `match.seen` for the board the moment it opened. When the board later came up for you to play, the replay
found nothing missed and skipped the opening. This happens to a player whose team moves second: with a Random opening (an
even number of plies), that's Black. `docs/areas/crowd.md` already promised that a phone new to the board replays it from the
start.

## The fix

- **The watch screen replays through `useReplay`**, as the play screen does. A board you first see watching plays its unseen
  moves from the start, gliding, then shows the position; the picks' ghosts come in after the replay (`LiveGhosts` is hidden
  while it runs). The replay marks the board seen, so the watch screen's own write is gone (that write was the skip).
- **Animations: no change.** The replay's gliding doesn't depend on the setting, as Eric asked. Only the watch-first path
  changes.
- **Pace:** the replay keeps its rule. A watch screen's think time is short, so its replay runs at the fastest step (90 ms a
  ply, about 1.1 s for the four-move opening); the play screen paces it to its settling-in time (about 1.2 s measured).
- **Motion trail on the vote screen:** the gear there passes `crowd` as the match's own gear does, so a crowd match shows the
  Motion trail row (Animations' rules as in Settings). The openings' gear (`OpeningGrid`) passes `crowd` too: it only appears
  in a crowd match through a test switch (`augments=0` or `format=`), and the row belongs wherever the gear shows in a crowd
  match.

## Judgment calls

1. **The brief said "Animations on: unchanged".** The bug isn't about the setting: the watch-first path didn't play the
   opening with Animations on either. The fix changes that path for both settings, which is what Eric asked for ("always
   showing the players the opening").
2. **Other watch screens.** `WatchScreen` also serves Classic's watching. There too, a board you haven't seen now replays its
   unseen moves (up to five), the same rule as the play screen. Classic is being reworked and was not tested beyond the CI
   selection.
3. **Coverage of the watch-first path.** The colours are dealt at random by the solo match's random source, so the test can't
   choose the side. It checks whichever screen you start on. In the fixed build's 12 runs (both settings, phone and desktop,
   three repeats each), 5 started on watching and 7 on play, and all passed. Against the old build (phone, both settings,
   four repeats each), every play-first run passed and the four runs that didn't start on play failed.

## Tests

- `npm run typecheck`; `npx vitest run packages/app` (95 files, 1207 tests).
- e2e under the port lock, phone and desktop: `e2e/opening-animations.spec.ts` (new): a Random opening with Animations on and
  with it off, each checks the board shows the start first, then each dealt ply in order, gliding, and settles on the
  position after the opening within 4 s; the vote screen's gear lists Animations and Motion trail. Plus `e2e/votes.spec.ts`
  and `e2e/match-menu.spec.ts`: 24 passed, 4 skipped (the specs' own per-project skips).
- The new spec is listed under the Crowd area in `e2e/areas.json`, so a later change to `Crowd.tsx` runs it.

## Files

- `packages/app/src/screens/Crowd.tsx`: `WatchScreen` uses `useReplay`; `LiveGhosts` waits for the replay.
- `packages/app/src/App.tsx`: the vote screen's and the openings' gear pass `crowd`.
- `e2e/opening-animations.spec.ts`, `e2e/areas.json`, `docs/areas/crowd.md`.
