# Brief: boss challenge, round 2 (layout, table and chairs, default intro for other bosses)

Branch `claude/boss-challenge` (PR #466, open; worktree `/home/user/cr-challenge`). Push to the same branch. Opus high. Push as you go.

## Eric (Nov 2, after the intro GIF)
"For Alfil he shattered the pyramid, that's fine for him, but for other bosses they should just be swinging for a few seconds like
discussed. Also in the gif the chairs are not on the right side where the chess board is. I also prefer the normal look is boss
on left, you on right, not vertical, but I'm ok if it's some for some bosses and the opposite for others; just be sure the
table and chairs and pieces all are logically placed."

## Do
1. **Layout per boss** (`BOSS_INTROS` gets a `layout: "across" | "facing"`; default "across" = boss on the LEFT of the table,
   you on the RIGHT, side by side across the screen). Alfil's room has its start marks drawn north/south: choose for him what
   reads best (across, with your marks moved to the circle's west/east, or keep facing); say why, with stills of both.
2. **Table, chairs and pieces logical**: the chairs where the two players stand (one chair at each player's side of the table,
   nothing on the empty sides), the board turned so each side's pieces face its player (yours white, nearest you; the boss's
   black, nearest it). Check the town's park table geometry and turn/recolor it as needed. The players stand at (or sit on, if
   it reads well) their chairs.
3. **Other bosses: the default intro** (no custom board art): walk in with you, the line in the bubble by its head, the table and
   board simply appear between you (a short pop or dust puff, nothing elaborate), the boss swings its God King attack for a
   few seconds (its `kingAttack` with sounds, just swinging in place, not hitting anything), then a default transition (a quick
   Pokémon-style flash and wipe to black: your call, short), the battle loads under it. Turn it on for every boss that has a
   home with an inside: Babur and Puddles now (their rooms have battle circles), Alfil keeps his custom pyramid + sandstorm.
   Lines for Babur and Puddles until Gemini's arrive: one placeholder each in their voice (list them).
4. Keep the chat lines, the return to town and everything else from round 1.

## Done means
Unit tests updated (layout, chair sides, board orientation, the default intro's timeline). `e2e/boss-challenge.spec.ts` covers Alfil
and one default-intro boss (Babur). Stills: each of the three bosses at the table (phone + computer) and a GIF of Babur's default
intro. Update `docs/boss-challenge/pr-body.md` (add a "Round 2" section: changes, text, checks old → new).
