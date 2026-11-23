# Birdie: Eric's design (Nov 23)

## Young Birdie (the boss you meet)
Eric's own young mourning dove, riding a yellow toy diesel train. A real bird's look, a warm face, a conductor's cap and a tie,
nothing else. Idle: perched up in the train on his two little feet; sometimes he crouches down so only his head peeks out, looking
around. First drawings: `notes/briefs/birdie-art-1.md` (two variants, stills on `stills/birdie-1`). **Eric picked B** (Nov 23: "i like them both, this one is a bit better tho").

## His ultimate: the fall and Armored Birdie (Eric, Nov 23; replaces "a transformation into an adult dove")
- **Trigger:** once he has lost a certain amount of material (the amount is to be decided). If he never loses that much, it never
  triggers.
- **A cinematic like Moo's Full Moon:** it takes the same space on screen as Moo's, about 6 to 7 s long.
  1. A cut to a close-up: he falls out of his spot on the board.
  2. A transition into a zoomed view, but not so close you can't see what's below: he tumbles through the air like a bird falling
     from a great height, almost dying. The background is blurred, with wind and speed lines, as in a cartoon fall.
  3. As he falls, a train track comes into view below, and his own train (the same drawing as his ride) barrels toward him, closer
     and closer.
  4. Its headlights get brighter and brighter as it nears: reuse the existing light effect ("how we did the lights").
  5. It hits him, and he transforms.
- **Armored Birdie:** he takes on the train's color scheme (yellow, the dark roof, the red stripe), with armor on his wings. He stands
  upright on both legs, more like a human stands, like a typical Mega Man boss. His powers in the new form: to be decided later
  (Eric).

## Spend
Eric, Nov 23: "Just approve whatever the spend is for this, for the API. It's fine. It never runs as much as we think anyway."

## Young Birdie's main power: the train (Eric, Nov 23)
- At the end of his turn, he finds a rank or file where **exactly one of the crowd's pieces** stands (any piece, the king too in
  this case). One, because two would be too strong (Eric).
- He **signals that line**: a railroad-crossing warning that flashes on it for a moment, train-themed.
- If the crowd **doesn't move that piece** on their turn, then whatever else happens that turn, he **rides his train across the
  line** (the same train he rides) and smashes the piece. Reuse the gator's smash (his queen laser's hit on a piece).
- His own pieces on that line **quickly move out of the way** as the train comes, rather than the train passing through them.
- **The king** (Eric, Nov 23): if the marked piece is your king and you don't move it, the train smashing it **loses the battle**.
- **When** (Eric, Nov 23: "It's at most every 3 of YOUR turns, actually we should have it always trigger after your first move since
  there should be a row to trigger it on, then it's on a 3 (6 total turn) turn cooldown"): the first warning comes at the end of his
  reply to your first move, so you must answer it on your second move. Then a cooldown of 3 of your turns (6 plies) before the next.
  If no line has exactly one of your pieces when it's due, it waits until one does. Tunable in settings.
- Director's calls: any move of the marked piece saves it (Eric's "if you don't move that piece"); only the marked piece is hit; if
  several lines qualify, the seed picks one (all devices agree).

