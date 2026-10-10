# History: The front door (hub)

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/hub.md).

## The name: HunChess (Oct 4, 2026)

Eric picked **HunChess**, one word, for the domain hunchess.com ("hun" as in hunter or hundred). The title, install name, home logo, share text and sign-in emails all use it. Lowercase `hunchess` is for URLs and identifiers. The internal package names (`@chessroyale/*`) and the Worker name (`chessroyale`) stay as they are, because renaming them would change the deploy setup for no visible gain.

## A landing page, online play for signed-in players only, and Crowd first (Oct 4, 2026)

Eric's worry is that guests make cheating too easy, so the plan is now:

- **Online play needs a signed-in account.** Guests can play solo against 99 bots, the full game. The server enforces this, not just the app. Creating a lobby without a signed-in account gets a 401. Joining one connects, then receives "Sign in to play online" and is closed. This rule switches on as soon as either sign-in method is set up (`signInRequired`), so local dev and the tests, which have no secrets, keep online play open. I chose this over "guests are eliminated after round 1": that would still let a guest into a real match, and a cheater would just play the first round.
- **The landing page is the first screen for anyone not signed in.** It has the HunChess logo, a one-line pitch, a 24 s looping 50 v 50 demo, Google and email sign-in, "or", then "Play vs 99 bots as a guest", an FAQ, and links to the privacy policy and terms. On a computer the video sits beside the sign-in. A guest who picks bots isn't shown the landing page again on that device; Home has a "Sign in to play online" card that brings it back. An invite link always shows it ("Sign in to join lobby ABCDE"). After Google, you come back to the page you started on: the lobby for an invite link, otherwise Home. The return address is kept in a 10-minute cookie and must be a path on this site, so the sign-in can't be used to redirect people elsewhere.
- **The demo video is a real solo 50 v 50 match**, recorded on a phone-sized screen by `scripts/record-demo.ts` and cut by `scripts/encode-demo.sh`: H.264 MP4, 600 px wide, muted, about 1 MB. Later it can be swapped for a live match that's being played.
- **Crowd 50 v 50 is the default mode** and comes first in the mode picker. Classic is still there.
- **Privacy policy and terms** are at `/privacy` and `/terms`. They are short and plain, written to match what the code actually stores. Google's consent screen asks for both links. The contact address is privacy@hunchess.com, which Eric needs to forward to himself (Cloudflare Email Routing, free) or swap for another address.
- **Fixed: Crowd games used some Classic rules.** An unset playtest option such as `?rounds` was spread over the Crowd settings as `undefined`, which erased the Crowd value. Classic's 8 rounds before the first cut, a cut every 5, and the 30 s clock then came back, and online Crowd lobbies also lost "start from move 0". The overrides now drop unset keys (`definedOnly`), with a test. Earlier 50 v 50 playtests ran under the wrong timing, so they're worth repeating.

**Cheating, beyond accounts (next, in ROADMAP.md):** every move is already scored against Stockfish, so we can flag players whose engine-match rate and timing are out of line with their rating. Other next steps: block disposable email domains, add Cloudflare Turnstile (free) on email sign-in, ban by account, and add a report button. In Crowd a single cheater can't steer the board (the most popular pick wins), but they could still top the leaderboard, so detection matters most there.

## The front door: home, queue, profiles (design, Oct 6, 2026; to build)

Eric approved the mockup as drawn ("I like exactly how you have it"): the canvas "HunChess front door" in his
Artifacts. Its source is in `docs/mockups/front-door/`: `Main.dc.html` (home), `Queue.dc.html`, `Profile.dc.html`.
The `hub` delegate builds it. Phone layouts as in the mockup; desktop as below.

**Home**
- **Top bar:** the "Hun**Chess**" logo ("Chess" in gold), the coin balance, and your dressed pawn in a gold ring. The
  pawn opens your profile.
- **Live line:** a green dot, "N online · M matches running · Q in queue", from the server and refreshed every few
  seconds. Online = connected in the last minute, anywhere in the app.
- **Your dressed pawn**, large, with your name, rank and what you're wearing.
- **Mode picker** (Crowd 50 v 50 / Boss raid / Classic "coming", while Classic is being reworked). The line under
  PLAY changes with it, e.g. the typical wait.
- **PLAY**, big and gold, joins the queue for that mode.
- **Four smaller buttons:** Play with friends (the private code lobbies), Boss alone, Shop & crates, Profile.

