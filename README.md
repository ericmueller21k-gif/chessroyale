# Birdie's build stills

Part 1 (`claude/birdie`): the warning, the ride, Armored Birdie, phone and computer.

Part 2: his fall timed to his ult's piece: `phone-fall-line.png` (his line in the wait, 5 s in), `phone-fall-impact.png` and `desktop-fall-impact.png` (the approved third pass's impact, on the piece's drop, 15.1 s in).

Fix round (#896 review): `phone-warning-r2.png`, the warning on a phone on the built branch: the crossing is the board's layer under the
pieces (canvas z-index 1, the pieces 2, nothing between them making a layer), so the warned pawn on a3 stands whole on its crossbuck.
`e2e/birdie.spec.ts` now checks it by pixels (0.97 of the piece unchanged by the crossing; 0.55 when the crossing is forced over).
