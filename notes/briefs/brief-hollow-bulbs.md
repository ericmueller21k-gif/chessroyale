# Brief: Hollow's ten bulbs, his bigger darkness and his taunts (rules; Opus high)

Worktree `/home/user/cr-hollowbulbs`, branch `claude/hollow-bulbs`, from main (the director creates it). `npm ci`. Push as you go.
Ports 8989, inspector 9489. Include notes/briefs/rules-common.md. **This is a rules change (lane full e2e).** Record each call in
`docs/decisions/2026-11-05-hollow-bulbs.md`, add Eric's rules to `docs/rules/eric.md` with guards, and update the FAQ.

## Today (read first)
`packages/chess/src/bosses/hollow.ts`, `packages/core/src/settings.ts` (darkEvery 3, darkTurns 10, darkTryCost 5, darkTries 5,
lightsOut*), `packages/chess/src/runner.ts`, `protocol.ts`, the server's checks, `packages/app/src/characters/lights.ts` (his string of
Christmas lights, HOLLOW_LIGHTS), the FAQ.
- **The dark squares:** after his first move he covers the square of the piece he moved, then another on every 3rd of his moves.
  Each stays dark for 10 turns.
- **A move attempt that touches a dark square** goes to the server unchecked. An illegal one costs 5 points and you pick again; the
  5th such try in a turn ends the turn as a missed move.

## Eric's change (Nov 5, his words condensed)
1. **Solo: ten bulbs instead of points.** "It still says −5 when you are solo and do a wrong move. I thought we discussed like 10
   bulbs and each wrong play put one out."
   - A string of **10 bulbs** shows during a solo game against Hollow, in his own string of lights (lights.ts look and colours).
   - **Each wrong move puts one out**: an illegal attempt that touches a dark square, the same thing that costs 5 points today.
   - **At 3 and at 7 out, you're forced into a bad move**: that turn's move is played for you, and it's a bad one.
   - **At 10 out you lose outright.** The whole screen turns black, he says something, then you lose: the game ends as a loss.
   - The −5 doesn't apply in solo any more, and nor does the 5-a-turn rule (the bulbs replace them). **Crowd and raid games keep
     today's points**, because Eric only spoke of solo. Say so in the decision, and point it out in the report for Eric.
2. **Bigger darkness, everywhere he plays.** As well as the single dark square, he now also darkens **a few 2 x 2 blocks**
   (hiding what's in them: "if you don't know where say the bishop moves to in it, that's just your loss"), and **once a game a
   3 x 3 block for 2 turns**. Pick the cadence and how many 2 x 2 blocks a game. Every number goes in settings. Also choose the
   rules for placement, for example never all of a king's escape squares, and say what happens to squares that overlap.
   Anything moving inside dark squares stays hidden as today.
3. **His taunts on a misplay** (each wrong move, solo and crowd), in his speech bubble, at random without repeating back to back:
   "Nice try.", "What, can't play in the dark?", and about 6 more of your own in his voice (eerie, dry, a little smug; no real
   people or film quotes). Placeholder status, as with the other boss lines, until Eric's Gemini lines.
4. **The forced bad move (3 and 7):** pick a move from the low end of the judge's ranking. It must be genuinely bad, but say how
   bad, for example never one that gives mate in one, or that does. Show it as the boss "making you" play it: a short dark flash
   and a line ("The dark moves for you."). Your call on the wording.
5. **Total darkness at 10:** the screen fades to black, his line shows (for example "Lights out. Forever."), then the loss screen.
   It should be clear that you lost because the bulbs ran out, not because of a bug.

## Rules
- Fair play: the server decides every wrong move, bulb, forced move and loss. The client only shows them. Old games in play keep
  their rules: version the rule set as the other boss changes were.
- Re-run the boss sim for Hollow (solo and crowd) and keep his difficulty within the roster's band. Report the numbers, old → new.
- Sprites always on screen; no emoji for him anywhere (name and/or portrait).
- Sounds: a bulb going out (a small fizz/pop), the forced move, the blackout. Synthesized sounds must pass `boss-sounds-finite.test.ts`.

## Done
- **Unit tests:**
  - bulbs: each wrong move costs one; at 3 and 7 a forced bad move; at 10 a loss; crowd scoring unchanged;
  - the 2 x 2 blocks and the 3 x 3 block (cadence, the 2-turn length, placement rules);
  - taunts with no back-to-back repeats.
- **e2e, phone and computer:** a solo game against Hollow with the bulbs shown; a wrong move puts one out with a taunt; the forced
  move at 3; the blackout loss at 10 (with test switches to get there fast); a 2 x 2 block drawn.
- **Stills in `docs/hollow-bulbs/`:** the bulbs, a taunt, a 2 x 2 and the 3 x 3, the forced move, the blackout.
- **PR body in `docs/hollow-bulbs/pr-body.md`:** every player-visible change and its text, changed checks old → new, the lane
  (full e2e).
- Push, but don't open a PR. Send a short report.
