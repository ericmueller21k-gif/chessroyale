# End screen mockup (Nov 20): every match's result, rewards first

Eric's brief of Nov 20 and his answers to the director. Built as real screens on made-up results: `packages/app/end-screen-mockup.html`
(`npm run dev`, then `/end-screen-mockup.html?s=win|levelup|loss|ranked|rankdown&theme=light|dark`). The pieces are real components,
so the build is mostly wiring: `components/EndScreen.tsx` (+ `end-screen.css`), the sounds in `sound.ts` (`xpPing`, `xpLand`,
`xpDing`), `Breakdown`'s `estRating`. Not to be merged as is.

Stills, GIFs and videos (with sound): branch `stills/end-screen-mockup`.

## What each still shows

End states (2x, after the whole sequence), each at phone 390 × 844, computer 1280 × 800 and 1440 × 900, light and dark:
1. `1-tower-win-*`: Battle Tower floor 3 won, 3 bosses 1-2-1 (Babur in front, Big Boy and Sawyer behind, their defeat beats),
   "Victory!", "Floor 3 cleared!" (green, soft blink), XP EARNED +150, the bar 120 → 270 of 1,000 under "Eric · Level 2", two
   quest rows (Warm Up 1/3 → 2/3, the weekly Regular 6/10 → 7/10), then the kept parts: "Next: floor 4 · 3 bosses · rating 660",
   Back to the tower, the review with "Est. rating 1728" under its move line. `-whole-page` is the phone page in full.
2. `2-tower-levelup-*`: the same with a quest done (Warm Up 2/3 → 3/3 ✓, its +300 in the XP): +450, 880 → Level 3 at 330.
3. `3-tower-loss-*`: "Defeat", "Floor 4 lost · 1 life left" (red, still), Wrangler, Smudgy and Big Boy gloating (their victory
   beats), +60 XP (time only), one quest row (the box keeps two rows' height).
4. `4-ranked-win-*`: ranked 1 v 1 as a card over the dimmed board: "Victory!", "You won by checkmate.", RP EARNED +18 (Gold 3,
   27 → 45 of 80) first, then XP EARNED +150, then quests, Play again / Home.
5. `5-ranked-loss-*`: −14 RP: the count goes down in red and the bar drains, through the division (Gold 3 → Gold 4 at 75).
6. `6-reduced-motion-*`: reduced motion, 0.4 s in: everything already at its end (no count, no lob, no blink), one ding.

Beats (phone, mid-sequence): `beat-1-*` start / counting / the lob / the bar filling / the quests; `beat-2-*` the bar full, the
level-up (bar flash and sweep, "Level 3!", the pawn's gold ring and hop) and on into Level 3; `beat-4-*`, `beat-5-*` the RP's
lob and fill, up and down.

Videos (`video/*.mp4`, with the sound) and GIFs (no sound): the tower win (phone, light), the level-up (phone dark, computer 1280
light), the loss, ranked won and lost, the tower win on a 1440 computer.

## The sequence (one controller, `useEndSequence`; timings in `FX`, for settings.ts in the build)

0.45 s beat → XP EARNED counts 0 → total in 1.5 s on an ease-out curve (soft low pings) → holds 0.28 s → shrinks and lobs into
the bar's slot in 0.62 s (a soft "pop" as it lands, the slot reads "+150 XP", the big number stays as a faded record) → the bar
fills from where you were, the number under it counting with it, in 1.3 to 2.2 s (by the gain), a ping each step climbing a
pentatonic scale with the bar → a ding at the end → each moved quest slides in turn (the quests overlay's tick and done sounds).
A level reached: the bar stops full, flashes, a shine sweeps it, "Level 3!" stands where the level label was, the pawn hops in a
gold ring (the existing hop and the auto chess level-up chord), then the bar goes on from 0. About 5 s for a tower win, 6 with
quests; ranked (RP then XP) about 9.

Nothing shifts: every box (the headline's line, the number's slot, the bosses' row, both bars, the two-row quest box) is its full
size from the first frame; the sequence only sets transforms, opacity and text. The buttons are live the whole time.

## The ping
Synthesized (WebAudio, no files, nothing paid): a short struck sine (C6 to C7 on a pentatonic scale by the bar's fill, 70 ms decay,
a quiet inharmonic overtone for the "ting"), at most every 42 ms (about 24 a second). The count-up's pings are an octave down and
softer; the landing is a short low pop with a tap; the end a two-note bell ding. Hear it in the mp4s.

## Calls I made (Eric can flip any)
- Real numbers: a level is 1,000 XP (XP.perLevel), so the bar reads "0 … 120 XP … 1,000", not Eric's example 400. A typical game
  (+150) moves it 15%; a +37 game barely moves. If that feels flat, see question 1.
- The XP bar sits full-width under the bosses-and-pawn row (your name centered on its top row), not squeezed under the pawn: the
  bosses' 1-2-1 group needs the width, and the bar reads better wide.
- The big number stays behind, faded, after its copy lands, so the slot never looks empty.
- Quest XP is in the earned total (as today: the server pays it with the game's XP); the quest row then shows "3/3 ✓ +300 XP".
- The quests box shows the quests this match moved (up to 2; none: "No quests moved this game." centered).
- Removed: "You beat X", the three stat tiles, the "Scoring took … ms" line. "Est. rating" moved under the review's move line.
- Ranked 1 v 1: the result became a card over the dimmed board (today it's a short card under the board; the rewards don't fit there).

## Open questions
1. Bar size: keep 1,000 XP a level (honest, but small moves), or show a shorter span? (A bigger look is possible without changing
   the rules, e.g. a game's gain shown on a wider "this game" segment.)
2. Ranked: card over the board (mocked), or its own result page like the boss screens?
3. RP lost: "RP EARNED −14" or "RP LOST 14"?
4. Should a tap anywhere skip the sequence to its end? (Mocked: no skip; buttons always live.)
5. 50 v 50, Squads and auto chess have no bosses: the same headline, XP and quests with their own middle (the podium, the squad).
   Not mocked; the pieces are the same.

## Mock limits
The rank emblem doesn't change mid-bar when a division changes (the label does); your pawn is the default look (no account in the
mock); the review's game is a made-up one.
