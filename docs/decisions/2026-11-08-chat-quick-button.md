# Quick chat button in typed chat; phone match sizes (Nov 8)

Eric (from his review of the stills): a quick chat button next to the emoji button in every chat, opening the player's
10 quick lines; smaller power-up circles (21 px) and arrows (32 px tall, 40 px tap area) on phones only.

Call: the gap from the power-up row to the chat (43 px at 390x844, 390x664 and 360x740; main has the same) is NOT
fixed. Its fix shrinks the crowd's middle box, which Eric set to the vote box's height, and crowd.spec.ts ("I should never
see the scoreboard container shifting") guards that. Waiting for Eric's OK; the check is `test.fixme` in lobby-chat.spec.ts.

Later the same day (Eric): item 1 (the phone layout) is cancelled, the chat's position and the power-up row stay as on main.
Chat packs go away: `CHAT_PACKS_SHOP = false` (settings.ts) hides the Chat packs tab and sale; the picker shows only free
lines (our call: owned packs are sendable but not offered for picking); owned packs and purchases stay on the server.
Changed checks: `chat.test.ts` (packs) expectations now follow CHAT_PACKS_SHOP; `chat.spec.ts` buy-the-Winter-pack steps
became free-line steps ("Hi all!"); `shop.spec.ts` Winter check → no tab; the Shop case of the tab-width check is paused.
