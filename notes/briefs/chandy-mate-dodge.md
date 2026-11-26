# Chandy's Dodge only when you checkmate him (Nov 26). Opus xhigh. Boss lane. Branch `claude/chandy-mate-dodge` from main (ac5cbe09+).

You are the `god-king` delegate (`.claude/agents/god-king.md`): boss powers, rules, server, protocol, timing. Read CLAUDE.md,
`.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/bosses.md` (Chandy's row and section), `packages/chess/src/bosses/chandy.ts`'s
header, `docs/decisions/2026-11-16-chandy-rules.md` and `2026-11-26-ult-danger.md` (merged today in #968).

**Eric, Nov 26 (his words):** "he'll only do it if you put him in checkmate. And then instead of the game ending right away, it pauses and
he jumps onto the center of the board and collapses, and then he reaches his arm out though towards your king, and that's when he zaps it
or whatever, and he's says something like, I'm not I've got one last trick up my sleeve, but something that's not that line, and then it
starts. ... if you fail that, you lose, and then if you succeed, then he's checkmated and it goes to the end game screen. ... if you do
succeed ... something a little extra too right before it ends, just clearly showing that you win."

**The rule:**
- The new trigger: the crowd's move checkmates Chandy (he hasn't used it; once a battle as now). The mate doesn't end the battle:
  everything pauses, the new opening plays (below), then the Dodge as today (blank board, your king to e4/e5, the warning volley, the 3
  rounds, `dodgeHits` 2).
- Fail (the second hit): the battle is his, as today (no Last Stand). Survive: the board comes back with your mate on it, the win beat
  (below), then the end screen as a crowd win by checkmate.
- **CORRECTED (Eric, Nov 26, a minute after: "it also triggers still from his 5 upgrades tho"):** two ways in, once a battle:
  (1) his `dodgeMeter` path stays exactly as it is (5 upgrades, then full over `dodgeAfterMoves`, the warning, the Dodge); (2) the new
  checkmate path above. Remove only the last-chance `mateOpen` path (a mate in one as your turn begins: the real mate replaces it) and
  #968's danger path for Chandy (`dangerAt`). If he already used the Dodge from his meter, your mate ends the battle as any mate. His
  bar's Dodge meter stays as it is (it still fills after 5 upgrades); add nothing hidden. The upgrades and his other moves are unchanged.
- A Battle Tower floor with Chandy and others: your call (simplest that's fair), recorded.
- The admins' trigger and `&power=dodge` test link: keep them working (they now start from a mate, or from the opening with the board
  as it is: your call).

**The opening (before the Dodge) and the win beat:** you build the timing and the hooks; the `characters` delegate draws them next, in
its own job, so leave clear beats: one exported timeline (as `dodgeTimeline().beats`) with these steps and durations, and the event(s)
the screen draws from:
1. the pause on your mating move (the board as it lands, a short hold);
2. he jumps onto the center of the board and collapses;
3. he reaches his arm toward your king;
4. the zap at your king (it then slides to the center for the Dodge as today);
5. his line, in his speech box (where his lines show now). Not "I've got one last trick up my sleeve". Write 3 options in his voice
   (special-ops alligator), pick one, list all 3 in the PR body for Eric;
then, after a survived Dodge: 6. the win beat: the mate shown clearly as yours (reuse what exists: the checkmate highlight, a win banner
or the God King's, confetti if the game has it) for about 1.5-2.5 s, then the end screen.
Until the art lands, steps 2-4 use Chandy's existing sprite poses (no new art in this job); the timeline is what the art fits.

**Online:** the server times it and sends only what's seen, as the Dodge now (`dodgeSeen`, `bossViewSent`); the result is decided by the
server. Solo the same timeline.

**Docs and tests:** the FAQ's Chandy entry, `docs/areas/bosses.md`, a decision note `docs/decisions/2026-11-26-chandy-mate-dodge.md`
(Eric's words, what changed, your calls). Tests: `chandy.test.ts` (the mate triggers it; no other way does; fail → his win; survive →
your win by mate; once a battle), the boss kit, `e2e` Chandy's Dodge spec(s) updated, `boss-smoke` for chandy. List every check changed
old → new in `.pr-body.md`; any eric.md guard touched needs Eric's OK: flag it, don't change it. Watch the new sequence frame by frame with
real taps once (`npm run frames:boss`), phone and computer; push 2-4 stills (the pause, the line, the win beat) to branch
`stills/chandy-mate-dodge` (never under docs/).

Budget: about an hour or two (CLAUDE.md's helper testing budget). Push at each real step. At the end commit and push `.pr-body.md` and an
empty `.done`, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no
Co-Authored-By. American English.
