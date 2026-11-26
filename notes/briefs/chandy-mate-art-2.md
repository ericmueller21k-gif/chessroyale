# Chandy's checkmate Dodge: the art, phase 2 (Nov 26). Opus high. Characters lane. Branch `claude/chandy-mate-art` (has phase 1).

You are the `characters` delegate. Phase 1 (on `claude/chandy-mate-art`, f9d61141: `packages/app/src/characters/chandy-mate.ts`,
`CHANDY_MATE`: jump, land, slumped, reach<dir>, zap<dir>, out, ko; storyboard on `stills/chandy-mate-art`) was approved by Eric ("Yep,
looks good"), with one change from the director: **the collapse must clearly read as collapsed** (today `land`/`slumped` sit only a
little lower): down on his belly or knees, head hanging, rifle slipping off his shoulder, a beat of stillness; keep his palette and size.
The rules are merged on main (#973): `dodgeTimeline().beats` has the `opening` steps (pause 1.0 s, jump and collapse 1.2 s, reach 0.8 s,
zap 0.7 s, line 2.4 s) and `win` (2.2 s after the last round); the screen draws them in `DodgeView` (phases `mate` with `step`, `win`;
`.cd-root.cd-p-mate.cd-s-<step>`, `.cd-p-win`) using his old `stow`/`point`/`fire` poses as placeholders.

Do: merge `origin/main` into the branch; redraw the collapse; wire the phase-1 poses to the beats: in step `jump` he leaves his spot and
lands on the board's center (a CSS arc, as the storyboard), then `land`→`slumped`; `reach` toward your king (`nearestReach` picks the
angle, mirrored for a king on his left); `zap` with the bolt to your king (reuse the Lock-on Shot round's look); during `line` he holds
the reaching/slumped pose; in `win` the `out`→`ko` knockout on the board's center under the hero banner. Nothing else on screen moves
(eric.md). Watch it frame by frame with real taps once (`npm run frames:character` or the scratch spec #973 used; `?boss=chandy&win=1`
mates him on your first move), phone and computer. Checks: Chandy's e2e mate test sees each pose's class at its step; the characters
test covers the redrawn collapse. Push 3-4 stills and a short GIF of the whole opening (phone) to `stills/chandy-mate-art` (never under
docs/). `.pr-body.md` (what, player-visible, checks changed old → new), a 5-line decision note. Boss lane (art wiring): one quick review
pass follows. About 1.5 hours. At the end commit and push `.pr-body.md` and an empty `.done` (remove phase 1's `.done-storyboard`), stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English.
