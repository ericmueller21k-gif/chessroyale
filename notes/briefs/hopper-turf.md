# Chub & Chirp: Turf (Nov 22). Phase A: mockup (Opus, high). Phase B: build (Opus, xhigh, a later brief).
**Eric, Nov 22:** "his board will have a unique thing ... this does not play in Battle Tower, so totally disabled ... when you go to a tile
... it becomes your tile ... like how the ride works for him in the town, how it leaves like prints behind ... or it changes colors ...
each person starts out with 16 ... you can take ones that are already taken by your opponent. They just switch colors ... let's just
stick to the hard numbers ... every few turns ... his sprite drops down on the board and jumps around on a few tiles and then claims
those ... always jumps on like 3 tiles that are already his, and then he jumps on either one of yours or one that's empty ... most of the
time ... empty, except when there's none left." Then: "everywhere but the battle tower." And on what turf earns him: "if he gets a
certain percentage of the board, then ... as long as he maintains it, then his pawns can move an extra, like, they can move 3 from the
start or 2 anywhere else ... when it gets above the next threshold and it stays there, ... cuts down on the time that we get ... the
third is the final one, which is like he just gets double moves every turn ... if that's something that's easy to change later, we
could build everything else out, and then those I might have to adjust."

## The design (agreed; numbers in settings, tunable)
- Squares: each side starts with its own 16 (ranks 1-2 / 7-8); 32 open. A square becomes a side's when one of its pieces ends a move
  there (captures, castling's both pieces, promotions, his hop and bounce landings, prize pieces dropped in). Shown: his squares a soft
  tint of his colors with a faint paw print (the town ride's print), yours your side's tint, open plain. Never hides the board's
  coordinates, the last move, check, legal-move dots or carrots.
- The count, discreet but visible, on his row of the boss bar: "Chub 22 · You 18 · Open 24" (hard numbers).
- Chirp's hop-around: every `turfHopEvery` (4) of his turns, at the start of his turn, his sprite drops onto the board, hops on 3 of his
  own squares, then lands on an open square (else one of yours) with no piece on it and claims it; free (then his move).
- His holds (each while he holds at least that many squares at the start of his turn; tunable, the sim sets them; start at 32 / 40 / 48):
  1. **Long legs:** his pawns may step 2 from anywhere and 3 from their start square (all squares passed empty; no capture that way, no
     en passant from it, no promotion by a 2-3 step unless the builder proves it safe).
  2. **Short fuse:** your move time cut (by a third, tunable) while he holds it.
  3. **Double hop:** he plays two moves a turn (a passed turn between, as Hollow's passTurn); never a first move that gives check.
  The player has no holds of their own: their counterplay is taking squares back (the director's call; Eric may change it).
- Not in the Battle Tower (off for a tower floor entirely: no tints, no count, no hop-around, no holds).

## Phase A (this job): a mockup only, no game code
Stills (phone 390x844 and computer 1280x800): (1) a mid-game board with tints, paw prints and the count; (2) Chirp mid hop-around;
(3) the boss bar showing a hold active (how does the player know "Long legs" is on? a small badge by the count, with a tooltip/tap
text). Build them as code-built frames from the existing palettes and sprites (no new art), in a throwaway preview (not merged). Deliver
on orphan branch `stills/hopper-turf-mockup` plus a 10-line note of your choices; push `.done` there. The director shows Eric.
