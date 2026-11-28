# Town structure, phase 0: stop losing the saved town on every deploy. Fable (Eric asked for Fable on the town), high. Targeted lane.
# Runs after the card-flake helper finishes (one big helper at a time).

Read `notes/briefs/rules-common.md`, then `DESIGN.md` on `origin/claude/town-architecture` (Fable's audit, Nov 28: finding 2 and phase 0).
Branch `claude/town-phase0` from `origin/main`. Push at each real step.
1. **The saved pictures' key:** today it starts with the build's commit id (`Town.tsx` ~2967, `keep-pictures.ts` ~160), so every deploy
   throws the saved town away and the next visit repaints everything (10.1 s instead of 4.4 on the slowed phone; 3.1 instead of 1.4 on a
   computer). Key it by a fingerprint of the town's art instead, made by the build from the town's own modules (the bundler's list of
   the modules the town's pictures come from, hashed), so a deploy that doesn't touch the town's art keeps it, and one that does repaints.
   Also the box tops' key (`brc.townTops`) the same way. Show it: the same code built under two commit ids keeps the saved town; a change
   to a house's art repaints it.
2. **The edge chips' faces** drawn once a place, not cleared and redrawn about 8 times a second while walking (`Town.tsx` ~2228).
3. Measure before/after "after a deploy" (Fable's method: the same code built under another commit id, same browser profile), slowed
   phone and computer. No pixel of the town changes. Load first, then show (`rules-common.md`).
Five-line decision note, area page update. Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, stop.
