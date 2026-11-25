# Boingo's pie: the splat before a freeze says so (Nov 20, 2026)

- Eric (Nov 20, Battle Tower floor 2, Boingo + Smudgy): "the clown threw a pie and it froze my piece? ... It didn't work like that for the first few times."
- What happened: his own rule (Nov 12, "2 splats on the same piece make it frozen for a turn"). The e4 pawn took its second splat and froze; the d4 smear is d4's first splat; the blots on d3 and f3 are the pie's two halves (cream, crust bits, a cherry), not Smudgy's paint (his is yellow). No rule or art mix-up: a seeded run of Boingo with Smudgy (both orders), Gingerbread and Moo froze only on a second splat, and each boss's board layer draws only his own part (`Boss.tsx`, `partsOf`).
- The cause of the surprise: the first splat's banner ("Splat on your pawn") never said a second freezes. Now it does: "Splat! One more freezes your pawn" (`pieLine`, Boingo.tsx). Nothing joins `BATTLE_TOWER.apart`.
