# Brief: arrow keys to walk in the town and shops (UI; Haiku unless the movement code needs Opus)

Eric approved the look (Nov 4): `notes/briefs/assets/town-arrow-keys.png` (option A).
- On-screen keys in the keyboard arrow shape (up on top; left, down, right in a row), bottom right, just above the zoom pill and the
  recenter button; the right key's right edge in line with the recenter circle's right edge. Each key about 27 px (phone CSS px),
  3 px gaps, rounded, see-through white (~55%) with a thin dark outline and a clean chevron icon (no emoji). Pressed: dark (~72%),
  white chevron, nudged down 1 px.
- Hold a key: your character runs that way (town square and inside shops), as long as it's held; release: stops. Diagonals if two are
  held. Respect walls/the floor mask and the same speed as tap-to-walk. A tap on the map still works as today.
- Computer: the keyboard's arrow keys (and WASD only if it doesn't clash with anything: check chat inputs) do the same, and the
  matching on-screen key shows pressed while held. Never when typing in an input.
- Every number in the town's feel; phone and computer stills; e2e: holding up moves you up; the on-screen key lights with the arrow key.
