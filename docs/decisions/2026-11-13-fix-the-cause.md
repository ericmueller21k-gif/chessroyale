# Fix the cause, not add a checker (Nov 13, 2026)

Eric, Nov 13: "whatever process you're doing for whether it's reviewing, whether it's analyzing what you've done, whether it's bug
testing... we need to review the process, and if things are being caught in certain cases, then it's probably a good thing to keep
that in. But... if we continue to have the same bugs and the same issues over and over again, then the answer is not to throw in a
checker that checks for those and finds it. The answer is to figure out the root cause."

- A standing rule, now in CLAUDE.md. The director reviews each step by what it caught; steps that catch real problems stay.
- Recurring problems get a root-cause fix (why does it keep happening?), not a new check stacked on top.
- Same day, effort: the cap stays `xhigh`, never `max` (Eric: "I just didn't want it above extra high... it's probably worth it").
- Delta reviews stay: on Nov 13 they caught real problems (#677/#678: the bots' mate in one couldn't work online; #683: D1 holding
  up his move, the digest missing most of the US day).
