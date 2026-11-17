# A tap on an arrow key walks one square (Nov 17, 2026)

Eric: "feel like we should also make when you tap on keys u only move 1 square in the town, not 2".
What changed: the walker still asks the keys for the next square as a step begins (a held walk runs on with no stop, and a wall
ahead still eases the step into a stop), but drops it if the key is let go before the step ends; the step then eases out from
where it is, at the speed it has (`ease(…, from)`: same place and speed, same end speed as a whole last step). Town, rooms, WASD
and the on-screen arrows alike (`keyWalk` is shared). Call: release mid-step rather than a fixed decision point, since a step is
90 ms, shorter than most taps' press. A press and release inside one frame still walks none, as before (not in scope).
