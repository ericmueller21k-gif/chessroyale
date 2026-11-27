# Two flakes on main ec5b415 (run 46027626554), fixed at their causes. Opus high, targeted (tests or the app, whichever is the cause)

Read `notes/briefs/rules-common.md` first. Branch `claude/flakes-ec5b` from `origin/main`. Both failed once and passed on the retry
(main's rule: a retry-pass is red). The run's merge (#1014) only touched comments and one condition in Crates.tsx: neither is its cause.
1. **shard 2, `[phone] e2e/moo.spec.ts:158` "Moo & Moon: a moonbeam…"** at `:258`: `expect(t.stunned).toEqual([])` got
   `["f1","g2","b1","c1","e5"]` (Expected -1, Received +7: more lines than shown). The stun should be gone after your turn.
2. **shard 10, `[desktop] e2e/global-chat.spec.ts:46` "chat is off by default; turning it on…"** at `:88`:
   `field(ann).fill("hello everyone")`: the field stayed `disabled`, placeholder "Chat is off", for the whole 180 s test timeout. So chat
   never turned on for Ann (or turned back off). Note #1012 (Nov 27) added a first-visit Welcome Crate notice for signed-in accounts on
   home (`asSignedIn` closes it unless `welcomeNotice: true`): rule it in or out (a notice in the way of the chat's own notice or its
   Turn on tap, two notices at once, its seen-flag write racing the chat setting's write on the account).
The traces are in the run's artifacts (`e2e-report-shard-2`, `-10`; the GitHub MCP `actions_get` `download_workflow_run_artifact`
gives a URL; failed attempts keep their trace). Find each cause (a real app race is a real bug: fix the app; a test that reads too early or
assumes CI's speed: fix the test, never a longer timeout as the fix unless the wait is truly the server's). Reproduce each where you can
(CPU slowed, `--repeat-each`), show the fix holding. Lessons in `.claude/LESSONS.md` only if a new rule. `.pr-body.md` (at most 40
lines: cause, fix, changed checks old → new), `.done`. Commits end only with the Claude-Session line.
