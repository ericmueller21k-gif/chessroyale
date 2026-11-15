# Chandy, round 2b: Dodge's opening and vote (Nov 15)

| File | What |
| --- | --- |
| `phone-dodge-2b.gif` | About 7 s: he targets your king (the scope-in: the rest greys, blurs and darkens, a cyan scope ring), your king slides to the center (e4), the scope opens on a blank board, the clones blink in, one round with the vote (counts on the voted squares, yours ringed in gold), LOCKED, the beams fire, DODGED. |
| `phone-dodge-scope-in.png` | The scope-in on your king, before his slide. |
| `phone-dodge-vote.png` | The vote on the blank board: 1.4 s left, 6 votes on f3 (yours), 2 on e3, 1 on d5; the safe square not marked. |
| `phone-dodge-nobody-voted.png` | Nobody voted: the king on a random square (d5), "NOBODY VOTED: RANDOM". |

The blank board is the mockup's own 64 squares in the board's colors over the real ones (the real board keeps its pieces underneath).
Round 2's Dodge stills (`phone-dodge-aim/dodged/hit.png`, `phone-dodge.gif`) show the old zoomed arena: replaced by these.

---

# Chandy, round 2: the mockup (Nov 15)

Eric's round-1 answers are in; the design is in **DESIGN.md** (round 2 first: the locks, the queen lock's one rule, his ultimate Dodge).
The stills are drawn the same way as round 1 (a real battle on a phone, 390 × 844, Chandy drawn over it by the game's own renderer;
`scripts/chandy-mockup/stills.mjs`).

## New this round

| File | What |
| --- | --- |
| `chandy-r2-1-full-length-rifle.png` | The rifle at his full length on his back: 78 px at the base (his height), 112 fully upgraded; at 3x and at phone size. |
| `chandy-idle.gif` | The idle GIF in its true colors (round 1's GIF gave each frame its own palette: that scrambled it). |
| `chandy-r2-2-clones.png` | The scrambled red-green palette kept as his afterimage clones' look (`CHANDY_CLONE_PALETTE`), at rest, aiming level and aiming down. |
| `phone-dodge-aim.png` | Dodge, round 1: the board zoomed onto your king, the 3 × 3 arena in its red frame, four clones, the dashed aim lines (2 rows, 2 columns), the 3 s bar at 2.2 s. The safe square isn't marked (it's the top-right one). |
| `phone-dodge-dodged.png` | The beams fire; your king on the safe square: "DODGED 1/3". |
| `phone-dodge-hit.png` | Round 3: your king stayed in the middle: hit, "HIT! YOU LOSE". |
| `phone-dodge.gif` | One round, about 5 s: zoom in, the clones blink in, the 3 s counting down, your king steps to the safe square, LOCKED, the beams fire, DODGED. |
| `phone-queen-lock-aim.png`, `phone-queen-lock-shot.png` | The queen lock's rule: the aim line down her file before your move; she steps behind a pawn (d1 to e2, behind e4) and the pawn takes the shot. |
| `phone-lock-on.png`, `phone-upgrade.png`, `phone-upgrade.gif` | Round 1's lock-on and upgrade redone with the full-length rifle (in the bar's room and the window, 2.5x). |

Round 1's other stills (the five moves, the firing pose, the board art, the tile) are unchanged: their bar's rifle is round 1's shorter
one. The base battle under the mockup is Chub & Chirp's, so their leapfrog sometimes leaves a black pawn deep in your half: that's theirs,
not Chandy's. In the Dodge stills the dock's real clock kept running; in the game it holds.

---

# Round 1 (Nov 15)

