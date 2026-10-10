# History: Bosses and their powers

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/bosses.md).

## Boss raid: a mode of its own (Oct 4, 2026)

Eric: friends will want to queue up together for a boss, so make it a standalone mode with up to 50 people, a handful of engine strengths, always stronger than the lobby's average.
- **What it is.** A third mode card, **Boss raid**. Up to 50 players and no bots, picking the crowd's moves together (most popular wins).
  - **With friends:** create a raid and share the code; the host starts.
  - **Alone:** take the boss on yourself; you are the whole crowd.
  - Play now stays 50 v 50 only.
- **The board.** It starts from a named classical opening 5 moves in, from the opening library, the same balanced named lines as Classic. This was Eric's first boss idea ("four to six moves, lines every decent player knows"). A short roulette of famous opening names flicks past before the real one lands.
- **The boss's strength comes in six tiers**: 1400, 1700, 2000, 2300, 2600 and 2900. Each is one boss: The Pawn Golem, The Iron Bishop, The Black Knight, The Tower Tyrant, The Grandmaster Wraith and The Engine Eternal, ready for sprites later.
  - **The rule.** A raid gets the weakest tier that's stronger than the group's average rating.
  - **Ratings.** Each player's rating comes from their profile (their last engine rating), sent when they join. No rating counts as 1500.
  - **Low tiers.** The stumble rule above still applies, so the 1400 and 1700 bosses are beatable for new players.
- **Strikes and the King.** The boss still strikes down the worst recent mover every 3 moves, but only down to half the group, so a small group of friends isn't wiped out. The King has all 3 charges (there are no power-ups to convert).
- **Records.** Results go on profiles as their own mode ("Boss" tab). Those still standing share the win.

## Ten boss tiers (Oct 5, 2026)

- `BOSS_TIERS` is now 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3190. 3190 is the strongest Stockfish plays with its strength limited; full, unlimited strength is deliberately not a tier.
- One boss per tier, with placeholder names (Eric will rename them): Pawn Golem, Iron Bishop, Bone Archer, Black Knight, Storm Witch, Tower Tyrant, Frost Dragon, Grandmaster Wraith, Demon Lord, Engine Eternal. Two bosses per skull, 1–5.
- A raid still meets the weakest boss above the group's average rating. An unrated player (1500) now meets the 1600 boss (was 1700).

## Bosses never throw pieces away (Oct 5, 2026)

Eric: the Iron Bishop (the 1600 boss) just blundered its queen. "It's boss mode, not idiot mode."

- **Two causes, measured.**
  - Below 2100 the boss "stumbled" on up to 1 move in 4 (25% at 1600). A stumble was a *random legal move*, so it hung queens.
  - Stockfish's own limited strength (UCI_Elo) is also loose at the low end. A probe at 1600, with no stumbles, gave away more than 20 points of expected score on 13% of its moves (63 of 480), mostly by hanging a piece.
- **Now, a blunder guard on every boss move** (`bossMoveFrom`; settings `bossMaxLoss` 10 and `bossMaxLogitLoss` 1).
  - Each move is checked against the engine's top 8.
  - A move that gives away more than 10 points (about a pawn, from an even position) is swapped for a slip. So is one that loses more than 1 in log-odds, which is the same guard in a position that's already won or lost, where points shrink.
- **A stumble is now a slip.** It's a small deliberate inaccuracy from the top moves, losing 2–7 points (`bossSlipLoss`), never a random move. Weak bosses stay beatable by out-playing them, not by waiting for a free queen.
- The King's strike (stagger) stays within its own 5–15 point range, but can no longer fall back to bigger losses.
- **One more check before any move but the best.** The 8-line search spreads its effort thin and now and then misjudges a move. So any move other than the best is re-scored head to head with the best in one focused search, and if it fails the guard there, the boss plays its best move.
- Cost: one 8-line search per boss move, plus one or two focused ones.
- **Measured** (`packages/sim/scripts/boss-blunders.ts`: 240 to 480 boss moves per run, judged by a separate search):

  | Moves that give away | 1600 before | 1600 now | 1400 now |
  | --- | --- | --- | --- |
  | more than 20 points | 13% | 1.3% (worst 23, in already-worse positions) | 0.8% |
  | more than 30 points (a piece or worse) | 9.4% | 0 | 0.4% (1 move) |

  The one left at 1400 was the engine's own top choice misjudging a deep tactic within its search budget, which no guard on top of the engine can catch. The low bosses are now noticeably more solid; they lose on accumulated inaccuracies.
- The only random boss move left is the server's emergency fallback, when no device in the lobby can run the engine at all.

## Pick your boss (Oct 5, 2026)

Eric wants to choose which boss to fight.

- Boss raid shows a row of boss cards (name, skulls, strength), weakest first, plus "Match me" (the old behaviour: a step above your rating, the default).
- The choice is saved on the device and used for solo ("Take on the boss alone") and for raids you create. The server takes `?boss=<tier>` and keeps the pick for rematches; an unpicked raid still matches the group.

## The boss menu comes first (Oct 5, 2026)

Eric: when you take on the boss alone, the first thing should be choosing which boss to fight, with each one's strength alongside.

- **A menu, not a row.** "Take on the boss alone" now opens "Choose your boss": all ten bosses in one list, weakest first. Each row has the icon, the name, its skulls, its strength (1400 to 3190), and a coloured "vs you" (−100 green, ≈ your level gold, +300 orange, +500 and up red). A bar for each boss puts them all on one scale, with a line at your rating. A tap picks the boss and starts. The old scrolling row of cards on the home screen is gone.
- **Solo always fights a named boss.** "Match me" is gone from the solo menu. The boss it would have picked (the weakest above your rating) is tagged "your match", and it's highlighted the first time. After that, your last pick is highlighted. Your rating is your profile's engine rating, or 1500 if you're unrated, and the header shows which.
- **"Create a raid" opens the same menu,** plus "Match the group" at the top (the old behaviour: the weakest boss above the group's average, decided when the raid starts). I did raids too so there's one way to pick a boss, not a menu for solo and a row of cards for raids. Joining a raid by code skips it: the host picked.
- **`?boss=N` skips the menu** (for tests and links). The pick is kept on the device as before, and in memory too, for browsers without storage.
- Checked on a 390 px and a 320 px phone, light and dark. Ten rows fit without scrolling on an iPhone 13; on a 320 px phone the list scrolls inside the sheet.

## A banner when you take the boss's queen (Oct 5, 2026)

Only the boss's capture had a banner ("QUEEN DOWN!").

- Now yours does too: "QUEEN SLAIN!" in holy gold and blue with the God King's face (white or black to match your side), while the boss thinks.
- The boss waits for it to finish. Its minimum think time goes from 1.2 s to 2 s after you take its queen, in solo and online (the server holds the host's reply until then).

## A solo boss raid flows like a chess site (Oct 6, 2026)

Eric: "when you do solo versus boss, you don't need the green confirmation highlighting on the tiles and you don't need
the beeping sound. It should just be you play your move and it's played", unless the God King steps in. Smooth, like
chess.com, for any solo mode (the solo boss raid is the only one where you're the whole crowd).

- **Before** (about 8 s a move): your move, "Move in. Waiting", a 4 s reveal ("Crowd plays Bb5 · 1/1") with a green
  ring on your piece and three tones, the boss thinking, its move with another green ring, then "Your move in 2… 1…"
  with ticks before your clock started.
- **Now:** you move and it stays played. The dock says "The boss is thinking…" while your move is scored, the boss's
  move slides in (the usual last-move squares, no ring), and your clock starts as it lands. About 3.5–4.5 s from your
  tap to your turn on the test machine, most of it the engine scoring your move (the boss's minimum think time now
  counts from your move, so the two overlap).
- **What still stops the game:** the God King's Last Stand (it plays out, about 9 s, then you pick again), a move he
  plays for you (his cut-in), the boss taking your queen (its banner), and running out of time (the reveal shows the
  move made for you).
- **The God King still comments on your move** (great move, bad move, a check, a capture): the reveal used to trigger it,
  so the same lines now fire straight from the solo game (`crowdMoveCues` in `godKing.ts`, shared with the reveal).
- **Only alone.** Raids with friends and the 50 v 50 boss final keep the reveal, the rings and the countdown: there,
  the crowd's choice is news. An online raid of one still has the old flow (the server runs its timing); solo is what
  Eric plays.
- **Later (Eric):** the Last Stand's own flashes (the freeze and the crash) are on purpose, but Eric thinks they need
  changing too. Not touched here.
- An e2e case checks it: a plain move goes play → scoring → boss → play, with no reveal, no ring and no countdown.

## Boss characters: style test (Oct 8, 2026)

Phase 1, before building any boss into the game: two bosses drawn as code-defined pixel art, to check the look with
Eric. Nothing in the game changes yet; the bosses still show as emoji icons.

- **What's drawn:** the Black Knight, after Eric's reference picture (a dark armoured knight, plumed helm, winged
  spear, ragged cape), and the Pawn Golem (a white stone pawn come to life, gold runes, floating boulder fists). Each
  has an idle loop (8 frames) and an attack: the knight's spear thrust (wind-up, lunge, a spark at the tip), the
  golem's two-fisted ground slam (fists over its head, a blur, dust and stone chips). Preview:
  `npm run preview:characters -- <dir> [ref=picture.png]` writes GIFs at 4x, frame sheets and a phone-size comparison.
- **Pixel art from parts, not whole frames** (`packages/app/src/characters/`): a palette, small grids of palette keys
  (typed by hand for hard surfaces, painted with shapes for cloth and stone), and frames that stack the parts at
  whole-pixel offsets, with quarter turns, mirroring and ripples for cloth. Why: an animation is a list of numbers
  (a lunge is `dx: -4`), so a boss's whole pack (idle, attack, hurt, death, taunt) costs a pose function, not dozens of
  redrawn frames; a recolour is a palette swap; and each part has its own outline, so the outlines stay right however
  the parts move.
- **Cues live on frames** (`cue: "thrust"`, `"hit"`, `"slam"`, `"impact"`): the sprite component will fire the sound
  and screen effect when that frame shows, so a sound pack lines up with the picture by construction.
- **Dark bosses on the dark ground:** the reference is nearly black, which vanishes on `#14161b`. The knight keeps the
  reference's near-black and warm highlights but a step lighter, and every boss gets a faint 1-pixel halo around its
  silhouette (not around its ground shadow or effects).
- **Eyes and runes as reactions:** the knight's eyes light red as he winds up, white-hot at the strike; the golem's runes
  breathe while idle and flare as it attacks. Palette flashes, so they cost nothing to add to any frame.
- The golem was picked over the Frost Dragon for the second boss: it's the first boss every new player meets, and a
  living chess pawn says "HunChess" more than a dragon does; a pale stone boss also shows the range against the
  knight's black steel.

### Boingo the Clown, the first boss built (Oct 8, 2026)

The clown on a pogo stick, from Eric's reference, is the 1500 raid boss (the Iron Bishop's placeholder slot). Built
end to end: sprite, portrait, animations, sounds, lines, and where he stands.

- **Name:** "Boingo the Clown" (short, says pogo; Eric can rename it in `packages/core/src/boss.ts`). His emoji is 🤡
  wherever a screen has no room for his drawing (the boss menu, the front menu).
- **Art:** my redraw (version 1 of the two style versions sent to Eric; the other was Gemini's clown converted 1:1).
  48 x 60 px from parts. The pogo's top is rigid, its spring slides, the gloves hold the handlebar and the shoes
  stand on the foot bar, and the body rides on top. He has eight faces (grin, laugh, hurt, smug, rattled, think,
  honk, out), so a new animation is a list of poses. If Eric picks version 2, only the parts change.
- **Where he stands:** kitty-corner across the board from the God King, never over a piece or a tap
  (`pointer-events: none`).
  - **Phone:** at the left of the boss bar above the board, since the God King is under it on the right.
  - **Computer:** by the board's bottom-left corner, at twice the size, since the God King is by its top-right.
  - The other layout's placement is hidden. His portrait takes the emoji's place in the bar, the "QUEEN DOWN!" banner,
    the entrance card and the God King's cut-in.
- **What he does, and when:** one moment per state change, all from the match state every player already has, so
  there are no new messages. The pure logic is in `characters/boss-beats.ts`.
  - **Entrance:** at the intro, he pops out of a puff of smoke and honks his nose.
  - **Thinking:** while the boss thinks, a hand on his chin and thought dots. **Hurt** comes first if the crowd's
    move took one of his pieces: a flash, crossed eyes, his hat knocked off.
  - **His move:** a hop, pointing. **Capture:** a laugh. **Check:** he honks his nose twice. **A strike:** he laughs.
  - **The crowd's turn:** his mood. **Smug** 3 or more pawns of material ahead, **rattled** 3 or more behind
    (sweat, a wobbly mouth), otherwise his idle: always bouncing, with a lower big jump every 6 s or so.
  - **Defeat:** he's knocked off the pogo and sits dazed. **Victory:** spinning leaps in confetti. Both also play on
    the results screen.
- **The mood comes from material, not the eval** (a change from the brief's "from the eval"). Each device works out
  its own eval, a moment apart and not always the same, but the board is identical everywhere, so material keeps
  every player's clown in the same mood.
- **In step online:** a moment's animation plays once from when this device first saw it, so a new screen mid-moment
  carries on rather than restarting; the loops run by the clock. A moment's key is its kind and the move number.
- **Lines:** short taunts in his own pixel text box, never instructions.
  - **Rare:** each kind of moment has a chance of a line (his plain moves 12%, thinking 8%, captures 60%, check 75%,
    his entrance and the end always).
  - **The same everywhere:** the line, and whether there is one, comes from a hash of the moment's key, so every
    player gets the same line at the same time.
  - **Mood lines** only when the mood changes.
- **Sounds:** synthesised in code (`characters/clown-sounds.ts`), so there are no files or licences: a pogo boing, a
  bulb-horn honk, a rubber squeak, a slide whistle up and down, and a kazoo laugh (no voice).
  - **Quieter than a move:** a unit test measures each one against the move sample's peak and mean level; each sits
    about 3 dB under it.
  - **Mute:** they play through `sound.ts`, so the mute switch silences them.
  - **No repeats:** his plain bounces are silent, and a sound never plays twice for the same frame (both placements,
    or a new screen).
- **Checking it:**
  - `npm run frames:character -- <dir> [boss] [phone|desktop|both]` screenshots a Boss-alone raid on a phone and a
    computer and saves the frames around him.
  - `npm run preview:characters` writes every animation as a GIF.
  - `e2e/boss-character.spec.ts` plays a raid against him on both layouts.

### Ginger, the Freeze boss, and the power art (Oct 8, 2026)

The gingerbread man from Eric's reference, drawn as the Freeze boss, plus the effect sprites his powers and Boingo's
need. The art, lines and sounds only: the power rules, the board overlays, the banners and making him playable are
the power rules' job (he becomes playable once he has powers too). `packages/core/src/boss.ts` is unchanged.

- **Name:** "Ginger" (Eric, Oct 9; drawn first as "Ginger Snap"). His kit is keyed by that name in
  `characters/kits.ts`, so the boss entry uses the same one. His "Snap!" lines stay: they're words, not his name.
- **Art** (`characters/gingerbread.ts`): 50 x 58 px from parts, in an 84 x 93 frame. Head (eight faces: angry,
  laugh, shout, hurt, smug, rattled, think, out; up to two cracks), torso with two gumdrop buttons and an icing belt,
  a green bow tie, and arms, legs and the cane painted from each pose's points (a shoulder, an elbow, a fist; a hip
  and a foot; the cane's grip and direction), so a new pose is a few numbers. The cane is in his right hand (our
  left), as in the reference.
  - **The frosty edge:** his icing's shadow is a cold blue, a frost glint runs round his icing while he idles, and when
    he casts his cane glows ice-blue (stripes recoloured, a pale rim round it) and his red eyes go icy.
  - **The cast points low:** he thrusts the cane forward and down across his legs, to his right, where the board is
    on both layouts (pointing it across his chest hid it behind his arms).
  - **Defeat:** cracked, he topples over on his side, the cane on the ground; no crumbling to pieces (drama, no gore).
- **Moments:** the same eleven as Boingo's (entrance: a whirl of snow, he drops in and slams the cane in a burst of
  frost; thinking: hand on chin, snowflake thoughts; move: a stamp and a cane jab; capture: a cackle, fist up;
  hurt: crumbs fly, a crack; check: two frosty cane lunges; smug; rattled: his icing sweats; defeat; victory: cane
  high, jumping in snow). Two power moments: `freezeCast` (cane raised and charged, then thrust; the bolt leaves at
  the "freeze" cue) and `blizzard` (cane high, snow whirling faster and wider, bursting at the "blizzard" cue).
- **Lines:** his own, short and cross (cookie and frost puns), as rare as Boingo's, plus three new moments for every
  boss: `power` (a piece frozen: "Freeze!", "Chill out!"), `ultimateWarn` ("A storm is brewing…") and `ultimate`
  ("BLIZZARD!", "Let it snow!"). Boingo got lines for them too (the pie, the funhouse). They're in the `Beat` type
  now; `bossBeat` doesn't produce them: the power rules say when they happen.
- **Sounds** (`characters/gingerbread-sounds.ts`, synthesised, no voice): a cookie crunch (hurt, defeat), a
  sleigh-bell jingle (entrance, his move, capture, victory), an ice crackle (frost slams, the cast, the ice) and the
  blizzard's wind (with the sweep). Seeded noise, so each is the same every time and testable. Each sits about 3 dB
  under a move's mean level, the wind about 5 dB (it's long), with a soft ceiling keeping peaks under half a move's.
  The shared synth helpers moved to `characters/synth.ts`; Boingo's sounds are unchanged.
- **Boingo's new moments,** added without changing his others: `pieThrow` (a pie up behind his head, wind-up, throw;
  the pie leaves at the "throw" cue, with a slide whistle) and `funhouse` (played on the board: his shadow grows, he
  drops in, lands with a boing, springs into a spin — the board flips at the "flip" cue — and lands laughing,
  pointing). New sounds: a pie splat and the funhouse boing-flip.
