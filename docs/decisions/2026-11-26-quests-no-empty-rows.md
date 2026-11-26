# The end screen's quests keep no empty rows (Nov 26, 2026)

Eric (Nov 26, his named exception to "nothing shifts"): "we don't need any gaps … if there's 3 quests that you checked off, then there's 3
quests, and then it starts after that". Every end screen (boss, 1 v 1, 50 v 50, Squads; phone and computer): exactly as many rows as the
game moved (up to `END_SCREEN.questRows`), none: the one line "QUESTS  No quests this game." (`EndRewards`, `QuestRows`: the reserve is gone).
Call made: the sequence waits for the quests' answer (at most `questWaitMs`) before it counts, so the one move (the buttons, a centered stack)
happens while "Counting your XP…" shows, never while a bar fills. The boss result's zoom keeps its 870 basis: two moved quests are as tall as before.
