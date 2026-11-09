# Home: the hint line, bigger mode cards, and Solo queue / Party / Bots for 50 v 50 and Squads (Eric, Nov 9)

Read Eric's words below; they are the spec. Today's home: `notes/briefs/assets/home-now-nov9.jpg`.

## A. The line above PLAY: always one line, never empty; the space it frees goes to the Other modes cards
Eric: "we have this little space ... below [the options] ... because sometimes text fills up there. Because that's only one thin line of
text, we actually have some extra space, and I really want to bring up the play button and the Chess Town button. So there's only
enough space there for that one line. And let's make that line always say something ... the default text say like tap a game mode to
get started ... it should always be kept to just one line, and then nothing should ever move ... I want to make the other modes, like
the boss and the auto chess, a little bit bigger ... where auto chess and the boss battle sit at the bottom is not going to go any
further down. It'll just ... make those a bit taller."
- `fd-hint` (Home.tsx ~1040, styles.css): exactly one line tall, ellipsized if ever too long (write every line to fit 320 px).
  With no mode picked: "Tap a game mode to get started". 1 v 1 (today blank when signed in): a line too, e.g. "Ranked chess vs one
  player near your level" (shorten the panel's copy if it duplicates).
- PLAY and Chess Town move up by the freed height; the Boss Battle and Auto chess cards grow by the same amount, their bottom edge
  where it is today (at 320x568, 360x640, 390x844, 430x932; and a computer's layout unchanged unless it shares the rule: check).
  The cards' content stays centered in their taller boxes (maybe the art a touch bigger).

## B. The options under RANKED (`types` ~line 406, the panel ~line 975)
Eric: "on squads, it should be from left to right ... solo queue, party, and then ... that line underneath should say like invite ...
for 50v50 ... you can invite up to 8 people. And then to the right of that ... bots ... start a game instantly with 99 bots. For the
middle one, for 1v1, there is no options other than just queuing up. And then for squad, same thing ... identical to 50v50. So it's solo
queue on the left, party, but ... only invite up to 3 more people, and then bots ... play a squad game with 31 bots."
- **50 v 50:** Solo queue | Party | Bots. "Bots off" goes (the people-only path stays in code for tests/admin if they use it, just
  not on home). Solo queue = today's Default. Party = today's private lobby (the "Play with friends" sheet's create a lobby / join
  by code, the Lobby screen): capped at you + 8 (a setting, e.g. `CROWD_PARTY_MAX = 9` in settings.ts; the lobby's server cap and its
  "Players (n of 9)" line), bots fill the rest, the host starts. Bots = today's Solo (local, starts at once) with the bot level box (C).
- **1 v 1:** no option buttons (keep the panel the same size: your rank and its words, as today).
- **Squads:** Solo queue | Party | Bots. Solo queue and Party as today. **Bots: shown but greyed in this PR** ("Soon" in its sub line);
  a follow-up job (xhigh, server) makes it start at once with 31 bots at the chosen level. Don't build the squads server part.
- Hint lines (one line each), e.g. 50 v 50 Solo queue "Starts within 60 s; bots fill any empty seats" (as today), Party "Invite up to
  8 friends; bots fill the rest", Bots "Start at once with 99 bots"; Squads Party "Invite up to 3 friends to your squad", Squads Bots
  "Play a Squads game with 31 bots".
- Three buttons in each row: equal widths, the same box as today's row; titles + a short sub line like Squads' today, fitting 320 px.

## C. The bot level box (50 v 50 Bots)
Eric: "when you queue up and you actually hit play when bots are selected, just put a little small rectangle box that just says ...
select the average bot MMR, and then just have the options being like my level ... very easy ... and then show what the average [is]
... they kind of fluctuate a few hundred points up and down around [it] ... below the very hard ... random, which is just pure
randomness for every bot ... all bots are randomly skilled ... And then when you tap that, there should be like a little kind of okay
button that lights up. And then you can hit okay and then it would start."
- A small centered box over a dim (the Quests overlay's dim and shell look: reuse it), title "Bot level" + "Pick the bots' average
  rating". Rows: My level (~your rating), Very easy, Easy, Medium, Hard, Very hard (the boss raid's labels, `boss-difficulty.ts`
  / settings.ts ~2013), Random ("Every bot's level is random"). Each row shows its average, e.g. "Very easy · ~700". OK is greyed until
  a row is picked; OK starts the solo game at once; ✕/tapping the dim cancels. Remember the last pick on the device and preselect it.
- Strength: today's bots come from BOT_LOBBY (settings.ts ~644: a bell curve mean 1150, sd 250, 600..2200, each bot's rating fixed by its
  name; botStrength ~725). A level sets the curve's mean (Very easy 700, Easy 950, Medium 1150 = today, Hard 1500, Very hard 1900;
  "My level" = your own rating if the app knows one (the 50 v 50 / solo rating it already keeps; else Medium), clamped to 600..2200);
  the same sd so they "fluctuate a few hundred points" around it. Random: each bot uniform 600..2200. Numbers in settings.ts
  (`BOT_LEVELS`). Keep each bot's rating stable for a name within a level (deterministic from name + level). Solo only: online
  lobbies' bots don't change. Bots stay Stockfish-style (botSkillForRating), no new engine work.
- XP and anti-farm rules don't change (solo time and win caps already apply).

Lane: targeted (home screen, solo bots). Effort high. Specs: e2e/home-layout.spec.ts, the home/front-door specs, solo.spec.ts smoke,
and one focused check each: the hint is one line on every pick incl. none; cards' bottom unchanged; the three options; the bot box
(OK greyed until a pick, cancel, start). Core unit test for the level → ratings (means within ~50 of the target over 99 names; Random
spans the range; deterministic). Run `node e2e/ci-select.mjs files <paths>` to see what CI will run. Decision notes in
docs/decisions/2026-11-09-home-modes-*.md (short); update docs/areas/hub.md (and crowd.md for the party cap). FAQ: if it says "Bots off"
or describes Default/Solo, update it.

Coordinate: another helper is changing the top bar's icons (Home.tsx `fd-top`) and another the Friends button (it will open a
friends overlay instead of the "Play with friends" sheet). Don't touch the top bar. Party (50 v 50) must therefore open the
create/join-a-lobby part itself (move or reuse that sheet's lobby part as "50 v 50 party", like Squads' party sheet). Put new CSS in
its own block in styles.css (comment header) to keep merges simple.

Stills (deviceScaleFactor 2) on orphan branch `stills/home-modes`: home with no pick, 50 v 50 each option, 1 v 1, Squads each option,
the bot box (none picked, one picked), at 390x844 light, plus 320x568 and dark of home with no pick.
