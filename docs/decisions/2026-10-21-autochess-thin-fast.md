# Auto chess: fast once the board thins out (Oct 21, 2026)

## What Eric asked for

Eric (Oct 21), testing the new fights: "we do need to speed up the pieces if there's a certain number, a fewer pieces left.
Like I had one pawn and one rook, he had two knights... it could have been much better for it to go about twice as fast as it
was going. I think it was about move 30, but honestly, at around move 15, it just should have gone about twice as fast."

## What changed

- Moves play at `fightFastMoveMs` (0.3 s, twice as fast) once **5 or fewer pieces are left on the whole board besides the
  kings, pawns included** (`fightFastPieces: 5`), as well as after 30 moves a side and once either side is down to its king and
  pawns (both as before). Eric's fight (a pawn and a rook against two knights) is 4 pieces: fast.
- One check for both the fight's pace and the move counter's "twice as fast": `thinFight(fen, cfg)` in `autochess/fight.ts`
  (the screen had its own copy).

## The numbers (the same 80 fights, `hunchess-fights.ts`; the pace changes nothing about how fights are played or end)

| `fightFastPieces` | average | median | longest |
| --- | --- | --- | --- |
| off (live before) | 14.1 s | 12.0 s | 42.0 s |
| 4 | 13.7 s | 12.0 s | 39.0 s |
| **5 (chosen)** | **13.3 s** | **11.4 s** | **36.9 s** |
| 6 | 12.8 s | 11.1 s | 36.6 s |

The director's call: 5. It cuts the long thin endings (the longest fight 42 to 37 s) while the typical fight stays near the
12 s Eric settled on (11.4 s); 6 shortens typical fights more for little extra off the long ones. Outcomes are identical in all
four runs (39 too far ahead, 17 stalls, 15 bare kings, 7 mates, 2 repetitions; 7 draws). Raw runs:
scratchpad only (not committed).

## Player-visible text

None new: the move counter's existing "· twice as fast" now also shows once the board thins out.
