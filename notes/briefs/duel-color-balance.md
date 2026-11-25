# Ranked 1 v 1: balance colors per player + a Handbook entry (Nov 25). Opus xhigh (matchmaking/rating), `ranked` lane, targeted

Eric (Nov 25), after the director's research (chess.com: Glicko, no color factor in its ratings article, but its matchmaking balances
colors so you're not stuck on one color; Lichess's scalachess has an optional White edge, `ColorAdvantage.standard` 11.78; ours, Glicko-1
in `packages/core/src/ranked.ts` `expectedScore`, ignores color): "Color balance seems good, and add this to the handbook". So: balance
colors; NO White edge in the rating (not asked).

Start: `git fetch origin main && git checkout -B claude/duel-color-balance origin/main`. Read CLAUDE.md, `docs/areas/ranked.md`,
`matchmaking.md`, the duel pairing (`packages/server/src/matchmaker.ts` duel mode, `queue.ts`, core `pairUp`), `duel-do.ts` / `duel-room.ts`
("White first"), `ranked_1v1_games` (`white_id`, `black_id`, `ranked-schema.ts`).

1. **Find out how White is chosen today** (state it in the PR body: coin flip, queue order, or always the same seat?).
2. **Balance:** when a pair is seated, White goes to the player with the larger (Black games − White games) over their recent ranked games
   (e.g. the last 10, from `ranked_1v1_games`, read with the ticket so pairing stays fast); a tie → the one who had Black in their last
   game; still tied → a coin flip. Never more than 2 games in a row on one color when it can be helped (as chess.com's "not stuck on one
   color"). Every number in `RANKED_1V1` (settings.ts). Bots' and the town's games keep what they do today.
3. **The Handbook** (`packages/app/src/faq/content.ts`, the ranked 1 v 1 block; numbers from settings, never typed): "Colors: the game
   gives each player White and Black in turn, as evenly as it can, so nobody is stuck on one color. Your rating doesn't change by
   color: over many games each color evens out." (Plain words, American English; the FAQ test `packages/app/test/faq.test.ts` passes.)
4. Tests: unit tests (core/server) for the rule incl. ties and streaks; the FAQ test. Docs: `docs/areas/ranked.md`, a short decision file.
   `.pr-body.md`, `.done`, push, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`
   (no Co-Authored-By). Effort xhigh. About an hour.
