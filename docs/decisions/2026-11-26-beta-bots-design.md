# Beta bots and the launch season: the design (Nov 26, 2026)

Eric's calls (Nov 26, after a talk with the director, who declined fake player counts and undisclosed bots; Eric agreed): the brief is
`notes/briefs/beta-bots-design.md` on `claude/director-notes`. **A design only: nothing is built.** Lanes: ranked, hub, fair play
(with engine for the Maia server). Mockup stills (CSS and DOM injected over the live screens, each marked MOCKUP): branch
`stills/beta-bots`, folder `beta-bots/` (the injector in `beta-bots/tools/`).

## 0. The short version

- **Two kinds of bot, two marks.** Today's lobby bots stay as they are and get one mark everywhere, **BOT**. The new beta bots are
  **HunBots**: Maia-3 (CSSLab's model, trained on people's games) playing **ranked 1 v 1 only**, near your level, with their own
  **HunBot** tag. A HunBot's moves come from **our server** (a small new Maia container, about $7 a month at most), never from your
  device, because its games move your rank.
- **The waits are Eric's:** bots fill a 50 v 50 or Squads lobby 15 s after its search starts; a HunBot steps into ranked 1 v 1 after 30 s
  with no person found. Settings. Raids keep today's 60 s (Eric didn't name them).
