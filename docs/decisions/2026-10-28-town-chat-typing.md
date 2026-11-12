# Typed chat in the town square (Oct 28, 2026)

How it works now: [chat.md](../areas/chat.md), "The town square's typed chat"; the log's look: [town-square.md](../areas/town-square.md). Details: git history of this file.

> **Changed later the same day:** the room holds each line **5 minutes**, not 60 seconds (`TOWN_CHAT.lineMs`). See [v4](2026-10-28-town-chat-v2.md#v4).

**Eric:** "I don't see why in this kind of town mode we can't just open up people to type in it."

**Decided:** only signed-in players type and see players' messages (accounts 13 and older). At most 80 characters, one message every 15 seconds. Slurs and swear words are refused, not masked. Links, emails and phone numbers are refused. Tapping a player's line opens Profile, Mute or Report. A kill switch, `PAUSE_TOWN_CHAT`, shows "Chat is paused."

**Reason:** the age rule rests on accounts, and the chat is family-friendly, so an unlisted word just isn't allowed. Lines live in server memory only.
