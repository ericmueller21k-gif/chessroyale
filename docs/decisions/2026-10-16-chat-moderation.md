# Chat moderation for launch (Oct 16, 2026)

The director asked for chat moderation before launch, "simple and solid" (Eric: "no slop"). How it works now:
[`docs/areas/chat.md`](../areas/chat.md), "Moderation".

**What there was.** Chat is preset lines and emoji everywhere: quick chat in Crowd matches and raids, the lobby before
them, and the home page's global chat. Squads has no chat. The server already limits sending per account:
- a lobby: one line every 3 s, 5 in 30 s, no repeats;
- the global chat: one every 30 s.

Mute existed per match (by seat, kept per lobby code) and in the global chat (by account). There was no chat report,
no review of chat, no chat ban, and no filter on anything players type.

## The calls

- **Nothing new to type.** Chat stays preset lines, so the filter has nothing to read in chat. The free text others see
  is display names: a profile's, and the name a device sends when it takes a lobby or Squads seat. So the server
  filter checks names. Abuse in a preset chat is spam, taunts, a name or an icon; reports and decisions are about those.
- **Mute is by account, on the device, for every chat.**
  - One list (`localStorage` `brc.muted`; the global chat's old list is folded in once). A player muted in one match
    stays muted in the next one and in the global chat until unmuted.
  - Bots and seats without an account keep the old per-match mute.
  - Nothing about mutes goes to the server beyond a match's own `chatPrefs`. The brief said "on your device", and this
    way nothing is stored about who muted whom.
  - Friends' block shares the seat-to-account lookup (`uidOf`) and hides lines as a mute does (`MatchChat.hidden`).
    A block isn't a mute: it doesn't show as "Muted", and unmuting doesn't undo it.
- **Report a line, not a free-form complaint.**
  - One tap from the line's menu, with no reason picker. With preset lines, the stored lines around the reported one
    show what happened, and fewer taps means more reports of real problems.
  - The server takes the line from its own copy (a lobby's log, the global chat's last 50), never from the device, so
    nobody can report words that weren't said.
  - Only a line the reporter could see (not the other team's plan), never a bot's or their own.
  - The lines around it are stored with the report because the server doesn't keep them: a lobby is deleted 15 minutes
    after its results, and the global chat keeps 50 lines.
  - Someone who says something and then leaves the lobby can still be reported: the lobby keeps whose account said
    each seat's lines (`chat.by`), since leaving drops the seat's account.
- **Who can report, and how often.**
  - Accounts that may chat: signed in, wherever sign-in is set up. Guests cost nothing to make, so letting them report
    would let one person pause anyone with a few guests. Guests, and under-13 devices (guests only, since the age
    gate), can still mute.
  - One report per reporter, player and place a day. Reporting again says so, and nothing new is stored.
  - 20 a day per reporter (`CHAT_MOD.reportsPerDay`, as fair play's reports).
- **The automatic pause.** Reports from 3 different players, each still open, within 7 days, pause the chat until a
  moderator looks, for 72 hours at most (`CHAT_MOD.autoMute*`). That's "until reviewed", but temporary, so a slow
  review never silences anyone for good. A dismissal ends it and starts the count again; a ban replaces it.
- **Its own review page, `/admin/chat`, not a section of fair play's.**
  - A chat ban isn't a fair-play ban: a fair-play ban holds results and blocks online play, so fair play's case can't
    hold a chat ban.
  - Its table of decisions (`chat_mod_log`) is both the log and how a pause is in force.
  - It reuses what fits: `isAdmin` (`ADMIN_EMAILS`), the admin page shell (`adminPage` in `admin.ts`, as `/admin/ops`
    does), the origin check on posts, "admin:<email>" in the log, and a written reason for every decision except a
    dismissal.
- **No test switch opens it.** The e2e makes its moderator's account an admin in the local database, as ops' e2e does
  (`asServerAdmin` in `e2e/helpers.ts`, now shared; the local `ADMIN_EMAILS` gains a chat moderator's address per
  project). There's no new switch to gate.
- **The decisions.**
  - Dismiss, warn, chat ban for 1, 7 or 30 days or with no end, lift, and reset the name and icon. Names and icons are
    the only free-form things others see, so a moderator needs a way to clear them.
  - A chat ban only stops sending: the player still reads chat and plays.
  - A decision reaches the lobbies the player was reported in within the day at once (a call to each lobby).
  - Any other lobby reads a chatting player's standing when they join, and again at most every 30 s as they chat
    (`CHAT_MOD.recheckMs`): at most one database read per chatting player per 30 s.
- **The player is told, never over a match.**
  - The chat panels show why instead of their buttons.
  - A warning or a chat ban shows once on the home screen, with the moderator's note.
  - There's no appeal form for chat bans (fair play's appeal is for play bans). A moderator who hears from them can lift
    one.
- **The filter is a small list of our own:** slurs and hate terms only, ROT13-encoded in `server/src/text-filter.ts`
  so the words don't show up in searches, diffs or screenshots of the code.
  - The well-known open lists (LDNOOBW, CC-BY-4.0, for one) are mostly swearing and sexual words. They'd refuse many
    ordinary names and need a credit, and Eric's brief was slurs and hate. Nothing third-party is used, so
    `LICENSES.md` is unchanged.
  - Matching sees through case, accents, look-alike letters, invisible characters, leetspeak and spacing.
  - Short words count only as whole words, and the few ordinary words that contain a long one are let through, so
    ordinary names (Niger, Raccoon, Japan) pass.
- **Where the filter applies.**
  - A profile can't save such a name, and it says so.
  - A guest asking for one on its first visit gets "Player". New accounts are "Player" anyway since #240.
  - A lobby or Squads seat asked for with one is "Player N".
  - The global chat shows an old one as "Player".
- **Account data (#240), and a guest's merge (#246).**
  - **Download my data:** the lines the player reported (not the lines around them, which are other players'), and the
    decisions about their chat as they saw them (what, when, until, the note). The reports about them and the
    moderators' reasons and names are left out, as fair play's are: a person answers a request.
  - **Delete account:** their reports, the reports about them and every decision go. Nothing is kept for moderation:
    unlike fair play's ban, a chat ban is the account's alone and never follows an email to a new account, so keeping
    it would protect nothing.
  - Their name and lines can stay inside the lines kept around someone else's report (no account id), until that
    report goes: at most 30 days after a moderator has looked at it. The privacy draft says so.
  - **A guest signing in:** its reports (made and about it) and its decisions move to the account in the sign-in's one
    batch (`chatModMoves`), as fair play's file does. A chat ban keeps its action, so it can't be shed by signing in.
    A "merged" line says where the decisions came from, and a report between the guest and the account goes.
- **Keeping.** A report until it's resolved, then 30 days. A decision 180 days after it ended; a chat ban with no end
  stays while it's in force. Pruned by the Worker's 15-minute schedule, and as reports and reviews come in. The privacy
  draft (`screens/Legal.tsx`) says the same.
- **No kill switch of its own.** Moderators pause one player's chat, and any player can turn chat off on their device.
  A `PAUSE_CHAT` on #238's mechanism would take about 30 lines if Eric wants one: the global chat's post, the lobby's
  chat message, and the panels.
- **Not done:** no AI moderation, nothing paid, no free text. Fair play's profile report ("Offensive name or icon")
  stays as it was; it and chat reports are separate queues for now.

## Testing

Full lane (stored data, a protocol change, security):
- typecheck;
- the whole unit suite:
  - new `chat-mod.test.ts` and `text-filter.test.ts`;
  - more in `lobby-chat.test.ts`, `account-data.test.ts` (columns, download, deletion, a guest's merge), and the app's
    `chat.test.ts` and `global-chat.test.ts`;
- the whole `npm run e2e`:
  - new `chat-mod.spec.ts`;
  - `chat.spec.ts` and `global-chat.spec.ts` updated for the new labels and the report step;
  - `problems.spec.ts` now uses the shared `asServerAdmin`.
