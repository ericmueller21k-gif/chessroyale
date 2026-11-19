# Battle Tower PR 8: the climb's rules, the calls made (Nov 19, 2026)

Core `tower.ts` and `BATTLE_TOWER`'s numbers as the design says (section 3); audit 1's finding 7 fixed. The calls the design left open:

- **The deal's deck end:** a new deck whose deal would leave an `apart` pair waiting at its end (so the next deck's boss came first)
  is shuffled again (up to 64 tries), so a run meets every boss once before any twice, exactly. Without it, 28% of full runs broke that.
- **Kill switches:** a resting boss leaves the deck (back with the next shuffle). A floor already dealt whose deal can't be played now
  (a boss resting since, a pair made `apart` since, a bad saved list) is dealt again at its start (`startFloor`), the others kept;
  never thrown. A pool too small for the rules: one from the floor before may come again, then fewer bosses; never an `apart` pair.
- **Where finding 7's refusal lives:** the runner's `startSide` still throws (test switch and tests), through core's one rule
  (`sideRefusal`); a room can't reach it, since the tower's only way in, `startFloor`, deals again by the same rule instead.
- **The floor's strength in the runner** (`settings.towerFloor`): every boss's `elo` is the floor's rating (Maia's number on a Maia
  floor, as Boss alone's scale: the stand-in while Maia loads, the bar, slips), no offset or difficulty; a party at the same Maia
  rating (no crowd margin); full strength (floor 80 on) plays the move kind "best". The lone-boss +200 holds on Stockfish floors
  within the cap; full strength starts on floor 80 for every floor size.
- **Leaving:** free before your 2nd move as a setting (`BATTLE_TOWER.leaveFreeBefore`, 2). A pattern changed mid-run: a floor already
  dealt keeps its count.
- **The saved run** is `TowerRun` (`seed`, `floors` dealt so far, `deck`, `decks`, `status`): PR 9 stores it (the design's `met`).
