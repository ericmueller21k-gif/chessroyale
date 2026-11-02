<!-- Kept in the repo Oct 31, 2026 so it can't get lost (it lived only in the director's notes since Oct 20). Not built, not queued: nothing is built until Eric says go. Eric's reference picture is kept with the art runner's refs when the art starts. -->

# The beaver builder (Eric, Oct 20 evening, voice): design notes

## Eric's idea
- A beaver in a craftsman's tool belt who loves wood and builds. His workshop is on his side of the board (the top): one
  of each piece (pawn, knight, bishop, rook, queen) slowly being built through the battle.
- **Every 15 s (a real timer)** he gets a piece of scrap wood and puts it, at random, toward one of the pieces. Each piece
  needs a number of scraps: a pawn 2 (shown "0/2"), a queen 10-15 ("excessive"). When one is finished, it's ready and he
  drops it onto the board on his next turn.
- Ultimate: to be decided.

## Director's notes (sent Oct 20)
- The workshop as a strip above the board: five pieces with their progress (0/2 ... 0/12), scraps landing on them.
- A real timer gives him a lot of wood in a long raid (a 25-minute battle at 15 s is ~100 scraps), so the rate, the costs
  or a cap on deploys need the sim; proposed start: pawn 2, knight 4, bishop 4, rook 6, queen 12, a finished slot starts
  over at 0, and the sim sets the rate.
- Deploys: at the end of his turn, onto an empty square of his half; a pawn never on a back rank or a ninth; legal
  positions only.
- Both new bosses use real-time meters, new for the boss framework (turn-based today): one shared building block, and
  the sim needs simulated time per move.

## Ultimate and the filler build (Eric, Oct 20, driving)
- **Ultimate: he gnaws one of your pawns** (gnawing his way round the board, tool belt), eating it; it turns into about
  **8 scraps** for his workshop. No pawn: it does nothing (practically never). "Kind of a fun thing, not too destructive."
- **A filler build** so he doesn't always get a piece: e.g. the pawn at 3 scraps plus a non-piece build; Eric would rather
  not reuse a blocking block ("we've reused a lot"). Director's pick: **a birdhouse** (a dud: it soaks up scraps, he shows
  it off, nothing happens; no new board rules). Alternative: **a hidden snare** (the first of your pieces to step on it
  is stuck a turn; reuses Moo's stun). Which pawn he eats: at random (proposed).
- **Filler build: a beaver token for you** (Eric, Oct 20; replaces the birdhouse idea): when he builds one, the player(s)
  facing him get a beaver token; collect enough and unlock a silly cosmetic (a beaver hat for your pawn), non-tradable,
  "costs nothing but adds a little bit of fun"; a prototype other bosses could get later. Worries: people farming him, or
  idling so he keeps building. Director's proposal: tokens are paid only at a battle's end, only to players who actually
  played (a minimum of moves), at most 1 per battle, and a daily cap; stored on the account server-side (stored data:
  xhigh effort for that part, its own small PR).

## Look (Eric's reference, Oct 20: ref/1-builder.png)
A brown beaver standing upright, big buck teeth, whiskers, a crosshatched paddle tail, a **yellow hard hat**, two crossed
wooden planks strapped on his back, a yellow tool harness and belt with a hammer (red handle), a tape measure, a wrench and
pouches. No name yet (Eric: "no names for either"). Director's flag sent: **Sawyer (the raccoon) already wears a yellow
hard hat**, so the beaver's hat should differ (e.g. an orange or red hard hat, a carpenter's pencil behind the ear, or a
cap); the planks on his back can be used when he deploys a piece.
- Eric (Oct 20): **orange hard hat** (an orange vest is fine too), no pencil; both bosses having hard hats is fine.
