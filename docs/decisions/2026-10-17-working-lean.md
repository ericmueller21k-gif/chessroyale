# Working lean: where helpers' usage goes, and an audit only when it's needed (Oct 17, 2026)

**Eric:** "We don't compromise. We don't want to have bugs because we're lazy with things. But we also… want to make
sure that we're occasionally checking things to see if we're going down the wrong path with anything that's… going to
cause just a bunch of bloat in the pipeline of development." And, on an audit agent: "if this agent makes us a net loss
in usage… then probably not worth."

## What the usage is

Measured over the director's 132 helpers through Oct 16 (`.claude/tools/helper-usage.py`):

| The 15 costliest helpers | Each |
| --- | --- |
| Steps (tool calls) | 330 to 740, about 90% terminal commands |
| Written (code, reports) | 7 to 40 thousand tokens |
| History at the end | about 780 thousand tokens |
| Re-read (the history, read again at every step) | 300 to 500 million tokens |
| Alive | 4 to 22 hours |

So a helper's cost is its steps times its history, and the writing is a rounding error. Cached re-reads are cheaper
than fresh ones, but at this size they are still most of the usage. Patterns behind it:
- **Long-lived helpers:** resumed for review round after round, their history never shrinks.
- **Waiting in loops:** 40 to 76 "sleep, then look" steps each, every one a full re-read.
- **Big output kept:** 10 to 40 results over 20 KB each (a whole log or file), carried to the end.
- **Images:** 15 to 35 each, many of them intermediate attempts.

## The call

The rules are in `CLAUDE.md` ("Working lean"):
- a fresh helper with a one-page handoff for a review or fix round;
- one background wait instead of a loop;
- big output to a file, only its tail or a grep read;
- small checks batched.

Quality gates don't change: tests, independent reviews, CI as the gate, effort per task.

**The audit is cheap first:**
- The script reads the transcripts and prints one line per helper. It costs one step.
- An audit helper runs only when a line stands out. It uses the same model (Eric, Oct 7: never a cheaper one) at
  `medium` effort, reads the digests and the flagged moments only, and stays small (about 1 to 4 million tokens re-read,
  against 300 to 500 million for one costly helper).
- It proposes; it changes nothing. The director weighs each proposal, and Eric approves any that touch a quality gate.
- Two audits in a row that change nothing retire it.

**Not done:** an always-on auditor watching every helper. It would cost on every helper to save on a few.
