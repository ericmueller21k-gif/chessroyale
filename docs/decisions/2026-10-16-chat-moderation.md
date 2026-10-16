# Chat moderation for launch (Oct 16, 2026)

The director asked for chat moderation before launch, "simple and solid" (Eric: "no slop"). How it works now:
[`docs/areas/chat.md`](../areas/chat.md), "Moderation".

**What there was.** Chat is preset lines and emoji everywhere: quick chat in Crowd matches and raids, the lobby before
them, and the home page's global chat. Squads has no chat. The server already limits sending per account:
- a lobby: one line every 3 s, 5 in 30 s, no repeats;
- the global chat: one every 30 s.

Mute existed per match (by seat, kept per lobby code) and in the global chat (by account). Players could already
report a player from their profile (fair play's report, with "Offensive name or icon" as a reason), and every report
opens a watch case on fair play's review page. There was no chat ban, and no filter on anything players type.

## The director's decision: the simplest version that still protects players

The first version (PR #252 as opened) also had a Report button on every chat line, a `chat_reports` table keeping the
lines around each report, an automatic pause after reports from 3 players, and its own review page, `/admin/chat`.
An independent review found two blockers in it and judged it over-built for preset-only chat. The director cut it
down, following Eric's rule: **"easier code and less lag over all else, fewer bug risks."** The reasoning:

- **The preset lines are all friendly.** Nobody can say anything offensive with them.
- **Spam is already rate-limited** on the server, and mute handles spam and sarcastic emoji.
- **The only content that can really offend is a player's name and drawn icon.** The name filter, fair play's
  existing "Offensive name or icon" profile report and a moderator's reset already cover them.

So:
- **Removed: the automatic pause.** One person with three Gmail "+tag" accounts could pause anyone, and it renewed
  forever.
- **Removed: report-a-line.** The Report button in the chat menus, `POST /api/chat/report`, the `chat_reports` table
  and the lines stored around each report, the lobby's record of who said each seat's lines, and the privacy exception
  for a deleted player's name inside someone else's report. Reporting a player lives on their profile, as before. The
  chat menu is Profile / Mute.
- **Removed: pruning in three places.** Old decisions go on the Worker's 15-minute schedule only.
- **Removed: the direct call to lobbies** when a moderator decides. A lobby reads a chatting player's ban as they join
  and again at most every 30 s as they chat; up to 30 s of delay is fine.

## What's kept, and the calls made

- **Nothing new to type.** Chat stays preset lines, so the filter has nothing to read in chat. The free text others see
  is display names: a profile's, and the name a device sends when it takes a lobby or Squads seat.
- **Mute is by account, on the device, for every chat.**
  - One list (`localStorage` `brc.muted`; the global chat's old list is folded in once). A player muted in one match
    stays muted in the next one and in the global chat until unmuted. Unmuting in a match brings their recent lines
    back.
  - Bots and seats without an account keep the old per-match mute ("Mute for this match").
  - Nothing about mutes goes to the server beyond a match's own `chatPrefs`. The brief said "on your device", and this
    way nothing is stored about who muted whom.
  - Friends' block shares the seat-to-account lookup (`uidOf`) and hides lines as a mute does (`MatchChat.hidden`).
    A block isn't a mute: it doesn't show as "Muted", and unmuting doesn't undo it.
- **Moderators act from fair play's review page, not a page of their own.** The director left this choice to me;
  this is less code. A player's page on `/admin/fairplay` gains a "Chat" section: warn, chat ban for 1, 7 or 30 days
  or with no end, lift the ban, and reset the name and icon.
  - A moderator reaches it from fair play's existing reports: a profile report opens a watch case, listed in the
    page's open cases with its reason.
  - Or directly: a box on the page takes a player's id or their profile's link and opens their page. No new list.
  - The section links to the player's profile in the game, which shows the name and drawn icon to judge.
  - It reuses what's there: `isAdmin` (`ADMIN_EMAILS`), the page and its origin check on posts, "admin:<email>" in
    the log, and a written reason for every decision. The reviewer's token reaches only fair play's API, never these.
  - Fair play's own red "Ban" button sat just above the red chat bans, so it now says "Ban from online play".
  - A reset or a chat ban doesn't close the watch case the report opened: a line in the section says to click Clear
    for that. One click more, and fair play's decisions stay fair play's.
  - A chat ban isn't a fair-play ban (that holds results and blocks online play), so it has its own table,
    `chat_mod_log`: both the log and how a ban is in force. The decisions list labels the "merged" rows a guest's
    sign-in adds.
- **What a decision does.**
  - A chat ban only stops sending: the player still reads chat and plays.
  - A reset makes the name "Player" and the icon a pawn. Their lines also leave the global chat, so the old name
    doesn't stay on the home page until 50 newer lines push it out. Only their lines (the live hub's `dropChatLines`):
    they stay online, in their match, with their friends' news and their wait to post again.
  - Lobby and Squads seats take the name from the account as a player joins (the device's name only without one), so a
    reset holds in the next lobby or party.
- **The player is told, never over a match.**
  - The chat panels show why instead of their buttons. Showing one reads the profile again (at most every 30 s), so a
    lifted ban goes without a reload. Known, rare and left as is: a ban lifted while its panel is already on screen
    shows there until the panel is shown again or the page reloads.
  - A warning or a chat ban shows once on the home screen, with the moderator's note. "Got it" clears it on the
    server and in the app, so it doesn't come back on the next screen.
  - There's no appeal form for chat bans (fair play's appeal is for play bans). A moderator who hears from them can
    lift one.
- **No test switch opens it.** The e2e makes its moderator's account an admin in the local database, as ops' e2e does
  (`asServerAdmin` in `e2e/helpers.ts`, now shared; the local `ADMIN_EMAILS` gains a chat moderator's address per
  project).
- **The name filter is a small list of our own:** slurs and hate terms only, ROT13-encoded in
  `server/src/text-filter.ts` so the words don't show up in searches, diffs or screenshots of the code.
  - The well-known open lists (LDNOOBW, CC-BY-4.0, for one) are mostly swearing and sexual words. They'd refuse many
    ordinary names and need a credit, and Eric's brief was slurs and hate. Nothing third-party is used, so
    `LICENSES.md` is unchanged.
  - **How it reads a name.** Word by word. Case, accents, look-alike letters, invisible characters and leetspeak fold
    away, and symbols inside a word go. A run of two or more short words (two letters or fewer each) joins into one,
    so letters spaced out, or spaced in pairs, are read as the word. Digits at a word's end are read both as letters
    (leetspeak) and as a number left out (a year, a "69"): "Magnus2009" is "magnus", and a slur with "69" after it is
    the slur. Other words never run together, so "Jared Skinner" passes; only the n-word's two entries are also
    looked for across the words, starting where a word starts (the director, after the final review: a surname that
    ends in its first letters, written before a given name, was read as one, as "König Gábor"; starting at a word
    lets those through and still catches every split).
  - **Long entries** match inside any one word, letters repeated or not, with q for g. **Short entries** match only as
    the exact whole word or its plural, so "faq" stays an ordinary word.
  - **The list** (ROT13, as in the file; `rot13()` turns an entry back):
    - inside any word: avttre, avttn, avtyrg, sntbg, ergneq, genaal, genaavr, furznyr, jrgonpx, ornare, wvtnobb,
      tbyyvjbt, erqfxva, uvgyre;
    - phrases (as one word or as words in a row): juvgr cbjre, juvgr cevqr, fvrt urvy, xh xyhk, cbepu zbaxrl,
      whatyr ohaal, fcrne puhpxre, ent urnq, gbjry urnq, mvccre urnq;
    - whole words only: avt, snt, xvxr, xlxr, anmv, puvax, tbbx, fcvp, fcvpx, cnxv, jbt, wnc, qnexvr, fdhnj, xxx;
    - let through (ordinary words that contain an entry): favttre, ergneqnag;
    - hate codes, in the digits: 1488;
    - off the list on purpose: qlxr and pbba, common English surnames (and their plurals).
  - **The director's call on two words** (after the delta review): "xvxr" and "anmv" (ROT13) are on the list as exact
    whole words. On an English-language game for 13+, their main use as a word on its own is hate. A false positive
    only means picking another display name, while a false negative shows a slur to other players until a moderator
    acts. So the two real names in the tests whose first word is one of them are refused: accepted, and tested as
    blocked by design. "qlxr" and "pbba" stay off: they collide with common English surnames, and a report plus a
    reset handle those.
  - **What it still misses, knowingly:** a long entry split into longer pieces (three letters, a space, three letters),
    since reading words together is what refused real names in the first version (a first name and a surname ran
    into an entry across the space); and a short entry with q for g or a letter repeated (exact on purpose). Reports
    and a reset handle these.
  - It reads at most 64 characters, so a long input can't cost CPU.
- **Where the filter applies.**
  - A profile can't save such a name, and it says so.
  - A guest asking for one on its first visit gets "Player". New accounts are "Player" anyway since #240.
  - A lobby or Squads seat asked for with one is "Player N".
  - The global chat shows an old one as "Player".
- **Account data (#240), and a guest's merge (#246).**
  - **Download my data:** the decisions about their chat as they saw them (what, when, until, the note to them). The
    moderators' reasons and names are left out, as fair play's records are: a person answers a request.
  - **Delete account:** every decision goes. Nothing is kept: unlike fair play's ban, a chat ban is the account's
    alone and never follows an email to a new account, so keeping it would protect nothing.
  - **A guest signing in:** its decisions move to the account in the sign-in's one batch (`chatModMoves`), as fair
    play's file does. A chat ban keeps its action, so it can't be shed by signing in. A "merged" line says where the
    decisions came from.
- **Keeping.** A decision 180 days after it ended (`CHAT_MOD.keepDecisionsDays`); a chat ban with no end stays while
  it's in force. Pruned by the Worker's 15-minute schedule. The privacy draft (`screens/Legal.tsx`) says the same.
- **No kill switch of its own.** Moderators turn off one player's chat, and any player can turn chat off on their
  device. A `PAUSE_CHAT` on #238's mechanism would take about 30 lines if Eric wants one.
- **Not done:** no AI moderation, nothing paid, no free text.

## Testing

Full lane (stored data, a protocol change, security):
- typecheck;
- the whole unit suite:
  - `chat-mod.test.ts`: decisions, the notice, keeping, the global chat's refusal, the profile's name check, and fair
    play's page (the chat section, its actions, finding a player);
  - `text-filter.test.ts`: the catches, q for g, letters in pairs, digits after the word, the word's halves apart, the
    names that must pass (Tran Ny, Jo Jo and Magnus2009 among them), the two blocked by design, and 160,000-letter
    input;
  - `global-chat.test.ts`: a reset takes only the player's lines out of the global chat (still online, still waiting
    to post); `squads-do.test.ts`: a Squads seat takes its account's name;
  - `lobby-chat.test.ts` (a ban in a lobby, unmuting) and `lobby-do-chat.test.ts` (the lobby reading a ban as a
    player joins and every 30 s, a failing read never throwing, a seat taking its account's name);
  - `account-data.test.ts`: columns, download, deletion, a ban surviving a guest's merge;
  - the app's `chat.test.ts` and `global-chat.test.ts`;
- e2e: `chat-mod.spec.ts` (mute, a profile report, a moderator's chat ban, the notice, the name filter),
  `chat.spec.ts` (the new labels), and the `lobby-chat`, `global-chat`, `fairplay` and `squads` specs.