- **One wording fix (needs Eric's OK):** "They play like people, not like Stockfish" isn't true of today's lobby bots, which pick from
  Stockfish's top lines. The band says: **"AI players fill matches while we grow. In ranked, HunBots play like people, not like Stockfish."**
- **The beta band** is always there, never a pop-up, and taps through to a new FAQ entry. Phone: under the top bar on home, in the live
  line's slot; under the head of every queue screen. Computer: the right column's empty top slot (62 px, there on every framed page), so
  nothing moves.
- **No players-online count anywhere a player looks.** The computer's live line becomes "1,284 games in the last 24 h · 9 on now",
  counting bot games (true, and the band says bots play). A phone shows the band in that slot instead.
- **Ranked vs a HunBot during the beta** counts like any ranked game: RP, the hidden rating, placements, XP, quests and play coins (the
  day's cap). The bot plays at your hidden rating ±50, is scored as a fixed opponent at that level, and stores nothing of its own.
- **Bots never on the ladder or a leaderboard, and HunBot games never feed fair play.**
- **The Beta Season** ends with a reset: everyone back to placements (the hidden rating kept as a starting guess, its deviation raised),
  every HunBot game and its marks deleted, the band gone. HunBots in ranked after it: Eric's call then (a setting).
- **The residents leave before the beta opens:** they're human-named, on leaderboards and undisclosed, the opposite of this design. Their
  planned launch purge comes first (and their ~$52 a month goes).
- **Six PRs**, the order and lanes in section 11.

## 1. Two kinds of bot

| | **BOT** (today's lobby bots) | **HunBot** (new, the beta's) |
| --- | --- | --- |
| What plays | Picks from the judge's top lines at the temperature its rating plays like (`botPick`, `BOT_LOBBY`; crowd.md, "The bots"). Not Maia. | Maia-3 at a rating, its move **drawn** from its policy (temperature 0.8, top-p 0.9, as today's "Play a bot (unranked)" and the bosses' `maia-raw`), so it blunders as people at that level do. |
| Where it runs | The judges' devices (online), your device (Solo, Bots, the town, Play a bot). Unchanged. | The Maia server (section 5). Its result moves ranks, so its moves must be beyond the player's reach (computing priority 1, then 3). |
| Where it plays | 50 v 50, Squads and raid seats; Solo and Bots; Boss Battle's crowd; Chess Town's tables; 1 v 1's Play a bot (unranked); the global chat's bot lines. | Ranked 1 v 1 only, after 30 s with no person found. |
| Names | Today's chess puns (`BOT_NAMES`: "Rookie Ray", "Pawnstar"). | Their own list, `HUNBOT_NAMES` (about 60): an adjective and a chess word, Title Case, no digits, no human first names, nothing that reads as a person's handle, no tier name (Wood, Silver, Gold, …), at most 14 characters: "Velvet Knight", "Copper Rook", "Quiet Bishop", "Amber Pawn", "Misty Queen", "Clever Fork", "Rainy Gambit", "Swift Tempo", "Brave Outpost". Drawn per game. Account names may not contain "hunbot" (the name filter, `cleanName`'s check). |
| Looks | A bot's plain pawn (`pawnLook` with `isBot`). | The same: no shop items, so a HunBot never looks like a paying player. |
| Profile card | Today's short bot card ("Bots fill the empty seats in a match. They have no profile.", `PlayerProfile.tsx`), its pill now the BOT tag. | The same short card with the HunBot tag and its own line: "A human-like AI player (Maia-3, trained on people's games). Plays ranked 1 v 1 near your level during the beta. Never on the ladder." No buttons, as a bot's card today (so no Report). |
| Ladder, leaderboards, friends, search, the global chat | No (as today) | No: a HunBot has no account and no `ranked_1v1` row. |

**The two marks** (`components/BotTag.tsx`, one component, `kind: "bot" | "hunbot"`; still: `marks-computer-dark.png`). A small
square-cornered tag (radius 4 px, 10 px Archivo 800, 16 px tall), so it never reads as a rank pill (those are fully rounded, in tier colors):

- **BOT**: muted gray text and border. Replaces today's four marks: 🤖 in Squads' lists and team rows (`SquadsParts.tsx`,
  `SquadsMatch.tsx`), BOT in the global chat (`.gline-bot`), the "Bot" pill on a profile card (`PlayerProfile.tsx`), and "Unranked" in the
  rank pill's place on the bot game's strip (`duel.ts` `BotDuel`). Added where a bot's name shows without one today: the 50 v 50's
  scoreboard, cut names, podium and results (`Crowd.tsx`, `Podium.tsx`, `Results.tsx`) and raid lists. In a tight row (the scoreboard's
  103 px name column on a 360 px phone) the name ellipsizes, the tag never. The live window's "BOT MATCH" chip stays as it is.
- **HunBot**: cyan (#67e8f9 on the dark panel, #0e6b85 on #dff7fb in light: both over 4.5:1; no tier uses cyan). Wherever a HunBot's
  name shows: the 1 v 1 search's heads-up, the versus moment (in the rank pill's place, 20 px tall), the board's strip, the end screen's
  line, your recent games on your profile, its own card.

## 2. The waits (Eric's numbers)

`BETA_BOTS.waitSeconds` in settings.ts: `{ crowd: 15, squads: 15, raid: 60, ranked1v1: 30 }`.

- **50 v 50 and Squads:** the lobby fills with bots 15 s after it opens (today `MATCH_FILL_SECONDS`, 60, a Worker variable). The setting
  becomes the number; the variable still overrides it where set (the e2e's `--var MATCH_FILL_SECONDS:8`). The PR checks the dashboard
  has no `MATCH_FILL_SECONDS` left over, which would override the setting in production. The queue screen already says it ("Finding
  players · 12 s, then bots fill the rest"; still: `queue-crowd-phone-dark.png`). **A conflict to fix in the same PR:** a 50 v 50
  party's seats are held in a filling lobby only while the hold ends before the fill (`reserveParty`), and the hold,
  `CAPACITY.queue.reservationMs`, is 20 s: longer than a 15 s fill, so every party would get a lobby of its own. The PR sets the hold to
  10 s (under the fill, with room for a party's members to connect) and runs the party tests (`crowd-party.test.ts`,
  `crowd-party-do.test.ts`, `friends.spec.ts`).
- **Raids:** today's 60 s, unchanged (Eric named 50 v 50, Squads and ranked only). One number to change.
- **Ranked 1 v 1:** 30 s after the search starts, or after the delayed queue's `notBefore` when the leave rules hold you (a HunBot never
  skips a penalty's wait). Until then pairing with people is exactly today's (`PAIR_BY_RATING`); a person who arrives at 29 s still wins.

## 3. Ranked 1 v 1 with HunBots

### 3.1 The flow (stills: `search-*`, `versus-*`, `strip-phone-dark.png`)

1. **Searching** as today. In the room the stage keeps for "Few players online" (it's always as tall as that and Cancel, so nothing
   moves), a line from the start: "No one near your level yet. A **HunBot** steps in at 0:30". Nothing hidden: you know before it happens.
2. **At 30 s** the matchmaker's batch (`seatDuel`, each `formEveryMs`) takes the ticket out of the line and opens a `DuelGame` with one
   seat a person and one a HunBot, **only once the Maia server has answered ready** (the first ask of every search sends it a warm-up, so
   a cold start is under way long before 30 s; if it still isn't ready the line reads "A HunBot is on its way…" and the search goes on, a
   person still able to take the seat). Colors by today's rule (`firstGetsWhite` from your recent ranked colors; HunBot games count
   toward them, as ranked games).
3. **The versus moment** as with a person: the HunBot's pawn drops on the right platform, its name, and the **HunBot** tag where a rank
   pill goes (no emblem: its box kept, as in placements). Shown before the game starts, as Eric asked.
4. **The vote, the game, the end** by the same rules and screens. The board's top strip: name and HunBot tag. The end screen's line
   names it with the tag. Browsing while queued, the found alert and a reload all work as today: it's an ordinary duel game.
5. **With HunBots off** (`PAUSE_HUNBOTS`, the Maia server down, or after the beta if Eric says so) the stage is today's: "Few players
   online right now" at 45 s with Keep waiting and Play a bot (unranked).

The duel protocol gains `hunbot: true` on a seat (`DuelPlayerView`; never its level, which would show your hidden rating) and goes to
`DUEL_PROTOCOL` 2, so an older app reloads instead of showing a HunBot with no tag.

### 3.2 Its strength

- **Its level:** your hidden rating plus a draw from ±`levelSpread` (50), within Maia's range (`levelMin` 600, `levelMax` 2500, today's
  `RANKED_1V1.bot`), and your rating as its opponent's (`OppoElo`). Drawn per game with the game's seed (kept with the game, so a game can
  be replayed for a bug).
- **Why the scale holds:** you're scored against the bot's level as its rating. If Maia at level N really plays like N + 150 on our scale,
  you lose more than expected, your hidden rating drops until the bots you meet play even with you, and every player's rating ends up on
  the same footing: the Maia levels become the beta's fixed anchor (they never drift, unlike a pool of people). People's games with each
  other use the same ratings. A new player's prior (other modes' rating or 1500, deviation 350) is a guess that a few games correct.
- **Checked before it ships** (the ranked lane's rule): `packages/sim/scripts/ranked-1v1-sim.ts` with HunBots in the pool (people of known
  strength, bots whose true strength is off from their level by a slope and an offset, mostly bot games at low player counts): convergence,
  the rank spread, RP per game, and that the tiers keep their meaning. **Watched after:** the ops page shows people's score against
  HunBots by rating band (from the games' rows); a band far from 0.5 after a few hundred games means the anchor isn't holding there.

### 3.3 What a HunBot game does to your rank during the beta

- **It counts as any ranked game:** RP (`2 × 20 × (result − expected)` plus the ladder adjustment, ±20 between equals), the hidden rating
  (Glicko-1 against a fixed opponent: rating = its level, deviation `HUNBOT.rd` 60), placements, the leave rules (a dodge or a quick
  resign against a HunBot costs as ever), XP, quests and play coins (under `PLAY_COINS.perDay`, so no farming past the day's cap). Its
  moves are the server's, so a HunBot can't be made to lose on purpose.
- **The HunBot stores nothing:** no account, no record, no rating change. `recordDuel` reads a synthetic record for its side.
- **The record:** `ranked_1v1_games` gains `bot_side`, `bot_level` and `bot_name` (the bot's id column holds `hunbot`). A D1 change: the
  full lane. Your profile's recent games show it with the tag.
- **The ladder:** HunBots never on it (no row). Your RP from HunBot games counts on it during the beta; the reset (section 8) ends that.

### 3.4 How a HunBot behaves

Like today's bot game (`BotDuel`), on the server: it picks its speed 1.5-5 s into the vote, at random (`RESIDENTS.duel.pickMs`); thinks
`thinkMs` 600-2,600 ms a move, longer (×1.8) when Maia's two likeliest moves are close, never more than `clockShare` (5%) of its clock; takes
a draw only when 3 or more points of material behind; resigns when 8 down from its 12th move (the residents' rule: people resign lost
games). It never offers a draw, aborts, leaves, chats or reports. The chat's field note (`typedUnseen`'s slot) says "HunBots don't read
chat".

### 3.5 When the Maia server fails

A move request not answered in `answerMs` (4 s) is sent again; with no answer for `giveUpMs` (20 s) in all, the game is **called off**:
no rank change for either side, nobody's dodge, the result card says "The HunBot lost its connection. No rank change." Counted on the ops
page. (A move drawn at random instead would hand you a win; a server problem never decides a ranked game.)

### 3.6 Its kill switch

`PAUSE_HUNBOTS` (the `PAUSE_<NAME>` family, ops.md "Kill switches"): no new HunBot games (the stage goes back to "Few players online"),
running ones finish.

## 4. 50 v 50, Squads and raids

Bots keep filling empty seats, now at 15 s for 50 v 50 and Squads, each marked BOT. No HunBots there: Maia for a lobby's bots costs about
0.75 s a team turn on a computer and 3 s on a phone (`reports/crowd-bots.md`), so it stays a later engine-lane idea; once it lands, the
band can say every bot plays like people.

**Two things the beta makes common, flagged for their lanes (not changed here):** with one person among 99 bots, (a) the match is under
`RANKING.rankedMinHumanShare` (30%), so it doesn't count toward the profile rating, and (b) that person's device is the only judge, so the
match is **unvouched** and pays as a solo game (`LobbyRecord.unvouched`; the residents' design saw the same). The engine server is the
natural second judge when only one device can judge (computing priority 3: "too few capable devices"): an engine-lane job before the beta
opens, its own design.

## 5. Where HunBot moves run: the engine budget

| Option | Fair (priority 1) | Cost | Ways to break | Verdict |
| --- | --- | --- | --- | --- |
| Your own device (today's Play a bot) | **No:** the device that plays the bot is the one that gains from its mistakes, and a game that moves RP needs moves beyond the player's reach | $0 | — | Kept for Play a bot (unranked) only |
| Other players' devices, checked against each other | Yes, with a seed (as the boss's moves, `BOSS_CHECK`) | $0 | A new distributed system; in a beta, few devices online | No |
| The engine server's container (Stockfish), Maia added | Yes | A `standard-2` (6 GiB) awake for HunBots: about $40 a month at most | Touches the judge's image (pushed by hand, pinned by digest); Maia and Stockfish searches share its queue | No |
| The residents' container | Yes | Already ~$52 | A soak-test program, not built to serve: no port, restarts on every `main` change, a minute's cold start, leaves at launch | No |
| **A small Maia server** (new) | Yes | **About $7 a month at most** | One more image, pushed once | **Recommended** |

**The Maia server:** `maia/Dockerfile` (Node 22 slim, the Maia box's built CLI and model) and `maia/server.mjs`, a thin HTTP shim like
`engine/server.mjs`: `POST /move {fen, moves, elo, oppoElo, seed}` → `{move, close}` (close: Maia's two likeliest within a margin), `GET
/ready`. The box runs as **its own process over stdin/stdout**, exactly as the browser runs it (the AGPL box stays a separate program;
the server runs the same box whose source the site already serves at `/engine/maia/maia-box-source.tar.gz`, built from the same commit; the
FAQ and credits add "HunBots run the Maia box on our server"). A `MaiaServer` container class (copied from `EngineServer`),
`instance_type: "basic"` (1/4 vCPU, 1 GiB, 4 GB; `standard-1` if the account's scheduling policy refuses `basic`), `max_instances` 2, the
game's code picking the instance, `sleepAfter` 10 minutes. `packages/server/src/maia.ts` is the Worker's client.

**Cost** (Cloudflare's prices, as `notes/residents-design.md` cites them: memory $0.0000025 a GiB-s, CPU $0.000020 a vCPU-s of active
use, disk $0.00000007 a GB-s): awake the whole month, 1 GiB is $6.48 and 4 GB of disk $0.73; Maia's CPU is about 0.08 vCPU-s a move
(75-85 ms on one thread, the box's README), about 35 moves a game, so $0.00006 a game, about $0.60 for 10,000 games. **About $7 a month
for one instance awake around the clock**, less when it sleeps; a second instance only when the first is busy. Everything else stays on
devices at $0: lobby bots (judges), Play a bot, the town's bots.

**Capacity:** about 0.3 s a move on a quarter vCPU, one bot move every 5-10 s a game: about 15-30 HunBot games at once per instance. The
health view shows its answer times; an alert past 2 s.

**Needs:** one image push (the director, as the residents' image was: the token has the Containers scope). No new account or plan.

## 6. The front door

### 6.1 The beta band (stills: `home-phone-dark.png`, `home-phone-light.png`, `home-computer-dark.png`, `search-*.png`, `queue-crowd-phone-dark.png`)

- **Words:** a gold BETA chip, then "AI players fill matches while we grow. In ranked, **HunBots** play like people, not like Stockfish. ›"
  The whole band is one tap target to the FAQ's new entry, **"Bots and HunBots"** (what each is, where each plays, Maia-3 and its source,
  that bots never reach the ladder, the Beta Season and its reset). A page, never a pop-up; no ✕ (always visible).
- **Phone:** home, in the live line's slot under the top bar; the 50 v 50 and Squads queue screens and the party's, under the page head;
  the 1 v 1 stage, under its head (the stage's size rule counts it). 12 px on two lines (43 px) from 360 px wide, three (58 px) at 320.
  One fixed height per width, from the first frame: `index.html`'s shell draws it too, so the first paint doesn't shift.
- **Fit (measured on today's home with the band injected):** 375 × 667 and 390 × 844 fit with no scrolling; 360 × 640 scrolled 14 px, so
  the PR takes the band's extra 23 px out of PLAY's and Chess Town's short-screen size (80 → 69 px under 700 px tall); 320 × 568 already
  scrolls 63 px today, the band adds 38 (noted, not this design's).
- **Computer:** the right column's top slot (`.rc-slot`, 62 px, empty on every framed page but the town, whose tools it holds): the BETA
  chip, "About the bots ›" and the same words. It's there on home, every queue and every other framed page, so nothing moves anywhere.
- **The landing page** (signed out): recommended too, so a new player reads it before signing up (Eric's call: his brief named home and
  the queue).

### 6.2 No players-online count

Eric: "leave the total online off totally". `/api/live` stops sending `online` and `queue` to players (the ops view keeps its own numbers),
so no screen can show them. The phone's live line gives its slot to the band; the computer's (`.rc-online`) becomes the activity line
below. Kept, as they're not the total: a friend's "Online now", a lobby's own seats ("1 / 100" on the queue screen), and "Few players
online right now" on the fallback path only.

### 6.3 Games in the last 24 hours

"**1,284 games** in the last 24 h · 9 on now" (computer). Every finished game the server ran: 50 v 50, Squads and raid matches, private
lobbies, ranked 1 v 1 (HunBot games included); not Solo, Bots, Boss alone or the town, which the browser runs. Rolling 24 hours, so it
never falls to 0 at a UTC midnight: 24 hourly counts in the live hub's storage, +1 as each game's result is recorded (each object tells the
hub once, by code, so a retried recording isn't counted twice; `DuelGame` also says when it starts and ends, so "on now" includes 1 v 1).
Real numbers only (hub.md's rule): every one from the server.

## 7. Fair play

- **A HunBot is never a fair-play subject:** no case, no signals, no reports (its card has none), never pooled.
- **HunBot games never feed detection** (Eric's call): 1 v 1 has no detection signals today, and the case page's engine check of a
  player's 1 v 1 games (`fairplay-duel.ts`) leaves HunBot games out. The cost, said plainly: someone beating HunBots with an engine to
  climb the beta ladder isn't caught from those games. The beta resets, reports still open cases from their games with people, and Eric
  can reverse this one later with a line.
- **Lobby bots** are as today (never judged as people). The engine pool's players meet HunBots like anyone (the pool already plays bots).

## 8. The Beta Season and its reset

- **The name:** "Beta Season" (the ladder's header and the profile's 1 V 1 section; today "Season 1"). `BETA_BOTS.seasonName`.
- **The end** (an admin route, a dry run first, logged; full lane), in one operation:
  1. Every `ranked_1v1` row back to placements: games, wins, losses, draws, ladder, peak and streak reset; the hidden rating kept as the
     new season's starting guess, its deviation raised to `seasonStartRd` (250), so five placement games against people re-measure it.
  2. Every HunBot game's row deleted from `ranked_1v1_games` (they'd go after 30 days anyway), and the `ranked_conduct` rows of those
     games. Your recent games then show only people.
  3. The band goes (`BETA_BOTS.on` false), and the season is named "Season 1".
- **Kept:** XP, levels, coins, quests, crates and cosmetics (rewards, not results); every other mode's results (lobby bots were always in
  them).
- **No beta badge** by default (an option for Eric: "Beta Season: Gold II" on profiles, from the reset's own read).
- **After:** lobby bots keep filling seats, marked BOT. HunBots in ranked: `HUNBOT.ranked`, on through the beta; Eric decides then
  (on: as in the beta, marked, never on the ladder; off: today's Play a bot path).
- No seasons table yet: one reset, one operation. A season history is ranked's later work.

## 9. The residents at the beta's start

The residents (Nov 25) are human-handled accounts on the leaderboards, built to simulate a soft launch, undisclosed by design. They can't
stay once real players arrive. Their own design's launch step comes before the beta opens: the purge (dry run, then the real one),
`RESIDENTS_CLIENT_ID` emptied, the token deleted, the container removed (about $52 a month saved). Nothing of them is reused: the Maia
server (section 5) is the one lasting need, and it's smaller.

## 10. Settings

Everything above in `packages/core/src/settings.ts`:

```ts
export const BETA_BOTS = {
  on: true,                       // the band, the Beta Season's name; off at the season's end
  seasonName: "Beta Season",
  band: "AI players fill matches while we grow. In ranked, HunBots play like people, not like Stockfish.",
  waitSeconds: { crowd: 15, squads: 15, raid: 60, ranked1v1: 30 },
  seasonStartRd: 250,
};
export const HUNBOT = {
  ranked: true,                   // HunBots in ranked 1 v 1 (Eric decides after the beta)
  levelSpread: 50, levelMin: 600, levelMax: 2500, rd: 60,
  draw: { temperature: 0.8, topP: 0.9 },
  thinkMs: [600, 2600], closeThink: 1.8, clockShare: 0.05,
  acceptDrawDown: 3, resign: { down: 8, fromMove: 12 },
  answerMs: 4000, giveUpMs: 20000,
  names: [/* about 60, the rules in section 1 */],
};
```

## 11. The PR plan

Each PR updates its areas' pages in `docs/areas/` and adds its paths to `e2e/areas.json`. "Checks changed" lists the existing checks it
will change (the PR lists them old → new); none of them guards a rule in `docs/rules/eric.md`.

| # | PR | Lane, effort | What it changes | Checks changed |
| --- | --- | --- | --- | --- |
| 1 | **The waits** | Targeted (a setting read on the server, and the party hold: matchmaking), `medium` | `BETA_BOTS.waitSeconds` read where `MATCH_FILL_SECONDS` is (index.ts, api.ts, the Squads lobby), the variable still overriding; `reservationMs` 20 → 10 s; the FAQ's fill words. | the party tests if they pin the 20 s hold; any unit test that assumes 60 s |
| 2 | **The marks** | Targeted (a shared component, many screens), `high`, Opus (tight rows) | `BotTag` (BOT and HunBot); BOT replaces 🤖, `.gline-bot`, the profile's Bot pill and the bot game's "Unranked"; added to 50 v 50's scoreboard, cut names, podium, results and raid lists; `HUNBOT_NAMES`; the name filter refuses "hunbot". | squads-three-boards.spec:204 (the 🤖 badge → BOT), ranked-1v1.spec (the bot's strip: "Unranked" → BOT) |
| 3 | **The front door** | Targeted (hub), `high` | The band (home, queues, the 1 v 1 stage, the right column's slot, the shell), home's short-phone sizes, `/api/live` without `online` and `queue` (the live hub still counts who's online for the overload limit and the ops view), the 24-hour count in the live hub, the FAQ's "Bots and HunBots". | front-door.spec:15-21, 169, 195 (the live line's "N online" → the band and "games in the last 24 h"), live.test (server and app) |
| 4 | **The Maia server** | Targeted plus one independent review (a new production container), `xhigh`, engine lane | `maia/`, `MaiaServer`, its `wrangler.jsonc` entry, `maia.ts`, the health view's row, `PAUSE_HUNBOTS`; the image pushed by the director. Proof: the box's moves through the shim equal the browser worker's for the same seed. | none |
| 5 | **HunBots in ranked 1 v 1** | **Full** (`full-e2e`: stored data, ranked's rating, fair play), `xhigh`, ranked lane | The matchmaker's 30 s seat; `DuelGame`'s HunBot seat (moves from 4, its behavior, the call-off); `recordDuel` against a synthetic record; `ranked_1v1_games`' three columns (and `ACCOUNT_STORES`, the privacy policy); `DUEL_PROTOCOL` 2; the stage's heads-up line, the tag on the versus moment, strip, end screen, recent games and card; the chat note; fair play's 1 v 1 check leaving them out; the ops page's score by band; the sim run first. The e2e Worker runs without containers (`--enable-containers=false`), so a test switch gives the HunBot seat a stand-in move source there (always ready, legal moves in a fixed order); the real box is proved in 4. May split as 5a (server, full) and 5b (screens, targeted). | ranked-1v1 (Few players online at 45 s becomes the HunBot at 30 s; the fallback keeps today's test under `PAUSE_HUNBOTS`), duel-queue, duel-room, ranked-store, fairplay-duel |
| 6 | **The Beta Season** | **Full** (stored data), `xhigh`, ranked lane | The season's name; the end-of-season route (dry run, the reset, logged); its tests. Ships before the beta opens so the name shows; run at the season's end. | ladder's "Season 1" words |
| — | **Launch steps** (no PR) | the director | The residents' purge and container removal; then the beta opens (Zero Trust off: Eric's). | — |

**Order:** 1 (small, first), then 2 and 3 together (two Opus helpers at `high`), then 4, then 5 (needs 4), then 6. The engine lane's
second-judge job (section 4) runs beside 4 and 5 and must land before the beta opens.

## 12. What needs Eric

1. **The band's words:** "AI players fill matches while we grow. In ranked, HunBots play like people, not like Stockfish." (his draft's
   second sentence wasn't true of today's lobby bots).
2. **Spend:** the Maia server, about $7 a month at most. The residents' ~$52 a month goes at the beta's start.
3. **The landing page band** (recommended) and a **beta badge** after the reset (default none).
4. **No opt-out from HunBots in the beta** (recommended: queues stay alive, and the season resets anyway).
5. **At the season's end:** HunBots in ranked on or off.
6. **Fair play's 1 v 1 check skipping HunBot games** (his call as written; section 7 says what it costs).