## Armored Birdie
**Eric picked the sleek version (A)** (Nov 23: "I like the sleek version of Birdie better than the chunky one"): `scripts/boss-art/out/boss-birdie-armored-a/` on `claude/boss-art`.
His power: the same idea, but stronger and without the train (he's done away with it). The details come later (Eric).

## The cutscene: Eric's notes held for a second pass (Nov 23)
Eric, while the first pass was being drawn: "The train ... it's like the same kind of one that he has, but ... more actually like drawn
... it has a 3D like barreling effect, like the tracks, the blue sky in the background. ... It almost looks like it's like a cinematic
style sort of clip. So hold off on sending ... I don't want this to influence what was already being done. But if it doesn't land,
then we can inject these suggestions in it."
For a second pass, only if the first doesn't land: the same train as his ride but drawn with more detail and depth, barreling
toward the camera with a 3D feel; the track running toward us in perspective; a blue sky behind; a cinematic clip's look.

## His home in Chess Town: the train station (Eric, Nov 23)
- **Outside:** a little train station with a big nest sitting on top.
- **Inside:** a normal, cozy train station:
  - shrubbery filling in spots;
  - airport-style seating;
  - a little sit-down restaurant/bar area, "like a lobby in a way in the airport".
- **Depth:** behind, in the background (not walkable), 2 or 3 tracks run back into the distance, with trains moving in and out, for a
  3D feel.
- **On the wall:** a big old-school split-flap board, like an airport's arrivals board, the analog flaps flipping. The art never draws
  letters or numbers, so its flaps flip between pictures (a little train, a clock face, boss faces, a nest, an arrow) rather than text.
  The game could later show real text on it in code if Eric wants.
- His fight animations: later (Eric).

## The cutscene: Eric on the first pass (Nov 23)
"I actually like the sky in this one. I think that's totally fine. ... the train is way too short. It looks like a limo. It does
not look like an actual train. I think the scaling is off too. Like the track ... the ratios are wrong. Look at the still images.
... But I think the rain and stuff is kind of cool. I like it."
Keep: the sky, the rain, the wind lines, Birdie's tumble, the timing. Fix: the train's length and look, and the track's scale and
perspective. The Armored Birdie reveal stays as it is.

## His music and the ultimate's timing (Eric via the music helper, Nov 23)
Files: branch `stills/trailer-v2`, commit `6981fcee`, folder `boss-music-stereo-192/` (stereo 192 kbps; re-encode to 128 kbps as
every theme, lined up at pad, 30 s and the loop point; README section "Nov 23: Birdie's theme and his ult's piece"):
- `birdie-loop`: his theme, the runaway-train song, key `birdie`, one loop of 136.296292 s, no intro, pad 0.5, 162 bpm.
- `birdie-ult-intro`: his ultimate's piece ("the crossing", 15.8 s), key `birdie-ult` shaped like the Hidden Boss's pieces: intro
  `birdie-ult-intro`, `introSeconds` 14.814813, loop `birdie-loop` (from its top); marks `whistle` 1.481481, `roll` 13.333333.
Eric's wiring:
- **Start:** right after the crowd's capture that puts his lost material over the threshold, the music fades into the piece.
- **The drop is the impact:** the piece's end (14.815 s in, where his theme starts from its top) lands exactly when the train hits him
  and he transforms. So switch the battle's theme to `birdie-ult` with `switchPlan`'s `dropAt` at the impact, the piece starting at
  dropAt - 14.814813 s.
- **His move waits:** Birdie doesn't play his reply at once. It's timed to the drop (about 15 s from the capture to the impact);
  meanwhile he says a line before it. The cutscene starts at dropAt minus its own time to the impact frame.
- **Once a fight.** After the drop his theme loops as normal.
- Marks for visuals (s into the piece): 0.0 steam, band drops, first birds; 1.48 first whistle (long, long, short, then a long one from
  6.5 sinking away by 9.3); 13.33 snare roll; 14.815 the drop.
- Director's call on the clocks: the wait is his turn, so the crowd's clock doesn't run; he's untimed as usual.

## The cutscene: Eric on the second pass (Nov 23)
"there's two issues. The front of the train is too blocky now. It doesn't even look like a real, head of how a train looks. And it
also should be actually looking like it hits him. It's to the side of him."

**Approved (Eric, Nov 23): "looks good now"** — the third pass (`arena-birdie-fall` at fd5cad0ec on `claude/boss-art`, stills
`stills/birdie-6`) is the cutscene's fall scene.

## The lobby: Eric on the first drawing (Nov 23)
"the table and chairs are all out of place ... there should have been a separate area. Like the station should have been a little bigger.
There should be like little birdies sitting at the bar stools, and it should be like a 3-sided ... bar ... and then in the back is a
bartender guy who's also doubles as the shop guy. ... the guard crossings ... you have them exactly parallel, but they should actually be on
different lines, just like on a real ... road ... kitty corner ... when I said the table and chairs, I just mean like just 2 of those bar
stools that you have drawn ... one on the left, one on the right, and in the center ... a normal ... square [table] with the white top."
- The room a little bigger, so the bar is its own area.
- A 3-sided (U-shaped) bar counter, little birds perched on its stools; behind it a bartender who's also the shop clerk (his own sidekick
  drawing). Director's call on the bartender: a friendly pigeon in a red vest and apron, drying a glass.
- The challenge spot in the middle: a plain square table with a white top, one of the bar's stools on its left and one on its right.
- The crossing gates staggered as on a real road (one before the tracks on one side, one after them on the other: kitty-corner), never
  side by side on one line.
