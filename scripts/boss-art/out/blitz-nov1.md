# Blitz, Nov 1: his full set and his tortoise sidekick

Eric approved the run (Blitz's animations and the tortoise, about $8 to $10, cap $15). **Spent: $5.98** (Blitz $3.56 of a
$9.50 cap, the tortoise $2.42 of a $4.50 cap; Opus 5.5, effort high, both called done). His concept run was $1.54
on Oct 31 (`boss-blitz/concept-summary.md`).

## Blitz (`boss-blitz/boss-blitz.ts`, GIFs in `boss-blitz/gifs/`)
His concept is kept: the 32-frame idle renders pixel for pixel as the approved one (checked frame by frame), the canvas is
the same 72 x 104 and no color changed (two sweat blues added).
- **idle** (3.5 s loop): unchanged from the concept.
- **entrance** (1.5 s): zips in from the right in a blur of speed lines, skids to a stop, slaps the clock, grins at us.
- **thinking** (1.8 s loop): he never thinks: fast bouncing, drumming over the button, a glance at us, an eye-roll, a yawn.
- **move** (0.74 s): wind-up, a finger gun at the board with speed streaks, a quick slap.
- **capture** (1.05 s): a wink and a double fist pump, a slap.
- **clockSlap**, the passive Clock Slap (1.13 s): paw high, a big open-paw slam with a burst of sparks and a flag jump, then a little gold clock face zips from the clock to his chest (time stolen).
- **scrambleWarn**, the ultimate's warning (1.47 s, holds its last frame): holds the clock up, taps its face twice, sly grin at us.
- **timeScramble**, the ultimate (2 s): tosses the clock up and spins it in a blur of arms, whirls and speed lines, then catches it, slams it and fist-pumps.
- **hurt** (0.61 s): a pale flash, he flinches with his ears flat, sweats, and shakes it off.
- **check** (1.05 s): a bigger finger gun with a twinkle, then a slap.
- **smug** (1.8 s loop): head back, polishing his nails on his jacket and admiring them.
- **rattled** (0.9 s loop): ears flat, grimace, sweat, nervous fast taps, eyes darting.
- **defeat** (holds after 1.75 s): the flag falls, he slumps, his cap slips over his eyes, the clock sags.
- **victory** (1.32 s loop): the clock held overhead, bouncing, a fist pump, a finger gun.

## The tortoise (`sidekick-blitz/sidekick-blitz.ts`, GIFs in `sidekick-blitz/gifs/`)
A small, sleepy, deadpan tortoise with Blitz's clock strapped to its shell and a teal sweatband; 70 x 52, about half
Blitz's height, the size of the other sidekicks (`sidekick-blitz/gifs/comparison-sidekicks.png`).
- **idle** (3.6 s): a slow breath, a slow blink, nods off with sleepy bubbles and jerks awake; the flag twitches.
- **walk** (1.2 s): a ponderous plod, one foot at a time, the clock wobbling.
- **sit** (4.4 s): flat on its belly, the clock set on the table under its chin; dozes, then slowly presses the button.
- **wave** (1.55 s, its reaction): slowly raises a foot, three sleepy waves, a tiny smile, the clock dings.
- Also, like the finished sidekicks: entrance (comes out of its shell), thinking, move, capture, hurt (ducks into its shell), check, smug, rattled, defeat (goes to sleep in its shell), victory.

## Comparisons
- `boss-blitz/gifs/comparison-gardener-tiger.png`: Blitz at phone size beside the gardener and the circus tiger.
- `sidekick-blitz/gifs/comparison-sidekicks.png`: the tortoise beside Babur's and Puddles' sidekicks.

## Open choices (for Eric or the wiring helper)
- Blitz's arms stretch longer than the idle's in victory, the finger gun and smug (a cartoon cheat).
- Time Scramble spins the clock in the air (the brief allowed spinning or hammering); its blur shows two near arms at once. If that reads as an extra arm, it can be whirl lines only.
- Victory loops; it could instead be a one-time raise that then holds. In defeat his near ear pokes above the slipped cap.
- No `kingAttack` pose was drawn (the tiger and gardener have a separate attack character); it can be added when he's wired.
- New sound cues to supply: zip, skid, snap, yes, windup, slam, steal, warn, tap, whoosh, whirr, ta-da, oof, point, tick, yawn, flag, slump, cheer; the tortoise's ding, chomp, step.
- The tortoise's sit sets the clock on the table (`clockAt`), which may need to move once the game draws the table; in check and wave the clock dings without the foot reaching it.
