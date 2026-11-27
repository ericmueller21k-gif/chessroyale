# The Gift-Wrap Tube's twist and the opening's pull-back (Nov 27, 2026)

- Eric: "This item is supposed to twist animation like a barber shop pole." It never did (only its confetti puff). Now its stripes
  scroll up it, one turn every 1.5 s, everywhere it's drawn (like the shine: not only where it's the focus; never with reduced motion).
  One CSS transform on one SVG group of the item's own layer. Its blemishes repeat every turn now (the loop needs it); same odds.
- Eric: "like a rubber band style where the slot of items looks like it's pulled back slightly before going full speed." The strip
  shows still and sharp while the answer comes, then eases back 16 px over 280 ms (`CRATE_OPEN.pullPx`, `pullMs`) and lets go at full
  speed; the 46 tiles are redrawn only when they change. Every beat after the spin keeps its timing from the spin's first frame.
