# Hidden Boss: the room challenge, the summoning and the test bots (Nov 13)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: xhigh. FULL LANE: server, protocol, online match start,
an admin-only server action. Add the `full-e2e` label request to your PR body; an independent review follows.
Read CLAUDE.md, .claude/LESSONS.md, docs/areas/town-square.md, docs/areas/bosses.md, docs/areas/matchmaking.md, docs/rules/eric.md.
On branch claude/director-notes: notes/briefs/hidden-boss-house-NOTES.md (the plan; the rules are in "Nov 12 (night): Eric's big update",
"Update 3" and "Nov 13: Eric's test kit") and notes/hidden-boss-today.md (how his fight works today, online and solo).
His building and room are on main (PR #672: `town/houses/recluse.ts`, `town/shops/recluse-*.ts`, his card's greyed "Coming soon").
The summoning animation exists in `recluse-scene.ts` (the mockup's beats, the new light): wire it, don't redraw it.

The rules (Eric's):
1. **Challenge from his room only.** In the top-floor room his card offers **Challenge**. Pressing it adds you to that town instance's
   request: everyone in the room sees "1 of 4", "2 of 4"... You wait in the room.
2. **Leaving asks.** While your request is in, leaving the room (stairs, back, the side menu, closing the town) asks "Cancel your game
   request?" (Stay / Leave and cancel). Leaving cancels your place. Disconnects and the AFK drop cancel it too.
3. **Four at most in the room**, per town instance. A 5th player tapping the room's door (the stairs up from the landing) gets
   "The door is locked." and stays out. Count people in the room, not only challengers.
4. **One request at a time:** challenging another boss elsewhere ends your place here.
5. **5-minute cap,** not shown: if four aren't in by then, every waiting player gets the pop-up "Sorry, not enough players." with OK.
6. **At four:** the summoning plays for those four, in the room (freeze frame, rays, particles into the light, the splash, the board's
   wobble, quiet), then into his fight together. The town chat gets one line naming the four ("<a>, <b>, <c> and <d> are fighting the
   Hidden Boss." in the server-line style).
7. **The fight:** the four are one team that picks every move together: the majority's move is played; a tie goes to the boss party's
   existing rule (`partyMove`). Use the online path his fight already has (his adult form online, today's crowd final rules). Online his
   phase 2 (four boards) doesn't exist yet: winning his adult form online ends the fight as it does today. Say this plainly in your PR.
8. **Admins first:** only admins can see the building (already so); the challenge is admin-only too until Eric opens it.

Eric's test kit (admins only, server-checked):
- **Three test bots:** an admin-only option on his card ("Fill with 3 bots")
  gets three bots already standing in the room that count toward the four and join the challenge as if they were players (they walk, go
  through the summoning, and play as party members picking sensible moves; reuse the town's bots and the boss party's bots if any). Never
  available to players; the server refuses it for a non-admin.
- **Win this form, online:** the 🏆 from PR #670, in this online fight, for an admin in the party: the next team move beats the current
  form, server-side, through the same end a mate takes. The server checks admin; never for players.

Settings in `packages/core/src/settings.ts` (the 4, the 5-minute cap). Protocol: add only what's needed, optional fields; document them.
Testing: typecheck; server unit tests for the room count, the lock, the cap, cancel-on-leave, one-request-at-a-time, the bots' admin gate
and the win's admin gate; an e2e (both projects) that walks an admin up, fills with 3 bots, challenges, sees the summoning and lands in the
fight, and one where a 5th is locked out; e2e/areas.json entries. Run those locally. One set of stills for Eric at the end (the room
with "2 of 4", the locked door, the summoning, the first move in the fight), on branch stills/hidden-boss-challenge. About 4 hours.
Branch claude/hidden-boss-challenge (from origin/main after PR #672 merges: check git log origin/main first). Push at each real step.
Update docs/areas/town-square.md and bosses.md; decision note at most 120 words. When done: push .pr-body.md, then .done last.
Don't open a PR. American English. Never include model names in commits.
