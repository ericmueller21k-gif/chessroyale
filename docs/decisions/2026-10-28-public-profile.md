# The public profile (Oct 28, 2026)

How it works now: [docs/areas/hub.md](../areas/hub.md), "Profiles". The page: `packages/app/src/screens/PublicProfile.tsx`; its words
and numbers, pure: `packages/app/src/public-profile.ts`; its styles: `packages/app/src/public-profile.css` (`pp-`). It builds on
the ranked tiers (PR #401, merged: Wood 5 … Radiant 1, Pearlescent, Transcendent, their emblems, `?rank=`, the peak, the streak
and the last five games).

## Eric's words (Oct 28, on his mockup)

His mockup: an iPhone 14 (390 × 844) beside a computer in two columns. "I pretty much want it exactly as it shows here", with:

- "the little bar icons that show next to the ranked thing … we don't need that"
- "the background in that circular profile picture … make that your whatever you design for your icon will be there. And then if
  you have nothing, the default … like a light yellow … in theme with the rest of the website … it should be like faded or
  blurred, like kind of how you see in the image"
- "this is the public facing profile … we want everyone to have this identical public facing profile … when you click your own,
  obviously the challenge and add friend button, we can just gray them out … other than that, everything should be exactly identical"
- "the line with Chess Royale player … we can just get rid of that line … put there what the player's experience level is … like,
  level 38"
- "We don't need to show the border around the circle that reflects your current experience level."
- "it just inserted its own emerald-looking thing" (so: our emblems)
- "when you click your profile … keep it how it is … put something right at the top of the current profile page that says view
  public profile"
- Ranked Standing: "getting rid of … that little icon to the left of that … slide over ranked standing, and then next to that,
  put in like the more gray text, like 1v1 or 50 versus 50 or squads with a little drop down. And then the default is 1v1, but if
  you tap that, you'll see the other two options … for the other ones, if you tap it, that space can be just filled with coming soon"
- "just season one with no dropdown"; "Recent matches … can be any matches"; "the challenge, just use what we already have"

## What it is

- **Who sees it.** A tap on another player's name or face anywhere (a match, results, a lobby, the chat, Friends, the town
  card, the queue) opens it, for every viewer the same. Your own pawn still opens today's profile (`OwnProfileScreen`, unchanged:
  your coins, Edit name & icon, locker, Friends, Quick chat, Settings) with one new line at its top, **View public profile**, which
  opens yours as others see it (`ProfileTarget.public`, address `/profile/<your id>`). Back from it goes to your profile. A bot, or
  someone with no account, still gets the card that says so.
- **Your own public page.** Challenge, Add Friend and ••• are greyed and not tappable. A page opened by its address (`/profile/<id>`)
  with your own id is this page too.
