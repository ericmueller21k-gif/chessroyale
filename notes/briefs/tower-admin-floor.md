# Admins: jump the Battle Tower to any floor (Eric, Nov 28 ~01:20 UTC). Opus, high. Targeted (admin only; server route)

Read `notes/briefs/rules-common.md` first, then `docs/areas/battle-tower.md` (runs: `tower_runs`, `fight`, `last`, `status`, kinds solo and
party; the clerk's card) and the Settings screen's admin section (`screens/Settings*.tsx`: "For testers (admins)"). Branch
`claude/tower-admin-floor` from `origin/main`.
Eric: "on the admin, just put it in the actual settings ... give me something where I can punch in a number, and whatever number is
there, it goes to that level on the Battle Tower, because I want to go back to level 9 and then play through to 10 and see how things
look, and then try some different numbers to see how hard it feels."
- In Settings' admin section (admins only; players never see it): "Battle Tower floor" with a number box (1 to the tower's top) and
  **Set**. It sets the admin's own SOLO run to start at that floor next (the clerk then offers Continue: floor N), lives back to full,
  no floor under way. A floor under way: say so and set nothing. Server: an admin-only route (refused for anyone else, checked on the
  server's own admin list), writing that admin's open solo run (creating one if none) the way a normal run is written, never touching
  bests, crates, XP or anyone else's run. Party runs untouched.
- After Set, a short line "Floor N is next: talk to the clerk" (no navigation needed); the clerk's card reads the new floor.
Tests: server unit tests (admin only; sets the next floor; refuses a floor under way; bests untouched), one e2e (an admin sets 9, the
clerk offers floor 9, Continue plays floor 9). `.pr-body.md` (at most 40 lines), a 5-line decision note, the area page, `.done`.
