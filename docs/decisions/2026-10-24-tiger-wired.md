# Babur, the circus tiger, wired in and playable (Oct 24, 2026)

The wiring lane for **Babur** (id `tiger`; the name is one constant, `TIGER_NAME` in core `boss.ts`). His rules:
[2026-10-23-tiger-rules.md](2026-10-23-tiger-rules.md); his art and animations: [2026-10-23-tiger-still.md](2026-10-23-tiger-still.md) and
[2026-10-23-tiger-animations.md](2026-10-23-tiger-animations.md) (merged into this branch from `claude/tiger-sprite` at `f04a9ad`: Eric, "it's clearly
a tiger"; the balloons "looks really, really good"). He is **live**: his roster line has `kit: "Tiger"`, so his select tile, the random pick,
raids, Boss alone and home's turning card all meet him. The test links `?boss=tiger`, `&power=hoops`, `&balloon=<shape>` and `&stage=N` work
without `&wip=1`; `&seedspeed=N` (Puddles' switch: the page's clock N times faster) runs his stages too. How it works now:
[docs/areas/bosses.md](../areas/bosses.md) (his row). The director reviews the pump on the clock, the balloon's flight and landing, and the
rings before this merges.

## What a player sees

| Moment | On screen | Length |
| --- | --- | --- |
| **The pump** (the bar's free room: a phone's at its right end, a computer's at its left) | the nozzle bare, or the balloon at the stage the battle's clock gives (the page's visible time solo, the server's online: `balloonStage` on `gardenNow()`), the pump's plunger stroke and the balloon's puff (`grow`) as each stage comes on screen, a gentle bob once ready (`ready<Piece>`, new: a pixel's stretch and back, the knot on the nozzle). A stage reached while the page was hidden, or long ago, just shows: no burst | a stage every 30 s; the step 400 ms |
| **place** (his turn's start, while he thinks) | a phone: he hops along the bar to the pump (his `hop` with its airborne frame held 300 ms while the bar moves him, mirrored to face the pump), `place` beside it (the pump's `put` at `touch`: the limp balloon on the nozzle) and hops home. A computer: `place` by the board, and a small limp balloon arcs from his paw to the pump (380 ms), its `put` as it arrives. Busy with another animation, his body skips it; the pump still gets its balloon. His line now and then (15%) | 2420 ms (phone), never holds a move |
| **balloonLand** (as your turn begins) | the pump's `release` (the balloon lifts on its string), the balloon flies to its square (520 ms, an arc, a CSS transform from the pump's knot), `land<Piece>` there; the board leaves his piece off its square until the landing's `poof` (520 ms in), on every screen; then his `cheer` (a real queen: `bigCheer`) where he stands, its line (60%; a queen's always) | 1540 ms, then 720 / 1160; never holds a move |
| **pop** | the pump's `pop4<Piece>` (the balloon swells, strains, bursts), then his `wince` and its line (60%) | 400 ms, then 780 |
| **Hoops** (his whole turn, as your turn after it begins) | the warning "After your move: Hoops"; his `hoops` at the board's top-left corner, a burning hoop flying from his paw to its block at each `throwN` (300, 580, 860; 300 ms each) and its ring landing; the rings over their blocks (`hoopRing`, the block and half a square round it, the four squares clear) burning, dying for your last walled move, going out (`out`, 400 ms) as your second move lands. A reload draws them as they are, never the cast | the cast 1490 ms (the server's hold) |
| **A move through a ring** | refused as Big Boy's blocks: nothing moves, the dock says "A burning hoop is in the way." | |
| **His attack on a king** | `TIGER_ATTACK`: ten balloons batted at the king, each bonking (`balloonHit` on its square) and popping 90 ms later | 2.78 s |

## The timing check (the art against the rules)

