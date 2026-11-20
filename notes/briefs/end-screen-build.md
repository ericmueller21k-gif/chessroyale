# End screen: build the approved mockup (Nov 20). Opus, high. Targeted lane (screens + shared components); after levels-500 merges
Mockup: branch `claude/end-screen-mockup` (`.mockup` there has the full design, timings `FX`, sounds, calls; stills on `stills/end-screen-mockup`). Build it for real on every match end screen; don't merge the mockup page itself.
**Eric approved the animations ("they look very good"), with these changes and answers (Nov 20):**
- The big XP number is NOT pixel font: use the normal UI font ("we don't need to make the big xp number so pixelated I think normal is fine"). Same for the RP number and the "+150 XP" in the bar's slot.
- Bar span: follows `XP.perLevel` (500 after levels-500 merges).
- Ranked 1 v 1: its own result page, like the boss/tower end screen (not a card over the board), with the move-by-move below.
- RP lost: "RP LOST 14" (count goes down in red, bar drains).
- Tap anywhere (not on a button) skips the sequence to its end state.
- 50 v 50, Squads, auto chess: same headline, XP and quests, their own middle (podium/squad), per mockup Q5 (director's call, the recommended one).
- Earlier answers: every match end; loss = "Defeat" + "Floor X lost · N lives left" (red, no blink) + gloating bosses 1-2-1 + XP; drop avg time and power-ups tiles; ranked RP above XP with the same count-up and lob. Never show the floor count (99). Center everything; desktop clean.
