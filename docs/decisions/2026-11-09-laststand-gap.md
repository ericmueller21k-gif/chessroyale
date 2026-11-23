# The Last Stand's result: the boss and the God King 16 px apart (Nov 9, 2026)

Eric's rule: the boss and the God King never touch, 16 px apart. Main's run failed `e2e/formats.spec.ts:194` at 11 px: Alfil,
and Folio at 7 px, both paint past their box's right edge, toward the God King (`artFacesLeft` mirrors them), and the 36 px gap
didn't cover it. **Fix:** the boss on the result row moves 16 px left (`translate`, in `.results-duo`), so the God King and his
pawn stay where they were (their speech bubble keeps its gutter). Every boss now has at least 23 px. No check changed.
