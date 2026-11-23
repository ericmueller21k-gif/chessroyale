# Chandy: tap him to see his rifle and its upgrades (Nov 18, 2026)

**Eric, Nov 18:** "Make it so when you tap chandy a weapon screen comes up that shows his gun and which upgrade he has (same themed
container for what we use for his upgrades)."

- **What changed:** a tap on his figure (the phone's bar; beside the board on a computer; solo and online) opens `ChandyWeapon.tsx` in
  his upgrade window's container (`.ch-upgrade`'s look, now shared with `.ch-weapon`, still): the rifle at its stage, "Long barrel 1/5",
  his five moves in one fixed order (lit once unlocked, the rest greyed "Locked"), his move meter, a line on how he upgrades. ✕, Escape
  or a tap outside closes it. Before tapping him did nothing (his figure took no tap); that's still true for every other boss.
- **Calls:** it opens only on your side's turn and closes itself as anything moves (`lookKey`: a move landing, his turn, Dodge, the
  battle's end), so it never covers his move, his upgrade window, his meter's moves or Dodge; a tap during his turn does nothing. It
  never touches the match (the clock runs). Moves are listed in a fixed order, not the order he got them, so no row moves (unlocks are
  random). Each lit move says what it does in a few words (from settings); the FAQ keeps the rest.
