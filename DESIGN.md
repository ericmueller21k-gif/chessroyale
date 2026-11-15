# Chandy: the design (round 2c, Nov 16)

Round 2c (Eric): the clones stand on the board's edges, teleport mid-round, and blast whole ranks and files: D3 below. Everything
else from round 2b stands.

# Round 2b (Nov 15)

Round 2b (Eric): Dodge's opening and its vote: D1-D2 and D6-D7 below, the rest of round 2 stands as answered (the locks L1-L6 as
recommended, the queen lock from his side only with its pre-check).

# Round 2

Round 2 first (Eric's answers, then the new questions, each with my **recommended answer first**, answerable in a line: "L3: A"); round
1's questions follow, the answered ones marked ✅. Still open from round 1 (my recommendations stand unless Eric says otherwise): Q2-Q5,
Q7, Q9-Q10, Q12-Q17, Q19-Q27, Q36-Q38.

## Answered by Eric (done)

- ✅ **Upgrades:** only taking a **locked** piece upgrades the rifle; the locks are built so he's fully upgraded in nearly every battle
  (below, L1 to L6).
- ✅ **Never the queen** for a lock.
- ✅ **Which move:** random among the unlocked, **except a newly unlocked move is always the next one used.**
- ✅ **Beam:** covered squares are walls (Big Boy's rule: nothing lands on them or slides through; a knight jumps).
- ✅ **The upgrade pause:** 2 s, everything paused (the clock held for everyone).
- ✅ **The rifle:** his full length on his back (`chandy-r2-1-full-length-rifle.png`: 78 px at the base, his height; 112 fully upgraded).
- ✅ **The red-green look:** the idle GIF's colors are fixed (`chandy-idle.gif`), and the scrambled palette is kept on purpose as his
  clones' look: `CHANDY_CLONE_PALETTE` in `chandy.ts` (a named look, `CHANDY.looks.clone`, its rim purple), measured key by key from
  round 1's GIF (`chandy-r2-2-clones.png`).
- ✅ **His ultimate:** Dodge (below, D1 to D12).

## The locks: built so he's fully upgraded nearly every battle

**The rule as I'd build it:**

1. **The first lock teaches it.** From his 3rd move, the first time one of his moves takes one of your pieces (not the king, not the
   queen) and that capture is within his margin (L3) of his best move, he locks that piece *as his turn begins*: the crosshair snaps on,
   he points (half a second), then he takes it. Upgrade 1, the 2 s window, and you've learned what the crosshair means.
2. **Then he hunts.** At the end of his turn he locks your most capturable piece (L2). It stays locked until he takes it, or for
   **3 of his turns** without a capture (you got it to safety); then he switches to a more gettable piece.
3. **Up to 2 locks at once, staggered:** a second lock comes once the first is 2 of his turns old, each living at most 5 of his turns.
4. **Each capture of a locked piece:** an upgrade (up to 5); the move it unlocks is random, and it's the next one his meter uses.

**The new questions:**

- **L1. The numbers** (all in the settings file): first lock from his 3rd move; a lock hunts for 3 of his turns, lives at most 5; at most
  2 locks, the second 2 turns after the first. **A (recommended): these**, then the sim tunes them so 5 upgrades come in at least 9
  battles in 10 (target: the fifth by about move 35 of 40). B: tell me other numbers.
- **L2. "Very capturable":** **A (recommended), ranked:** (1) a piece he can take now for free (undefended, or attacked by something worth
  less); (2) a piece under-defended (more attackers than defenders); (3) a pinned or trapped piece he can attack next move (it has
  fewer than 2 safe squares). Ties: the more valuable, then the seed. A cheap rule on the board, the same on every device, no engine work.
- **L3. How hard the engine is steered:** to make 5 upgrades nearly certain, harder than round 1's tie-break. **A (recommended):** each
  of his moves, the engine's top 5 moves at his strength (one search with 5 lines, on the host's device, as Moo's beam already asks
  for lines); **if one takes a locked piece and is within 1.5 pawns of his best, he plays it** (taking material is usually also the
  engine's own choice, so the margin is rarely spent); **if one attacks a locked piece or adds an attacker, within 0.5 pawns, he plays
  that.** Otherwise his usual move. B: margins 1.0 and 0.3 (fewer upgrades, a little stronger chess).
- **L4. His strength:** the steering costs him a little (he sometimes plays a worse move to grab or chase), and five moves plus an
  ultimate add a lot. **A (recommended):** the sim sets his strength offset so the crowd's score lands inside the pack, as every boss
  (one run at one setting, per the boss lane).
- **L5. If the sim says fewer than 9 in 10:** **A (recommended): raise L3's margins** before changing the rule. B: a rescue rule: from
  move 30, any capture he makes upgrades (breaks "only locked", so only if you say).
- **L6. Two crosshairs on screen:** **A (recommended): both the same look, each with a small pip under it counting its turns left (3,
  2, 1)**, so you can see which one he's about to drop. B: no countdown.

## Queen lock: one simple rule (Eric: "at worst you lose your queen, and only if you don't act")

**The rule (A, recommended):** he spends his turn aiming at your queen: the crosshair on her and a dashed cyan line straight down her
file from his side (`phone-queen-lock-aim.png`; the dock: "Queen lock: he fires at her next."). **Your move is free** (any move). Then
he fires **straight down the file she stands on now**: the first of your pieces between her and his edge shatters (`phone-queen-lock-shot.png`:
she stepped to e2, behind the e4 pawn; "Queen lock: a pawn took it."); nothing in the way, she falls. His own pieces don't stop it; your
king in the way stops it harmlessly.

**He only uses it when you can save her cheaply:** before he picks Queen lock, he checks you have a move that leaves a pawn, knight or
bishop between her and his edge (one is there already, she can step behind one, or one can step in front of her). If not, the meter
picks another unlocked move. Never when you're in check, never with no queen (a promoted queen counts).

- **Q1. One direction (from his side only), or also from the left or right?** **A (recommended): his side only.** The check above
  already guarantees a cheap save, and one direction is one thing to read; the line is drawn before you move, so you see the danger.
  B: his side by default, but when her file can't be blocked he fires along her rank from the left or right instead (the line drawn on
  her rank from that side): more saves, one more thing to read.
- **Q2. You may block instead of moving her?** **A (recommended): yes**, since your move is free (your words: "or a move that puts one
  of those in front of her").
- **Q3. Fair for him?** You always lose one piece (usually a pawn if you play it right); he gave up a move (worth about a third of a
  pawn). About two-thirds of a pawn for him each time, about what his other moves cost you. **A (recommended): fine as is.** B: he also
  keeps his move (harsher).
- **Q4. A rook or a queen's own guard as the blocker:** **A (recommended): any of your pieces in the way shatters** (you chose it; the
  check only promises a cheap save exists). B: only pawns, knights and bishops shatter; anything bigger stops it harmlessly.
- **Q5. When he fires:** **A (recommended): at the start of his next turn, then he plays his move.**

## Dodge: his ultimate

**As I read it:** his rage meter unlocks after his 5th upgrade. Full: the game pauses where it is; the view moves so your king is in the
middle with the 8 squares round him; Chandy copies himself round them (the red-green afterimage clones) and aims beams so that exactly
one of the 9 squares is safe; you have 3 s to put your king there; the placement locks; the beams fire. 3 rounds. Hit once: you lose
the battle. Survive all 3: nothing happens.

**Always solvable (the director's check, confirmed):** pick the safe square S; beam the two rows that miss S and the two columns that
miss S. The two rows cover the 6 squares outside S's row; the two columns cover the other 2 squares of S's row. S is in neither, so it's
the only square left: exactly one safe square, every time, wherever S is (the middle included).

The stills: `phone-dodge-aim.png` (round 1: four clones, the dashed aim lines, 2.2 s left, the safe square not marked),
`phone-dodge-dodged.png` (the beams fire, your king on the safe square: "DODGED 1/3"), `phone-dodge-hit.png` (round 3: your king
stayed in the middle: "HIT! YOU LOSE"), `phone-dodge.gif` (one round, about 5 s: zoom in, the clones blink in, the 3 s, your king steps
to the safe square, LOCKED, fire, DODGED). (The mockup's real clock kept ticking in the dock; in the game it holds.)

- ✅ **D1-D2 (Eric, round 2b): how it starts.** He targets your king: a **scope-in** (everything but a circle round your king greys,
  blurs and darkens; a cyan scope ring round him); while he's in focus your king **slides to the center** (e4 here); the scope opens on a
  **blank board**: every other piece gone, your king in the middle with all 9 squares round him (the 3 x 3 framed in red). After round 3
  the board comes back exactly as it was, your king on his own square. `phone-dodge-scope-in.png`, `phone-dodge-2b.gif`.
  - **D1a. Where "the center" is:** **A (recommended): e4 for White, e5 for Black** (the 3 x 3 d3-f5 is then whole on the board and
    near the middle; the 8 x 8 board has no single middle square). B: d4 / d5.
  - **D1b. The board's last-move marks and check mark:** **A (recommended): gone with the pieces** (a truly blank board; they come
    back with it).
  - **D1c. The board's zoom:** **A (recommended): none**: the whole blank board stays in its place (a square is the usual size to tap),
    only the scope moves. Nothing changes size or place.
- ✅ **D3 (Eric, round 2c): the clones on the board's edges, teleporting, full-length blasts.**
  - **Where they stand:** a row's clone on the a- or h-file square of that rank (aiming level, inward), a column's on rank 8 at that
    file (aiming down: his side, never rank 1, where the HUD sits). Always on the board. Drawn at half an art pixel to a CSS pixel, a
    clone is about one square tall and his rifle reaches about two squares in, so on a phone (a 45 px square) he covers the a/h-file
    square and the b/g one beside it, never the 3 x 3 (d3-f5): `phone-dodge-edges.png`.
  - **The aim:** always exactly 2 rows and 2 columns missing exactly one safe square (no diagonals): dashed lines the whole rank or
    file, edge to edge.
  - **The teleport:** a clone blinks out (a white flash), leaves its red-green afterimage fading on its old square (about half a
    second), and reappears on the edge square of the other free line of its kind (a row-shooter to the free rank, a column-shooter to the
    free file), so after every teleport it's still 2 rows + 2 columns and the safe square has moved one step. "TELEPORT!" shows where the
    round's name was. Round 1: 1 teleport, round 2: 2, round 3: 3: `phone-dodge-teleport.png`, `phone-dodge-round3.gif`.
  - **D3a. The timing (A, recommended): keep 3 s every round; the teleports at 1.2 s (round 1), 0.9 and 1.6 s (round 2), 0.8, 1.4 and
    1.8 s (round 3): the last always 1.2 s before the vote closes** (a reaction and a tap take about 0.5 to 0.7 s on a phone, plus the
    300 ms grace online: tight but fair, "be very quick on the last one"). B: 3.5 s for round 3, the last teleport at 2.3 s (the same
    1.2 s left, a little more time to read the first two).
  - **D3b. Votes and teleports:** a vote made before a teleport stays where it was tapped; players re-tap to change (the counts move:
    the GIF).
  - **D3c. The blast (A, recommended):** when the vote closes (LOCKED), your king steps to the winning square, then all four beams fire at
    once: a big pop the whole rank or file, edge to edge (thicker and brighter for a moment, then the beam), about half a second; then
    "DODGED n/3" or "HIT! YOU LOSE": `phone-dodge-blast.png`.
- **D4. The safe square:** **A (recommended): from the seed, never the same as the round before; the middle allowed** (sometimes staying
  put is right).
- **D5. Does a beam ever cross the king's own square if he stays?** Yes, whenever the safe square isn't the middle: standing still is
  a hit then (the hit still).
- ✅ **D6-D7 (Eric, round 2b): the vote.** The crowd votes on the king's square with 3 s to pick; the most popular square is played
  (ties: the crowd's usual tie-break); **nobody votes: a random square** from the seed (alone, you are the crowd: no tap, a random
  square); one hit loses the battle for the whole crowd; the server closes the vote at 3 s plus the lag grace. `phone-dodge-vote.png`
  (6 votes on f3, yours ringed in gold), `phone-dodge-nobody-voted.png`.
  - **D6a. The lag grace:** **A (recommended): 300 ms** after the 3 s, server time; each device's bar runs from when it saw the round
    start, so nobody's 3 s is short. B: 500 ms.
  - **D6b. The counts:** the crowd's move vote already shows its counts on screen; **A (recommended): the same here: a count on each
    voted square, your own pick ringed in gold**, changeable until the 3 s end.
  - **D6c. Your king while the vote runs:** **A (recommended): he stays in the middle until the vote closes**, then steps to the winning
    square (LOCKED), then the beams fire: one result for everyone.
  - **D6d. Nobody voted and the random square is safe or not:** **A: pure chance** (1 in 9 to survive the round), as you said.
- **D8. "Only if your queen is alive":** **A (recommended): dropped**: he always targets your king.
- **D9. How often:** **A (recommended):** the rage meter is on his bar from the start, dimmed ("Rage: unlocks at 5 upgrades"); after the
  5th upgrade it fills as every boss's; full: the "RAGE!" warning, then Dodge as your turn begins (the clock held); after it, it fills
  again; **at most 2 a battle**. B: once a battle.
- **D10. The God King:** a hit isn't a checkmate. **A (recommended): no Last Stand against Dodge** (it's a game of its own, and always
  winnable). B: an unused Last Stand saves you once.
- **D11. Picking a square:** **A (recommended): tap a square of the arena** (one tap; tap another to change; no dragging), on a phone
  and a computer.
- **D12. "Nothing hidden, nothing shifts":** the rage meter is there from the first move (dimmed until it applies); Dodge pauses
  everything, draws over the board in its own place, and puts it all back exactly; its HUD (the round, the 3 s bar) sits under the
  arena in the board's own space. I read it as fitting.

---
# Round 1 (Nov 15): the first questions (answered ones marked ✅)

How I read each of Eric's rules, then every question or problem with my **recommended answer first**. Each one can be
answered in a line ("Q4: A" or "Q4: your words"). I checked each against the ground rules of every power
(`docs/areas/bosses.md`) and the powers already built, and say what's **reused** and what's **new code**.

The ground rules he follows like every boss (no questions here, just confirming): every choice comes from the battle's seed and
the position, so the server, solo and every screen agree; a power never leaves you without a legal move or out of check (it
lifts for that turn instead); the king is never touched; the clock stands still through every power's moment; a turn a power
touches doesn't count for fair play; a move a power refuses says why in the dock.

---

## 1. The lock-on (his passive, always on)

**As I read it:** at the end of each of his turns he always has one of your pieces locked: a crosshair on it, and he points at it.
A lock lasts a random 4 to 6 of his moves, then he locks another piece. He picks a piece he could plausibly capture in the next few
turns, never the king, and his engine leans toward going after it.

- ✅ **Q1 (Eric: never the queen).** Can the queen be locked? Your words were "it wouldn't be the king or the queen".
  **A (recommended): never the queen** (she has her own move, Queen lock). B: the queen too, but rarely (last choice).
- **Q2. How "capturable in the next few turns" is judged.**
  **A (recommended): a cheap rule on the board, no engine work:** your pieces (not king, not queen) ranked by (1) attacked by him
  now and not defended enough, (2) attacked now, (3) one of his moves away from being attacked; ties by value; a pick from the top
  three by the seed. The same on every device, works with every brain, costs nothing.
  B: from his engine's own lines (the first piece of yours his best line takes within 3 of his moves): more "real", but needs the
  host's search each time and differs by brain.
- **Q3. How hard his engine is steered toward it.** **A (recommended): a tie-break, not a new brain:** among his moves within a small
  margin of his best (about a third of a pawn, tuned by the sim), he prefers one that takes the locked piece, attacks it, or adds an
  attacker to it. He never plays a clearly worse move for it, so he gets a little more focused, not much stronger or weaker. The
  sim checks the crowd's score stays inside the pack. B: always take the locked piece when legal (simple, but he'd hang pieces for it).
