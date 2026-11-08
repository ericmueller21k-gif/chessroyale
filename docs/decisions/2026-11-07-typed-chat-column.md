# Typed global chat and the computer's right column (Nov 7, 2026)

Eric, on mockup v5: "that's exactly what I'm wanting. That's perfect." (notes/briefs/brief-chat-column.md). The right column is the mockup's on every framed page (slot 62 px; FRIENDS ›; the live line; GLOBAL CHAT with its gear; the lines; the band), the town's tools in the slot under TOWN, the town's bar gone on a computer.
- Typed global chat: `CHAT_TYPED` is the one switch back to the quick chips. The town square's tidy and filter on every message; 80 characters; one per player every 5 s; server-wide 5 a second, a line waits up to 10 s, past that "Chat is busy, try again." (a busy refusal doesn't start the wait). Tests use their own chat (`?chatroom=`, test switches: 1 a second, a 2 s line).
- Who: signed-in accounts type (guests read, refused even where sign-in isn't set up, as the town's); a device that answered "too young" keeps the quick chips and is never sent typed lines.
- Opt-in: `users.chat_on` (NULL off), a guest's on the device; the server refuses a post with chat off. The notice shows once per device.
- 1 v 1 hid global chat because the column drew it only on home and the town (`chat={page === "home" || page === "town"}`, since Oct 9); a queue, 1 v 1's search among them, is the "queue" page. Now every page with the column has it. No match chat shows in the column: matches are on the game frame, which has no right column, so there's no Match tab to add.
- Removed per the brief: the top-right pawn (Profile is the side menu's), Playing now, the friends list in the column. Kept for screen readers: the town's title (visually hidden).
- Not done here: typed text in match and lobby chat (phone and computer); they keep the quick chips.
