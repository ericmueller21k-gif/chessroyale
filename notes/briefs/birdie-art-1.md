# Birdie, a new boss: first drawings for Eric (Nov 23). Art session: runs the paid art runner only

Eric, Nov 23: "New boss time, can use the API for drawing and animation, he's a bird that drives/sits in a miniature train. Name
is Birdie based off my little bird who was raised here. He was a mourning dove. He will have a transformation into an adult
looking dove. He wears a conductor hat. Looks like a real bird largely, a warm inviting face. His primary position for idling
is in his 2 little feet perched up. He also has a tie, but other than that and the hat no other clothes. ... he sits in a train
so actually let's do that something like this train. His idle is he's perched up in it, and then sometimes he crouches down
showing just his cute little head looking around. I'll provide more info after seeing some examples of what the api comes up with."

Eric's photos (kept off the public repo: the director passes them to art sessions; `scripts/boss-art/refs/` is gitignored): `eric-birdie-dove.jpg` (Birdie himself, a young mourning dove)
and `eric-train.jpg` (the kind of toy train). This is Birdie as a young dove; the adult transformation
comes later, not now.

Follow `notes/RULES.md` on art (the paid API draws it, never by hand; this session only writes briefs, runs the runner,
renders and pushes; never print the key). Steps:
1. `git fetch origin claude/boss-art && git checkout claude/boss-art && git pull`; read `scripts/boss-art/README.md`.
2. Refs: `mkdir -p scripts/boss-art/refs/boss-birdie`, copy both photos in (`eric-birdie-dove.jpg`, `eric-train.jpg`), plus the
   boss references the README's `boss-refs.ts` makes for Chub & Chirp (`hopper`) and Sawyer (`sawyer`), for the look and finish.
3. Two runner briefs, `scripts/boss-art/briefs/boss-birdie-a.md` and `boss-birdie-b.md`, each built from the text under "The
   runner brief" below, with its variant line added. Two variants, so Eric can pick a direction:
   - **A, closer to the photo:** a real dove's proportions (small head, plump body, long tail), soft brown scalloped feathers.
   - **B, a touch more charming:** the same real dove, but the head a little bigger and the eye a little larger, for warmth at
     phone size. Still clearly a real bird, not a cartoon.
4. Ask Eric ONCE in this session for the spend: "Two runs at a $5 cap each ($10 at most) to draw Birdie's first idle, two
   variants". Wait for his own yes here (never a relayed one). If he says no or changes it, follow that.
5. Run each: `BOSS_ART_EFFORT=high BOSS_ART_CAP_USD=5 npm run boss-art -- boss-birdie-a scripts/boss-art/briefs/boss-birdie-a.md
   scripts/boss-art/refs/boss-birdie` (then `-b`).
6. Commit the drawings, summaries and logs to `claude/boss-art` (as the README says). Put the stills for Eric on an orphan branch
   `stills/birdie-1`: for each variant, the idle's frame sheet, an idle GIF, and the phone-size comparison beside other bosses
   (named `a-frames.png`, `a-idle.gif`, `a-compare.png`, and the same for b). Write `NOTE.md` there with the spend of each and
   anything the runner noted. Push, write `.done` on `stills/birdie-1`, and stop.

## The runner brief (for both variants)
A **new raid boss**, approved by Eric: draw **only the `idle` animation** (it loops, alive but calm, about 4 to 6 s). Ignore the
other animations; the rest is drawn later. Id "boss-birdie", name "Birdie".

Who he is: Birdie, a young **mourning dove** (Eric's own bird, raised at his home: the reference `eric-birdie-dove.jpg`), who
rides a **miniature toy train**. Warm and inviting, sweet and curious, never menacing. He sits among the other bosses (a rabbit
riding a grasshopper, a raccoon with a saw, a gingerbread man, a paper crane...): just as charming and readable at phone size,
a big clear silhouette, **facing a little to our left (toward the board)**, light from the top left, in their pixel-art style
and finish (Chub & Chirp and Sawyer in the references).

**Birdie:**
- **Looks like a real bird, largely** (Eric): a young mourning dove as in the photo: soft brown and grey-brown plumage with
  dark-edged, scalloped wing feathers; a smooth round head; a small dark beak; a big dark eye with a pale ring around it and a
  warm, gentle look; little **coral-pink feet**; a long tapered tail.
- **A conductor's hat**: the classic railroad conductor's cap, a short round crown with a small stiff brim (navy or dark blue
  with a thin gold band), sitting a little jaunty on his head.
- **A tie**: a small neat tie at his throat (red or burgundy works against the brown).
- Nothing else: no other clothes.

**The train:** a **miniature toy diesel locomotive** like Eric's reference `eric-train.jpg`: bright **yellow** body, a dark
roof, a thin red stripe along the side, round headlights at the nose, silver-grey wheels and trucks underneath. Shown from the
side, its nose toward our left (the way he faces). Its cab is open at the top or has a hatch, so **he rides in it**. It's small
next to him, a toy: about as long as he is, or a little more. **No letters, numbers, logos or the reference's markings**
(never draw text).

**Idle** (Eric): his main pose is **perched up in the train on his two little feet** (standing tall, feet visible gripping the
cab's edge), with gentle life: breathing, a blink, a small head tilt or bob, the way doves move. **Sometimes he crouches down
into the train, so only his cute little head shows above the edge, looking around** (left, right), then pops back up to
perch. Make it one loop: perched for most of it, one duck-down-and-peek in the middle.

Never draw letters or numbers. Nothing based on a real person.
