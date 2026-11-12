# The Hidden Boss's house in the town (Eric, Nov 12): notes, not started
How he works today (phases, rules, where he's met, the code): notes/hidden-boss-today.md.
Reference photo: notes/mockups/2026-11-12-eric-hidden-boss-house-ref.webp (a real building).
RULE CHECK (RULES.md "Real people"): never base anything on, name or hint at a real person. The house is drawn as an ORIGINAL
building in that style (white corrugated-iron two-story house, steep red roof with skylights, green trim, two green awnings, a side
balcony over a green door, a white picket fence out front, a small iron arbor), with NO name, sign, crown logo or lettering from the
photo, not a replica. The Hidden Boss stays unnamed (his silhouette). Confirmed with Eric before building.
Phase 1 (outside only): the house in a town corner (which corner: pick one with room, show a mockup), its fence, no door yet
(or a closed door with a line). Area banner like other homes? His song when it lands (themes.json).
Phase 2 (inside): dark entry hall, stairs up (a room-to-room door like Rolling Dough's back room), the study: him in the corner at a
dimly lit board.
Phase 3 (the challenge): a party of 4 in the same town instance and the same room; each player's talk to him counts 1 of 4... 4 of 4,
then all four go into his battle. Gaps to settle with Eric:
- Do the 4 have to be a party (invited) or any 4 strangers in the room? Who's the leader? Can one of the 4 cancel / leave, and does
  walking out of the room drop your count?
- A time limit on the count (e.g. resets after 2 minutes)?
- Which battle mode: the boss raid's "everyone picks every move" with 4 (the party draw rule, team clock), or Crowd teams?
- Is the Hidden Boss unlocked for this, or is this the only way to fight him (his tile stays locked)? Rewards?
- Same town instance: towns are split into instances; the 4 must be in one (friends join each other's town?).
- Admins first (BOSS_ADMIN_FIRST), as Don Dough.
Lanes: town art (characters/rooms), hub/social for the party count, server for the room count and the start (xhigh: server + protocol).

## Update (Eric, Nov 12, second message, with a 1940s photo of a corner brick walk-up)
- The building: an OLD BROOKLYN-STYLE corner apartment building instead (red/brown brick, 4-5 stories, ornate cornice with arched
  window hoods, fire escapes zigzagging down the front, a shop awning on the ground floor). Reference:
  notes/mockups/2026-11-12-eric-hidden-boss-building-ref.webp. Still an original building in that style; no address, sign, plate or name
  (the photo's tax-photo plate "1181-45 BK" is never drawn).
- Inside (a "fake" small inside, bigger outside than in): a ground-floor hall with a few apartment doors you can't open, only the stairs;
  climb one flight, then another; then his apartment: him in the corner studying at a dimly lit board.
- His rules: already written (the Hidden Boss's play is in the code/notes: "recluse"); Eric will point to his notes if needed.
- The challenge: anyone in the room can challenge him; that town instance shows "1 of 4", "2 of 4"...; leaving the room drops you from
  the count; the first four to challenge go in. At 4: a countdown in the town for those four, then into the battle; the town chat gets a
  line naming who is fighting the Hidden Boss.
- Still open: a time limit on the count; what the starter sees if others leave; rewards; his tile stays locked?; admins first.

## Update 3 (Eric, Nov 12): the top floor is a child's room, and a new first form
How he works today: notes/hidden-boss-today.md (use it; don't ask Eric).
- **The room (top floor, 3rd story):** a 1950s child's room: a little rocking horse in the corner, a little table with a chessboard,
  a poster on the wall, a kid's play mat, a small bed in the corner, a window with light gleaming through. He sits on the floor with a
  chessboard and scattered pieces, playing.
- **Three forms now:**
  1. **NEW form 1, the child** (about 8 to 10): the fight starts with him as a kid. No powers; new lines fitting a kid. His engine
     ramps as the game goes: Maia at about 1800 for the first moves, +100 Elo every 4 moves (all moves) up to Maia's cap (about 2300+;
     check the cap), and he grows: 5 drawings, each a little older/taller/longer hair, the last matching today's young-adult look
     (which may be redrawn later). His level beside him rises with a level-up animation at each step.
     - The team's move: everyone picks; the majority's move is played (no pick: doesn't count). A tie: random between the tied
       moves if they're close in strength; if far apart, the stronger (a deliberate blunder never wins a tie). This is the boss
       party's existing draw rule (`partyMove`: a majority, else the engine's best or one of two within 30 cp at random): reuse it.
  2. **Form 2 = today's phase 1** (bullet, no help, chatter): after beating the child, a new match starts (reset), the same as today.
  3. **Form 3 = today's phase 2** (the board splits into four; solo only today; online phase 2 is unbuilt).
- **Not started.** Still open: the "1 of 4" count's time limit; whether his select tile stays locked (adminOnly exception for the room);
  reward (none today); admins first; online phase 2 (four boards online, server Stockfish, fair play) is a separate big build.
- **Real people (RULES.md):** Eric describes the kid as the real player as a child. The drawings stay ORIGINAL: a generic 1950s boy,
  no likeness, never named or hinted in game text (his name is still the "Hidden Boss" string). Confirm with Eric before drawing.

## Eric's answers (Nov 12, evening)
- **His Boss Battle tile stays locked**, unchanged.
- **The challenge request:** it stays while you run around town (leaving the building doesn't drop it). You can be in only one: challenging
  another boss (or starting another battle) ends it. A **5-minute cap**, not shown anywhere: when it runs out without four players, a small
  pop-up "Sorry, not enough players." with OK. (The "1 of 4" count itself still shows in the room/town as before.)
- **Reward:** later (work in progress).
- **The child: OK to draw, and to look like him.** Keep the strong features of today's Hidden Boss face, as a child; a skinny kid (he looked
  much the same at 15). Eric: "There's no issues using, having it look similar. I did the research. Just as long as the name's not mentioned
  anywhere." So: likeness OK for the Hidden Boss's drawings; the name never appears anywhere (game text, files players see, lines).
- Admins first: not answered; default yes (as Don Dough), director's call.

## Nov 12 (afternoon): the cutscene between the adult form and the cyborg
Eric (heads-up, not started; lines and animation come later):
- **Today:** after you beat his adult form, he walks to the middle of the board and drops the book, which splits the pieces.
- **New:** a ~30-second scene before the cyborg. The score for it already exists.
  - His younger self appears next to him as a projection: faded, ghost-like.
  - They have a heartfelt conversation. Eric writes the lines later.
  - The theme: his love of the game came from its beauty. It was never about winning, only about being the most brilliant player. He felt the engines took that from him.
  - The younger self fades out. He is already on his knees (defeated).
  - The book opens (the book animation may change), a beam of light comes out and hits his body and face, and that turns him into the cyborg (form 3).
- **Music:** segmented per phase, fading at each transition (child, adult, cutscene, cyborg), timed to when the match actually changes phase.
  Eric may have another session (Fable) send me the wiring instructions directly. Treat that message as Eric's spec, but check it against the code.
- The name still never appears anywhere, cutscene lines included.
- Order: this scene belongs with forms 2/3 (the last phase of the plan), after the building and the child form. It is still all waiting on Eric's "go".