**Queue (no lobby screen for matchmade games)**
- PLAY puts you in the queue: the existing "Play now" matchmaker underneath. The waiting screen replaces the lobby
  screen for matchmade games. Private code games keep the lobby.
- **Shows:** "38 / 100", a progress bar, "Finding players · N s, then bots fill the rest", and a 10 × 10 grid of seats.
  Each joined player's dressed pawn pops into the next seat. Yours is first, ringed in gold, with "You're in · seat 1"
  below.
- **The pop (Eric):** each new pawn scales up past full size, then settles (about 0.35 s, a springy overshoot), with a
  short soft "pop" sound. When many join at once, the pops are staggered about 40 ms apart and the sound is
  rate-limited, so 30 joins never become 30 overlapping sounds. Respect the mute switch.
- **When the 60 s runs out,** bots fill the empty seats as plain pawns: a quick cascade, quieter pops.
- **Cancel** leaves the queue and goes home.
- **Phone:** the grid fills the panel's width, so pawns are about 30 px. **Desktop (Eric):** the grid gets most of the
  screen, so pawns are 60–80 px. The joining is the show.

**Profile:** one structure for everyone, opened by tapping your pawn or any name (leaderboards, cut screen, results).
- **Header:** dressed pawn (large), name, online now or last seen, joined month, rank tier and rating, percentile.
- **Wearing:** each equipped item drawn as it looks (crates' `ItemArt`: its colour, blotches and shine), slot,
  colour, purity (and "Shiny"), and a tier pill in its tier colour. (Eric, Oct 6: the mockup's plain colour swatch
  read as "just coloured shapes, not the item itself". A shop hat shows on its pawn.)
- **Stats:**
  - Mode tabs (Crowd / Boss raid).
  - Crowd: games, wins, average place, best finish, cuts survived %, brilliant moves.
  - Boss raid: raids, bosses beaten, strikes, Last Stands, survived %, brilliant moves.
  - Only stats the server really records. Add what's missing, or leave it out.
- **Rating chart:** the last 30 games.
- **Bosses beaten:** the 10 tiers, lit gold once beaten.
- **Recent matches:** place, mode, best move, when.
- **Yours only:** Edit name & icon, Open locker (and settings and sign-in where they live now).
- **Someone else's only:** Report, and "Add friend" greyed out until friends exist.
- **Never shown to others:** email, sign-in method, anything private.

**Desktop (Eric: "similar to the chess sites, our own style")**
- At 1024 px and wider, a three-column frame:
  - a **left side menu**: logo, Play, Boss alone, Play with friends, Shop & crates, Profile, then settings
  - the **centre** for the screen itself
  - a **right panel**: the live line, a "playing now" list of running matches (mode, players left, a watch link
    where spectating exists), and later a leaderboard
- The home screen's centre: your pawn and PLAY, side by side.
- The game screens keep their current desktop layout; only the front door changes.

**Phone or app store?** The website is the app.
- It already installs to the home screen like an app (manifest, icons, offline shell, install prompt) and runs full
  screen. No app-store app is needed now.
- Later, an app-store listing can wrap the same site for discovery or push notifications, with no rewrite.
- Keep everything working in the browser first.

### Built, step 1: home and the live line (Oct 6, 2026)

The `hub` delegate's calls while building the home screen. The layout, sizes, colours and copy are the mockup's;
every number on it comes from the server.

- **Online** means an account the server heard from in the last minute (`FRONT_DOOR.onlineWindowMs`).
  - Any request from the app counts. A front-door screen asks for the live line every 5 s; every other screen (a
    match) says "still here" every 30 s; a hidden tab says nothing.
  - It's stored as `users.last_seen` in D1 (indexed, and written at most every 15 s per account). No new Durable
    Object: nothing runs, or bills, between requests.
- **Matches running** are online lobbies (Play now and private) in a match with someone still connected. Each lobby
  reports itself to a D1 table, `live_lobbies`, when something on the line changes (a join, the start, a cut, the
  end) and at least once a minute while it runs. A lobby silent for 3 minutes drops out.
  - Solo games against bots aren't counted: no server sees them. Their players still count as online.
- **In queue** is the people waiting in Play now lobbies, both modes.
- **The line under PLAY:**
  - Crowd: "Usually about N s to find a match", the median wait of the last 20 matchmade starts in the past week
    (each lobby records its people's average wait when it fills). Until there's any history: "Starts within 60 s;
    bots fill any empty seats".
  - Boss raid: the mockup's "Join a raid; the boss matches the group".
  - Classic: "Classic is being reworked", and PLAY is greyed out.
- **PLAY in Boss raid joins a raid queue** (new): the same matchmaker as 50 v 50, a lobby of up to 50 that fills for
  60 s, no bots, and the boss is the weakest that's stronger than the group's average rating.
- **Guests, where online play needs signing in:** PLAY plays 99 bots (Crowd) or opens the boss menu (Boss raid), and
  the line under PLAY says so, with "Sign in to play online".
- **Under your pawn:** your rank and rating ("Weighty · 1612") and what you wear. "No rating yet" until a match
  gives you one.
  - There's no ranked rating yet, so the rank comes from the engine rating your profile already has (the one the
    boss raid uses). Ranked can swap the number underneath later.
  - (Built first as Bronze to Grandmaster with divisions; replaced the same day by the rank ladder, below.)
- **Where the old home's parts went:**
  - The name box is gone: you play under your profile's name.
  - The options (practice, pace, 50 v 50 or everyone moves, animations, motion trail, pre-game votes, opening moves,
    sound, the sound lab) moved to **Settings** (`/settings`), with the rules ("How to play"), the install card,
    sign-in and the Stockfish credit.
  - Lobbies with a code, and solo practice against 99 bots, are in **Play with friends** ("or practise alone"). An
    invite link opens it with the code filled in.
- **Fonts:** Archivo and Archivo Black are self-hosted (`public/fonts`, OFL).
- **The profile's new stats start recording now** (more in step 3), so there's real data by the time the profile
  shows them.

### Built, step 2: the queue (Oct 6, 2026)

- **PLAY goes straight to the queue screen** (no lobby screen): "38 / 100", the bar, "Finding players · N s, then
  bots fill the rest", and a 10 × 10 grid of seats (10 × 5 for a raid, "then the raid begins"). Private lobbies with
  a code keep the lobby screen.
- **Seats:** yours is seat 1, ringed in gold, then everyone else in the order they joined, then the bots. Each
  person's dressed pawn arrives with them (the lobby sends each look once; the item-builder's `Avatar` draws it).
