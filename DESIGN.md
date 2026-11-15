# Chandy: the design questions (round 1, Nov 15)

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

- **Q1. Can the queen be locked?** Your words were "it wouldn't be the king or the queen".
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

- **Q6. What upgrades the rifle?** You said both. **A (recommended): any capture he makes** (simple, everyone can see it coming; a
  boss takes roughly 6 to 10 pieces in a 40-move battle, so he's usually fully upgraded by the late middlegame). B: only taking the
  locked piece (then the lock really matters, but most battles would end with 1 to 3 upgrades and he'd rarely see his last moves).
  C: any capture, and taking the locked piece also fills his move meter at once (a reward for the lock, a little more code).
- **Q7. The order of the attachments.** The look and the moves are separate: **A (recommended): the rifle's parts always come in the
  same order** (longer barrel, big scope, bipod and stock, energy cell, emitter: a clear growth), **the move each one unlocks is
  random** from the seed. The window says which move: "New move unlocked: Shields".
- **Q8. The pause.** **A (recommended): about 2 s** (the window steps in, the part slides on and snaps, "UPGRADE!" holds, the window
  steps out: the GIF's 1.9 s), **the clock holds** for everyone, as every power's moment does. It happens up to 5 times a
  battle, so I kept it short. B: 1 s (just the snap and the word).
- **Q9. Captures after the fifth.** **A (recommended): no window** (nothing new to show); his bar shows 5 of 5.
- **New code:** an `upgrades` count in the shared state and the moment. **Reused:** the God King's command-window look
  (`.gk-command`), a moment with the clock held (`POWER_FX`).

## 3. The move meter (the second bar)

**As I read it:** a second bar under the rage meter, filling only after his first capture. Full: he uses one of his unlocked moves.

- **Q10. How fast it fills.** **A (recommended): full every 6 of the crowd's moves** (about 5 or 6 moves in a battle, once it starts),
  tuned by the sim. B: every 4 (busier, harder). A number in the settings file either way.
- **Q11. Which move fires when it's full.** **A (recommended): random among the unlocked ones** (your "random, so he's not
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
- **Q18. Can you move onto or through a covered square?** **A (recommended): no: covered squares are walls for your turn** (Big Boy's
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

## 8. Queen lock

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

- **Q35. Room for it now.** **A (recommended): the rage meter is on his bar from the start, dimmed with "Rage: unlocks at 5 upgrades"
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
