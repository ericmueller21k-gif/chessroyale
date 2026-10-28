# Typed chat in the town square (Oct 28, 2026)

How it works now: [`docs/areas/chat.md`](../areas/chat.md), "The town square's typed chat"; the log's look:
[`docs/areas/town-square.md`](../areas/town-square.md).

## What Eric decided

Players type in the town square's chat log. Eric: "I don't see why in this kind of town mode we can't just open up people
to type in it … I think it actually is totally fine to allow typing." At most **80 characters**, **one message every
15 s**, sent from the keyboard's own Send. This reverses "no free text in chat"
([2026-10-16-chat-moderation.md](2026-10-16-chat-moderation.md)) for the town square only: every other chat stays preset
lines and emoji.

Later the same day, through the director:
- **Swear words are refused, not masked**, like slurs ("That message isn't allowed."). Eric: it's family-friendly chat, so
  a word that isn't allowed just isn't allowed. One behavior, less code.
- **A tap anywhere on a player's line** (name or text) opens its menu: Profile / Mute / Report.

## The director's defaults (given to Eric, who asked only about cost)

1. **Only signed-in players type and see players' messages** (accounts are 13 and older). Guests, and every device the
   age gate marked too young, see only the bosses' and kids' chatter and never fetch players' lines.
2. **The filter** extends the name filter (`server/src/text-filter.ts`): slurs and hate terms refused; common swear words
   refused too (above); links, emails and phone numbers refused ("No links or contact details in chat."). The server
   decides.
