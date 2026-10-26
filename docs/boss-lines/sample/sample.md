# Boss lines sample: Ginger and Jefferson (ice vs fire): NOT RUN YET

> **Summary**
> 1. Built: `scripts/boss-lines/` (`npm run boss-lines -- packs | sample | pair <id> <id> | boss <id>`). It builds a source pack per boss from the repo, then claude-opus-5-5 (effort "high", structured outputs) writes character sheets, a relationship, everyday lines and pair conversations. A critique pass rewrites weak lines, and an automatic check rejects any line breaking Eric's writing rules or running over 70 characters.
> 2. Cost: **$0.00. The sample didn't run** because the key wasn't set in this session's environment. The tool stops before any call without it. Only the source packs were written (`packs.json`). The spend guard's worst case for the full sample is about $1.80 (7 calls), under the $3 cap. A typical run should cost well under that.
> 3. To run it: add `BOSS_LINES_API_KEY` as an environment variable in the environment's settings, start a new session, then run `npm run boss-lines -- sample`. It overwrites this file with the sheets, the relationship, the lines, the conversations and the cost.
> 4. Unsure: Ginger's pronouns. The lore sketch, the FAQ and the area pages say "she"; the sprite file says "his". The packs use "she". The lore for the first seven bosses comes from PR #264's description (draft lore, never in the repo); Hollow's is Eric's own, kept exactly.
> 5. No refusal fallback is set: a declined call stops the run with a message, so the spend guard only ever prices Opus 5.5. Chub & Chirp have no lore paragraph in the repo, so their pack uses only their look, powers and lines.

What `packs.json` holds, for each of the two bosses: name and id, pronouns where the repo settles them, both powers (with the FAQ's words for players), the look (from the sprite file's notes), the lore with its source, the character-select lines, and every line the boss already says in battle, by moment.
