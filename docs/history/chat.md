# History: Chat

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/chat.md).

## Quick chat in matches (design, Oct 6, 2026; built Oct 7, 2026)

Eric: a chat in 50 v 50, preset messages only (no typing), some unlockable, each with the sender's icon and name.
Roomy on desktop, closed but expandable on a phone. The `social` delegate builds it. My calls:

- **Where:** online 50 v 50 matches and multiplayer boss raids. Not solo (nobody to talk to), and not Classic while
  it's being reworked. The front-door queue can come later.
- **Preset messages only.** No typing anywhere, so there's nothing to moderate. A message is a phrase id; the server
  relays only known phrases the sender owns.
- **The phrases.** About 16 free to start, in four groups:
  - **Hello:** "Good luck!", "Have fun!", "Hi all!", "Let's go!"
  - **Reactions:** "Nice move!", "Wow!", "Oops…", "So close!"
  - **Plans:** "Trust the crowd", "Defend the king!", "Push the pawns!", "Go for mate!"
  - **Sporting:** "GG", "Well played", "Thanks!", "Rematch?"
- **Unlockable phrase packs** in the shop for coins (no money), each a few lines:
  - a God King pack ("For the crown!", "Not while I stand!")
  - a Winter pack ("Ho ho ho!", "Snow way!")
  - a Spicy pack ("Calculated.", "Was that a sacrifice?")
  - Later, packs can come from crates or achievements. The list lives in one file (`core/chat.ts`), so a new pack is a
    few lines.
- **Who hears it.** In 50 v 50, **your team** by default. The Hello and Sporting phrases can also go to **everyone**
  (one switch: Team / All), so plans stay inside the team. In a raid, everyone is one team.
- **Each message shows:** the sender's pixel icon, their name (in the leaderboard's colour for their team) and the
  phrase. Tapping the name opens their profile once the hub's profiles exist.
- **Limits** (server-enforced, in settings.ts): one message every 3 s, at most 5 in 30 s; repeats of the same phrase
  are dropped. Over the limit, the buttons grey out briefly.
- **Muting.**
  - Tap a name to mute that player for the match.
  - A "Chat off" switch hides it all, remembered on the device.
  - Report stays on profiles.
- **Bots chat a little,** so a lobby with bots doesn't feel dead: an occasional "Good luck!" at the start, "Nice move!"
  after a great crowd move, "GG" at the end. At most a few lines a minute across all bots.
- **Desktop (1024 px+):** a chat panel at the right of the game screen. The feed shows the last ~30 messages, with the
  phrase buttons below it in their groups.
- **Phone (revised by Eric, Oct 7): chat and the scoreboard share the space under the board.**
  - **Split, the default:** the scoreboard on the left and chat on the right, side by side, each in its own panel.
    The scoreboard's narrow form shows place, name and points. Chat shows the last few messages with their icons,
    and a row of phrase and emoji buttons.
  - **Each panel has an expand button** (⤢) in its header. Tapping it makes that panel full width and hides the other
    entirely, header and all.
  - **The full panel's button turns into "split"** (⇆), which brings both back side by side.
  - So: split → scoreboard full → split → chat full → split. You can't open both full, and you're never more than one
    tap from seeing both.
  - **The choice is remembered** on the device, so people who only want the scoreboard (or only chat) keep it that way.
  - **Unread messages:** while chat is hidden, the scoreboard's header shows an unread count, and the newest message
    shows for about 2 s as a small one-line bubble under the top bar (icon, name, phrase), never over the board. The
    bubble can be switched off.
  - The board is never covered, and moves are never blocked.
- **Emoji packs (Eric, Oct 7).** Alongside the phrases, players can send a single emoji: a quick reaction, shown in the
  feed with the sender's icon and name, and floating briefly above their row on the scoreboard.
  - **Free to start, "Basics":** 👍 👏 😂 😮 😬 🔥 💀 🎉.
  - **Unlockable packs for coins** in the shop, like the phrase packs:
    - "Chess": ♟️ 👑 🏰 🐴 ⚔️ 🛡️
    - "Winter": ❄️ ⛄ 🎄 🎁 🦌 🍪
    - "Royal": 🤴 👸 💎 🏆 ⚜️ 🐉
  - The same limits as phrases (one every 3 s, 5 in 30 s). Muting a player hides their emoji too.
  - Packs live in the same `core/chat.ts` list as the phrases, so a new pack is a few lines. Custom pixel emotes can
    replace system emoji later.
