Title: Hollow's own challenge intro: the darkness ball drinks the cave's light, then the dim light and an iris to the board

**Lane:** targeted (animation timing and drawing in the challenge room, the challenge area), with a boss's art, sounds and wiring: the
boss lane's quick review pass is suggested. Specs CI should run: `e2e/boss-challenge.spec.ts` (the challenge area: every boss's intro
shares the room's drawing, and Hollow's test is rewritten), plus whatever `e2e/areas.json` selects for the room (`shops/*`), his
characters (`characters/hollow*.ts`: `hollow.spec.ts`, `boss-smoke.spec.ts`, `king-attack.spec.ts`, `boss-speech.spec.ts`) and `sound.ts`.
Hollow is live: this goes to everyone.

## What changed
- **Hollow's challenge has his own intro** (Eric's design, approved Nov 3 with five changes, built as he gave them; the art branch's
  `claude/boss-art` 3238dbf4, `scripts/boss-art/out/intro-hollow-nov3.md`). In with him up his cave to the frozen pond, you both walk
  on straight to your seats (his 2.92 squares west of the table's middle, yours 2.2 east) and stay there. He says "Did you leave a light
  on?"; the park table and its stools pop in while it's still lit; the darkness ball in his belly charges, a channel line over his head;
  it swells and drinks the light: the five lanterns go out one by one, far to near (each its own going-out frames, its glow and pool on
  the floor going with it), the bulb string goes dark west to east (the backdrop's candle with it), then the tree up to its star, his
  own strand a third at a time, and your pawn's light; every light's motes fly into the ball; your name tag fades as it starts and the
  cave darkens with each light gone. Full; the blackout; 0.9 s of black with only his eyes, two dim violet slits; then a dim, steady,
  cool violet-grey light round him, the table and you while the ball settles back into him; the light closes in on the board (an
  iris, 0.6 s), and the match comes up out of the dark (a fade from black). About 15.0 s from the marks to the board.
- **Eric's changes:** (1) nothing jumps in the dark (the table and stools come in while lit; you walk on to your seats; no hop back);
  (2) a channel line as he starts to channel, one of four at random; (3) the light-drinking 15% faster (every gap as drawn times 0.85:
  6.7 s → 5.7 s); (4) the lantern order, the string then the tree, his eyes in the black, the dim light and the tag's fade kept as
  drawn; (5) into the match by the iris and a fade from black, no second blackout, no storm (the director's call; Eric may change it).
- **Wiring, as Timber's:** `BOSS_INTROS.hollow` is `custom` (layout "across", his pond's marks, `seated`, `chant`); his moves
  (`BOSS_HOLLOW_INTRO`, copied as drawn into `characters/hollow-intro.ts`; `hollow.ts` unchanged) and the props
  (`shops/hollow-intro-art.ts`: the lanterns and bulbs going out, the tree, the motes, the dark, the dim light) load as their own chunk
  only when you challenge him; the timeline is `introBeats` with a fourth kind of art, the dark (`DarkAnims`, `darkAt`, `darkCues`),
  every beat a number in `CHALLENGE_FEEL.dark` or the art's frames. The room draws the cave's own lights going out (each lantern's
  `lightsAt` light and pool, the bulb pieces in `INTRO_HOLLOW_BULB_RUN` order, the tree), the room into `INTRO_HOLLOW_DARK` (the lights
  still lit drawn over it), then `INTRO_HOLLOW_DIMPOOL`; the real board on the table. His transition is the dark (`startDark`,
  `canvas.boss-dark`).
- **His sounds**, each cue one of his own (`characters/hollow-sounds.ts`, new: gutter, snuff, drain, tink, star, sip, pawn, blackout,
  settle; his cast lower for the swell and his hum lower once the ball is full), all passing `boss-sounds-finite.test.ts` and his own
  sound test (no chimes, Eric's Oct 9 rule: the notes' "chime run" and "bright chime" are muffled low knocks and a muffled tone).
- **The cave is lit as before** whenever you go in again: the intro never touches the cave's art or its loaded frames.
- **Load and frames:** the art's frames are drawn as the room loads (behind the fade), only those that show: about 2.7 s at 4x CPU
  (Timber's intro 3.4 s), plus 1.45 s for the art's module. The room's draw cost through the intro is its own (11 to 16 ms a draw on an
  emulated phone, before, during and after the drain). The town's frame loop is unchanged (not measured).
- **Nothing new for onlookers:** you both go inside, as with every boss.
- Decision: `docs/decisions/2026-11-03-hollow-intro.md` (the line's length, what "every gap" scales, his settle kept in the dim light,
  no attack, the sounds, the pawn's grey, every light going out, glows over the room, load time). Area page:
  `docs/areas/town-square.md` ("Challenging a boss").

## Player-visible changes (everyone: Hollow is live)
- Challenging Hollow plays his own intro (above) instead of the default (the hop back clear of the stools, his lash swung in place, the
  flash and the wipe to black).
- You and he walk straight to your seats: he stands 2.92 squares west of the table's middle (was his mark, 1.5, then a hop back), you
  2.2 east (was 1.5, then a hop back).
- His line "Did you leave a light on?" is unchanged; it shows 1.8 s (was 2.5 s).
- **New text, his channel lines** (one at random each time, in a speech bubble over his head for 2.5 s):
  - "The dark is misunderstood."
  - "It's not the dark you fear. It's not knowing what's in it."
  - "Shh. The dark never hurt anyone."
  - "Nobody ever asks the dark how it feels."
- Your name tag fades out as the drain starts.
- New sounds in his intro (above); his cast no longer plays on a flash (there is none).
- Into the match: the board comes up out of black (a 0.6 s fade) instead of the wipe's.

## Stills and GIF (`docs/hollow-intro/`)
- `intro-phone.gif`: the whole intro on a phone (390 x 844), from the game, real timing, from the Fight tap to the battle.
- `drain-desktop.png`: one frame on a computer (1280 x 800): mid-drain, the third lantern out, its motes flying into the ball.
- `dim-phone.png`: the dim light on the phone, him settling, the table and you in it.
- `iris-phone.png`: the iris closing in on the board.

## Tests
- Unit, `packages/app/test/boss-challenge.test.ts`, new "the intro's timeline (Hollow's dark, Nov 3)": the art (his moves, heart and
  ball per frame, a lantern's going out from every sway frame and its cues, the tree's drain, the 57 bulbs west to east, the swapped
  pieces never the cave's); the beats in order, each from where the last ended, every one a feel number or the art's frames, 14 to
  15.5 s in all, no attack; the drain 0.85 of its drawn gaps (about 5.7 s), the lanterns far to near and each after the last has
  dropped from its flare, each one's light as it goes out, everything out at the end; the table and stools in before the charge while
  it's lit; you both walk on straight to your seats (paths clear), no hop, and from the drain on nobody moves and the table stays;
  the dark (never before the drain, deepening, never back, black from the blackout, his eyes about 0.9 s), the dim light steady, the
  iris; his moves beat by beat; the tag's fade; the cave's lights as ever without an intro, all out at the blackout; his channel line
  (one of the four, at random, from the charge's start for `chantMs`, gone before the first lantern); every cue a sound of his own, the
  ticks at most one each 80 ms, nothing in the black. `packages/app/test/shop-hollow.test.ts`: his intro's moves on the ice, his feet
  clear of his stool and all of him clear of the west rock. Passed (with `hollow.test.ts`, `boss-sounds-finite.test.ts`,
  `sounds-source.test.ts`, `shop-room.test.ts`: 151); `npm run typecheck` passed.
- e2e, `e2e/boss-challenge.spec.ts`, Hollow's test rewritten: in to the seats, his line, the table popping in while lit (the dark at
  0), his channel line from the four as he charges, the lanterns going out one by one to all five, the string, his strand, black, the
  dim light up, the iris; at every look from the drain on both of you in your seats, the table and stools there, no attack;
  `canvas.boss-dark` covering (no wipe, no storm), the board, the dark gone; the gear's Leave back to where you stood; no page errors.
  Passed locally on the phone and the computer (several runs).

## Changed checks (old → new; none guards a rule in docs/rules/eric.md)
- `boss-challenge.test.ts`, "every boss whose home has an inside has an intro": title "(Alfil, Big Boy and Timber their own, Babur,
  Puddles, Dash and Hollow the default)" → "(Alfil, Big Boy, Timber and Hollow their own, Babur, Puddles and Dash the default)";
  `introOf("hollow")` `{ custom: false, …, cues: { table: "pop", wipe: "hollowCast" } }` → `{ custom: true, …, seated: true, cues: {
  table: "pop", blackout: "hollowBlackout" } }`.
- `shop-hollow.test.ts`, "the default intro for now, across, his line his entrance's" → "his own intro (Nov 3: the dark), across, his
  line his entrance's; you both sit at your clear places": `{ custom: false, …, cues: { table: "pop", wipe: "hollowCast" }, clear:
  2.92 }` → `{ custom: true, …, seated: true, cues: { table: "pop" }, clear: 2.92 }`.
- `e2e/boss-challenge.spec.ts`, Hollow's test ("…the default intro on his cave's pond (his line, the table pops in, his lash swung in
  place, the flash and the wipe)…" → "…his own intro (in to your seats, … the iris to the board), the battle out of the dark…"): at
  his line you `[14, 11.5]` and he `[11, 11.5]` (the marks) → `[14.7, 11.5]` and `[9.58, 11.5]` (the seats); "hopped back clear of the
  stools" (from the marks to the clear places after the pop) → in their seats at every look, no hop; "he swings" (step `swing`,
  `attack: true`) → no attack at any look, the dark's steps; `canvas.boss-wipe` (count 1, `data-boss="hollow"`) → `canvas.boss-dark`
  (count 1, `data-boss="hollow"`, `data-covered="1"`) with no wipe and no storm; the stills `hollow-lanterns`, `hollow-swing` →
  `hollow-table`, `hollow-drain`, `hollow-dim`, `hollow-iris`. The board showing, Leave back where you stood and no page errors are as
  before.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
