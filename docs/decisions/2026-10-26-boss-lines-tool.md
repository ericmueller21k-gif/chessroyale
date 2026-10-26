# A tool that drafts boss dialogue with the Claude API (Oct 26, 2026)

The director's brief, from Eric's Oct 25 ask: more than 100 original lines per boss, including lines between bosses when they team up and in the town square. Eric approved spending his API credits on it. The tool is in `scripts/boss-lines/` (its README). The lines are drafts for Eric; nothing goes into the game.

Calls made:
- **Lore from PR #264.** The lore sketches for Ginger, Boingo, Jefferson, Hollow, Big Boy, Sawyer and Wrangler exist only in PR #264's description, so `lore.ts` quotes them word for word with that source named. Hollow's is Eric's own and is kept exactly. Lore for the other bosses is read at run time from the decision files that hold it. Chub & Chirp have none.
- **Ginger's pronouns:** "she", as the lore sketch, the FAQ and the area pages have it. The sprite file's comments say "his". This is flagged for Eric.
- **The check bans words in every line**, not only in the Hidden Boss's: "Soviet(s)", "Russian(s)", "Korchnoi", any mention of the Hidden Boss, "Grinch" and "Santa" (Hollow's design), famous catchphrases, and British spellings. It also caps lines at 70 characters. Every line already in the game passes it.
- **No refusal fallback model.** A declined call stops the run, so the spend guard only ever prices Opus 5.5.
- **The tool has its own tsconfig** (`npx tsc -p scripts/boss-lines --noEmit`). The root `typecheck` isn't changed: CI's check stays as it was.
- **The key is `BOSS_LINES_API_KEY`** (the director, Oct 26): the cloud environment keeps `ANTHROPIC_API_KEY` for Claude Code's own sign-in and doesn't pass it to sessions, so the tool reads its own name.
- **The sample didn't run:** this session had no key. `docs/boss-lines/sample/` holds the source packs and a note saying so.