- **Sound:** a soft tick for a team message, never louder than a move, and none when muted.

### Built (Oct 7, 2026)

The `social` delegate built it as designed. The lines and packs are in `core/chat.ts`, every number in
`QUICK_CHAT` (settings.ts), the relay in `server/lobby.ts`, the app's side in `app/chat.ts` and
`components/QuickChat.tsx`. My calls where the design left room:

- **Where the panel is.**
  - Phone: the split under the board on every screen that has the scoreboard (your move, watching the other team,
    the reveal, the boss).
  - Computer: the column beside the board, under the move's panel, from 1100 px (not 1024), where the leaderboard
    moves to the side of the screen. From 900 to 1099 px the scoreboard is still in that column, so it keeps the
    phone's split there.
  - Pages: the results (so the GGs work), a boss raid's "watching" page, and the cut screen once you're out
    (knocked-out players stay on it until the results, and can keep cheering their team).
  - The pre-game votes and the final's own screen have no panel (their space is the vote and the final's teams): new
    lines come as the bubble there.
  - No chat button in the top bar: the revised design puts the unread count on the scoreboard's header.
- **The split.**
  - Half and half.
  - In the split, the Team / All switch takes the "Chat" title's place (there's no room for both).
  - It shows only whole lines (no half-cut line at the top).
  - The scoreboard's old ▾ now folds both panels to their headers and grows the board, as before (same remembered
    choice).
  - The unread count's tap brings chat back beside the scoreboard.
- **Tapping a name** opens a small menu in place of the buttons, with Profile and Mute for this match. The design
  asked for both on the same tap, and nothing pops up over the board.
- **Team / All.**
  - Emoji stay in your team, like the reactions (a 😂 to the other team after their blunder is a taunt). (Changed
    by Eric the same day: emoji can go to All. See "Emoji to All, and your picks in the profile" below.)
  - Each pack phrase joins one of the four groups, so the rule stays one sentence: "Hello and Sporting lines go to
    both teams".
  - With All on, the team-only buttons grey out and the feed says why.
  - There's no switch where everyone is one team: a raid, "everyone moves", and a 50 v 50's boss battle.
- **Team colours.** A white or black chip before the name, only on lines sent to everyone. A team line is always
  your team's, and a black name can't be read on the dark panel.
- **Limits.**
  - "Repeats are dropped" means the same line as your last one, within 30 s; other lines still go.
  - Over the limit the buttons grey out until they work again. At the 5-in-30-s limit, the feed says when.
  - The server checks everything and tells the sender why it dropped a line. Free text, unknown ids and pack lines
    you don't own never reach anyone.
- **Muting.**
  - A mute is for this match, on this device. It's kept with the lobby's code, so a reload keeps it. The server
    stops sending that player's lines to you.
  - Chat off is per device. The server sends you nothing, you can't send, and the panel says so with "Turn chat on".
  - Both switches are in the panel's ⋯ menu and in Settings (Quick chat, and the bubble).
- **The packs.**
  - Each has Eric's two lines and two more in the same spirit:
    - God King: "Call the King!", "Long live the King!"
    - Winter: "Ice cold.", "Happy holidays!"
    - Spicy: "Spicy!", "All in!"
  - Prices are in coins (`QUICK_CHAT.packPrices`): phrase packs 300 / 200 / 250, emoji packs 200 / 200 / 300.
    They're free while `SHOP_FREE` is on.
  - They're shop items in a "Chat packs" tab. You own them, there's nothing to equip, and the free ones show as
    "Free · yours".
  - The server reads what you own from your account when you join. A pack bought during a match works from the
    next one (or after a reload).
