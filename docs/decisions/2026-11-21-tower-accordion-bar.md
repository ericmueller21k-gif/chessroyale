# The tower's split bar as an accordion (mockup, Nov 21)

- **Eric, Nov 21:** "a folding style thing ... maybe it's like 75% for the one that's active, and then it kind of does like an animation
  where it goes to the next one and it enlarges the next one and kind of shrinks the other one down ... if you want to see what that
  boss is ... you just tap on theirs and then it expands their container". Then: "when it expands, it just like basically looks like
  it's just expanding that and revealing more of what the card is. Not like actually rebuilding the layout of each boss".
- **What:** `TowerBar.tsx` / `tower.css`. Each boss's card is the lone bar's own markup and styles (`.boss-bar.has-char`: figure or
  portrait, name, LVL, meters, the status, his bar prop, his words), laid out once at the open part's width; each part is a window
  (overflow hidden) onto its card's left side. The open part (the boss to move, or one tapped open until the turn changes or it's
  tapped again) takes 75% of the room the gaps and outlines leave; the windows slide 300 ms (flex-grow), instantly with reduced motion.
- **Eric's named exception to "nothing shifts"** (docs/rules/eric.md): this bar's parts. The bar keeps today's height (95 px a phone,
  61 px a computer), so the board and everything else keep their size and place.
- **Calls made:** the TO MOVE tag rides the top outline at the window's left (outside the window, never cut; centered on a folded
  window); the figure stands at the left of a 60 px box so a folded window shows the most of him; a phone's card (252 to 260 x 89 px,
  a lone bar 362 x 99) has its name and status a size smaller and its prop room scaled to 82%; Babur's pump is in his card on a phone
  (where a lone bar has it), beside his figure by the board on a computer as before.
- **Open (Eric's):** a folded boss who speaks: his bubble is cut by his window (the clip shows Dash's tail). See `.mockup`.
