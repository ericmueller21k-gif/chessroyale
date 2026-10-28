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
4. **What counts as contact details** (after the review and the re-review):
   - web addresses: `http`, `www.`, a common ending (`.com`, `.ly`, `.io`…), an address with a path ("t.me/x",
     "discord.gg/x"), a dot with a space before it ("example . io", never prose), a dot in brackets ("example(.)com",
     "example [.] com", "example{.}net"), "dot com";
   - email addresses, mail services' names ("my gmail"), and one spelled out ("at yahoo", "@ gmail");
   - messaging apps and games with their own chat ("add me on discord", snapchat, instagram, whatsapp, telegram, tiktok,
     facebook, skype, wechat, roblox, kik): "add me on …" is how a conversation leaves the game;
   - **phone numbers, by the director's rule after the third review: a message with 7 or more digits in all is refused**
     ("No links or contact details in chat."), any script's digits (`\p{Nd}`), counted across the whole message, however
     they're spaced or split. The rating exceptions, the run shapes and the "number talk" words are gone: each round of
     shapes opened new holes ("5 5 5 1 2 3 4", "12 34 56 78", "555 12 34"), and "#" is checkmate in chess.
   - **So these are refused:** every phone form from the three reviews ("555 1234", "555 123 4567", "555/123/4567",
     "9123 4567", "0800 1000 2000", "06 12 34 56 78", "+44 20 7946 0958", "5 5 5 1 2 3 4 5 6 7", "dm 9 1 2 3 4 5 6 7",
     "12 34 56 78", "123-45-67", card numbers…), and, accepted, rating ranges ("rated 1200-1400"), long score lists
     ("Nf7# 1-0 2-0 3-0"), long move lists and full dates ("2026-10-28").
   - **And these pass:** a short message's numbers, six digits or fewer: "I'm 1500", "1200 or so", "gg 1-0", "3+2",
     "Nf7#", "e4 e5", "1. e4 e5 2. Nf3", "12:30", "game 3 of 5".
   Endings that start sentences when someone skips a space ("me", "to", "be", "in", "us") aren't web addresses without
   a path.
   - **Known gaps:** a number spelled in words ("five five five…"), an address spelled out in other ways, a phone number
     split over several messages. The report button is the backstop: a moderator reads the reported line.
5. **Swear words:** a short list of our own, ROT13 in the file like the slurs: long ones found inside any word, short
   ones only as whole words, the masked spellings ("f*ck" reads as "fck") as whole words with an ending ("f*cking",
   "sh*tty", "fukin"). Mild words (damn, hell, crap) are left off. The ordinary words with one inside are let through
   (Scunthorpe, shiitake, Japanese names ending "-shita"; "who're" is "who are"). Checked after the review against the
   60,000 commonest English words (only swear words and the apps and mail services refused) and 2.2 million pairs of the
   commonest 1,500: 11 refused, a real hate phrase, "s hit" and "t its" (split on purpose), and pairs the word list makes
   of contractions ("'s hit", "'t its", "as 's") or that nobody types ("go ok", "shh it", "c until"). The same after the
   re-review, which added the v-for-u and ph-for-f spellings (Phuket let through).
