# Auto chess: bigger players (Nov 9, 2026)

- **Eric (Nov 9, from his phone):** the pawn avatars much bigger, about as tall as a bench tile; each player block (pawn, name, level, HP and XP) filling its bench row's height, with bigger text and taller, wider bars; the top block the same as the bottom one.
- **What changed:** the pawn is as tall as a bench tile (never under 44 px); each block fills its grid row less the gap to the board; its text, bars and width scale with the board (`--ps`, `--ph`, `--iw` in `styles.css`).
- **Call made:** `--pl-h` (which sizes the board) is unchanged, so the board, benches, action box, header and gear stay where they are. The block is capped by the row, not by the text.
- **Result:** at 390 the pawn is 45 px (it was 44), the block 59 px (was 52); at 1280 the pawn is 52 px (was 44), at 1920 76 px (was 44). Checks: `e2e/autochess.spec.ts`, "the players (Nov 9)" (new) and the v5 thin-bar cap (8 → 10 px).
