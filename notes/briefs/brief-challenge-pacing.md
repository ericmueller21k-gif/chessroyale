# Brief: boss challenge pacing + standing clear of the stools

Worktree `/home/user/cr-pacing`, branch `claude/challenge-pacing` (from main 356dc03: #466 challenge and #467 Big Boy are live).
Opus high. Push as you go.

## Eric (Nov 2, after playing Big Boy's live)
"The animations, everything is great, but it happens so damn fast… It takes only, like, 2 seconds… they both run in, they go
into the house, and then all of a sudden you're in the fight. Stretch that out a few more seconds: slowly walk up to the
chessboard, then say your line, then the tiles drop down, then the seats drop down. Add a little delay between these things.
Not lag, just… it all happens so quick."
"The B and W chair blocks: Big Boy and the pawn need to be a little more away from the table. When those drop in, they're
completely covered by the characters. Either a step back, or when the blocks drop they take a little jump backwards so the
blocks are visible. Make sure they're not standing where the chair blocks are; that looks like bad design."

## Do (all intros: Alfil, Big Boy custom; Babur and Puddles default)
1. **Pacing**, in settings (the intro feel: one place, per-beat numbers): a calm walk in (the town's walking pace, not a run;
   the door, then a short beat inside), a slow walk up to the marks, a pause, the line in the bubble long enough to read
   (~2.5 s), a pause, then each build step with a small gap between (Big Boy: the blocks stack, a beat, the board drops, a
   beat, the stools drop, a beat; Alfil: rise, hold, crack, crumble, a beat; default: the table pops, a beat), then the attack
   swing (~2 s) and the cover. Target ~10-12 s from tapping Fight to the cover (was ~5-6 s). Report the before/after timeline.
2. **Standing clear**: you and the boss never stand on or in front of a stool/chair. Stand a clear step outside each stool
   (marks moved out, or a small hop back when the stools drop: pick what reads best and is simplest; say which). Check every
   intro (Big Boy's B/W blocks, the park table's stools for Babur/Puddles, Alfil's table): the stools fully visible in the
   room's camera on phone and computer.
3. Keep everything else (lines, chat lines, return to town, tokens).

## Done means
Unit tests for the new timeline numbers and that no figure's footprint overlaps a stool. `e2e/boss-challenge.spec.ts` keeps
passing (raise its waits for the longer intro only as needed; list changed checks old → new). Stills: each boss at the table
with stools visible (phone); a GIF of Big Boy's full intro at real timing (one frame every ~0.25 s, the whole length).
PR-body file `docs/challenge-pacing/pr-body.md`. Push; no PR.
