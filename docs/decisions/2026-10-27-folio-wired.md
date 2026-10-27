# Folio wired: its art, its marks on the board, its sounds and voice, its home (Oct 27, 2026)

Folio, the paper crane (id `folio`, 📜; "it" everywhere), is playable: its rules came in PR #379
([2026-10-27-folio-rules.md](2026-10-27-folio-rules.md)); this lane draws and plays them, phone and computer. Its approved art
(Eric, Oct 26: "Folio's looking real nice. I really like the vision there"; the faded blue on its home, fixed) came from
`claude/boss-art` unchanged in look: `characters/folio.ts` and `town/houses/folio.ts` (imports fixed; the home's palette now
imported from Folio's, except its own fainter ink `i` "#b0b4c8" and `j` "#9497aa", which the director faded on purpose). No rule
changed. How it works now: [bosses.md](../areas/bosses.md) (its row), [town-square.md](../areas/town-square.md).

## What it looks like, beat by beat

Every banner holds a boss banner's whole length (2.25 s), then its moment's own clock starts (POWER_BANNERS `[0, 1500]` for each).

- **DRAFT** ("End the attack in 2 moves, or it folds"), as your turn after its move begins: it stretches and points its near wing
  at the board (`check`); at its `ink` cue (a pen's scratch) a blot of blue-black ink spreads under the marked piece (0.36 s),
  then the attack's line shows in faint ink dots on the squares between (none for a knight or a piece side by side). Its line,
  "I'll be honest: that piece is next.", as the banner goes. Then, every screen, while the view's `draft` holds: the blot, the
  dots, and a small ink numeral at the square's top right corner, your moves left to end the attack (2, then 1: `until` less your
  moves made). It dries away (0.3 s) as soon as the attack ends.
- **FOLDED** ("It can't move for 4 turns"), as your move lands, while it thinks (its move waits): its polite bow and the glint up
  its gilt edge (`smug`); at the `glint` a sheet of its paper folds over the piece from the top right corner (a crisp fold's
  sound): see-through cream (the piece shows), a crease across it, its corner turned down, its red seal at the foot: frozen at a
  glance, and nothing like Ginger's blue ice. "Folded. It'll keep." Drawn while the view's `folded` holds; it opens again when
  the piece is free.
- **The warning**: the RAGE banner ("Next turn: Crease") with its `thinking` (lines of writing come up its wing), and a faint
  pencil line the whole length of the crease's line, on the squares on its light side, from the view's `creaseNext` until it
  lands. "Mind the crease." once: the warning's own line (`creaseWarn` says none).
- **CREASE!** ("Your pieces can't cross it for 4 turns"), as your next turn begins: its near wing sweeps toward the board
  (`move`); at its `sweep` the board creases along the line (a fold's sound): a crisp dark line along the squares' edges, a soft
  highlight on the side toward the light (left, or top, as drawn) and a thin shadow on the other, pressed in over 0.26 s. Drawn
  while the view's `crease` holds. `creaseEnd`: it unfolds (0.37 s, a soft unfold), no banner; the dock: "The crease unfolds.
  Your pieces may cross again."
- **REVISION** ("Both moves crossed out"), as your move lands, while it thinks (its move waits): the board keeps the position
  after your move (the game's board is already back: a base; `revisionFen` in Boss.tsx draws the old one); its wing edges curl
  and the ink runs (`rattled`); a stroke of ink crosses out its move's two squares, then your move's (100 ms apart, a scratch
  each); at 2.3 s the page turns (its sound) and the pieces slide back (the board's own 220 ms slide: its move and yours undone, a
  captured piece back on its square); then its new move plays as its ordinary move. "Let me write that again." The move list
  strikes both moves through, in its ink, where they stand (`.mv-struck`; read aloud "…, crossed out"): the plies between the
  base's `from` and its ply.
- **Its attack on a king** (the Last Stand, a mate): it glides down on its wings, settles, points its near wing at the king and
  flicks a stroke of ink across it ten times, high then low (a scratch and a dab in turn), an ink splash on the king's square
  each; a small bow, its gilt glinting, and it lifts away. Put together from its own poses (`characters/folio-attack.ts`), 36
  frame pixels a square, 1.7 squares off (its beak clear of the king's middle).

Nothing it draws moves the board, the dock, the HUD or the move list (its marks are two canvases on the board's own squares:
under the pieces the ink, the pencil and the crease; over them its paper and the strokes).

## The calls

1. **The kit's animations** (the director's suggestions, all taken but one): the Draft `check`, the fold `smug`, the warning
   `thinking`, Revision `rattled` then its move; **the Crease `move`, not `capture`**: its wing sweeping across toward the board
   reads as folding it, where `capture` (the beak dipping for a piece and tucking it under the wing) reads as taking one. Its
   periodic strike on a piece is its `capture`. No `POWER_MOMENTS` entry: that table holds one-shot animations, and the warning's
   `thinking` is a loop; its effects' sounds are warmed by its kit (every one is in `kit.sounds`) and `prewarmFolio`.
2. **`fold` and `revision` as kit moments of their own** (`KitMoment`, `BEAT_NAMES`): the placeholder mapped Revision to `power`
   (it would have said the Draft's line) and the fold to `powerHit`. Their lines now play on their own events (unit-tested).
3. **The hurt beat stays quiet after a Revision**: as it thinks, a base at this ply that goes back (`from`) means no "hurt"
   (`boss-beats.ts`): its crossed-out promotion, or anything else between the two positions, isn't a piece it lost.
4. **The numbers fixed in `FOLIO_FX`** (measured against its art: each moment's clock starts as its banner's window ends, then
   its animation plays out from its cue): **draft 1800 → 2600 ms** (the `check` runs 1.04 s after its `ink` cue), **fold
   1600 → 2300** (the `smug` 0.8 s after its `glint`), **crease 2400 → 2500** (the `move` 0.96 s after its `sweep`). creaseEnd
   900 (its unfolding 370 ms) and revision 2800 (strokes to 1.98 s, the page turn at 2.3 s, the slide by 2.52 s; its `rattled`
   ends at 2.63 s) were right. The server's and solo's holds follow (`POWER_FX`; the banners' leads, `POWER_BANNERS`).
5. **The count of your moves left** at the mark's corner (welcome in the brief): a 3 × 5 ink numeral with a paper rim, 2 then 1,
   small and clear on either square color.
6. **Its voice** (like Puddles' talk, its own): soft, papery, calm: whispered made-up syllables (noise through a vowel's two
   formants, a faint 190 Hz hum under it, a dry paper crinkle opening most), unhurried, settling at the end. Short, medium and long
   by its line's length (16 to 20, 21 to 34, 35 and more characters). Heard as each of its lines starts in the battle's voice
   (`lineSounds` in `speech.tsx`, which only the boss's voice reads, so its select line stays its select sound alone). No other
   boss has one: theirs speak in their animations' cues. Its sounds: paper rustle, a crisp fold, a soft unfold, a gentle wing
   flap, a pen's scratch and a shorter dab, a page turning, a crumple when hurt, its gilt's glint (two soft high bell tones); the
   select sound a page turn and a flap. All quiet (about −28 to −31 dB, every peak under 0.3): a calm crane.
7. **Its phone bar figure has no halo.** At full size (never smaller, Eric, Oct 24) its idle is 87 px across with its halo, and the
   bar's room is 85 (2 px clear of the screen's edge and the name column). Without its faint halo it's 85: drawn a pixel to the
   left (`barShift` −1). On the bar's dark ground the halo doesn't show; everywhere else it's drawn with it. Its victory's tiny
   crane flies off to the left past a 320 px screen's edge: the bar's frame stops 5 px short on the left, at that edge, so the
   frame the test measures is what the screen shows.
8. **The select screen: five to a row, the new tile moving no boss's tile.** Sixteen tiles now (fourteen bosses, the Hidden Boss's
   and "?"). `rowSizes` shared sixteen out as 4, 4, 4, 4 (the Oct 23 lane's own call, to keep a tile from standing alone), which
   would have moved every tile and broken "five to a row" (Eric, Oct 23: "just 5 per row"; his rule, nothing shifts). Now rows are
   full rows of five and the last the rest: 5, 5, 5, 1. Every boss's tile keeps its size and place; Folio takes the Hidden Boss's
   old place, which moves one along, and "?" sits centered on a row of its own. (The brief said "the last row 4": that would be
   fourteen tiles; with the Hidden Boss's and "?" there are sixteen.)
9. **Its select line is its one line, every tap** (the director's sheet gives it one; its seven lines aren't added to), so the
   select test's "two lines at least" and "never the same twice running" leave Folio out.
10. **Its tile's color: its deep ink, #575c78** (its cream paper and red seal clear on it, dark and light). The select test now
    leaves a figure's halo out as well as its outline: Folio's halo (#3b3530) is a shade lighter than the others', which the test's
    "dark outline" cut-off already left out.
11. **Its tile blurb**: the boss menu card's power words stay the rules lane's, "marks a piece to fold · Crease" (plain, one
    line).
12. **Its home** (`HOMES`: "Folio's Folded House", at 33, 30, east of the Colosseum; its ring #d8432a, its seal's vermilion): the
    one free spot left on the ring round the middle where its nearest neighbors stay 8 to 10 squares off (Sawyer's Woodshed 9.9,
    Big Boy's Crib 10.0, Smudgy's Gallery 10.2), with its roaming ground clear of the Colosseum, its apron and the park. A final
    boss living by the Colosseum fits. **Its lights**: the doorway's lamplight (the lamplight keys, warm, 0.75), its front wall's
    lit paper glowing faintly from inside like a paper lantern's (0.22: its art has no windows; the paper is the window, its
    writing and folds dark against it), and a pool of lamplight before the door. Its chip shows its head and beak.
13. **Its board marks are speck-drawn sprites** in its palette, one 32 px square each, on the shared `BoardEffects` canvas (one
    under the pieces, one over): no new drawing code.

## Player-visible text

- Lines (as written): "Every game is a draft. Shall we write one?" (entrance and select), "I'll be honest: that piece is next.",
  "Folded. It'll keep.", "Mind the crease.", "Let me write that again.", "Well played. Keep the crane.", "Beautifully written.
  I'll fold this one away."
- Banners: DRAFT ("End the attack in 2 moves, or it folds"), FOLDED ("It can't move for 4 turns"), CREASE! ("Your pieces can't
  cross it for 4 turns"), REVISION ("Both moves crossed out"); RAGE! "Next turn: Crease" (the rules lane's).
- Dock: "The crease unfolds. Your pieces may cross again." (creaseEnd); refused moves as the rules lane wrote them ("That piece is
  folded.", "The crease stops your pieces.").
- Move list: a crossed-out move's spoken label ends ", crossed out".
- Home: "Folio's Folded House" (its sign, its floating name, its chip "Go to Folio's Folded House"); its card "Folio".
- Boss menu card: "marks a piece to fold · Crease" (unchanged).

## Test checks changed (none guards a rule of Eric's, `docs/rules/eric.md`)

- `packages/chess/test/folio.test.ts`: Folio `kit: null`, not playable → `kit: "Folio"`, playable (this lane's purpose).
- `packages/core/test/boss.test.ts`: the playable bosses and the random pick's set gain `folio`.
- `packages/app/test/king-attack.test.ts`: the attackers' list gains `folio`; `FACES` gains Folio (`front`: its eye sits at
  its head's middle, its beak toward the king).
- `packages/app/test/boss-kits.test.ts`: its powers' animations (`draft: "check"`, `crease: "move"`).
- `packages/app/test/banners.test.ts`: Folio's views and its powers' starts (`POWER_AT`) join the tables.
- `packages/app/test/boss-select.test.ts`: `rowSizes` 16 `[4, 4, 4, 4]` → `[5, 5, 5, 1]`, 17 `[5, 4, 4, 4]` → `[5, 5, 5, 2]`, today
  15 → 16 tiles; "every row within one of the others" and "no tile alone" → "every row full but the last" and "one more tile moves
  none before it" (call 8); a boss's select lines "2 at least" → 1 for Folio, and "never the same twice running" skips a boss with
  one line (call 9); the color check leaves out a figure's halo (call 10).
- `packages/app/test/town-camera.test.ts`: thirteen → fourteen homes.
- `e2e/boss-select.spec.ts`: 15 → 16 tiles (Folio the 14th, the Hidden Boss's the 15th), rows `[5, 5, 5]` → `[5, 5, 5, 1]`, 13 → 14
  colors, a resting boss 14 → 15 tiles; Folio's tap added.
- Added: `packages/app/test/folio-wired.test.ts`; e2e Folio in `king-attack.spec.ts`, its home in `town.spec.ts`, and
  `folio.spec.ts` extended (its marks, banners, lines, the held board, the struck rows, its figure at 320 and 1280, a reload
  online); `e2e/areas.json` (its effects file, `king-attack.spec.ts`).

## Not done here

- Castling with a folded rook refused is unit-tested (the rules lane's `folio.test.ts`); the e2e doesn't set it up (a fold landing
  on a rook that could castle can't be forced from the test switch).
- A reload mid-fold: covered by the unit test's drawing from the view (the paper drawn with no moment); the e2e reloads mid-crease
  online only.
