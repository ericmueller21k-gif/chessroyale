# Brief: the street town, round 5: one fixed view, and the Colosseum against the back wall (code; Opus high)

Worktree `/home/user/cr-townfixed`, branch `claude/town-fixed-cam`, made from main 6ce41d19 (round 4, #503, live for admins).
Ports 8993, inspector 9493. Include notes/briefs/rules-common.md. Still admins only (`STREET_TOWN`).

## Eric walked round 4 (Nov 5, evening). His screenshots: `assets/town-fixed/eric-01..14.jpg`
His words, trimmed:
- "There should be one view point no matter what, always. And then the only time it shifts is if you're standing … on the sidewalk …
  in front of one of their buildings, and then it turns to show their building. And then when you step off back onto the street, it
  should [turn back]."
- "If I go up and down, I go up and down. If I press left, I start running left, but I don't change the camera angle at all."
- "I keep getting lost running around because every time I press arrows and the camera moves … You should never be confused about
  where you are in the town."
- "No matter what arrows you press, the Colosseum should always be in front of you." "This town square is sometimes to the left,
  sometimes to the right of the Colosseum." (Caused by the chase camera's turns.)
- Puddles' screenshot (`eric-14`): "This is totally acceptable … you can see them and you can't quite see their building. But if I
  were to press left now … instead of it right away turning … it only shifts when I actually step onto the sidewalk."
- Colosseum: "The Colosseum is literally the edge of the top center of the map … we shouldn't see any houses behind it … there's no
  loop behind the Colosseum … put a gate to the left and right of it … trees and shrubs … you can't go past it. It's all blocked off
  … the entire back wall of the map … is totally blocked … it doesn't loop at the bottom either."
- "It looks like these pawns are floating" and "the pawns are … stacked on top of each other" (`eric-06`, `-09`, `-10`, `-11`). He
  looks like he is running through the Colosseum (`eric-11`, `-12`).

## Do
1. **One fixed view.** The camera always faces north (the Colosseum ahead), at round 4's low street-level height and zoom steps.
   - Take out the chase camera's turning: no heading change for walking, arrows, taps, corners or the turn zones.
   - The arrows are screen directions, as in the old town: up = north, down = south, left = west, right = east. Your figure shows
     its back, front or side as it walks (the existing views).
   - Keep #502's `rowsUp` in rooms working.
2. **The one exception: the sidewalk in front of a boss home.**
   - Each home has a **front strip**: the sidewalk squares directly in front of its front, as wide as its front.
   - Standing on a home's front strip, whether you walked, tapped or used the arrows to get there, eases the camera (about 0.5 s) to
     face that home's front head-on. Stepping off the strip eases it back to north.
   - Tapping any square of a front strip walks you there and turns you to face the home.
   - Homes whose fronts face south (the north side of an east–west street) already face the north camera: no turn, just face it.
   - **Arrows while turned** go through the turned view:
     - up toward the home, which opens its card (the Nov 5 door rule stays);
     - down back to the street, which steps you off the strip and turns the camera back;
     - left and right along the strip.
   - Record this in the decision note.
   - Look-alike fronts never turn the camera.
3. **The Colosseum against the back wall.**
   - The north edge of the map is a solid wall.
   - The Colosseum sits at its top centre with its plaza in front, facing south toward the town.
   - To its left and right: a wall with a gate on each side (closed, decorative), backed by trees and thick shrubs. Nothing shows
     behind any of it: no houses, no skyline towers, no looped town. Above the wall you see only sky (and treetops).
   - The squares beside and behind the Colosseum aren't walkable. You only approach it from the front, so you can't look like you're
     running through it.
   - The giant chess-piece statues and the bronze statue (whose subject is never named) stand on the plaza in front, spaced apart,
     on the ground with their bases planted, never overlapping or stacked. Fix their depth sort with you and each other at the low
     camera.
   - Cull or remove anything north of the wall.
4. **Edges.**
   - North and south don't wrap. The south edge is round 4's closing row; check that nothing loops into view past it.
   - **East–west wraps as before** (Eric allowed it; he may close it later, so keep it one switch).
   - Check that with the fixed north view the wrap never shows the town "beside" itself in a way that confuses: no Colosseum copies
     to the left or right. If the wrap would show a second Colosseum at the edges of the view, cull it.
5. **Keep the rest of round 4:**
   - rows, look-alikes, skyline, culling and draw costs;
   - the four zoom steps and the park's step out;
   - labels hidden with their homes;
   - the door-tap and arrow-into-a-home card rules.

   The fixed view may change what culling sees: re-check the draw counts and frame rate.

## Done
- **Unit:**
  - the heading is always north except on a front strip;
  - each home's strip squares and the heading there;
  - the arrows are screen directions;
  - tapping a strip turns you to face the home;
  - stepping off turns back;
  - nothing north of the wall is walkable or drawn;
  - no east–west copy of the Colosseum is in view;
  - the statues don't overlap.
- **e2e** (phone and computer, both renderers):
  - walk all four arrow directions and the camera never turns;
  - tap a home's strip: the camera faces it, and the card opens on the arrow toward it;
  - step off: north again;
  - walk up to the Colosseum: it's ahead, with the wall and gates either side and only sky behind;
  - try to walk beside or behind it: you're stopped;
  - every figure on screen.
  - Update round 4's chase-camera checks and list them old → new.
- **Stills** in `docs/street-town-fixed/`:
  - a street looking north;
  - a home's strip, turned;
  - the Colosseum plaza up close and from the park;
  - the statues;
  - the wall's corner (phone and computer).
- **PR body** in `docs/street-town-fixed/pr-body.md` (full e2e), a decision note `docs/decisions/2026-11-05-street-fixed-view.md`
  quoting Eric, and a short report.
- Don't open the PR.
