# Outside review, batch 1: trust in devices (Nov 10)

Read `notes/fable-audit-findings.md` findings 1 and 5 and "Squads and matchmaking", plus part 2's rules-engine items 3 and
6 (branch claude/director-notes). The proof tests `notes/fable-many-seats.test.ts` and `notes/fable-lying-host.test.ts` show
each hole: copy them into packages/server/test/, watch them pass as an attack on main, then turn each into a test that
the attack now FAILS. Pre-launch (main reaches Eric only); fix it right, not fast. CLAUDE.md's computing priorities hold:
devices first, the server when it's truly needed. This batch makes a device's answer count only when it's checked.

## The fixes
1. **One seat per account per lobby** (main lobby `lobby.ts` hello ~:829-866, Squads `squads-lobby.ts` ~:673-714 /
   `squads-do.ts` ~:334-361). A second socket for the same account takes over its seat (as a reconnect does); guests:
   their guest account. Keep reconnects and the seat token working.
2. **Claimed speed** (`lobby.ts` ~:2602, `judges.ts` ~:116, `settings.ts` `speedWeight`): clamp to a sane top in settings
   (e.g. 5M nps), `speedWeight` 1 until speed is measured. Never draw two judges of one round from one account (or one
   party). If measuring the first job is small, do it; else a ROADMAP line.
3. **Host scores** (`lobby.ts` ~:2372-2400): type- and range-check as the judges' path does (`judge.ts` ~:185, `okScore`);
   a pick the host leaves out no longer "counts as the best" (use the same rule as a missing judge answer).
4. **Squads' shared cache** (`squads-lobby.ts` ~:515): store only answers the server checked.
5. **Squads seat token from another account** (`squads-lobby.ts` ~:664): refuse, as the main lobby does.
6. **Message fields:** type-check `bossMove.move` (gardener.ts ~:646 throws on junk) and `botPlan` picks; cap
   `crossCheck` log appends (`lobby.ts` ~:1286). If one small validator at each Durable Object's door is the least code,
   do that (part 2, rules item 6).

Lane: **full** (fair play, the protocol's core, online sync): the director adds the `full-e2e` label and an independent
review follows. Effort xhigh. Unit tests for each (the two proof tests turned around, plus one per fix). Run locally only the
tests you write and the server/chess unit suites you touch; CI runs the rest. Update docs/areas/ (matchmaking, crowd,
squads, fairplay, engine as touched). Decision note docs/decisions/2026-11-10-device-trust.md (≤ 120 words). PR body: what
changed, changed checks old → new, anything you chose not to do and why. Push to claude/fable-b1 at each real step; when done
write .pr-body.md and push. Don't open the PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