Every length and cue in `TIGER_ANIM` and `HOOPS_BEATS` was measured against the art by a test (`tiger-wired.test.ts`) and they are equal: the
hop 620, place 820 (`touch` 440), cheer 720, big cheer 1160, wince 780, hoops 1360 with `throw1` to `throw3` at 300, 580 and 860; the pump's
step 400, release 330 and pop 400 (its bare look held after); the landing 790; the ring's landing 330 and going out 400. **The cast's hold is
right:** the last ring has landed at 860 + 300 (the flight) + 330 = 1490 ms, `TIGER_FX.hoops`, longer than his own 1360. **The one wrong number
was in the rules' comment:** "`poof` cue at 0.57 of it" (the landing); the art has it at 520 of its 790 ms (0.66). Nothing read the 0.57; the
comment now says 520, and the wiring uses the art's cue.

## Calls made

1. **What plays, and when.** Only the cast holds a turn, so it's the only one of his kinds played as a boss-screen moment. The rest play from
   his turn's events where they belong (`tiger-show.ts`, a small store every screen of the battle shares): each event plays once on this device,
   from when it first saw it; an event already there at the device's first look at the battle (a reload, joining late) is drawn from the view
   and never played. A landing or a pop starts as your turn does (the boss screen's moments give that time; seen first elsewhere, from then).
2. **The pump on a phone at the slot's right end** (the art step's mocks), on a computer at its left (the director's pick). On a phone his trip
   ends beside it, under the status; the status now sits above his figure (`.boss-bar .boss-next`, z-index), so it's never covered.
3. **The trip's facing:** he's drawn facing our left; going right to the pump he's mirrored about his feet (CSS on the canvas), so `place`
   reaches the nozzle; home again unmirrored. 23 px from his feet to the nozzle (his limp balloon's knot in `place`).
4. **The board under a landing** is changed in one place, `Board.tsx` (as Smudgy's camouflage): `balloonFen` leaves his piece off its square
   until the poof, only in the position right after the landing (once anything moves, the board is the game's). The board draws again at the
   poof (`useBalloonWake`); no knock plays for it.
5. **The ready bob** is a new loop in `tiger-bar.ts` (`ready<Piece>`), two of the approved drawings (the stage-4 balloon and its own stretch),
   not a redraw. **The trip's hop** is `hopTrip` in `characters/tiger-figure.ts`: the approved `hop` with its airborne frame held 300 ms. His
   approved figure is untouched (the hash test).
6. **Sounds** (`characters/tiger-sounds.ts`, synthesized): the pump's soft rubbery stroke (the quietest of his balloons' sounds: a test), the
   rubber's squeak, a sharp pop, the release's whoosh, the landing's poof, heavy-paw thumps, the hop's spring, his vest's rustle, a big bored
   breathy yawn, a half-hearted growl, a huff, a fire whoosh and crackle for each hoop (the ring's `flame`; the ring's own whoosh and thump
   are quiet beside it), a rubbery bonk. **His voice** (`grumble`): slow made-up syllables at about 120 Hz (Puddles' quick chatter is 370),
   dark vowels, a purr in it (its loudness fluttering at 24 Hz) and breath: his `cheer` ("heh-heh"), `whoop` (a longer pleased run) and
   `wince`/`oof` ("ugh"). No boss voices its lines, so the voice is his reactions'; samples of it reading a short, a medium and a long line
   are in the director's scratchpad (`tiger/wired/babur-voice-*.mp3`). Select sound: the yawn, then a squeak. Every one under a move's peak
   and loudness (#271), the attack's ten bonks and pops together too; all through `play()`, so mute holds.
7. **`balloonCheer` and `balloonBigCheer` use the kit's `cheer` and `bigCheer` beats** (Puddles' "a piece came up"), the same meaning; two new
   beats, `place` and `wince`. The lines' draft's `hoopBlocked` has no beat in the kit: not added (the brief).
8. **The dock's line on his cast's turn**, as Puddles' watering: "Babur spent his turn on the hoops." (his whole turn: no move to show).
9. **Select framing:** his bunch of balloons rides high over his head, so the neck sits low in his tile (`at` 0.69) to keep the balloons in;
   the tint is his knight balloon's blue (`#2f7fe0`), across the wheel from his orange.
10. **The tile blurb** in the lines draft ("A circus tiger turned balloon artist…") has no place on today's select screen (no tile or stage
    shows a blurb, and there is no length cap to check it against): not added. Where the game describes him, his FAQ block and the Boss alone
    card ("blows up balloons that land as his pieces · Hoops") do. Flagged for the director.
11. **`net.ts`, `solo.ts` are untouched**; `Board.tsx` is (the landing), which CI counts as a shared foundation: the whole e2e suite runs on
    this PR (and the `full-e2e` label: the full lane).

## Every player-visible text, exactly

- His name and tile: `Babur`; the stage's lines (`SELECT_LINES`): `No roaring tonight. Balloons only.` / `Another masterpiece.` / `Don't rush the artist.`
- The rage warning's second line: `Next turn: Hoops` → `After your move: Hoops` (the banner's first line is the usual `RAGE!`).
- The dock on the turn of his cast: `Babur spent his turn on the hoops.` (new).
- A move through a ring: `A burning hoop is in the way.`; his only move through one: `His only move: through the hoop.` (the rules lane's).
- The Boss alone card: `blows up balloons that land as his pieces · Hoops` (the rules lane's).
- His FAQ block (the rules lane's, now shown: he's playable); it reads right with what's built.
- His lines (`TIGER_LINES`, as written): entrance `Ugh. Another crowd.` / `No roaring tonight. Balloons only.` / `Step right up. Or don't. I'm on break.`;
  place `Let's see what this one wants to be.` / `Just a little air…` / `Shh. Creative process.`;
  move `Fine. I'll move.` / `Padding along.` / `Quietly now.` / `No leaping. I'm retired.`;
  capture `Pop goes your piece.` / `That one didn't make the show.` / `Swat.`;
  hurt `Hey! Watch the whiskers.` / `Rude. I was concentrating.` / `That's coming out of your ticket.`;
  strike `Swat!` / `Claws out. Just this once.`;
  thinking `Hmm… a giraffe? No. A knight.` / `Don't rush the artist.`;
  check `Check. Ta-da.` / `Check. The crowd goes mild.`;
  smug `Now that's showmanship.` / `Balloon artist. Chess genius. Same paws.`;
  rattled `This was not in the act!` / `Somebody get the ringmaster!`;
  ultimateWarn `Oh no. Not the hoops.` / `I swore I'd never do this again…`;
  ultimate `Fine! The hoops! Happy now?` / `One last show. Burning hoops!` / `Through the hoops, everybody!`;
  balloonCheer `Ta-da! Fresh from the pump.` / `Balloon art. Very serious.` / `Another masterpiece.`;
  balloonBigCheer `A queen! My finest work!` / `Look at her! She's perfect!`;
  wince `…I meant to do that.` / `Too much air. Again.` / `That one was a rough draft.`;
  victory `Show's over. Exit through the gift shop.` / `Bow. Curtain. Nap.`;
  defeat `Back to the circus, I guess…` / `My balloons… all of them…`;
  kingAttack `A balloon for your majesty. And another.` / `Bonk! Bonk! Bonk!` / `Hold still. This one's a crown.`
  Chances: Puddles' (entrance 1, move 0.12, capture 0.6, check 0.75, hurt 0.6, thinking 0.08, smug 0.8, rattled 0.8, defeat 1, victory 1,
  strike 0.8, kingAttack 1), plus place 0.15, balloonCheer 0.6, balloonBigCheer 1, wince 0.6, ultimate 1. No line is over a cap (the
  speech tests).

## Tests

- Unit: `packages/app/test/tiger-wired.test.ts` (20), and the shared ones updated for a thirteenth playable boss (roster, kits, select,
  king attack, the lobby's random pick, Big Boy's offset).
- e2e: `e2e/tiger.spec.ts` (6, both projects but the online one), `king-attack.spec.ts` (his Last Stand), `boss-select.spec.ts` (fifteen
  tiles, his stage, his color), `boss-smoke.spec.ts` (his passive and his ultimate within the smoke's time: no switch needed), `formats.spec.ts`
  and `home-ranked.spec.ts` (the counts).
- Frame by frame: `node scripts/frames-tiger.mjs <dir> [tile|place|grow|land|pop|hoops|attack|bar|all] [phone|desktop] [light|dark] [width]`.
