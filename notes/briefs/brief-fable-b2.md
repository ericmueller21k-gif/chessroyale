# Outside review, batch 2: rewards, accounts and fair play (Nov 10)

Read `notes/fable-audit-findings.md` findings 3, 4, 6, 7 ("Lost results" only), 9 and 10 ("Welcome Crates"), the guest-merge
line near :184, and part 2's tests item 5 (`notes/fable-audit-findings-2.md`), all on branch claude/director-notes. The proof
test `notes/fable-match-end-save.test.ts` shows finding 9's double write: copy it into packages/server/test/, watch it pass as
an attack on main, then turn it into a test that the double write now FAILS. Batch 1 (#601, merged) made devices' answers
count only when checked; this batch makes what the server pays and records safe. Pre-launch (main reaches Eric only): fix it
right, not fast.

## The fixes
1. **Fair play only flags** (finding 3): `FAIRPLAY.enforcement` → `"review"` (settings.ts). The deep re-check picks its own
   candidates (the engine's own top moves), not only the judges' list plus the pick (`fairplay-deep.ts` ~:96). Bans stay
   off until Eric turns them back on (say so in the PR body).
2. **The reviewer token** (finding 6, `fairplay.ts` ~:247-260): it can review, watch and clear; a ban only when the case
   already meets the ban bar. Its answers carry no emails.
3. **The engine server needs sign-in** (finding 4, `index.ts` ~:197-209): `/api/engine/score` and `/api/engine/ping`
   require an account, with a small durable per-account daily cap in settings, and matches get a budget apart from solo's.
   Keep CLAUDE.md's computing priorities: devices first; this only stops strangers spending the server.
4. **A match's end saves once, in one batch per player** (finding 9, `lobby-do.ts` ~:161-204): pass `once` to
   `recordResult`; batch each player's writes; a failed save is retried as Squads does (`squads-do.ts` ~:144-152), not
   swallowed with `resultsSaved` already set (part 2 tests item 5); count failed saves where ops can see them.
5. **Ranked 1 v 1 records retry for hours** (finding 7, `duel-room.ts` ~:132-133, 315-319), not 4 tries in a minute, as
   Squads' 24 hours. Detection for 1 v 1 is NOT this batch (later, with design).
6. **The Welcome Crate counts only server-timed solo games** (finding 10, `welcome.ts` ~:48, `api.ts` ~:627-661). Idle farming:
   leave as is (items aren't traded); note it in the PR body.
7. **The guest merge doesn't pay level rewards again** (`rewards.ts` ~:58-69).

Not in this batch: the shop's direct-buy route while `SHOP_FREE` is on (Eric's call on paid items is pending), 1 v 1 detection.

Lane: **full** (stored data, rewards, fair play, sign-in): the director adds the `full-e2e` label and an independent review
follows. Effort xhigh. If a migration is needed, say so loudly in the PR body (D1 schema). Unit tests for each (the proof test
turned around, plus one per fix). Run locally only the tests you write and the server unit suites you touch; CI runs the rest.
Update docs/areas/ (fairplay, engine, accounts, the match, ranked, the shop as touched). Decision note
docs/decisions/2026-11-10-rewards-and-records.md (≤ 120 words). PR body: what changed, changed checks old → new, anything you
chose not to do and why. Push to claude/fable-b2 at each real step; when done write .pr-body.md and push. Don't open the PR.
Read CLAUDE.md and notes/briefs/rules-common.md first.
