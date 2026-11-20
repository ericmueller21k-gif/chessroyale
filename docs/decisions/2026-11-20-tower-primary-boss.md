# One primary boss for the powers that add pieces on a shared tower floor (Nov 20, 2026)

Eric, Nov 20: "maybe we need a rule where one boss acts as the primary when it comes to certain moves IE hippo and Babur both shouldn't
be 'growing' pieces", then "We just wanna make a rule for this specific one, for any move that's an 'add pieces' move, but it's not
their ult. Only one is active during the battle tower, so solo battle tower bosses it's fine."

- **The rule:** `BATTLE_TOWER.addsPieces` (settings.ts) lists the bosses whose power adds pieces. On a tower floor of several, only the
  first of them in the floor's turn order (the primary, not necessarily the first boss) keeps it; the runner marks the others' powers
  `noAdd` as the floor starts (`towerNoAdd`, beside Wrangler's `towerNoUlt`), so solo and the party's room agree and a restored battle
  keeps it. One of them on a floor, a lone floor, and every other mode: unchanged.
- **The list:** Babur's balloons (`tiger`: never put on his pump), Timber's workshop drops (closed from the start), Don Dough's rising
  dough (`zebra`: no lump drops), Sawyer's split pawn (never splits; his first move needn't be a pawn's) and Puddles' grown pieces
  (`gardener`).
- **Calls made:** (1) **Puddles** grows his pieces at his Watering, his ultimate, while Eric said "not their ult" but named the hippo:
  off the primary his Watering still comes (the ult isn't touched), but a seed that would grow a piece comes up as nothing (plain and
  killer plants as ever). Taking `gardener` out of the list undoes it. (2) **Sawyer's split pawn** counts: it's a move that adds a piece
  and not his ult ("any move"), though it's once a battle. (3) **Alfil's fusion** doesn't count: two pawns become one elephant (it
  converts, never adds). Plants, toy blocks, carrots and dough lumps aren't pieces (a lump only becomes one as it rises, so no lump, no piece).
- **On screen (nothing hidden):** Babur's pump stays in his part (a computer's beside his figure), empty, greyed, tagged OFF, its label
  "Balloons: off on this floor". Puddles' seed meter keeps going, its label adding "no pieces grow on this floor, only plants". Timber's
  workshop and Don Dough's timers aren't drawn on a shared floor (their bar props, as before), and Sawyer's split has no element: nothing
  new for them. One FAQ line in each of the five.
