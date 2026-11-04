Bigger figures beside the board on a computer: the boss, your pawn and the God King toward twice their size, over the board's edge a little where needed

Eric (Nov 4, after #482): "those things are tiny… there is space for more", and his rule the same day: overlapping the board or a menu is
fine ("it can even create a cool effect"), being cut off by the window's edge never is. In #482 the mirror (your pawn's middle as far from
the board as the boss's) and the "clear of the board" check held the figures to about 1.1× at 1280, 1440 and 2000 px. Decision:
`docs/decisions/2026-11-04-bigger-side-figures.md`. Area pages: bosses.md ("Their size and place"), god-king.md.

## What changed

- `characters/side-size.ts` (`sideSizes`, `SIDE_FEEL`): from 1100 px wide the boss grows toward 2× (the board's side over 170, 2 to 4
  screen px a sprite px) in the room left of the board; your pawn and the God King toward 2× (1 to 2) in the room right of it. Each
  stands 12 px off the board where its room allows, and where it doesn't, comes over the board's outer edge by at most `SIDE_FEEL.over`
  (0.05 of the board's side, 0.4 of a square) before it gets any smaller. `SIDE_REACH` now has each drawing's reach down too, and
  `KING_REACH` the God King's (both measured from the art by the unit test).
- `BossSide` (`components/BossCharacter.tsx`) sets `--side-s`, `--side-d` (the boss's place), `--side-lift`, `--king-k`, `--first-d`
  (your pawn's place, else the God King's) and `--king-room` on the screen, at load and on resize. styles.css places the figures from them.
- The boss is drawn over the board where he comes over its edge (`.boss-side` z 6), and stands a few px higher there when his drawing
  under his feet would lie over the dock's row under the board.
- Your pawn's box ends at its feet (`translate: 0 -14px`, `--feet: 0`; it stood on the God King's 14 px crowns' row), so it never lies over
  the dock's row where it comes over the board's corner. It's drawn where it was.
- The God King's frame, wider than his drawing, is clipped past the window's edge (`.gm-main { overflow-x: clip }` on a boss battle),
  never scrolled to; his drawing stays inside. His words and his menu are no wider than the room to the window's edge (`--king-room`).
- The mirror gave way (a design check, not an eric.md rule): each side is placed by its own room, by the same rule. Kept exactly, it held
  the boss to 1.1× at 1280.
- Unchanged: the board's size and place (checked at every size, every boss), a phone, 900 to 1099 px, Babur (his pump's room), a raid's
  boss (over its scoreboard's edge, as before; its God King grows), a party's battle.

## Player-visible changes

- On a computer 1100 px and wider, the boss beside the board is about twice the size it was before #482 where there's room (1.55 to
  1.8× at 1280 × 800, 1.55 to 2× at 1440 × 900, 1.8 to 2× at 1920 × 1080, 1.65 to 2× at 2000 × 1250; Folio's wide drawing the least),
  standing over the board's bottom-left corner a little where his room needs it.
- Your pawn and the God King: 1.4× at 1280 × 800, 1.43× at 1440 × 900, 1.9× at 1920 × 1080, 1.6× at 2000 × 1250; your pawn over the
  board's bottom-right corner a little where needed. In a raid the God King grows the same, off the board.
- No new text.

## Checks changed (old → new; none guards an eric.md rule)

- `e2e/boss-side.spec.ts`, "<boss> beside the board stands clear of it, no eval bar" (Oct 28) → "<boss> beside the board stands by its
  corner, over its edge by at most 0.05 of its side, no eval bar": `gap ≥ 0` → `gap ≥ −0.05 × board`, at 1280 × 800 and 2000 × 1250.
- `e2e/board-layout.spec.ts`, "no eval bar (every player's board): your pawn is as far from the board as the boss is on its other side…"
  → "…your pawn and the boss by the board's bottom corners, each over its edge by at most SIDE_FEEL.over of its side…": the mirror (±2 px)
  and your pawn 24 to 32 px off the board → your pawn from −0.05 × board to 32 px off it, the boss's middle left of the board.
- `e2e/board-layout.spec.ts`, "a computer: Boss alone has no scoreboard and your pawn left of the God King…": your pawn "clear of the
  board as the boss is" (≥ 24 px) → "by the board, over it by at most 0.05 of its side"; "on his line" and "his height" from 1100 px
  wide count the God King's 14 px crowns' row your pawn no longer stands on; "your pawn over nothing" → "over nothing but the board's
  edge" (the board's overlap checked by the line above).
- `e2e/boss-character.spec.ts` (Boingo, computer): the mirror (±2 px) and "your pawn by the board's corner" (≥ the board's right edge) →
  your pawn from 0.05 × board over the board's right edge to 32 px off it.
- `e2e/desktop-board.spec.ts`, "nothing over anything": the boss, your pawn and the God King may come over the board by at most
  0.05 × board (was: clear of it); "your pawn by the board" 24 to 32 px → −0.05 × board to 32 px; "the boss left of the board" → "by the
  board's left, over it by at most 0.05 × board".
- `e2e/timber.spec.ts`, the computer test: "his drawing never over the board, the bar or the side menu" → "over the board's edge by at most SIDE_FEEL.over of its side, over the side menu if need be, never over the bar or off the window" (at 1280 his rest drawing came 26 px over a 600 px board and 8 px over the side menu's rail; Eric's Nov 4 rule allows both; the figure lets every tap through).
- Unit (`packages/app/test/battle-desktop.test.ts`): `SIDE_REACH` and `KING_REACH` measured with the reach down; `sideSizes` at the four
  sizes: at least 3 px a sprite px for the boss and 1.4 for the God King, each in its room, over the board by at most 0.05 × board, the God
  King's drawing in the window; a gap off the board where there's room; Babur, a party and a raid's boss as before.
- Kept, and added to: the on-screen guard (`boss-side.spec.ts`, "Eric's rule (Nov 4)…", every boss, phone and four computer sizes, with
  the no-sideways-scroll check) now also checks the boss's and the God King's drawings are never over the move list.

Run locally under the e2e lock against a fresh build (port 8985): `boss-side`, `board-layout`, `boss-character`, `grex` and
`desktop-board`, both projects: 71 passed, 26 skipped; Jefferson's two long grex tests failed in that run under four workers (his laugh's
line not seen; his intro card not found on the phone) and passed on their own (4 passed). Typecheck; the unit tests.

## Stills (`docs/bigger-side-figures/`)

`sizes-<w>x<h>-before.png` / `-after.png` for 1280x800, 1440x900, 1920x1080, 2000x1250 and phone: every boss (17) with your pawn and the
God King; before is main (#482). One command: `node scripts/stills-battle-desktop.mjs sides <dir> 1280x800,1440x900,1920x1080,2000x1250,phone "" http://localhost:<port>`.

## Lane

Targeted (layout and sizing: a shared component, CSS; no rules, server or protocol): the boss and layout specs above.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
