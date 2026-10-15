# The God King and the boss battle's presentation

Lane: `god-king`. The bosses' own rules and art are on [bosses.md](bosses.md).

## How it works today

- **Who he is.** The crowd's champion in every boss battle (the raid, the Crowd's boss final, solo's "Boss alone"). He
  stands in the dock under the board (a computer: by the board's bottom-right corner, mirroring the boss by its
  bottom-left, his words and menu opening outwards; Eric, Oct 11; a phone: on a line of his own under the dock's row, in
  its middle, his words and menu opening above the row, or beside the row where the screen's column has room right of
  the board; Eric, Oct 15: see [bosses.md](bosses.md), "The dock under the board"), talks now and then, and can be called to act. He is
  secondary to the chess: big moments are rare and short, and there is no instruction text on screen.
- **Charges.** He has up to `kingChargesMax` (3) charges. Power-ups convert to charges (`kingPowerUpsPerCharge`).
  Tapping him opens his command menu: **play this move** (he plays the best move for the crowd, with his bolt) or
  **strike the boss** (three bolts and slashes on the boss's king: the boss's next move is weakened by
  `kingStrikeLoss`, and the boss's rage meter gains `BOSS_POWERS.rageStrike`, a quarter of it, at the boss's
  `rageSpeed`: Eric, Oct 11, "like a video game"; nothing while an ultimate's effect runs; `strikeRage` in
  `boss-powers.ts`, from `callStrike` in the runner). Bots in the crowd follow him (`kingBotLoss`, `kingBotFollow`).
- **His word after Ginger's blizzard** names what the storm left free: the queen's lines, the king's
  (`blizzardKing`), or another piece's (`blizzardOne`), from the moves allowed.
- **No charges left** (Eric, Oct 15): a tap on him gets his soft "can't" (two quick, muffled low notes falling,
  synthesized: `characters/god-king-sounds.ts`, made ahead in the sound worker's table as the bosses' are, `kingCant`)
  and a tiny shake, dimmed a moment (`.gk-unit.nope`, 0.4 s); nothing else (no menu, nothing spent).
- **The clock stands still** while he acts, for everyone, solo and online: a move lengthens the reveal by
  `KING_COMMAND.moveMs`, a strike stops every deadline for `kingStrikeMs`. Nothing he does costs anyone time.
- **His Last Stand.** Always armed, once per game. If the crowd's played move gives away at least the bar (in points
  of expected score against the best move, by the judge's own numbers), he dives onto the board, takes the blow and
  falls; the move is undone and the crowd picks again with a fresh clock, the move he took back barred. The bar starts
  at `lastStandLoss` (plus `lastStandChargedExtra` while he has charges) and falls to `lastStandLossFloor` over
  `lastStandDecayMoves` crowd moves. In a weak position (the best move worth under `lastStandShareBelow`, 40%) it's
  `lastStandShare` (half) of the chances left, when that's lower. Never when the best move is worth under
  `lastStandFrom` (20%: a lost position). Charges he falls with go to the crowd as power-ups. The round's scores
  stand.
- **The Last Stand on screen** (`LAST_STAND` in `boss-timing.ts`, `LastStand.tsx`): the warning, the freeze, his dive
  onto the piece's square, his cut-in, the piece sliding back, the blow meant for it, his stagger, collapse and fade.
  The blow is 25 red slashes with red numbers; against a boss whose kit has a `kingAttack` (Hollow, Eric, Oct 10) it is
  the boss's attack instead: from `LAST_STAND.attackAt` (as the piece slides back) the boss drops in beside him and
  lashes him ten times (`KingAttack.tsx`, on the shared `KING_ATTACK` beats), a gold "−N" off him each lash in his own
  strike style (`ks-hp`), his blows on its lashes (his `lastStandAttacked` frames), then it leaps off as he staggers.
  It fits between the slide and the stagger, so the Last Stand takes no longer and nothing changed on the server. See
  [bosses.md](bosses.md), "A boss's attack on a king".
