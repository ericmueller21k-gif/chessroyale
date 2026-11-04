# Town square: arrow keys walk you; the zoom pair and the focus button shrink under them (Nov 4, 2026)

Eric (Nov 4): "arrow keys to walk in the town and shops", approved as the sketch `town-arrow-keys.png` (option A), then the
shrink as `town-arrow-keys-v3.png`: the zoom pill and the focus button as wide as the keys together (87 px), right-aligned, the
keys just above them.

Calls made (Eric asleep):
- Hold to walk, one square a step at a tap's pace (`youStepMs`); a release stops after the step in progress. Two held is a
  diagonal, alternating the axes, so each step is the same as a tap's.
- The keys are `div`s, not buttons: they're not in the tab order (the keyboard's arrows and WASD do it), so they're `aria-hidden`.
- WASD is on (nothing in the app uses those keys); typing in an input, a text box or a chat log leaves the arrows alone.
- Sizes: keys 27 px, the pill 57 × 27, the focus button 27 px round (the sketch's proportions; its tap areas are the drawn sizes).
- Inside a shop the same keys walk you in the room (its intro is a script, so the keys wait for it).
