# The God King and the boss battle's presentation

Lane: `god-king`. The bosses' own rules and art are on [bosses.md](bosses.md).

## How it works today

- **Who he is.** The crowd's champion in every boss battle (the raid, the Crowd's boss final, solo's "Boss alone"). He
  stands in the dock under the board (a computer: by the board), talks now and then, and can be called to act. He is
  secondary to the chess: big moments are rare and short, and there is no instruction text on screen.
- **Charges.** He has up to `kingChargesMax` (3) charges. Power-ups convert to charges (`kingPowerUpsPerCharge`).
  Tapping him opens his command menu: **play this move** (he plays the best move for the crowd, with his bolt) or
  **strike the boss** (three bolts and slashes on the boss's king: the boss's next move is weakened by
  `kingStrikeLoss`). Bots in the crowd follow him (`kingBotLoss`, `kingBotFollow`).
- **The clock stands still** while he acts, for everyone, solo and online: a move lengthens the reveal by
  `KING_COMMAND.moveMs`, a strike stops every deadline for `kingStrikeMs`. Nothing he does costs anyone time.
- **His Last Stand.** Always armed, once per game. If the crowd's played move gives away at least the bar (in points
  of expected score against the best move, by the judge's own numbers), he dives onto the board, takes the blow and
  falls; the move is undone and the crowd picks again with a fresh clock, the move he took back barred. The bar starts
  at `lastStandLoss` (plus `lastStandChargedExtra` while he has charges) and falls to `lastStandLossFloor` over
  `lastStandDecayMoves` crowd moves; never when the best move was already worth `lastStandFrom` or more (a lost
  position). Charges he falls with go to the crowd as power-ups. The round's scores stand.
- **Fair.** A power never changes how a player's own pick was judged, and a move he plays never earns brilliant credit.
- **His lines** come from cues (a new danger to your queen or king, a mate threat, a queen taken, his own acts, a boss
  power…). Critical cues always speak; everything else is paced by `KING_SPEECH` (about 5 to 10 lines a game). Each
  line then follows the speech rule every speaker shares (`speech.tsx`, `SPEECH`; Oct 10): it types out and stays
  readable for 2.5 s plus 50 ms a character (at most 7 s); a critical line cuts in on a remark or small talk, but
  waits for another critical line to have its time; the others wait their turn and lapse after 5 s.
- **Looks.** Pixel art in the boss characters' format, in white and black versions (a recolour of the armour only,
  in the crowd's colour). SNES/Fire Emblem style: pixel portraits, slanted cut-in banners, retro sounds, a Press
  Start 2P speech bubble. Drama yes, gore no (cracks, sparks and a few stylised red drops are the limit).
- **The boss battle's presentation:** the intro (the boss's card, the game so far replayed, "START!"), the fight
  banners (`FightBanner`), the boss's move and its banner when it takes your queen, the dock.

## Where the code is

| What | Where |
| --- | --- |
| His powers' rules, charges, the Last Stand (`lastStandBar`, `lastStandDue`) | `packages/chess/src/runner.ts` (the boss battle), `packages/core/src/boss.ts` |
| Timings the server and the screens share | `packages/chess/src/boss-timing.ts` (`KING_COMMAND`, `KING_SUMMON`, `LAST_STAND`, `BOSS_INTRO`, `bossShowMs`, `bossThinkMs`) |
| Online: the server's side and the messages | `packages/server/src/lobby.ts`, `packages/chess/src/protocol.ts`, `packages/app/src/net.ts` |
| Solo | `packages/app/src/solo.ts`, `packages/app/src/game.ts` |
| His pixel art (parts, poses, looks, portraits) | `packages/app/src/characters/god-king.ts` |
| Where he's drawn, his on-board animations | `packages/app/src/components/GodKing.tsx`, `LastStand.tsx`, his sections of `styles.css` |
| Banners | `packages/app/src/components/FightBanner.tsx`, cut-ins in `GodKing.tsx` and `LastStand.tsx` |
| The dock and his command menu | `packages/app/src/components/BossDock.tsx` |
| His lines | `packages/app/src/godKing.ts` |
| The boss screens | `packages/app/src/screens/Boss.tsx`, the boss parts of `Crowd.tsx` and `Play.tsx` |
| Sounds | `packages/app/public/sounds/god-king/`, `public/sounds/banner/` (CC0, credited in `CREDITS.md`), `src/sound.ts` |

## Settings

`packages/core/src/settings.ts`: the `king*` keys (`kingChargesMax`, `kingPowerUpsPerCharge`, `kingStrikeLoss`,
`kingStrikeMs`, `kingBotLoss`, `kingBotFollow`, `kingOnBoard`: the old summon-onto-the-board style, kept off), the
`lastStand*` keys, and `KING_SPEECH`.

## Tests and tools

- Unit: `packages/chess/test/last-stand.test.ts`, `packages/app/test/god-king.test.ts`,
  `packages/app/test/god-king-sprite.test.ts`, `packages/server/test/lobby.test.ts`.
- e2e: `e2e/formats.spec.ts` (the boss final), `e2e/boss-powers.spec.ts`.
- Frames in the game: `npm run frames:god-king -- <dir> [w|b] [phone|desktop|both] [summon|laststand|all] [light|dark]`.
- Sheets and GIFs: `npm run preview:characters -- <dir> only=god-king`, `node scripts/preview-god-king.mjs out.png banner=1`.
- Sims: `packages/sim/scripts/last-stand-sim.ts`, `last-stand-blunders.ts` (`reports/last-stand.md`).
- e2e for his lines' time: `e2e/boss-speech.spec.ts` (his opening line held for its full time). Unit:
  `packages/app/test/speech.test.ts`.

## Rules for this area

- Everything he shows comes in white and black versions.
- Tunables in `settings.ts`; timings the server and the screens must agree on in `boss-timing.ts`.
- Add a test switch (a `?query` flag) that forces any new moment in solo, so Eric can see it on demand.
- His words go through his voice (`kingSay`), held by the speech rule; never draw a line in a box a screen owns.
- Watch every moment frame by frame on a phone (`npm run frames:god-king`), in light and dark mode
  (`.claude/LESSONS.md`).
