# Brief: the zebras' bakery (art): its front, its shop and its back room, and the crew's chatter. Opus, high

Branch `claude/boss-art` (shared with the characters' art session today: `git pull --no-rebase origin claude/boss-art` before each
push; never force-push). **Art and writing only: no app code** (a code round wires it after Eric approves). Include
`notes/briefs/rules-common.md` (read both with `git show origin/claude/director-notes:<path>`).

## Read first
- **Eric's words, word for word:** `notes/zebra-eric.md` on `claude/director-notes`. Follow them exactly.
- How a home was delivered: `scripts/boss-art/out/house-shop-bigboy/` + `shop-bigboy-nov2.md` (Big Boy's home: **the total size to
  match**), `house-shop-timber/` + `shop-timber-nov3.md`, `house-shop-hollow/` + `shop-hollow-nov3.md` (the floor mask, the piece
  table, marks, lights, `rockPiece`), and `house-shop-grex/` (Jefferson's, the giraffes). The town's homes and shops in the code:
  `docs/areas/town-square.md` ("Inside a shop", "Challenging a boss", "Adding a home").
- The characters come from the other session (`out/boss-zebra/`, `out/crew-zebra/`, `out/zebra-props/`, pushed early to the same
  branch). Until they land, stand in simple silhouettes, then swap them in before you deliver.

## What to make
1. **The front of the building** in the town: a bakery (the town's style), bread in the window, an awning, a sign (a funny name is
   a call for Eric: give three), and the "just a bakery" joke readable from outside if you can.
2. **The front room (the shop):** smaller than other homes inside, because **a door at the back left** leads to the back room.
   Bread for sale behind the counter; **a giant mixing bowl mixing dough** (one of the big animated pieces: loop it); the counter;
   **two guards by the door** that always look at you (their marks, and say how their `watch` turns to the player). Someone has to
   sell the boss crate as in every home: a counter zebra in an apron (from the crew drawing or a sixth variant) is a call for Eric.
3. **The back room** (about 1/3 to 1/4 of the whole home; Eric: "it loads into another room"): a big table with **scattered chess
   pieces**, **a TV showing what looks like a chess stream** (a little board with moving pieces and a chat column; generic, no real
   streamer, site or logo), **scribbles and game theory on the walls** (arrows, board sketches, "e4!!", "Nf3?!", circled squares),
   four seats (the kingpin's at the head), a cartoon puff only if Eric's call allows. The challenge plays here (table, marks,
   where the board goes, as the other homes' "Challenging a boss").
   - **The door between the rooms is new:** draw both rooms as their own floor masks and piece tables, each door's tile, where you
     arrive in the other room, and how the camera frames each room (phone and computer). Say in the notes what the code must add.
4. **The chatter** (Eric: a looping argument, the three crew vs the kingpin, who is always right and one-ups them; real theory, not
   basics; teasing, never "are you stupid"): `scripts/boss-art/out/zebra-chatter-nov10.md`, about 16–24 short exchanges in a loop,
   each line short enough for a speech bubble (match the length of the other bosses' lines). **Every chess claim correct:** check
   each named line's moves are legal and named rightly (`packages/chess/data/openings.json`, chess.js) and each evaluation or "that
   loses to ..." with Stockfish (`packages/chess/src/node.ts`); list the check beside each line. Openings beyond the Queen's Gambit
   (Najdorf, Catalan, King's Indian, Grünfeld, the Berlin, the Marshall, the Sveshnikov...), with real move talk ("Rb1, takes, check").
   Also: the guards' and front room's "nothing here but a bakery" lines (8–12), and the talk beat (crew draw: one line; the kingpin's
   "relax" line; his challenge line) and the battle-start pair (his line, a crew line).
5. **Cues** for the sound round: the mixer, the TV, the door, the chatter's murmur.

## Deliver
Notes `scripts/boss-art/out/shop-zebra-nov10.md` (the piece tables, both floor masks, doors, marks, lights, cameras, what the code
adds, the calls for Eric). In `out/house-shop-zebra/`: `house-shop-zebra.ts` and stills of the outside, the front room and the back
room, on a phone (390 × 844) and a computer (1440 × 900), plus a GIF walking in, through the door, and the talk beat (crew draw, the
kingpin waves them down). Finish with `scripts/boss-art/out/zebra-bakery.done` as your LAST push. Reply with the head sha, the image
paths and the calls for Eric.
