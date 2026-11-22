# Chub & Chirp: Pawn Bounce (Nov 22). Opus, xhigh. Boss lane.
**Eric, Nov 22:** "he should hop down and take one of your pawns ... if you do a double pawn move ... once per game he'll take your pawn
that was moved 2 spaces and he jumps it and he hops it back 1 space ... this one he could also use in the battle tower."
(Odds toned down separately: PR #880. Turf is a separate, later job: notes/briefs/hopper-turf.md.)

## Rules (the director's calls; record them in the decision note)
- **Once a battle, everywhere he plays** (solo, online raids, the Battle Tower). The first time the crowd/player pushes a pawn two
  squares, at the start of his next turn (before his move, as Leapfrog: packages/chess/src/bosses/hopper.ts), Chirp hops down and knocks
  that pawn back one square (e4 → e3); then he plays his move. Free (not his move), as Leapfrog.
- Skipped (waits for the next double push) when: the square behind isn't empty (it always should be), the knock-back would leave either
  king in check or change whose king is attacked illegally, or Leapfrog hops that same turn (one power a turn: the bounce first if both).
- The en passant square goes with it (cleared). Leaves a base at its ply as every hop does (replays, repetition), never an illegal
  position; the engines (Stockfish and the judge) see the same position.
- His brain: no choice to make (it's automatic), but the crowd's judge and the race brain must see the position after the bounce.
- Settings in BOSS_POWERS (`bounceMax: 1` or similar, commented). It's a power: the boss kit's checks apply (boss-kit.test.ts).
## Presentation (reuse first: Eric, Oct 14 "simple beats flashy")
- Chirp's existing hop animation (characters/hopper.ts `leapfrog`) carries the pawn back: reuse its beats where it can; a banner
  "BOUNCE!" in his banner style; one line (the app's lines file) and the hop sound. Check Wrangler's/the Pig's pawn moves for reusable
  pieces (packages/chess/src/bosses/pig.ts, base.ts) before writing new.
- FAQ block (BOSS_BLOCKS.hopper) gains the rule in one line.
## Tests
Boss kit + unit tests (the bounce, each skip, once a battle, en passant, replays) + one e2e check in the hopper spec (a double push,
the bounce on screen, the pawn one square back). Frame-by-frame check of the animation (`npm run frames:boss`). Stills: one phone, one
computer, mid-bounce.
## Deliver
Branch `claude/hopper-pawn-bounce` from origin/main. Docs: docs/areas/bosses.md (≤5 lines), decision note (≤10 lines). When done and CI
green: `.pr-body.md` (title line 1) and `.done`, pushed. Stills on an orphan branch `stills/hopper-pawn-bounce`.
