# Dash: Time Scramble's seconds by use, and "Hang on" replaces his second pop-off (Nov 26). Opus xhigh. Boss lane.
Branch `claude/dash-hang-on` from main. Eric wants it live tonight (he's asleep): the director merges when CI is green.

You are the `god-king` delegate (`.claude/agents/god-king.md`). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`,
`docs/areas/bosses.md` (Dash), `packages/chess/src/bosses/dash.ts` (header), `docs/decisions/2026-11-03-dash.md`, `2026-11-06-dash-v2.md`,
`2026-11-07-dash-clock.md`, his art `packages/app/src/characters/boss-blitz.ts` and screens.

**Eric, Nov 26 (his words):**
1. Time Scramble: "the first time he fires it off is 5 seconds for 3 moves, and then when he does it again, it's 3 seconds for 3 moves.
   Yeah, I think that's fine with that slight like network allowance." → `scrambleSeconds` by use: [5, 3]; `scrambleMoves` 3 (check
   it is 3 now); the existing network allowance kept as is. The FAQ and the countdown say the right seconds each time.
2. His pop-off (twice a battle): the FIRST stays as it is. The SECOND is replaced by a new gag, "Hang on" ("so actually this is replacing
   the second time he does the pop off, so he only does that one like long one, and then instead of doing it again, he does this"):
   - "when it's your turn ... you move, and then he moves your piece back to where it [was], and he says like, hang on 1 second ...
     your clock keeps ticking, and we can just make this whole thing sort of like a drawn over, whatever's easiest, so it doesn't actually
     mess with the game ... at this point your move is already confirmed."
   - "he starts like hitting his clock sort of like slowly, and then he starts ramping it up ... the whole thing lasts like 12 seconds
     ... [around] 6 [to 8] seconds [he says] time for cheetah speed, and then he starts going like super fast ... he's got his like head
     like looking up in the air with his mouth open, like he's really enjoying himself, and then he says something like, almost done,
     bro [/ 1 second, bro, almost done]"
   - "when he finishes, he like presses it, or he like does the winding on the front of the clock, and then he's like ... sorry about
     that, bro, like I'll give you your time back, and then he gives you back however many seconds long it took, and then your clock
     resets to where it was, and he moves your piece back, and then it's his turn."
   **Build it as presentation only** (Eric: "whatever's easiest, so it doesn't actually mess with the game"): your move is played and
   confirmed as ever; during his turn after it, the screen shows your piece slid back to its start square, your clock display ticking
   down (a display only, never the real clock), his clock routine (slow smacks ramping up, ~12 s, the head-up mouth-open pose and the lines
   at their beats), the wind-up, "Sorry about that, bro. I'll give you your time back.", the clock display counting back up to its real
   value, your piece sliding to its played square, then his move. One exported timeline with beats (like `dodgeTimeline().beats`), a
   setting for its length and line times in `settings.ts`. Online: the server holds his move for the gag's length (as it holds his other
   moments: `popOffMs`-style) and sends it as a moment; solo the same. Pre-moves: if you've pre-moved, keep it simple and record the call.
   Lines (his voice, American English): "Hang on, one second." / "Time for cheetah speed!" / "Almost done, bro." / "Sorry about that,
   bro. I'll give you your time back." (adjust lightly to fit his speech box in full, phone and computer; never cut off).
   Art: reuse his existing clock-smack frames sped up; add the head-up, mouth-open pose and the wind-up only if his rig can do them cheaply
   (else the nearest existing pose; say which). Watch it frame by frame with real taps once (`npm run frames:boss` or a scratch spec),
   phone and computer.
**Tests:** unit for the scramble's seconds by use (first 5, second 3), the gag replacing only the second pop-off, the real clock and the
game state untouched by it (your move stands, your time as before), the server's hold; one focused e2e check in Dash's spec (the gag
plays, the piece returns, the result unchanged), the boss kit. List checks changed old → new. Push 2-3 stills and a short GIF to
`stills/dash-hang-on` (never under docs/). FAQ, `docs/areas/bosses.md`, a decision note. About 2 hours. At the end commit and push
`.pr-body.md` and an empty `.done`, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`,
no Co-Authored-By.
