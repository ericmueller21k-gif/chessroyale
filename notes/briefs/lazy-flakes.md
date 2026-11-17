# The flakes since the bundle split (#759): fix the cause. Opus, high. Targeted lane

Branch `claude/lazy-flakes` from main. About 1-2 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-16-bundle-split.md`,
`packages/app/src/lazy.tsx`, `lazy-game.ts`, `App.tsx` (where `game.preload()` runs: 1.5 s after home, or as play is near).

**Seen on main since #759 (Nov 17), each a first failure:** `boss-select.spec:304/:375` (the stage figure not drawn yet; patched in
#764 by a wait), `solo.spec.ts:80` and `:151` ("Today's openings" not visible in 5 s after `soloFromHome`, Classic), `chat-mod.spec.ts:31`
(the lobby heading not visible in 5 s after `createLobbyFromHome`), `king-attack.spec.ts:192` (the Last Stand's lashes 0-4 never seen by
the test's watcher, 5-9 seen). The pattern: a step that opens a screen now in the lazily loaded match chunk, read on the old timing.
**Do:** find the common cause and fix it once: in the app if a player can see it (a tap to a lobby or a match that shows nothing or
skips a beat while the chunk loads: e.g. load the chunk earlier, or hold the screen until it's there), and/or in the shared e2e helpers
(`soloFromHome`, `createLobbyFromHome`, `openSoloBoss`, … in `e2e/helpers.ts`: wait for the match chunk once, at the source, not a timeout
per test). Explain king-attack:192 specifically (does the Last Stand start before the watcher, or before its art loads?). No assertion
weakened; `docs/rules/eric.md` guards untouched (if a guard's helper changes, say so). Reproduce each with a cold cache / CPU slowed,
then show it passing. Push; `.pr-body.md` (short) and `.done`. Commits end with the `Claude-Session:` line only, no model names. No PR.
