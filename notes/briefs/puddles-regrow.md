# Puddles: the watering regrows the piece he'd lose (Nov 26). Opus xhigh. Boss lane. Branch `claude/puddles-regrow` from main.

You are the `god-king` delegate (boss powers). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/bosses.md`
(Puddles), `packages/chess/src/bosses/gardener.ts` (header: Watering, `waterFrom`, `waterAnswer`, the pass guard, `waterCheck`, `waterGuard`),
`docs/decisions/2026-10-21-gardener-rules.md`, and today's `docs/decisions/2026-11-26-carrot-patch-wait-cap.md` (#972: the guard now
holds a warned watering at most `ultWaitMax` (3) times, then the host places it whatever passing costs).

**Eric, Nov 26:** "their ults, they always, if they're losing material, typically they gain it back. So that's kind of the idea. Is it
possible we can calculate if they're going to lose, say ... for Puddles, if he's going to lose like a big piece, then he should just
basically regrow that same piece. And I don't think there should be an issue with calculating that. Like if he uses it when one of his
pieces is at risk ... we could do his too then."

**Build:** when the watering comes while passing would cost him material (the guard's `passLoses` case, including the forced case after
`ultWaitMax` waits), the watering makes up the piece he'd lose: among its outcomes, one seed regrows **the same kind of piece** he stands to
lose (the biggest one passing hangs, as the engine's line shows: e.g. the hanging knight), placed on a square its guards allow, in
addition to what the seeds rolled (or replacing a "nothing" roll: your call, the simplest that keeps the outcome fair and the roll
honest; record it). The engine's placement target (`waterTarget`, the band) then counts that regrowth so his total gain stays near the
target, not double. The hard guards stay (no check, no mate in one, the crowd always has a move, never a ninth pawn, a full set
rule). With that, the watering need not wait at all when a piece is at risk: decide whether the guard still holds it (simplest: it
doesn't wait when the regrowth covers the loss; it still waits if even the regrowth can't cover it, up to the cap). Online: the server
rolls, the host's engine places, `waterCheck` checks the regrowth too (a host can't invent one). FAQ (the Watering line), bosses.md,
a decision note. **Tests:** unit: a hanging knight → the watering regrows a knight and comes now; a hanging pawn (under the guard's
threshold) → as before; the regrowth placed legally; online check refuses a fake regrowth; even games (nothing at risk) unchanged
(same placements before/after for seeded cases). e2e: Puddles' spec, one focused check. Boss lane: the director starts the quick review.
Budget about 1.5-2 hours. `.pr-body.md` (what, player-visible, checks changed old → new), commit and push it and an empty `.done`, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English.