- **Nothing private.** No email, sign-in method, age, the hidden 1 v 1 rating or fair-play details (today's rules), plus: **the icon
  is public now** (Eric). `PublicProfile.icon` (server, read side only); icons were already reportable and a moderator can reset one.
  The privacy page (`screens/Legal.tsx`, "What other players see") now says so.

## The calls

*Where the brief or the mockup left room, each with its reason.*

- **Colors are the front door's tokens, not the mockup's.** The mockup is light with cream cards on white; the app's light theme is
  white cards on cream (`--fd-panel`, `--fd-bg`). Spacing, radii and type sizes are measured from the mockup (390 px = 401 px
  in the image: a 12 px page gutter, 12 px between cards, 16 px card radius, a 120 px picture, a 28 px name, 16 px lines, 26 px tier);
  the colors follow whichever theme is on, as the other front-door pages do.
- **1v1 is spelled "1v1" in the card's menu** (the brief's, Eric's words); home's row says "1 v 1". One constant (`RANKED_MODES`).
- **The stat under "34 – 25" reads "W / L"** as the mockup has it (the brief wrote "W – L").
- **Peak rank shows the tier and its division** ("Peak rank: Paragon 4"), as the mockup's "Diamond IV", not the tier alone.
- **"Ranked" or "Casual".** The gray line reads "Ranked · 2h ago" for a ranked 1 v 1, and for any other game that counted toward
  the player's rating (the game's own `ranked` flag: online, enough real players; that rating still moves after #401, only its
  rank names were retired). Everything else reads "Casual · Oct 25". (The director's review, Oct 29: a 50 v 50 that moved your
  rating isn't casual. The first build called every non-1 v 1 game "Casual".) Only a ranked 1 v 1 shows RP.
- **The rows' time** is "2h ago" inside a day, "Yesterday", then the date ("Oct 25"): the mockup's. "Last seen" uses the same words.
- **Result pills.** A 1 v 1: WIN, LOSS, DRAW. A raid: WIN if the boss fell (`won`), else LOSS. 50 v 50: WIN or LOSS by its team's
  result (an older match with no team: 1st place is a win). Squads and Classic: their place, "3rd" (1st green, the rest gray).
  Titles: "vs. <name>", "vs. <boss>", "50 v 50", "Squads", "Classic" (Classic has no mode of its own on the brief's list: kept as it
  is today until it's reworked).
- **The raid's face** is the boss select's art (`BossArt`) in a circle on its select tint; a raid from before bosses had identities
  keeps the tier's old name and emoji.
- **No row has a chevron.** No player-game replay exists to open, so none opens anything; every row keeps its size. (When one
  does, its row gets the chevron: `RecentRow` is the place.)
- **View all (Recent)** opens today's list (the profile's own games, up to 10, with their details, in a sheet); **View all
  (Cosmetics)** opens today's per-item rows (purity, Shiny, tier) in a sheet. Both are greyed when there's nothing to show.
- **Block is today's two-tap** (first tap "Tap again to block", second blocks), now in the ••• menu: today's profile has no block
  sheet to reuse. Unblock replaces it in the menu once blocked, and the two buttons are greyed. Report opens today's sheet.
- **Challenge** is today's `InviteButton` (`greyed`: nothing hidden, so with no game of yours to invite them to, as mid-match, it
  stays and is greyed). Its notes ("Invited. The invite lasts 10 minutes.", a refusal) show on the note line under the buttons.
  Its accessible name is "Challenge" (tooltip: "Invite to play").
- **Add Friend** is today's: "Add Friend", "Cancel Request" (sent), "Accept Friend" (received), "Remove Friend" (then "Tap again to
  remove"); its notes on the same line. Greyed for a guest or a young device where friends are off, while the list loads, and for
  someone you blocked.
- **The note line** ("Request sent.", "Invited…", a refusal, "You blocked Ann. Unblock is in the ••• menu.") is always there, one
  line high, so a note moves nothing.
