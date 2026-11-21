# Shopkeepers talk only from in front of their counter (Nov 21, 2026)

Eric, Nov 21, after PR #868 limited the Battle Tower clerk's card to the squares in front of his counter: "I do want it to be the same for the other clerks. Like, you have to actually be near them."

What changed: every Shopkeeper without its own `talkAt` (shops.ts) now talks only from the floor squares right in front of the counter, under the keeper's columns (`room.ts frontOf`: past the counter when it is in that column, else the first floor square south of the keeper). The 3-square talking range (`SHOP_FEEL.talkRange`) is gone. A tap on the keeper or the counter still walks you to the nearest of those squares and opens the card.

Call made: one generic rule from each room's keeper and counter squares, no per-shop lists; it fits every shop's art (Hollow's dog has floor between him and his counter, so the rule looks past the counter, not just the first free square). A unit test checks every shop's squares are walkable and reachable from the door.
