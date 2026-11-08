# Typed chat wherever quick chat is used (Nov 7, 2026)

Brief (Eric's approved mockup, notes/briefs/brief-chat-column.md): "Free typing … wherever quick chat is used today on computer and phone"; "Typed chat, opt-in notice, emoji and limits apply on phones too".
- Match and lobby chat (Crowd's queue, private lobbies, the match, raids; Ranked 1 v 1; Solo's, local to you): a player who may type (signed in, chat on, not a device answered "too young") gets the field and our pixel emoji in the quick lines' place (a phone's chat tab: T opens it over the feed's foot, as the phrases did). Anyone else keeps the chips.
- The server (typed-chat.ts, shared with the global chat): the account's `chat_on` read as they join (and when they turn it on), the age gate's cookie, the filter, 80 characters, one typed message every 5 s. Typed lines go only to players who turned chat on and aren't on a young device.
- The server-wide 5-a-second cap stays the global chat's (the brief puts it there); a match's chat is one room.
- The chat's options (⋯) get "Typed chat", with the same one-time notice.
- The town square keeps its own rules (Eric's: its modes, 15 s, its typing line with no buttons); its lines now draw the `:name:` emoji.
