# Squads: blocks from the shop only

Date: 2026-10-19

## Asked

Eric, after playtesting Relay in Mercenary (Oct 18): blocking "seems a bit chaotic. There's already a lot going on."
Then (Oct 19): "we should do blocking for just the later rounds, and then you also don't start with any blocks. You
have to purchase them from the shop, and ... it would be impossible to buy three ... two would be spending all your
money ... The first round should be pretty straight up, even in the mercenary mode."

## Decided

- **No block points to start** (`SQUADS.blocks.bankPerMatch`: 0, was 5 a match). Mercenary's only block points are
  the shop's "Block points" item (3 points each, as before; pawn 1, knight/bishop/rook 2, queen 3, castling 2).
- **So no blocks in round 1.** The shop first opens after round 1, so Relay never has any. That follows from the
  rule above; there's no separate round switch.
- **Dear:** Block points cost 275, then 325, 425, 525 (by how many the squad has bought this tournament; the last
  repeats), at most 2 a round. Before Pairs a round-1 winner's wallet is about 560-650
  (`reports/squads-mercenary.md`), so two (600) take about all of it, and a third (another 425) is out of reach,
  besides the cap. A squad that saved before Pairs can buy two before the final.
- **Nothing on screen without them:** no Block button and no block-points count for a squad that came into the match
  with none (`hasBlocks`). Once bought and spent: "No block points left", as before. The Relay rules line no
  longer mentions blocking.
- **Classic** is unchanged: no blocks, no coins.
- **Test lobbies** take `blockPoints=N` (0-20; Mercenary): every squad starts every match with N, so a test can
  block in round 1 (the e2e block tests use 5).

## Why the prices

Eric's two anchors: two block buys take a whole wallet, and three are impossible. 275 + 325 sits at a round-1
winner's median wallet (627) and under its 90th percentile (651). The rising list keeps a third dear before the
final too (425), where wallets are larger (median about 950) because Pairs pays double.

## Not done

Blocks in Pairs and the final stay open to every squad that buys them. Whether to drop blocking altogether is
still open (Eric: "we'll keep it in for now").