- **Icons.**
  - Each line shows the sender's pixel icon, as Eric asked. Profiles still don't show it to others (the hub's call).
  - An icon goes out once per sender per player, with their first line.
  - Icons are stored beside the lobby's record, not in it (Durable Object values are limited to 128 KB).
  - Bots, and people without a drawing, get a pawn.
- **Bots.**
  - "Good luck!"-type lines at the start: 90% of matches, from one or two bots, to everyone.
  - "Nice move!" or "Wow!": 30% of the time after a crowd move that lost at most 1 point, from a bot on that team.
  - "GG" or "Well played" at the end: 90%, from one or two bots.
  - Each comes 1.5-6 s after the moment. Across all bots there are at most 3 lines a minute.
  - They use their own randomness, so chat never changes how a match plays out.
- **Sound.** A tick at a quarter of the clock's tick, for team lines from others only, at most every 0.4 s. It
  follows the mute switch.
- **Looks.**
  - The panel is dark in both themes, like the scoreboard beside it. A page's chat follows the theme.
  - The bubble is a dark pill on light pages and a lighter pill with an edge in dark mode.
  - The bubble shows whenever no chat panel is on screen (scoreboard full, folded, a reveal too short for the
    split's feed, the votes). It sits between the top bar and the board. If there's no room it rides up over the bar,
    never over the board, and it takes no taps.
- **Classic has no chat** (server and app), and neither does the queue. (The queue does since Oct 8: "Lobby chat",
  below.)
- **Checked frame by frame** with `npm run frames:chat -- <dir> [moves] [dark|light] [split|chat|board]`
  (`scripts/frames-chat-move.mjs`, Worker running). It plays real taps on a phone while another player's lines
  arrive, records every painted frame, the board's box, the bubble's box and each change of the pieces.
  - In all three layouts and both themes: one board box throughout, every tap's move picked, no bubble ever over
    the board, and no flash.
  - The only brightness jumps were the reveal's poll appearing.
  - The pieces' frames match the same run on `main`: after a pick, Crowd's piece slides back and your pick shows as
    a vote. That's unchanged.

### Emoji to All, and your picks in the profile (Eric, Oct 7, 2026)

Eric: "we can add emojis to all chat that's fine. In profile players can select up to 10 quick chats which are the
ones they see in their games, for the total list it can just be a clean dropdown menu with a search function in the
profile under quick chat and emoji selection." My calls:

- **Emoji follow the Team / All switch,** like Hello and Sporting lines (`canSayToAll`). The server checks them the
  same way: ownership, the limits, mute and chat off. Reactions and plans still stay in the team.
  - The panel's All note now reads "Hello and Sporting lines and emoji go to both teams. Plans and reactions stay in
    your team."
  - **On the other team's screen,** the scoreboard shows only their own team, so the sender has no row to float
    from. An emoji whose sender has no row floats from the scoreboard's header instead, in a small dark pill with
    the sender's white or black chip (when it went to everyone). The same goes for a teammate whose row a phone's
    short scoreboard isn't showing. It's in the feed (with the chip) and the bubble as before.
  - There's still no tick for lines to everyone, emoji included.
- **The profile section "Quick chat and emoji"** is the social lane's, on your own profile only, under Wearing (your
  look, then your voice; it also balances the computer's two columns). Its code is `components/ChatPicks.tsx`; the
  profile screen only places it.
  - Two blocks, Lines (n/10) and Emoji (n/8). Your picks show as chips in your order; tapping one takes it out.
  - Each has a "Choose lines" / "Choose emoji" dropdown. It opens in place (no popup) with a search box at the top
    (16 px, so iOS doesn't zoom), then the whole list by pack: yours first, then the shop's. Picked rows have a
    gold check. Rows are 50 px tall; emoji are 56 px squares.
  - The search matches a line's words, its group (so "plans" finds the plans), an emoji's name ("fire") and the
    pack's own name. Every pack's name ends in "pack" or "emoji", so those words are left out, or "pa" would match
    them all. Emoji got names for this (and for screen readers).
  - A new pick goes at the end. There's no drag to reorder: take one out and add it again. At the cap, the
    unpicked rows grey out and the menu says "10/10 picked. Take one out to add another."
  - Lines from packs you don't own show locked, with a 🔒 and the pack's name ("God King pack ›"). A tap opens the
    shop on its Chat packs tab. In a match (your profile opened over the game) the shop isn't one tap away, so they
    show locked without the link.
  - Each change saves to your account at once, with no Save button. "Back to the defaults" shows once a list
    differs from them.
  - You can take every line out. Then the match panel says to pick some in your profile.
- **The caps, in `QUICK_CHAT`:** 10 lines (Eric) and **8 emoji**. Eight is what the free Basics pack has, so the
  defaults are all the free emoji and nobody's emoji row changes. Eight fit one row of a phone's full-width chat
  without scrolling (about 37 px each on a 390 px phone; the row is a grid of equal columns). In the narrow split
  they scroll sideways, as before.
- **The defaults** (`QUICK_CHAT.defaultLines`, `defaultEmoji`) are for everyone who hasn't chosen, new and
  existing players alike. They're stored as "not chosen", not copied, so a change to the defaults reaches them.
  - Lines: Good luck!, Have fun!, Nice move!, Wow!, Oops…, Trust the crowd, Defend the king!, Go for mate!, GG,
    Thanks!. Two of each group and three reactions and plans, all free. Five go to All, so the switch still does
    something.
  - Left out: Hi all! and Let's go! (Good luck! and Have fun! say it), So close!, Push the pawns!, Well played
    (GG says it), Rematch? (a 100-player match has no rematch). Thanks! stays, to answer a "Nice move!".
  - Emoji: the eight free ones, in their order.
  - Someone who owns a pack sees the defaults too until they pick its lines. Ten slots can't hold everything, and
    while the shop is free most testers own every pack.
- **Lines and emoji are chosen apart.** Picking lines leaves your emoji on the defaults, and the other way round.
- **In the match** the buttons are your picks in your order. They replace the four fixed groups: a phone's sideways
  row of lines and a row of emoji, and the computer's lines wrapping with the emoji under them. There are no group
  headings any more. With All on, the lines that can't go to everyone grey out, as before.
- **Getting a pack:** its lines go into any empty slots, in the pack's order, up to the cap. This happens on the
  server, as part of the purchase. Most players are full (the defaults are 10/10 and 8/8), so the shop then shows
  "Your quick chat lines are full (10/10), so nothing changed in your games yet." with **Pick these in your
  profile ›**. If only some went in, it names what went in and offers the same button. The button opens your
  profile at Quick chat and emoji, and closing it goes back to the shop.
- **The shop's Chat packs text** says to choose your 10 lines and 8 emoji in your profile (the numbers come from
  settings). The tab ends with a "Choose your lines and emoji in your profile ›" button. Settings' Quick chat
  switch says the same.
- **Where the picks live:** with the shop's state in D1, in a `chat_picks` table (one row per player: each kind a
  JSON list, or NULL for the defaults). `shopState` returns them as `chat`, so they come with your profile, like
  your equipped items. `POST /api/shop/chat {lines?, emoji?}` saves them; null puts a kind back to the defaults.
  - The server cleans what it's sent: known lines of that kind, from packs you own, no repeats, at most the cap.
  - Signing in to an existing account brings a guest's picks along, unless the account has its own (as with
    equipped items).
