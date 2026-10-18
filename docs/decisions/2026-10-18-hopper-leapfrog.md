# Chub & Chirp's Leapfrog in the rules: the hop, then his move (Oct 18, 2026)

A new raid boss: Chub the rabbit riding Chirp the grasshopper (Eric, Oct 18; code id `hopper`; the name in one constant,
`HOPPER_NAME`). This builds their passive, Leapfrog, in the rules, the protocol and the simulator. Their ultimate isn't
decided yet, and their art (sprite, animations, sounds, lines, select tile, FAQ words) is the art lane's, later; until
it's wired in they're **hidden from players**. How it works now: [docs/areas/bosses.md](../areas/bosses.md) (their row);
the calibration: [reports/hopper-sim.md](../../reports/hopper-sim.md).

## What Eric decided

- **Leapfrog:** "the first 2 times one of his pawns stands nose to nose with one of yours, his pawn hops over it to the
  empty square beyond, with a line."
- **Agreed (Eric):** "a hop never lands on the last rank (no instant queen)."
- **Left to the sim (Eric, Oct 18):** "He still makes his move, unless it's too strong. Let the sim figure it out. Likely
  could be 3 hops in total if it uses a turn." The director's rule: variant A (the hop at the start of his turn, then
  his move; at most 2) if he lands in the pack, else B (the hop is his move that turn, as Alfil's fusion; at most 3).
- **The name (Eric, Oct 18):** "Chub & Chirp" (Chub the rabbit, Chirp the grasshopper; Chirp does the hop). The id
  stays `hopper`.

## The hop comes first, then his move (variant A)

- **Why:** A lands in the pack: the crowd scores **0.31** (± 0.08, 26 battles) in **40** crowd moves, inside the band
  (about 0.08 to 0.55, battles of 33 to 57 moves). B is far out the other way: the crowd scores **0.77** (± 0.07), 18 of
  26 battles theirs, in 49 moves: a hop that's his whole turn, forced whenever a pawn can hop, costs him more than it
  gains. The table, the refusals and the runs: [reports/hopper-sim.md](../../reports/hopper-sim.md).
- **At most 2 a battle** (`hopMax`), Eric's number for A; one a turn.
- **B's code is gone:** the sim ran both on one commit (eb678d7, B behind a switch); once B was turned down the switch
  went with it, so only one way is built, tested and kept. A plays exactly as in the sim.

## The rules (`packages/chess/src/bosses/hopper.ts`)

- **When:** at the start of his turn (the crowd has just moved), before his move, as Big Boy's bounce and Alfil's cast:
  the runner's `hopDue`, the lobby's `requestHop`, solo's `hopTurn`. Automatic: when a pawn can hop, it does.
- **Nose to nose:** the crowd's pawn on the square directly in front of his pawn (in his pawn's direction). Another
  piece in front, or a pawn of his own, isn't. The square beyond must be empty.
- **Never an illegal position** (`hopOptions`, each checked on the board, a reason for each refusal):
  - never onto the crowd's back rank (`lastRank`);
  - never with his king attacked after it: a pinned pawn (`pinned`); **in check as his turn begins, no hop** (`inCheck`:
    it waits, and he answers the check with his move), as Alfil's fusion waits;
  - never giving check, by the pawn or by a line it opens (`check`): he moves next, and the side not to move can't be in
    check;
  - never leaving him without a move or ending the game (`noMove`), and only positions the engine plays;
  - the en passant square cleared after a hop (the brief's rule: a capture his move could have made onto it goes too),
    the fifty-move count from zero (a pawn moved, as Alfil's `editedFen`), castling and the move number unchanged (he
    still moves: no move was played);
  - **a base on the board at the hop's ply** (no move added), as Alfil's fusion: every replay plays from it, and a
    repetition counts from it (`gameEndWith`).
- **Several can: the engine's pick** (`hopFrom`): each position after a hop (him to move) searched at `hopNodes`
  (30,000), the one with his best expected score, equals in square order. One alone: no engine needed, it hops at once.
  No engine's answer (no host, an older app's move, ""): the first. In the sim, 1 hop in 40 had a choice.
- **The God King's strike** isn't touched: the hop isn't his move, so a strike staggers the move after it, as ever.
- **Fair play:** the crowd's turn right after a hop doesn't count (`powerTurn`), as for every power that changes the
  board.
- **Nothing limits anyone's moves:** no `bossStops`, no `crowdFilter`, no refusal words.

## My calls

