# Solo abandon (PR #881): the review's fixes (Nov 22). Opus, xhigh. Full lane. Work ON branch `claude/solo-abandon`.
The review: `review-881.md` on branch `review/solo-abandon` (read it whole first). The original brief: notes/briefs/solo-abandon.md.
Fix, in the same PR (push to `claude/solo-abandon`; never force-push):
- **I1 + I2 (important): a finished game must never be recorded as left.** Keep the result on the device (`keepUnsent`) BEFORE
  posting it; clear it only on a 2xx or a 4xx refusal other than 429; keep it on no answer, any 5xx (502 included) and 429, in both
  `recordSoloResult` and `sendUnsentResult`. Add `keepalive: true` to that one POST. Unit tests for each status, and the reviewer's
  scenario (a post left pending, then a fresh load: the result kept, no `settle`, sent again, the game a win, not a loss).
- **N2:** a re-sent kept result (`resent: true`, the device's word: it can only lower) earns no time XP (or no XP at all: your call,
  say which), so airplane mode can't stretch a short game's time.
- **N3:** mark the game real only once the server answered; retry the mark at each later own move while it keeps failing.
- **N4:** a guest merge (accounts.ts ~722) settles the guest's open solo game first (`abandonStatements(current.id, {}, true)` before
  the results move) or at least deletes the guest's `solo_games` row. A test.
- **N1:** no code change: correct the decision note and the area page (a second tab's *start*, a Battle Tower floor included, records
  the first tab's left game: one open solo game per account, by design).
Then: CI green on your last push, update `.pr-body.md` (title line 1; add the fixes and changed checks) and push `.done` again
(delete the old `.done` first in the same push isn't needed: just recommit it with new content). Don't open a PR (it exists: #881).
