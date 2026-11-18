# Ginger: Super Freeze (a second meter). god-king lane + characters (art). Opus, xhigh. QUEUED after Big Boy (xhigh runs alone)

**Eric, Nov 18 (voice, word for word where it decides):** "for Ginger ... when he freezes a piece, he still has his freeze ... We're adding
another move for him, like another ult meter bar ... his ult still stays the same as Blizzard, but now he has a super freeze ... it'll
probably be around turn like 8 to 15 ... It doesn't need to be one that's already frozen because then it's easier to calculate. So he looks
at and he kind of finds a few pieces where yours are clumped, and he freezes the one that, and then ... the ice block gets bigger and bigger
until it hits all the squares around it ... nine blocks ... that animation might even take 4 or 5 seconds for him to do a charge up and make
an expanding ice block. And then again ... it's just frozen on your turn, and then they unfreeze for his turn."
Director's reading (to confirm with Eric): a second meter that fills to fire around turn 8-15; target = the crowd piece (never the king) whose
3x3 holds the most crowd pieces; every crowd piece in that 3x3 is frozen for the crowd's next turn (the king never; always a legal move left);
empty iced squares: passable unless Eric says otherwise; the ice shows through his turn's end, thaws as his turn starts; a 4-5 s charge-up and
expanding-ice animation on his turn (no clock runs); refills for another later (once or twice a battle). Full brief when Big Boy is done.

**Eric's answers (Nov 18, ~01:10 UTC):** empty iced squares passable, only the pieces frozen ("yea that works"); the king never frozen and
a legal move always left ("yes"); it fires "up to twice in 60 moves" (the meter refills; at most 2 a battle).

## The full brief (Nov 18): build it

Branch `claude/ginger-superfreeze` from main. About 2-2.5 h. Read CLAUDE.md, `.claude/agents/god-king.md`, `.claude/agents/characters.md`,
`.claude/LESSONS.md` (note the newest: real-flow tests, not only test switches; a boss's sounds are its own), `docs/areas/bosses.md` (Ginger:
Freeze, Blizzard; the boss template; meters), `docs/rules/eric.md`, the boss test kit, his code (`packages/chess/src/bosses/ginger.ts`, his
screen components, `characters/gingerbread*.ts`). Art by the paid API runner (`claude/boss-art`, `scripts/boss-art/run.ts`, Opus), never by
hand; cap $15, estimate first, log costs. Sounds: his own pack (`gingerbread-sounds.ts`) only.

**The rule (settings in settings.ts; record each call in a decision file):**
1. Unchanged: his Freeze (a piece iced every `freezeEvery` turns) and Blizzard (the rage meter).
2. **Super Freeze, a second meter** (its own bar beside his ult's, nothing hidden or moved: greyed until it charges), filling so it's ready
   around crowd turns 8-15; **at most 2 a battle** ("up to twice in 60 moves"); refills after use. Fires at the start of his turn (as his
   powers do), so no crowd clock runs during it.
3. **Target:** the crowd piece (never the king) whose 3x3 holds the most crowd pieces (ties: seeded), the same in solo and online.
4. **Effect:** every crowd piece in that 3x3, except the king, is frozen for the crowd's next turn, then thaws as his turn starts. Empty iced
   squares are passable (only the pieces are frozen). Always leave the crowd a legal move (drop frozen pieces nearest the edge of the 3x3 first,
   or the farthest from the center, until one exists; check answers too). An iced rook can't castle (as his Freeze).
5. **Never with Blizzard on the same turn** (one waits); never on a turn the crowd is in check if that would leave no answer.
**Screen:** a 4-5 s moment on his turn: he charges up (a new pose/loop), a blast hits the target, the ice block grows square by square until
it covers the 3x3 (an expanding block, cracked-ice look, his palette), a line from him (placeholders, his voice). The frozen pieces look iced
through the crowd's turn (his current freeze look, reused), then thaw. Light on a phone (cached frames, `@perf`). The meter shows its charge.
**Online:** the shared rule code; the server times his think so the moment fits (`fullMoonMs`-style: lengthen his think by the moment, no
clock runs); a reconnect shows the ice; protocol fields optional.
**Tests:** rules (target choice, the 3x3, never the king, a legal move always left, thaw timing, at most 2, the meter's timing ~8-15 in a real
battle with no test switch), the server lobby (same results, reconnect), the boss kit, e2e `ginger` spec (the meter, the moment, frozen pieces
can't move, thaw), a test switch `?boss=gingerbread&power=superfreeze`. One sim run at one setting (his raid sim) with today's main as the
control at the same seeds (the references are stale: see Big Boy's balance note), report both.
Boss lane, plus the review pass the director runs.

Done: `.pr-body.md` (under 60 lines; player-visible; changed checks old → new; art $; sim result vs control) and `.done`, end. Eric-only
questions: `.question`, end. No PRs, no CI waits.
