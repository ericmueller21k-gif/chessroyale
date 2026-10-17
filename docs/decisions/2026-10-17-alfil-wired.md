# Alfil wired into the game, and live (Oct 17, 2026)

**Eric (Oct 17):** "Nobody has the link to this or access behind Cloudflare anyway, so you can just push it." So Alfil is
a normal boss now: his roster line has its kit (`kit: "Alfil"`), which makes him playable (`isPlayable`): his tile on the
Boss raid screen, the random pick, raids and lobbies, Boss alone's menu, and home's turning card. His rules:
[2026-10-17-alfil-rules.md](2026-10-17-alfil-rules.md); his art: [2026-10-17-alfil-still.md](2026-10-17-alfil-still.md),
[2026-10-17-alfil-animations.md](2026-10-17-alfil-animations.md); the sheet Eric approved is the spec. How it works:
[docs/areas/bosses.md](../areas/bosses.md) (his row).

## What was built

- **His kit** (`characters/kits.ts`): every moment on his animations (his own for entrance, move, capture, hurt,
  check, smug, rattled, defeat, victory; `strike` his capture; Tusks' cast `tusksCast`, the fusion `tusksFuse`, the
  warning his `check` trumpet, the Slam `mammothSlam`); his portrait; the phone bar's `wide` box (58 px, as Sawyer's and
  Wrangler's); his attack on a king (`ALFIL_ATTACK`). He's in `CHARACTERS`, so the character tests cover him.
- **His moments on the board** (`components/Alfil.tsx`), timed by **`ALFIL_BEATS`** (`packages/chess/src/bosses/alfil.ts`),
  each beat a cue of his animation (a unit test checks every one): `ALFIL_FX` is now the beats' totals.

