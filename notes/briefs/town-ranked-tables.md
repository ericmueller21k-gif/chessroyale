# Chess Town: Ranked at the tables, matches you can watch (Eric, Nov 27 ~20:00 UTC). Opus, xhigh. Targeted (+ server, protocol: optional)

Read `notes/briefs/rules-common.md` first, then `docs/areas/town-square.md` (the tables' card with Casual and Ranked greyed, "Coming
soon"; the bot games at a table: sit, play, "Back to town" onto your stool), `docs/areas/ranked.md` and the 1 v 1 search (`screens/
Duel.tsx`, `duel.ts`), `docs/areas/hub.md`, and `.claude/LESSONS.md`. Branch `claude/town-ranked` from `origin/main`.

**Eric:** "let's wire up the actual chessboards in town for ranked and casual. ... for ranked ... it just does an overlay ... we directly
wire it into a 1v1 search, just like how we already have that built. ... you can cancel it to back out and stay in the town ... it would
be cool if it actually showed you and the person you're playing against. So if people were in the town, they would also see 1v1s going
on, and then they could actually click and spectate those games. So like real 1v1 games. Yeah, that would actually be the best way ...
[Casual:] for now we just keep it for ranked, and casual still says coming soon. ... since basically you'd be AFK while you're playing
the match, we need to change how the town functions, so it sees that you're in a match, so you actually stay and sit there. ... whoever
your opponent is, he doesn't have to be in the town ... just show their pawn ... sitting on the bench next to them ... with their name
above their head. And then when the game's over, if you are already in the town, you would stay there, or you'd go back to it after the
end game screen."

**The design (the director's calls; record them in the decision note):**
1. At a table's card, **Ranked** is live: tapping it sits you at that table and opens the existing 1 v 1 search as an overlay over the
   town (the same queue, pools, ranks, delayed queue, "Few players online"). **Cancel** closes it: you stay seated in the town.
   **Casual** stays greyed, "Coming soon".
2. When the match is found, you go to the 1 v 1 match screen as today (the town is left; its loop stopped).
3. While your match lasts, the town shows you **seated at that table**, and your opponent's pawn (their look, their name over it)
   seated across from you, whether or not they're in the town: a town presence state "in a match at table T" (server-side, so every
   visitor sees it; it ends with the match, a disconnect or a timeout). Two players searching from two tables who meet: one table
   (the first's); the other's seat clears.
4. **Spectate from the town:** tapping a table with a live 1 v 1 opens that game's spectator view (the existing spectating, eval bar as
   today); leaving it returns you to the town where you were.
5. **After the game:** if you started from the town, the end screen's home button reads "Back to town" and brings you back seated at that
   table (as the bot games do); otherwise as today.
6. If the table is taken by a match when you tap it: its card offers to watch, not to play.
Server: the presence and the table claim in the town's Durable Object (or wherever presence lives), optional protocol fields only;
nothing a client sends can seat a match it isn't in. Load: a busy town (the `@perf` busy-town check) must stay within its budget with
several seated matches. Tests: unit tests for the presence state machine (seat, found, end, disconnect, two tables meeting), one e2e
for a ranked search from a table → cancel → still seated, and one for two players matched from the town (one seated pair seen by a
third visitor, who opens the spectator view). Stills: phone and computer, a seated pair at a table. `.pr-body.md` (at most 40 lines),
the decision note, the area pages, `.done`. Commits end only with your Claude-Session line. Starts after Turf merges (xhigh alone).
