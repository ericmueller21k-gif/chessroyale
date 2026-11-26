# Eric's asks, Nov 9 to Nov 26: what got built (audit, Nov 26)

Sources: Eric's 628 real messages in the director chat from Nov 9 on, checked against `origin/main` (414 merged PRs since Nov 8,
the code, `docs/decisions/`, `docs/areas/`, `ROADMAP.md`) and the director's notes (`notes/STATUS.md`, `notes/ASKS.md`,
`notes/launch-roadmap.md`, `notes/briefs/`). Follow-ups to one ask are merged into one row; where Eric changed an ask, his latest
version is what was checked. Pure questions, venting and TV chatter are left out.

## Summary

| State | Count |
|---|---|
| Live (merged on main; one row can hold several follow-ups) | 139 |
| In flight (open PR or queued job) | 8 |
| Waiting on Eric | 10 |
| Partly done | 3 |
| Never built | 5 |
| Parked by Eric (noted, build on his word) | 13 |
| Dropped by Eric | 7 |

Biggest gaps: **own ranks for 50 v 50 and Squads** (asked four times, queued only in STATUS, missing from ASKS.md), **riders in the
regular crates**, **the auto chess landing page with play against people**, the **rare-item frames and preview card**, and the
**Ranks pop-up and emblems by every name** on the 1 v 1 screen.

## Never built or partly done

1. **Own ranks for 50 v 50 and Squads (never built).** Nov 9: "one rank per mode is perfect"; Nov 16: "When you play a 50v50 or squads
   it also counts toward your rank for that mode", "Squads do yes cause each has their own rank in profile", plus the RP formula
   (placement and engine score, judged against the lobby's average; "100 super strong players... you should not lose a lot"; Squads
   RP "entirely on your placement"); Nov 25: "a ladder board for all rank modes"; Nov 25 ~19:20 UTC (STATUS): "50 v 50 and Squads GET
   THEIR OWN RANKS". **Missing:** the whole step (the rework's C5). The podium still shows "— RP · ranks soon" (`Podium.tsx:120`), the
   ladder has 1 v 1 only (`/api/ladder?mode=1v1`), Squads is unranked. Also part of it: a ranked 50 v 50/Squads leaver's seat taken
   by a bot at that player's strength (Nov 9). **Evidence:** STATUS Nov 17 "C5 (mode ranks) next when Eric wants", Nov 26 queue "own
   ranks for 50v50/Squads (ranked d[esign first])"; not in `notes/ASKS.md`; no C5 decision file.
2. **Riders in the regular crates (never built).** Nov 9: "come up with a few riders that have nothing to do with the bosses, and then
   we need to put those in the regular crates... make a note of that. We'll tackle that here shortly"; Nov 10: "I want 5 riders...
   crate exclusives", liked the shopping cart; "maybe I'll wait for our API credits to come back" (they came back Nov 16).
   **Missing:** every one. **Evidence:** `ROADMAP.md` "Riders in regular crates (Eric, Nov 9: next after the shop page)", nothing
   under it; no code for a cart or other non-boss ride (`git grep` shopping cart, robot vacuum, magic carpet: none). The Banana Suit
   went to the new Outfit slot instead.
3. **Auto chess landing page and play against people (never built).** Nov 10: auto chess "is a game mode... no rank... recorded in
   your match history... I want you to be able to play against humans", then "we are going to have to make a landing page for auto
   chess... you can just queue up with a bot, or you can just search". **Missing:** the landing page, the search for a human
   opponent, unranked PvP. **Evidence:** STATUS Nov 10 18:10 "Next only on Eric's word: new boss, settings menu, auto chess landing
   page"; nothing in `docs/areas/autochess.md` or the code; never raised with Eric again.
4. **Rare items: a tier frame and a tap-to-preview on a pawn (never built).** Nov 12: "a nice clean like gold border or like diamond
   border... if you click on them, it should load up like a little box... a preview of like a pawn... utilizing the rider... we'll
   have to do that for every rider". Eric said to queue it (low weekly usage). **Missing:** all of it. **Evidence:** `ROADMAP.md`
   "Rare items... queued, not started" (#658 was the roadmap entry only); no preview or frame code (`git grep` ItemPreview, tier
   frame, pearl border: only ROADMAP).
