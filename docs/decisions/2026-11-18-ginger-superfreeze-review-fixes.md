# Ginger's Super Freeze: the review's fixes (Nov 18, 2026)

The boss-lane review of #787 found three visual/wording slips; fixed in the PR:
- The regular Freeze's ice stays on its piece through the Super Freeze's block (it was iced before; no 6 s blank).
- Pieces let go so the crowd keeps a legal move melt (the existing melt) as the crowd's turn starts. Call: a piece his move takes
  doesn't melt: it leaves with its ice, as a taken Freeze piece always has (a melt would sit on his own piece).
- Call: the banner names no count ("Your knight and the pieces around it are iced"): who's let go isn't known until after his move.
- The meter, full but held back by the Blizzard, stays greyed: "Super Freeze: waits for the Blizzard" (`waiting`, afterCrowdMove's test).
