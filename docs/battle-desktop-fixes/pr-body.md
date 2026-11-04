Boss battles on a computer: the boss casts where he stands, bigger figures beside the board, the cave's speech bubble; Eric's "sprites always on screen" rule

Eric's report (Nov 4, a 2000-px-wide Chrome window, fighting Hollow) and his new standing rule the same day. Decision:
`docs/decisions/2026-11-04-battle-desktop-fixes.md`. Area pages: bosses.md ("A boss battle on a computer"), god-king.md, town-square.md
(the intro's bubble). Rule: `docs/rules/eric.md`, "Every character sprite is whole on screen (Eric, Nov 4)".

## What changed

- **The jump (root cause).** It wasn't the move beat's `translate` (that only moves a phone's bar figure). A power moment drew the
  boss's cast with a second figure, `.pm-caster`, at the board's top-left corner (`top: -16%` of the board, Hollow's `-27%`) and hid
  the standing figure's sprite only, so its words stayed at the bottom-left. On a phone that corner is just under the bar where the boss
  stands; on a computer the boss stands at the bottom-left and the board's top is near the window's: at 2000 × 1250 Hollow's caster was
  drawn at y = -226. Now `Cast` (`components/PowerParts.tsx`) plays the cast where the boss stands on a computer (an `InPlace` run), and
  every corner cast goes through it (`cast()` in BossPowers for every boss, Hollow's darkness, Chub & Chirp's race, Jefferson's
  fireproof). The standing figure hides only while a moment draws the boss elsewhere (`.boss-moment`, on the board). Flights (ice bolt,
  pie, spark, darkness, block) leave from his side of the board. A phone is unchanged.
- **Bigger figures on a computer.** They used to be: the boss 2 screen px a sprite px (a 96 × 120 box) since Oct 8 (7581a98d, Boingo's
  first figure; 1× from 900 to 1099 px since 6285b1cb, Oct 14), and the God King in a 120 px box (d6c38776, Oct 8). Nothing shrank
  them: the board grew around them (#406, Oct 29: from 470 px to the window's height; #443, Nov 1, "Computer game screens": no title
  line, a bigger board), to 600 to 1120 px now. From 1100 px wide the boss now grows with the board (`characters/side-size.ts`:
  `SIDE_FEEL.boardPerPx` 240, from 2 up to 4.5 in quarter steps), as far as his room left of the board and the window's top allow
  for his drawing at rest and at the end of every beat (`SIDE_REACH`, measured from the art by a unit test). The God King and your pawn
  grow as far as the room right of the board allows (`--king-k`). BossSide sets `--side-s` and `--king-k` on the screen at load and on
  resize; styles.css reads them. Babur keeps his size (his pump stands beside him in that room; bigger, it went into the taller bar and
  the board shrank). The board's size and place, a phone and 900 to 1099 px are unchanged (checked at every size: same board box).
- **The cave's bubble (every boss's intro line and Hollow's channel lines).** Sized for the boss as drawn (`CHALLENGE_FEEL.bubble`:
  0.11 of his frame's height, 11 to 32 px) and its tail just over the top of his drawing (`drawnTop`), not over his frame's head room.
- **Eric's rule (Nov 4)** in `docs/rules/eric.md` with its guard.

## Player-visible changes

- Computer: when a boss uses a power that used to show it at the board's top-left corner (Hollow's darkness, Ginger's freeze and
  blizzard, Boingo's pie, Jefferson's sparkler and fireproof look, Big Boy's toss, Sawyer's cut, Alfil's casts, Chub & Chirp's hop,
  carrots and race, Smudgy's splash, drip and strokes, Moo's beams, Puddles' watering, Babur's hoops, Folio's ink, fold, crease and
  revision, Timber's gnaw and build, every RAGE warning), it now casts where it stands by the board's bottom-left corner, its words with
  it; the bolt, pie, spark, darkness or block flies from there.
- Computer, 1100 px and wider: the boss beside the board is bigger (about 1.25× at 1280 × 800, 1.25 to 1.5× at 1440 × 900, 1.4 to 2×
  at 1920 × 1080 and 2000 × 1250; Babur as before); the God King and your pawn about 1.15× at 1280 and 1440, 1.5× at 1920, 1.25× at
  2000. The God King's words beside your pawn wrap a little narrower as he stands further out, so they stay in the window.
- The cave (every boss's challenge intro): the line's bubble about 2.5× as big on a computer (22 px type at 1440 × 900), just over the
  boss's head; on a phone the same size as before or a touch bigger (11 to 13 px), now just over his head too, in view.
- No new text.

## Checks

New:
- `e2e/boss-side.spec.ts`, "Eric's rule (Nov 4): <boss> and the God King whole on screen at rest and at the end of every beat, phone and
  computer": one per boss in BOSS_KITS (17), both projects: at 390 × 844 (phone) and 1280 × 800, 1440 × 900, 1920 × 1080, 2000 × 1250
  (computer), every frame the boss rests in and every animation's last frame, drawn in its box where it stands, inside the window; the
  God King's the same; your pawn's box. Guards the new eric.md rule.
- `e2e/boss-side.spec.ts`, "Hollow's darkness on a computer: he casts where he stands, by the board's bottom-left corner, his words with
  him": at 1280 × 800 and 2000 × 1250, every frame of his cover: no figure at the corner, his figure shows and keeps its box, his words
  right-aligned on him and over him.
- `packages/app/test/battle-desktop.test.ts`: every corner cast goes through `Cast`; `SIDE_REACH` matches the art; `sideSizes` at the
  four sizes (bigger, inside the room and the window, never smaller; Babur 2); the cave bubble's size and every intro boss's drawn head.

Changed (old → new; neither guards an eric.md rule):
- `e2e/timber.spec.ts`, "on a computer his figure stands beside the board at rest (never over the board, the bar or the side menu); his
  cast by the board's corner never over the side menu" → "… at rest (his drawing never over the board, the bar or the side menu); his
  cast plays where he stands, never at the board's corner": the rest boxes are his drawn pixels, not his frame's box (the frame's empty
  margin may lie over the menu now he's bigger; Eric, Nov 4: over a menu is fine); `expect(geo.cast.length).toBeGreaterThan(0)` and
  "cast never over the side menu" → `expect(geo.cast).toEqual([])` and his figure's animations include `gnaw`.
- `e2e/sawyer.spec.ts`, the board saw's cut: the caster seen by `.pm-cut .pm-caster` → `.pm-cut .pm-caster, .screen:has(.pm-cut)
  .boss-char.place-side[data-anim="sawDown"]` (a phone's caster at the corner, or a computer's figure sawing where it stands).

Run locally (under the e2e lock, against a fresh build): `e2e/boss-side.spec.ts` (both projects, 43 passed), the Timber computer test,
the Sawyer board saw test (both projects); the unit tests above plus boss-challenge, shop-hollow and boss-character; typecheck.

## Stills (`docs/battle-desktop-fixes/`)

- `hollow-cast-2000x1250-before.png` / `-after.png`, `hollow-cast-1280x800-*`: his darkness, before at the board's top-left (half off
  the window at 2000), after where he stands.
- `sizes-<w>x<h>-before.png` / `-after.png` for 1280x800, 1440x900, 1920x1080, 2000x1250 and phone: all 17 bosses with the God King and
  your pawn (one command: `node scripts/stills-battle-desktop.mjs sides <dir>` against `npx wrangler dev --port 8971`).
- `cave-computer-before/after.png` (1440 × 900), `cave-phone-before/after.png`: Hollow's "Did you leave a light on?".

## Follow-up (not in this PR)

- Moments that carry the boss onto the board (Big Boy's bounce, Sawyer's leaps, Wrangler's leap and lasso, Boingo's funhouse, Jefferson's
  candle, Lights out) and a few effects aimed from the corner (Smudgy's blob, Chub & Chirp's hop, Babur's hoops) still start at the
  board's top-left on a computer: inside the window, but not from where he stands.

## Lane

Targeted (a shared component, CSS and the shop room's drawing; no rules, server or protocol). The e2e run: the boss specs and
boss-side (paths in e2e/areas.json).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
