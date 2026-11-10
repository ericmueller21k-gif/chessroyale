# Outside review, batch 3: the boss and lone devices (Nov 10)

Read `notes/fable-audit-findings.md` findings 2 and 5 (branch claude/director-notes). Batch 1 (#601) made devices' answers count
only when checked; batch 2 (#610) made what the server pays and records safe. This batch closes the two places where one device
still decides alone. Pre-launch (main reaches Eric only): fix it right, not fast. CLAUDE.md's computing priorities hold:
devices first, the server when truly needed (a reward depends on it, or devices can't be cross-checked).

## The fixes
1. **The raid boss's move is checked** (finding 2, `lobby.ts` ~:1324-1326: the host's `bossMove` is played if legal). Refuse a
   boss move that loses more than the blunder guard by the round's judged numbers (the judges already score the position), and
   play the boss brain's own pick instead (run it where it's cheapest and still trusted: the judges, else the engine server).
   Prove it: the audit's "host sends the boss's worst move each turn" no longer wins in 8 moves. Keep every boss's power and
   personality moves working (bosses deliberately play some odd moves: the guard must allow what each boss's brain would play;
   read `docs/areas/bosses.md` and the boss kit before choosing the rule).
2. **A lone device never stands alone where a reward depends on it** (finding 5): main lobby with under two judging devices
   (`lobby.ts` ~:2372-2400: the host scores every round and sends the bots' picks), and Squads with one human
   (`squads-lobby.ts` ~:2116-2131, ~:2288-2290). Sample the lone device's answers on the engine server (enough to catch a
   lying device within a match), or pay nothing extra for results only one device vouched for. Pick the least code that a
   lying device can't beat; say which and why in the decision note, with the engine-server cost per match.
3. **Squads' rewards get a daily cap** like ranked's (settings.ts, `SQUADS`), so first place's 100 coins and a crate can't be
   farmed.

Lane: **full** (fair play, the protocol's core, rewards) plus the boss kit (`packages/chess/test/boss-kit.test.ts`,
`e2e/boss-smoke.spec.ts`), since boss moves change. The director adds `full-e2e` and an independent review follows. Effort
xhigh. Unit tests for each (the audit's "ran it" cases turned into tests that the attack now fails). Run locally only the tests
you write, the boss kit, and the server/chess unit suites you touch; CI runs the rest. Update docs/areas/ (bosses, the match,
squads, engine, fairplay as touched). Decision note docs/decisions/2026-11-10-boss-and-lone-devices.md (≤ 120 words). PR body:
what changed, changed checks old → new, engine-server cost, anything you chose not to do and why. Push to claude/fable-b3 at
each real step; when done write .pr-body.md and push. Don't open the PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
