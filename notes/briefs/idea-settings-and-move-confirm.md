# PARKED idea: the settings reorganized, and move-confirm styles (Eric, Nov 6). Don't start until Eric sends the UI mockup and says go.

## The settings
- One entry, **Sounds**, opens a Sounds page with every sound setting.
- One entry, **Gameplay** ("gameplay mechanics and customization"), holds the motion trail, animations, premove options and the new **move confirm style** (below).
- The board choices (the three boards) stay. Eric will send a visual of the layout before this starts.

## Move confirm styles (the moment a move is confirmed; today: three beeps and a flashing green border)
1. **Classic (the default):** today's three beeps and green border flash.
2. **Soft press:** one soft, muted tone. The square itself (under the piece) fades to green and back, softly, "almost like you're pressing down on the board". A recolor of the square, not the border, and not a hard flash.
3. **Vote trace** (crowd and 50 v 50 votes; Eric: "maybe this would be like the secondary go-to one"):
   - As votes come in, each candidate move's target square gets a green line drawn around its border in proportion to its share of the votes, like the home screen's level meter.
   - Two lines start together, one at the top center and one at the bottom center. Each runs both ways along its edge, left and right, then down or up the sides toward the middle of the side, staying on the border. At 100% the outline is closed.
   - The share is votes for the move divided by the voters (players left). Moves under about 5% draw nothing, so usually only 1–5 squares show a trace.
   - When voting ends, the chosen move's trace finishes quickly to a full outline (even if it was short), and the others fade.
   - Sound: the confirm tone, possibly the soft one.

Eric: "I'm gonna likely change it later … send me … a GIF of this effect" before it goes live. So make a GIF of each style for his OK first.
