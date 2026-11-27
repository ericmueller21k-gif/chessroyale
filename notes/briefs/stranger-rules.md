# The Stranger (working id `stranger`): his rules, unlock and tower spots (Eric, Nov 27 ~01:40 UTC)

Eric's words and answers:
- "playable from the boss, the main bosses, like you can pick, but he first is unlocked. You can click on him and it'll show him. It
  won't be like the hidden boss, but this one's unlockable... he shows up after 10 rounds of the battle tower... He'll show up a few
  times in the battle tower at different strengths... he doesn't actually have a building in town."
- Unlock (asked): **"Beat him in the tower"**: he is the Battle Tower's floor-10 boss; winning that floor unlocks him in the Boss Battle
  picker for good. Until then the picker shows him locked (darkened card); tapping shows who he is and how to unlock him ("Beat him on
  Battle Tower floor 10").
- His move: "he puts both of the tips of his swords like together, and he does like a dual fire and ice move, like where it hits a
  square, freezes your piece, and then that piece is, you know, that tile also becomes like in 2 turns, it burns whatever's on it."
  Timing (asked): **"Freeze 1 turn, then flee"**: your piece is frozen for your next turn (can't move); it thaws the turn after, your
  one chance to move it off; then the tile burns whatever is on it.
- His ultimate: **Eric will provide it shortly.** Build the strike as a regular power now, with his rage meter and an ultimate hook
  ready (a clearly named placeholder that never fires until Eric's ult lands, said so in the PR); every boss ults every game is the
  standing rule, so the ult follows in a next PR.

The director's calls (record them, tunable in settings.ts):
- The strike ("Frostfire" working name): every few of his turns like other bosses' powers (pick a cadence near the others'), on the
  crowd's most valuable piece that isn't the king (ties: the one most central or a seeded pick; solo and online the same answer); it
  comes with his move, not instead of it. Kings are never targeted and never burn (the burn spares a king on the tile). The burn removes
  any other piece on the tile then, his own included ("whatever's on it"). Reuse what exists: the gingerbread man's Freeze (a frozen
  piece) and the burnt-tile/decor effects; the hard guards every power has (no illegal positions, the crowd always has a move, the pass
  guard if a power ever spends his turn).
- Tower spots: floors 10, 30 and 50 are his, as a lone boss at that floor's usual strength (the tower's draw rules apply, including the
  looser draw on floors 1-10 if PR #991 lands first: rebase on main). Everywhere else the tower deals as today, and he is not in the
  random pool.
- Boss Battle: once unlocked, he plays like the main bosses (Boss alone, raids, party) at the chosen difficulty.
- Stored data: derive the unlock from what the server already stores if you can (a won tower floor 10 per account, solo and party:
  each member who won it). If a new column or row is truly needed, keep it minimal, nullable, and say so in `.pr-body.md`: the director
  then runs the full lane (independent review) on it. Never trust the device's word for the unlock beyond what the tower's server
  checks already allow.
- His art is built in parallel on `claude/stranger-art` (characters lane): use the roster entry/portrait ids it creates, or a
  placeholder that its merge fills; never edit its files. Coordinate by reading its branch.
