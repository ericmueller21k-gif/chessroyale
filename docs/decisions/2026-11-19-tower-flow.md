# The Battle Tower: the clerk, the elevator and the floor room are the tower (Nov 19, PR 11b)

**Eric, Nov 19:** "you walk into the battle tower, you talk to the clerk, you start a match. After the round ends, it's like a victory or
defeat screen, like it normally is. And then it takes you back. And then you stand there and wait in the room. And then the next, you go up
whatever the elevator, you go to the next floor and then you continue on." He never asked for PR 10's menu-style `/tower` screen: out of
the flow. **Kept in the repo, unused, at Eric's word** (Nov 19: "keep whatever you already did for that screen for now ... maybe we can
find some use for it later"): `screens/Tower.tsx` and its CSS stay; nothing opens it and no route renders it. `/tower` is now only a floor
match's address, so a reload rejoins it; with nothing to rejoin it opens the town.

Calls made:
- **The clerk's card:** Start, or "Continue: floor N"; "Start over" always under it (greyed with no run, so the card never changes size).
- **The floor room's doors:** the art's way in (bottom) is the way down to the lobby, a door between rooms; the elevator (top) is the way up,
  open only after a win ("Up to floor N+1"; greyed with why otherwise). You always come in at the bottom, the bosses out of the top.
- **The floor starts on the server as the board comes up** (not at the elevator): leaving during the walk-in costs nothing. A question
  (bosses resting, under way elsewhere) or no answer takes you down to the lobby and asks there. A free leave mid-match: back to the lobby.
- **Bests** on the lobby's board as "SOLO / FLOOR n"; the elevator's open doors drawn by the game (`elevator-open`, from the art's own pixels).
- **Audit 2's findings 3 and 5** (the app's floor start, fixed here): the app sends a random id kept on the device (`brc.tower.device`)
  with each start; the server keeps it in `fight` and answers it back, so an `under` answer carrying this device's id with nothing kept is
  its own floor, from its start (a lost answer no longer ends the run). A 409 carrying `fight` on a result (a win too soon, the floor still
  under way) keeps the result on the device to send again, instead of forgetting it.
