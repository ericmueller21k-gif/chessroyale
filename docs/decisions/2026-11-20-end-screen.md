# The end screen, built (Nov 20, 2026)

Eric's brief of Nov 20 and his answers, on the approved mockup (branch `claude/end-screen-mockup`, stills on `stills/end-screen-mockup`:
"they look very good"). Built on the real result screens: `components/EndScreen.tsx`, `end-screen.css`, the timings and sizes in
`END_SCREEN` (packages/core/src/settings.ts).

## Eric's words that set it
- "we don't need to make the big xp number so pixelated I think normal is fine": XP EARNED's number, the RP number and the "+150 XP"
  that lands in the bar's slot are in the UI font. The headline ("Victory!", "Floor 3 cleared!") keeps the pixel type.
- The bar's span is `XP.perLevel` (RP: `RANKED_1V1.pointsPerDivision`), never a number of its own.
- Ranked 1 v 1: its own result page like the boss screens, the move-by-move below, not a card over the board.
- RP lost: "RP LOST 14", the count in red, the bar draining.
- A tap anywhere that isn't a button skips the whole sequence to its end (no more sounds, the final numbers). Buttons work at all times.
- 50 v 50, Squads: the same headline, XP and quest rows, each with its own middle.
- Every match end screen; a loss: "Defeat", "Floor X lost · N lives left" (red, still), the bosses gloating 1-2-1; no "You beat X", no
  engine rating / average time / power-ups tiles, no "Scoring took … ms"; "Est. rating" small and centered under the review's move line;
  never the tower's floor count; centered; nothing shifts; reduced motion: the end at once, one ding.

## What changed
- `EndRewards`: (ranked: RP EARNED / RP LOST and its bar), XP EARNED, the screen's middle, the XP bar, the quests this game moved
  (`questsMovedBy` in quests.ts). One sequence (`useEndSequence`): the count, the lob, the fill (a level or division crossed: flash,
  pop, on from the other end), then the quests. Every box at full size from the first frame; while the game's XP is still coming the
  bar stands at your profile's XP and the number's line says "Counting your XP…".
- Boss battles and tower floors (`Results.tsx`), the 50 v 50 and Classic (the same screen), Squads (`Squads.tsx`: the knocked-out card
  and the results), ranked 1 v 1 (`Duel.tsx`, `DuelEndPage`, with `GameSteps` under it).
- `XpResult` (the Nov 9 box) is gone (its `useGameXp` stays). `RewardBox` shows after the sequence ends and, on the end screen, only what
  the bars and rows don't: crates, keys, a boss crate to choose.
- The tower floor's line moved into the headline (`useTowerEnd`): "Floor 3 cleared!", "Floor 4 lost · 1 life left", "Run over on
  floor 4", "Top of the tower!"; the next floor's line and Back to the tower stay under the rewards. The button no longer waits for the
  pictures (Eric: buttons work at all times), only for the server's word.

## Calls made (Eric can flip any)
- **One boss, outside the tower:** the middle is still `ResultDuo` (his bow, his line in his bubble, his attack on a loss: Nov 9's
  design), with your XP moved to the bar under the row. The 1-2-1 lineup (`EndDuo`, his victory beat on a loss) is for tower floors, as
  mocked. Swapping is one line in `Results.tsx`.
- **The line under "Victory!" outside the tower:** "Ginger defeated!", "Ginger wins", "A draw with Ginger" (no "You beat X"). A crowd's
  or a reason's words (on time, the carrots, the bulbs, the Hidden Boss's boards) stay as the line under the rewards.
- **The parts stay**, small, under the number ("Win +50 · Daily reward +200"), so the total is explained (the old box showed them).
- **Ranked's own page** only for a played ranked game. An aborted game, a bot's and the town's keep the card under the board (none earns XP).
  Placements, the placing game and the top tiers show the rank still in the RP slot ("Placement 2/5"); only a game inside the divisions counts.
- **Quests shown** are those this game moved, compared with the counts this page last read (home's, the last end screen's), so each
  match shows its own; home's overlay still slides what it hasn't shown (its own memory, untouched). None moved: "No quests moved this game."
- **Squads' middle:** your squad's tag and members. Headline "Victory!" for the champions, else your place ("3rd of 8").
- **Auto chess is left as it is:** it earns no account XP or quests (a game on the device), so there's nothing for the sequence to show.
  Making it earn XP is a rules change for Eric.
- The podium's heading became an h2 (the end screen's title is the page's h1); its look is unchanged.
