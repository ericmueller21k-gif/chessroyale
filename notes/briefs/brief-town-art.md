# Brief: the street town, round 1: the final art (art; Opus high)

Worktree `/home/user/cr-hollowart`, branch `claude/boss-art`. The branch is shared: run `timeout 60 git pull --no-rebase origin
claude/boss-art` before each push, and never force-push. Draw by hand on the weekly plan usage (no API runner). **Art only: no app
code.** Code round 2 builds the layout and round 3 the boxes and the camera turn, so be exact in the notes. Include
notes/briefs/rules-common.md. Eric is OK with this helper running beside another one (Nov 5).

**Eric approved the street-town mockups** (Nov 5: "you're good on the building the town, it seems great from the last screenshots").
They are yours: `scripts/boss-art/town-street/` and `out/town-street/`, notes `out/town-street-mockup-nov5.md`, head 4b7ada3d. Keep
every call in them (the plan, one-sided streets, the back gardens on the near side, the Colosseum front-on in its grove, the camera
turning at Seam Avenue's crossings, the wrap's seam streets, box buildings). Two of his asks still apply: **the boss homes always
visible**, and **no flat-looking buildings in a turn**.

## Deliver (final, game-ready, in the formats the code round copies in, like the shop art)
1. **Everyday buildings** (`out/town-buildings/`): the eight designs, each in two or three colourways, finished (no longer rough):
   cottage, townhouse, skinny houses, small flats, bakery/cafe, corner shop, plus the big block and the clock tower behind.
   - For each one: its **front**, its **side** (the material carried round, with windows and trim), its **roof** (top-down faces for
     the box renderer), the lot width in squares and its foot.
   - Dusk and night: windows lit (as the homes' doorways are).
   - Keep them cheap: a few slices per front, and a shared side texture per material, tinted.
2. **Boss homes as boxes:** each of the 16 homes' own side and roof art, replacing the guessed ones (glass, stone, logs, ice,
   canvas, paper, and so on, as the mockup chose). Their fronts stay the game's.
3. **Street dressing:** lamps (the park's), sidewalk tiles, the hedge (as a plane, not a billboard, so it doesn't step mid-turn),
   back-garden props (flower beds, sheds, bushes, benches), and crossing markings if they help.
4. **The plan, exact:** `out/town-plan-nov5.md`, the data the layout code needs.
   - Every street's squares; every lot (which building and colourway, which way its front faces, its depth); every boss home's lot
     and its door square, which is the square in front of the door the tap walks you to (Eric, Nov 5).
   - The park plan: the plus, the 12 tables, the trees and lamps.
   - The Colosseum's grove; the camera's facing per street and the turn zones; where bosses may wander (their own lot plus the
     sidewalk in front); where the bots may walk; your start square.
   - Check that every home's front is visible from its street's camera and that nobody's start or path is blocked.
5. **Stills:**
   - the final plan;
   - each street by day, phone and computer;
   - the corner turn's three frames, phone and computer, plus a dusk frame;
   - the buildings sheet;
   - one night street.

## Rules
- Original designs only. No copying an existing game's town, buildings, characters or logos; no real brands or people.
- Sprites always on screen (Eric, Nov 4) in every still. On the computer's zoomed-in view, the bigger buildings behind run off the
  top: either keep them under 4 squares tall, or say what the camera should do so the sky shows over the rooftops.
- Notes: `out/town-art-nov5.md` (exports, feet, sizes, palettes, draw counts, what the code must do). Pull, then push. Reply with
  the head sha, the file paths and your calls.