- **The pop:** a pawn scales from small up to 124%, back to 92%, a touch over 100%, and settles, in 0.35 s.
  - Pawns arriving together start 40 ms apart; the pop sound plays at most every 70 ms however many arrive, and
    only with sound on (the mute switch sits in the header's empty corner).
  - The sound is synthesised: a short sine that drops in pitch, like a bubble, with a little tap; its pitch varies
    a little so a run of them isn't mechanical. Bots get the same at under half the volume.
  - Your own pawn pops first when you arrive, then everyone already there, 40 ms apart.
- **When time's up,** the server fills the empty seats with bots and holds the full grid for 1.8 s
  (`FRONT_DOOR.fillShowMs`) before the votes begin, so the bots' cascade (spread over that moment) is seen on every
  phone. A raid has no bots: it begins.
- **Cancel** (and the back arrow) leaves the queue and frees the seat.
- **Phone:** the grid fills the panel's width: about 30 px pawns on a 390 px phone. **Computer:** the grid takes the
  height of the window beside a column with the count, the bar, your seat and Cancel: 65-75 px pawns at 1280-1440
  px wide.
- **Empty seats** are small dots; a seat's dot stays until its pawn pops in, then fades.
- **Tests run separate queues:** `?pool=NAME` on the page sends PLAY to a queue of its own (any lowercase name), so
  e2e tests running side by side don't land in each other's lobbies.
- **Checked frame by frame** with `npm run frames:queue` (`scripts/frames-queue-pop.mjs`; the Worker must be running).
  It slows the animations 10×, saves the grid every ~100 ms and logs every seat's scale per frame:
  - each pawn grows from 0.15 to 1.24, dips to 0.92, rises to 1.04 and settles at exactly 1, once (no pawn pops
    twice or jumps);
  - two arriving together start apart (the second a frame behind);
  - when time's up, the bots' cascade runs row by row in about 1.2 s, and the votes begin 1.8 s after the fill.
  - (Found and fixed in step 4: a pop still waiting its turn could jump ahead if someone else arrived meanwhile, as
    the grid redrew with a shorter delay. Each pawn's delay is now fixed when it arrives; checked with three arriving
    at once.)

### Built, step 3: profiles (Oct 6, 2026)

- **One screen for everyone**, the mockup's structure. It opens from your pawn or Profile on the home screen, and
  from any name: the leaderboard beside the board and the full leaderboard sheet, the cut screen's list, the results
  (the winner, the most dangerous players), the final, a private lobby's list, and a person's pawn in the queue.
  - The small leaderboard under a phone's board keeps its own tap (it opens the full sheet, where names work).
  - Outside a match a profile is a page (`/profile` for yours, `/profile/ID` for anyone's). During a match it opens
    over the game, which goes on underneath.
  - A bot's name opens a bot's card: bots fill empty seats and have no profile.
- **What anyone can see** (`GET /api/profile/ID`): name, what they wear, online now or last seen, the month they
  joined, tier and rating, "Top N%", the stats, the rating line, bosses beaten and recent matches. **Never**: email,
  sign-in method, whether they're a guest, or their pixel icon. Profiles are found by account id, which other players
  only see in a lobby or match they share (ids are random, so profiles can't be listed by guessing).
- **Top N%** ranks your latest rating among every account's latest rating. It shows once 10 or more accounts have a
  rating (`FRONT_DOOR.percentileMinPlayers`), so the first players don't see "Top 100%".
- **Stats, all from stored results:**
  - Crowd: games, wins, average place (shown rounded, as a place), best finish: from results, as before. **New:**
    cuts survived (%) and brilliant moves.
  - Boss raid: raids. **New:** bosses beaten (different tiers won), strikes survived (the boss's strikes that took
    someone else while you stood; I read the mockup's "strikes" this way and labelled it so), Last Stands (raids in
    which the God King made his Last Stand), survived (% of raids you were still standing at the end) and brilliant
    moves.
  - The new ones are recorded from today on. A stat counts only results that have it, and shows "—" when none do,
    so nothing is invented for older matches. Bosses beaten likewise counts only raids recorded with their boss.
  - Online, the server records them: the lobby notes each person's brilliant moves and best pick every round. Solo
    games are recorded by the browser, as before.
  - **Best move** in a match: a brilliant one if any, else the pick that beat the field by most (the highest round
    score).
- **The rating line:** the rating after each of the last 30 rated matches, any mode: the same number as the header's.
- **Recent matches:** the place (Won, Lost, Out or Draw for a raid), the mode ("solo" for games against bots, the
  boss's name and strength for a raid), the best move and when.
- **Yours only:** Edit name & icon (your name, and the pixel icon builder), Open locker (the shop's locker tab), the
  settings (the gear, and a link at the bottom), and signing in for a guest.
- **Someone else's only:** Report (Cheating, Name or Something else), stored in D1's `reports` for a person to read
  (`SELECT * FROM reports ORDER BY at DESC`); one per player per reporter a day, 20 a day per reporter. "Add friend"
  is there, greyed out "(later)".

### Built, step 4: the computer's frame (Oct 6, 2026)

- **At 1024 px and wider, three columns** (front-door pages: home, profile, settings, the shop):
  - **Left, the side menu:** the logo, Play, Boss alone, Play with friends, Shop & crates, Profile (with your
    pawn), and Settings at the bottom. The page you're on is marked with a gold bar. Play is the home screen (PLAY
    lives there); Boss alone and Play with friends open the home screen's boss menu and sheet.
  - **The centre:** the page. Your pawn and PLAY sit side by side from 1280 px (stacked, as on a phone, from 1024 to
    1279, where they don't both fit); a profile goes to two columns from 1280 px.
  - **Right, the live panel:** the live line (one number to a line) and **Playing now**: each running match's mode
    (and the raid's boss), players left and how long it's been going. No names, nothing a stranger couldn't see from
    outside.
  - **No watch links yet:** nobody outside a match can watch it (only knocked-out players inside it can), so the
    list says watching comes later. A leaderboard can join the panel once ranked exists.
- **The queue keeps the whole window** (no menu or panel): the grid is the show, and a menu click there would have to
  mean leaving the queue. Private lobbies and every game screen keep their own layouts. (Replaced Oct 8: the queue
  fills in place on the home screen, below.)
- **Phones** (below 1024 px) never see the menu or the panel: one column, as in the mockups.

### The rank ladder (Eric, Oct 6, 2026)

- **Fourteen ranks, Puzzle Pirates' skill ladder** (the names honour it): Novice, Neophyte, Apprentice, Narrow,
  Broad, Solid, Weighty, Expert, Paragon, Illustrious, Sublime, Revered, Exalted, Transcendent. No divisions: the
  label is the name ("Weighty · 1612"). They replace Bronze to Grandmaster, on home and on profiles.
- **Fixed cutoffs, in 50s** (`RATING_RANKS` in settings.ts), aimed at the spread Eric asked for. The assumption: our
  ratings spread like chess ratings, centred on 1500 with an SD of 350. Nothing better exists yet: the sim reports
  model bot crowds, not people, and a new player's rating starts at 1500 and is pulled towards it for the first
  moves. Once real ratings are stored in numbers, refit the cutoffs to them (change `from` in settings.ts).

  | Rank | From | Asked | Gets (1500 ± 350) |
  | --- | --- | --- | --- |
  | Novice | 0 | 5% | 5.8% |
  | Neophyte | 950 | 7% | 6.9% |
  | Apprentice | 1100 | 9% | 11.1% |
  | Narrow | 1250 | 10% | 9.7% |
  | Broad | 1350 | 11% | 10.9% |
  | Solid | 1450 | 12% | 11.4% |
  | Weighty | 1550 | 11% | 10.9% |
  | Expert | 1650 | 10% | 9.7% |
  | Paragon | 1750 | 9% | 7.9% |
  | Illustrious | 1850 | 7% | 5.9% |
  | Sublime | 1950 | 5% | 5.6% |
  | Revered | 2100 | 2.5% | 2.7% |
  | Exalted | 2250 | 1.2% | 1.3% |
  | Transcendent | 2450 | 0.3% | 0.3% |

  A band of 50 holds about 5.7% of players near the middle, so the middle ranks can't land closer than a point or
  two; the cutoffs are the set of 50s nearest the ideal that fits best overall. A unit test holds the shares near
  these, so a change to the cutoffs or the assumption is a deliberate one.
- **Colours climb:** dull grey and stone at the bottom, then clay and copper, olive, greens, teal, sky blue, periwinkle
  and violet. The top three stand out: **Revered** is gold with a gold ring and a sheen, **Exalted** fire orange with
  a ring and a glow, **Transcendent** a slowly moving rainbow with dark text (held still for anyone who asks for reduced motion). On home
  the rank's name takes its colour. Every pill reads at 4.5:1 or better in both themes, and a unit test checks it.
- **Item tiers get their own names** (Common to Mythic, the item-builder's change alongside this one), so a rank never
  reads like an item's rarity.

### Light and dark, a switch (Eric, Oct 8, 2026)

Eric, on his computer: "why the sun next to the settings button? it does nothing … I also don't see a light dark mode
toggle". The "sun" was Settings' icon; nothing in the app could change the theme (it followed the device only).

- **The sun is the switch** (`ThemeButton`, `theme.ts`): a bright gold sun in light mode, a black sun with a gold rim
  in dark mode (Eric: "when you click the sun, it switches to a black sun, and then it makes it dark mode"). A tap
  shows the other theme and remembers it on this device (`brc.theme`). 44 px, `aria-pressed` = dark.
  - **Computer:** its own small round button in the side menu, just above Settings. Settings now has a real gear (the
    profile's).
  - **Phone:** the home's top bar, before your coins and pawn.
  - **Settings → Theme:** Match device / Light / Dark. Match device is the default until someone picks, and follows
    the device live (switching the phone to dark at sunset switches the app).
- **No flash of the wrong theme:** a few lines in `index.html`'s `<head>` set `<html data-theme>` before the first
  paint, from the pick or the device. `theme.ts` keeps it in step afterwards by the same rules; a unit test runs the
  inline script against `theme.ts` for every case (picked, not, junk, no storage, no media queries).
- **One rule for light in the stylesheet:** the page always carries the theme it shows (`data-theme="light|dark"`),
  so every light rule is `:root[data-theme="light"] …`. The old `@media (prefers-color-scheme: light)` blocks (the
  base colours, the front door's, the rank pills, quick chat's bubble and page chat) became that. Before, a light pick
  on a dark device would have missed them; quick chat's page-chat had only half its light rules duplicated.
- **The phone's top bar, measured:** with the sun it holds the logo, the sun, your coins and your pawn. The bar
  already ran off a 320 px phone with a 4-digit balance (and a 390 px one with 5 digits once the sun was in). Now:
  the coins' word goes when it doesn't fit (it wraps onto a line the pill doesn't show; the gold dot is the coin),
  the logo steps down a little below 400 px, and below 360 px a balance of 10,000 or more shows short ("123k").
  `e2e/home-layout.spec.ts` checks 320-430 px with 123,456 coins.
- **Checked:** `e2e/home-layout.spec.ts` (the sun on a computer and a phone, the pick through a reload with every
  value `data-theme` took logged from the first moment, Settings' three choices, following the device live, every
  front-door page in a forced theme) and `npm run frames:home` (one jump in brightness per tap; a reload with a pick
  shows no frame of the other theme, both ways).

### A cleaner computer home, and the queue in place (Eric, Oct 8, 2026)

Eric marked up the computer's home: the pawn card sat low with a big empty space above it (arrow up and left); the
coins and profile button should go to the top right; and "when you click play, that area [the mode picker, PLAY and
the buttons] should become the large lobby that starts filling up players, and also there should be a chat while you
wait … right now the whole screen is the hundred player loading". Phones keep their layout; everything here is
scoped to 1024 px and wider.

**Home (computer)**
- **Your coins and pawn: the top right of the page,** at the top of the live panel, level with the side menu's logo.
  On every page in the computer's frame (home, profile, settings, the shop), as the chess sites do. The home's own top
  bar (and its live line) are a phone's only now; the logo and the sun live in the side menu.
- **One box from the top:** your card and the play column start at the top (24 px, level with the logo) and share
  one box that fills the window's height, up to 720 px. Your card fills its column top to bottom (nothing above it);
  the play column sits in its middle, level with your pawn. On a tall screen the space is below everything, not
  above.
- **Sizes:** the card up to 540 px wide, the play column 320 px (1280-1439) or 360 px (1440+), 24 px apart, centred
  in a centre of up to 1,080 px (it was 920: a 1,860 px screen had wide empty bands). The live panel is 280 px below
  1440 px (320 above), so the lobby gets the room. 1024-1279: stacked, as before.

**The queue in place (computer)**
- **PLAY no longer takes the whole window.** The queue is a state of the home screen (`HomeScreen`'s `queue`): the
  side menu and the live panel stay, the play column becomes the lobby (the mode, the sound, "N / 100", the line, the
  bar, the grid, your seat and Cancel, "Switch to Default" for Bots off, and "Unranked …"), and your card shrinks to
  the top of the left column with the lobby's chat under it. When the match starts it goes to the game as before.
  Cancel is home again, in place.
- **Sizes:** the left column 280 px (300 from 1440), the lobby the rest; the grid is as wide as the lobby and never
  taller than the window allows, so Cancel is always in view: about 40 px pawns at 1280 × 800, 48 at 1440 × 900,
  about 65 on a 1920 × 1080 screen. (Eric's Oct 6 "60-80 px" was for a queue with the whole window; with the frame
  and the chat kept, it's smaller on a laptop.) At 1024-1279 the lobby takes the centre, your card is in your seat's
  card, and the chat goes under the lobby.
- **"Unranked …" sits beside the count,** so when the bots arrive it doesn't push the grid down mid-show. Your seat
  and Cancel share a row. No back arrow in the lobby (Cancel is there, and the side menu).
- **The side menu while you wait:** Play is where you are; your profile opens over the queue (as a pawn tapped in it
  does); anything else (Boss alone, Play with friends, the shop, Settings) leaves the queue first, then goes there, as
  leaving the page does on the chess sites. My call: a seat you can't see isn't one you're waiting in.
- **The live panel keeps its numbers fresh while you wait** (every 5 s, as on home; the full-window queue only said
  "still here" every 30 s). The server caches the live line for 3 s per Worker, so this costs no more than home.
- **Phones:** the full-screen queue, unchanged (its screenshots match the old ones pixel for pixel).
- **How it's built:** App renders home and the queue through one function, so the frame and the home screen stay
  mounted from home to the queue and back (no blink of the menu or panel). The private lobby keeps its own screen.
- **The lobby's chat** (the social delegate's `LobbyChat`, built alongside): on a computer, under your card in the
  left column, as tall as the lobby so it ends level with Cancel (below 1280 px, under the lobby, 280 px or more). One
  chat at a time: App decides by the window (`useMedia`, 1024 px), and the queue screen leaves its own spot empty.
- **A phone's queue, with the chat, fits a common phone** (390 × 664 and 375 × 667: the count, the grid and Cancel in
  view without scrolling). Before the chat it already ran 72 px past a 664 px screen, Cancel half off. My calls:
  - **Your seat is one line** under the grid ("You're in · seat 1"): the card's pawn and its "gold-ringed" line go on
    a phone (your pawn is the gold-ringed one in the grid). A computer keeps the card.
  - **The chat goes under Cancel** and fills the rest of the screen: on a tall phone it's all in view; on a 664 px one
    its header shows at the bottom and the rest is a short scroll. The count, the grid and Cancel come first.
  - The back arrow still leaves the queue (as Cancel does).
- **A private lobby on a computer** is a 640 px column in the middle (it took the game screens' 1,100 px), so its
  chat box and the player list read as one column. Phones unchanged.
- **Checked:** `e2e/home-layout.spec.ts` (the queue in place at 1024, 1280 and 1440 with the menu, panel and card,
  the lobby between them and Cancel in view, Cancel home, into the match, the menu while you wait, the phone's queue
  full screen, no sideways scroll), and `npm run frames:home` (every frame from PLAY to the vote and from PLAY to
  Cancel, dark and light: the menu and panel never missing, the grid never moving, the count never going down, no
  blinks).

### The computer's play column, your icon, no sun (Eric, Oct 9, 2026)

Eric marked up the computer's home: drop the Shop and Profile buttons (the side menu has them), put Play with friends
and Boss alone above PLAY, PLAY at the bottom; and, in follow-ups, the mode tabs right above PLAY (they set up what
PLAY does), no sun, your icon by your name, and the crate's Fischer Random banner was cut off.

- **The computer's play column (1024 px and wider), top to bottom:** Play with friends | Boss alone, the mode tabs
  (Crowd / Boss raid / Classic, then Default / Bots off / Solo and the i), PLAY, and its line. No Shop or Profile
  buttons. From 1280 px the group sits at the bottom of the column, PLAY's line level with the bottom of your card;
  the room above is for the live game (next). 1024-1279 is stacked as before, in the new order. The DOM follows the
  order (Home decides by the window, the same 1024 px as the frame), so Tab goes top to bottom too.
- **Phones keep their layout:** the tabs, PLAY, then all four buttons (screenshots match the old ones below your card).
- **No sun.** The light/dark button is gone from the side menu and the phone's top bar; **Settings → Theme** (Match
  device / Light / Dark) is the one place, as before, and works from any page. (Eric asked for the sun on Oct 8; he
  took it back on Oct 9.) The phone's top bar has more room for the coins as a result.
- **Your icon** (your pixel drawing, or the old emoji) sits to the left of your name and rating on your home card,
  48 px (one screen pixel per icon pixel at 1x, sharp), phone and computer. My call: the queue's small card on a
  computer doesn't show it (your pawn is your picture there, and the name needs the width).
- **The Fischer Random banner** (crate opening; item-builder's lane, the director's exception for this fix): it used
  the board banners' sizes, so on a computer the words were taller than the band and wider than the stage (cut at both
  ends, top and bottom), and on a phone the face and the "!" were cut. Now one size sets the text, the face and the
  gaps (6.4% of the stage's width, at most 52 px), so the face and the words take about 84% of the width in the
  widest font measured; the band grows to fit them, and the stage grows with its width (at least 210 px). The text is
  19 px on a 320 px phone, 47 px at 1280, 52 px from 1440; the line under it never goes below 11 px. Watched frame
  by frame at 320-1920 px: in, slam, hold and out, nothing clipped.
- **Checked:** `e2e/home-layout.spec.ts` (the column's order and PLAY at the bottom at 1024, 1280 and 1440; no Shop or
  Profile on a computer's home; your drawn icon left of your name at 320-430 and 1024-1440; no sun anywhere on home,
  and Settings' Theme through reloads with no flash), `e2e/crate-banner.spec.ts` (the banner measured every frame at
  320, 390, 1024, 1280 and 1920), and `npm run frames:home` (now picks the theme in Settings: one jump in brightness
  per pick, no blinks).

### The live window (Eric, Oct 9, 2026)

Eric: a live game at the top of the computer's play column: a real match if one is running, otherwise "a bot game
here for now, 50v50 bots, that runs for now till we get players". Everyone watching should see the same moment; label
it honestly; no server time for the stand-in; light on the device.

- **Where:** the top of the play column on a computer from 1280 px, above Play with friends | Boss alone, the mode
  tabs and PLAY (which stays at the bottom). It takes the room left in the column, its board as big as that room
  allows (about 300 px at 1280 x 800, 210 px at 1280 x 680, 125 px at 1280 x 600); on a window too short for a
  board worth seeing, only its two lines show. Not at 1024-1279 (stacked: it would push PLAY below the fold) and not on phones; neither fetches
  the replays, and the app's offline cache (the service worker) leaves them out, so a phone never downloads them.
- **A real match first.** Each running Crowd or raid lobby now tells the live hub its board when it changes: the
  position, the move just played, the crowd's top three votes on it ([SAN, count]) and the move number. No names, no
  codes. Lobbies already report changes to the hub (at most every 2 s); this adds about one report per move per
  running match, to a Durable Object already in use. The live line (`/api/live`, polled every 5 s by the home and
  cached 3 s per Worker) carries one **featured** match: a matchmade one (never a private lobby: that game is its
  friends'), the one with the most people in it, then the newest. My
  call: not a WebSocket per watcher. Every home page watching one match's lobby would put load on the match itself,
  and the game comes first; the live line costs nothing extra to read. The window shows it as **Live** (a green dot),
  with "White's crowd: e4 25 · c4 7 · d4 6", and no "Bot match" label. When the match ends or empties, the bot match
  comes back.
- **Otherwise, bot matches played back.** `npm run replays:bots -- [count]` (`packages/sim/scripts/bot-replays.ts`)
  plays Crowd 50 v 50 matches of 100 bots with the real match runner (average-to-loose bots, a 40k-node engine:
  15-30 s a match) and saves each as a compact replay: the bots' names, and per move the move played, the crowd's top
  three votes, a voter's name, how many are left, and the final's player. Ten ship now
  (`packages/app/public/replays/crowd-bots.json`: 75 KB, about 15 KB as served compressed), 64-195 moves each.
- **One shared "live" cycle by the clock:** the replays play one after another, each move shown 9 s (6 s for a
  final's single-player moves), the start 6 s and the result 14 s (`LIVE_WINDOW` in settings.ts). Where you are in
  the cycle comes from the time, so everyone sees the same replay at the same moment. Ten replays make a cycle of
  about 2.5 hours. Adding more is the script run again: it appends new matches from new seeds without touching the
  old ones, and the cycle grows. A day without repeats is about 90 more.
- **Labelled honestly:** "Bot match" (and "Bot match, a recording" to screen readers), the names are the bots'.
  **This is a beta stand-in until real players arrive**; once matches run most of the time, the window will mostly
  show real ones, and the replays can go.
- **Light on the device:** it plays back moves only, with no engine. Each replay's positions are worked out once when
  it starts (chess.js, about 100 moves). The window redraws only when the move changes, on one timer set to that
  moment; nothing runs per frame. The live line's poll was already running. Measured on a computer slowed 4x: the
  page idle 97% of the time, about 200 ms of script in 30 s, DOM nodes flat (240 to 242 over five moves).
- **The right panel** loses "Watching a match from outside comes later" (the window does it). The global chat (the
  social helper's) goes under "Playing now".
- **Checked:** `packages/app/test/bot-replays.test.ts` (the cycle by the clock: every moment's next change is exact,
  and two viewers agree; positions worked out once; every shipped move legal from its position, the most-voted move
  the one played, votes sorted, players left never rising, the final's players), `packages/server/test/lobby.test.ts`
  (a running Crowd match's board and top votes after each move, no names) and `capacity.test.ts` (the featured match:
  matchmade, most people, then newest; never private, empty or stale; the next when one ends), and `e2e/live-window.spec.ts` (the bot
  match at 1280 x 800, 1440 x 900 and 1280 x 680: the label, a square board in the window, the words fitting, PLAY
  still at the bottom, nothing piling up over two moves; none at 1024 or on a phone, and no fetch there; a real match
  running shows as Live with its votes, then back to a bot match).
