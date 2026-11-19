# Two e2e flakes on main (Nov 19: runs of e8d8305 and 70df93d, each passed on retry). Opus, medium. Light lane (tests only, unless the cause is in the app)

CLAUDE.md: a flake is fixed at its cause, never hidden. Branch `claude/flakes-claw-funhouse` from main. Read `.claude/LESSONS.md`.
1. **`e2e/claw.spec.ts:95`** (phone, the claw machine in Boingo's Funhouse): after "Open now", `.claw-machine .reveal-card` never
   showed in 30 s on the first try (line 170). PR #815 changed ShopRoom.tsx (the keeper's tag name, a sign's ink, the clerk's Talk
   link); check whether any of it touches the claw's crate opening, else find the timing cause.
2. **`e2e/boss-powers.spec.ts:515`** (phone, Boingo's funhouse at every angle, upside down): the promotion picked `c7c8q` where the
   test meant `c7c8r` (line 387): the promotion choice tapped on a rotated board landed on the queen. Find why (the picker's position
   under the funhouse's angle while it animates? a tap before it settled?). If a player could pick the wrong piece the same way,
   it's an app fix: say so plainly.
Prove each with `--repeat-each` before (if it reproduces) and after. `.pr-body.md` (under 25 lines, changed checks old → new);
a five-line decision note only if a call is made. Done: `.done`; push and end. No PRs, no CI waits. Commits end with the
`Claude-Session:` line only.
