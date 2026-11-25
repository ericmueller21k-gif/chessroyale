# The 50 v 50 status line's box stops at the gear (Nov 25, 2026)

- Main 3f082b5 (#927) went red: `[desktop] match-menu.spec.ts:71` (the gear after the title) failed both tries. #927 widened the status line's box under the gear (padding for the gear's room) and moved the whole box by `--board-shift`.
- Fix (app, CSS only): the box keeps margins for the gear's room, so it ends where the gear starts; the words move onto the board's middle by padding on one side inside the box, never by moving the box. Looks the same as #927.
- Cause of the miss: the PR run didn't run `match-menu.spec.ts` for `board-size.css`. It's now in that area's specs in `e2e/areas.json`. No test changed.
