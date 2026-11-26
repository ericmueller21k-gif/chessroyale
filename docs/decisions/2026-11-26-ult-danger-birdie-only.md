# The danger line is Birdie's only (Nov 26)

Eric asked only about Birdie ("his ult is supposed to fire ... It should have detected like he was basically in danger ... a turn or two
at most"). #968 put the line on every boss's meter, the director's own call, never asked. Eric, the same night: "When was that ever said
I wanted that on every boss?" So every other boss is back as before #968: the shared meter fills as it always has (no `dangerCharge`,
no `dangerSpent`), Folio's `creaseDue` as before, the funhouse e2e as before, and the every-boss test and audit
(`ult-danger.test.ts`, `packages/sim/scripts/ult-danger.ts`, `reports/ult-danger*`) are gone. Birdie keeps his Fall in danger
(`dangerAt` 0.70, `fallDangerMoves` 2) and its fix for an unjudged funhouse move. Chandy's in-danger Dodge stays until his checkmate
rework (Eric, Nov 26: his Dodge from his 5 upgrades, and when you checkmate him) replaces it. Lesson for the director: a fix Eric asks
for one boss stays on that boss; widening it is a question for him first.
