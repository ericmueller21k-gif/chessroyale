# Review: Chandy's art (PR #736, branch claude/boss-chandy). One quick pass (boss lane), read-only. Opus, high

About 30 minutes. Read `CLAUDE.md` (the boss lane, "Simple beats flashy", "Nothing hidden, nothing shifts"), `.claude/LESSONS.md`,
`docs/areas/bosses.md` ("Adding a boss", "What a boss screen draws each frame"), the design `DESIGN.md` on branch
`stills/boss-chandy`, the rules job's notes `docs/ideas/chandy-wiring.md`, then the diff `git diff origin/main...origin/claude/boss-chandy`.
No fuzz marathons, no sims, no code changes.

The PR is art only: nothing is wired into a battle yet. Look for real problems only, ranked:
- anything that touches other bosses or players today: `main.tsx`'s `/chandy` route (does every other path still render exactly as
  before; is the preview really admins-only, and does a non-admin or a guest ever load the preview chunk), the shared `BossEffect.tsx`
  frame loop now exported, `effects.ts` / `power-art.ts` / `kits.ts` (ART_KITS) changes, `scripts/frames-boss-character.mjs`,
  `styles.css` rules that could leak onto other screens (unscoped selectors);
- per-frame work and frame cost on a phone (a dozen sprites a dozen loops: everything on the one shared board-effects canvas?);
- the components (`ChandyDodge.tsx`, `ChandyUpgrade.tsx`) holding state or timers that will be wrong once the rules job drives them
  from the shared match state (solo and online must show the same thing; timers off server time);
- Eric's words not followed: no aim lines during Dodge's vote (lines flash only after the lock), clones visible while firing, the rifle
  his full length, the upgrade window ~2 s, teleports 1/2/3 per round with the last 1.2 s before the close;
- originality (no copied famous character) and no images under docs/.
Each finding: file:line, the failing case, a fix in one line.

Write `review.md` (at most 1 page: verdict, findings by severity, what you checked) to the orphan branch `review/boss-chandy` and push.
End commits with the Claude-Session line only, no model names.