A special ops alligator with an energy sniper rifle. **Mockup only: nothing is wired into the game.** The art is code in the sprite
kit's format on branch `claude/boss-chandy` (`packages/app/src/characters/chandy.ts`, `characters/effects/chandy.ts`); the board stills
are a real Boss Battle on a phone (390 × 844) with Chandy drawn over it by the game's own sprite renderer
(`scripts/chandy-mockup/stills.mjs`; the base battle is Chub & Chirp's, renamed, so the opening and the bar are real). The design
questions for Eric are in **DESIGN.md**.

## What's drawn

| File | What |
| --- | --- |
| `chandy-1-closeup.png` | Him at 6x: idle's first frame. |
| `chandy-idle.gif` | Idle, 4 frames: breathing (his upper body up a pixel), the tail swaying along the ground, a glint on the lens, a blink. |
| `chandy-2-rifle-stages.png` | The rifle: base, then each attachment added one by one: **1** a longer, vented barrel; **2** a big scope; **3** a bipod (legs down in a V) with a cheek rest and spike on the stock; **4** a glowing energy cell; **5** a forked emitter holding a ball of energy. Each changes the outline. |
| `chandy-3-rifle-on-his-back.png` | Him at each stage, at 3x and at phone size: the stages still read slung on his back (longer, the scope's hump, the bipod's V, the cell's glow, the emitter's ball). |
| `chandy-4-bust-and-tile.png`, `phone-select-tile.png` | His bust (the portrait crop: move list, banners, a computer's bar) and his Boss Battle tile and stage figure. |
| `chandy-5-lock-on.png`, `chandy-lock-pulse.gif`, `phone-lock-on.png`, `desktop-lock-on.png` | The lock-on: he points (on a phone, down at the board), the lens flares; the crosshair snaps onto the piece and pulses. The computer still shows him beside the board. |
| `phone-upgrade.png`, `phone-upgrade.gif` | The upgrade: the God King's blue command window, front and center over the board: the rifle at 3x, the new part (here the big scope) slides on and snaps with a flash, "UPGRADE!", the part's name and "2/5", and which move it unlocked. 1.9 s. |
| `phone-move-scatter.png` | Scatter shot: the burst on one empty square, 4 blocked squares round it (crackling static). |
| `phone-move-beam.png` | The beam: rank 2 and the c-file covered (opaque: you can't see what's under them); never your king's rank or file. |
| `phone-move-shields.png` | Shields: two of his pieces in see-through bubbles. |
| `phone-move-rapid.png` | Rapid fire: three of your pieces with dizzy stars over them (and a hit's sparks). |
| `phone-move-queen-warn.png`, `phone-move-queen.png` | Queen lock: the crosshair on your queen and "Queen lock: move your queen!"; then the round from his side down her file, through his own pieces, shattering the first of yours. (Here the queen stayed put for the picture; in play she has moved.) |
| `chandy-6-firing-pose.png`, `chandy-fire.gif` | Firing: he reaches back, swings the rifle round, aims it level (his eye-strap lens is his sight, so it sits under his snout), fires a burst of energy, holds. |
| `chandy-7-board-art.png` | Every board sprite, one square each at 4x. |

**His bar** (every board still): his figure at the left; under the rage meter a second bar, his **move meter** (cyan; greyed with a
lock before his first capture: "Nothing hidden, nothing shifts"); in the bar's free room on the right **his rifle at its current
stage with 5 pips**, so the upgrades are always on screen. The dock's line says what each move did, in a few words.

**Reused marks**, as the brief asked: none of the old *looks* fit an energy rifle, so each move has its own, but the *rules* reuse
existing ones (DESIGN.md's table): Boingo's pie squares (scatter), Big Boy's blocks and Hollow's hidden board (beam), Don Dough's gold
rule (shields), Moo & Moon's stun (rapid fire), Ginger's one-piece Blizzard turn (queen lock).

## How he stays his own

- An ordinary American alligator: the **broad, rounded U snout** (not a croc's narrow V), olive green, a cream belly in scale bands, a
  long ridged tail on the ground. Not muscly: slim arms, a small belly, short bowed legs.
- "Special ops" comes only from his kit: black war-paint slashes on his cheek, an olive **eye strap with a small glowing scope lens**
  (not a pirate patch), an olive sling and belt with a pouch. **No bandanas, masks, shells, headbands or named weapons**: nothing from
  any famous cartoon commando reptile or turtle, no real gun model or brand. The rifle is an invented sci-fi shape (olive stock,
  gunmetal body, cyan energy).
- **Not Smudgy at a glance:** Smudgy is lime green, round-headed with turret eyes, a beret, an apron, orange/teal stripes, a spiral
  tail, a brush and palette. Chandy is a darker olive, all snout and teeth, one glowing cyan lens, a straight heavy tail, no hat, and a
  long rifle over his shoulder. Their silhouettes don't match.
- **Not Don Dough's bread rifle:** Don Dough's roll is a loaf; Chandy's is a long gunmetal rifle with cyan energy, and it grows.

## Size and placement

Frame 106 × 112 art px, feet at [52, 106], about 72 px from his feet to his eye ridge (Timber's and Don Dough's height). Facing our
right, toward the board. The firing pose needs 44 px more on the right (`CHANDY_FIRE`). In the stills he's whole on screen on a phone
(inside the bar) and on a computer (beside the board).

## Frame cost on a phone (an estimate; measured with `perf:boss` in the build round)

- **His figure:** pose-built parts, cached by pose, drawn to a canvas once per frame shown (as every boss). About 4 idle + 4 point +
  6 fire frames, times 6 rifle stages for what shows the rifle: about 80 cached frames at most, ~47 KB each, made on first use. Each
  part paints in well under a millisecond; the first showing of a new stage's idle (on an upgrade) is a few ms, hidden by the upgrade's
  pause. Steady state: one `drawImage` a frame.
- **Board art:** all on the one shared board-effects canvas (the lesson "a dozen sprites, a dozen loops"): at most 15 beam squares,
  4 static squares, 3 dizzy loops or 2 bubbles, one crosshair; a few `drawImage`s a frame. The beam's 3-frame scanline loop is the
  busiest; it can be a still if a phone struggles.
- **The window:** plain HTML/CSS (the command window's own styles) and one rifle canvas: nothing per frame.
