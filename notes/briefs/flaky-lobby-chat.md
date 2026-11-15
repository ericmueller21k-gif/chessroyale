# Main red: lobby-chat.spec.ts:28 [phone] (a retry-pass, three runs now): fix the cause, not a checker

Effort high. New branch `claude/flaky-lobby-chat` from `origin/main`. Read CLAUDE.md "Fix the cause…", `.claude/LESSONS.md`, the area page
for the lobby/queue chat (`docs/areas/` README lists them). Game first: is the game wrong, or the test?

`[phone] e2e/lobby-chat.spec.ts:28` "two players in a Default queue chat before the match starts…" failed its first try in three runs,
each at a different step, all right after the bots fill the lobby:
- main 018bd310 (run on the pogo merge): line 76 `expect(await phase(ann)).toBe("lobby")` got "vote".
- #721's run: line 75, the bot's hello line (`.qchat-lobby .qline[data-from^="bot"]`) not visible in 3 s after the count reached 100.
- #716's run: line 15 `box()`, `boundingBox()` null in `queueBoxes` (an element gone).
They look like one race: once the bots fill the lobby (100), the lobby moves on to the vote on its own clock, and the test's next steps
read the lobby screen (its chat, its boxes, its phase) a moment too late on a slow runner. Confirm from the code (the lobby's timing after
it fills, in the server's lobby and the client) and the CI traces if you can get them (artifacts of those runs; GitHub API). Then fix the
cause: e.g. the test holds the lobby before it fills (an existing test switch, or the clock the e2e already controls), or checks the
lobby's things in the order they're guaranteed to exist, never racing the countdown. If the game itself is wrong (e.g. the bots' hello can
come after the lobby has moved on, so a player never sees it), fix the game. Don't widen timeouts to hide it.
Prove: `--repeat-each 5 --retries 0` on phone, and on a slowed CPU (CDP `Emulation.setCPUThrottlingRate` 4) if that reproduces it,
before and after. Typecheck; unit tests you touch. Push at each real step; `.pr-body.md` (cause, fix, checks old -> new); `.done`. No
PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). About 45 minutes.
