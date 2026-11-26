# DESIGN FIRST: beta bots and the launch season (Eric, Nov 26). Opus xhigh (matchmaking, ranked, fair play). Doc only, then build PRs.

Eric's calls (Nov 26, after discussion; the director declined fake player counts or undisclosed bots, Eric agreed to this):
1. **Beta banner, always visible** (home and the queue; nothing hidden, never a pop-up): bots fill matches while we build our player base.
   Wording draft: "Beta: AI players fill matches while we grow. They play like people, not like Stockfish." (Eric: emphasize they use a
   human-like engine and play very human chess, NOT Stockfish bots. True: Maia is trained on human games.)
2. **Ranked:** when no human is found within N seconds, match a Maia bot near your rating, tagged "Bot" on its name strip, shown BEFORE
   the game starts. Separate from today's obvious lobby bots.
3. **Other modes:** 50 v 50, Squads, raids keep filling seats with bots; the same small bot mark everywhere.
4. **Players online: NOT shown at all during the initial phase** (Eric: "leave the total online off totally"). "Games played today"
   (and similar activity numbers) MAY count bot games: true, and the banner discloses bots.
5. **Fair play:** bot games never feed cheat detection; bots never appear on the ladder or leaderboards.
6. **Launch season:** a named beta ranked season; at its end ranked resets, bot results drop out of everyone's history and ladders, the
   banner goes. Bots may keep filling lobbies afterward if real numbers are low, still marked.
The design doc decides: the wait before a bot (per mode/queue), bot strength vs your hidden rating (Maia levels, the existing Maia box),
what a ranked game vs a bot does to RP and the hidden rating during beta, the reset's exact scope, bot names/avatars (marked, not
human-impersonating), the banner's place on phone and computer, the "games played" numbers, the home online count's removal, the
engine budget (Maia on players' devices vs server, per CLAUDE.md's computing priorities), and the PR plan. Mockup stills of the banner and
a ranked bot's name strip. Present to Eric before building.

## Eric's numbers and name (Nov 26)
- **The wait before bots join:** 15 s after a search starts for the 50 v 50 and Squads; 30 s for ranked 1 v 1. (Settings, so they're easy
  to tune.)
- **The tag:** "HunBot" for these beta bots (human-like Maia players), distinct from today's obvious "Bot" lobby bots. The design shows
  both marks side by side and says where each appears.

## Eric on the band (Nov 26): NO band with its own space
"We don't want that banner... I don't like how it's messing with the UI... we're not giving it its own space. That makes everything else
just get way out of place." Keep the design otherwise. Rework: an overlay on something that already exists, e.g. a small yellow "!" / BETA
chip on the existing top bar (or the logo), tapping it opens the FAQ's "Bots and HunBots". Mockup before building. The online count's
replacement line on computer is unaffected.
- **Eric's spec (Nov 26):** a yellow warning icon (an exclamation in a small triangle ⚠) that sits ON TOP of something already on the
  screen (overlay: moves nothing, takes no space). Tap it: the band's text pops up as a small popover near it. Tap anywhere else: it goes
  away. (The popover may link on to the FAQ's "Bots and HunBots".) Where it sits: home, the queues, the 1 v 1 stage; phone and computer.
  Mockup first.
