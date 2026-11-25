# Phone top bar in colour, and your profile as a face (Nov 9, 2026)

Eric (Nov 9): the five top-bar buttons "should all have some color", the icons a bit bigger, the containers the same size.
What changed: the quests, shop and Friends icons are about 30% bigger (29 px in the same 44 px squares), the clipboard
and bag are gold, Friends is blue (`--fd-blue`, with a dark-mode value), Settings stays a plain outline. Your profile is
the shop's square with no gold ring, showing only your pawn's face: still (no ride, no animation), cropped with
`clip-path` (not `overflow: hidden`, which the quests guard reads as clipped content). A computer's top right pawn keeps its ring.
Call made: the crop is CSS on the phone bar only (`face` prop on the shared pawn button), so the computer is unchanged.