- **Never a hop that gives him a mate in one he didn't have** (`mate`). The crowd never sees the hop before his move
  (it's a free move before his own), so a hop that opens a line for a mate would end the battle with no answer; Eric's
  rule for the Slam is the same idea ("It never leaves you mated in one because a piece is airborne"), and Alfil's first
  build had it while the crowd couldn't see the fusion coming. A mate he already had doesn't stop the hop (the hop didn't
  make it). It stopped a hop 3 times (pawn-turns) in 26 battles.
- **Not added: a rule against a hop that forks or attacks your pieces** (Big Boy's and Alfil's "never more left
  hanging"). Unlike Alfil's fusion square, the hop is predictable: you see which of your pawns are nose to nose with his
  and the empty square beyond, so the threat is in plain view on your turn. The sim measured the rule as the brief has
  it.
- **His offset: −250**, in the pack's range (−100 to −250). Both ends land (0.31 at −250, 0.23 at −100, within one
  standard error: at the sim's tier both slip 25% and differ only by UCI_Elo 1350 against 1500). −250 sits nearest the
  middle of the band in score and battle length, and with the bosses whose powers gain them something outside their
  moves (Big Boy, Sawyer, Wrangler, Alfil).
- **His ultimate holds a place:** the roster needs one, so `hopperult` stands in (power words "ultimate to come"); his
  rules have no ultimate (it never comes, the test trigger and `?power=hopperult` included) and his meter is off
  (`BossRules.meter` gives none: the screens show no meter, nothing fills, no "RAGE!"). The ultimate's hooks go in
  `hopper.ts` when Eric decides (he likes "Grasshopper Stampede": every nose-to-nose pawn hops at once, up to 3).
- **The test switch** (`?boss=hopper&wip=1&power=leapfrog`, solo, Boss alone, as Alfil's was): the battle starts from
  1.e4 e5 (crowd White; 1.e4 e5 2.Nf3 when the crowd is Black, `?side=b`), the crowd to move. Whatever the crowd plays
  first, his pawn stands nose to nose with an empty square beyond as his first turn begins (no first move fills it, pins
  it or lets the hop give check: a unit test plays every one), so the hop comes on his first turn. Leapfrog's own rule
  ("whenever nose to nose") has no schedule to bring forward, so the switch sets the board instead.
- **His moment's length: 1.6 s** (`HOPPER_BEATS.hop`: the pawn lifts at 0.3 s, is over the crowd's pawn at 0.6 s,
  lands at 0.9 s), a screen of its own before his move, as Big Boy's bounce. It holds its time and draws nothing until
  the art lane builds it (`components/Hopper.tsx`), so the server's timing is already his.
- **Hidden until his art:** `kit: null`, so `isPlayable` keeps him off every menu, out of random picks, public queues and
  lobbies; the test link meets him (`wip=1`, `bossUnfinished`). No FAQ block until he's playable (`faq.test.ts` asks
  only playable bosses for one), as with Alfil's rules PR.

## The protocol (optional fields only; an older app ignores them)

- `NetBossPowers.hop`: his last hop, `{ at, from, over, to }` (`at`: the crowd move it came after); null before any.
- Event `hop` (`PowerEventKind`): at the start of his turn, with that turn's events (`squares`: from, over, to; `square`:
  where it landed). An app from before Alfil's PR would throw on an unknown kind, but it can't meet him: online he can't
  be picked (hidden), and his test link is solo. Apps since #267 pass over a kind they don't know.
- The boss request's `hop`: the positions after each hop he could make (him to move); the host answers the one picked
  (`hopFrom`) or "". An older app ignores it and answers a move, which isn't one of them: the first hop. The lobby's
  `bossKind` "hop" times out as Alfil's steps do (no answer: the first).

## What the app needs (the art lane)

- **The moment:** `hop`, at the start of his turn, its own screen (`own`: the last event is `hop` and `hop.at` is the
  crowd's moves), `POWER_FX.hop` 1.6 s, then he thinks and moves. Cues: `HOPPER_BEATS.hop` (`liftAt` 300, `overAt` 600,
  `landAt` 900, `total` 1600): Chirp's pawn arcs from `from` over `over` to `to`; the board until `landAt` should show
  the pawn on `from` (the state already has it on `to`, as Alfil's `alfilFen` handles for his moments).
- **The line:** the kit's `power` line, said as the moment begins (`BossUi` default), Chirp's or Chub's voice.
- **The roster:** his kit's name in his `BOSS_ROSTER` line makes him playable (with his FAQ block in the same PR).