| Moment | Beats (ms into it) | What you see |
| --- | --- | --- |
| Tusks' cast (its own screen, before his move) | banner to `castAt` 1500; 2300 in all (unchanged) | "TUSKS!" ("a7 and c7 fuse next turn"); his trunk levels the ankus (`cast`) and both pawns glow gold, under the piece, until the fusion or the counter |
| The fusion (his move; first of the crowd turn's moments) | `riseAt` 400, `flashAt` 900, `landAt` 1400; 2100 (was 2600) | the two pawns, still glowing, rise to the board's center (`rise`), a ball of white light (`flash`), the elephant drops onto its square. No banner, no morph (Eric) |
| The Mammoth Slam (its own screen, before his move) | `leapAt` 1500, `slamAt` 1860, `flyAt` 2000, `goneAt` 2600, `shadowsAt` 2210; 3000 (was 4200) | "MAMMOTH SLAM!" ("3 of your pieces fly up for 3 turns"); he leaps and crashes down (`slam`: the board shakes, Big Boy's crash jolt); the pieces fly up off their squares (`fly`), turning and shrinking off the top; the shadows show (`shadows`) |
| The landing (as a crowd turn begins; early, during his thinking) | each `stagger` 200 apart, `fallMs` 450, `slideMs` 300; 1500 (was 1600) | each piece drops out of the sky onto its own square, its shadow at its biggest until then, a soft thump each; one whose square was taken slides on to where it landed |

- **The board under them** (`alfilFen`, Boss.tsx): from the screen's start, the fusion's pawns stay on their squares
  until they rise and the elephant shows only once it has landed; the Slam's pieces stay until they fly; a landing piece
  shows once it's down. The board doesn't animate those changes (the moment draws them), as for Big Boy's bounce.
- **The shadows: Jefferson's, as is** (`fireShadow`, its grow and loop animations, the shared canvas under the pieces,
  the `.pw-shadow` markers): his `item` became `fireShadowItem` in Grex.tsx and both use it; the size is the rules'
  `stage` (1, 2, 3 over the three turns), so they grow as his do.
- **The elephant piece**, design A, white and black: `board/pieces/alfil/elephant-white.svg`, `elephant-black.svg`
  (moved from `alfil-drafts/`, credited in `board/pieces/SOURCES.md` and the FAQ's credits: drawn for HunChess on the
  cburnett bishop's base). The board draws a bishop on one of the view's `elephants` squares as `piece.bishop.elephant`
  (`BoardProps.elephants`, OwnBoard); a captured one keeps its art while it fades.
- **The dock:** "Alfil spent his move on the fusion." (Eric's words) through his whole turn on the boss's screen: the
  moment's `dock` while it plays, and `BossUi.noMove` (new: the turn's line when it brought no move) before and after
  it, where "Boss plays …" would be. The landing: "Your pieces are back." ("Your piece is back." for one).
- **Sounds** (`characters/alfil-sounds.ts`, synthesized like the others', made ahead in the sound worker, through the
  mute switch, each under a move's loudness): trumpet (short), leap (the big trumpet), thud, crunch (the fusion's
  grinding), whoosh, snort, rumble, stomp, clatter, oof, land, glow, jab, thump. Cues: `rumble` rumble, `thud` thud,
  `trumpet` trumpet, `stomp` stomp, `oof` oof, `clatter` clatter, `swing` whoosh, `cast` glow, `snort` snort, `rise`
  glow, `flash` crunch, `leap` leap, `slam` thud, `fly` whoosh, `shadows` rumble, `land` land, `jab` jab; and a soft
  thump as each landing piece (and the elephant) comes down. His select sound: the trumpet.
- **Lines** (`ALFIL_LINES`): the sheet's four and the fusion's three, the rest in the same voice; select lines in
  `SELECT_LINES`. Every player-visible text is listed in the PR.
- **The FAQ:** his block (every number from `BOSS_POWERS` and his offset), the RAGE! line (his Slam comes at the start
  of his turn, as Hollow's and Big Boy's), the meter's "still under way" list, the credits.
- **The select screen:** ten tiles, two full rows of five on a phone; one row of ten from 600 px (was nine). He's drawn
  full size on the stage (70 px tall at its 0.8 a pixel).

## My calls

- **Banners for the cast and the Slam, none for the fusion and the landing.** Every boss's passive and ultimate open
  with one; the fusion and the landing are payoffs (as Jefferson's fireballs), and what they mean is the dock's line.
  The cast's sub-line says what it means for you ("a7 and c7 fuse next turn"); the Slam's how many and how long.
- **The fusion's dock line is said on his turn only** (the boss's screen), not on your turn's: "Your move." stays the
  line you play by, and the board shows the elephant.
- **The glow is still, not pulsing:** a pulse would restart each time the screen changes (his turn, your turn) and blink.
  A gold light under the pawn and a gold ring round its square, read at a phone's size in both themes.
- **"A grinding crunch, then a short trumpet"** (the sheet): the crunch at the fusion's `flash`, and a `trumpet` cue
  added on the frame after it (its joy frame, trunk up). The only change to his animations: no frame or pose moved.
- **Three sounds beyond the brief's list:** `glow` (the cast and the rise: the pawns lighting), `jab` (his attack on a
  king), `land` (his attack's and his entrance's landing). The Slam's `shadows` cue plays the rumble.
- **His attack on a king** (the mate, the God King's Last Stand): `perSquare` 36 and `stand` 1.9 (his ankus's tip
  reaches 2.2 squares from his feet: inside the king's square, a test measures it), a gold spike and sparks on the
  king's square at each jab (`ankusHit`, a new effect sprite, as Hollow's lash). The server waits for it at a mate
  (`KING_ATTACKERS` gains `alfil`).
- **Where history can't know, a plain bishop:** the view carries the elephants' squares now, not their history. The
  live board (the boss's screen and your turn's) draws them; ghosts never need to (they're the crowd's picks, and the
  elephants are his); stepping back through the game, the results' best and worst moves, the round breakdown and the
  Last Stand's small board draw past positions, where a bishop on that square then may not have been the elephant: they
  draw plain bishops.
- **The landing drops onto the piece's own square first** (where its shadow was), then slides to the square it landed
  on when its own was taken (the brief).
- **Shared code touched, simply:** `SoundAt` moved from Pig.tsx to PowerParts.tsx (Wrangler's and Alfil's beats);
  `KitMoment` gained `powerHit` (the fusion's lines); KingAttack's prewarm draws the kit's own hit effect.

## Tests

Unit: `packages/app/test/alfil.test.ts` (rewritten), `king-attack.test.ts`, `banners.test.ts`, `boss-kits.test.ts`,
`packages/core/test/boss.test.ts`, `packages/chess/test/alfil.test.ts` and `king-attack.test.ts`,
`packages/server/test/boss-powers-lobby.test.ts`. E2E: `e2e/alfil.spec.ts` (his art through both powers, his tile,
stage and figure at 320 px and 1280 px), the tile counts in `boss-select.spec.ts`, `formats.spec.ts`,
`home-ranked.spec.ts`. Frame by frame: `npm run frames:alfil`.
