# The ban test's fresh browser is a browser of its own (Nov 15, 2026)

- **What failed:** `e2e/fairplay.spec.ts`, "a ban means you can't sign in", passed only on its retry on main and PRs since Nov 14
  (both projects): after "a fresh browser", `/` showed the ban screen or a guest home, not the sign-in.
- **Why:** the test cleared the cookies and storage of the tab still open on the ban screen. That tab had requests on their way; an
  answer to one sent before the clear (the ban answer: the browser's mark and `brc.banned`) landed after it and marked the browser
  again, as it should. Locally, no trace: 1 in 20 runs on each project; with a trace, 0 in 40 (a trace slows the page enough to hide
  it, so CI's traced retry always passed).
- **The call:** a fresh browser is its own context (`browser.newContext`), and the open tab is closed first. No check changed or
  removed. It is a guard test of Eric's Nov 13 rule (`docs/rules/eric.md`): the setup changes, so it needs Eric's OK.

## Found on the way (ban code, not changed: queued by the director as a full-lane job)
- **A request with a just-ended banned session is served as a newcomer.** Requests leave together with the banned session's cookie;
  the first to reach the gate ends the session (`banAnswer` deletes its row), the others find no session, so `banGate` returns null:
  `GET /api/me` makes a new guest account and session for the banned browser (200). The ban holds (the next request carries the mark
  and is refused), but each race leaves a stray guest account and a loaded guest profile behind the ban screen for a moment (here it
  asked `/api/friends`, the late answer above). Seen in 3 of 20 desktop runs. A fix belongs in `ban-gate.ts` (e.g. answer a
  just-ended banned token the ban for a short while).
- **The app asks the API behind the ban screen:** account-driven requests (friends) still go out while only the ban screen shows.
  Each gets the ban answer: harmless, but traffic from a banned device.
