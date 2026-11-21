# Smudgy's hidden rook on a shared floor: masked whoever is to move (Nov 21, 2026)

**Eric (Nov 21, screenshots of a Battle Tower floor of Smudgy and Jefferson):** "Smudgy's showing his rook very clearly here in the
tower. So I'm not sure why it's not hidden." Then: "it shows the rook when it's the giraffe's turn or your turn, not his turn. So you
just need to make sure he's on whatever team he's on that it keeps that same thing."

**The cause:** on a floor of several bosses the view's top level is the boss in focus (the one to move, or the one next after your
move). The screens' mask (`camo.ts` `trackCamo`) read Smudgy's Camouflage from that top level only when it was Smudgy (`boss.id ===
"smudgy"`), so on the other boss's turn, and on your turn before it, nothing was masked: the board, the move list, the hints and the
dock showed the rook. The home page's live window (`lobby.ts` `hiddenRook`) read `state.boss`, the boss in focus, the same way. The
rules (the judge, the move names, the moves you may play) were already the whole side's (`sideEvaluation`, `sideMoveName`,
`sideCrowdAllowed`); only what's drawn was keyed to the focus.

**The fix:** `camoOf` (camo.ts) reads Smudgy's own part of the side (`side.bosses`) whoever is in focus, alone his own as before;
`hiddenTrail` and `trackCamo` use it, so every screen (solo and online alike: both feed the view to `trackCamo`) masks the rook on
every turn. `hiddenRook` reads the side's bosses (`sideBosses()`).

**Hollow's dark, the same class:** his own part carries the dark on every turn, and the play and boss screens draw every part's
board layer, but the reveal after your move (`Crowd.tsx`'s `CrowdReveal`) drew only the focused boss's, so his dark lifted off its
squares while another boss was next. It draws every part now, as the others do. (Hollow and Smudgy never share a floor.)

**Checks:** app `camo.test.ts` (four floors, Smudgy first and not, two and three bosses, played through: the rook a pawn on every
turn and in the history, the view as solo has it and as it reaches a device), `tower-side.test.ts` (Hollow's part has the dark on
every turn), server `smudgy-lobby.test.ts` (the live window with Jefferson in focus), e2e `battle-tower.spec.ts` ("a shared floor
with Smudgy": a pawn on d7 on your turn, Jefferson's and yours again, and no frame drew the rook there).
