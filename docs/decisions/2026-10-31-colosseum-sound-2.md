# The Colosseum: the floor's piece sounds, and the ambience at Normal, Low or Off (Oct 31, 2026)

**Eric, Oct 31:** "We've got to add the normal chess capture sounds while people are watching the game." And on the
ambience: "turn it down overall … have it as normal volume or low or off."

## What changed

- **Every move on the floor plays the game's own piece sound,** as a played game does: the move, capture or castle
  sound picked in Settings → Sound, under the game's Sound setting.
  - It plays as the piece lands: after the 0.45 s slide, or at once with Animations off, flat or 3D.
  - A queen taken plays the capture sound with the cheer on top.
  - The game has no check or checkmate sounds, so none play here.
- **The gear's "Ambient crowd noise" is now Normal / Low / Off.** Normal is the default, the choice is remembered on
  the device, an old saved On reads as Normal, and Off stays Off. A change fades over 1 s.

## Calls made

- **The levels (the director's call):** Normal is 4 dB under the level that shipped in #426, and Low is 12 dB under
  it.
- **One row that cycles,** not three radio rows. The gear has no three-way row; the town's settings use radio rows,
  but three more rows would make the gear's list taller. `CycleRow` is the gear's own row and pill (lit for Normal and
  Low, plain for Off), and a tap steps Normal → Low → Off → Normal, so the list keeps its size.
- **The sound comes from the floor's state** (`FloorState.knock`, from `moveKnock`), not the overlay's small board,
  which stays silent. That way each move plays exactly once, with the same rules as a played game, en passant and
  castling included.
