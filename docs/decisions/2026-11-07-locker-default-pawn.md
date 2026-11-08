# The locker: one pawn in your default color (Nov 7, 2026)

Eric: the locker's preview shows two pawns, white and black; make the box twice as tall, show one pawn in the player's default color,
and let a player pick W or B in its corner (a thin square, "default" under it). The default is saved per account (signed in) and on
the device (a guest), and it travels with you: the town (other players see it too), home, the profiles and the queue's own card.
Calls: the column is `users.pawn_color` (NULL: white), beside the other per-account settings (`allow_invites`, `hide_online`); a guest
keeps it on the device (`brc.pawnColor`), since a guest never shows in another player's town. The God King tab goes (Eric's note;
its items stay under All). Inside a match the side decides the color, so nothing there changes.
