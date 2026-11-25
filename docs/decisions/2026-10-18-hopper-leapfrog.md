# Chub & Chirp's Leapfrog in the rules: the hop, then his move (Oct 18, 2026)

A new raid boss: Chub the rabbit riding Chirp the grasshopper (Eric, Oct 18; code id `hopper`; the name in one constant,
`HOPPER_NAME`). This builds their passive, Leapfrog, in the rules, the protocol and the simulator. Their ultimate isn't
decided yet, and their art (sprite, animations, sounds, lines, select tile, FAQ words) is the art lane's, later; until
it's wired in they're **hidden from players**. How it works now: [docs/areas/bosses.md](../areas/bosses.md) (their row);
the calibration: [reports/hopper-sim.md](../../reports/hopper-sim.md).

## What Eric decided

- **Leapfrog:** "the first 2 times one of his pawns stands nose to nose with one of yours, his pawn hops over it to the
  empty square beyond, with a line."
- **Agreed (Eric):** "a hop never lands on the last rank (no instant queen)." Under A his move follows the hop at once,
  so the review found a hop onto the rank before it was an instant queen too; the rule now keeps the hop off both (and
  off freeing a pinned pawn to promote): Eric's rule enforced, not changed.
- **Left to the sim (Eric, Oct 18):** "He still makes his move, unless it's too strong. Let the sim figure it out. Likely
  could be 3 hops in total if it uses a turn." The director's rule: variant A (the hop at the start of his turn, then
  his move; at most 2) if he lands in the pack, else B (the hop is his move that turn, as Alfil's fusion; at most 3).
- **The name (Eric, Oct 18):** "Chub & Chirp" (Chub the rabbit, Chirp the grasshopper; Chirp does the hop). The id
  stays `hopper`.

## The hop comes first, then his move (variant A)

- **Why:** A lands in the pack: the crowd scores **0.31** (± 0.08, 26 battles) in **40** crowd moves, inside the band
  (about 0.08 to 0.55, battles of 33 to 57 moves), re-run with the review's fix (no hop onto the crowd's 2nd rank; the
  same 0.31 before it). B is far out the other way: the crowd scores **0.77** (± 0.07), 18 of
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
  - **no instant queen** (Eric's rule; his move comes straight after the hop, with no crowd turn between them): never
    onto the crowd's back rank (`lastRank`, Eric's words), nor the rank before it (`nextToLast`: from there his move
    would queen before the crowd moves; the review's line, 1.e3 e5 2.a3 e4 3.a4, a hop to e2, then exd1=Q or exf1=Q),
    nor one that frees another pawn of his to promote (`promote`: its landing square blocks a pin on a pawn of his on the
    7th, a promotion his move didn't have before the hop);
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
  No engine's answer (no host, an older app's move, ""): the first. In the sim, 1 hop in 39 had a choice.
- **The God King's strike** isn't touched: the hop isn't his move, so a strike staggers the move after it, as ever.
- **Fair play:** the crowd's turn right after a hop doesn't count (`powerTurn`), as for every power that changes the
  board.
- **Nothing limits anyone's moves:** no `bossStops`, no `crowdFilter`, no refusal words.

## My calls

- **One principle for what a hop may give him.** The crowd gets no turn between the hop and his move, so the two act
  as one. **No hop gives him something decisive the crowd can't answer:** a mate in one (`mate`) or a promotion
  (`lastRank`, `nextToLast`, `promote`). **Ordinary tactics are allowed** (a pawn that hits a piece, a fork, a line it
  opens): his move right after can cash in one thing at most, as any move of his can, and the crowd moves before he can
  cash in the rest. The test switch's own start is the ordinary case: the hop e5-e3, then exd2+ or exf2+, a pawn for a
  pawn with check. The same line as Eric's two rules on it: "no instant queen", and the Slam's "It never leaves you
  mated in one because a piece is airborne". A mate or a promotion he already had doesn't stop a hop (the hop didn't
  make it). It doesn't rest on the crowd seeing the hop coming: the rule can be known (a pawn of yours nose to nose with
  his, the square beyond empty), but nothing on screen marks such a pawn yet (the art lane's hint), and the judge doesn't
  know the rule (below). In the sim (A with the fix, 52 battles) these guards stopped hops (pawn-turns): the rank before
  the back rank 189, the mate in one 3, freeing a pinned pawn none (a unit test builds one).
- **Known: the judge doesn't know Leapfrog**, as it doesn't know Alfil's marks. The crowd's move that makes or keeps a
  nose-to-nose pair is scored as if no hop will follow, so the judge's best move can walk into one. The crowd's turn
  right after a hop already doesn't count for fair play (`powerTurn`); the move before it counts, judged without the
  hop. Not changed here (as for Alfil's marks); worth keeping in mind for the art PR's hint and the FAQ.
- **His offset: −250**, in the pack's range (−100 to −250), re-checked after the review's fix on the same seeds. Both
  ends land: 0.31 at −250 and 0.37 at −100 (40 and 41 crowd moves), within one standard error, and their order flipped
  from the first round (0.31 and 0.23 before the fix): at the sim's tier both slip 25% and differ only by UCI_Elo 1350
  against 1500, so the sim can't tell them apart. −250's score is the middle of the band (0.31; the middle is 0.315)
  and the fix didn't move it; its battles are inside the band, as −100's; and it's where the bosses whose powers gain
  them something outside their moves sit (Big Boy, Sawyer, Wrangler, Alfil).
- **His ultimate holds a place:** the roster needs one, so `hopperult` stands in (power words "ultimate to come"); his
  rules have no ultimate (it never comes, `?power=hopperult` included) and his meter is off (`BossRules.meter` gives
  none: the screens show no meter, nothing fills, no "RAGE!"). The admins' test trigger refuses (`BossRules.noUltimate`)
  and their "Trigger ultimate (testing)" button isn't shown for them: a press used to read "Ultimate next turn
  (testing)" and stay grayed out for the rest of the battle, waiting for an ultimate that can't come. The ultimate's
  hooks go in `hopper.ts` when Eric decides (he likes "Grasshopper Stampede": every nose-to-nose pawn hops at once, up
  to 3); `noUltimate` goes then.
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