- **The server doesn't enforce picks, only ownership.** Picks only decide which buttons show. Any line you own is
  still yours to say, so an old tab or a pack just got never has a line refused.
  - The app reads the picks from your account, which is loaded before any match. A change made in your profile
    during a match shows at once.
- **Bots keep their own full list** (`botChatLines` is unchanged).

### The panel under the board: one view, never an empty box (Eric, Oct 7, 2026)

Eric, on his iPhone: "the scoreboard can be both large like this and not showing because there's 2 buttons which
control its view. If it's enlarged like so it should reset the other toggle or switch it". His screenshot showed a
tall, empty black box about two thirds of the screen wide, under the header "White team · tap for all 50".

- **The cause.** Two settings, one per button: the layout (`brc.underBoard`: split, board, chat) and the fold
  (`brc.miniTower`). Folding side by side, then tapping the scoreboard's ⤢, gave "scoreboard full width, folded".
  - Its class was `under-board board closed`, and `.board` is the chessboard's own rule
    (`width: 100%; height: 100%`).
  - Open, `flex: 1 1 0` overrode that height. Folded (`flex: none`), the panel took the screen's full height.
  - The folded scoreboard inside it kept only its header's width (about 60%) and stretched to that height, with no
    rows.
  - Every saved combination was reproduced on an emulated iPhone. Only "full width + folded" was empty, with chat
    on or off. Open, the same class collision also made the panel 20 px too wide.
- **One view** (`prefs.ts`, `underBoardView`): `{ layout, open }`, kept in one setting (`brc.underBoardView`). Every
  panel and the scoreboard read it and redraw together.
  - Showing a layout always opens it: a panel's ⤢, "side by side" (□□), and the unread count's tap.
  - The arrow folds or opens and keeps the layout. Folded, the panel is just its header bar, the full width (side by
    side: both headers, half each).
  - The layout classes are now `ub-split`, `ub-board` and `ub-chat`, so nothing of the chessboard's applies.