- **Effect sprites** (`characters/effects.ts`), each frame exactly the area it covers, so placing one is sizing its
  canvas to a square or the board:
  - `iceOverlay` (a square, 32 px): freeze (frost creeps in, the ice closes and flashes), frozen (loop, a glint now
    and then), thaw (cracks, chips, melts to a puddle, gone). The ice is see-through, so the piece shows under it.
  - `blizzardSweep` (the whole board, 24 px a square): a ragged cloud front and driven snow crossing left to right in
    1.3 s, a haze thinning behind it; the wind starts with it.
  - `pieSplat` (a square): splat (the pie comes down, SPLAT, cream flies), pied (loop), fade.
  - `iceBolt` and `pieFly` (a square each, loops): the bolt and the pie in flight, for flying them to the square.
- **Renderer:** a palette colour may be `#rrggbbaa` (see-through), for the ice and the haze. Old palettes are
  unaffected.
- **The contract** (`characters/power-art.ts`, also exported from `characters/index.ts`): `POWER_MOMENTS` (per boss:
  each power's animation, the cue of its hit, whether it plays on the board, the effects that follow), `EFFECTS`
  (each effect's sprite, what it covers, its start, loop and end animations, its sounds), `EFFECT_NAMES`,
  `POWER_ANIMS`, `cueAt` and `animLength`. `components/BossEffect.tsx` plays any of it (`<BossEffect>`, and
  `<BossMoment>` for a boss's animation away from his spot), with its sounds from the frames' cues, once, through
  the mute switch, from a shared start time so everyone online sees the same frame.
- **Checking it:**
  - `npm run preview:characters -- <dir> only=gingerbread` writes his GIFs; the effects are drawn over the board
    (a white pawn under the ice) as `fx-<id>-<anim>.gif` (`only=fx` for just those).
  - `npm run frames:character -- <dir> Boingo both kit="Ginger" fx` plays a raid with his kit in Boingo's place,
    then plays every effect and power moment over the real board and his spot, with frames every ~70 ms.
  - `packages/app/test/gingerbread.test.ts`: his kit, lines, cast and sounds; the power moments; the effects.

### G-REX, the Fire boss, and his fire (Oct 9, 2026)

The cocky giraffe from Eric's reference, drawn as the Fire boss, with the effect sprites his powers need. The art,
lines and sounds only: his powers' rules, placing the effects on the board and making him playable are the power
rules' job (`god-king`); `packages/core/src/boss.ts` is unchanged, so he never shows yet. His kit is `BOSS_KITS["G-REX"]`.

- **Name:** "G-REX" (Eric's), exactly.
- **Art** (`characters/grex.ts`): 56 x 88 px from parts, in a 100 x 122 frame (room above for his jump and the
  rockets). Three-quarters, facing right as in the reference: the flaming mane and tail on our left, the two sparklers
  on our right, towards the board.
  - **A giraffe first (Eric, Oct 9):** a long neck, so he stands about as tall as the God King with his wings spread,
    and a giraffe face: half-lidded cocky eyes with a fiery glint, a cream muzzle, flaming ossicones. The first draft
    had dark shades and a short neck; Eric asked for the neck and the face instead. The head stays big (32 x 23 px) so
    the eyes and grin read on a phone.
  - **His box grows on a phone:** the boss bar's character box is 88 px tall for him (`kit.tall`), so his head never
    covers the heading above the bar; the bar is about 30 px taller in his battles. By the board on a computer and in
    the results his frame simply rises higher (results box 180 px).
  - **Rigging:** head (nine faces: grin, laugh, roar, shout, hurt, smug, rattled, think, out; the eyes are drawn from
    a lid, a slant and where the pupil looks), torso and neck as one part (no seam), and arms, legs and tail painted
    from each pose's points; the sparklers hang off the fists. The flames (ossicones, mane, tail tuft) are painted
    tongues in three flicker shapes and a roaring size; the sparklers' sparks are seeded specks, different every frame.
  - **Yellow with orange-brown spots,** a dark outline and a dark halo, so he reads on the light and the dark ground.
- **Moments:** the same eleven as Ginger's. Idle crackles: flames flicker, sparklers spit, a head bob to a beat, and
  every 6 s a sparkler twirl and a laugh. Entrance: a fireball streaks down and he's crouched in a wall of flame, then
  the sparklers fizz alight. Thinking: a hoof scratching his neck, little flames for thoughts. Move: a step and a
  sparkler flourish. Capture: laughing, both sparklers up. Hurt: eyes screwed shut, embers knocked off. Check: two
  jabs of both sparklers, eyes glowing. Smug: fist on hip. Rattled: wide eyes, sweat. Defeat: his flames go out in
  puffs of smoke and he keels over. Victory: jumping, sparklers high.
- **Power moments:** `ignite` (he winds up and throws the outer sparkler at the board; it leaves his hand at the
  `throw` cue; a fresh one fizzes alight), `candleWarn` (the ultimate's warning: he shows off the Roman candle, its
  fuse fizzing) and `romanCandle` (his ultimate, on the board: he drops onto its middle with a roar, raises the candle
  and fires twelve shots up, one every 140 ms, `launch` then `shot` cues). The inferno (the whole board ablaze) was
  dropped when Eric replaced it with the Roman candle.
- **Two new moments for every boss** in `boss-beats.ts`: `powerHit` (the passive's payoff landing later: a piece burnt
  up) and `ultimateHit` (the ultimate's payoff: fireballs coming down). Both play his laugh; the kit has their lines.
- **Lines:** a cocky show-off, fire puns and the odd dinosaur joke ("Rawr! I mean… hi.", "Tiny arms? Not me!",
  "Extinct… again…"), as rare as Ginger's, with lines for igniting a tile, a piece burning up, the warning, the launch
  and the fireballs.
- **Sounds** (`characters/grex-sounds.ts`, synthesised, no voice): a fire crackle, a whoosh, a sparkler's fizz, the
  poof of a piece burning up, a Roman candle's pop, and a comically big roar (a growl that ends in a squeak). Each
  sits about 3 dB under a move's mean level, peaks under half a move's.
- **Effect sprites** (`characters/effects.ts`, one square each unless said):
  - `fireTile`: ignite, three stages that read on their own with no number (stage 1 a singe at the borders; stage 2
    the scorch creeps in, flames up the sides; stage 3 ablaze, flames lower in the middle so a piece shows), spread2
    and spread3 (the flames leap as it steps up), burnOut, and fizzle (the fireproof king). A piece stays visible at
    every stage. The countdown is the stages: a number overlay was optional, and none is drawn.
  - `pieceBurn`: one per kind of piece (p, n, b, r, q; never the king): flames engulf it, `poof` (take the real piece
    off there), its charred shape crumbles from the top into ash and embers.
  - `sparkFly` (his sparkler tumbling), `candleShot` (a rocket streaking up, and its pop), `fireballFall` (falling, and
    its landing, which ends on a stage-1 fire tile), and `candleShots`: a strip of 12 little rockets, lit while they're
    up and spent once fallen (`left12` to `left0`), to show by the board during the wait.
- **The contract** (`power-art.ts`): `POWER_MOMENTS["G-REX"]` (with the new optional `powerHit` and `ultimateHit`), the
  six effects in `EFFECTS`, and new optional fields: `stages` (the fire tile's escalation), `endings` (fizzle),
  `pieces`, `counter` (the shots left) and `next` (a landing that becomes a fire tile); `covers: "strip"`.
- **Kept cheap:** a storm of his fire at once (14 burning tiles, a piece burning, four fireballs, two rockets, the
  sparkler, the shots strip and him on the board) on a phone slowed 4x first dropped 25-33% of frames against 7-11%
  on the plain board: each of 22 sprites had its own animation-frame loop and canvas. Now every effect sprite shares
  one loop, and `<BoardEffects>` draws many square effects on one canvas over the board, redrawing only squares whose
  frame changed. The same storm then measured like the plain board (sitting 13% vs 11% dropped, dragging 7% vs 18%,
  p95 33 ms both; 6 animation-frame callbacks a frame against 5). Loops are at most 8 frames of 50 ms or more, and
  every frame is drawn once and kept.
- **Checking it:** `npm run preview:characters -- <dir> only=grex,fx` (his GIFs and the effects over the board, a pawn
  on the fire tile); `npm run frames:character -- <dir> Boingo both kit="G-REX" fx` (in the game, frame by frame);
  add `fxperf` for the storm's numbers on a slowed phone. Tests: `packages/app/test/grex.test.ts`.

### Hollow, the Darkness boss: his art, his dark and Lights out (Oct 9, 2026)

The furry Christmas thief from Eric's reference, gone dark, drawn as the Darkness boss (the design is the last section
of this file). The art, lines, sounds and a preview only: the rules (the dark squares, the tapping, the penalties, the
test, making him playable) are the power rules' job (`god-king`). `packages/core/src/boss.ts` is unchanged, so he never
shows in a battle; his kit is `BOSS_KITS["Hollow"]`.

- **An original creature, not a recoloured Grinch** (director's call, per the design): charcoal-black shaggy fur, a
  round face with spiky cheek tufts and a wild tuft on top, glowing gold eyes, no green anywhere (a unit test checks
  every colour), no suit, no hat, never "Grinch" in a line. Torn seams across his cheek, his shoulder and a thigh are
  bound by violet-black darkness, and where his middle was there's a band of it with a void at its heart: a black core,
  two violet arms turning round it and a tilted ring. **A violet edge glow** (his halo, `#6a46c4`) keeps him from
  vanishing on the dark ground, and it reads on the light ground too.
- **Size:** 64 x 66 px in a 104 x 102 frame (room for his drop and leap), lanky, a big head for a phone: about Ginger's
  size, a bit taller with his tuft. He fits the boss bar's usual box (his head clears the line above it), so no `tall`.
- **The strand: three bulbs, red, gold and blue** (no green, so nothing reads Grinch, and nothing looks like the
  board's green). Each bulb has its own palette keys, so **his looks `bulbs3`…`bulbs0` put them out from the end of the
  strand** without redrawing anything, glints included. The rules show the countdown by `kit.lookOf` (it reads a
  `bulbs` field, 0-3, the power rules add to the battle's powers), and there's a strip of its own for the board's edge
  or the boss bar (`bulbStrand`: `lit3`…`lit0`, `out3`/`out2`/`out1` as a bulb flickers out with a little spark,
  `relight` after the last), because three bulbs on his strand are only a few pixels on a phone.
- **Moments:** the usual eleven (idle: breathing, the void turning a full circle a second, the strand swaying and a glint
  running down the bulbs; entrance: darkness gathers, he rises out of it, his bulbs light; thinking: a claw on his chin,
  orbs of dark for thoughts; move: a step and a flourish of the strand; capture: a cackle, the void flaring; hurt: a
  flash, fur flies, his bulbs flicker; check: he looms twice, claws up; smug: a claw on his hip, swinging the strand;
  rattled: shaking, sweating, darkness leaking; defeat: the void sputters out, the bulbs go out one by one and he slumps
  into a heap; victory: leaping with the strand held high, the bulbs flashing). His power moments:
  - `darkCast`: he draws his arm back as darkness spirals into the void, flicks it at the board, and at `cast` the
    darkness pours from his chest (`darkPour` flies on to the square; `HOLLOW_CAST_FROM` is where it leaves him).
  - `claimDark`: the intro when the crowd would have been black: he points at himself, then the dark rises round him
    like a cloak. No board effect: a line ("The dark side is mine.") and the moment.
  - `lightsOut` (on the board): his shadow grows, he drops in, holds up the strand and crushes its bulbs in his claw one
    by one (`smash1`, `smash2`, `smash3`: dim the board a step at each), and the light goes out of him too.
  - `lightsTest` (the stance, a loop) and `test3`/`test4`/`test5` (a round's countdown: the void throbs once a second,
    wider as time runs out, twice in the last second, a `tick` each). His fur nearly black, his eyes two dim violet
    slits: the void is the only light. `testFound` (he recoils) and `testMiss` (he cackles in the dark).
  - `lightsBack` (on the board): a fresh strand spills out of the void and lights bulb by bulb (`relight`), the light
    comes back into him and he leaps off; the last frame is empty, so the rules show him back in his corner.
- **His new spot for Lights out (my call):** centred above the board, his feet on its top edge (`lightsOutSpot()`).
  The design leaves the spot open; anywhere on the board would cover squares the test asks about, and there's no room
  beside the board on a phone. On a phone he stands over the boss bar (the bar and its heading don't matter while the
  game is paused).
- **A dark square (`darkSquare`):** billows of violet-black smoke round a dark middle, lit from the top left, turning
  slowly, violet glints twinkling: cloudy, never a flat box. Its body always covers the square but its outer 2 of 32
  pixels (corners rounded), so the piece is hidden on every frame (a test checks it) and the normal green selection
  shows round it as a glow. Its last turn (`thin`) is paler and greyer, wisps peeling off its top, fewer glints, and
  still hides the piece (the dark lasts that turn too). `gather` as it forms, `clear` as it goes. `darkMiss` is a
  red-violet slash, for a wrong tap in the test or a wrong move into the dark.
- **The night (`nightSquare`, on the one shared board canvas):** a tile a square, so a found piece can show through
  its own square: 64 tiles plus 16 coordinates, one canvas, one loop, only changed squares redrawn. Deep night, the
  light squares a touch lighter than the dark ones (so you can still count along a rank), faint violet square edges,
  the coordinates in a small violet pixel font (ranks down the left, files along the bottom, as the board shows them),
  and wisps of smoke drifting across the whole board as one field (each square's tile is one of 16 by where it is).
  `dim1` and `dim2` darken the board with a flicker at each smash (the pieces still show); `dim3` goes to night. A found
  piece: a violet flash, the smoke blown to the edges, a violet rim while it shows. A round's answers: the smoke parts
  without the flash, a gold rim. `close` brings the night back over a square; `dawn` lifts it, spreading out from his
  spot. `nightItems()` in `power-art.ts` gives every square's item for any step, so the rules never deal with tiles.
- **Lines:** quiet, cold, about memory and the dark ("Don't forget what's there. Forgetting costs." for his first
  cover, always; "Can you still see it?", "How do you like the dark?" now and then; "It's time."; "Remember that."),
  everyone the same (by the moment's key). The test's prompt names the pieces: `findLine(["r", "n"])` is "Find my rook
  and my knight." New moments in `Beat` for him: `darkFirst`, `claim`, `found`, `missed`, `lightsBack`.
- **Sounds** (`characters/hollow-sounds.ts`, synthesised, no voice): the void's low hum, the dark pouring out, a whisper
  of smoke settling on (or lifting off) a square, a bulb going out (a glassy tink and a dying fizz), a bulb smashed (a
  crack, glass tinkling, a thump), the void's pulse in the test (a soft double beat), a piece found (a two-note
  chime), a miss (a dull buzz), the lights coming back (a shimmer and three rising plinks) and his bulbs clinking. Each
  is 2.7 to 4.7 dB under a move's mean level, peaks under half a move's (a test measures them).
- **The contract** (`power-art.ts`): `POWER_MOMENTS["Hollow"]` (power `darkCast`, ultimate `lightsOut`, `ultimateWarn`
  his check only if a warning is shown at all, since per Eric the rage meter is the only warning) with a new optional
  `more` for his other moments (claim, test, found, missed, lightsBack, bulbs); the six effects; `darkItem()`,
  `nightItems()`, `lightsOutSmashes()`, `lightsOutSpot()`. `BossMoment` and `SpriteAnim` take a `look` (his bulbs out
  as he casts).
- **Kept cheap** (measured with `npm run frames:wip -- <dir> Hollow lightsout phone 21 perf`, a phone slowed 4x):
  - All his frames' parts were painted when the app loaded, about 350 ms more on every start on a computer (more on a
    phone). `lazyParts()` (`sprite.ts`) paints each part the first time a frame that uses it shows; his and his
    effects' parts use it, the older bosses are unchanged.
  - The night is 80 small items on the one board canvas, redrawn every 220 ms. Its 256 tiles drawn as they first showed
    stalled the last smash (32 at once) and its first loop: `prewarm()` (`BossEffect.tsx`) draws them ahead, about 4 ms
    a frame on the shared loop, from when he drops in (`nightWarmList()`).
  - The first bulb smashed stalled 480 ms: its sound was being made (150 ms on a computer). The glass sounds are now
    closed-form (30 ms), and `warmSounds()` (`sound.ts`) makes a boss's synthesised sounds in idle moments once his
    character shows (Hollow's for now).
  - Through the whole Lights out preview: p95 16.8 ms, 2% of frames over 20 ms, the worst 50 ms; the plain board
    beside it p95 16.7 ms, 1%. `npm run perf:boss` (Ginger, phone, 25 moves) stays flat at p95 16.7-16.8 ms.
- **Previewing it, behind `?wip=1` only** (`components/WipPreview.tsx`): `?wip=1&kit=Hollow` puts his kit in every
  boss's place, and `&power=` plays a moment over the real board, over and over: `dark` (forming, dark, thinning,
  clearing, a miss), `cast`, `bulbs` (the countdown on his strand and the strip, the cast, the relight), `lightsout`
  (the whole ultimate, two rounds of the test with a find, a miss and an answer, the lights back), `test`, `back` and
  `claim`. `npm run frames:wip -- <dir> Hollow <moment> [phone|desktop|both] [seconds]` records it frame by frame and
  makes a GIF. Tests: `packages/app/test/hollow.test.ts`, `e2e/hollow.spec.ts` (his dark squares hide the piece and never
  take a tap; the night covers every square and lifts again).

### Big Boy, a sprite preview (Oct 10, 2026)

A chubby bald baby from Eric's reference, drawn so Eric can see him before deciding whether to keep this boss. Art only:
no powers, rules, lines or sounds of his own, and no entry in `packages/core/src/boss.ts`, so he never shows in a
battle. His kit is `BOSS_KITS["BigBoy"]`, seen only through the test link `?wip=1&kit=BigBoy`.

- **Art** (`characters/bigboy.ts`): about 53 x 69 px (between Ginger and Hollow) in a 78 x 92 frame, from parts like the
  others, light from the top left. A big bald head with five thin hair tufts, big ears, half-lidded eyes with the
  pupils turned in a little, a small round nose and big pink lips; a teal crop shirt reading "BIG BOY" with his belly
  and navel showing under it; a light blue diaper with tabs; bare feet with toes. The rainbow lollipop is in his right
  hand (on our left), as in the reference. The arms (each with its short sleeve), legs and the lollipop are painted from
  each pose's points, so a new pose is a few numbers; every part is painted the first time it shows (`lazyParts`).
  - **Proportions:** the head is a little bigger than the reference's (about 36% of his height against its 32%), like
    every boss, so the face reads at phone size, and his legs a little shorter, so his wave clears the heading above
    the boss bar on a phone; the rest follows the reference.
  - **Kept original:** nothing beyond the reference (its teal shirt, light blue diaper, five tufts and pink lips); no
    purple, no screwdriver, no three-hair tuft.
  - **The hair is a lighter brown** than the reference's black, without an outline, so the tufts show on the dark
    ground.
- **The shirt stays:** "BIG BOY" is two lines of 4 x 5 pixel letters. Red and teal are about as light as each other, so
  at first the letters blurred into the shirt at phone size; with a dark red drop shadow they read in the boss bar on
  an iPhone (checked in the game, `?wip=1&kit=BigBoy`). So the diaper-only version wasn't needed.
- **The lollipop reads at phone size:** a 17 px candy whose six colours wind out from the middle in a spiral (each a
  wide band at the rim; a test checks every colour shows), a white glint, a two-pixel stick. Its swirl turns when he
  waves it.
- **Animations:**
  - `idle` (loop, about 5.4 s): he wobbles side to side, dipping at the knees and rocking one heel up; blinks; brings
    the lollipop to his mouth and licks it twice (eyes shut happily), smacks his lips; wobbles and blinks again; then
    waves the lollipop high, its swirl spinning, with a grin.
  - `swing`: a fierce face, he raises the lollipop, pulls it back behind his head and chops it down at his side with a
    rainbow trail (cue `swing`), BONK on the ground in a burst of stars (cue `bonk`), then holds it up, pleased.
  - `tantrum`: his lip wobbles, then he goes red and stomps left, right, left, right (cue `stomp` on each, dust), fist
    pumping, wailing, tears flying, the lollipop shaking; he ends in a pout.
- **Never above his wave:** the swing first went over his head; on a phone that covered the "BOSS" heading above the
  bar, so it pulls back behind his head instead, no higher than the wave (a test checks every frame).
- **Placeholders for the preview only:** every moment plays one of his three animations (his move, a capture, check,
  a strike and his entrance the swing; hurt and defeat the tantrum; the rest the idle), and his cues borrow quiet
  existing sounds (Boingo's slide whistle and squeak, the soft pop) because every cue must have one. No lines.
- **Portrait:** his head, tufts and the whole candy beside it.
- **In the test link** he takes the place of every boss, but a battle is still that boss's: when Boingo's powers fire,
  the boss bar hides its character for the power's moment (as it always does) and Big Boy has no moment to play there.
- Tests: `packages/app/test/bigboy.test.ts` (a preview kit with no boss; never above his wave; the swirl's colours; the
  portrait), plus the shared character tests.

### Ideas for later, not built (Eric, Oct 8, 2026)

- **Real boss abilities, never game-breaking:** freezing most of the team for a turn, or making the crowd move a
  particular piece, but only when that piece has a move that isn't a blunder. They need the rules, the server and
  the engine (the director's call, with `engine` and `god-king`).
- **Bosses jumping to the centre of the board to cast something** (an ability's wind-up), the way the God King leaps
  onto the board.
- **More bosses drawn from Eric's references:** a farmer with a string trimmer, and a gingerbread man with a candy cane.

## Boss powers and the boss raid rework (design, Oct 8, 2026; the template, Freeze, Boingo and G-REX (Fire) built: see below)

Eric's design, with the director's review folded in and Eric's answers to its questions. Names are placeholders for
the kind of boss. Nothing here is built yet; when it is, each part gets its own section.

**The raid itself**
- **A random boss every match, at the lobby's strength.** The lobby's strength sets how strong the boss plays; which
  boss you meet is random, drawn from a shuffled deck per player so you meet every boss before any repeats. The threat
  skulls still show how hard this one is.
- **Each boss has an opening or passive ability and one ultimate.** A boss with nastier powers plays a little weaker
  underneath (a per-boss strength offset), so every boss is about equally beatable.
- **Self-balancing, not simulations** (Eric: don't burn tokens on balance testing): the game records how often the crowd
  beats each boss and nudges that boss's offset toward a target win rate. Rules get cheap unit tests (no power may leave
  zero legal moves or an illegal position); balance comes from real games.
- **Banners:** every boss power uses the God King's banner style: the boss on the left, the moment in the middle, your
  side's king or the God King on the right.
- **Ultimates are telegraphed:** a rage meter in the boss bar fills as the boss loses material; when full, a one-turn
  warning, then the ultimate. Once per match. (A proposal; some ultimates have their own trigger, below.)

**Ground rules for every power**
1. **The judge plays by the same rules as the crowd.** A power that limits moves tells the judge which moves are
   allowed, and the best move is chosen from those (Stockfish's `searchmoves`). A moment that can't be judged fairly is
   not scored (a blind turn, a move the boss plays for you).
2. **A power never leaves you without a legal move and never breaks check.** If a restriction would leave no legal move,
   or the only escape from check is a restricted piece, it lifts for that turn. The king is never frozen, burned or
   removed.
3. **The server decides every power,** from the match's seed and state, so everyone online sees the same thing and no
   device can tamper with it.
4. **Fair play skips power turns:** forced or restricted moves, duels and blind turns don't count as detection signals.

**The bosses**
- **Fire.** (Built as G-REX to Eric's later design, Oct 9: sparkler tiles anywhere on the crowd's half and the Roman
  candle. See "Built: the meter over time, ... G-REX" below.) Passive: tiles catch fire under your pieces only (his pieces never burn), with a 3-2-1 countdown; a piece
  still on the tile at 0 is destroyed. At most 1-2 tiles at a time, never under the king; sliding pieces may pass over.
  The judge treats a piece about to burn as already gone, so saving it is never scored as a mistake. Ultimate: when the
  engine finds a forced mate for the crowd in 3-5, the whole board catches fire: find the mate within its length + 2
  moves or lose (the + 2 is the director's suggestion; Eric's note said + 1).
- **Sludge.** Opening, both sides: pawns can't make the double step; rooks and bishops move only one square on their
  first move, then the sludge is gone. (No double steps also means no en passant.) Ultimate, your pieces only: a sludge
  flood: for 2 turns your rooks, bishops and queen move at most one square.
- **Zombie.** Passive: 1-2 of his pieces have two lives, shown with a glow; when captured, a piece comes back on its
  starting square, or the nearest empty one on his back row. Pawns can't stand on the back row, so they come back on
  their starting rank. A respawn never gives check. Ultimate: the next piece he captures rises on his side; a queen never
  rises as a queen (a knight or bishop at most).
- **Reflect.** Opening: he mirrors your move for the first 5 turns, unless it's impossible or would walk into mate in 1
  or hang his queen. Ultimate: for 5 turns you must move the same type of piece he just moved. He only plays a type you
  still have and can legally move; it ends early if you have none. If he moves his king you're free that turn, and in
  check any legal escape is allowed.
- **Freeze.** Passive: freezes one of your pieces (never the king) for 2 turns; a frozen piece still defends and gives
  check. Ultimate, the blizzard: a cold sweep of cloud and snow crosses the board, every piece ices over except your
  queen, and the God King says a line (several variants) like "Looks like our queen withstood the storm!", hinting she's
  the one to move. One turn, then the ice melts. If you have no queen, or she can't move, your king may move instead.
- **The Challenger.** Passive, the spotlight: every 2-3 moves he calls out one player by name ("Ana, show me what you've
  got!", several variants). That player's pick carries extra weight in choosing the crowd's move, enough to tip a close
  call about a quarter of the time, but never enough to pick a blunder (a pick the judge scores far below the best gets
  no extra weight). People only, never bots; never the same player twice running. Ultimate, the duel: your last-placed
  person moves alone for one turn, without power-ups; nobody else is scored that turn; if they run out of time, the God
  King makes a safe move.
- **Boingo the Clown.** Passive, the pie: he throws a pie at one empty square, which stays pied for 3 turns (nobody can
  move a piece onto it), then 2 clear turns, then another pie. The square is near the centre and chosen so it's roughly
  even for both sides (the engine checks it changes the eval little). Ultimate, the funhouse: as the turn passes to
  you, he pogos down onto the board, the board flips, he says a line and plays your move for you: a weak but
  recoverable one (about 1-2.5 pawns worse than the best, never hanging mate or the queen outright). That turn isn't
  scored. The board stays flipped for your next 2 turns (the director's call). The engine already picks deliberately
  weaker moves with a bounded loss (the boss's slips) and the God King already plays moves for the crowd; this reuses both.
- **Darkness.** Opening: fog hides his half of the board for 5 moves, with a counter. No move hints under the fog; an
  invalid move costs the most points a move can lose; you're still told when you're in check. Ultimate: one blind turn
  that starts on his move. His move is shown as text in his speech box (blindfold players always hear the move), the
  board is hidden, power-ups are off, you move by tapping a square then a square, and an invalid move costs the most
  points; maybe a few seconds' extra time. Line ideas: "I have never needed eyes to see your fear."; "Now we are equals.
  Sight was only ever the illusion."

**A base boss template** (so a new boss is mostly filling in a form): name and title; art kit (sprite, portrait,
animations); sounds; lines for every moment (entrance, thinking, his move, capture, hurt, check, smug, rattled, power
used, ultimate warning, ultimate, defeat, victory), several each, picked the same for everyone online; a strength
offset; a passive (when it fires and what it does) and an ultimate (its trigger, warning, effect, length and banner);
and, for each power, the rules it answers: which moves are allowed this turn, what happens after a move, what each
player can see, and whether the turn is scored and counted for fair play.

**Who builds what:** the characters delegate the art, lines and sounds; the god-king delegate the power rules (it owns
the boss battle's rules and how the God King's powers meet a boss's, e.g. whether the Last Stand undoes a burn); the
engine delegate judging with allowed moves and picking the clown's weak move. First to build: the template and power
system with two powers that prove it: Freeze (move limits and judging) and Boingo's funhouse (banners, warnings, the
engine choosing a move, and online sync).

**Later ideas:** boss drops (a themed crate item for beating a boss: a clown nose, a zombie hand); bosses jumping to the
centre of the board to cast; the farmer and the gingerbread man as bosses.

**Later (Eric, Oct 9, 2026; not built, design to be worked out with Eric):** every boss gets random quips and short
exchanges with the God King: they talk to each other and about each other (a boss taunting him, his retort; a line
about the other after a big moment). How often, which moments, and how it fits his quieter pacing (KING_SPEECH) are
open.

### Built: the boss template, Freeze and Boingo (Oct 8, 2026)

Built by the `god-king` delegate, which now owns boss powers and boss selection. Playable now: **Ginger, the
gingerbread man (Freeze)** and **Boingo the Clown (pie and funhouse)**, the only bosses in every boss mode. Their art,
moments, lines, sounds and the effect sprites are the `characters` delegate's (`characters/power-art.ts`).

**The template** (`packages/core/src/boss.ts`, `BOSS_ROSTER`): each boss has an id, name, icon, strength offset, a
passive and an ultimate (power ids), and its character kit (the app's `BOSS_KITS` key, for art, moments, lines and
sounds). Each power's rules live in `packages/chess/src/boss-powers.ts`: the moves allowed this turn (`crowdAllowed`,
`bossAllowed`), what happens as a turn begins (`prepareTurn`), what each player sees (`NetBoss.powers`: ice, pie,
flip, rage, the turn's events), whether a turn counts for fair play (`powerTurn`), and the funhouse (the only unscored
turn).
- **Playable = a complete character and powers** (`isPlayable`, `playableBosses`, `chooseBoss`): one rule for the raid,
  the Crowd's boss final and solo's menu. A boss's `kit` is set in the roster once its character is complete; an app
  test checks every playable boss's kit has every moment, its powers' moments, lines and a portrait.
- **Strength:** the lobby's (a raid: a step above the group's average; the Crowd final: the crowd's weighted rating)
  plus the boss's offset. Both offsets are −100 for now. The skulls follow the strength.
- **Which boss:** random each match (one draw from the match's seed, which also seeds its powers), never the one to
  avoid when there's another: solo, the last boss this device met (`boss-history.ts`); online, the one most of the
  lobby met last (each app sends its last boss when it joins; a strict plurality, else none is avoided). A raid's
  creator can still pick one (`?boss=<id>`); a test link's `?boss=<tier>` fixes the strength.
- **Solo's boss menu:** "Random boss" (a different one from last time), then each playable boss with its portrait,
  skulls, powers in a few words and its strength against yours. The ten-tier list is gone: the strength always
  matches you now (Eric's design: the lobby's strength, a random boss).
- **Records:** each result stores the boss (`results.boss_id`) with its outcome (`team_won`), solo and online, raid and
  Crowd final, for self-balancing later. The nudge itself isn't built: it needs real games first, then a small daily
  job (each boss's win rate → its offset).

**The power system** (the ground rules, as built)
- **The server decides** every power as each crowd turn begins (after the boss's move, or as the battle starts), from
  the battle's seed and the position (`prepareTurn`, once per turn: the Last Stand's re-pick doesn't re-roll). Solo
  runs the same code. The state travels in the shared match state (`BossState.powers`, `NetBoss.powers`): no new
  messages, only optional fields (`allowed` on jobs and boss requests, `funhouse` on a boss request, `lastBoss` on
  hello).
- **Never zero moves, never breaks check:** the allowed moves are always legal moves; a restriction that would leave
  none lifts for the turn (in check, that's whenever the only escapes are restricted). The king is never frozen.
  The boss is limited too, by the pie only.
- **The judge uses the allowed moves:** the best move is the best of the allowed ones (filtered from the top-8 search;
  if none of the top moves is allowed, one search over every allowed move, Stockfish's `searchmoves`); bots pick from
  them; a pick of a disallowed move is refused (the screens don't offer it, the server and solo reject it). The same
  code runs on judges, the host and solo, so honest devices still agree exactly.
- **Fair play:** a turn a power touches (a frozen piece, a pie, the blizzard, a flipped board) is scored, but never
  counted as a signal (`FairMove.power`, skip reason `bossPower`). The funhouse turn isn't scored at all, and the
  boss's strike doesn't count it.
- **Rage and the ultimate:** the rage meter (in the boss bar, beside the skulls) fills as the boss loses its own
  material, full at 9 (a queen's worth; `BOSS_POWERS.rageFull`). Full as a turn begins: the warning ("RAGE!", the meter
  pulsing) that turn; the ultimate the next. Once a match; the meter is gone after. A boss that never loses material
  never uses it.
- **Moments:** as the turn passes to the crowd, after the boss's move shows, each power that came with it plays in
  turn, in the God King's banner style (the boss's portrait on the left, the moment in the middle, the God King on
  the right). Then the boss steps up to the board's top-left corner (its side) and plays its kit's moment there
  (`freezeCast`, `pieThrow`, its warning, `blizzard`), timed so the moment's hit cue lands on the effect; its usual
  spot is empty meanwhile, and the dock shows its line for the moment (its kit's `power`, `ultimateWarn` or
  `ultimate` lines, the same for everyone). The crowd's clock starts after them, solo and online (`POWER_FX`, `powerMomentMs` in `boss-timing.ts`):
  a freeze 2.3 s, a pie 2.3 s, the warning 1.7 s, the blizzard 3.6 s, the funhouse 5.2 s.

**Ginger (Freeze)**
- **Passive:** from the crowd's 2nd turn, every 5-7 turns, one crowd piece (never the king) is iced for 2 turns: a
  pick from the three that matter most (pieces before pawns, by value and mobility), never one without a move or whose
  freeze leaves no other legal move. Its moves aren't allowed; it still defends and gives check. The moment: "FREEZE!"
  ("Your knight is frozen"), then he thrusts his cane, the ice bolt flies to the piece, and the ice (`iceOverlay`)
  forms on it and shimmers while it lasts.
- **Ultimate, the blizzard:** "BLIZZARD!", then the storm bursts from his raised cane and sweeps the board left to
  right (`blizzardSweep`, 1.3 s), and every crowd piece ices over as it passes, except the queen (no queen, or she can't move: the king; neither: no ice that turn).
  One turn. Then the God King says one of his blizzard lines ("Looks like our queen withstood the storm!", and three
  more; for the king, two). The passive waits a turn on the ultimate's turn.

**Boingo the Clown**
- **Passive, the pie:** from the crowd's 2nd turn, a pie on one empty square near the centre (c3 to f6) for 3 crowd
  turns and the boss's replies in between, then 2 clear turns, again and again. Nobody may move onto it. The moment:
  "PIE!", then he throws: the pie tumbles in from his side (`pieFly`) and splats on the square (`pieSplat`).
- **Ultimate, the funhouse:** as the turn passes to the crowd, "FUNHOUSE!", then he drops onto the middle of the board
  (his kit's `funhouse`), the board spins a half turn on its `flip` cue, he says a line ("Let me get that for you!", three more, or his kit's own) and plays the
  crowd's move: 10-25 points worse than the best (about 1 to 2.5 pawns from an even position, `funhouseLoss`), never
  past 1.6 in log-odds, never a move whose line allows a forced mate or leaves the queen to be taken (a queen trade is
  fine). It reuses the boss's slip code (the engine's top moves, then a head-to-head check with the best) and is
  played online by the host's engine, as the boss's own moves are. Not scored. Then the boss replies, and the crowd's
  next 2 turns show the board flipped (the crowd seen from the boss's side).

**Calls I made (Eric may want to change)**
- The pie's square is chosen without the engine: the empty central square the fewest moves of either side can reach
  right now (usually none), so blocking it costs nobody a move this turn. The design said the engine checks the eval;
  the server can't run one, and this keeps the server deciding.
- Rage counts the boss's own material lost, never coming back down (a trade fills it too).
- The freeze can ice the queen (she's often the piece that matters most); never the king.
- The board "flip" is a half-turn spin in the board's plane (pieces upside down for 0.7 s), then the board is drawn
  from the other side: a 3D card flip made the board measure its squares wrongly mid-turn.
- After his Last Stand the God King is silent. (He used to keep the blizzard's line, which names the one piece that can
  move; Eric, Oct 9: silent means silent.)
- Strength offsets are both −100; self-balancing will move them.
- A boss leaves its usual spot (hidden) while it casts at the board's corner or, Boingo, jumps on the board.

**Checking it**
- `npm run frames:powers -- <dir> [gingerbread|clown|both] [phone|desktop|both] [light|dark]` plays a solo raid with
  real taps and saves every painted frame of each moment, stills and a GIF.
- Test switch: `?power=blizzard` or `?power=funhouse` (with `?boss=gingerbread` or `?boss=clown`) warns as the second
  turn begins and unleashes the ultimate on the third; the passive comes on the second turn anyway. Online too, on a
  raid's link.
- Tests: `packages/chess/test/boss-powers.test.ts` (no zero-move states, check, the pie and freeze never block the only
  escape, the blizzard's fallbacks, deterministic choices, judging with allowed moves, the funhouse's move),
  `packages/core/test/boss.test.ts` (the playable rule, avoiding repeats), `packages/app/test/boss-kits.test.ts`
  (playable bosses have complete kits), `packages/server/test/boss-powers-lobby.test.ts` (online: everyone sees the
  same powers, picks and jobs follow the allowed moves, the funhouse from the host, avoiding the lobby's last boss),
  `e2e/boss-powers.spec.ts` (a Freeze match and a Boingo match on phone and desktop, the funhouse online).

### Built: the meter over time, solo difficulty, the test trigger, G-REX (Oct 9, 2026)

Eric's second round for the bosses, built by the `god-king` delegate. **Eric keeps the boss's elimination strike**
(every few moves it strikes down the worst recent mover) alongside the powers: the powers add to the raid, they
don't replace the strike.

**The ultimate's meter fills over time, for every boss** (`BOSS_POWERS` in `settings.ts`, `rageTick`/`ragePoints` in
`boss-powers.ts`)
- In rage points, full at 100: 5 each crowd move, so on its own it's full after 20 crowd moves (the warning as the 21st
  begins, the ultimate on the 22nd), around the middle of a battle; up to 5 more a move while the crowd is ahead on
  the judged eval (all of it from 75% expected score: twice as fast when the crowd is well ahead); and the boss's own
  material lost, 100/9 a point, so a queen's worth still fills it on its own. It never comes down.
- It glows as it nears full (from 75%), then the one-turn warning ("RAGE!", the meter flashing), then the ultimate,
  once a match, as before. `rageOverTime: false` turns the time and eval parts off (material only).
- **Online it's the shared, judged state:** the crowd's expected score after its move is the judge's (the number the
  lobby's runner scores with), kept in the battle's state, and the meter is worked out as each crowd turn begins on
  the server; every screen draws the number it's sent.

**Solo difficulty** (`BOSS_DIFFICULTY`, `boss-difficulty.ts`, `components/BossDifficulty.tsx`)
- Four segments above solo's boss list: Easy (−300), Normal (your strength, as before), Hard (+250), Hardest (+500), on
  top of the boss's usual strength (a step above your rating, plus the boss's offset), capped at 3190, the engine's
  strongest with its strength limited. The boss list shows each boss's strength with it. The boss stays random (or
  the one you pick); only how hard it plays changes. Remembered on the device. Not in the raid menu: online, the
  lobby's strength stands. A test link's `?boss=<tier>` ignores it.

**The test trigger (testing only)**
- Admins only, the same check as the fair-play review page (`ADMIN_EMAILS`): `/api/me` says `admin: true`, and the
  boss dock shows a small dashed "Trigger ultimate (testing)" button under itself in any boss battle, on every boss
  screen (your move, the reveal, the boss's turn). Online the Durable Object marks admins' sockets from the session
  cookie and the lobby takes the trigger only from them; anyone else's is ignored.
- It brings the ultimate **as the next crowd turn begins, without the warning** (the normal path, skipping the meter
  and the warning). It never touches a turn or a moment in progress: pressed during your turn, your turn goes on as it
  was and the ultimate comes after the boss's reply; pressed while the boss thinks, it comes as your turn begins. Once
  pressed it reads "Ultimate next turn (testing)" and is greyed out; spent, "Ultimate used (testing)". Already used,
  the battle over, pressed twice: nothing. `BOSS_POWERS.ultimateTestButton: false` removes it, server included.

**Fix: the God King stays silent after falling** in his Last Stand, the blizzard's line included.

**G-REX, the Fire boss** (`grex` in the roster; his art, lines and sounds are the `characters` delegate's). **Playable
now** in every boss mode, with his art and powers both in; the random draw is among three bosses.
- **Passive, burning tiles:** with no fire tile on the board, from the crowd's 2nd turn, he throws a sparkler onto a
  random square on the crowd's half (empty or occupied, never their king's). It burns in three stages, one a crowd
  turn: a singe, more burn, ablaze. After the crowd's move on the ablaze turn, a crowd piece still on it is destroyed
  (his own pieces never burn); the king is fireproof (the tile fizzles). Pieces may stand on it at any stage, and one
  that steps onto it ablaze burns at once. Then a full turn with no fire, then the next throw (a throw every 4 turns).
- **The God King's warning:** the first time in a match a crowd piece steps onto a burning tile (not yet ablaze), he
  says one of four lines ("Careful on that tile, don't stand there too long!"). Once a match.
- **Ultimate, the Roman candle:** "ROMAN CANDLE!", then he jumps onto the middle of the board and fires 12 shots up;
  12 pips by the board's top edge, one lit for each shot still up. 3 crowd moves later the fireballs fall on the
  crowd's half, a wave a turn: 1, 2, 3, 4, then the last 2 (exactly the 12), each landing as a stage-1 fire tile with
  the same rules, never on the king's square or a tile already burning, spread out (none next to another tile if it
  can be helped). The sparkler waits through the barrage, until its last tile is out and a turn has passed.
- **Fair judging:** on the turn a tile is ablaze, the judge treats a crowd piece left on it as already gone: each move's
  expected score less what it leaves to burn (1 log-odds a pawn of value, `firePawnLogit`), and the best move the best
  of those, so saving the piece is never scored as a mistake. The moves that take a piece off the tile are always
  scored (judges, the host and solo), and bots and power-up hints rank moves the same way. The engines' numbers stay
  raw everywhere; the lobby's runner takes the fire off them once, for everyone, so judges still agree exactly. A turn
  with fire on the board is a power turn for fair play.
- **The rules engine:** a destroyed piece changes the position between moves, so a board keeps a base where it changed
  (`BoardState.bases`): replays, the game's end, the recent moves, stepping back through the game and a spectator's
  replay all play from it. A burn never leaves a king in check: a piece shielding its king, or one whose loss would
  check the boss, doesn't burn (the tile fizzles). A rook burnt in its corner takes its castling right.
- **Timing:** the sparkler 2.3 s (banner, his throw from the board's corner, the sparkler's flight, the tile catching),
  the warning 1.7 s, the candle 5 s, a wave of fireballs 1.7 s; all before the crowd's clock starts, as every power's.
  A piece burning plays as the boss's turn begins (1.5 s, the characters' `pieceBurn` over the tile's burn-out; the
  boss's move waits for it, solo and online); a tile under the king fizzles, an empty one burns out.
- **On screen:** his `ignite` at the board's corner for the sparkler (`sparkFly`, then the tile's `ignite`); every tile
  on one canvas over the board through its stages (`spread2`, `spread3` as a turn begins); for the candle he drops onto
  the middle of the board (`romanCandle`), each `launch`/`shot` cue sends a `candleShot` up, and the `candleShots`
  strip by the board's top edge shows the shots still up until the last fireball lands; fireballs fall (`fireballFall`)
  a little after one another and land as stage-1 tiles while he laughs at the corner (his `ultimateHit` lines).

**Calls I made (Eric may want to change)**
- The meter's rates: full after 20 crowd moves on its own, twice as fast with the crowd well ahead.
- Easy to Hardest only for solo's "Boss alone" (the boss picker), not the solo raid with bots or online.
- The trigger brings the ultimate at the next turn's start rather than mid-turn: an ultimate mid-turn would change
  the moves allowed (the blizzard) or take the turn (the funhouse) after people had started picking.
- "After the turn after stage 3" read as: ablaze as a turn begins, and anything left there burns after that turn's move
  (the design's 3-2-1-0 countdown).
- A burn happens straight after the crowd's move (so the boss replies to the position without the piece, as the judge
  scored it), and the piece burns on screen as the boss's turn begins.
- A piece shielding its king never burns (its tile fizzles), nor one whose loss would check the boss: a power never
  breaks check, and a burn never gives one.
- The warning line counts a step onto a burning tile, not a tile landing under a piece, nor a step onto an ablaze tile
  (that piece burns at once).
- The fireballs' squares are random but spread out; they can land on pieces (that's the barrage's threat).
- G-REX plays 100 under the lobby's strength, as the others do; self-balancing will move it.

**Checking it**
- `npm run frames:powers -- <dir> grex [phone|desktop|both] [light|dark] [moves]` plays G-REX with the candle brought
  early, leaving a piece on a tile ablaze and stepping onto a burning one, and saves every frame of each moment and
  burn (`all` runs every boss).
- Test switches: `?boss=grex&power=candle` (warned as the 2nd turn begins, the candle on the 3rd; the sparkler on the
  2nd), `?power=sparkler`; `?boss=<id>&wip=1` (solo only) meets a boss whose powers are built before its art is (its
  emoji face; that's how G-REX was built before his art landed).
- `npm run perf:boss -- <dir> grex phone 25 candle`; `e2e/perf.spec.ts` checks G-REX's tiles at the barrage's peak late
  in a long game on a slowed phone.
- Tests: `packages/chess/test/grex.test.ts` (the meter's rates and switch, the trigger's safety, the tiles' stages, the
  king fireproof, judging, the 12-fireball schedule, the once-a-match warning, bases, difficulty),
  `packages/server/test/boss-powers-lobby.test.ts` (the trigger online: admins only; G-REX online),
  `packages/core/test/boss.test.ts` and `packages/app/test/boss-difficulty.test.ts` (difficulty),
  `packages/app/test/fire-replays.test.ts` (replays after a burn), `e2e/grex.spec.ts`
  (G-REX on phone and desktop with the candle; the trigger shown for an admin, hidden otherwise).

### G-REX, second pass (Eric, Oct 9, after playing him on phone and desktop)

Eric's eight changes, built across G-REX's lanes (his art, sounds and power rules) by one helper. This replaces the
12-shot candle described above; everything else about his fire stands.

- **24 shots** (`BOSS_POWERS.candleShots`), falling from 3 crowd moves after the launch as before, in waves of
  **1, 2, 3, 4, 4, 4, 3, 2, 1** (`candleWaves`): it ramps up, holds at its height for three turns, and tails off, so
  the barrage lasts nine turns. At its height twelve tiles burn at once (three waves of four), still under half of the
  crowd's 32 squares. The old rules hold: never on the crowd king's square, spread out (none next to another tile if it
  can be helped), the sparkler paused through the barrage (the last wave lands 11 turns after the launch and burns
  out 2 turns later; after a full turn without fire the next sparkler comes, 15 turns after the launch), and the
  judge's fire rule unchanged (only a tile ablaze counts).
- **Targets picked 3 turns ahead, shown as falling shadows** (`candleAhead: 3`, `candleTurn` in `boss-powers.ts`):
  - Each wave's squares are picked 3 crowd turns before it lands, from the battle's seed, so they're the same on every
    screen. The first wave's are picked as the candle goes up (it lands 3 turns later, as before). They avoid every
    square that will be burning or hit before then, and the king's square at the time they're picked.
  - On screen: a small round shadow on each square (3 turns out), bigger the next turn, bigger again (with a faint
    glow of the fire above) the turn before it lands; then the fireball drops onto it. The view sends them as
    `powers.shadows` (square, landing turn, size).
  - Drawn under the pieces (`fireShadow`, on one shared canvas below the pieces in the board's stacking context), so a
    piece standing on the square stands on its shadow and stays fully visible.
  - **My call:** if the crowd's king steps onto a shadowed square, that fireball **fizzles** as it lands (the tile's
    fizzle, no fire tile): "never on the king's square" holds, and walking the king under a fireball is never punished
    (he's fireproof anyway). The shot still counts as fallen.
  - **My call:** a square that has just caught fire can be picked for a wave 3 turns out (its tile will have burnt out
    by then); only squares that would still be burning as the wave lands are kept clear.
- **A bigger candle and a slam:** the candle is 10 x 48 pixels (was 6 x 20), about his height to the shoulder. He
  drops onto the board with the roar as before, heaves the candle up over his head and **slams it down on the board**
  in front of him (the `slam` cue: a hard wooden smack, his picture jolts, splinters and dust, and the board itself
  jolts for 280 ms), its fuse fizzes, then he fires the 24 shots one every 130 ms (about 3 s) while **sweeping it
  right, back across to the left and right again** (tilts of up to 26 degrees, drawn once per tilt), his other hoof
  pumping his sparkler. Each shot leaves from the candle's top along its tilt (a few degrees either way), so the
  volley fans out across the board; a shot is two squares tall with its trail, so it reads on a phone. The moment is 7.1 s (was 5 s), before the crowd's clock starts, as every power's.
- **Firework whistles** (`grex-sounds.ts`, synthesised): each shot plays a rising whistle, one of three (a quick bright
  one, a long low one, one with a warble), up to 7% higher or lower, and about one shot in three ends in a crackle
  high up. Each whistle sits about 10 dB under a move; the whole volley at once (24 overlapping whistles, every one
  crackling, at the slowest pitch) stays under a move's loudness, and the wood smack under half a move's peak. They
  all follow mute. **To swap in a recorded whistle later:** put the file in `packages/app/public/sounds/grex/` (credit
  it in `CREDITS.md`) and set `GREX_WHISTLE_FILE` in `packages/app/src/sound.ts` to its path (e.g.
  `"/sounds/grex/whistle.mp3"`); every shot then plays it, with the same pitch spread and crackles, at
  `GREX_WHISTLE_FILE_LEVEL`.
  - **Higher and shriller (Eric, Oct 9, polish batch):** like real whistling fireworks, about 2 to 5 kHz (they were
    0.7 to 3.4 kHz): a sine with its 2nd and 3rd overtones (a screech), a slight unsteady drift, a quick wobble and a
    little rasp (the tone roughened by a low buzz of noise, with a hiss on its pitch). The variety stays: one shrieks
    up (2.3 to 4.6 kHz), one slides down like a tube burning empty (4.4 to 2.4 kHz), one wobbles fast on its way up
    (2.6 to 4.3 kHz, 170 Hz at 11 a second). **My call:** about 1 dB quieter in RMS than before, since the ear is a
    little more sensitive up there; the whole volley still measures under a move (`grex.test.ts`), and mute holds.
- **Countdowns on his tiles:** a small number in the middle of every burning tile (the sparkler's and the fireballs'):
  the crowd moves left before it burns out and destroys what's on it, this one included: **3** as it lands, **2**,
  **1** while it's ablaze, and **0** as it burns (over the burn). Cream, a little see-through, outlined dark, about a
  third of a square tall, so the piece under it still shows what it is. **My call:** 3-2-1 then 0 rather than 2-1-0, so
  the tile never says 0 while there's still a move to save the piece (the design's "3-2-1 countdown; a piece still on
  the tile at 0 is destroyed").
- **The shots-left pips:** a column of 24 little rockets in the gutter beside the board's right edge (lit from the
  bottom; the column empties from the top as they fall), as tall as the board on a phone (the board row keeps 24 px
  there), at most 16 px wide on a computer. Never over the board, its timer bar or the eval bar (on the left).
- **The bar under the board on a computer.** The dock (the status line with « » and the God King) had been in the
  column beside the board, at its top, since the dock was built (Oct 4: the boss dock took the panel's place in the
  right column on a computer); Eric's screen (about 1590 px) shows it there. Now it's under the board at every width,
  as on a phone, the board leaving room for it (a computer's board is up to 100dvh - 310 px tall in a boss battle,
  which at 800 px tall is 490 px; at Eric's 923 px it keeps its full 556 px), and the column beside the board keeps chat
  (online) or the scoreboard (900-1099 px) from its top. Crowd matches are unchanged (vote results and chat where
  they were). G-REX standing beside the board, over the scoreboard, is as Eric likes it.
- **A flaky test fixed at its cause** (`e2e/grex.spec.ts`): two different races in the test, none in the game.
  - "Execution context was destroyed, most likely because of a navigation": nothing navigated. The test awaited the
    engine's search inside `page.evaluate`; Playwright reports any protocol failure of such a long-held call that way.
    A page id set before the match was unchanged after the failure, the engine answered the same search a moment
    later, and every search the page started had finished. The test now starts the search in the page and polls for
    its answer (`engineTop` in `e2e/helpers.ts`), never holding an evaluate open while the engine thinks. The same
    failure hit Ginger's power test in the full run, so `boss-powers.spec.ts` polls too. Details in
    `.claude/LESSONS.md`.
  - A piece burning shows for 1.5 s as the boss's turn begins; the test looked for it after its own wait for the turn
    to change, so under load it sometimes looked too late, and when two tiles burnt at once its locator matched two
    elements. It now watches for that square's burn from before the move (`watchFor`) and reads what burnt from the
    shared state.
- **Checking it:** `packages/chess/test/grex.test.ts` (the schedule, the targets 3 ahead, the shadows' timing, the
  king's fizzle), `packages/app/test/grex.test.ts` (the slam and the sweep, the whistles and the volley's loudness,
  the countdown, the shadows on screen, the pip column), `e2e/grex.spec.ts` (shadows and countdowns turn by turn on
  phone and desktop, the pips' place, the dock under the board at six computer sizes), `e2e/boss-character.spec.ts`
  (on a computer the God King is now under the board), `e2e/perf.spec.ts` (the launch, and twenty tiles and shadows
  late in a long game, on a phone slowed 4x: p95 17 ms, 1-3% of frames dropped, as on the plain board).

## Lag that grew with the match (Oct 9, 2026)

Eric: a solo boss battle against Ginger slowed with every move, on his phone and his computer, and was unplayable by
move 13-15; the blizzard glitched.

- **The cause:** the screens read the boss battle's view dozens of times per redraw, and in a solo battle every read
  rebuilt it, replaying the whole game with chess.js. The boss screen replayed it on every frame too. Details, numbers
  and the rule are in `.claude/LESSONS.md`.
- **The fix:** the view is built once per change; replays (`fenAfter`, `gameEnd`) and position lookups (`pieceAt`) are
  remembered; sprite frames draw about three times faster, with the same pixels; the rating curve is worked out once
  (Crowd's standings re-sorted it 5,100 times a redraw). Nothing a player sees or hears changed, and no timing either.
- **Bounded caches:** the last 256 lines and endings, the last 32 positions read. A cached answer is always the one a
  fresh replay gives (the key is the whole line), and an illegal move still throws.
- **Measured** with `npm run perf:boss` (a whole battle on a computer and on a phone slowed 4x, per move); also run on
  Boingo, a Crowd match and an online raid. **Guarded** by `packages/chess/test/long-match.test.ts` and
  `e2e/perf.spec.ts`.

## Two tweaks (Eric, Oct 9, 2026)

- **Ginger freezes a little more often:** every 4 to 6 crowd turns instead of 5 to 7 (`BOSS_POWERS.freezeEvery`). The
  first freeze still comes on the crowd's second turn, and each lasts 2 turns, so a freeze is never on top of another.
- **The God King keeps his colours in the dock:** his figure used to fade and desaturate when he couldn't be summoned,
  and go grey and half see-through once his moves were used. Now he stays in full colour; the crowns under him show
  what's left (a dash once they're spent), as before. His fallen figure after his Last Stand is still greyed: that
  shows he has fallen, which is different from having used his moves.

## Hollow, the Darkness boss (design, Eric, Oct 9, 2026; calls marked "director's call")

Eric's reference: a furry Christmas-thief creature, gone dark. Lore: the villagers tore him apart; the darkness brought
him back and now holds him together through the middle, so there is a void in his chest. He carries a strand of
Christmas lights. He is "the dark boss": a small change to the chess (a memory test), not a fog of war.

**Name: Hollow** (director's call; Eric didn't pick one, names aren't final). Kept an original creature, not a recoloured
Grinch, because that character is someone else's trademark: no "Grinch"/"Grimch" in names or lines, no green fur, no
Santa suit or hat. His own look is charcoal-black fur, torn edges bound by violet-black darkness, the chest void, and the
lights.

### Setup
- He always plays the black pieces; the crowd is always white (Eric: "he is always dark"). If the usual side pick would
  have made the crowd black, the intro shows him claiming the dark side with a line, before move 1. Nothing flips
  mid-game (director's call: avoids the bugs Eric worried about; Boingo's flip may be reused only as a one-off intro
  spin if it is a clean fit).
- Standard starting position: no opening moves, no Fischer random (Eric: "start from the baseboard").
- All power-ups work as usual; no special cases for conflicts with the dark (Eric).

### Passive: the dark
- After his first move (black's move 1), before the crowd's turn, he casts the dark on the square of the piece he just
  moved, with a line like "Don't forget what's there. Forgetting costs."
- Then every 3rd of his moves (his moves 4, 7, 10, ...) he covers another square. Each dark square lasts 10 turns (a
  turn = one crowd move plus his reply), so they build up to about 4 at once.
- Later covers pick a random occupied square (his or the crowd's, roughly half each), never a king, never one already
  dark; the server picks from the match seed (director's call). His lines taunt now and then ("Can you still see it?",
  "How do you like the dark?"). Everyone sees the same lines.
- The dark belongs to the square, not the piece: a piece that moves out shows up again where it lands; a piece that
  moves in disappears. Captures, checks and mates work as normal; check still shows on the king.
- Look: a cloudy, smoky darkness filling the square (violet glints, slow swirl), never a flat black box. It thins on its
  last turn so players know it is about to clear.
- Telegraph (director's call): his strand of 3 lit bulbs counts down, one going out per move; when the last goes out he
  covers a square and they relight.

### Tapping the dark, and the penalty
- Tapping a dark square selects it like any piece: the green outer glow on the square. No move dots for it (they'd give
  the piece away), and no move dots shown onto or past a dark square.
- Any move attempt that touches a dark square (starts on one, lands on one, or passes over one) goes to the server
  unchecked. If it's illegal: -5 points and the player tries again. Up to 5 wrong attempts per turn; the 5th ends the
  turn as a missed move (5 x -5 = -25, the same as `missedMoveScore`, so no extra cost). Eric's rule; the per-turn
  reading and the cap are the director's call.
- A turn never costs more than missing it: the turn's score (move plus penalties) is floored at `missedMoveScore`
  (director's call).
- Moves that don't touch a dark square behave as now.
- What's under the dark still reaches players' phones (the judge work on players' devices needs the real position), so a
  determined cheater could read it. Eric accepted that: it's a memory test, not a secret. Fair play counts these turns
  as normal (forgetting makes moves worse, never cheat-like).

### Ultimate: Lights out
- Fires from the shared rage meter like every boss (the meter is the only warning; no extra telegraph, per Eric).
- At the start of his turn: the game pauses (clocks stop). Line: "It's time." He leaves his corner for a new spot and
  smashes the bulbs of his strand one by one; each smash dims the board a step, until the whole board is dark. The dark
  board must look good (deep night, faint violet square edges and coordinates, drifting smoke), and every square must
  stay clearly tappable.
- Then a memory test in 3 rounds. He names pieces of his ("Find my queen."); everyone taps where they are:
  - round 1: 1 piece, 3 seconds
  - round 2: 2 pieces, 4 seconds
  - round 3: 3 pieces, 5 seconds
- He names a type; any square holding that type of his counts; if he names a type twice in a round, both squares are
  needed. No pawns while he has other pieces; the king can be named; no piece named twice across the rounds while
  others remain (director's call).
- A found piece flashes back into view; a miss (wrong square or out of time) costs -10 points per piece (director's call:
  a single miss shouldn't cost more than a missed move; the whole test can cost at most -60, so the chess still decides
  the raid). At the end of each round the answers show briefly.
- The server picks the pieces (seed), times each round, and judges the taps, with the usual late grace.
- During the test he stands in his new spot, the chest void the only light, pulsing with the countdown.
- After round 3 the lights come back, a fresh strand spills out of the void, he returns to his corner and plays his move.
  Dark squares that were there stay.
- Screenshots could beat it; Eric accepted that. The test isn't a move, so fair play doesn't see it.

### Who builds what
1. `characters`: Hollow's sprite, idle (swirling void), moments (casting the dark, the bulb countdown, the taunts, the
   ultimate's leap and smashes, the test stance), the dark-square and blackout looks, sounds. Behind `?wip=1`.
2. `god-king` (boss powers): the rules above in core/chess/server, the tapping and penalties, the ultimate test, tests and
   e2e. Hollow joins the playable roster only when both are done.

### Built: Hollow's rules, playable (Oct 9, 2026)

Built by the `god-king` delegate on the characters' art (PR #119). **Hollow is playable now** in every boss mode (the
raid online, Solo "Boss alone" and the Solo raid, and the Crowd's boss final): the random draw is among four bosses.
Roster: `hollow`, icon 🌑, offset −100 like the others (self-balancing will move it), passive `dark`, ultimate
`lightsout`. Every number is in `BOSS_POWERS` (`darkEvery` 3, `darkTurns` 10, `darkTryCost` 5, `darkTries` 5,
`lightsOutRounds` 1/3 s, 2/4 s, 3/5 s, `lightsOutMiss` 10, `lightsOutBotHit`); the beats both sides time by are in
`boss-timing.ts` (`LIGHTS_OUT`, `lightsOutTimeline`, `CLAIM_MS`, `POWER_FX.dark`, `DARK_FIRST_EXTRA_MS`).

**Setup.** He's always Black and the crowd White, from the starting position (no opening moves; the raid's card says "A
fresh game from the starting position"; the Crowd's boss final starts there too for him). When the usual side pick
would have made the crowd Black (today only the `?side=b` test switch does), the intro plays his `claimDark` at the
board's corner with his claim line before "START!" (2.4 s more intro).

**The dark** (`boss-powers.ts`: `prepareTurn`, `chooseDark`, `bulbsAt`, `moveSquares`, `touchesDark`, `darkAttempt`)
- After his 1st move and his 4th, 7th, 10th… (decided as the crowd's turn begins, from the seed): the 1st covers the
  square of the piece he just moved; the others a random occupied square, never a king's, never one already dark.
  **My call:** a seeded coin flip picks whose pieces (his or the crowd's), then a square of theirs, so it's roughly half
  each.
- A dark square lasts 10 crowd turns counting the one it falls on, thinning on its last (`darkItem` "thin"), clearing
  as the next begins. It's the square's: a piece moving in is hidden, one moving out shows where it lands.
- **The bulbs** (`powers.bulbs`, read by his kit's `lookOf`): his moves until his next cover: 1 before his first move,
  then 3, 2, 1, 3… (one goes out with each move; the last as he covers, and they relight). **My call:** the strip
  (`bulbStrand`) sits beside the rage meter in the boss bar, since three bulbs on his strand are a few pixels on a
  phone; it plays the bulb going out with his move and the relight as the darkness lands.
- **The cover's moment** (2.7 s, before the crowd's clock): "DARKNESS!" (sub "Dark on e5"), he casts from the board's
  corner, the darkness pours from the void in his chest onto the square and gathers. **My call:** his line types out
  in his text box over the board (the first cover's "Don't forget what's there. Forgetting costs." always, and that
  moment holds 1.3 s longer so it can be read; later covers a taunt half the time); the dock just says "Darkness!",
  because the long line was cut off in the phone's one-line dock.
- **On the board** (`PowerBoard`): the dark on one canvas over the pieces (opaque over the piece on every frame), never
  taking a tap. Check still shows on a king in the dark: the red glow is drawn over it. **My call:** stepping back
  through the game keeps the dark on its squares (it belongs to the square), so the history buttons can't lift it.
- **Tapping** (`Board.tsx`): a tap on a dark square selects it (chessground's green `selected`, round the cloud's edge),
  nothing picked up and no dots. The next tap is the attempt from it; your own piece in plain sight picks that one up
  instead; the same square again lets go. No dots from, onto or past a dark square. **My call:** a piece in the dark
  can't be dragged (dragging would show it); tap, tap. A piece in plain sight can be dropped anywhere while the board
  has dark squares; a drop that touches no dark square and isn't legal goes back, free, as before.
- **What "touches" means** (my call): the start, the landing, every square a slide passes over (ranks, files,
  diagonals, a pawn's double step), and a castling king's way on to his rook's corner. A knight's jump touches only
  its two squares. A pawn from the dark reaching the last rank becomes a queen (a picker would say it's a pawn); a
  visible pawn going into the dark gets the picker.
- **The penalty** (`runner.darkTry`, the lobby's `darkTry`, solo's `darkTry`): an attempt touching the dark goes to the
  server unchecked. Legal: it's the pick (the reply says so first). Illegal: −5 and you pick again, with a small
  "−5" rising off the square and his red-violet slash on it, and "−5 · 4 tries left" in your dock; only you see it.
  The 5th wrong attempt ends your turn as a missed move ("Out of tries."). The turn's score is the move's less 5 a
  wrong attempt, never below `missedMoveScore` (−25). **My calls:** tries count per pick round, so the re-pick after
  the God King's Last Stand starts afresh; an attempt the server finds doesn't touch the dark, or the move he took
  back, is refused at no cost; bots never try (they know the board). Fair play counts dark turns as normal turns.

**Lights out** (`lightsOutDue`, `chooseLightsOut`, `judgeTaps`, `botLightsMisses`; the lobby's `startLights`/`lightsStep`,
solo's `lightsOutTurn`; on screen `components/LightsOut.tsx`)
- **When:** at the start of his turn, after the crowd's move on the turn the shared meter was full as it began.
  **My call:** no "RAGE!" banner for him: that turn the meter shows full and pulses (its only warning), and Lights out
  comes before his move. The admins' trigger pressed during the crowd's turn brings it at the start of his turn right
  after; pressed while he thinks, at his next. `?power=lightsout`: full as the 2nd turn begins, so it comes after the
  crowd's 2nd move. Once a match; the meter is gone after.
- **Beats** (about 25 s, nobody's clock running): "LIGHTS OUT!" 1.3 s; he drops onto his spot above the board and
  smashes the bulbs, the board dimming at each (2.9 s); then each round: his prompt ("Find my queen."), a bar counting
  its 3/4/5 s down, the late grace (0.3 s), the answers 1.8 s; then the lights come back from his spot (2.3 s) and he
  plays his move. The server times it all and sends each player the test (their own taps judged); the app judges your
  taps at once with the same function for instant feedback, and the server's word stands.
- **Which pieces** (my calls): each round's from his pieces not named yet (never a pawn while he has others), then
  those named before, then pawns. A type can come up twice in a round (both rooks): both squares are needed. Any square
  holding a named type answers it, so if he names one rook either counts; at the round's end every such square shows.
- **Taps** (my calls): as many tries as pieces in the round: a square holding a type still to find is found (it flashes
  into view); a square already found, or another of a type already found as often as named, changes nothing; anything
  else is wrong (his slash). Out of tries or out of time, the rest are missed (slashed, then shown in gold). A person
  who taps nothing (or isn't there) misses every piece.
- **Cost:** −10 a piece missed, off everyone still in, at the end. It isn't a move: nothing else changes (move counts,
  time banks, the strikes' losses), and fair play never sees it. **My call:** bots in the crowd find each piece at
  75%, 60%, 50% (rounds 1, 2, 3), from the seed: more pieces and less time each.
- **My call:** a found or answered square that's dark stays dark under the night: Lights out never shows what's under
  the dark. The dark squares there before are still there after.

**Checking it**
- `npm run frames:hollow -- <dir> [phone|desktop|both] [light|dark]` plays Boss alone against him with real taps
  (`?side=b&power=lightsout`): the claim, the first cover, a wrong attempt, Lights out with a find, a wrong square and a
  round run out; every painted frame, stills and GIFs.
- Test switches: `?boss=hollow` (solo, or a raid link), `&power=lightsout` (or `dark`), `&side=b` (the claim).
- Tests: `packages/chess/test/hollow.test.ts` (setup, the schedule and bulbs, the cover's squares, expiry, what a move
  touches, attempts and the cutoff, the score floor, the rounds' pieces, tap judging, bots' rate, the timing, the
  trigger and the switch, the cost, once only), `packages/server/test/boss-powers-lobby.test.ts` ("Hollow online":
  attempts judged per player, the cutoff and the floor online; Lights out timed by the server, taps judged per player,
  misses costing, then his move), `e2e/hollow.spec.ts` (phone and desktop: the cover, selecting a dark square, a wrong
  attempt and the 5-try cutoff, a legal move out of the dark, a full Lights out from the admins' trigger with a find
  and a miss).

### Hollow, polish batch (Eric, Oct 9, 2026, after playing him)

- **His lights: a long strand held in the middle,** like Eric's reference: ten bulbs (red, gold, blue in turn) down its
  two halves, five a side, hanging from his hand in two curves, the bulbs either side of the wire on short stems. The
  countdown puts out a colour at a time (blue, then gold, then red: about a third of the strand per move, 10 → 7 → 4 →
  0 lit), then they relight; the 3-bulb strip by the board is unchanged and goes out in the same order. Lights out
  smashes the strand in three strikes, a section at a time (the inner half's low end, the middle by his hand, the
  outer half's low end), his claw reaching for each. **My calls:** one hand holds it, as in the reference (Eric's
  words said both hands, but his free hand carries his gestures: the claw, his chin, his hip); the strand's ends rest
  on the ground when he crouches; its outer half stays clear of the eval bar beside him on a computer.
- **His sounds: no chimes, ever.** The chime was his own: his bulbs lighting at the match's start, the strip relighting
  after every cover and the lights coming back all played three warm plinks rising in a major chord. Every sound of his
  but the bulb smash (kept: Eric loves it) is now low and dark: a dull fizzle for a bulb going out (no glass tink), a
  low heartbeat (lub-dub, about 45-75 Hz) for the void's pulse, low swells two tones a minor third apart for a piece
  found and the lights back, a dull thud for a miss, a sinking low breath for the darkness pouring and settling, two
  muffled knocks for his strand. A unit test checks each sits low (its RMS frequency under 800 Hz, the smash over 2
  kHz) and quieter than a move. **My call:** the hum (already a low beat) is unchanged; no shared sound was the chime
  (the boss menu and the START banner play no chime).
- **Lights out timing:** the rounds stay 3, 4 and 5 s. Every tap a player makes, right or wrong, adds 1 s to their own
  countdown (`lightsOutTapMs`): the bar bumps back up and "+1s" flashes by it. Tries stay one per piece, so a round
  gives at most that many seconds more. The server judges each player's deadline (the round's seconds, their taps and
  the late grace); a round is over when everyone has used their tries or run out of time (`lightsRoundEnd`), and the
  next follows its answers. **My calls:** every tap is a try, a second square of a piece already found included (it
  isn't wrong, but it can't buy time); the round's end is when the server saw it, never before, so nobody loses time
  to a late timer; a player done early sees "waiting for the others" online; the dock's prompt may take both its lines
  on a phone, as a compact list when long ("Find: a rook, a knight, e-pawn"), since his own words show in full in his
  text box (measured at 320-390 px: everything fits from 360; at 320 the longest lists are clipped).
- **Lights out picks: never trivial** (`chooseLightsOut`): only pieces that have left their starting squares. A type is
  named only if every piece he has of it has moved ("Find my queen."; two or more: "Find one of my rooks.", any counts);
  a pawn only if it has moved and is his only pawn on its file ("Find my pawn on the c-file."). Nothing is named twice
  in the test; pieces before pawns, each in a seeded random order. Not enough of those (an early or test game): the
  last resort is types with a piece still at home, then pawns at home alone on their file, then a file with several
  ("one of my pawns on the c-file"); a round with nothing left to name is dropped. `findLine` speaks the new prompts.
  **My call:** "moved" is read from the position (a piece on a square its kind starts on counts as unmoved), which is
  what makes it findable without memory anyway.


### Hollow, fixes after Eric's play, and Lights out's verdict (Eric, Oct 10, 2026)

**The boss menu read "undefined · undefined" on his card.** The card's words for each power (`POWER_WORDS` in
`Home.tsx`) were a plain string table that never got his two powers. They're now in `power-words.ts`, typed by every
power there is, so a power without words doesn't compile, and `test/power-words.test.ts` checks every boss's card line.
His card reads "darkens a square · lights out" (**my call**, in the style of "freezes a piece · blizzard"). Every other
power-word table (the dock's, the rage banner's, the kits' moments) already covered him; the dock's is now typed the
same way.

**Your move made a new sound against him.** It wasn't one of his sounds wired to the wrong cue: your move made no
sound at all, and the first thing you heard was his reply, his bulb going out and his strand's knocks.
- The board plays a move's knock as its position changes, and it did so in a plain effect, which Preact runs after
  the next paint.
- Alone against a boss, your move goes in, the screen shows "scoring", and the boss screen (him thinking) replaces it
  as soon as your move is scored. A real player thinks for a while, so the engine's search is done and the move is
  scored at once.
- When the boss screen came before the paint, the play screen's effect never ran. Its new board started from the
  position after your move, so it had nothing to knock for.
- Logged on a phone slowed 4x, thinking 4 s a move: Hollow lost 2 knocks of 4 and Boingo 1 of 4, with "scoring" on
  screen 30-50 ms. Ginger and G-REX kept theirs, only because their scoring happened to take longer. It hit Hollow most
  because he plays from the starting position.
- **The fix** (`move-sound.ts`, `Board.tsx`): the knock plays in a layout effect, and the app remembers the last
  position any big board showed. A board that takes over from another screen knocks once for the move made there, but
  only if its position is exactly that move played on the last one shown: never another game's board, never a jump of
  several moves, never twice.
- After the fix, the same runs knock on every move, within 15 ms of it, with no double knocks.
- Tests: `test/move-sound.test.ts`; `test/boss-kits.test.ts`, for all four bosses (no boss cue plays a piece's sound,
  and nothing a boss shows as your plain move lands has a sound in it); `e2e/hollow.spec.ts` (after a 2.5 s think, your
  move's knock is the first sound heard).
- **My call:** his hurt (you take one of his pieces) keeps its sound, his bulb's fizzle, since it's his reaction, like
  Ginger's crunch, Boingo's squeak and G-REX's poof. Boingo's bounce in his mood loops during your turn is his idle,
  not a move sound, and is unchanged.

**Lights out's prompt typed out and was gone, and went off the top of a phone.** It was only in his text box: above
the board's top-left, a third of the board wide, growing upward, up for 2.8 s.
- **Now the round's prompt is in the dock under the board, for the whole round** (and through its answers, with its
  result), until the next round's replaces it. The dock is in view on every screen and never under the boss bar.
- Through Lights out, the dock's « » make room for it. The dock keeps its height, so the board never moves.
- It's his sentence ("Find my king, one of my rooks and one of my knights."). Where that would take more than the
  dock's two lines (measured in its own font and box), it shows the compact list ("Find: king, a rook, a knight"), a
  size smaller if it must.
- Your count follows it ("0/3"), and the crowd's meter is under it (below).
- **My call:** his text box stays (his words as each round starts), but only where it fits: a box that would run off
  the screen isn't shown. The prompt never depends on it.
- Measured every 100 ms through whole tests at 320, 360, 390 and 430 px wide, each short (568-740 px) and tall
  (720-932 px), and at 1280×800 and 1920×1080. In all 2,276 samples the round's prompt was on screen, whole, in view
  and clear of the boss bar, in one fixed box per screen, and it changed with each round. Only at 320 px did the
  longest prompt take the compact list. Before, it was up for about a third of each round, and grew upward over the
  boss bar to 100 px tall.
- **His text box, fixed** (Eric, Oct 10: on a computer it showed for a moment, then was gone). It was up for 2.8 s at
  most, and its fit check ran every frame on a box that grew upward as it typed, so a long prompt hid itself once it
  rose off the top of a computer's screen. Now each round's line stays until the next round's (or the lights back)
  replaces it; the box has its full size from its first frame, and its fit is settled once, before its first paint,
  a size smaller rather than hidden (hidden only if it fits at no size down to 8 px: the longest prompts on a 320 px
  phone). `e2e/hollow.spec.ts` checks it every frame of every round, on a phone and a computer.

**Lights out: miss too much and he moves twice** (Eric's rule, Oct 10)
- The −10 a piece missed stays.
- **The crowd's find rate:** every piece found by everyone still in, over every piece asked of them. At or above
  `lightsOutHold` (70%) the light holds; under it, he moves twice.
- **My call:** everyone still in counts, people from their taps and bots from the seed. Alone ("Boss alone") that's
  just you; in a Solo raid with bots, the bots count, as online. The runner counts it the same way for the meter and
  the verdict (`lightsTally`, `finishLightsOut`).
- **The meter** (the dock, the whole test): found over settled so far, against a line at 70%.
  - A person's every try settles a piece (one try a piece, so a try that finds nothing is a piece missed), and once a
    round is over all of its pieces are.
  - Bots' finds count as each round ends.
  - "—" before anything is settled.
  - The server counts from its own judging and sends it with each round's end and the tapper's answer, plus a small
    `lightsCrowd` message to everyone else on each tap (like `moved`); solo counts it the same way.
- **Bots** now find 85%, 75% and 65% by round (`lightsOutBotHit`): 71.7% over a test on average. A crowd of 6 bots
  holds about 55% of the time, 20 bots 71%, 49 bots 76% (2,000 seeds each).
- **The verdict, as the lights come back:** his line, "The light holds. For now." (or another of `lightsHeld`) or "You
  forgot. The dark moves twice." (`lightsFailed`), and the dock says "The light holds." or "He moves twice!".
- **His extra move** (`extraMoveFrom` in runner.ts, `passTurn`, `extraMoveCandidates` and `pickExtraMove` in
  boss-powers.ts). After his own move and its moments, he thinks again (as for a move), then plays it, with his banner
  "TWICE!" ("Hollow moves again", 2.2 s, `POWER_FX.extra`). Then the crowd's turn and clock.
  - It's a quiet move: no capture (en passant included), no check, no promotion, and his king never in check.
  - **My call:** never one that leaves the crowd without a move (a stalemate would decide the game), and never a line
    with a forced mate either way.
  - Its gain is at most `lightsOutExtraGain` (3 points, expected score × 100) over not moving again. His expected score
    had he not moved is one less the crowd's best in the position after his move.
  - **My call:** it may not lose him more than 3 either, so it never hands the crowd the game. Of the moves within
    that, he plays the one that gains most.
  - The engine's top 8 first, then the rest of the quiet moves (as Boingo's funhouse move is picked), by the same
    engine as his moves: the host's online, this device's in Solo.
  - He skips it when the crowd is in check after his move, when no quiet move fits, or online when the host answers
    "" or anything that isn't a candidate. **My call:** with no engine anywhere, he skips it rather than play a random
    move.
  - On the board, the crowd's turn passes (a base where the position changes between moves, as G-REX's burns leave),
    then his move: the history keeps both of his moves, and every replay plays from the base.
  - It isn't the crowd's turn: nothing is scored, fair play never sees it, and the crowd's turn count (and with it the
    dark's schedule and his bulbs) is unchanged.
  - It works online and in Solo, and the admins' trigger still brings Lights out. Once the crowd has moved, it lapses
    (a driver that skips it, like a simulation, can't give it him a turn late).
- Tests: `packages/chess/test/hollow.test.ts` (the rate and the line, the running count, the bots' rates, the verdict,
  the candidates, the cap, the engine pick, the extra move in a battle, skipping it and its lapse),
  `packages/server/test/boss-powers-lobby.test.ts` (the count to everyone as anyone taps, the verdict, the host asked
  for the extra move and everyone seeing it, a crowd that holds the line, the host's ""), and `e2e/hollow.spec.ts` (the
  meter moving, a failed test bringing "TWICE!" and his second move before yours).
- Test switch, as before: `?boss=hollow&power=lightsout`. Tap nothing and he moves twice.

## Big Boy, the baby boss (design, Eric, Oct 10, 2026; calls marked "director's call")

A chubby baby in a diaper and a "BIG BOY" crop shirt, armed with a swirly rainbow lollipop. Sprite approved by Eric
("flawless") from the preview on branch `claude/bigboy-art`. Name not final (it is also a restaurant chain's mark).

### Opening: Snack time
- Before move 1, he waddles over and eats one of the crowd's centre pawns (d or e, from the match seed): about a pawn's
  head start. "Nom nom."
- His strength offset is lowered so his raid stays as hard as the others at the same tier (director's call; set it from
  a quick sim with the existing boss sim, record the numbers).
- Standard starting position otherwise; sides as usual.

### Passive: Toy blocks (director's call, approved by Eric with the set)
- Every 4 turns he tosses a toy block (an ABC block) onto an empty square in the crowd's half, chosen from squares one
  of the crowd's pieces could legally move to, so it matters a little. It stays 3 turns.
- Nothing can move onto it or slide through it, for either side.
- Never leaves either side without a legal move; never blocks the only way out of check (the judge uses the allowed-
  move filter, like Freeze); the server decides from the seed.

### Ultimate: the Big Bounce (Eric)
- Fires from the shared rage meter at the start of his turn, like the other bosses' ultimates.
- He leaps onto the board and bounces 3 times, each landing on a 2x2 block of squares (a shadow grows briefly before
  each landing). Pieces there are knocked up and tumble. The 4th bounce is a giant fall onto the four centre squares:
  a crash, a shockwave across the board, dust, the board jolts. Then every piece settles into the new position and he
  bounces back to his corner and plays his move.
- The new position is calculated beforehand (Eric): the pieces may be thrown around a lot on screen, but the result
  is a position whose engine value for the crowd is a little worse, about a pawn and a half at most.
- Rules for the new position (director's calls):
  - Only the crowd's pieces move; never a king; no captures (material unchanged).
  - Each moved piece lands on an empty square within 2 squares of where it stood; pawns only shift sideways along
    their rank (so pawn structure stays plausible and never reaches the first or last rank); 2 to 6 pieces move.
  - The crowd's king must not be in check afterwards (it's his move next); castling rights go for any moved king or
    rook; en passant is cleared.
  - From the seed, generate a batch of candidate positions, evaluate them with the engine path the boss already uses,
    and pick the one nearest the target loss (1 pawn) inside the band (0.5 to 1.5 pawns, settings). If none fits,
    take the smallest loss under the cap; if none is under the cap, the bounces still play but nothing moves.
- The crash moment isn't a move: unscored, and fair play follows the existing ground rules for power turns.

### Character
- No real voice: baby sounds (a giggle, a lollipop slurp, a wail, bounce boings, the big crash, a "nom" for the
  snack), quieter than a move, CC0 credited or synthesised.
- Short baby lines in his text box: "Mine!", "Nom nom.", "Waaaah!", "Big boy BOUNCE!", and so on.

### Built: Big Boy, playable (Oct 10, 2026)

Built by one delegate across both lanes (`characters` and `god-king`) on the approved sprite (PR from `claude/bigboy`).
**Big Boy is playable** in every boss mode (the raid online, Solo "Boss alone" and the Solo raid, the Crowd's boss
final): the random draw is among five bosses. Roster: `bigboy`, icon 🍭, kit `Big Boy` (the preview's kit `BigBoy`
renamed to his boss name; `?wip=1&kit=BigBoy` still finds it), offset −250, passive `blocks`, ultimate `bounce`. His
card in the boss menu reads "eats a pawn, toy blocks · big bounce" (**my call**: the snack is the first thing a player
choosing him should know).
Every number is in `BOSS_POWERS` (`blockEvery` 4, `blockTurns` 3, `bouncePieces` 2-6, `bounceReach` 2,
`bounceCandidates` 16, `bounceScreenNodes` 15,000, `bounceConfirm` 3, `bounceNodes` 100,000, `bounceLoss` 0.5-1.5,
`bounceTarget` 1, `bouncePawnLogit` 0.95); the beats both sides time by are in `boss-timing.ts` (`SNACK`, `BOUNCE`,
`BLOCK`, `POWER_FX.block` 2.3 s, `POWER_FX.bounce` 6.2 s).

**The snack** (`snackSquare`, `startsWithSnack`; the runner's `snackBoard`)
- A fresh game from the starting position (the raid's card says so), less the crowd's d- or e-pawn, from the seed. The
  position changes outside a move, so it's a base at ply 0: every replay (the intro's, a newcomer's, stepping back,
  the game's end) plays from it.
- **Sides as usual** (my reading of the design): the crowd is White in a raid and in the Crowd's final, as for every
  boss. With the `?side=b` test switch the crowd plays Black from the same position less its d7 or e7 pawn, so he
  opens as White.
- The intro: his card, then the snack (3 s, `SNACK`): he waddles in from the board's edge nearest the pawn, grabs it
  (it leaves the board at `grabAt`), bites it twice ("nom" at `nomAt` and after), smacks his lips and waddles off; his
  line ("Nom nom.") in his text box and the dock; then "START!". The pawn in his hand is the crowd's colour (his look
  `blackPawn`).
- **His strength offset: −250** (the others −100): 150 more for the pawn. From the boss sim
  (`packages/sim/scripts/boss-sim.ts`, a new `snack` mode: the crowd's d- or e-pawn gone before move 1; `stumble`, the
  game's boss; files in `reports/boss-sim/`), crowds of 10 bots:

  | Crowd (rating) | Boss | Games | Crowd wins | Draws | Boss wins | Avg moves |
  |---|---|---|---|---|---|---|
  | club (2289) | −100, no snack (the others today) | 8 | 0 | 0 | 8 | 44 |
  | club (2289) | −100, snack | 8 | 0 | 0 | 8 | 37 |
  | club (2289) | −250, snack | 8 | 0 | 0 | 8 | 38 |
  | club (2289) | −450, snack | 8 | 0 | 0 | 8 | 33 |
  | casual (1527) | −100, no snack | 8 | 0 | 0 | 8 | 34 |
  | casual (1527) | −100, snack | 8 | 0 | 0 | 8 | 30 |
  | expert (2848) | −100, no snack | 6 | 0 | 3 | 3 | 53 |
  | expert (2848) | −250, snack | 6 | 0 | 2 | 4 | 49 |

  - **What it shows:** with today's code the sim's boss beats club and casual crowds every time, with or without the
    snack, even 350 lower: those runs can't tell offsets apart (the old calibration's 38% crowd wins for the club crowd
    at −100 no longer holds; the boss's blunder guard has come in since). The games are shorter with the snack (37
    against 44 moves), so it does make him harder. Only the expert crowd isn't swept: there, −250 with the snack scores
    about as the others' −100 without (the crowd's score 17% against 25%, within six games' noise).
  - **So −250:** the engine's own measure of the head start, rounded: the starting position is 0.536 for White and
    0.31/0.30 without its d- or e-pawn (2,000,000 nodes), about 165 Elo by the expected score's odds; the expert runs
    agree within their noise. Self-balancing (the recorded results) will move it from real games.

**Toy blocks** (`chooseBlock`, `blockedBy`, `crowdAllowed`, `bossAllowed`, `prepareTurn`)
- From the crowd's 2nd turn, every 4th (turns 2, 6, 10…), a block on an empty square of the crowd's half that one of
  its pieces could move to as the turn begins (a seeded pick), for 3 crowd turns and his replies; it goes as the
  turn after its last begins (a puff of dust), then the next comes a turn later.
- Nothing moves onto it or slides through it, either side: a slide along a rank, file or diagonal, a pawn's double
  step, a castling king's way to his rook's corner. A knight jumps it.
- **My call: it stops moves, not attacks.** A piece behind it still gives check and pins as in ordinary chess, so the
  engine, the judge and every device keep playing ordinary chess; the block only takes moves away (like the pie).
- Never no move, never the only way out of check: a restriction that would leave none lifts for that turn (both
  sides). The judge, bots and power-up hints use the allowed moves; the screens show no dots onto or through it; a
  turn with a block is a power turn for fair play.
- On screen: "TOY BLOCK!" (toy-box stripes), he winds up at the board's corner and throws (`toss`), the block tumbles
  in (`blockFly`) and clacks down (`toyBlock` land, sit, poof). **My call:** an ABC block, its letter by its square (A
  red, B blue, C green), so the next one usually looks different.

**The Big Bounce** (`bounceDue`, `bounceCandidates`, `pickBounce`, `bounceSpots`, the runner's `bounceFrom`,
`applyBounce`; the lobby's `requestBounce`; solo's `bounceTurn`)
- **When:** the meter full as a crowd turn begins: "RAGE!" that turn ("After your move: the Big Bounce"); after the
  crowd's move, at the start of his turn, the bounce; then his move. **My call:** the usual one-turn warning, as the
  design says "like the other bosses' ultimates", landing at the start of his turn as it says too (Hollow's has no
  warning: Eric's rule for him). The admins' trigger: at the start of his next turn, no warning. `?power=bounce`:
  warned as the 2nd turn begins, the bounce after the crowd's 2nd move. Once a match; the meter is gone after.
- **The new position**, as the design says (only the crowd's pieces, never a king, no captures; each to an empty
  square within 2, pawns only sideways; 2 to 6 of them; the crowd's king not in check; castling rights gone with a moved
  rook; en passant cleared). **My calls:** a bishop keeps its colour; nothing lands on the toy block; the bounce never
  gives him check nor leaves him without a move; a try that leaves more of the crowd's material hanging (attacked by
  something cheaper, or attacked and undefended) than before is dropped before the engine sees it (he'd just take it:
  far past a pawn and a half). 2 to 6 pieces, even odds.
- **"A pawn" is measured in log-odds** (`pawnsLost`): the engine's expected score is squeezed near 0 and 1, so a pawn
  in points of expected score is anything from 20 points in an even game to under 1 in a lopsided one, and the
  snack makes the crowd's games lopsided early. Measured: the starting position is 0.536 for White, without its d- or
  e-pawn 0.31 or 0.30 (2,000,000 nodes): 0.95 log-odds a pawn (`bouncePawnLogit`).
- **The pick:** the loss nearest 1 pawn inside 0.5-1.5. **My reading of "if none fits, take the smallest loss under
  the cap":** the candidate nearest the band from below (the smallest step short of it), never one that helps the
  crowd (a literal "smallest" would pick a gain for the crowd whenever there is one); none at all: nothing moves.
  Never a line with a forced mate either way.
- **The engine path the boss uses** (each position's top move, the crowd's value one less his), kept to about one of
  his moves: a glance at all 16 candidates (15,000 nodes), then a proper look (100,000) at the position before and
  the 3 nearest the target, the pick from those; shared over the device's engines. **My call:** two stages rather than
  6 candidates at full budget: the same cost, a far better hit rate (6 at 100,000 nodes landed in the band 10 times in
  20). Measured on 30 positions (library middlegames and engine games from the snack, Node, 3 engines): 19 picks in
  the band (0.5-1.5 pawns), 10 below it (4 of them games already decided, where the engine's expected score is pinned
  at 0 or 1 and every loss reads 0), 1 with nothing moving; 3.9 pieces moved on average; 0.6 s for the engine's part.
- **Online:** the server works out the candidates from the seed (they're the same everywhere) and sends them in the
  boss request; the host scores them and answers with the one picked; anything that isn't a candidate, an answer of
  "", or no host anywhere: the bounces play and nothing moves. The host's word stands, as for his moves.
- It isn't a move: nothing is scored, fair play never sees it, the crowd's turn count is unchanged, and the history
  keeps a base where the position changed (`applyBounce`), so every replay keeps the pieces where they landed.
- **On screen** (`components/BigBoy.tsx`, 6.2 s, nobody's clock running): "BIG BOUNCE!" (1.3 s); he leaps from his
  corner, his shadow growing on each spot; three landings on 2x2 spots (squash, a boing, dust off its four squares, a
  bump of the board), the pieces there knocked up: the ones the bounce moves tumble in the air, the rest hop back down;
  the big spring up off the top, his shadow growing on the four middle squares; the giant fall (he's 40% bigger), the
  crash (a shockwave ring racing out to the board's corners, a cloud of dust, debris, the board jolting); dazed,
  stars round his head; the pieces come down one after another onto their new squares as he giggles; he springs back
  to his corner; then he plays his move. **My calls:** the spots are over the pieces it moves (`bounceSpots`), so
  they're the ones knocked up (a moved piece under none goes up at the crash); kings never tumble (the board always
  has both); the eval bar keeps the position before until every piece has landed; the board's own animation is off
  meanwhile (the pieces land exactly on their squares, then the board takes over); the God King's word on his last
  move, the blunder check and his queen banner skip that screen.

**His character** (`characters/bigboy.ts`, `bigboy-sounds.ts`, `kits.ts`, `power-art.ts`, `effects.ts`)
- **The approved look is unchanged:** idle, swing and tantrum frame for frame. New: `snack` (waddle, grab, nom),
  `toss`, `bigBounce` (crouch, stretch, tuck, squash; the crash flat with the lollipop flung down; dazed stars; the
  giggle behind his hand), `lick` (a slurp), `giggle`, and `wail` (the tantrum with its wail). New faces (chewing, the
  bite, "oh", squished, dazed, a giggle), poses (arms up, reaching down, at his mouth, a throw), a little pawn and a
  block for his hand.
- **His moments:** his move a slurp of the lollipop (12% a line), a capture, his strike and his entrance the swing (the
  BONK), check and victory a giggle, hurt, defeat and the rage warning the wail. Thinking is his idle, silent.
- **Sounds, synthesised (no real voice, no files):** a giggle (five quick "heh"s from a little buzzing voice through
  vowel formants), a slurp, a wail ("waaah"), a nom (an "n", an "o", an "m"), a boing, the crash (a deep thud, a
  rumble of dust, toy blocks tumbling), a toss, the block's clack (a light wooden tok, a small bounce, a rattle), a
  poof, the lollipop's swish and bonk (a squeaky-toy hammer), a stomp. They replace the preview's borrowed sounds. Each
  is 2.8 to 4.2 dB under a move's mean level with its peak under half a move's, all through `play()` (the mute switch),
  and none bright (each one's energy under 2.5 kHz; no chimes, no dings). Made ahead in idle moments
  (`warmSounds`), each a few milliseconds to 40 ms to make.
- **Lines** (his text box, the dock): baby talk ("Mine!", "Nom nom.", "Waaaah!", "Big boy BOUNCE!", "Bouncy bouncy!",
  "Peekaboo!", "Catch!", "My toy!", "Big boy mad!"), as rare as the others', the same for everyone.
- **Drawn ahead:** his snack, toss and bounce frames and the block, puff and crash effects are drawn a slice a frame
  (`prewarmSprite`, `prewarm`) from when his character first shows (the card), the snack first.

**Checking it**
- `npm run frames:bigboy -- <dir> [phone|desktop|both] [light|dark] [side=b]` plays Boss alone against him with real
  taps (`?power=bounce`): the snack, the first block and the warning, a move, the bounce and his move; every painted
  frame, stills and GIFs.
- Test switches: `?boss=bigboy` (solo, or a raid link), `&power=bounce` (or `blocks`), `&side=b`; the admins'
  "Trigger ultimate (testing)".
- Tests: `packages/chess/test/bigboy.test.ts` (the snack and its base, sides; the blocks' squares, schedule, what they
  stop, never no move or no way out of check; the generator's legality, kings, captures, reach, pawns, bishops,
  castling rights, en passant, hanging pieces; the loss in pawns, the band, the fallback, the cap, mates; the two-stage
  engine look; the spots; the battle: warning, bounce, base, his move, once, the trigger, nothing moving),
  `packages/server/test/boss-powers-lobby.test.ts` ("Big Boy online": the snack and blocks the same for everyone and in
  the jobs; the bounce from the host, then his move; "" / junk / no host: nothing moves; the trigger),
  `packages/app/test/bigboy.test.ts` (the kit, the approved animations unchanged, the snack's and bounce's beats and
  cues, squash and stretch, the pieces in the air and the board under them, the block, the sounds' loudness, their
  own names and no bright ones), `e2e/bigboy.spec.ts` (phone and computer: the snack, your move's knock first, the
  block with no dots onto it and gone after its turns; the bounce from the trigger with pieces in the air, the crash,
  the jolt, the new position on the board and his sounds through mute), `e2e/perf.spec.ts` (a phone slowed 4x, the first
  time each shows: the snack p95 16.8 ms, 2% of frames dropped; the block and the warning p95 16.8 ms, 1%; the whole
  bounce, its getting ready and his move p95 16.8 ms, 1%). `npm run perf:boss -- <dir> bigboy phone 25 bounce`: flat
  from move 1 to 25 (p95 16.7-16.8 ms everywhere, the bounce's turn included); Ginger's run unchanged.
- Tests that met a random boss by a fixed seed (`last-stand.test.ts`, `crowd.test.ts`) now name the boss that seed met
  before Big Boy joined the draw (G-REX), and solo's difficulty test reads the drawn boss's own offset.
