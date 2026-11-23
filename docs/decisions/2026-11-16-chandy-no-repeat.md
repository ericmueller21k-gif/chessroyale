# Chandy never fires the same move twice in a row (Nov 16, 2026)

Eric, Nov 16 (a screenshot of a second beam in a row): "Despite 2 weapon unlocks he just did this move twice in a row."
- The meter picked at random among the unlocked moves, so with two a repeat came half the time. Now `meterPick` leaves out the move he
  fired last (`ChandyState.last`, set where a move lands and where the queen lock fires) while another can come. A new unlock still
  fires first; with one move, or the others unable to come then, it may repeat.
- An older stored battle has no `last`: it picks as before until its next move fires.
