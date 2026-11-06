# Brief: the street town on WebGL only (and today's `?gl=1` retired)

**Eric, Nov 6:** "When I had you rewrite this to … WebGL … I assume that was the right call." He approved all of the audit's simplifications ("any or all of the changes that you suggest").
The audit (`/home/user/cr-notes/notes/audit-2026-11-06.md` §6 and the plan's row 4) found:
- the street town still opens in Canvas 2D by default, and WebGL is opt-in (`?gl=1`);
- every town feature is kept twice.

## Do
1. **The street town is WebGL only.** `STREET_TOWN` becomes `ADMIN_TOWN && hasWebGL2()` (admin-town.ts:16). A device without WebGL 2 gets today's town.
   - Town.tsx forces WebGL for the street. On a lost context it reloads into today's town instead of swapping to 2D (Town.tsx:559-600, :618).
2. **Remove the street town's 2D-only code:**
   - `LOW_ROOF` and `low` (home-boxes.ts:178-219; boxes.ts:107-109, :163-175);
   - the coarse strips (boxes.ts:574-578);
   - `wallSmooth2D`, `boxStrip` and `boxStrips` (feel.ts);
   - the `fine` / `kind === "webgl"` branches in render.ts (:1617, :1640, :1674, :1789-1806, :1888, :1930);
   - the 2D draw-count hook (Town.tsx:1434-1435).
   The line numbers are from main 922ed8f0, so re-find them on the current main.
   Then remove the street town's 2D draw budget (12-20 boxes), so domes draw whole.
3. **Today's town keeps Canvas 2D** for everyone, and its `?gl=1` WebGL option is retired:
   - `VITE_TOWN_GL` and the two `webgl-*` CI jobs (e2e/ci-select.mjs `WEBGL_JOBS` and the workflow matrix);
   - `town-webgl.spec.ts`;
   - `town-fallback.test.ts`.
   Only retire what serves today's town's WebGL. The street town's WebGL path (paint-gl.ts) stays and becomes its only path.
4. **Tests:** street-town specs (town-fixed, town-rows, town-street, town-controls) run once, on WebGL, not twice. Delete the 2D budget unit tests (town-boxes.test.ts:176, :192). Keep every behavior check; only the second 2D pass goes. List each removed or changed check in the PR body (old → new).
5. **Also: the tag fade.** `tags.ts nameAlpha` fades over 1 square by distance, so a slow frame pops it (main's town-tags fade test failed once on webgl-phone, Nov 6). Ease each tag's drawn alpha toward its target over about 150 ms of time (keep the distance target as is), in both today's town and the street town, and add a unit test.
6. **Stills:** the street town on a phone at the plaza and on Fountain Street, now WebGL by default. Save them untracked under the worktree's stills/ and report the paths.

## Rules
- Repo /home/user/chessroyale; worktree /home/user/cr-webgl-only on branch claude/street-webgl-only from origin/main.
- Follow `/home/user/cr-notes/notes/briefs/rules-common.md`, in particular "Keep it lean" and "Local servers": Playwright starts wrangler on your own port; no standalone wrangler.
- Commits use the identity and trailers as in brief-ledger-1.md's Rules.
- Measure the frame rate (WebGL, headless; main against the branch) at the plaza and on Fountain Street, on phone and computer, as a table in the PR body.
- Open the PR via the GitHub MCP with the `full-e2e` label (CI config changes), call unsubscribe_pr_activity, and report the PR number and SHA, the stills paths, and a 10-line summary.
- American English. Don't list processes, read env or auth files, or call session tools.
