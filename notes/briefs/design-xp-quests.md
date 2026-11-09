# XP, levels, daily rewards and quests: design draft (v0, Nov 9, 2026)

Status: **draft for Eric**. No code yet. Once Eric answers the open questions (end of this page), this becomes the build brief.

## What Eric asked for (Nov 9)
- **XP and levels:** a simple linear level system with no top level. XP is mostly from how long a game lasted, plus a small amount for winning.
- **A daily XP bonus,** so there's a reason to log on every day.
- **A daily crate and key** for logging in and playing a game, but only a game that lasts more than a certain number of moves.
- **An XP line on every end-of-game screen:** bosses, knocked out of Squads, 50 v 50, and the others. It also says "no XP" when the game ended too fast or you resigned too fast.
- **A Hearthstone-style overlay** the first time you log on each day: two daily quests and one weekly quest (for example, "Complete 10 games"), with crate, key and XP rewards.
- **A crate and a key when you level up.**
- **Before launch.** It's a big change, so the build brief has to be thorough about everything it touches.

## What already exists (so we build on it)
- **No account level yet.** Home ("LVL 38" and a ring around your icon) and the profiles ("Level 38") already have *placeholders*, shown only to admins (`TEST_LEVEL` in FrontDoor.tsx). They become real.
- **Wallets** hold coins, `crates` (a count kept "for when crates stop being free") and `crate_keys`.
  - Keys are spent on boss crates (1 boss token + 1 key).
  - Today nothing earns a key except an admin's test grant. A daily key gives keys a real use right away.
- **Crates are still free while testing** (`CRATES_FREE = true`). A crate reward only *feels* like a reward once that's switched off, so turning it off belongs to this project or right after it.
- **The ledger** (`server/ledger.ts`) already records every balance change once, safely: retries, two tabs and races grant once. XP, keys and crates from this system go through it.
- **The boss-token "counted battle" rule** already exists: a battle counts at 10 of your own moves or 5 minutes, decided by the server. In solo, it uses the server's own clock, never the device's word. We reuse the same idea for "a game that counts".
- **Welcome Crates** (at 5 and 25 finished games) already have a "You earned…" notice that shows once. It's the same pattern as level-up and daily-reward notices.
- **Results** are stored per game (mode, placement, team won, abandoned, …), but with **no length or move count**. XP needs one of them, so that's a stored-data change.

## The proposal

### 1. XP and levels
- **Every level costs the same XP,** forever (Eric: linear, no top). Proposed: **1,000 XP a level**. You start at Level 1.
- **XP from a game = minutes you played × 10, up to 30 minutes, plus a win bonus of 50.** That's about 100 minutes of play a level, roughly one level a day for someone who plays an hour or two. Every number sits in settings.ts.
  - **Minutes played:** your time *in* the game, as the server measured it. If you're knocked out at minute 8, you get 8 minutes. Watching afterwards adds nothing.
  - **A win, by mode:**
    - beat the boss;
    - win the ranked 1v1;
    - your team wins the 50 v 50;
    - your squad wins its match;
    - 1st in Classic.
- **A game counts only if it lasted** (Eric: "has to last more than a certain number of moves"): **at least 10 of your own moves** (or turns your team played while you were in). Otherwise no XP at all, for anyone in it. That stops two friends trading 1-move wins.
- **No XP** if you left or were removed for being idle. The match room already marks those as abandoned.
- **Guests:** no XP. The result screen says "Sign in to earn XP." (The boss-token rule is the same: guest progress moving into an account invites many-guests-into-one abuse.)

### 2. The daily reward (bonus XP + crate + key)
Eric listed the daily XP bonus and the daily crate and key separately. **I'd make them one reward, one rule.** It's easier to explain, and there's only one thing to remember:
- **"Daily reward: play one game today (at least 15 of your moves): +200 XP, 1 crate and 1 key."** It's paid at the end of the day's first game that counts.
- **The day resets at one time for everyone,** with a countdown in the overlay ("New quests in 5h"). Proposed: 08:00 UTC, which is midnight Pacific and 3 am Eastern. A fixed time can't be gamed by changing your phone's time zone.
- No login streaks for now. Streaks punish missing a day, and they're easy to add later.

### 3. Quests (2 daily, 1 weekly)
- **Each day: 2 daily quests.** Examples:
  - "Play 2 Squads games"
  - "Beat any boss"
  - "Play a 50 v 50 game"
  - "Win a ranked 1v1"
  - "Fight Wrangler" (only bosses that are live for everyone)
- **Each week: 1 weekly quest,** for example "Complete 10 games."
- **Rewards (proposed):**
  - a daily quest: 300 XP;
  - the weekly quest: 1,500 XP plus 1 crate and 1 key.
- **Hearthstone's kindness rules:**
  - unfinished dailies stay (up to 3 waiting), so skipping a day doesn't waste them;
  - **one free reroll a day,** for a quest in a mode you don't like.
- **Quests only ask for modes you can always play.** Bots fill Squads, 50 v 50 and the bosses, so those work. "Win" quests stay rare.
- **Progress comes from the same "a game finished" record that pays XP,** one place on the server, so a quest can't disagree with your XP.

### 4. Level-up rewards
- **Proposed: every level gives 1 crate + 1 key.** Optionally, something special every 10 levels later (a profile border, a title).
- **Watch the economy:**
  - at about 1 level a day, plus the daily reward and quests, a regular player gets 2–3 crates a day;
  - while crates are free, that doesn't matter;
  - before `CRATES_FREE` goes off, we set the numbers so rare items stay rare.

