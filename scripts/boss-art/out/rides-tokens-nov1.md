# Rides and tokens, Nov 1: Cheetah Shoes, The Log Roller, Ginger and Blitz tokens

Eric approved the four designs before anything was spent. **Total: $3.77** (cap $10). All runs used Opus 5.5 and called `done`.

| Item | Side | Views | Trail | Total |
|---|---|---|---|---|
| Cheetah Shoes (`cheetah-shoes`) | $0.66 | $0.66 | $0.23 | $1.55 |
| The Log Roller (`log-roller`) | $0.60 | $0.85 | $0.17 | $1.62 |
| Ginger token (`token-ginger`) | $0.22 | | | $0.22 |
| Blitz token (`token-blitz`) | $0.38 | | | $0.38 |

The first token runs were stopped by the runner's worst-case guard before turn 1 ($0 spent): a 48k output ceiling
against a $0.60 cap. They were rerun with `BOSS_ART_MAX_TOKENS=16000` and a $1 cap. The runner now treats `token-` ids
as scenery, like `arena-` (run.ts and render.ts, 3 lines).

## Cheetah Shoes: `out/cheetah-shoes/ride.gif`
- **Width:** 108 units (1.57 squares; widest at side move 0), within 125.
- **How it reads:** two chunky tan running shoes with black spots under a pawn whose whole body shows (cut 86, only the
  bottom of its base). The item's color is on the soles (with tread), the laces, a tongue bow and the heel tab.
  - **Idle:** toe-taps, then a bounce onto the toes.
  - **Move:** 6 × 70 ms. A full stride with a 12° forward lean; speed lines and a dust kick go along with it.
  - **Front and back:** the shoes take turns lifting.
  - **Trail:** three tan skid streaks with dust puffs, 450 ms, pointing the way it ran. It passed the frame check.
- **Open choices:**
  - The kicked-back shoe crosses the base at 4x (shorter shoes would fix it).
  - From behind, the toe-tap barely shows.
  - The skid streaks are faint on the light squares (a darker edge would help).
  - No logo or stripe on the shoes.

## The Log Roller: `out/log-roller/ride.gif`
- **Width:** 92 units (1.34 squares; widest at back move 3).
- **How it reads:** a fat log seen end-on in the side view (54 units across: rings, a crack, a branch stub) with the
  pawn balancing on top. The item's color is a **painted band** across the end and round the bark (the brief offered
  the end rings instead; the drawing chose the band).
  - **Idle:** a rock, a lean and a catch.
  - **Move:** 8 × 85 ms. One full turn per square (a true roll would be about 212°; a full turn joins the squares
    without a jump), quick balancing steps, a little hop over its own stub, and bark dust that goes along with it.
  - **Front and back:** the log lengthwise (73 units), grain and band scrolling over the top.
  - **Trail:** four pale chips and a curl of bark, 600 ms, mirrored on alternate squares.
- **Open choices:**
  - The pawn's head rises past the −9 line worn items keep to. This matters only if rides are clipped there; if so,
    the log shrinks to about 36 across.
  - The hop over the stub could go, for a smoother roll.
  - The band is soft in yellow and pearl.
  - The lengthwise log could be wider for a more log-like look.

## Tokens: `out/token-ginger/token.gif`, `out/token-blitz/token.gif` (4x)
- **What they are:** 40 × 40, meant for 2x. The crest's gold rim, 8 rivets, dark inner ring, navy middle, `k` outline
  and halo. The face is built in separate layers, so the coin and the glint carry over to any boss.
- **Ginger:** the round cookie face with angry icing brows, red eyes, an icing frown, dashed icing trim and the green
  bow tie. A glint over the top arc of the rim, then a blink (1.2 s loop).
- **Blitz:** a spotted face with tear marks, heavy-lidded amber eyes, a lopsided grin with a fang, the orange backwards
  cap with a teal brim and teal jacket shoulders. A glint round the rim, a long rest, a blink (2.3 s loop).
- **Open choices:**
  - Ginger frowns, as in his idle; the victory smile is friendlier.
  - Blitz's grin is subtle when small; a wider mouth would help.
  - Pick one glint for the series (over the top or all the way round).
  - The blink on every loop could be rarer.
