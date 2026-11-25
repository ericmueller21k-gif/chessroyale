# The Boss Crate card: the price line, Boingo's crate, and "You got it" (Nov 12, 2026)

Eric, Nov 12 (Boingo's card): the price line "is not only the wrong shape, it's the wrong color... white text"; the crate is "like yellow at the bottom" on its right side; "I just bought his box, and it just deducted my tokens... but nothing popped up... There should be another pop-up that says that you bought it, and then give you an option to open it now."

- **Price line:** it shared `.shop-price` with the Shop screen's cream price button, which won. Now `.shop-room-price` (plain words, the card's white); the Shop screen's untouched.
- **Crate:** Boingo's last gold stripe ran to x 29, a pixel past the box (x 3 to 28): now 2 wide, inside. The other 13 crates checked: none overflow. No redesign (Eric's revisions are coming).
- **Why "nothing":** the answer row worked (a fresh run shows it) but was the 11 px gray "Coming soon" style, under the buttons: easy to miss. Now 13 px white, plus the pop-up: "You got Boingo's Boss Crate!", its picture, **Open now** (the Crates tab's own `CrateOpening`, the same route and odds, over the room: as the claw machine's Open now) and **Later**. Escape is Later. A failed buy: no pop-up.
- Call: the pop-up's class is `shop-bought` (the Shop screen already uses `.shop-got`, a left-aligned grid, which leaked into a first try).
