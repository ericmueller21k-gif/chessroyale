# The tower's split bar as an accordion (Nov 21)

- **Eric, Nov 21:** "maybe it's like 75% for the one that's active, and then it kind of does like an animation where it goes to the next one
  ... if you want to see what that boss is ... you just tap on theirs and then it expands their container"; "it just like basically looks
  like it's just expanding that and revealing more of what the card is". On the mockup's two questions: "let's go with your recommendation".
- **What changed:** each boss's card is the lone bar's own markup at the open width; each part a window onto its left side. The open part
  (the boss to move, or one tapped open until the turn changes or it's tapped again) 75%, the rest folded; 300 ms slide, instant with reduced
  motion. A folded boss's words over the bar beside his window, never cut; his part doesn't open for them.
- **Eric's named exception to "nothing shifts"** (docs/rules/eric.md): this bar's parts slide. The bar keeps main's height, so the board and
  everything else keep their size and place.
- **Calls made:** TO MOVE rides the top outline (centered on a folded window); a phone's card has its name and status a size smaller and its
  prop at 82%; a lone floor's board sits 4 px lower on a phone and 12 px on a computer than a shared floor's (a lone bar is taller: as on
  main), not changed here: the check holds the board's size and its gap under the bar.
