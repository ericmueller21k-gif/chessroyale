# History: The God King and the boss battle's presentation

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/god-king.md).

## The God King (Oct 4, 2026)

Eric asked for the King to become a real character: a custom piece, summoned with lightning, striking with his sword, and leaving in holy light, with SNES-style sounds.
- **The sprite** (`components/GodKing.tsx`) is my own SVG, inspired by Eric's reference image. It's a crowned, visored knight-king on a three-tier chess base, holding a sword point down, drawn in the crowd's colour with the board's outline style and gold for the crown and hilt, so it still reads as a chess piece.
  - It's drawn in parts so it can move: a gentle bob and sway, and the sword swings up to his side when he commands.
  - In the move picker, the ordinary king stands by with his small sword; the God King only appears when summoned.
- **The summoning** (about 3.6 s over the board, CSS timings):
  1. Three slow bolts converge.
  2. A beam of light, then a flash, and the God King stands there.
  3. He raises his sword, and a thin bolt strikes the piece he moves (then it moves) or, for a strike, the boss's king, with a floating "−10 HP".
  4. Holy light takes him away, and the plain king drops in and fades.
- **Timing.** The reveal gets 3.9 s extra whenever he acts, solo and online. His move plays right after his bolt; his strike comes after the crowd's own move.
- **Sounds** (`public/sounds/god-king/`, all CC0, credits in the folder). They play at summon, appear, the "hyuah!" sword raise, the bolt, the hit and the exit.
  - Most come from Juhani Junkala's retro 512-effect pack. The battle cry is a grunt from HaelDB's yell pack with a light 16-bit crunch.
  - Each file can be swapped by replacing it under the same name.

## The God King, reworked after Eric's first look (Oct 4, 2026)

- **Calling him is your turn.** Tapping "Call the King" or "Strike the boss" asks "Are you sure? You won't pick a move." Yes sends the call instead of a move.
  - Callers abstain from the round. They score 0 for it, it doesn't count as a miss, and they don't vote. For the boss's strike-down they count the round's average loss, so calling neither shields nor punishes you.
  - Once you've called you can't also pick, and a pick rules out calling.