- **Fair.** A power never changes how a player's own pick was judged, and a move he plays never earns brilliant credit.
- **Against the Hidden Boss his help doesn't work** (Eric, Oct 14; the boss's passive, `BossRules.blocksKing`): his
  move, his strike and his Last Stand never come (the runner's `kingDecision`, `callStrike`, `lastStandFor`). His menu
  still opens; picking "Play move" or "Strike" has the boss slam his book shut and mock it, and the God King says his
  help won't take hold (`mockKingHelp` in `components/Recluse.tsx`). Each try spends its charge as if it had worked
  (Eric, Oct 14: "using the king's move doesn't draw down on the usage vs him like it should"; the runner's
  `kingTried`, solo's `callKing`, in phase 1): the crowns go down one a try, and with none left he can't be called,
  as against any boss. Your move goes on (he played nothing); the Last Stand, which nobody calls, spends nothing. In
  this fight he opens with his own line as "START!" comes ("I sense a tremendous power within this foe.", Eric's;
  `foeIntro`, said by the boss screen's intro), and his
  lines about calling him (the nudge, "spent", "A charge might turn it") are left out (`turnCues`' `noHelp`). His
  lines for this fight are in the Hidden Boss's table, `characters/recluse-lines.ts`.
- **The Hidden Boss absorbs him** (Eric, Oct 14; DECISIONS.md, "The Hidden Boss absorbs the God King"): his phase
  change opens with it. In his place in the dock (BossDock's `king`) he raises his sword over the beaten boss, his aura
  swelling, and gloats (`foeTriumph`, a `lead` cue: always said, but a critical line cuts in); then the boss drains his
  power into a raised hand: his Last Stand's blows flash and crack him (his own frames), he flickers and cries out
  (`foeDrained`); and as it lands he fades up and away in light. No new frames of his: the aura, the flicker and the fade
  are CSS over his figure (`.gk-aura`, `.gk-unit.gk-drained`, `.gk-fading`). From then on he's gone: his place in the
  dock stays, empty (`king="gone"`), nothing to tap, and he says nothing in phase 2 (his phase 2 lines are gone). (On a
  phone, where his place is a line under the dock's row, that line closes up instead: the row above doesn't move.)
- **His lines** come from cues (a new danger to your queen or king, a mate threat, a queen taken, his own acts, a boss
  power…). Critical cues always speak; everything else is paced by `KING_SPEECH` (about 5 to 10 lines a game). Each
  line then follows the speech rule every speaker shares (`speech.tsx`, `SPEECH`; Oct 10): it types out and stays
  readable for 2.2 s plus 35 ms a character (at most 4.5 s); a critical line cuts in on a remark or small talk, but
  waits for another critical line to have its time; the others wait their turn and lapse after 5 s.
- **How he judges a blunder** (Eric, Oct 10: option 3 of the Last Stand proposals). He judges the crowd's move as
  it's played, before the boss replies, by how much it lowers the crowd's chances (the judge's expected score, the eval
  bar's number), not by the material: players sometimes sacrifice on purpose, and a sacrifice the engine likes gives
  nothing away. From 40% up, one move must throw away the plain bar (35 points on the first move with charges, easing
  to 18 by move 22): a hung queen from an even position costs 50 to 70 points. From 20% to 40%, half of the chances
  left is enough (from 30%, 15 points; from 25%, 12.5), or the plain bar if that's lower. Under 20% the game counts as
  already lost. Charges only raise the plain bar by 5; solo and online are the same; it never waits for the boss to
  take the piece. Eric's two games, replayed in Solo by `scripts/repro-last-stand.ts`: losing on purpose (moves giving
  away 4 to 21 points, none a disaster for where they were played) and then the queen hung from 12% (in Eric's own game,
  19%): no Last Stand, the game being lost by then; the queen hung on move 1 (55% to 4%): Last Stand.
- **Looks.** Pixel art in the boss characters' format, in white and black versions (a recolor of the armor only,
  in the crowd's color). SNES/Fire Emblem style: pixel portraits, slanted cut-in banners, retro sounds, a Press
  Start 2P speech bubble. Drama yes, gore no (cracks, sparks and a few stylized red drops are the limit).
- **The boss battle's presentation:** the intro (the boss's card, the game so far replayed, "START!"), the fight
  banners (`FightBanner`), the boss's move and its banner when it takes your queen, the dock. The queen banners
  (QUEEN DOWN!, QUEEN SLAIN!) are silent for now (Eric, Oct 11: the gasp sounded wrong; its file is kept, unused).

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
| His lines | `packages/app/src/godKing.ts` (against the Hidden Boss: `characters/recluse-lines.ts`) |
| The boss screens | `packages/app/src/screens/Boss.tsx`, the boss parts of `Crowd.tsx` and `Play.tsx` |
| Sounds | `packages/app/public/sounds/god-king/`, `public/sounds/banner/` (CC0, credited in `CREDITS.md`), `src/sound.ts`; synthesized (his "can't"): `src/characters/god-king-sounds.ts` |

## Settings

`packages/core/src/settings.ts`: the `king*` keys (`kingChargesMax`, `kingPowerUpsPerCharge`, `kingStrikeLoss`,
`kingStrikeMs`, `kingBotLoss`, `kingBotFollow`, `kingOnBoard`: the old summon-onto-the-board style, kept off), the
`lastStand*` keys, and `KING_SPEECH`.

## Tests and tools

- His "can't" (no charges left): unit `packages/app/test/god-king.test.ts` (under a move's loudness, the same every
  time, in the sound worker's table); e2e `e2e/recluse.spec.ts` (the sound and the shake, no menu).
- Against the Hidden Boss: unit `packages/chess/test/recluse.test.ts` (blocked; a try spends its charge, the Last Stand
  nothing), `packages/app/test/recluse-boss.test.ts` (the mocks, his cues, solo's `callKing` spending),
  `packages/app/test/recluse-phase2.test.ts` (absorbed: his look at each moment of the phase change, gone for good, his
  triumph giving way to his cry, silent in phase 2); e2e `e2e/recluse.spec.ts` (the dock's count drops in phase 1; the
  absorption's beats; no button, no figure and no word from him in phase 2).
- Unit: `packages/chess/test/last-stand.test.ts`, `packages/app/test/god-king.test.ts`,
  `packages/app/test/god-king-sprite.test.ts`, `packages/server/test/lobby.test.ts`.
- e2e: `e2e/formats.spec.ts` (the boss final), `e2e/boss-powers.spec.ts`.
- Frames in the game: `npm run frames:god-king -- <dir> [w|b] [phone|desktop|both] [summon|laststand|all] [light|dark]`;
  a boss's attack in his Last Stand: `npm run frames:king-attack -- <dir> hollow [phone|desktop|both] laststand`.
- e2e for a boss's attack in his Last Stand: `e2e/king-attack.spec.ts`. Unit: `packages/app/test/king-attack.test.ts`
  (his blows on its lashes), `packages/chess/test/king-attack.test.ts` (it fits the Last Stand).
- Sheets and GIFs: `npm run preview:characters -- <dir> only=god-king`, `node scripts/preview-god-king.mjs out.png banner=1`.
- Sims: `packages/sim/scripts/last-stand-sim.ts`, `last-stand-blunders.ts` (`reports/last-stand.md`).
- Replays in the real Solo app, the runner's own numbers logged move by move: `npx tsx scripts/repro-last-stand.ts
  [phone|desktop] [boss] [hang=35]` (a slow slide, then the queen hung once the crowd's chances are under `hang`%:
  no Last Stand from under 20%; a queen hung on move 1: Last Stand).
- e2e for his lines' time: `e2e/boss-speech.spec.ts` (his opening line held for its full time; each boss's line gone
  on time). Unit:
  `packages/app/test/speech.test.ts`.

## Rules for this area

- Everything he shows comes in white and black versions.
- Tunables in `settings.ts`; timings the server and the screens must agree on in `boss-timing.ts`.
- The FAQ explains his charges, strike and Last Stand to players (`packages/app/src/faq/content.ts`, "The God King"):
  a change to his rules changes its words in the same PR.
- Add a test switch (a `?query` flag) that forces any new moment in solo, so Eric can see it on demand.
- His words go through his voice (`kingSay`), held by the speech rule; never draw a line in a box a screen owns.
- Watch every moment frame by frame on a phone (`npm run frames:god-king`), in light and dark mode
  (`.claude/LESSONS.md`).