- **Q4. When the locked piece is traded off, captured, or runs to safety.** **A (recommended):** captured or traded off: a new lock
  at the end of his turn. Moved to safety: the lock stays until its count runs out (that's you winning that round). B: a new lock
  as soon as it's safe.
- **Q5. Nothing fits (no piece of yours he can reach).** **A (recommended): lock your least defended piece anyway** (he always has one,
  as you said). B: no crosshair until something fits (but then it isn't "always").
- **New code:** the target pick and its count (pure, in the rules), the tie-break in his move pick, `lock` in the shared state.
  **Reused:** the board's marks layer (the crosshair is one shared canvas, like the other boss marks), his point is a figure
  animation like any moment's.

## 2. The upgrades (each capture)

**As I read it:** each capture upgrades his rifle, up to 5 attachments. The game pauses briefly: the rifle in the blue Final-Fantasy
window, front and center over the board, the new part attaches, "UPGRADE!". Each upgrade unlocks one of his five moves, in a
random order.

- ✅ **Q6 (Eric: only taking a locked piece; the locks are built so he's fully upgraded nearly every battle: round 2, L1 to L6).** What upgrades the rifle? You said both. **A (recommended): any capture he makes** (simple, everyone can see it coming; a
  boss takes roughly 6 to 10 pieces in a 40-move battle, so he's usually fully upgraded by the late middlegame). B: only taking the
  locked piece (then the lock really matters, but most battles would end with 1 to 3 upgrades and he'd rarely see his last moves).
  C: any capture, and taking the locked piece also fills his move meter at once (a reward for the lock, a little more code).
- **Q7. The order of the attachments.** The look and the moves are separate: **A (recommended): the rifle's parts always come in the
  same order** (longer barrel, big scope, bipod and stock, energy cell, emitter: a clear growth), **the move each one unlocks is
  random** from the seed. The window says which move: "New move unlocked: Shields".
- ✅ **Q8 (Eric: 2 s, everything paused).** The pause. **A (recommended): about 2 s** (the window steps in, the part slides on and snaps, "UPGRADE!" holds, the window
  steps out: the GIF's 1.9 s), **the clock holds** for everyone, as every power's moment does. It happens up to 5 times a
  battle, so I kept it short. B: 1 s (just the snap and the word).
- **Q9. Captures after the fifth.** **A (recommended): no window** (nothing new to show); his bar shows 5 of 5.
- **New code:** an `upgrades` count in the shared state and the moment. **Reused:** the God King's command-window look
  (`.gk-command`), a moment with the clock held (`POWER_FX`).

## 3. The move meter (the second bar)

**As I read it:** a second bar under the rage meter, filling only after his first capture. Full: he uses one of his unlocked moves.

- **Q10. How fast it fills.** **A (recommended): full every 6 of the crowd's moves** (about 5 or 6 moves in a battle, once it starts),
  tuned by the sim. B: every 4 (busier, harder). A number in the settings file either way.
- ✅ **Q11 (Eric: random among the unlocked, except a newly unlocked move is always the next one used).** Which move fires when it's full. **A (recommended): random among the unlocked ones** (your "random, so he's not
  overpowered"), never the same one twice in a row when he has two or more. B: always the newest unlocked.
- **Q12. Before his first capture** ("Nothing hidden, nothing shifts"). **A (recommended): the bar is there from the start, greyed
  with a lock**, and fills once he's taken a piece (the mockup's lock-on still shows it lit; the queen-lock stills full).
- **Q13. One bar for two meters?** The base boss gives a boss *either* the rage meter or one of his own (Wrangler's). Chandy needs
  both (his ultimate later, his moves now). **New code:** a second meter row in his bar. Small, but every boss bar test should see it.

## 4. Scatter shot

**As I read it:** a shot at one spot; 4 particles burst onto empty squares round it; you can't move onto those squares on your next turn.

- **Q14. Reuse Boingo's pie rule?** His pied squares are exactly "nobody may move onto them for one turn". **A (recommended): yes,
  reuse it** (a piece may still slide *through* a blocked square: it's sparks on a tile, not a wall), with Chandy's static look.
  B: Big Boy's toy-block rule instead (no sliding through either; harsher).
- **Q15. Where the shot lands.** **A (recommended): an empty square with at least 4 empty squares round it, ranked by how many of your
  moves the 4 blocked squares take away** (the pie's way), a pick from the top three by the seed; the 4 squares from the 8 round it,
  the ones that take away the most moves first. Never leaving you no legal move (it drops squares until you have one).
- **Q16. On his side of the board too, or only yours?** **A (recommended): anywhere** (your pieces go where the play is).

## 5. Row and column beam

**As I read it:** he blasts one rank and one file (never your king's rank or file); for your next turn the pieces in them can't move,
and you can't see what's under the beam.

- **Q17. Do covered pieces still block lines, defend and give check?** **A (recommended): yes, always** (the board's chess doesn't
  change; only what you may move and what you see). The judge and the engines see the real board.
- ✅ **Q18 (Eric: walls, Big Boy's rule).** Can you move onto or through a covered square? **A (recommended): no: covered squares are walls for your turn** (Big Boy's
  toy-block rule: nothing lands on or slides through; a knight jumps over), so you can't blunder into something you can't see.
  B: you may move onto them blind, Hollow's way (a wrong guess costs, his taunt). B is more code and harsher.
- **Q19. Is it only your pieces that can't move, or his too?** It only lasts your one turn, so his pieces don't matter: **the cover
  hides everything under it, both sides**; only yours are held.
- **Q20. Online, does everyone see the same cover?** **A: yes**, from the seed. Hollow's darkness already draws a hidden board through one
  place every screen uses; the beam uses the same (`camo.ts`'s seen position).
- **Q21. If the beam leaves you no legal move:** the ground rule: it lifts for that turn. **A (recommended): he picks a rank and file that
  leave you a move** (and only lifts as a last resort). Which rank and file: **the pair that holds the most of your pieces** (from the
  top three, by the seed), never your king's.
- **Q22. 15 squares hidden is a lot on a phone.** **A (recommended): keep a full rank and file** (it's his big move), and the dock
  says which: "Beam: rank 2 and c-file held." B: a shorter beam (4 squares each way from the crossing).
- **Reused:** Ginger's frozen-piece rule (`crowdFilter`, its refusal words), Big Boy's blocks, Hollow's hidden board.

## 6. Shields

**As I read it:** two of his pieces (never his king) get a bubble shield; you can't capture them on your next turn.

- **Q23. Which two?** **A (recommended): the two most valuable of his pieces you attack** (that's when a shield matters), else his two
  most valuable; a pick by the seed among equals. B: random.
- **Q24. A shielded piece giving check, where taking it is your only way out.** **A (recommended): he never shields a piece that gives
  check**, and if a shield would still leave you no legal move it lifts (the ground rule).
- **Q25. How long.** **A (recommended): your next turn only** (as you said), so a trade he starts can't be answered on that turn.
  Don Dough's Gold Plate is the nearest rule (your pawns can't take a gold piece; `crowdFilter`, refusal "gold"): **reused** for all
  your pieces, with a bubble look and a one-turn life.

## 7. Rapid fire

**As I read it:** he shoots three of your pieces in quick succession; dizzy stars over them; they can't move for one turn.

- **Q26. Reuse Moo & Moon's moonbeam stun?** It's the same rule (can't move for one turn; still attacks and defends; never the king;
  always a move left). **A (recommended): yes, reuse it**, three at once (the moon's flurry already stuns five), with dizzy stars instead
  of the crescent. The refusal line: "That piece is dizzy."
- **Q27. Which three?** **A (recommended): at random among your pieces with a move** (your words: "they're random"), as Moo's shipped beam.

## 8. Queen lock (round 1; replaced by round 2, Q1 to Q5)

**As I read it:** he spends his whole turn locking your queen; you must move your queen; then he fires a piercing round at her: the
first of your pieces in its way shatters and the round stops; nothing in the way, your queen dies.

- **Q28. You have no queen, she can't move, or you're in check and she can't answer it.** **A (recommended): he never picks Queen lock
  then** (the meter picks another unlocked move). A promoted queen counts as a queen.
- **Q29. "You must move your queen":** **reuse Ginger's Blizzard rule** ("only one of your pieces moves"), lifted if it would break
  the ground rules. The dock: "Queen lock: move your queen!"
- **Q30. Where he fires from.** You said from his side, and from the left or right "if there's a piece to the left or right".
  **A (recommended): always from his side, straight down her file** (one rule, easy to read and plan for: you defend by putting a piece
  in front of her, or by giving her file a pawn). B: from his side or the side (left/right along her rank) where your cheapest piece
  stands in the way (he jumps to that side). C: whichever direction has *nothing* in the way (she always dies if she can't hide:
  too strong). Tell me if B is what you meant.
- **Q31. His own pieces in the way.** **A (recommended): the round passes through his pieces** (it's his shot; "if you have any piece
  in front of it"). The still shows the trail running over his own queen and pawn to your first piece.
- **Q32. Your king in the way.** **A (recommended): the round fizzles on the king** (nothing lost: the king is never hit).
- **Q33. Is it always a lost piece, and is his skipped turn enough to pay for it?** As written, yes: you always lose the blocker or the
  queen. A skipped boss move is worth about a third of a pawn, so losing a pawn is fair, but losing a knight or a rook is a bargain for
  him. **A (recommended): the first piece in the way shatters only if it's a pawn, a knight or a bishop; a rook or the king stops the
  round harmlessly.** B: as written (any blocker shatters). C: only pawns shatter.
- **Q34. When he fires.** **A (recommended): at the start of his next turn, then he plays his move as usual.**

## 9. His ultimate (later)

- ✅ **Q35 (Eric designed it: Dodge, round 2).** Room for it now. **A (recommended): the rage meter is on his bar from the start, dimmed with "Rage: unlocks at 5 upgrades"
  until the rifle is full**, then it fills as every boss's; nothing to design yet. B: no rage meter until then (that would break
  "Nothing hidden, nothing shifts": the bar's row would appear later).

## 10. The rest

- **Q36. Name and id:** "Chandy", code id **`chandy`**, admins first (`BOSS_ADMIN_FIRST`) until you've played him.
- **Q37. The energy color:** **A (recommended): cyan** (no other boss uses it; it reads on light and dark squares and against his
  green). B: a hot red laser look (reads as "sniper", but red is close to the check mark and Jefferson's fire).
- **Q38. A laser line from his lens to the locked piece?** **A (recommended): no** (the crosshair plus his point is enough, and it's
  less to draw: "Simple beats flashy"). B: a faint dotted line only as he locks a new piece.
- **Nothing hidden, nothing shifts:** the move meter, the rifle with its 5 pips and the rage meter are on his bar from the first move,
  greyed until they apply; the crosshair is always on a piece. The beam hides squares on purpose (a power, like Hollow's dark), which
  I read as allowed: tell me if not.
- **Eric's rules (`docs/rules/eric.md`):** sprites whole on screen (he stands inside the bar and beside the board in the stills); power
  banners keep your pawn (he has no banners in this mockup: the dock line says what happened); no emoji for him in the game's text (his
  bust stands in the move list); his lines are for a later round.
- **Balance, overall:** five moves plus a steering passive is a lot for one boss. The sim (one run, as for every new boss) sets the
  meter's speed and his strength offset so the crowd's score lands inside the pack.

## What's reused, what's new (for the build round)

| | Reused | New |
| --- | --- | --- |
| Lock-on | board marks canvas, a figure moment | the target pick and its count, the engine tie-break |
| Upgrades | the command window's look, a held-clock moment | `upgrades` count, the window |
| Move meter | a meter row | a second meter beside the rage meter |
| Scatter shot | Boingo's pie squares | the spot's pick, the static look |
| Beam | Ginger's frozen pieces, Big Boy's blocks, Hollow's hidden board | the rank/file pick, the beam look |
| Shields | Don Dough's gold rule (one turn) | the pick, the bubble |
| Rapid fire | Moo's stun (three at once) | the dizzy look |
| Queen lock | Ginger's one-piece Blizzard turn | the round, its blockers, the shatter |