- **Old settings fix themselves on load.** The two old keys become the one view and are removed. A full-width panel
  that was folded opens: in the new view you can't fold one by making it bigger, and folded it was the empty box.
  Side by side and folded stays folded, since it was always a small bar. Eric's phone shows the full scoreboard on
  its next reload.
- **No chat (solo, Classic) or chat off:** the scoreboard alone, full width, with its own fold arrow and no split
  buttons. With chat off, the phone no longer shows a "Chat is off" panel; Settings turns chat back on, and the
  remembered layout returns.
- **Tested:**
  - `e2e/panel.spec.ts` taps every button from every state, folded and open, and reloads after each tap. It also
    loads each old-build combination, runs a match with chat off, and folds and opens a solo Crowd match. After
    every step the panel shows rows, chat or a small bar, and fits the screen.
  - On the old code it failed at the second tap, Eric's box (652 px tall, no rows).
  - `app/test/under-board.test.ts` covers the view, the migration, and a device without storage.

### Lobby chat: quick chat while the match fills (Eric, Oct 8, 2026)

Eric: "there should be a chat while you wait for players … the chat could be initiated at this point and then you
could see the lobby chat." The `social` delegate's calls:

- **Where:** the queue (Play now's Default and Bots off, raids), private lobbies, and Solo's queue. Crowd and raids
  only: Classic still has no chat. Not the "servers are busy" line (no seat yet, so no lobby to talk in).
- **One channel, "Lobby",** for everyone in the lobby. There are no teams yet, so there's no Team / All switch, and
  every line you own can go, plans included: there's no other team to keep a plan from. Team / All begins with the
  match.
- **The lobby's lines carry on into the match's feed.** Eric's "initiated at this point" reads as one conversation
  that starts in the queue. They're marked as the lobby's: a small "lobby" tag where tags show (the computer's panel,
  a phone's full-width chat), and no team chip, since nobody had a team when they said it. Lines already seen in the
  queue don't count as unread or bubble up. A rejoin mid-match gets them too.
- **The same rules as in the match:** the presets, your 10 lines and 8 emoji from your profile, mute, chat off, the
  limits (one every 3 s, 5 in 30 s, no repeats), and the server's checks (known lines you own; names from the lobby,
  never the message). A mute made in the queue lasts into the match (it's kept with the lobby's code). The limits
  are kept by account, so Cancel and PLAY again into the same lobby doesn't reset them.
- **Someone who leaves the queue** takes their seat and their name with them. Their lines stay on the screens that
  already showed them (the app keeps the names it has seen), and newcomers never get them (the server sends only lines
  from people still in the lobby).
- **The bots say hello as they fill the empty seats** (Default, a matchmade raid): one or two of "Hi all!", "Have
  fun!" and "Let's go!", 0.3-0.9 s after they sit down (the second 0.5 s later), inside the 1.8 s the full grid shows.
  - Always at least one (`botLobbyChance` 1): the moment is short, and an empty chat looks dead.
  - They count toward the 3-a-minute cap on bot lines, so with the match's own "Good luck!" it's three at most.
  - Bots off has no bots, so no hellos. A private lobby's bots arrive with Start, which begins the match at once,
    so they greet as the match begins, as before.
- **Solo:** its queue (3.1 s) has the chat too. There's no server, so the app stands in for one with the same checks
  (`SoloLobbyChat` in `app/chat.ts`). The bots already seated halfway through the fill say hello, so their lines land
  while the queue is up. Solo matches still have no chat, so it closes as the match begins. A mute there isn't stored.
- **No sound for lobby lines.** They go to everyone there, like All lines in a match (which don't tick), and the
  queue already has its pops.
- **The server** relays chat in the waiting phase, with the same validation. Chat never keeps a lobby open:
  - chat and chat settings don't count as activity (`activeAt`), so a lobby nobody starts closes an hour after the
    last join, leave, connection or drop, however much is said. The hub's rule ("sent anything") is now "anything but
    quick chat";
  - chat sets no timers, so the fill time, the match's start and the close time are untouched.
  - Icons already sent in the queue aren't sent again as the match begins.
- **Where it shows** (`components/LobbyChat.tsx`, self-contained: it takes its size from the box it's put in, with
  no fixed positioning, so the hub can place it):
  - Phone: under the grid, inside the queue's panel, above "You're in". At least two whole lines
    (`QUICK_CHAT.lobbyFeedLines`), more when there's room. Its header says "Lobby · Everyone here · teams come with
    the match", with ⋯ for chat off and the mutes.
  - Computer: for now in the right column under Cancel (the queue grid's free cell). The hub's new layout moves it.
  - Private lobby: a 210 px box under the players.
  - It follows the page's theme (the queue's own colours).
  - On an iPhone 13 in Safari (390 × 664), the count, the grid and the whole chat are in view while the queue fills.
    "You're in" and Cancel are below. The queue already ran 72 px past that screen before the chat (Cancel was half
    off it); the back arrow also leaves the queue.
- **Checked:**
  - Unit tests: `server/test/lobby-chat.test.ts` (the relay, validation, mute and chat off, the limits, bot hellos
    and their cap, close-out never held up by chat, the carry-over), and the lobby moment in `core/test/chat.test.ts`
    and `app/test/chat.test.ts`.
  - e2e: `e2e/lobby-chat.spec.ts` (phone and computer): two players in a Default queue see each other's lines, the
    bots say hello, and the lines carry into the match; Solo's queue; a private lobby.
  - Frame by frame: `npm run frames:lobbychat -- <dir> [dark|light]` (Worker running) records every frame on a
    phone while lines arrive, a real tap on a line and on an emoji, people pop in, then the fill and the bots' hellos.
    In both themes the chat never covered the count, the grid or Cancel, and nothing moved or resized while lines
    arrived. The only move was the queue's own "Unranked" line appearing at the fill, which moves everything under it
    down 28 px.

### Global chat on the home page (Eric, Oct 9, 2026)

Eric marked a "GLOBAL CHAT" box in the computer's right column, under Playing now: "Simulate slow bot chat for beta,
timestamp of chat, name, icon, rating if possible, limited to 1 message per 30s". The director's brief: preset lines
only for now, desktop only, signed-in players post, guests read, bots behind one switch. The `social` delegate's calls:

- **Where:** the computer's home page only (the right column from 1024 px, under Playing now), filling the rest of
  the column's height: the feed scrolls inside it, the buttons stay at its foot. Not the queue (the lobby has its own
  chat in the centre), the shop, the profile or Settings, and not on a phone yet. The hub owns the column; the panel
  is one self-contained component (`components/GlobalChat.tsx`) placed after Playing now.
- **Preset lines only, as in quick chat.** No text box anywhere, and the server takes only a line's id
  (`canSayHome`, `core/chat.ts`):
  - **A new free "Lobby" pack, for the home page only** (20 lines): Hey everyone!, Morning all!, Evening all!,
    Welcome!, Hello again!, Anyone up for a raid?, Anyone for 50 v 50?, Queueing now, join me!, One more game?, Just
    won one!, Beat the boss!, Knocked out early…, What a nail-biter!, The crowd was wild!, That boss is tough!, GG
    all!, Thanks for the games!, BRB, Bye for now!, See you on the board!. It isn't in the shop, the profile's picks
    or a match (a match's server refuses its lines). No line uses "close" or "back": the home page's other buttons
    are found by those words (Close, Back), in the app and its tests.
  - **The general lines:** Hello, Reactions and Sporting lines of every pack you own (the free ones, and God King,
    Winter and Spicy once got). **Plans** ("Defend the king!") are left out: they're orders to a team, and there's no
    team on the home page.
  - **Emoji:** every emoji pack you own.
  - **The buttons** are three tabs: **Lobby** (the pack), **Yours** (your profile's picked lines that suit the home
    page) and **Emoji** (your picked emoji). Owned packs reach it through your picks, as in matches; the server checks
    ownership, not picks, as in matches.
- **Each line shows** its time ("2:41 PM" today, "Oct 8" before), the icon (a drawing, an older account's emoji, else
  a pawn), the name, the rating if the player has one, and the line. Your own lines say "You", in gold. Names,
  ratings and icons come from the account on the server, never from the request. Nothing private goes out: no
  email or sign-in method. A line does carry the account id, so tapping a name can open the profile (ids are random;
  a player who posts in a public room can be looked up, like anyone in a shared lobby).
- **The limit: one message per account every 30 s** (`GLOBAL_CHAT.gapMs`), enforced by the live hub. It's checked
  against the last line kept too, so a restart doesn't reset it. The app mirrors it: after a line, every button
  greys out with "Next message in 28 s", also after a reload (your own last line says when). The server's 429
  carries how long to wait, and the app takes that too.
- **Who can post:** signed-in players, wherever a way to sign in is set up (production), the same rule as online
  play. Guests read, with "Sign in to chat. Guests can read." and a Sign in button. Banned players can't post (fair
  play's ban). Locally, with no sign-in set up, anyone can post, as anyone can play online there (so the e2e can).
- **The server:** the existing live hub Durable Object (`live-hub.ts`) holds one shared room (`server/global-chat.ts`,
  pure and tested). It keeps the last 50 lines (`GLOBAL_CHAT.keep`, nothing older than a day) in its storage, so a
  newcomer sees recent chat and a deploy doesn't wipe it.
- **No new socket or poll.** There's no presence socket: presence is the live line's poll (`GET /api/live`, every 5 s
  while a front-door screen is open). The chat rides on it: `?chat=N` asks for the lines after N, and the answer
  carries only those (usually none). Each Worker instance keeps the room for 3 s, like the live line's numbers. So a
  line reaches others within about 8 s, which suits a room limited to one line in 30 s. Posting is
  `POST /api/chat {say}`, whose answer brings the poster's view up to date at once. Requests without `?chat` (matches'
  heartbeats) are unchanged.
- **Drawn icons** never go in the lines (up to 16 KB each). A line carries the drawing's key (a hash of it), and the
  app shows `/api/chat/icon/KEY`, which the browser caches for good (the key changes with the drawing). The hub keeps
  only the icons of lines it still holds.
- **Bots chatter for the beta**, behind one switch: **`GLOBAL_CHAT_BOTS` in settings.ts. Eric wants it off when the
  game goes live** (set it to `false`).
  - A bot says something about every 30-90 s (`GLOBAL_CHAT.botGapMs`), and the first 4-15 s after someone opens the
    chat when nobody had it open, so a quiet room comes to life soon.
  - **Only while someone has it open, with nothing running otherwise.** There's no timer or alarm: a bot's line is
    made when an app asks for the chat and one is due. With nobody watching for over 15 s, nothing is said, and
    nothing is made up for the gap when someone comes back.
  - The names are the match bots' list, with the pawn icon, like the bots in a match's chat. Every bot line has a
    **"bot" tag** after the name, and no rating. No bot speaks twice in six lines, and no line repeats in six.
  - Their lines (`HOME_BOT_LINES`): hellos, "Anyone up for a raid?" and "Anyone for 50 v 50?" (most often),
    results, good sport, and 👍 😂 🔥 🎉.
- **Light:** at most 50 lines in memory and on screen (on the server and in the app). No per-frame work: the panel
  redraws when a line arrives, and once a second only while your countdown runs. No new paid service: the live hub,
  its storage (one small write per line) and the Worker, as before.
- **Mute and report:**
  - Tapping a name gives Profile and Mute, in place of the buttons.
  - Mute hides that player's lines on this device (remembered, up to 200 players). The header shows "🔇 2 muted ·
    unmute" to bring them all back.
  - Report is on the profile, as before (fair play's reports).
  - Quick chat's "Chat off" switch (Settings) turns this chat off too. Nothing is fetched then, and the panel says
    so, with "Turn chat on".
- **Tested:** `core/test/global-chat.test.ts` (the presets-only rule, the lobby pack kept out of matches and the
  shop, the buttons, the bots' lines and turns), `server/test/global-chat.test.ts` (the 30 s limit, through a
  restart; presets only; the bot tag; bots only while watched, never catching up; the switch off; the live hub's
  relay, history, restart and icons; the API: guests read but can't post where sign-in is set up, banned players
  can't post, no email in what goes out), `app/test/global-chat.test.ts` (the 50-line cap, the mirrored limit, mute)
  and `e2e/global-chat.spec.ts` (computer: post a line, a second player sees it, the buttons rest, the server's 429,
  free text refused, the wait kept through a reload, an emoji, a bot's tagged line, mute; phone: no panel).
