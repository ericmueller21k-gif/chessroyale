# Home: the RANKED row, the Boss raid's own screen, Bullet on the left (Oct 16, 2026)

Eric, Oct 16. Lane: `hub` (the director's brief). Area pages: [hub.md](../areas/hub.md), [crowd.md](../areas/crowd.md),
[squads.md](../areas/squads.md), [bosses.md](../areas/bosses.md).

## What Eric asked for

- A small "RANKED" label over three buttons grouped together, 50 v 50, 1 v 1 and Squads, "so that way it's clear that
  they're all ranked". 1 v 1 reads "1 v 1" with "Classic chess" under it.
- Boss raid gets a prominent home of its own ("I don't want it to just be brushed off to the side"): a card that opens
  a simple Boss raid screen, "from there you can pick if you want to solo against bosses or play with bots or queue
  with other players or whatever the normal options are". The fancier version comes later.
- The solo boss button ("Boss alone") leaves home. It stays reachable from the Boss raid screen and by a hidden URL.
- "The left should always be bullet, and then the far right on it should always be the longest time control", in every
  mode. This reverses his Oct 13 rule ("always slowest on the left, fastest on the right").

## Decisions

- **The row stays a picker** (the director's call, matching Eric's "a single button to queue, and then you hit play").
  Tap 50 v 50, 1 v 1 or Squads, then PLAY. The pick is remembered on the device (`brc.mode`), so a returning player's
  1 v 1 is one tap on PLAY. A button that queued at once would act differently from the other two in the same row.
- **The texts.** Label "RANKED". Buttons: "50 v 50" over "Crowd chess" (the mode's name, Crowd, kept in its line,
  matching 1 v 1's "Classic chess"), "1 v 1" over "Classic chess", "Squads" over "8 squads of 4" (unchanged). 1 v 1's
  line under PLAY: "Ranked chess vs one player near your level" (the time-control rule stays in the FAQ, as Eric
  asked). A guest: "1 v 1 is online · Sign in to play", as Squads says.
- **Under the row** for 1 v 1: nothing. 1 v 1 is always against people, so the Matchmaking row has no meaning there.
- **1 v 1's PLAY** calls `startRanked1v1()` (the core's one way in: its queue at once, at `/1v1`). Resting
  (`PAUSE_RANKED1V1`), PLAY is off with its line under it, as Squads and 50 v 50 are.
- **Your 1 v 1 rank** (`ranked1v1Label()`): not inside the button. Its third line would have to hold up to "Grandmaster
  · 1234 RP" in about 90 px at 320 px, and it doesn't fit there. Instead, with 1 v 1 picked, it goes in the slot under
  the row that 50 v 50's Matchmaking row uses: "Your rank: Placement 0/5", "Your rank: Gold 2 · 45 RP". It's one whole
  line from 320 px at its widest (tested).
- **The first-time pawn-vote hint** (the core's `VoteHint`, once per device in any mode): in the Crowd's and Squads'
  pre-game votes, "Drag your pawn into a zone to vote" sits over the board just above the zones, its arrow pointing
  down at them. In 1 v 1 it sits at the board's foot, because there your pawn starts in the middle, off the grid. It
  shows until you vote or the vote ends, in the first vote only. One hint per vote (keyed by it), so a player who
  meets it in the first vote doesn't see it again in the second.
- **Play with friends with 1 v 1 picked** makes a 50 v 50 lobby. 1 v 1 has no lobbies, and the button is the same one
  on every pick.
- **The Boss raid card** is full width with a boss's portrait (Ginger's, drawn by `BossFace` from her kit, the same
  canvas the boss menu draws), "Boss raid" and "Team up vs a boss · up to 50", and a chevron. The brief suggested
  "unranked" in that line. Left out: an online raid with at least 15 real players still changes your rating
  (`isRankedMatch`), and the ⓘ under Matchmaking still says so. "Up to 50" says what it is instead.
- **Where the card sits.** On a phone it sits under the RANKED row and PLAY, as asked. On a computer it sits above the
  row: Eric's Oct 9 rule puts PLAY at the bottom of the column with the picker right above it, and a card under PLAY
  would break both. There it shares a row with Play with friends (2 : 1, 64 px tall), as Play with friends and Boss
  alone did. A card stacked on its own row took about 120 px from the live window above (its board went from about
  300 to 178 px at 1280 × 800, under the 240 px its test asks for).
- **After a match:** Home from the results, and a lobby that closed (its note), land on home itself, not on the Boss raid
  screen they may have started from. Cancel in a raid's queue goes back to the Boss raid screen. The Boss raid screen
  shows home's note too, if one arrives while it's open.
- **The Boss raid screen** is a page of its own in the home frame (state in `App`, so the computer's side menu can show
  "Boss raid" as the current page). It has a Back arrow, the portrait with one line ("Up to 50 of you pick the crowd's
  moves together against a boss. The most popular pick is played."), and five choices, each an existing flow:
  - **Join a raid**: "Up to 50 players · bots fill the crowd after N s". The raid's queue, Default.
  - **People only**: "No bots · starts at 50, or 10 after N s". The raid's queue, Bots off.
  - **Raid with bots**: "You and 49 bots · starts at once". A Solo raid.
  - **Boss alone**: "Just you vs a boss you pick". Boss alone's boss menu.
  - **Play with friends**: "Make a raid and share its code, or join one". The sheet in raid mode.

  Each way of being matched is its own button rather than a Matchmaking row plus PLAY: one tap, and nothing to explain.
  A guest's online choices read "Online: sign in to play" and open sign-in. A resting part disables its choices, with
  its line under them. `?mode=raid` (old links, tests) opens this screen.
- **The side menu** (computer): "Boss raid" replaces "Boss alone" and opens the screen.
- **The hidden URL: `/bosses`** opens the solo boss picker (Boss alone's menu) straight away. It's unlisted and not
  admin-gated: a player gets their own boss menu, an admin the hidden bosses too, as before. It's used once: starting a
  match clears it, so coming home afterwards doesn't reopen the menu. The same applies to the side menu's old
  boss-menu request, which reopened the menu after a match.
- **A screen that replaces home starts at its top.** That covers a phone's queue, the Boss raid screen, and home again.
  The card adds height, so on a 390 × 664 phone PLAY sits below the fold and the queue opened 12 px scrolled.
- **Bullet on the left, the longest on the right** (reversing Oct 13): the 50 v 50's "How fast?" is Bullet 3+2,
  Blitz 5+3, Rapid 10+5. Squads' Clock vote (`SQUADS.clocks`) is Bullet 1+1, Blitz 3+2, Rapid 5+2. Defaults stay Blitz,
  named by id (`clockDefault`, `optionIndex`). The 1 v 1 core's on-board vote is already Bullet-left. The FAQ lists the
  options in data order, so it follows.
- **One effect of a reorder across a deploy:** a vote is cast and tallied by the option's place. An app still open
  from before the deploy draws the old order, so a pick made in it lands on the other end (its Rapid counts as Bullet)
  until it reloads. This is pre-launch and lasts only until the app reloads. No stored lobby is affected: a Squads
  lobby keeps the clock itself (`rules.clock`) once its votes close.

