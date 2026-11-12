# Town chat: "entered the town" lines, a faint "Tap here to type" hint, a taller box on a computer (Nov 12)
You are the social delegate for HunChess (repo ericmueller21k-gif/chessroyale; read .claude/agents/social.md). Effort: high (the town
chat's app side plus one server-made line kind). Read CLAUDE.md, .claude/LESSONS.md, docs/rules/eric.md (the town chat's rule, "Typing
works wherever the chat box shows", and its guard), docs/areas/chat.md and town-square.md, docs/decisions/2026-10-28-town-chat-v2.md.
Code: packages/app/src/town/TownChat.tsx, chat-net.ts, packages/server/src/town-chat.ts, town-chat-api.ts, town-here.ts.

Eric, Nov 12, with two computer screenshots of the town chat box (branch claude/director-notes, notes/mockups/2026-11-12-eric-town-chat-12.png
and -13.png; in the second, his cursor sits at the box's bottom left, under "[9:38] Stripes: …"):
"it's not persistent enough... we have to wait for someone to say something. So I think we should have some server messages. So like when
you join... it should say... has entered the town. And then that way... you can clearly see that there is a message box up here to type in...
In very faint, like gray, let's put a message that says like tap the box to type or something... only a few words... it will disappear when
the text box disappears as well... I think we've had that before, but now... we need that added back. And the text should be in line with
where the timer is. Like where the first bracket is... evenly aligned... And also I actually want to bump the desktop to about 4 or 5 more
lines. Make it about 1.5 times the current height."

**This changes Eric's own guarded rule** (docs/rules/eric.md, Oct 28: the typing line "an input with no placeholder… there is no 'Say
something…' anywhere"). Eric asked for it in the words above: that is his OK. Update that rule's text in docs/rules/eric.md to the new
behavior (quote him, date Nov 12) and its guard test (`e2e/town-chat.spec.ts`, "typing works wherever the box shows…": the "no 'Say
something…'" part becomes "the faint hint shows on the foot line while the box shows and you aren't typing, and is gone while you type and
when the box is gone"); keep every other part of that guard. List the change old -> new in the PR body, marked as Eric's rule change.

## Build
1. **The hint:** on the box's foot line (the reserved typing strip), when the box shows and you aren't typing: "Tap here to type" (phone) /
   "Click here to type" (computer), a few words, thin and faint gray, left-aligned with the messages' timestamps (the "[" of "[9:38]").
   It goes when you start typing (the input takes its place), comes back when you're done, and goes with the box (New messages mode's fade,
   Off). Nothing moves or resizes. Readable in light and dark, never mistaken for a message.
2. **"has entered the town" lines:** when a player enters the town (their town instance), everyone there sees a system line in the chat:
   "[time] Ann has entered the town." in a quieter system style (not a player's line: no name menu, not reportable, not mutable).
   Made by the server (it already knows who's here: town-here). Don't flood a busy town: one line per player per visit, none for a quick
   reconnect (say within 2 minutes), and collapse a burst ("Ann, Bo and 3 others entered the town.") if several arrive within a few
   seconds; say what you chose. Guests and players with chat off still see them; under-13 guests see them as everyone does (no typed
   words of anyone's). They follow the chat's history rules (a newcomer sees recent lines as today).
3. **A computer's box about 1.5x taller** (4 or 5 more lines), same place, same width; the phone unchanged unless it has the room (say).

## Tests (targeted lane: town chat, plus the server line kind)
Unit (app and server) for the join lines (once per visit, reconnect skipped, burst collapsed) and the hint's states. e2e: update the guard
as above; one focused check in e2e/town-chat.spec.ts: a second player entering shows "X has entered the town." to the first; the hint
shows, aligned with the timestamp's "[" (within 2 px), and hides while typing; the computer box ~1.5x its old height. Typecheck; run
town-chat.spec.ts both projects locally under the e2e lock (if Playwright looks for chromium_headless_shell-1194, run:
`mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`).
Stills (one set at the end) on branch stills/town-chat-hints (never images under docs/): computer first (Eric's view: the taller box with an
"entered the town" line and the hint), then phone 428 x 746. Aim for about an hour and a half; usage is low this week: keep it lean.

Branch claude/town-chat-hints from origin/main; push at each real step. A ~5-line decision note docs/decisions/2026-11-12-town-chat-hints.md;
update docs/areas/chat.md / town-square.md. When done: push .pr-body.md (what changed, player-visible, Eric's rule change, changed checks
old -> new, tests run), then .done last. Don't open a PR or wait on CI. American English. Never include model names in commits.
