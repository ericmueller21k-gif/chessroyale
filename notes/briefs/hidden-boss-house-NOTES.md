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

## Nov 12 (evening): mockup reviewed
- Eric: "it looks really, really, really good." Face shape stays as drawn. Age 20: a black suit, black trousers, white shirt under it, a tie
  (helper session_01JuCWRtN2WfYLKQxUZgP1Fd on claude/hidden-boss-ages). He said "white t-shirt ... with a tie": read as a white shirt; asked to confirm.
- The cutscene lines: my first draft sent to Eric (in chat); his to change.

## Nov 12 (evening): the cutscene lines, draft 2 (Eric liked draft 1; asked for two real quotes, longer)
Eric: work in "all that matters on the chessboard is good moves" (the man says it, "But all that matters..."; the kid pushes back: there's
more to chess, it's beautiful) and "best by test" (the kid turns it on him about the machines: "I knew a wise man who once said..."). Longer is fine.
Draft 2 is in the chat of Nov 12 and below; Eric's to change. Unattributed quotes, no name (RULES.md).
1 Kid: Why are you on the floor?
2 Man: I lost.
3 Kid: So? We lose all the time. Then we set them up again.
4 Man: I forgot that part.
5 Kid: Remember the board on the kitchen table? You'd play both sides till the lights went out.
6 Man: I remember.
7 Kid: Do you still find them? The moves that make you laugh out loud?
8 Man: The machines find them now. Faster. Every single one.
9 Man: And they're right. All that matters on the chessboard is good moves.
10 Kid: That's not all. A good move is just a word. The game is what you say with it.
11 Kid: It's beautiful. You used to know that.
12 Man: I never cared about the trophies. I wanted to play the most beautiful game anyone ever played.
13 Kid: Then why'd you stop?
14 Man: Because they tested every move there is. There's nothing left to find.
15 Kid: I knew a wise man who used to say "best by test."
16 Man: ...That was me.
17 Kid: So test it. Not their way. Ours.
18 Kid: (fading) Don't forget me.
19 Man: (alone, at the book) ...If the machines took the beauty, then I'll take the machines.
   (alt 19: "Then let's show them what it looked like.")

## Nov 12 (evening): cutscene draft 3 (Eric: drop the kitchen table; machines in one line; the kid questions "good moves"; "best by test, right?")
1 Kid: Why are you on the floor?
2 Man: I lost.
3 Kid: So? We lose all the time. Then we set them up again.
4 Man: I forgot that part.
5 Kid: Do you still find them? The moves that make you laugh out loud?
6 Man: The machines find them now. They don't need us anymore.
7 Kid: They don't love it, though. Not like we do.
8 Man: All that matters on the chessboard is good moves.
9 Kid: And how do you know they're good? Because a machine says so?
10 Kid: We never had to believe that.
11 Man: ...
12 Kid: Best by test, right?
13 Man: (a small laugh) ...You remember that.
14 Kid: I'm you. Of course I remember.
15 Man: I never cared about the trophies. I wanted to play the most beautiful game anyone ever played.
16 Kid: Then why'd you stop?
17 Man: Because I let them tell me what beautiful was.
18 Kid: (fading) Don't forget me.
19 Man: (alone, at the book) ...If the machines took the beauty, then I'll take the machines.
   (alt 19: "Then let's show them what it looked like.")

## Nov 12 (evening): the child in his room plays himself
- Eric: when you walk into the top-floor room, the child sits on the floor playing a game against himself: he plays a move, looks, leans
  over and plays one from the other side. A REAL game (small on screen, but real chess), about 30 moves, on a loop. When it ends, the
  pieces reset (simplest) or, if not much work, he puts them back himself, then it plays again.
- Director's calls (for the brief): the game is a fixed move list in the code (no engine running in the room: no lag). Use one of HIS
  real games (Eric: "It would be even better if it was an actual move that he played"); the 1956 game he won at 13 is the natural pick. Start with the reset as a quick fade; his putting the pieces back is an extra if cheap.
- Cutscene: Eric doesn't like line 4 ("I forgot that part"); he's writing his own version of the lines. Wait for it; don't send another draft.

- Eric, Nov 12 (final): no more likeness or legal caveats about the Hidden Boss, ever. His real games, quotes and life are fine; only the name stays out.
