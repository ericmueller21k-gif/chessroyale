# The Hidden Boss's house in the town (Eric, Nov 12): notes, not started
How he works today (phases, rules, where he's met, the code): notes/hidden-boss-today.md.
Reference photo: notes/mockups/2026-11-12-eric-hidden-boss-house-ref.webp (a real building).
(The first house photo was replaced by the Brooklyn walk-up below. Eric, final: no likeness or legal caveats about him; only his name stays out.)
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
  notes/mockups/2026-11-12-eric-hidden-boss-building-ref.webp. In that style; no address plate or name on it.
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

## Nov 12 (night): the cutscene, Eric's version (cleaned up; "/" = a typing break)
How the text shows (Eric): typed out letter by letter, at most 5 or 6 words at a time; a line of two sentences types the first, holds
about a second, then types the next.
1 Kid: Why are you on the floor?
2 Man: I lost.
3 Kid: Do you still find them?
4 Man: Find what?
5 Kid: The moves / that make you laugh out loud.
6 Man: The machines find them now. // They don't need us anymore.
7 Kid: That's not the point.
8 Man: All that matters / on the chessboard / is good moves.
9 Kid: And how do you know they're good? // Because a machine says so?
10 Man: ...
11 Kid: Best by test, / right?
12 Man: I just wanted to play / the most beautiful game / anyone ever played.
13 Kid: Then why'd you stop?
14 Man: The computers. // They ruined everything.
15 Kid: Computers or no computers, / the best player in the world / is still the best.
16 Man: Do you really believe that?
17 Kid: I'm not sure. // The only one who can prove it / is right next to me.
-> segue: the kid fades, the book opens, the light, the cyborg.

## Nov 12 (night): Eric's big update (text, cutscene staging, the room's rules, the summoning)
**Text boxes:** each numbered line is its own text box, typed out. A line of two sentences types the first, holds about 1 s, then types
the second. One long sentence types all at once (no breaks inside a sentence). Each box stays long enough to read: err on the slow side.
Line 15 is two sentences: "Computers or no computers. The best player in the world is still the best."
**Staging on the board (phone and computer):** everything dims; a circular spotlight shines down on the center of the board with a
soft, feathered edge (no hard edge). The scene plays in that light.
**The kid appears:** a magical poof, materializing a foot or two ABOVE the board; he drops, lands, and his knees buckle (he fell from thin air).
**The room's rules (CHANGES the earlier plan: no more roaming town with a pending request):**
- To challenge, you wait IN the child's room. You can't just walk out: leaving asks "Cancel your game request?" (yes = leave and cancel).
- At most 4 players in the room at a time (per server/town instance). A 5th tapping the door: "The door is locked." and can't enter.
- (Still: the 5-minute cap, then "Sorry, not enough players." with OK.)
**The summoning (when the 4th arrives and the game starts):** a freeze frame: every player's sprite becomes a still image. The chessboard
on the floor shoots light rays outward and upward. The frozen players burst into particles, all at once, and are absorbed into the light.
The light and particles draw back, fall and splash into the board; the board wobbles up and down, settles; the room goes quiet. Then a
transition (director's choice) into the match.
**Order (director):** mockups first, two helpers in parallel: (A) the cutscene staging + the kid's arrival + the typed lines, (B) the room:
the child playing his real game on the floor, and the summoning animation with four stand-in players. Then, after Eric's look: the
building and inside in town (targeted); the room's rules and challenge (server, full lane, xhigh, alone); the child form in a match.

## Nov 13: room mockup round 1 reviewed (Eric)
Smaller board; he leans onto the board for his side, then gets up and walks round to play the other (slow and real; that's the point);
little arm stretch only. Room about half the floor area, snug: bed nearly on the rug, light falling more on the rug (he loves the light).
Asked whether side walls can be one continuous 3D surface instead of stacked flat panels: trying it in this room only (round 2).

## Nov 13: Eric's test kit (for the room-challenge build)
Eric: "What I need when it's live, 3 bots in the room already that join the fight when I challenge, as real humans, then buttons to
instantly win and trigger next phase on the next move."
- When the room and its challenge are built: an admin-only test mode where 3 bots already stand in the child's room and join his
  challenge as if they were real players (they count toward the 4, go through the summoning, play as party members).
- Admin-only buttons in every form: "Win this form": the next move beats the current form and the next phase starts (child -> adult ->
  cutscene/transformation -> four boards -> result).
- Now (Nov 13): the "Win this form" button for today's fight (adult form, phase 2) was added to the music helper's job.

## Nov 13: the chant's new lines (Eric, via the music session)
- During the chant, between the book landing and the crack: "Computation without creativity is nothing. // Now I have both." (Eric's pick.)
- Then (not final wording): "prepare yourself for the ultimate test of your skill". Director's draft: "Now prepare yourself. // This is the ultimate test."
- Lengthen rise-to-crack to fit both lines at the cutscene's typing pace (up to about 18 s; today 8.74 s); the last line can finish in the
  final second of silence before the drop. Send the final rise-to-crack time to the music session (session_01JuCWRs7vACHciUbhC3eY8V); it
  builds that cut in about 11 minutes. Build after #670 merges.
- FINAL (Eric, Nov 13, via the music session): 1 "Computation without creativity is nothing. // Now I have both."
  2 "Prepare yourself. // This is the ultimate test of your skill."

## Nov 13: Eric tests only when the whole thing is live
Eric: he'll test once everything is live: the 3-story house, the stairs, the room, all the animation, the 3 test bots, everything he's
described. No rush; one Opus builder at a time. Order: building -> chant lines + music cut -> the room challenge (server, xhigh: 4 max,
locked door, wait in room / cancel on leave, 5-min cap, summoning, the 3 admin test bots, Win this form in every form) -> the child form in
a match (Maia ramp, the ages growing, the house music) -> the cutscene before the transformation (ghost kid, spotlight, typed lines,
kneeling pose) -> tell Eric it's ready.

## Nov 13: walls inside his building (Eric)
All three rooms in his building (hall, landing, top room) use the one-surface side walls (the room mockup's drawSideWalls), not the
stacked cards. Sent to the building helper. (Other homes' rooms unchanged unless Eric asks; a later sweep is possible.)

## Nov 13: it plays through to the end, online (Eric)
Eric thought the four boards were already online (from 50 v 50). They aren't: phase 2 runs only solo (Boss alone, or a 50 v 50 final
reached solo against bots); online, beating his adult form ends the fight. Eric: "it should be... it plays through to the four boards...
It plays through till the end." New order: 1 room challenge (+3 bots, online 🏆) -> 2 his phase change + four boards ONLINE (xhigh, full
lane; it serves 50 v 50 finals too) -> 3 the child form -> 4 the cutscene. Then tell Eric.
- Eric, Nov 13: no admin gate for the Hidden Boss's building, rooms or challenge (the site is behind Cloudflare anyway); "push it live". The
  room-challenge job takes him out of BOSS_ADMIN_FIRST. Test bots and the 🏆 stay admin-only (test tools). #672 merges as is (his OK to push live).