5. **Hidden Boss in match history (never built).** Nov 13: "in the match history, it should show the hidden boss, and then it would
   show like all three of his forms... gray out the ones you beat". He said "we can add this later"; STATUS: "LATER... After the whole
   fight is live" (it has been live since Nov 14-16). **Evidence:** no Hidden Boss or forms code in `PublicProfile.tsx`/profile parts.
6. **Ranks pop-up and an emblem next to every name, 1 v 1 (partly done).** Nov 25: "we should also put their emblem, the emblem next to
   everyone... click on someone's rank and then it shows the list of rankings". The director promised both in the mockup; #953 built
   the layout and the "Gold V – 45" pill. **Missing:** the emblem by the names during the game (`RankEmblem` shows only on the
   pre-game stage, result, home, ladder, profiles) and the Ranks pop-up (`DuelRankPill.tsx` has no tap; no pop-up component).
7. **Landing page sound (partly done).** Nov 11: "during this intro... a little sound toggle, so somebody could turn on sound". The
   songs were made, but the landing video is still muted with no toggle (`Landing.tsx:51`), and it still plays the first reel
   (trailer v2 waits on Eric's edits, below).
8. **The Banana Suit as the secret crate's prize (partly done).** Nov 10: "that one secret crate... the super secret item is the banana
   suit. Let's just do that." The Outfit slot and the suit are built (#605), but "nothing rolls it yet (admins' copies and tests only)"
   (`2026-11-10-outfit-slot.md`), so no player can get it.
(Also short of the ask, but counted under Waiting: the Boss Battle select on a computer reached about 2x, not the 3x to 4x Eric asked
for on Nov 12; see Waiting 4.)

## Waiting on Eric

1. **Chub & Chirp's Turf** (Nov 22): round-2 mockup re-sent Nov 26; never built (ASKS.md).
2. **Beta bots** (Nov 26: HunBot tag, joins at 15 s / 30 s, no online count, the yellow ⚠ chip and popover): design done, 6 decisions
   sent. This also covers his Nov 10 "expect more bots" notice for quiet hours, which was marked "todo, small" and never built.
