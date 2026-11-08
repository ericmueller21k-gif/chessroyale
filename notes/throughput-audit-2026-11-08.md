# Throughput audit (Nov 8): why simple UI jobs take hours

Measured from today's five helper transcripts (every Bash call timed), local e2e logs, the machine, and GitHub's API.

## The finding
**Helpers spend ~90% of their time waiting for the local e2e lane, not working.**

| Helper (job) | Wall | Writing code/thinking | Waiting on local e2e (queue + runs) | Other waits |
|---|---|---|---|---|
| Opus: typed chat #550 | 9.0 h | 0.5 h | 4.7 h | 3.0 h |
| Haiku: Timber tap | 7.2 h | 0.1 h | 0.2 h | 6.8 h (10× repeat sweeps) |
| Haiku: result screen #551 | 6.2 h | 0.2 h | 5.3 h (184 polls) | 0.4 h |
| Haiku: Dash clock #553 | 6.2 h | 0.2 h | 4.9 h | 0.7 h |
| Haiku: Locker #554 | 4.7 h | 0.2 h | 3.7 h | 0.3 h |

The runs themselves are short: a typical helper run is 2–8 tests in **1–2 min**. The hours are the queue.

## Root causes, biggest first
1. **One 4-core machine, one lock, five helpers.** Every helper's e2e goes through `flock /tmp/claude-0/e2e.lock`.
   A 1-minute run waits behind whatever holds the lock: the typed-chat helper's 110-test run (21 min), a 76-test
   run, and the Timber helper's `--repeat-each 10 --workers 4` sweeps (30+ min each).
2. **The machine is overloaded outside the lock.** Builds, typechecks and unit tests aren't locked. The load average
   reached 8–13 on 4 cores, and the town camera dropped to ~4 fps. Timing-based tests then fail for no real reason
   (the Timber helper proved it), so a helper reruns, queues again, and loses another hour.
3. **CI, our free and parallel lane, was used only at the end.** GitHub runs are free (public repo). A PR's e2e
   takes **8–26 min** (median 14) in parallel, with no queue between PRs. Helpers never pushed early to let CI test;
   they waited hours locally for the same answer. They also didn't know that CI's failures are readable with no token
   (the check-run annotations hold every failing test's title and error): `notes/tools/ci-fail.sh <sha>`.
4. **Rework rounds.** Three helpers reported work as "done" before checking their own stills: the bubble ran off
   the screen, the love line never showed, and the black pawn was invisible. Each defect was caught at the director's
   review and cost another full round, hours with the queue. Eric's design changes mid-job are legitimate but
   also restart a round.
5. **A PR that touches shared files runs the whole suite (~1,100 tests)** and inherits the intermittent town specs.
   #551's run had 26 failures across town-fixed/town-rows/town-controls/problems that the helper then had to sort
   out. (The flake list is in STATUS; root-cause work continues separately.)
6. **Polling.** Helpers checked a log every ~2 min (the result helper did it 184 times). Each check is a full model
   turn: usage, not speed.

## The fix (in effect from now)
1. **One helper = one cloud session = its own machine.** The director starts each helper with `create_session`
   (model Haiku unless the work needs Opus, `source_url` chessroyale, `source_revision` the branch). It runs e2e
   locally with no lock and no neighbors. Pilot: #551 started Nov 8 03:30 UTC. It was up in 20 s.
   The director watches by PR events and `get_session`/`list_events` (kinds `result`). Children can't message back.
2. **CI is the second lane.** Push early, push often: every push re-tests the PR's areas in parallel. Read failures with
   `ci-fail.sh <sha>`. Big runs, the full suite and repeat sweeps happen only in CI.
3. **The shared machine** (subagents, if used at all) runs local e2e only through `notes/tools/e2e-quick.sh`:
   - ≤15 tests per run;
   - `--repeat-each` ≤3;
   - the lock wait is capped at 15 min, after which it says to use CI;
   - each run is capped at 10 min.
4. **Self-check before reporting.** A helper looks at every still it made, against the brief's numbers (bounds,
   order, counts), and fixes the problem itself before reporting. Number checks go in e2e so CI enforces them.
5. **Stills from a helper on its own machine** go to an orphan branch `stills/<PR#>` (PNGs only, never on the work
   branch). The director fetches them and sends them to Eric, then deletes the branch after the merge, so clones stay small.
6. **Waits:** one blocking call (≤10 min), never short polls. The director keeps fewer helpers' reports in its context
   and starts a fresh session when the context gets big (HANDOFF.md).

## Still to do
- Root-cause the intermittent town specs, so that PR runs on shared files are trustworthy (STATUS has the list).
- Optional: an environment setup script that runs `npm ci` in new sessions (saves each helper ~1–3 min). Needs Eric's
  approval prompt.
