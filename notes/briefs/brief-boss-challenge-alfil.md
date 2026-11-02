# Brief: Alfil's home + the boss challenge from town (Alfil first)

Worktree `/home/user/cr-challenge`, branch `claude/boss-challenge`, from `claude/nov2-fixes-b` (PR #465, not merged yet: merge
main in when it lands, never rebase). Opus high. Push as you go.

## Art (on `origin/claude/boss-art`, read with git show; copy into the app as the shops did)
- Alfil's home: `scripts/boss-art/out/house-shop-alfil/` + `scripts/boss-art/out/shop-alfil-nov2.md` (SHOP_ALFIL_PIECES / _LAYOUT
  / _LIGHTS / _POOLS / _COUNTER_SIGN / _CRATE_AT, HOUSE_SHOP_ALFIL; the showpiece `sand-fountain` 4x3, its basin a plan from
  above: lay it flat, `d: 3`, pylon at its back edge, like Puddles' pond).
- Alfil's intro: `scripts/boss-art/out/house-intro-alfil/house-intro-alfil.ts` + `intro-alfil-nov2.md`: INTRO_ALFIL_PYRAMID (111x116,
  foot [55,106]; anims rise 8, idle 2 loop, crack 6, crumble 8; the table appears on crumble frame 2; cues rumble/crack/crumble/
  table), INTRO_ALFIL_TABLE (+ _PALETTE: keys 1-5 the slab, L/D the squares; keep the town's TABLE_INK for the pieces),
  INTRO_ALFIL_STORM (128x128 tiling) and INTRO_ALFIL_FRONT (48x128), 6 x 70 ms, 3x nearest: the storm sweeps in ~0.6 s, holds
  covered while the game loads, slides out with FRONT mirrored.

## 1. Alfil's home is a shop like Babur's and Puddles'
"Go in" on his home card (name + Go in only, as batch B), the room, the Shopkeeper (his kid's sprite), "Alfil's Boss Crate"
(BOSS_CRATES: his ride first; check his ride's id), the room's chat tone, everything as the other two shops (`town/shops/`).

## 2. The boss challenge from town (Eric, Nov 2), built generic, Alfil wired
Eric: "when you challenge a boss in town, they walk into their store with you and you each walk to the middle area on the floor
spaces that are reserved in the battle area, he says a line out loud… each boss also has a unique animation for a chess board
appearing, so for elephant a sand pyramid forms between you, risen from the ground, then it starts cracking and inside the
chess board emerges on a table… Then it does a special load like a Pokémon battle screen flash… For Alfil, it's a sandstorm
that blows across and covers the screen, then you're right into the game. After the game, the normal defeat/victory screen
shows (the token box where it is)… exiting puts you back standing where you were before, like a Pokémon gym."
- Find how a boss is challenged in the town today (the boss's walk-up card / "Battle" in the town square) and keep that
  entry. For a boss with an intro (Alfil now; a per-boss table so others plug in later): fade into its home with the boss
  beside you (the boss walks in with you: a short walk through the door is enough), both walk to the battle circle's two start
  marks (south: you, north: the boss), facing each other; the boss says its challenge line in a speech bubble (and the town chat
  log): until Gemini's lines arrive use "I'll show you the power of the old piece." for Alfil (one line in settings/lines, so
  Gemini's Part D lines drop in later); then the intro (pyramid rise → idle → crack → crumble, the table with the board appearing
  between you, sounds on the cues if fitting ones exist, else silent and say so); then the transition (the sandstorm), the boss
  battle loads under it (the same battle as today's challenge: same settings, difficulty, tokens counting), the storm slides out.
- After the battle: the normal victory/defeat screen (token box as today). Leaving it returns you to the town square where you
  stood when you challenged (position and facing), not the home screen. If the battle was started any other way, leaving works
  as before.
- A boss without an intro yet: unchanged (today's flow).
- Skippable? Keep the whole intro under ~6 s; a tap does NOT skip for now (say if you think it should).
- Phone first, then computer. Performance: the intro art loads lazily.

## Done means
- Unit tests for the flow's state machine (and the return-to-town position). E2E `e2e/boss-challenge.spec.ts`: challenge Alfil in
  town, the walk-in, the line, the pyramid, the storm, the battle board shows, resign/finish, the result screen, leave → back in
  the town at the same spot. Phone and computer. Run only what you change (e2e lock, `flock -o` + exit trap).
- Stills + one GIF of the whole intro (phone) in `docs/boss-challenge/`. PR-body file `docs/boss-challenge/pr-body.md` with every
  player-visible text change and changed checks old → new.
