# No boss music on walking into a building; Birdie's token wired (Nov 23). Opus medium, targeted lane

Eric (Nov 23): "walking into a building no longer triggers the boss's music. I want that to stop." (A change to how rooms work, Eric's own
call; record it.)

Start: `git fetch origin main && git checkout -B claude/room-music-off origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, the town's area page and the music's (`docs/areas/`). Effort medium: a small switch and a file copy.

1. **Room music off.** Today `Town.tsx` calls `roomMusic(roomTheme(def))` on entering a room (`music.ts` `roomMusic`, `shops.ts`
   `roomTheme`): the boss's theme takes over from the town's. Make entering any building leave the town's music as it is (no boss theme,
   no fade), with one setting in `packages/core/src/settings.ts` (e.g. `ROOM_BOSS_MUSIC: false`, Eric's words in its comment) rather than
   deleting the room-music code, so it can come back with one line. The battle's own music is unchanged. Update every unit and e2e check
   that expects a room's theme (grep `music:room`, `roomMusic`, `roomTheme` in `packages/*/test` and `e2e/`): each now expects the town's
   music to carry on inside. List each changed check old → new in the PR body. If one of them guards a rule in `docs/rules/eric.md`, Eric's
   words above are his OK: say so in the PR body and update the rule's text.
2. **Birdie's token.** Copy `scripts/boss-art/out/token-birdie/token-birdie.ts` from `origin/claude/boss-art` (commit 0746234e, approved
   by the director against Ginger's and Dash's) into `packages/app/src/components/tokens/token-birdie.ts`, as `token-blitz.ts` was (a
   two-line header naming the source and commit), and map `birdie` in `components/tokens/index.ts`. Its existing tests (a token per boss,
   if any) pass.
3. Prove: typecheck; the unit tests you touched; the e2e specs that check room music and tokens (phone and computer). Decision note of
   about five lines (`docs/decisions/2026-11-23-room-music-off.md`). Area pages updated. PR body in `.pr-body.md` (what changed,
   player-visible changes, changed checks old → new). `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert.
   Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names).
Never write the Hidden Boss's name. American English.