3. **Burst cheating detection** (Nov 11: "for 4 or 5 moves, they're playing at 3,000 ELO, and there's a pattern of that... must
   notify, put them in [the pool]"): a Fable design round ran; the director asked "build it, yes or no?" twice on Nov 11; no answer.
4. **Boss Battle select bigger than 2x on a computer** (Nov 12): "keep it at 2x, or widen the stage or shorten the grid", no answer.
5. **Boingo's room shrink** (Nov 12: "shrink down his room... hold off on the drawing because I have a few more suggestions"): held
   for those revisions since Nov 12. (His crate card fix that day shipped in #659.)
6. **Trailer v2** (Nov 11 notes: new town footage, "Player" not "Hunter", day to night, a rider, Big Boy clips, boss mashup, 7 s
   Fischer zoom, Squads, "Battle bosses and earn special rewards", a Mega Man 9-style song): v2 delivered Nov 11 15:25, waiting on his
   edits to the cut and Song C (`notes/trailer.md`). The landing page's reel and sound toggle follow it.
7. **Settings screen cleanup** (Nov 10 "the settings menu... we need to fix it"; Nov 24 "a little clunky"; Nov 25 move explanations
   to the Handbook): he said Nov 25 "I need to take a look when I get home"; on the launch roadmap ("We build" 2).
8. **Lossless music masters** (Nov 16: "keep the lossless files for YouTube"): the director asked where they live; not in the repo.
9. **Discord alerts** (Nov 10): built (#619); needs his webhook (launch roadmap, Eric's side 6); Nov 25 "I'll do this later".
10. **Payments, his side**: the Access bypass for `/api/stripe/webhook`, Stripe Tax, the LLC details for the legal pages.

## In flight

| Ask (date) | Where |
|---|---|
| Chub & Chirp and Puddles: the ult can't wait more than 3 turns after its warning (Nov 26) | #972, CI |
| Chandy's Dodge also when you checkmate him (Nov 26) | #973 (town guard flake blocking); art phase 2 (the collapse redrawn) queued |
| Birdie's room: longer crossing arms, ~50 birds at the bar (Nov 26) | #974, CI |
| Dash: Time Scramble 5 s x3 then 3 s x3; "Hang on" gag (Nov 26) | #975, review and CI |
| Dash Hang-on: the review's 3 display nits | queued |
| Dash's lying-down clock tap 3x bigger, redrawn pose (Nov 26) | queued (`notes/briefs/dash-tap-bigger.md`) |
| Puddles regrows the piece he'd lose (Nov 26) | queued |
| Payments PR 7 (coin screen), 8 (Stripe checkout), 9 (refunds: keep items, optional comment, 3 refunds a 90-day hold, take back coins, 2nd chargeback closes the account), 10 (admin refunds tab), 12 (Nov 17-18) | queued |

## Parked by Eric (noted; build only on his word)

Random White/Black in boss fights (Nov 18); Alfil's real one-step elephant via Fairy-Stockfish (Nov 15); the Hidden Boss music's
drop on the countdown's 0 (Nov 15); ranked rewards (Nov 9); a town that fills with 25 bots over 5 minutes (Nov 19, ROADMAP); duo
mode (Nov 9); revisiting time controls, e.g. Squads at 10 minutes (Nov 9); streamer mode (Nov 16, ROADMAP); the fake-player load
swarm (Nov 24 "not yet"); a 100 v Hidden Boss mode (Nov 13); the chess-first statement, Handbook as a left-menu tab, "three chess
engines" wording and a clearer fair-play page (Nov 25-26, `notes/briefs/eric-ideas-nov26.md`); the town's paper walls (Nov 24,
launch roadmap); a Discord channel for image approvals (Nov 25).

## Dropped by Eric

The boss-assists mode (Nov 18, the Battle Tower instead); any further iPhone home-screen blur fix (Nov 21); Chandy using a move
right after a capture (Nov 16 "hold off"); music resuming on its own after tabbing back (Nov 16 "I guess that's fine"); a 50 v 50
invite code for streamers (Nov 16: friends-list invites only); the lawyer pass (Nov 24); boss music on walking into a building (Nov
11, reversed Nov 23 and removed in #908).

## Live

| Date | Ask | Where |
|---|---|---|
| Nov 9 | Auto chess pawns a little bigger, HP box full height | #565 |
| Nov 9 | Squads snaps you to your board on your turn | #566 |
| Nov 9 | XP system: levels, time-based XP, win bonus, daily bonus, daily key + crate, level rewards, animated bar, "no XP" notes, no 12 min line | #569, #574, #575; later 500 XP levels (#854, Eric OK) |
| Nov 9 | Daily/weekly quests overlay (Hearthstone style), top-bar spot on phones, dim not blur | #572, #576, `2026-11-09-quests-*.md` |
| Nov 9 | Boss result redesign: your name and level by the XP bar, boss animations, no king | #571 |
| Nov 9 | Ranked: one rank per mode design, MMR shown in gray, leave rules, 3-month seasons, soft reset, 5 placements | #573, #578, #582, #584 |
| Nov 9 | Admin cleanup, crates need keys, 100 keys for Eric, no "free during beta" | `2026-11-09-admin-abilities.md`, `xp-phase2-keys.md` |
| Nov 9 | Payments research (Stripe, Apple/Google Pay) | #772 design |
| Nov 9 | Colorful top buttons, bigger icons; later all black but your pawn | #580, #606 |
| Nov 9 | Profile picture glitch boxes | #577 |
| Nov 9 | Profile button: your pawn's face, no animation, rounded square, gray background, padding | #583 |
| Nov 9 | Home modes: one hint line, bigger Boss/Auto chess cards, Solo/Party/Bots row, bot level box, 3 s start | #581, `home-modes-*.md` |
| Nov 9 | Bot level box: no dashes, half size | #583 |
| Nov 9 | Shop page from his mockup: 50% off ribbons, struck prices, limited clock pop-up, Mythic Crate | #585 |
| Nov 9 | One random boss crate in the shop | #659 |
| Nov 9 | HunChess key with the king's head, stacked x3 | #586 |
| Nov 9 | Haptics on tap and move; a few boss moments | #587, #644 |
| Nov 9 | Run the audit now | #589 |
| Nov 9 | Live ops plan (alerts, on-call agent) written up | #588, ROADMAP |
| Nov 10 | Model by complexity, not length (CLAUDE.md) | CLAUDE.md, `2026-11-10-model-by-complexity.md` |
| Nov 10 | Refreshing one daily quest refreshed both | #603 |
| Nov 10 | Banana Suit and the Outfit slot (secret) | #605 |
| Nov 10 | Auto chess rerolls 0, 1, 2 (cap 2); board colors apart | #606 |
| Nov 10 | Searching from home: the mode row becomes the search, Cancel/Yes/No | #607 |
| Nov 10 | Auto chess bot saves for interest | #613 |
| Nov 10 | "Raid boss" quests renamed Boss Battle | #614 |
| Nov 10 | Quest progress pop-up after a game, with a finish | #615 |
| Nov 10 | Squads replay fix (#604 merged) | #604, #612 |
| Nov 10 | Engine pool (shadow queue) instead of bans, any mode | #618, `2026-11-10-engine-pool.md` |
| Nov 10 | Sustained strength: 5 games averaging 3,000 go to the pool | #629 |
| Nov 10 | Cheater dashboard with demo bot accounts | #622 |
| Nov 10 | Discord alerts code | #619 |
| Nov 10 | Loading bar with named steps, centered | #624 |
| Nov 10 | Desktop quests on the left as "Daily quests" | #623 |
| Nov 10-12 | Don Dough: bakery, guards, back room, kingpin talk, Rising Dough, Gold Plate, opening comment, goons carry the table, followers watch | #626, #627, #632, `2026-11-11-don-dough.md` |
| Nov 11 | Bakery noises off; a zebra out front | #630, #631 |
| Nov 11 | Landing reel (3 scenes), bigger, desktop two panes | #628, `2026-11-11-landing-two-panes.md` |
| Nov 11 | Tap a boss building on the mini map to run there | #634 |
| Nov 11 | Frame report tool; town and room frame rate | #636, #638, #641 |
| Nov 11 | Town loading screen | #639 |
| Nov 11 | Victory pawn straightened | #633 |
| Nov 11 | Rotation off on phones | #637 |
| Nov 11 | Friends page: search, profile, add friend, online/offline, private game | #635 |
| Nov 11 | Chat on phones in the top bar; View profile on your card | #637 |
| Nov 11 | Boss battle music, looped; room music; area name banner | #643, #648, #681, #685, #688 |
| Nov 11 | Music preloaded and smaller; later full quality, 128 kbps, quieter than the game | #654, #697, #708, #710, #754 |
| Nov 11 | "Loading the HunChess engine" instead of "40 MB" | #645 |
| Nov 11 | Babur's mate showed Hollow's dark matter | #646 |
| Nov 11 | Result screen: king over pawn when tight, fireworks in the boss box, bigger bosses | #652 |
| Nov 12 | Boss select never scrolls, 6 a row, bosses fill their cards, start lower | #647, #651 |
| Nov 12 | Sign in without a birthday; sign up asks it | #656 |
| Nov 12 | Don Dough's timers longer (pawn 8) | #649 |
| Nov 12 | Hollow's bulbs bigger, his strip 6 counting every move | #657 |
| Nov 12 | Boingo's pie: splash on the hung piece, two pieces split diagonally | #661 |
| Nov 12 | Boingo's crate card fixed | #659 |
| Nov 12 | Town chat: "entered the town", faint "Tap here to type", taller on computer | #663 |
| Nov 12 | Tap near a building's door to walk there | #664 |
| Nov 12-16 | Hidden Boss: Brooklyn walk-up, child room (snug, night), kid plays himself, room of four, locked door, 5-min cap, summoning, child form (+100 every 4 moves, ages), cutscene and lines, book light transformation, armored final form with visor and blue eyes, waving hair, four boards in the same frame, desktop split like phone, hearts (8, 10:00, slash), +10 on top, 3 test bots, live for everyone | #665-#744, `2026-11-13-hidden-boss-*.md`, `2026-11-14-recluse-*.md` |
| Nov 12-14 | Hidden Boss music in phases; +1 min build-up for song 2; seamless loops | #670, music session Nov 14 07:48 |
| Nov 13 | Banned: can't sign in, message with the support email, every URL, whole device | #687, `fairplay.md` |
| Nov 13 | Never load the old town | #675 |
| Nov 13 | One more zoom out in town | #674 |
| Nov 13 | "Are you sure?" before leaving the town | #694 |
| Nov 13 | Fix the cause, not add a checker (standing rule) | CLAUDE.md, `2026-11-13-fix-the-cause.md` |
| Nov 14 | Speech box follows the grown sprite | #701, #730 |
| Nov 14 | Green confirm ring removed | #699 |
| Nov 14 | Kid exchanges: all of them, one at random per fight | #702 |
| Nov 14 | Loading card names its step | #709 |
| Nov 15 | Pogo boings in time with the hops; rides hard start and stop | #721, #723, #756 |
| Nov 15 | Tabbing out reloaded the town | #726, #734 |
| Nov 15 | Shine sliding across the pawn | #727 |
| Nov 15-24 | Chandy: art, swamp home (pond, no windows), lock-on, five upgrades, weapon window, Dodge (warning volley, 2 hits, beams from clones), mate-in-one brings Dodge, new unlock used at once, no move twice in a row, own sounds, bigger on the stage, earlier upgrades, the hunt, Lock-on Shot and the God King's warning | #736-#831, #915 |
| Nov 16 | Pop-ups never push the page | #742 |
| Nov 16 | Riders wade in the swamp | #741 |
| Nov 16 | Banners said the boss's name twice | #743 |
| Nov 16 | 50 v 50 party: invite friends into empty seats, then find a match | #747, #748 |
| Nov 16 | Every matchmade match ranked (party too) | #750 |
| Nov 16 | 50 v 50 rework: Strong/Majority/Chaos vote, play to the end (60), even cuts to a 1 v 1, podium, best player, 4 v 4 longer, Spectate | #760, #762, #764 |
| Nov 16 | Audit fixes queued (bundle split etc.) | #759 |
| Nov 17 | Majority sometimes plays the 2nd or 3rd pick | `2026-11-17-crowd-rework-c4.md` |
| Nov 16-17 | Moo & Moon's star ride, flat and shaded, no lines | #763, #768, #771 |
| Nov 17 | Keys move 1 square in town | #767 |
| Nov 17 | Dash: clock smack at 20 s, fake move at 30 s, crawl and stay down, once each | #770, #775, #780, #783 |
| Nov 17 | Bosses face the right way | #766, #774, #781 |
| Nov 17-20 | Moo & Moon's ult cinematic, longer, eyes fade, moonrise, king lines, level aura, 10 moves | #776, #824, #826, #828, #848, #850 |
| Nov 17 | Payments design and prices, everything costs coins, one coin number | #772, #790 |
| Nov 17 | New coin icon; profile coin pill removed | #773 |
| Nov 18 | Wrangler's throw and start redrawn | #782 |
| Nov 18 | Big Boy's toy block tower | #784, #791, #794 |
| Nov 18 | Ginger's super freeze | #787 |
| Nov 18 | "Party closed" bar only once | `2026-11-18-closed-party-once.md` |
| Nov 18 | Coins every mode by the minute (300 a day) plus a performance bonus | #950 |
| Nov 18 | Coin boost (2.5x) and Crate Bonus from quests | #966 |
| Nov 18 | Coins shown on the end screen | #962 |
| Nov 18 | Who may buy (purchase greyed with a message on held accounts) | #967 |
| Nov 18-22 | Battle Tower: town building, clerk, rooms, floors 1-2-3 bosses, Maia climb curve, 2 lives, party (solo, invite, open party line, clerk list), saving, auditor plan and audits, music, banter and clerk lines, pixel hearts, accordion bar, floor arrow, solid table, clerk only at his counter, no 99 shown, "Back to the Battle Tower", no chat lines for floors, Moo's glow, 3-boss ult cap, primary "add pieces" boss, Wrangler off on shared floors | #802-#874 |
| Nov 19 | Bots on Eric's friends list with activity | #832 |
| Nov 19 | Installed app opens wide; install note in Settings | #829, #840 |
| Nov 19 | Pie froze a piece; its own pie look | #833, #847 |
| Nov 20 | Grex's ult chars before it burns | #837 |
| Nov 20 | Tap a room's door from anywhere | #836 |
| Nov 20 | Speech arrows point at the mouth | #841 |
| Nov 20 | Admin "win this match" button | #846 |
| Nov 20 | Sawyer's cut over the highlight; Wrangler once a game everywhere | #851 |
| Nov 20 | Sawyer's Saw Swap (off in the tower) | #856, #863 |
| Nov 20 | End screens: XP count and lob into the bar, quests rows, level-up, plain XP number, sounds (rising pitch, pan chord) | #855, #857, #944 |
| Nov 20-21 | God King shouts in Eric's voice | #861, #862 |
| Nov 21 | Tower floor title and a taller boss bar on computer | #872 |
| Nov 22 | Reward card in the crate style, Go to inventory, inventory over the town | #875 |
| Nov 22 | Town icons (inventory, quests...) without leaving; "Main menu" | #870, #876 |
| Nov 22 | Boss Battle/Auto chess cards centered; "Other modes" heading gone | #877 |
| Nov 22 | Gold pogo has the sound too | #878 |
| Nov 22 | Refresh doesn't erase a solo game; resume it | #881, #885 |
| Nov 22 | Chub & Chirp: carrot odds, hop your double-stepped pawn back | #880, #883 |
| Nov 23 | Grex is his name everywhere | #894 |
| Nov 23 | Town load time: kept pictures, painting on more cores | #895, #897 |
| Nov 23-25 | Birdie: art, train, armored form (Stockfish past Maia's top), fall cutscene (hop out, fun, beak), station, flip board, bar, gates flash at start, ride and crate, no tail, smoother train, facing, town 0.75 size, slower train, warning sign (opaque, blinks, hides while held), rides even on a miss, fewer chirps and horns, every 5 turns | #896-#916, #938 |
| Nov 23 | No boss music on walking into a building | #908 |
| Nov 24 | First-time power tips (5 pilots, 1st/3rd/8th then every 5th) | #917 |
| Nov 24 | Quests pop-up only every 12 hours; boss crates "Show unowned" | #920 |
| Nov 24 | Crate opening rebuilt, full screen, tier-colored light, spin sound, quieter stings per rarity, Transcendent crate | #922, #925 |
| Nov 24 | Admin crate grants | #924 |
| Nov 24 | 25% bonus crate (and key) on any opening | #923 |
| Nov 24 | Crates page: used welcome crates gone, admin last, bigger on computer | #926 |
| Nov 24 | Mythic items move: crown flames, candy cane swirl, gift tube confetti, parrot, tommy gun, smiley expressions | #946 |
| Nov 24 | 50 v 50 on computer flush with the board; vote labels | #927, #928 |
| Nov 24 | Launch list: what's left before launch | `notes/launch-roadmap.md` |
| Nov 25 | 200 resident players playing on the server; slower to resign | #931-#939 |
| Nov 25 | Season ladder (1 v 1), top 200, 1 v 1 tab first | #935 |
| Nov 25 | Color balance in ratings, in the Handbook | #933 |
| Nov 25-26 | Town smooth on the laptop (hitches, atlas pages, night glows) | #937, #949, #969 |
| Nov 25 | 1 v 1 vote 10 s or until both pick; typed chat arrives; tap a zone | #941 |
| Nov 25 | 1 v 1 on computer: bigger board, title on the clock line, gear, panel; menu labels; "Paragon IV – 50" | #953 |
| Nov 25 | 50 v 50, Squads and Boss on computer in the shared frame; waiting boxes always there | #956, #959, #964 |
| Nov 25 | Played moves as a gray skeleton box | #945 |
| Nov 25 | Vote cards fill upward | #960 |
| Nov 25-26 | Quests never keep empty rows | #962 |
| Nov 25 | No opening that starts in check | #954, #957 |
| Nov 26 | Bosses ult when in danger (Birdie; five others before their first ult) | #968, #970 |