- **The level line** shows "Level 38" (`TEST_LEVEL`) only where `testSwitchesAllowed()`, as home does; for everyone else it's empty and
  keeps its 22 px (the director's call).
- **The icon behind the pawn:** the drawing scaled to fill the circle (a little over, so the blur's edge never shows), blurred 9 px
  and faded to 80% over the panel's gray; an older account's emoji is drawn the same way; the default pawn "♟", or none, gets
  `--fd-gold-soft`, the theme's light yellow (a dark gold in the dark theme). The green dot is at the circle's lower right while
  they're online and not hiding it. No ring.
- **Ranked Standing.** Title row: "Ranked Standing" (no icon), the gray "1v1 ⌄" menu (1v1, 50 v 50, Squads), "Season 1" on the right
  with no dropdown. 1v1 has the emblem (96 px on a phone, 144 px on a computer: whole steps of the 48 px art), "CURRENT TIER", the
  tier and division ("Gold 3"; no division for Pearlescent and Transcendent), the trophy and the RP ("45 RP": a top tier's RP counts
  above its floor), "Peak rank", and Win rate, W / L, Win streak. In placements: "Placement 2/5" with a plain shield badge
  ("2/5") where the emblem goes. No games: "Unranked", the same badge ("?"). A banned player: "Banned" and nothing else (the menu
  greyed). 50 v 50 and Squads: "Coming soon" in the middle. **One cell holds all of it**, so the card is as tall as 1v1's in
  every mode, and the menu floats over the page: nothing moves. The 1v1 rating is never shown.
- **Equipped Cosmetics.** A tile each in `WORN_ORDER`: picture (the item as it looks on them), name, "<Slot> · <colors>", and the
  rarity pill in the shop's tier color (`tierInfo`). **Phone:** two across, two rows, picture left of its words, the words
  wrapping rather than cut. **Computer:** four across in one row, each tile's picture over its words (a quarter of the width is too
  narrow for the mockup's side-by-side tile). Rows are one fixed height (112 px; 140 px on a computer), tall enough for a name and
  a color line that each wrap to two lines, and the grid always has the room of four, so a player with fewer (or none:
  "Nothing equipped") doesn't change the card's size.
- **Layout.** One column on a phone; from 744 px wide (the page's own width, measured, so it holds in the computer's frame from
  about 1216 px and in no narrower one: an overlay over a match stays one column) the header card is full width, Ranked Standing and
  Recent Matches side by side, Cosmetics full width. The title sits left by Back there, centered on a phone (the mockup's).
- **Nothing hidden, nothing shifts.** The page loads as the same markup with its text clear on gray bars (`pp-loading`), so every
  part is where it will be, at the size it will be: the five rows, four tiles, the emblem's box, the note line and the level line
  keep their room. The ••• and the two buttons are there, greyed, while it loads. (The ••• opens a menu: a tap to reach Block and
  Report is Eric's own design in the mockup.)

## Changed test checks (old → new)

None of them guards a rule in `docs/rules/eric.md`.

- `packages/server/test/live.test.ts` "nothing private": `not.toMatch(/email|google|signedIn|icon/i)` → `not.toMatch(/email|google|signedIn/i)`
  (the icon is public); new test "the icon is public": the default, an emoji and a drawing come back as `icon`.
- `e2e/profile.spec.ts`, another player's page mid-match: `Report` button visible → `More options` enabled; `Add friend` enabled →
  `Add Friend` enabled; `Invite to play` count 0 → `Challenge` disabled (greyed, not gone). A report: click `Report` → `More
  options`, then the `Report` menu item.
- `e2e/chat-mod.spec.ts`, `e2e/fairplay.spec.ts`: `Report` button → `More options`, then the `Report` menu item.
- `e2e/friends.spec.ts`: `Add friend` → `Add Friend`, `Cancel request` → `Cancel Request`, `Invite to play` → `Challenge`; Block:
  `Block` then `Tap again to block` buttons → the same two in the ••• menu (as menu items), then `Unblock` visible in the menu;
  `Invite to play` count 0 → `Challenge` disabled.
- `e2e/areas.json`: the new files are in "profiles and names" (and fairplay's spec joins it).

## PR #401's shape (merged, Oct 29)

The page reads core's `RankedSummary` as shipped: `peak` (null before a ladder: "Peak rank: —"), `streak`, and `recent` (the last 5
games, `RankedRecentGame`: `at`, `opponent {id, name, look}`, `result`, `points`). A game's `points` is null in placements, for a game
fair play held and for games from before Oct 28 (a dash beside it); a deleted account's `look` is null (the default pawn) and its
name "Deleted account". The public profile's server answer is #401's `rankedSummary` plus this PR's `icon`: no other server change.
The privacy page lists the new things others can see (best rank, win streak, the last five 1 v 1 games and who you played).

## Tests

Unit: `packages/app/test/public-profile.test.ts` (the online line's forms, the merged list, the rarity and color text, the stats).
e2e: `e2e/public-profile.spec.ts` (phone 390 × 844, computer 1280 × 800 and 1440 × 900), with a made-up profile in
`e2e/public-profile-data.ts`.