### 5. The daily overlay (Hearthstone style)
- **When it shows:** the first time you open the app each day (signed in), over home.
  - the day's daily reward (done or not);
  - your daily quests and the weekly one, with progress bars;
  - the reroll buttons;
  - "New quests in 12h";
  - one tap closes it.
- **A permanent Quests entry on home** reopens it (Eric's "nothing hidden" rule).
- **Eric: Hearthstone screenshots would help** with the look. Please send them when convenient.

### 6. The XP line on every result screen
- **Where:** each end screen gets one XP box at a fixed size, with nothing shifting when it fills:
  - Boss
  - 50 v 50 / Crowd ("You're out" and the final)
  - Squads (knocked out, and the match's end)
  - ranked 1v1
  - Classic
  - friends' lobbies
- **It shows:**
  - "+180 XP" with its parts ("12 min +120 · Win +50 · Daily reward +200");
  - the level bar filling;
  - "Level 7 → 8!" with its crate and key;
  - quest ticks ("Play 2 Squads games: 1/2 ✓").
- **"No XP" says why, in plain words:**
  - "No XP: the game ended before move 10."
  - "No XP: you resigned before move 10."
  - "No XP: you left the match."
  - "Sign in to earn XP."
  - "No XP: test game." (a test switch was used)
- **The FAQ** explains XP, levels, the daily reward and quests in plain language (CLAUDE.md: explain rules on screen).

## Fairness and safety (why this is a "full lane" job)
- **Decided by the server only,** like crates and tokens:
  - **Online matches:** the match room knows minutes and moves.
  - **Solo games** (vs bots or a boss on your device): the device's word isn't trusted. Only the server's own clock between "started" and "finished" counts (minutes, capped), exactly as solo boss tokens already work.
- **Everything goes through the ledger.** One operation per game per player, so a retry, two tabs or two devices never pay twice. XP becomes an asset kind in the ledger, so it's auditable.
- **Farming:**
  - Quick games pay nothing (the move minimum).
  - Idling gets you removed (abandoned → no XP).
  - The win bonus is small.
  - Friends' private lobbies are the one place two accounts could trade wins. Options: lower XP there, or a cap on wins against the same opponent per day.
- **Fair play:** banned accounts earn nothing. Players under review keep earning XP, but their crates and keys wait until the review clears. (Proposed. It needs the `fairplay` lane's view.)
- **Accounts:**
  - merging a guest into an account moves nothing (guests have none);
  - deleting an account deletes its XP and quests;
  - "download my data" includes them.
- **A kill switch** (`PAUSE_REWARDS`) stops XP, quests and daily rewards at once without breaking games.

## Everything it touches (for the build brief)
- **Stored data (D1):**
  - XP per account;
  - daily-reward claims;
  - quests (assigned, progress, done, rerolled);
  - a game length or move count on results;
  - new ledger asset kinds.
  - Migrations; the full lane.
- **Server:**
  - every match room (Crowd and 50 v 50, Squads, ranked 1v1, boss raids, friends' lobbies);
  - the solo result and solo clock paths;
  - the welcome-crate counting (same "finished game" idea);
  - account merge, delete and export;
  - fair play holds;
  - admin test grants and test switches (`?xp=`, `?level=`, `?quests=`) so e2e can reach every state.
- **Protocol:** the result message carries the XP breakdown. A core protocol change, so the full lane.
- **App:**
  - all result screens;
  - home (the real level and ring), profile and public profile ("Level 38" made real);
  - the daily overlay and the Quests entry;
  - level-up and quest-complete notices;
  - the FAQ.
- **Settings:** every number above in `packages/core/src/settings.ts`.
- **Tests:**
  - unit tests for the XP math and quest progress;
  - server tests for "pays once";
  - e2e per result screen and the overlay;
  - area pages and decision notes.
- **Ops:**
  - D1 writes per finished game (one batch);
  - the reset job for quests (lazy, at first visit after the reset, so no scheduled job needed).

## Build order (proposed)
1. **XP and levels:** server, storage, the result-screen line, home and profile. Opus, xhigh, full lane. The biggest piece.
2. **The daily reward and level-up rewards** (crate + key), and switching crates off "free". Opus, xhigh (wallets).
3. **Quests and the daily overlay.** Opus for the server part; the overlay's look can go to a Haiku worker, with Opus review.
4. **Tuning:** a sim of a week of typical players (levels per day, crates per day), then Eric's numbers.

## Open questions for Eric (my recommendation first)
1. **XP numbers:** 10 XP a minute (up to 30 minutes a game), +50 for a win, 1,000 XP a level?
2. **Minimum game:** 10 of your own moves for XP, 15 for the daily reward?
3. **Merge the daily XP bonus with the daily crate and key** into one daily reward (+200 XP, crate, key for your first counted game)? Or keep them separate?
4. **Daily reset:** one time for everyone (08:00 UTC = midnight Pacific)? Or each player's local midnight?
5. **Solo games vs bots count?** Yes, using the server's clock, as boss tokens do.
6. **Auto chess:** no XP until it's played online (today it runs only on your device).
7. **Level-up reward:** 1 crate + 1 key every level?
8. **Quests:** unfinished dailies carry over (up to 3), plus 1 free reroll a day?
9. **Guests:** no XP, with a "Sign in to earn XP" line?
10. **Crates stop being free** (`CRATES_FREE` off) as part of this, so the rewards mean something?
11. **Friends' private lobbies:** full XP, lower XP, or a daily cap on wins against the same opponent?