3. **Tap a line:** Profile / Mute / Report. Mute is the existing one (by account, on the device, every chat). Report is
   fair play's report with a new reason, "Offensive chat", carrying the line's text and time; it opens a watch case as
   reports do. Moderators can take one line down (it leaves everyone's log), and the chat ban stops town typing too.
4. **The limits on the server** (the app mirrors them): 80 characters after trimming, one message per account every
   15 s, the same message not again within a minute, a chat ban refuses with its reason. Numbers in `TOWN_CHAT`.
5. **Nothing kept:** the room holds its lines in memory only, the last few for a newcomer and each for at most 60 s; no
   table of chat lines. The one exception is a report's line, kept as reports are.
6. **The terms and privacy page** say what's true now.
7. **A kill switch** that turns typing off everywhere at once; off, the field shows "Chat is paused." and the log still
   shows the bosses' chatter.

## What it is

- **The room** (`server/src/town-chat.ts`) lives in the live hub beside the global chat, in its memory only: never in
  the hub's storage or D1, so a restart (a deploy) forgets it. Each line is `{n, at, from, name, text}`; the name comes
  from the account (one the name filter refuses goes out as "Player"). It holds each line 60 s (`lineMs`), at most 300
  at once (`holdMax`), and gives a newcomer the last 12 (`keep`).
- **Reading** rides on the live line's poll (`GET /api/live?town=N`), as the global chat does. The answer carries the
  lines after N (at most 12), the numbers of lines a moderator took down in the last minute (`gone`), or
  `{paused: true}`. Each Worker instance keeps the room for 2 s (`readCacheMs`), so the hub is asked at most every 2 s
  per instance however many read.
- **Sending:** `POST /api/town/chat {text, since}`. The answer has the line and the room after it, so your own line shows
  at once, through the same path as everyone's.
- **Who may:** `signedInReader` (this instance's session cache, then whether the account has an email or Google, cached a
  minute) for reading; the account behind the request for sending; never on a request carrying `hc_age=under`.
- **Moderators:** `POST /api/town/chat/remove {n}` (admins only, `ADMIN_EMAILS`), from the line's menu in the town.
- **Reports:** `POST /api/report {target, reason: "Offensive chat", line: n}`. The server reads the line from the room;
  the reporter never supplies the words.
- **The kill switch** is `PAUSE_TOWN_CHAT` on the existing kill-switch mechanism ("town-chat" in core's `pauses.ts`).
- **In the town** (the log's look is the UI's, `docs/decisions/2026-10-28-town-chat.md`; wired here):
  - The field shows for a signed-in player on a device the age gate didn't mark too young (`mayTownChat`); a guest sees the
    log alone (its strip is kept, so the box never changes).
  - `sendTownChat(text)` is async: the field waits for the server's answer (keeping your words and the keyboard). Your line
    comes back in the answer and goes into the log like everyone's. A refusal keeps your words and shows the reason over
    the field for 4 s (`CHAT.noteMs`); the server's wait shows as the field's count.
  - Players' lines come in through `say(name, text, "player", {uid, n})` and go out through `unsay` (by number: a
    moderator's Remove; by player: Mute). Muted and blocked players' lines never reach the log.
  - While the switch is off the field is greyed and says "Chat is paused."; while your chat is banned, why.
  - A tap on a player's line (name or text) opens its menu under it: Profile (over the town), Mute, Report, and Remove for
    a moderator. On your own line Mute and Report are greyed.
  - The UI's 80 characters, 15 s and 60 s are now read from `TOWN_CHAT` (one source of numbers).

## My calls

1. **The switch is `PAUSE_TOWN_CHAT`, not a new `TOWN_CHAT_TYPING`.** The brief named the latter as an example. The
   kill switches already have one reader (`kill-switches.ts`, cached a minute), a place in DEPLOY.md and ops.md, and the
   app already asks `/api/status` every minute and on coming back to the screen. So it's one entry in a list, no new
   code to read a variable. On unless set, as asked. Its line is the director's, "Chat is paused.", not the others'
   "… is resting for a bit". The live poll also says `{paused: true}`, so a town that's open hears it within seconds.
2. **Signed in always means an email or Google, even where signing in isn't set up** (local runs, e2e). The global chat
   lets everyone post where there's no sign-in; here the age rule rests on accounts, so a guest never gets players'
   lines anywhere. The e2e makes its players signed in through the local database, as `asServerAdmin` does.
3. **A device marked too young gets nothing, even with someone signed in on it** (a tab from before the answer). The
   age gate's own call 10 lets such an adult keep their name and notes; the brief says every such device sees only the
   bosses' chatter, so the town follows the brief.
4. **What counts as contact details:** web addresses (with `http`, `www.`, a common ending such as `.com` or `.ly`, or
   spelled "dot com"), email addresses and mail services' names ("at gmail"), phone numbers (seven digits or more in one
   run, spaces and phone marks allowed between them; a letter or a colon ends a run, so "1800 vs 2000" and "12:30"
   pass), and the main messaging apps ("add me on discord", snapchat, instagram, whatsapp, telegram, tiktok, facebook,
   skype, wechat): "add me on …" is how a conversation leaves the game. Endings that start sentences when someone skips
   a space ("me", "to", "be", "in", "us") aren't treated as web addresses. Chess notation, scores and ratings pass.
5. **Swear words:** a short list of our own, ROT13 in the file like the slurs: long ones found inside any word, short
   ones and masked spellings ("f*ck" reads as "fck") only as whole words. Mild words (damn, hell, crap) are left off.
   The ordinary words with one inside are let through (Scunthorpe, shiitake, Japanese names ending "-shita").
   Checked against the 60,000 commonest English words and 2.2 million pairs of the commonest 1,500: in the pairs, only
   "go ok" and "as s" (the names' rule for short words in a row) and a real hate phrase are refused.
6. **Short words in a row in a sentence** (the names' rule joins them, so spaced letters are read as a word): in chat a
   swear word is looked for only from the start of such a run ("sh it", "f u c k" are caught; "is it up or no" and "say
   hi to him" aren't read as one), and a two-letter word that ends a sentence or clause ends its run ("go. ok"). Names
   are read exactly as before.
7. **The same message** is the same letters and digits, whatever the case, spaces, accents or punctuation ("gg!!" is
   "GG"). A refused message doesn't start the 15 s wait; a repeat says "You said that a moment ago."
8. **Tidying before the length check:** control and invisible characters out (including direction overrides), a pile of
   accents on one letter cut to two, spaces run together, trimmed; 80 counts characters, an emoji as one.
9. **"Offensive chat" isn't one of the profile sheet's buttons** (`FAIRPLAY.reports.chatReason` beside `reasons`): a
   report of a line needs the line. The server finds it in the room by its number and the reported player's id, so a
   report can only carry words the player really sent; a line that's gone (each lasts a minute) is refused with "That
   message has gone from the chat. You can still report the player from their profile." One report per line, apart from
   the one-a-day profile report.
10. **What the report keeps** (D1 `reports`, new columns `line`, `line_at`): the text and when it was said, as long as the
    report (until either account is deleted, as before). The reporter's download lists the report without the line:
    those are the other player's words. Fair play's case page shows it under Reports ("“…” (said … in the town square)").
11. **A moderator's Remove is in the line's menu in the town**, for admins, with nothing logged or stored (a line lasts a
    minute; fair play's page would only ever see it gone). The room keeps the removed numbers for a minute so every
    reader's log drops it.
12. **A name reset and a deleted account** take the player's town lines out too (as they do the global chat's).
13. **The field for signed-in players only** (the director): a guest sees the log, never a field asking them to sign in.
    A device marked too young has no field either.
14. **A refusal's reason over the field, 4 s, your words kept**, so you can change a word and send again; the 15 s wait
    shows in the field as the UI built it. While the switch is off or your chat is banned, the reason is the field's
    placeholder (13 px so it fits on a phone; a greyed field can't take focus, so iPhone Safari never zooms).
15. **The menu's label is "Report"** (the director left it to me: "Report player" was fine). Short enough for a phone's
    card, and the menu is the line's. It sends at once (no second confirm): the card shows the server's answer ("Thanks,
    we'll look into it.") and closes. **Profile** opens the profile over the town (App's town branch shows it as a
    match does), so Back returns to the town as it was.
16. **A line's 60 s** counts from when it reached this device, as the UI built it; the server holds it 60 s from when it
    was sent, so a report on a line in its last few seconds can find it gone ("That message has gone from the chat. You
    can still report the player from their profile.").
17. **Lines said by the test hook** (`__townSay`) have no account behind them: a tap on one is still recorded
    (`__townTapped`) but opens no menu. Every test hook works as before.
18. **Reading cost over freshness:** the poll every 5 s (the front door's `livePollMs`) and each instance's 2 s copy put a
    line on another screen in about 3 s on average, 7 s at worst. No socket.

## What it costs (Worker requests per player per hour)

- **A signed-in player in the town, tab visible:** the live poll every 5 s instead of the 30 s heartbeat: **720 requests
  an hour instead of 120, so 600 more.** Nothing more while the tab is hidden. A guest: unchanged (120, the heartbeat).
- **Sending:** one request a message, at most 240 an hour (one per 15 s); in practice a few.
- **The live hub (Durable Object):** at most one read per Worker instance every 2 s (1,800 an hour per instance at most,
  however many players), one call a message, a report or a removal.
- **D1:** a reader's sign-in check once a minute per instance; three reads a message (the fair-play case, the chat ban,
  the name), as the global chat's posts.
- **In money:** Workers' included requests, then $0.30 a million: 1,000 player-hours in the town is about 600,000 extra
  requests, under $0.20. No new service.

## Frame rates

Measured headless (software rendering) by the method of `2026-10-26-town-square-slice-2.md`, with the UI's script
(`2026-10-28-town-chat.md`): a phone 390 × 844 and a computer 1440 × 900, warm 4 s, then 5 s walking (a tap ahead every
1.2 s) or standing still; builds served statically, the runs taken in turn; each case run twice over as a noise control
and pooled (ten runs a case; medians). Main is `cf5417c` (the log's UI). The stand-in server signs the page in and answers
every live poll with three new players' lines, so on the branch the poll runs every 5 s and lines arrive through it (124
polls answered over the runs; none on main, which never asks); the chatter's own three lines arrive in both.

| Case | Phone | Computer |
| --- | --- | --- |
| main, walking | 51.9 fps (19.2 ms) | 40.2 fps (25.0 ms) |
| this branch, walking, the poll every 5 s and players' lines arriving | 52.5 fps (18.9 ms) | 37.5 fps (26.8 ms) |
| main, walking, **as many lines on show** (six players' lines said by the hook, then the chatter's three) | 51.9 fps (19.1 ms) | 37.8 fps (26.5 ms) |
| main, standing still | 53.2 fps (18.7 ms) | 36.4 fps (27.5 ms) |
| this branch, standing still, the field focused and typing, lines arriving | 52.5 fps (19.0 ms) | 34.3 fps (29.2 ms) |

(Milliseconds: the page's main thread per frame.) A phone shows no cost. On a computer the branch walks at 37.5 against
main's 40.2, but main with as many lines on show walks at 37.8: the difference is the log's own drawing of more lines (up to
12 on a computer, each a translucent backing over the moving map, which headless Chrome composites in software), not the
poll or the wiring. Runs of one build differ by up to 2 to 4 fps on a computer (main still: 38.1 and 35.8). The poll and the
log stay out of the frame loop: an answer is parsed in the request's callback, and a line reaches the log through `say()`.
No corner was cut. Should a real computer show the drop, the corner to cut is the line's backing (one backing for the
whole log instead of one a line), the UI's to weigh; a real GPU composites these layers without the main thread.

## Tests

- `packages/server/test/text-filter.test.ts`, "the chat filter": slurs and hate terms refused as in names; swear words
  refused (inside words, spaced, leetspeak, look-alikes, masked); links, emails and phone numbers refused with their own
  reason; ordinary chat passes (chess notation, ratings, times, words with a listed one inside, short words in a row);
  long input read fast.
- `packages/server/test/town-chat.test.ts`: the room (tidying, 80 characters, the filter's reasons, the 15 s wait, the
  repeat, keep 12 and expiry at 60 s, the hold limit, a moderator's removal, a player's lines leaving); the live hub
  (memory only, nothing in storage, gone after a restart; a reset and a deleted account); the API (two signed-in players
  read each other's lines with the live poll, a guest gets none and can't send, even where sign-in isn't set up; a
  too-young device; the server's limits; a chat ban and a fair-play ban; the switch; a moderator's removal; a report
  carrying the line, read from the room, shown on fair play's page).
- `packages/app/test/town-chat-net.test.ts`: a guest or a young device never asks; lines ride on the live poll, only
  what's new; muted and blocked players' lines never reach the log; a removal and the switch reach it; sending mirrors
  the limits and shows the server's reasons; Report and Remove.
- `packages/server/test/account-data.test.ts`: the schema pin gains `reports.line` and `reports.line_at`.
- `packages/app/test/town-chat.test.ts`: players' lines carry who said them and their number, `unsay` takes them out by
  number or by player, a tap reaches the menu; the UI's numbers are the server's.
- `e2e/town-chat.spec.ts` (phone and desktop): two signed-in players see each other's lines within a few seconds, and a
  guest none (no field, and it never asks); a refused message's reason over the field (a swear word, a link, a phone
  number) with the words kept, 80 characters and the 15 s wait on the server; a line's menu (your own: Mute and Report
  greyed; Report reaching fair play's case page with the line; a moderator's Remove leaving every log; Profile over the
  town and back; Mute hiding the player); the switch off. Its players are made signed in through the local database
  (`asSignedIn` in `e2e/helpers.ts`). Only each test's own lines are counted: other tests' players share the room.

## Test checks changed (old → new)

None guards a rule in `docs/rules/eric.md`.
- `packages/server/test/account-data.test.ts`, the schema pin: `reports: "id reporter target reason at match"` →
  `"id reporter target reason at match line line_at"` (a schema change is meant to update it).
- `packages/app/test/town-chat.test.ts`: "your own line (this device only)" (two tests: echoed on this device, trimmed and
  cut to 80; one per 15 s, counted on this device) → removed with the echo itself. Sending is the server's now, tested in
  `town-chat-net.test.ts` (80 characters, the 15 s wait, the server's reasons) and `town-chat.test.ts` on the server.
- `e2e/town-chat.spec.ts` (the UI's tests):
  - "the text field (where the test switches are on): …" → "the text field (a signed-in player's): …". It opens the
    town signed in; the lines it counts are its own (`.tc-player` → `.tc-player` with this run's mark, "hello town" →
    "hello town <run>", "second one" → "second one <run>"), since other tests' players share the room.
  - "without the test switches there is no text field: players see the log only" → "a guest has no text field, and
    without the test switches no hooks either: the log only". Same checks.
  - "the edge chips keep off the chat box…" and "the keyboard opening…": they open the town signed in (the field is a
    signed-in player's now; a faded box without a field can't be picked up). Same checks.
- `e2e/helpers.ts`: `asServerAdmin`'s database write moved into `withEmail`, shared with the new `asSignedIn`. Same
  behavior.
