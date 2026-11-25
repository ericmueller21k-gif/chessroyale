# Squads: no opening that starts in check (Nov 25). Opus medium, Squads lane, targeted. Branch `claude/squads-no-check-starts` from origin/main

Eric (Nov 25), on a Pairs board that started from the Steinitz Gambit where 5.Ke2 is White's only legal move (found by flakes-2:
`docs/decisions/2026-11-25-squads-tokens-test.md`): "yes drop it". Squads' boards start `SQUADS.openingMoves` moves per side into a library
opening (`packages/chess/src/squads/match.ts` `drawOpenings` → `pickOpenings(...)` in `openings.ts`, `openingStart`).
Do: the Squads opening draw never picks an opening whose start position (after `2 * openingMoves` plies) has the side to move IN CHECK
(that covers the one-legal-move case and any other forced start). Filter at the draw (least code; don't edit `data/openings.json`), keep the
draw seeded and deterministic, and make sure the library still has enough openings for the most boards a lobby needs (say how many are left
after the filter, and how many were dropped, by name). Also check whether solo/crowd use the same starts (`pickOpenings` elsewhere): if they
can start in check too, say so in the PR body (don't change them unless it's the same one-line filter and clearly right; it's Squads
Eric answered for). Tests: a unit test that no Squads start is in check (over the whole library at the current settings), and that the
Steinitz line is excluded. A ~5-line decision note; `docs/areas/squads.md`; `.pr-body.md` (lane targeted; checks changed old → new). Run the
chess package's unit tests and typecheck. Push, write `.done`, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). About 30-45 minutes.
