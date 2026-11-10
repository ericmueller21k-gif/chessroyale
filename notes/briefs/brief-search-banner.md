# Search while you browse: home's own mode rows become the search (Eric, Nov 10)

Eric (his words in quotes): tap a mode and you go into its lobby or search; you can go back and keep searching. His design
(replacing an earlier floating-banner mockup): "Take the exact container that the 50v50, the 1v1, the squads is in, and that
becomes a replacement. The exact container now will contain the information ... that would be lit up, but everything else below it
would be gray ... the ranked [label] becomes grayed out as well. But then everything above that, like our profile container and
the settings and stuff, that all stays lit." The second row (Solo queue / Party / Bots) becomes the actions: "start with bots ...
for any mode ... we can also put the cancel down there ... three different spots ... separate buttons, but there's not like lines
between them ... if you were to hit cancel though, it would like ask if you're sure ... if you hit bots, it would be like, cancel
your player search and play with bot, yes, no." In a lobby (50 v 50, Squads): an exit "but stay in the queue", e.g. a checkbox
"Keep me in the queue". "We just want every container to have the same pattern and theme as the rest, so nothing looks out of place."

**The mockup is the spec (v2, approved by Eric Nov 10: "that looks clean ... build it and push it live").** On claude/director-notes:
- `notes/assets/search-rows2-phone.png` (searching), `search-rows2-cancel-phone.png` (after Cancel), `search-rows2-bots-phone.png`
  (after Start with bots), `search-rows2-cancel-desktop.png`;
- their code, `notes/assets/search-rows2-mock.spec.ts`.
- **No pop-ups:** the confirms happen in place, in the second row (this replaces the earlier pop-up idea and v1's order).

## Build
1. **One app-wide "search" state** for every queue:
   - 1 v 1, which already has one: `DuelQueueBar` / `setAwaySearch` (docs/areas/ranked.md, "Browsing while queued");
   - the 50 v 50 crowd's queue and lobby;
   - Squads' queue and lobby (solo queue and party).

   Generalize the 1 v 1 one; don't build a second. The connection that holds your place lives with the app, not the screen.
2. **Home while searching:**
   - The modes row (50 v 50 · 1 v 1 · Squads) keeps its exact container and size and shows the search instead:
     - a green spinning ring;
     - "Searching · <mode>";
     - the queue type and the lobby's count ("Solo queue · 37 of 100 in the lobby");
     - the time searched (m:ss) in green on the right.
   - The second row keeps its exact container and shows three actions, with no lines between them, as home's rows are,
     in this order (Eric: "cancel should be on the left ... where it says solo queue"):
     - **Cancel** ("stop searching", in red), where Solo queue is.
     - **Lobby** ("see who's in"), where Party is: back to the lobby or search screen.
     - **Start with bots** ("play now"), where Bots is.
   - **Confirms in place** (Eric: "you hit cancel and then you just hit yes or no"): the same three slots change, nothing moves or opens.
     - After Cancel: **"Stop search?"** ("are you sure") / **Yes** ("stop", red) / **No** ("keep searching").
     - After Start with bots: **"Play bots?"** ("ends your search") / **Yes** ("play now", green) / **No** ("keep searching").
     - The first slot becomes the question and is NOT a button, so a double tap on Cancel can't confirm.
     - No (or ~6 s with no tap, a setting) puts the three actions back. A match found while asking wins: you go in.
   - **Greyed in place** (not hidden, not tappable): the RANKED label, the hint line, PLAY, Chess Town, Other modes, Boss Battle and Auto chess.
   - **Lit:** the top bar and the profile card.
   - Nothing moves or resizes (Eric's rule).
3. **Other screens** (shop, locker, profile, friends, settings): today's slim 1 v 1 search bar stays, extended to every queue (the director's call; Eric may revisit).
4. **In a lobby:** "Exit" with a checkbox "Keep me in the queue", checked by default and remembered.
   - Checked: you go home and see the search rows.
   - Unchecked: you leave the queue, as today.
   - A match found while you browse: the existing found alert (sound and buzz), and you're taken in, as 1 v 1 does today.
5. **The action row's three slots are data** (a label, a line and what it does), so a mode can change one later. That's for auto chess's own landing page and search, a later job: "Play vs bot" there.

**Lane:** targeted, but this touches online sync and the lobbies' seats and connections, so effort xhigh.

**Tests:**
- e2e for each queue: home while searching (both rows, the timer, what's greyed), Start with bots' confirm, Lobby, Cancel's confirm, and a match found while away.
- The lobbies' "Keep me in the queue".
- The 1 v 1 tests updated; list each changed check.
- Any home guard test in docs/rules/eric.md touched: say which and why.

**Docs:** decision note `docs/decisions/2026-11-10-search-on-home.md` (≤ 120 words), and the `docs/areas` pages for hub, matchmaking, ranked, squads and crowd.

**Stills** (on stills/search-home): home on a phone and a computer while searching, both confirms, and a lobby's Exit.

Push to claude/search-home at each real step; when done write `.pr-body.md` and push. Don't open the PR. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md` and `notes/briefs/rules-common.md` first.

**Not in this job:** auto chess's landing page and its queue against people (it has no server today).
