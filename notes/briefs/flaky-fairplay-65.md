# Flaky: fairplay.spec.ts:65 "a ban means you can't sign in" (Nov 15)

Effort high (an investigation, test or app). Lane: fairplay. Targeted lane. Branch `claude/flaky-fairplay-65` from main. Read
`docs/areas/fairplay.md` (bans, the ban screen, the `hc_banned` mark), `.claude/LESSONS.md`, CLAUDE.md "Fix the cause, not add a
checker". Never weaken or skip the test, and never just raise a timeout: find why it fails.

## What fails
It has passed only on its retry on main and PRs since Nov 14 (both projects seen; main's run on b6582a7f [phone], #730's PR run
[desktop], #726's, 77a15f0e's). It turns main red each time. Same step every time:
- After the ban, the open tab, every URL and API route show only the ban; then "A fresh browser (cookies and storage cleared)":
  `page.context().clearCookies()`, `localStorage.clear()`, then `emailSignIn` routes `/api/auth/config` (onlineNeedsSignIn) and
  `/api/auth/email/start`, plants a code, `page.goto("/")`, and expects the heading "Sign in to play online" within 5 s:
  `element(s) not found` (fairplay.spec.ts:58, called from :135).
So the page at "/" after clearing showed something else. Candidates to check, not conclusions: the ban screen again (a mark kept
somewhere that `localStorage.clear()` and `clearCookies()` don't clear: IndexedDB, sessionStorage, the service worker's caches or
a cached `/`, an in-memory state across the same page), a guest home (the config route missed: a request the route doesn't see,
e.g. one made by the service worker, or the config read before the route answers), or a slow first load.

## The job
1. Reproduce: run the test many times locally, both projects (`npx playwright test e2e/fairplay.spec.ts:65 --repeat-each 20
   --project phone` and desktop, under the shared e2e lock; `--trace on` for the runs), and catch a failing run's trace: what the
   page shows at :58 and which requests it made. If CI's traces are reachable, use those too.
2. Find the cause and fix it there. If it's the test (its setup doesn't make the "fresh browser" it claims), fix the test so it
   truly is one. If it's the app or the server (a banned mark or state surviving where it shouldn't, or the sign-in page not
   showing when it should), STOP and write what you found to `.findings.md` on the branch before changing ban or sign-in code:
   that is fair play and sign-in (the full lane), and the director decides.
3. Prove it: the same repeat run passes 20/20 on both projects after the fix (and say how often it failed before).
4. A short decision note (about five lines) and the lesson at the end of `docs/history/lessons.md` if it's a pattern others
   could repeat. `.pr-body.md` (cause, fix, checks old -> new, the repeat counts), `.done`. No PRs, no CI waits, no model names
   in commits (end commits with the Claude-Session line only). Push work in progress at each real step.