- **No figure below the board.** Only the two buttons and the crowns stay.
- **Everything happens on your king's square.**
  - A dozen thin bolts converge on the square where your king stands, then a beam and a flash.
  - The God King takes the king's place there, at exactly one square's size (the real king is hidden while he's on the board).
  - He raises his sword, and a thin bolt hits the piece he moves, or the boss's king with "−N HP" (the middle of `kingStrikeLoss`).
  - If his move is a king move, he walks with it.
  - As the round ends, holy light takes him away from whatever square he's on, and the ordinary king drops back there.
- **Leave sound.** The laser-like exit sound is replaced with a synthesised falling shimmer that fades out (`leave.mp3`), so he vanishes rather than fires.

## The God King's strike happens during the move; the eval bar holds steady (Oct 4, 2026)

Eric's second look: the God King animation is right, but the eval bar jumped around, and a strike also played a move.

- **Eval bar.** Every screen change (your move → reveal → the boss's turn → your next move) mounted a fresh bar that started at 50% and slid back to the real value, so it moved several times per move.
  - The bar now remembers what it last showed and each position's value, so it only moves when a move lands on the board: once when the God King's move plays, once for the boss's reply.
- **The strike is no longer your turn.**
  - "Strike the boss" (confirmed: "The clock stops while he strikes, then you pick your move") counts towards a strike during the move. When more than half the crowd has called (bots back a human's call as before), he strikes at once, on everyone's screen.
  - The move clock stands still for the strike (`kingStrikeMs`, 4.4 s). Every deadline moves back by that long, and so do bots still thinking. Time on the move leaves it out.
  - Then the move goes on and everyone picks as usual. One strike per move. The button shows "Strike called 2/4" while calls come in, and "Boss struck" after.
  - Calling him to *play* the move is still your whole turn (callers abstain, as before).
- **Three slashes.** The strike shows as three quick slashes on the boss's king. Each has a slash sound (the last also the hit) and a yellow number, adding up to the middle of `kingStrikeLoss`: −3, −3, −4. The effect is unchanged: the boss's next move loses 5–15 points.
- **Slash sound.** `slash.mp3` is a short noise swish with a metallic ring, synthesised with ffmpeg.

## Boss battle: one fixed dock under the board (Oct 4, 2026)

Eric: during a God King move, the text and the leaderboard below the board kept moving from screen to screen.

- **What moved.** Each screen of a boss move had its own content below the board, so the leaderboard's top edge jumped between 490 and 574 px on a phone:
  - your move: the King buttons, whose crowns wrapped onto a second line
  - the reveal: a "👑 King" vote bar (the green bar with a 1: how many called him) and a score line
  - the boss's turn: a status line and a four-line God King explanation
- **The dock.** In boss battles, every screen now has the same dock under the board, with two rows of fixed height:
  1. The King's buttons and crowns, always there and greyed out when they can't be used. On the boss's turn they show their plain labels, so nothing from the last move carries over. "Are you sure?" swaps them for "Yes, summon him" and "No", with the question in the status line.
  2. A fixed two-line status, for example:
     - "Your move. Or summon the God King."
     - "👑 The God King plays Ng3 · 1 of 1 called him" / "You called the King: no score for you this move."
     - "The crowd plays e4 · 6 of 10 votes" / "You picked e4 (+0.4) · best was d4"
     - "The Iron Bishop is thinking…"
     - "🤖 The Iron Bishop played a5" / "Your move in 2"
- The leaderboard now stays at the same height on every screen of a boss move (checked on a phone screen: 540 px throughout).
- **Removed.**
  - The vote bars in boss battles: the ghost pieces on the board already show the votes.
  - The King vote bar.
  - The long explanation (the confirmation and the home page's FAQ cover it).
  - The old KingCalls component.
- **The line above the board** reads the same on each screen ("BOSS BATTLE · you play White · …"), with only the short note at the end changing.

## Boss intro replays the opening, then "START!"; a fighting-game banner for big moments (Oct 4, 2026)

Eric asked for this.

- **The intro, from the normal starting position.**
  - The boss's card (with the opening roulette in a raid) sits over the starting position.
  - The card fades, and the game so far is replayed one move at a time, White, Black, White, Black, with the usual move sounds.
  - Then a fighting-game "START!" banner, and the first move.
  - Timing (`bossIntroTimeline` in the chess package, shared by the server and solo): card 2.6 s; then moves at 2.4 s ÷ plies (110–260 ms each; a raid's 10 plies take 240 ms each); then a 0.25 s beat and the 1.5 s banner. A raid's intro is about 6.75 s.
  - In a raid there's no opening screen first any more, since it would show the finished position before the replay.
- **The banner (`FightBanner`), reusable.**
  - A flash, then a slanted band shoots in over moving speed lines, big italic outlined text slams down, holds, and the band shoots off.
  - Its sizes follow the board's width, so it fits any board.
  - Two looks: "start" (red and orange) and "boss" (purple and dark red, with the boss's face in a ring).
- **The boss takes your queen.** "QUEEN DOWN!", with "<boss> takes your queen", its face (its emoji for now; a sprite can replace it later) and a roar.
  - The boss's move now records what it captured (`lastMove.captured`).
  - That screen stays up 1.3 s longer (`bossShowMs`) so the banner plays out.
- **Sounds** (`public/sounds/banner/`, credits in the folder).
  - `start.mp3`: a whoosh, a punch and a short blast.
  - `boss-roar.mp3`: a CC0 yell pitched down into a growl, over a low rumble.

## The God King stands by the board, talks, and takes commands like a Final Fantasy unit (Oct 4, 2026)

Eric asked for this.

- **He's the button.**
  - The two King buttons are gone. The God King stands at the right of the dock under the board, in your colour, with his charges as crowns at his feet.
  - He idles like an RPG unit: he breathes, his crown bobs and his sword sways.
  - He glows gold when he can be called, is dimmed when he can't, and turns grey when his charges are spent. He steps away while he's on the board.
- **His commands.**
  - Tap him and a little blue window opens above his head, like an old Final Fantasy battle menu, with a ▶ cursor and retro menu blips: "Play move" (his move at full strength; you won't pick) and "Strike" (the boss's next move is weaker; the clock stops, then you pick).
  - Strike is greyed out once struck, or while your call waits for the others.
  - Tap him again to close the menu. Choosing a command is the confirmation (two deliberate taps), so there's no separate "Are you sure?".
  - The pause-menu version (dimmed screen, window over the board) was built first; Eric preferred this. It's kept as a generic `PauseMenu` component for later menus.
- **His lines** (`godKing.ts`). 49 lines across 17 moments, shown in a pixel speech bubble (Press Start 2P, OFL, hosted with the app) that types itself out over the board's corner.
  - The moments: introducing himself on your first move; your queen in danger (attacked by a cheaper piece, or attacked and undefended); your king in check; great, good and bad crowd moves (by the played move's loss: ≤1, ≤4, ≥12); crowd captures and checks; boss captures; a boss blunder (a ≥30-point swing in the eval bar's numbers); the boss staggered; his strike; him playing the move; winning or losing (≥85% / ≤15%); out of charges; idle small talk.
  - Urgent moments (queen, check, his own actions) always speak. Others roll a chance and wait at least 6 s after the last line. Each moment speaks once, and a moment never repeats its previous line.
- **Sounds.** Menu blips from the same CC0 retro pack (`public/sounds/menu/`).

## The God King, toned down: he's secondary to the chess (Oct 4, 2026)

Eric's feedback after playing it: too much King.

- **No instruction text.**
  - The dock's "Tap the God King" / "God King · N charges" line is gone; that row is just the move-history arrows now.
  - The status line says just "Your move." (plus the staggered note when it applies).
  - Instead, at most once every six moves while he has charges, he may say "Need a hand? Tap me." or similar.
- **Smaller.** The figure is about 20% smaller (40 × 60 px), and his command window is narrower (176 px) with one-line notes ("Full strength. Uses your turn." / "Weakens its next move.").
- **Paced by moves, not seconds.** Eric wants him to speak 5–10 times a game, about every 4–5 moves; before this he was mostly silent.
  - Small talk (idle chatter, the tap-me reminder, winning or losing) rests for 3 moves after any line. Then its chance grows by 30% with each quiet move. That's about 6–7 lines of small talk in a 35-move game, by simulation and unit test.
  - Reactions add to that: good move 35%, captures 50%, bad or great move 75–80%.
  - Urgent moments always speak: queen in danger, check, his own actions, a boss blunder.
  - Two lines that aren't urgent stay at least 8 s apart, so the reveal and the boss's move can't both talk over each other.
- **Boss blunders.** The boss screen compares the engine's numbers before and after the boss's move (the eval bar's, cached). A swing of 15 points or more toward the crowd always gets a line, such as "It's reeling! Want me to finish it?" or "A blunder! Find the punishing move." This catches the weak bosses' random stumbles and real blunders alike.

## The God King's bubble carries across screens (Oct 5, 2026)

Eric saw the bubble flash a couple of times as it ended. Each screen of a turn (your move, the reveal, the boss's turn) draws its own God King, and a line still showing when the screen changed popped in and retyped from the first letter on the new screen, sometimes only 0.1 s before it ended. Now the line remembers when it started: a new screen picks it up where it was (no second pop-in, no retyping), and it fades out over its last quarter-second.

## The God King's cut-in banner (Oct 5, 2026)

Eric asked for a Fire Emblem style banner the moment the God King raises his sword, before he moves the piece.

- **What it shows.** It uses the START banner's motion (flash, slanted band over speed lines, slam), in his colours instead of red: navy and indigo with gold borders. Left to right:
  - his pixel portrait: crowned, helmed, eyes burning white with a blue glow, a red cape behind;
  - "GOD KING" over what he's doing: the move in SAN (e.g. "Bxe7") or "STRIKE!";
  - the target: the piece he moves (the board's own piece art), or the boss's face for a strike.
- **The portrait.** After two simpler tries that didn't read as godlike, it's a detailed 64 × 60 pixel image in the style of Eric's reference (an ornate armoured lord), as a holy version:
  - a steel helm under a five-spiked gold crown with a cross and jewels, and burning gold eyes in an angled visor;
  - one big gold-rimmed pauldron per shoulder, its layered plates shown as seams inside it (two stacked plates read as four shoulders), with gold spikes; a gold gorget, the king's cross on his chest, and a crimson cape (it was royal blue at first, but blended into the navy banner);
  - golden sparks around him.
  - It's drawn from shapes with light from the top left and outlined, by `scripts/god-king-portrait.py`. It's shown scaled up with crisp pixels and a pulsing golden glow.
  - **Two versions, always** (Eric: everything the God King shows comes in both colours). `god-king-portrait-w.png` and `-b.png` (about 1 KB each) are the same picture with the armour recoloured: white steel for White, blackened steel for Black; gold, eyes, cape and sparks unchanged. The cut-in picks the crowd's colour, like his figure on the board, beside it and in the summon.
- **Timing.** The banner plays for 1.5 s right after his "hyuah!" sword raise. His bolt, the move and the strike's three slashes all come 1.5 s later than before.
  - The reveal where he plays the move gets 5.4 s extra (was 3.9 s), in solo and online.
  - A strike stops the clock for 5.9 s (`kingStrikeMs`, was 4.4 s).
- **Sound.** `cutin.mp3`: a whoosh into a sword ring (CC0 retro pack).

## Boss dock: one row (Oct 5, 2026)

Eric: the replay arrows' row was empty space, so the status box moves between them.

- The dock is now a single 62 px row: « [status box] » beside the God King. It was 90 px (an arrows row over a status row), so the board area gains 28 px; the leaderboard starts at 512 px on an iPhone 13 instead of 540.
- While you step back through the game, the box shows "Move 5 · 9/10 · back to live" (tap it to return).
- The God King's column shrinks to match (figure 33 × 50 px, crowns at his feet).
- The status lines are shorter to fit the narrower box (13 px / 12 px), for example:
  - "👑 God King plays Be2" / "You called him · no score" (or "3 of 8 called him · no score")
  - "Crowd plays e4 · 6/10" / "You: e4 (+0.4) · best d4"
  - "🤖 Boss plays a5" / "Your move in 2"
  - "👑 He strikes the boss!" / "Clock stopped."

## The God King's Last Stand (Oct 5, 2026; built)

Eric's idea: when the God King has nothing left to give, he still has himself. Once per game, if the crowd plays a
disastrous move, he dives onto the board, takes the blow meant for that piece, and falls. The move is undone. The
director's design (Oct 5) set the beats; Eric then changed the rule: always armed, a bar that eases off as the game
goes on, and an early hung queen or piece in a solo raid must set it off.

**The rule** (`lastStandBar` and `lastStandDue` in `core/boss.ts`, the runner's `lastStandFor`; numbers in settings.ts):
- **Where:** every boss battle (the 50 v 50 boss final and the boss raid), solo and online.
- **Always armed, once per game,** whether or not he still has charges. If he falls with charges left, he leaves them
  to the crowd: every player still in gets that many ⚡ power-ups (Eric, Oct 7; see "The Last Stand, after Eric played
  it" below). No menu, no crowns. The charges he fell with are recorded on the battle (`lastStand.charges`).
- **A disaster:** the crowd's played move gives away at least the bar, in points of expected score against the best
  move, by the judge's own numbers for that round (after the re-check; the same numbers that score the picks).
- **The bar eases off:** `lastStandLoss` 30 on the first crowd move, plus `lastStandChargedExtra` 5 while he still
  has charges, falling in a straight line to `lastStandLossFloor` 13, reached after `lastStandDecayMoves` 22 crowd
  moves without one. So 35 → 18 with charges, 30 → 13 without.
- **Not when it's already lost:** the best move was worth at least `lastStandFrom` 40. A lost endgame never sets it off.
- **Not when the God King plays the move himself** (he plays the best move).
- **Fair:** the round's scores stand (whoever picked the blunder still loses for it; the judge's verdict is never
  changed), and the re-pick is an ordinary scored round.

**What happens:**
- The move isn't played. The board, the crowd's move count and the boss's turn are as before it: it's still the same
  crowd move. The boss's strike waits until the re-pick has been played (then it weighs both rounds' picks), so
  nothing comes between his fall and the re-pick.
- The crowd picks again from the same position with a fresh clock. The move he took back is barred: a grey arrow
  with ✕ on the board and "✕ Nxe5" in the status; the board won't play it, the server rejects it, no bot picks it,
  and it isn't the best move on offer in the re-pick either.
- He has fallen: his figure lies in the dock for the rest of the battle, toppled on his side like a beaten chess piece,
  armour cracked, crown and sword on the ground, greyed. No menu, no crowns, no more lines. Above him, a ⚡ button
  with the power-ups he left (Oct 7).
- On the result screen he rises again in holy light ("A god does not stay down.") if the crowd won. If it lost or
  drew, he stays down, without a word.
- Online, the reveal carries the Last Stand and the battle as it now stands (`lastStand`, `boss`), so every screen
  plays it at once; each round message carries the battle too (the barred move); the host's bot picks and scoring
  leave the barred move out.

**The moment** (`LAST_STAND` in `chess/boss-timing.ts`, ms after the blunder lands on the board; the reveal lasts
`LAST_STAND_MS` = 9,900 ms longer, solo and online, and the next move's clock only starts after it, so nobody loses
any time). Updated Oct 7: a 1,300 ms warning comes first, everything after it 1,300 ms later, and nothing flashes white.

| Beat | From (ms) | What |
| --- | --- | --- |
| 0. Warning | 0, for 1,300 | A red "??" badge pops on the piece's square (80 ms), the square pulses red three times under the piece, a danger sting plays, the eval bar plunges to the crowd's chances after the move, and the dock says what it loses in plain words. |
| 1. Freeze | 1,550 | A dark red pulse; the board goes cold and grey. |
| 2. Leap and crash | 1,950 / 2,450 / 2,700 | He leaps up out of the dock (450 ms), falls onto the piece's square in a gold streak (250 ms), and lands at 2,700: a dark red shockwave with an orange ring, dust, the board shakes (450 ms). The piece is knocked aside; the badge goes. |
| 3. Banner | 3,250, for 2,100 | "LAST STAND", his battle-worn portrait and one of his lines (the same on every screen for the move). His usual cut-in is 1,500 ms; this one is held longer so the line can be read. Its flash is dark red. |
| 4. Slide back | 5,450, for 450 | The piece slides back to its square; he stands alone where it was. The eval bar goes back to what it was. |
| 5. The blow | 5,950 to 7,950 | 25 slashes, one every 80 ms, each a red-white cut with a red damage number (6 to 14, seeded by the move) spiralling off around him; his armour cracks at 6,350, 6,950 and 7,550; grunts of agony at the 2nd, 11th and 20th slash; four stylised red drops. |
| 6. Fall | 8,100 / 8,550 / 9,100 | He staggers, collapses onto his side with a death groan, and fades from the board (500 ms). His fallen figure appears in the dock with his last words: "Finish… it… for me.", and the ⚡ power-ups he left beside him. |
| 7. Re-pick | 9,900 | The reveal ends; the crowd picks again. |

**Measured: an early hung piece sets it off** (`packages/sim/scripts/last-stand-blunders.ts`). 30 real raid starts
(named openings, 10 plies in), a few sensible moves played on to crowd moves 1 to 10, then a move that hangs the
queen or a minor piece, judged as a phone judges (top 8 at 250k nodes, re-checked at 700k): 30 of 30 crossed the bar.
The judge gave a hung queen 50 to 62 points and a hung minor piece 47 to 53, against a bar of at most 35. Unit tests
do the same with the real engine for three of them (Qg4 in the Open Sicilian, Ne4 in the QGD Exchange, Bh6 in the
King's Indian Fianchetto) against the 3190 boss on crowd move 1. Online, a one-player raid lobby: Bb5, hanging the
bishop to a pawn on move 1, was scored 52.6 by the host's engine, and he made his Last Stand.

**Measured: how often** (`packages/sim/scripts/last-stand-sim.ts`, `reports/last-stand.md`). Bot crowds against the
real boss (its strength, slips and blunder guard), every crowd move judged as the game judges it, the rule tried
afterwards (once per game, so a game up to its first one is the game as played). Solo crowds are one player
(strong, club or casual: a skill and a share of random moves) who keeps all three charges (the higher bar all game);
the 50 v 50 final is ten bots with two charges, which the bots spend whenever the popular move loses 6+.

| Crowd | Boss | Games | With a Last Stand | Crowd moves it came on |
| --- | --- | --- | --- | --- |
| One casual player (solo raid) | 1400 | 8 | 5 (63%) | 1, 1, 3, 7, 22 |
| One casual player | 1800 | 8 | 6 (75%) | 2, 2, 3, 3, 5, 7 |
| One club player | 1800 | 8 | 4 (50%) | 4, 8, 15, 40 |
| One club player | 2200 | 8 | 4 (50%) | 6, 7, 9, 16 |
| One club player | 2600 | 8 | 4 (50%) | 10, 10, 19, 59 |
| One strong player | 2600 | 6 | 3 (50%) | 2, 8, 12 |
| Ten club bots (50 v 50 final) | 2000 | 8 | 5 (63%) | 25, 29, 29, 32, 52 |
| Ten expert bots (50 v 50 final) | 2600 | 6 | 1 (17%) | 42 |
| **All** | | **60** | **32 (53%)** | |

- **About 0.5 per game overall** (53%): once every other raid for most crowds, more for casual players (who hang pieces
  early), less for a strong ten-player crowd (whose popular move rarely blunders while it's still in the game).
- **The floor and its pace barely matter here.** While the crowd isn't lost yet, its moves are almost all either
  fine or a piece-sized disaster: 92% gave away under 5 points, 3.4% gave away 30 or more, and only 2.5% fell
  between 12 and 30. A mid-sized mistake (12 to 30 points, half a pawn to a pawn) mostly tips the position under 40
  at once, after which nothing sets it off. Any floor from 10 to 18 and any pace from 15 to 30 moves gave 52 to 55%
  (the grid in the report), so 13 and 22 sit in the middle of Eric's ranges. The lever that would change it is
  `lastStandFrom` (or the starting bar), which Eric set.

**Art, sounds and lines:**
- **Sprite:** his figure is now drawn from parts (body, crown, sword), so there is a cracked variant (three levels,
  dark jagged splits with a bright chipped edge) and a fallen pose (the same figure toppled on its side, crown knocked
  off, sword on the ground). White and black, armour only, like the rest of him. A dev sheet shows them all:
  `node scripts/preview-god-king.mjs out.png banner=1 epilogue=rise`.
- **Portrait:** `god-king-portrait-hurt-w.png` and `-b.png` (from `scripts/god-king-portrait.py`; the usual portraits
  are unchanged byte for byte): cracks across the helm, a cheek plate, both pauldrons and the chest, a crown spike
  broken off, the cape's hem torn, embers among the sparks, and three small stylised red drops.
- **Sounds** (`public/sounds/god-king/last-*.mp3`, CC0, credited there; cut by `scripts/god-king-last-stand-sounds.py`):
  the leap (a heavy jump into a falling whistle), the crash, the 25 slashes (one 2 s flurry of sword swishes landing
  with hits), two grunts of agony and the death groan, from the same two packs as his other sounds.
- **Lines** (`godKing.ts`): the banner's "Fall back! This blow is mine.", "Not while I stand!", "Retreat — I'll hold
  the line!" and "Go! I'll take it from here."; his last words "Finish… it… for me."; and "A god does not stay down."

**Calls I made:**
- **The taken-back move doesn't count as a crowd move,** and the boss's strike waits for the re-pick: otherwise the
  move counter jumps by two and a strike could land between his fall and the re-pick.
- ~~**The eval bar holds still** through it~~: reversed on Oct 7 (Eric): it plunges during the warning, then goes back.
- **His crowns stay on screen until he leaps,** although the charges are already gone: losing them is part of his fall.
- **A king move taken back** just slides back (the king is never taken off the board, even for a moment).
- **The re-pick can be brilliant** like any round: it's the crowd's own choice, not a power-up.
- **Test switches** (solo): `?laststand=1` makes the battle's next crowd move set it off whatever it is (unless the
  God King plays it), for screenshots and the e2e test; Eric can just blunder a piece instead. `?side=b` plays a solo
  raid as Black, to see the black God King.

## The Last Stand, after Eric played it (Oct 7, 2026)

Eric played it live: "I played the piece, and then there's nothing, and then all of a sudden the king drops in, so we
just need something there." He wanted a warning on the piece (red, an exclamation), the move's strength without
numbers he doesn't know, details at the end of the game for anyone who taps, and no more white flashes. And his
leftover charges shouldn't just vanish.

**1. The warning beat** (the first 1,300 ms of the Last Stand; the timeline above):
- A red **"??" badge** pops on the corner of the piece's square, like a chess site's blunder mark. The square pulses red
  under the piece three times (the board's own highlight, so the piece stays plain to see), and a danger sting plays:
  `warn.mp3`, two low-health beeps from the CC0 retro pack over a soft thud (credited in the God King sound credits;
  cut by `scripts/god-king-last-stand-sounds.py <dir> warn`).
- **The eval bar plunges** to the crowd's chances after the blunder (the judge's own number), ringed red, and goes back
  as the piece slides back.
- **The dock, in plain words:** "?? Blunder: Nb5" over "Loses your knight", "Allows mate", or, when the boss's reply
  wins nothing a player could name, "Your chances 52% → 9%" ("Chances 52% → 9%" on phones under 360 px, to fit). It
  stays until the piece slides back; then "He takes the blow!" and "The God King has fallen" as before, with "He leaves
  you ⚡×3" when he had charges.
- **Where "what it loses" comes from:** the judge's own searches, at no extra engine time. Every search line's second
  move is the opponent's best reply, and `score mate` gives a forced mate; `uci.ts` now keeps both on each scored move
  (the `scoreAfter` fallback keeps its best move as the reply). The runner (solo) and the host (online, in its scores)
  pass them along; the Last Stand record carries the boss's reply (only if legal there), a mate it allows (`mateIn`),
  and the crowd's chances after the best move and after the blunder (`before`, `after`), on the round and on the
  battle, solo and online.
- **The words** (`blunderCost` in `chess/rules.ts`, wording in `godKing.ts`): a mate in 3 or fewer first ("allows
  mate"); then a piece the reply wins outright, a knight, bishop, rook or queen worth at least two pawns more than
  whatever takes it back ("loses your queen" for a queen lost to a bishop, but not for a queen trade); then a longer
  mate; otherwise the chances. A pawn is never named: a 30-point blunder that "loses a pawn" would mislead.
- **No white flash anywhere in it:** the freeze's flash is a dark red pulse, the crash a dark red shockwave with an
  orange ring and dust, the streak gold, the banner's flash dark red. Checked with `npm run frames:flash -- <dir> 2
  light boss laststand=1` and the same in dark: no flagged frame; in light mode no frame of the Last Stand is brighter
  than the screen's median, and the biggest frame-to-frame rise is 7 (the flag is 20).

**2. The Last Stand card on the results screen** (`LastStandCard` in `LastStand.tsx`), under his epilogue figure,
solo and online: one line, "Move 7: Nb5?? · loses your knight". Tapped open: your move with a red ??, the boss's
reply and what it won ("dxe4 · wins your knight", "Qh4# · checkmate", "mate in 3"), the best move instead (green),
your chances before and after ("52% → 9%"), and the position on a small board with your blunder as a red arrow and
the best move as a green one. Stacked on phones, the board beside the facts from 420 px.

**3. His leftover charges become power-ups.** When he falls, every player still in gets `lastStandPowerUps` (1) ⚡
power-ups for each charge he had left: the same as Crowd's, the engine's top 3 moves at full strength with the usual
hint arrows. It's done in the runner, so the solo raid (just you), online raids and the 50 v 50 boss final (bots too,
who use them as bots do in Crowd) share it. The ⚡ button, with the count left, sits in the dock above his fallen
figure, where his menu was (the whole column is the button; gold and glowing on your move, grey otherwise, ringed
while one is in use). A power-up move is an ordinary pick, marked as a power-up move (⚡ in the move list) and never
brilliant.

**Calls I made:**
- **The warning is 1,300 ms** (Eric said 1.2–1.5 s); everything after it moved 1,300 ms later, so the Last Stand is
  9.9 s instead of 8.6 s. The clock stays frozen throughout, solo and online, as before.
- **The badge and the red square stay until he lands on it** (2.7 s), not just the 1.3 s warning, so the danger is
  still marked while he leaps.
- **"Chances" are the judge's expected score** (a win plus half a draw), rounded to whole per cent: the same number the
  eval bar shows.
- **The words name a piece only when the reply wins it outright** (two pawns or more net), and never a pawn; anything
  subtler gets the chances.
- **The leaderboard shows the new power-ups as soon as the round is scored** (during the warning), since it shows
  everyone's power-ups as they stand.
- **One power-up per leftover charge** (`lastStandPowerUps`, a setting).
- **In a crowd's reveal, the chosen move's green ring gives way to the red pulse** when the move is a Last Stand.
- **The test switch** is still `?laststand=1` (and `?side=b` for Black): the first crowd move sets it off whatever it
  is, so the warning may name a small loss ("Your chances 52% → 49%"). Blunder a piece for the real thing.

## The God King, redrawn as pixel art (Oct 8, 2026)

Eric's reference: a holy knight in white plate with gold trim, a winged crown-helmet with glowing gold eyes, a flaming
golden sword, a blue tabard with gold crosses and a long torn white-and-gold cape. The director asked for a full
overhaul in the boss characters' format, so the crowd's champion looks as grand as the bosses.

- **The sprite** (`packages/app/src/characters/god-king.ts`, listed with the bosses so their tests and preview cover
  him): his drawing space is one board square, 60 x 60 px with his feet at the bottom centre, in a 108 x 104 frame
  that leaves room for his wings, raised sword and cape. It's made of parts: a helm with a T-visor and glowing eyes, a
  five-spiked crown, gold helmet wings, spiked pauldrons with a gold cross, a breastplate with a gold sun-cross and blue
  banners, faulds, the tabard, legs with gold knee cops, sabatons, the cape, and white back wings (folded, half open
  or spread).
  - The sword arm is drawn from its pose's shoulder, elbow and fist. The sword (a gold hilt and a blade of fire) hangs
    off the fist in the pose's direction, so a swing is a list of poses. The flame flickers in three shapes, flares
    when he raises it, and burns down to embers when he falls.
  - Parts that move: the sword arm, the flame, the cape and tabard (ripples), the back wings, the helmet wings (a
    flap), and the eyes (glowing, blazing, dim, dark).
- **Both sides:** a `black` look swaps the four armour colours for dark steel, a step lighter than black so he reads
  on the dark ground. Gold, eyes, cape, cloth, wings and flame stay the same (his standing rule, so the cape stays
  white on Black). A unit test checks that no other pixel changes.
- **Renderer additions** (backwards-compatible; the clown and his tests are unchanged): `lieDown` turns a whole frame
  a quarter (a fallen figure), each part with its own outline; `partSize`; and the preview draws every look too
  (`<id>-<look>-*` files, a comparison tile each).
- **His animations, and where each plays:**
  - **The dock:** `idle`, by the clock: he breathes, the cape ripples, the flame flickers and sheds embers, the
    helmet wings lift, the eyes glint. The ready, dimmed and spent looks are as before. His Last Stand leap is `leap`
    (a crouch, then up with the sword raised) under the same CSS rise and fade. Fallen, he's `fallen`: on his side,
    cracked, eyes dark, his crown rolled off, the sword down to embers.
  - **Summoned** (`KingSummon`): he lands out of the beam with wings spread (`appear`, at 1,300 ms), raises the
    flaming sword with wings spread and eyes blazing (`raise`, at 1,550 ms as before), and holds it through the cut-in.
    Then either he points it and his bolt leaves its tip (`point`; its bolt frame lands exactly on the bolt), or he
    cuts once for each slash (`slash`; its cut frame lands exactly on each slash), with a bolt from the raised blade
    before each cut. `summonMoment` picks the animation and is unit tested.
  - **The Last Stand:** one animation built from `LAST_STAND`, so it can't drift from the effects and sounds:
    - the dive (sword down, wings up) and the crash (low, sword planted);
    - guard over the square (sword across him, wings spread) through the banner and the slide back;
    - the 25 blows, each a 50 ms red-white flash and a one-pixel jolt, with cracks at the three `crackAt`;
    - the stagger, the collapse to one knee, then lying as he fades, the same picture as his fallen figure in the
      dock.

    It replaces the CSS hurt filter, the jolt and the stagger and collapse rotations.
  - **The results:** fallen; or, if the crowd won, `rise` (from the ground to one knee, up, the sword raised), then
    the raised loop.
  - **The shop's King effect preview:** sword raised.
- **Portraits from his kit** (replacing the Python-made PNGs, removed with their script): a 50 x 37 crop of a portrait
  pose (sword raised, eyes blazing, wings spread) for his cut-in and the QUEEN SLAIN! face; battle-worn (cracks, eyes
  dim, embers, three small red drops) for the Last Stand banner.
- **Sizes:**
  - On the board, his drawing space is the square, as before.
  - In the dock on a phone, a 50 px box, the old figure's height.
  - In the dock on a computer, twice his size (120 px), like the boss across the board; the dock has room there, and
    the status box keeps its height.
  - On the results, the epilogue is 184 px tall when he rises (was 156), so his raised sword clears his words.
- **Timing:** no moment's timing, sound or line changed. His sounds stay on their timers; the frames' cues are for
  the tests and the preview, not sounds.
- **Calls I made:**
  - While he acts on the board (his raise and the cut-in, about 2 s, never at rest), his spread wings and raised sword
    reach a few pixels into the next squares. I kept that for the grandeur. He never takes a tap.
  - On the board he bobs but no longer rocks: rotating pixel art blurs it.
  - His bolt starts at his sword's tip instead of just above his square.
- **Checking it:**
  - `npm run frames:god-king -- <dir> [w|b] [phone|desktop|both] [summon|laststand|all] [light|dark]` plays a solo
    raid: the dock, a strike, a played move and a Last Stand, with frames and stills.
  - `npm run preview:characters -- <dir> only=god-king` writes GIFs and sheets for both looks.
  - `node scripts/preview-god-king.mjs out.png banner=1` writes the sheet with his banners.
  - Test switches: `?laststand=1` and `?side=b`.

## The God King, polish batch (Eric, Oct 9, 2026)

Eric's notes after playing, built in one batch with Hollow's and G-REX's polish (PR "Polish batch").

- **No wings.** The small white back wings are gone from every pose, both colours, the portraits and cut-ins (the QUEEN
  SLAIN! face is his portrait). The cape, the helmet's gold wings (part of his crown-helmet) and everything else stay.
  **My call:** "the small upward-pointing wings on either side of him" read as the back wings (folded or half open in
  the dock, they point up beside him), since Eric said to keep the cape on his back; the helmet's gold wings stay.
  A unit test checks no back wing is drawn in any frame.
- **He acts from his spot.** He no longer takes your king's place on the board when he plays a move or strikes the boss.
  He stays in the dock (under the board on a phone, by it on a computer), raises his sword there with a golden glow
  behind him, his cut-in banner sweeps over the board, then his bolt leaves the blade (in the dock) and crosses to the
  piece he moves, or to the boss's king three times, each with a slash and a yellow "−N" there; then he lowers it.
  The bolts are drawn over the whole page (measured from his figure and the board), never taking a tap.
  - **Timing** (`KING_COMMAND` in `boss-timing.ts`, ms after he starts): raise 0, cut-in 300 for 1,500, his bolt 2,000
    and the move 2,350 (or slashes at 2,050, 2,450, 2,950), lowering at 2,900 (3,400 after a strike).
  - **Before → after:** his move came 3.6 s after he started and the reveal was 5.4 s longer; now 2.35 s and 1.7 s
    (`kingMoveMs`). A strike stopped the clock for 5.9 s; now 3.7 s (`kingStrikeMs` in settings). Solo and online
    share these (the server's and solo's duplicated 5,400 is gone).
  - **The old summon is kept, unused,** behind `kingOnBoard` (settings, off): converging bolts, the beam, taking the
    king's place, walking with a king move, holy light, the king dropping back, with its own times (`KING_SUMMON`).
  - His Last Stand still appears on the board as before.
- **He talks less** (numbers in `KING_SPEECH`, settings.ts; lines in `godKing.ts`):
  - **Critical moments always speak:** one opening line (now from a pool of 24), a new danger to your queen, your king
    in check, a **mate threat** (new: the boss would mate at once if you passed), a **queen taken either way** (new
    cues, with the QUEEN SLAIN!/DOWN! banners), his strikes and moves, his Last Stand, a boss's power moments (the
    blizzard, the funhouse, G-REX's fire-tile warning).
  - **Remarks on a move** (brilliant, good, bad, captures, a check you give, the boss's slips, his strike's after-effect):
    a low chance (brilliant 30%, good 8%, bad 35%, captures 20%, a boss blunder 50%) and none for 6 crowd moves after
    the last remark. **Small talk** (idle, the tap-me nudge, winning or losing) rests 8 moves after any line (was 3),
    then gets 10% likelier per quiet move (was 30%).
  - **My calls:** a warning that still holds on the next move (in check again, the queen still attacked, the mate still
    threatened) isn't repeated; a check is said once, as your move begins (it used to be said on the boss's screen and
    again on yours); the boss's blunder is a remark now (it always spoke before).
  - **Measured** (`scratchpad` sim over 7 Stockfish-played boss battles, 15 to 33 crowd moves each, the player calling
    him twice and striking once, the same games and dice before and after, 25 runs): **46.1 → 20.1 lines per 40-move
    match.** Everyday chatter (remarks and small talk) **23.4 → 6.8** (brilliant alone 15.2 → 2.9); critical lines
    22.7 → 13.4 (checks were said twice and every move a check held).
- **The queen-capture sound** (one try, kept): a woman's short gasp for a queen taken either way, on both banners
  (QUEEN SLAIN! played the START whoosh, QUEEN DOWN! a pitched-down male yell; the yell's file is removed). A CC0
  voice-acted gasp (wintuh, Freesound 471875, licence checked), trimmed, filtered, a light hall echo, levelled under a
  move (peak −7.7, mean −22.8 dBFS). **My call:** kept because it's what Eric asked for (a woman's voice, a gasp, nothing
  sexual: a sharp intake of breath) where the old ones were a man's yell and a generic whoosh; it's one file to swap
  (`public/sounds/banner/queen-gasp.mp3`) if it doesn't land.
- **Fixed (a rules bug): the boss's strike after a Last Stand.** In a 50 v 50 final, G-REX struck twice two crowd moves
  apart. The cause: the move the God King takes back isn't a crowd move (the move count goes back), but its round still
  counted towards the boss's next strike (`sinceKill`), so a Last Stand right after a strike brought the next one a
  move early. Now the count goes back with the move; the strike still weighs that round's picks (whoever blundered
  there can still be struck). `last-stand.test.ts` checks both; the crowd test's old seed now strikes every 3 moves.