6. **Short words in a row in a sentence** (the names' rule joins them, so spaced letters are read as a word): in chat a
   run of single letters ("f u c k", "u f u c k") is read as one word; a run with a two-letter word in it ("go f u c k",
   "oh s h i t") is searched from where each typed piece starts, so a swear word split among them is caught while the
   little words of a sentence don't spell one by chance ("is it up or no", "say hi to him"). A word split once, with
   one side short ("f uck", "fuc k", "bi tch"), is read across the two. A two-letter word that ends a sentence or clause
   ends its run ("go. ok"). Names are read exactly as before.
6a. **Look-alike letters** (the review's blocking finding, and the re-review): the filter reads Cyrillic, Greek, Armenian
   and Coptic letters, Latin's small capitals and variants (dotless ı, ɡ, ʀ, ꜰ, ə, ɔ…) as the Latin letters they pass for,
   from Unicode's confusables for single Latin letters, in names and in chat. In chat a word as typed that has real Latin
   letters (a to z) and a letter from an alphabet with Latin look-alikes (Cyrillic, Greek, Armenian, Cherokee, Coptic,
   Lisu, Latin's extensions) that the map doesn't fold is refused ("That message isn't allowed."), so a look-alike the
   list doesn't have yet can't carry a word past it. So is a word made only of look-alikes from two or more of those
   alphabets when one of its letters isn't on the map (Cyrillic п, е, г beside a Cherokee letter; the third review);
   Cherokee ꭵ and Cyrillic ꙇ are on the map now. Words wholly in another alphabet pass ("дела", "как дела",
   "добрый вечер", "καλημέρα", "дякую"), and so does another script beside Latin ("gg楽しかった", "ok你好"), and
   Azerbaijani's ə ("Bakı gözəldir"). Names don't get the backstop: real names in other alphabets still work.
7. **The same message** is the same letters and digits, whatever the case, spaces, accents or punctuation ("gg!!" is
   "GG"). A refused message doesn't start the 15 s wait; a repeat says "You said that a moment ago."
8. **Tidying before the length check:** control and invisible characters out (including direction overrides), and the
   fillers that show as nothing (Hangul fillers, the blank braille cell), so a message of only them is empty; a joiner
   stays only inside an emoji (👩‍💻, 🏳️‍🌈); a pile of accents on one letter cut to two; spaces run together, trimmed. 80
   counts what shows as one character as one (an emoji with its skin tone, or joined into one, as a family of four), up to
   8 code points; a "character" made of more counts every code point (a 200-emoji chain, a pile of skin tones, a run of
   jamo), so 80 can't be beaten with one huge one; and at most 240 code points in all (3 × 80: the third review), so 80
   medium characters can't carry hundreds of emoji (a family emoji and 80 skin-toned ones still fit). The app counts the
   same way, and the field stops at 80 and at 240 as you type (no `maxlength`, which counts UTF-16 units: 80 emoji fit).
8a. **The room keeps nothing past a minute** (the review; the re-review made a reader ahead of an instance's copy read
   the room again at most every 250 ms, a Remove keep the copy's timer too): the hub's alarm rings at the next line's minute and sweeps it
   out, visitors or not; the wait and the repeat keep when and a hash of the words, for a minute; each Worker instance's
   2 s copy of the room goes on that instance's next request after it. A restart gives the room a new id, and an app
   seeing a new one drops its players' lines first (a Remove or a Report never reaches another line by an old number).
   An instance whose copy is older than what the reader has seen reads the room again rather than telling it to start
   over (lines shown twice).
8b. **A huge message never reaches the shared hub:** a body over 8 KB is refused in the Worker, and the text is cut to
   1,024 characters before it goes; the global chat's line id is cut to 64.
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
13. **The field for everyone, greyed with why when it can't send** (the review, after the director's first call to hide it:
    Eric's rule is "nothing hidden", and it tells guests how to join): "Sign in to chat with other players." for a guest,
    "Chat with other players is for accounts 13 and older." for a young device (it answered too young, so the cutoff may
    show). Players' lines leave the log at once when access ends: signed out, the device marked too young, the chat
    paused, or a player blocked. Only someone who may read the chat can report a line (a guest or a young device can't
    probe who spoke). The automated fair-play reviewer gets a chat report without its words, can't clear a case with a
    chat report newer than a person's last decision on it (its own "review" doesn't count), and its guide lists
    "Offensive chat" among the reasons it never decides.
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
- After the independent review, a test for each finding: `text-filter.test.ts`, "the filter after the review" (look-alike
  letters in names and chat, the mixed-alphabet backstop, swear words split or masked with an ending, contact details in
  more shapes, rating talk passing); `town-chat.test.ts`, "after the review" (look-alikes into the room, fillers-only
  messages, a joined emoji and its count, a stale instance copy never resetting a reader and a new room resetting it,
  nothing outliving its minute: hashes not words, the hub's alarm sweeping, the instance copy going) and "the API after
  the review" (a huge body never reaching the hub, the global chat's id cut, a guest's or young device's report
  refused, the reviewer's API without the words and unable to clear a chat report); `town-chat-net.test.ts`, "after the
  review" (a new room dropping the lines shown, lines leaving at once on a block, the switch, signing out and a young
  device, the field's reasons); `faq.test.ts` (the chat entry and its reported-message exception); `e2e/town-chat.spec.ts`
  (a guest's greyed field, the privacy page's and the terms' sentences).
- After the re-review: `text-filter.test.ts`, "the filter after the re-review" (phone shapes refused and ordinary numbers
  passing, a bracketed dot, the v-for-u and ph-for-f spellings) and the other-alphabet chat that must pass;
  `town-chat.test.ts` (a huge "character" counting its parts, a forced re-read at most every 250 ms, a Remove's timer,
  the reviewer's review-then-clear refused); `town-chat-net.test.ts` (the app counting and cutting as the server does).
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
  - "without the test switches there is no text field: players see the log only" → "a guest's field is there, greyed,
    saying how to chat (nothing hidden); without the test switches no hooks either". Its check `.tc-form` count 0 →
    the field visible, disabled, its placeholder "Sign in to chat with other players."; the hooks' check is the same.
  - "the edge chips keep off the chat box…" and "the keyboard opening…": they open the town signed in (the keyboard test
    needs a field that types). Same checks.
- `packages/app/test/town-chat-net.test.ts` (mine, after the review): the slices it feeds may carry a room; its first
  tests' checks are the same.
- `packages/server/test/town-chat.test.ts` (mine, after the review): "a moderator takes one line out…": `townSince(snap, 2)`
  → equals `{ room, n: 2, lines: [], gone: [2] }` (the slice now names its room).
- `e2e/helpers.ts`: `asServerAdmin`'s database write moved into `withEmail`, shared with the new `asSignedIn`. Same
  behavior.
- After the re-review:
  - `e2e/town-chat.spec.ts`, the UI's text field test: `toHaveAttribute("maxlength", "80")` → removed (the field has no
    `maxlength` now; its own check that typing stops at 80 is unchanged). My server-decides test: the same check →
    filling 90 letters leaves 80, and 85 emoji leave 80.
  - `text-filter.test.ts`, "in chat, refuses a word mixing…": "sh漢t happens" and "gg" + a hiragana letter refused →
    "sh" + Cyrillic ж + "t", "g" + ф + "od game" and "hi" + ξ refused, and kana or CJK beside Latin passing (the
    re-review's R1: other scripts beside Latin are fine).
  - `town-chat.test.ts`, the reviewer's test: one "clear" refused → the sequence clear refused, review, clear refused,
    a person's clear, the reviewer's clear, a new report, review, clear refused.
- After the third review (the 7-digit rule):
  - `text-filter.test.ts`, "lets ordinary chat through": "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6" → "1. e4 e5 2. Nf3", "I'm 1800 vs
    your 2000" → "I'm 1800, you?", "meet at 12:30 or 13:45" → "meet at 12:30" (the long ones now have 7 digits or more).
  - `text-filter.test.ts`, "lets rating talk, years, scores and times through" (expected null for "rated 1200-1400",
    "1500 1600 1700", "2000/2100", "800-1200 is a good range", "1,500 vs 1,600", "the 2025-2026 season", "I'm 1800 vs
    your 2000", "meet at 12:30 or 13:45", "10/28/2026") → "lets a short message's numbers through" ("I'm 1500", "1200 or
    so", "I'm 1800, you?", "meet at 12:30", "won 3-0 then 1-0", and the rest unchanged). "rated 1200-1400" is now
    expected refused.
  - `text-filter.test.ts`, "refuses phone numbers in fours… (R2)" → "refuses any message with seven digits or more…":
    the same forms, plus the third review's ("5 5 5 1 2 3 4 5 6 7", "12 34 56 78", "555 12 34", "2812 3456"…) and,
    expected refused now, "rated 1200-1400", "10 20 30 40 moves", "2026-10-28", "Nf7# 1-0 2-0 3-0".
  - `text-filter.test.ts`, "lets ordinary numbers through… (R2)" (expected null for "10 20 30 40 moves", "games 12 13 14
    15", "3+2 5+0 10+0", "won 3-0, 2-1, 1-0, 2-2", "2026-10-28", "28.10.2026", "10/28/2026", "rated 1200-1400", "1500 1600
    1700", "2000/2100", "800-1200", "1,500 vs 1,600", "the 2025-2026 season") → "lets a message with six digits or fewer
    through" ("I'm 1500", "1200 or so", "gg 1-0", "3+2", "Nf7#", "Qxf7# gg", "e4 e5", "game 3 of 5", "12:30", "1. e4 e5
    2. Nf3").
  - `town-chat.test.ts`, "…rating talk goes": "rated 1200-1400" ok → "I'm 1500, rated 1-0 there" ok.
