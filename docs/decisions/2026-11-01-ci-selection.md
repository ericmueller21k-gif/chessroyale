# CI: a PR's e2e specs from what it changes; one main run at a time (Nov 1, 2026)

**Eric approved the Nov 1 audit's fixes** (72% of PR e2e runs ran all 5 shards, 34 minutes; 33 of 164 main runs overlapped).

**What changed:** `settings.ts`, `core/boss.ts`, `e2e/helpers.ts`, `net.ts`, `solo.ts`, `main.tsx`, `OwnBoard.tsx` and `account.ts` are traced (`e2e/areas.json`, `traced`): the top-level declarations the diff changes, then the files that use them, each counted as changed. A change it can't place, a shared foundation among the users, or `App.tsx` (a hub: it hands matches and the account to every screen) still runs everything. Main's e2e and `check` run one at a time, the newest push waiting; a run's summary lists the merges it covers. Replayed on the 145 PRs merged since Oct 18: 75 ran everything, now 58.

**Calls:** one level of users, like the table itself (a file's area stands for what that file does); App.tsx as the one hub; no parser (plain text, about a second; a file it can't read runs everything). The failure check (every e2e failure since Oct 18) found four breaks the table missed on the PR that caused them, so home's area now also runs `age-gate`, `kill-switches`, `landing` and `live-window`, the boss select's runs `alfil` and `hopper`, and the stylesheet's and profiles' run `chat`. Details: `docs/areas/ops.md`, "CI e2e".
