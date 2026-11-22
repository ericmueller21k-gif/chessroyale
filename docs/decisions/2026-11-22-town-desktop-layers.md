# Chess Town on a computer: the side menu's pages open over the town, and Play is Home (Nov 22, 2026)

**Eric (Nov 22):** "you should be able to just click play with friends, daily quests, shop in crates, and profile without exiting out of
Chesttown ... instead of making it say play, we should just change it to ... home. ... things like boss battle, auto chess, basically any
game mode, you can't."

- **What changed:** #875's inventory layer is now a general `PageLayer` (`components/PageLayer.tsx`; `InventoryLayer` is one use). In a
  computer's town those four open in it over the town's middle column only (App.tsx `townLayer`), each page's own component: the shop,
  your profile, home's quests card (`QuestsLayer`) and home's Play with friends sheet (`FriendsLayer`). The side menu's Play is **Home**.
- **Calls made:** the layer covers the middle column, not the window, so the side menu and the right column (the town's tools, the chat)
  never move or hide. Quests and Play with friends stay cards (as on home), over the town dimmed. Making or joining a lobby from it, and
  your profile's Settings and friends, leave the town, so they ask "Leave Chess Town?" first (Eric's rule). **Settings stays as it was**
  (asks, then leaves): its page links on to the FAQ and Auto chess, which leave anyway. "You'll head back to Play." reads "...to Home."
  (phone too: it's the same home). The walkthrough's PLAY slide no longer lights the side menu's Home.
- **The phone (Eric, Nov 22, via the director):** "I don't think we need the word Chesstown here ... we can put in the inventory icon ...
  they should be the same as the main menu ... we can re-add for inventory, for quests, and we can put all those just up top"; "They can
  definitely fit." The bar is back, map, chat, Quests, Shop & crates, Friends, gear in home's buttons, no title in sight. Calls: the chat
  icon stays the town's (it shows the chat's mode) and the gear stays Town settings, in home's look; Friends opens Play with friends' sheet
  (the director's word; the friends page would rewrite the town's address), labeled "Play with friends"; the layers cover the screen.
