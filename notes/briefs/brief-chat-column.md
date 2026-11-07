# Typed chat + the computer's right column (Eric, Nov 7; mockup v5 APPROVED: "that's exactly what I'm wanting. That's perfect.")

Mockup: notes/briefs/assets/chat-column-town.png, chat-column-home.png, chat-column-mock.html (the CSS is the spec's look).

## Right column (computer, every screen)
- No white containers anywhere in the column (flat, like the left menu). Thin lines (#d3cec3-ish, 1 px) running almost the column's
  full width: above FRIENDS, above and below the GLOBAL CHAT title, above and below the message band.
- Top slot, fixed height on EVERY screen (so nothing below ever moves): in the town (and rooms) "TOWN" centered with the map, town
  chat and settings icons centered under it; elsewhere empty. The town page's "‹ Town…" header row and its icons go away on computer.
- Remove: the top-right avatar icon, "Playing now", "All friends ›", "Tap a player's name…", the quick-chat chips and their tabs, the
  "One message every 30 s" line.
- "FRIENDS ›" centered, gold, underlined, clickable (opens friends). Under it one centered line: "N online · M matches · Q in queue".
- "GLOBAL CHAT" centered (gray), a bigger gear at its far right (chat on/off and chat settings).
- The message list starts right under the GLOBAL CHAT lines and fills down to the message band; names start near the left edge.
- Message band: "Send a message" field + an emoji button at its right, compact (sized to the text), between two lines, with some
  space under it before the column's bottom.
- The column is identical in place and size across home, every mode (50v50, 1v1, Squads), the town and rooms; nothing shifts when
  switching. The 1v1 view currently hides global chat: find why; global chat stays. If a match chat exists there, make it a second
  tab in the same box (Global | Match), same size and place.

## Typed chat
- Free typing in global chat (and wherever quick chat is used today on computer and phone), using the existing filter, report
  (tap a name) and age gate. Players who haven't passed the age gate keep today's quick chips; guests read only.
- Chat is OFF by default. Turning it on (the gear, or a "Turn on chat" in the empty list) shows once: "Turn on chat? Chat is typed by
  players. We filter hate speech and slurs, and you can report anyone by tapping their name. You may still see things you don't like:
  chat at your own risk. You can turn chat off any time in Settings." [Not now] [Turn on chat]. Stored per account.
- The quick-chat system stays in the code behind one switch (settings.ts) so it can be flipped back.
- Custom emoji, Twitch-style: a starter set of ~8 original pixel-art chess emoji (picker from the emoji button; `:name:` codes).
- Limits (settings.ts): one message per player every 5 s; global chat server-wide cap 5 messages/s with a queue (a message may show up
  to ~10 s late); past that the sender sees "Chat is busy, try again". Server-enforced.

## Phone
- Typed chat, opt-in notice, emoji and limits apply on phones too; the phone layout otherwise unchanged in this job.
