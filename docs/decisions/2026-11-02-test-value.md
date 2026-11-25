# Test value: random failures, speed, the CI selection (Nov 2, 2026)

Eric (Nov 2): yes to the test-value review's changes ("save our usage"), but no boss-smoke trim: it's GitHub-side and it
catches things, so every boss stays in it on every PR. Order: random failures first, then speed, then CI selection.

- Flakes fixed at their causes (each commit says its cause): town's reload (service worker), the circus chip, the rides'
  tag; autochess's silhouettes mid-pop; route handlers at a test's end (helpers.ts); chat-mod's "GG" substring;
  lobby-chat's 3-second Solo queue. Recluse's countdown (17429819) and crate-banner's Escape (b1656a35) were fixed already.
- Speed: boss-bar-same measures lines at their first frame, one test per boss; one project where the project changes
  nothing (autochess's fixed-width tests, town-chat-history, solo); a computer runs king-attack's two widest figures and
  one funhouse angle; maia :82 runs three bosses a run, in turn by the day; formats' boss battles merged into crowd-hidden.
- CI: five more traced modules; ci-timings.json refreshed. No check guarding a rule in docs/rules/eric.md changed.
