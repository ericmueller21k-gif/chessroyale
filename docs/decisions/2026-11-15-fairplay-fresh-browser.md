# The ban test's fresh browser is a browser of its own (Nov 15, 2026)

- **What failed:** `e2e/fairplay.spec.ts`, "a ban means you can't sign in", passed only on its retry on main and PRs since Nov 14
  (both projects): after "a fresh browser", `/` showed the ban screen or a guest home, not the sign-in.
- **Why:** the test cleared the cookies and storage of the tab still open on the ban screen. That tab had requests on their way; an
  answer to one sent before the clear (the ban answer: the browser's mark and `brc.banned`) landed after it and marked the browser
  again, as it should. Locally, no trace: 1 in 20 runs on each project; with a trace, 0 in 40 (a trace slows the page enough to hide
  it, so CI's traced retry always passed).
- **The call:** a fresh browser is its own context (`browser.newContext`), and the open tab is closed first. No check changed or
  removed. It is a guard test of Eric's Nov 13 rule (`docs/rules/eric.md`): the setup changes, so it needs Eric's OK.
- A server race found on the way (a request with a just-ended banned session is served as a new guest) is left to the director:
  ban code, the full lane.
