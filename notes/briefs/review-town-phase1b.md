# Independent review: town phase 1b (the app loads the baked pictures). Opus, xhigh, read-only. Full lane.

Read `notes/briefs/rules-common.md`, `DESIGN.md` on `origin/claude/town-architecture` (§2), and the branch's `.pr-body.md`
(`origin/claude/town-phase1b`, commit 9e9c2046). Review `git diff origin/claude/town-phase1a...origin/claude/town-phase1b` (1a is PR #1040).
Look hardest at: the service worker (a town file answered from any version's cache: never a stale or wrong page for the manifest the app
asked for; a deploy's copy step; a cache that fills or is cleared; an old app with a new worker and the reverse); the manifest's name
(`__TOWN_PICTURES__`) and content-named pages (a half-deployed site, a 404, a page that changed under the same name); the all-or-nothing
fallback to painting (a slow or failed fetch, a decode failure, a lost WebGL context mid-load); off-main-thread decoding and memory (pages
released, nothing kept twice; iOS); home's idle prefetch (never during a match or a boss battle, never competing with a battle's load;
data use on a phone); "load first, then show" (the card lifts only when the start view's groups are uploaded); the admin town and the
player town never fetching the other's files; the dev server's bake. Same pixels: the hashes. Write `REVIEW.md` (blockers, should-fix,
nits with file:line and a failing case; Checked; Not reached) on branch `claude/town-phase1b-review` from the 1b head, commit AND push
with `.done` (`git add -f`), check `git ls-remote`, stop. No code fixes, no PRs, no comments. About 45 minutes.
