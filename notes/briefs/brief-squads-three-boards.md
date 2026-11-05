# Brief: Squads Relay on 3 boards, and a cleaner match screen (code; Opus high)

Worktree `/home/user/cr-squads3`, branch `claude/squads-three-boards`, from main f5e73337. Set it up with `npm ci`; never symlink
node_modules. Ports 8995, inspector 9495. Include notes/briefs/rules-common.md. Read `docs/areas/squads.md` first: Relay,
replay, the clocks and the screens.

Eric's screenshots are in `notes/briefs/assets/squads-nov5/`:
- `eric-1-bottom-cut.jpg`: the bottom of the screen is cut off under the toggle.
- `eric-2-miniboard.jpg`: a finished mini board.
- `eric-3-jump-toggle.jpg`: the toggle and the text under it.
- `eric-4-relay-screen.png`: the whole Relay screen today.

**Eric checks mockup stills before this goes live**, so the order is: build, stills, the director, Eric, his corrections, the PR.

## 1. Relay on 3 boards (the rules)
Eric: "each team, there's only 3 [boards] going, meaning that there's always at the start one person on each team who's just
spectating, and then they jump to whichever board becomes available first. That's just where they slot in, and that becomes
their static position … the person who's on the first board would just be simply waiting then for them … best 2 out of 3."
- **Squads stay 4 players.** A Relay match is **3 boards**, and each squad has one more player than boards.
- **The rotation.** The squad's players move in one fixed order: a ring of 4 over the squad's moves.
  - At the start, three are seated and the fourth waits.
  - Each squad move goes to the next player in the ring.
  - After you move, you go along to the next board needing your squad's move.
  - The waiting player takes the first board that becomes free, and that sets their place in the ring for the rest of the match.
  - Design it so each player's place is fixed and predictable (Eric: "static"), as `relaySeat` is today.
  - Write it as pure rules in `packages/chess/src/squads/` and put the rule in the decision note.
- **Colours.** As today, side 0 is White on boards 1 and 3 and Black on board 2. Check that every player still alternates colours
  as fairly as the ring allows, and say how.
- **The result.** The match goes to whoever wins 2 of 3 boards. A clinch means more than half the points (2 of 3 when the last
  board can't change it).
- **The tie** (the director's call on Eric's "if it was all draws … black gets an extra point for a draw or whatever"):
  1. A level score goes to the squad with **more drawn boards as Black**, as Armageddon gives a draw to Black.
  2. If that's level too, today's rule: more team bank left.
  3. Then the seeded coin.

  Record it in the decision note as Eric's to change.
- **Keep the rest of Relay working:**
  - the team clocks and their drain (count who's thinking at once);
  - replay's free time (`movesSinceLastPlayed`);
  - Mercenary's coins (re-scale Relay's `roundScale` so a round still pays about the same with 3 boards);
  - bots, scouting a finished board, the mercy rules, blocks, the safety cap;
  - stored matches from before the change: a lobby in play across the deploy finishes on 4 boards (an upgrade path like
    `upgradeMatch`).
- **Regenerate** `reports/squads-sim.md` (and the Mercenary calibration if coins change). Say how the lobby's length moved.
- Pairs and the final are unchanged.

## 2. The top of the match screen
- **The mini boards.** The match's boards stay side by side, centred. Three boards leave more space at the sides, which is fine.
- **A finished board** gets a border in the **winning team's colour** and a **check mark** in that colour, instead of greying
  out. A drawn board gets a neutral border with "½" (the director's call).
- **"Next round"** (the test button) shrinks to a tiny icon squeezed hard left, admins and test lobbies only, as today.
- **The replay button:**
  - Drop the container around it. Only the drawn spinning ring stays, as drawn.
  - The tap cycles through three states:
    - **Off:** the button greyed and no spinning.
    - **Last 2 moves:** the ring spins at a moderate speed with a short motion trail.
    - **All moves since you last played:** spins about **twice today's speed**, with a longer trail.

    Eric: "tapping once does … the last 2 moves. Tapping it again … goes faster … a little longer [trail]. And then tapping it
    again disables and grays out the button."
  - Off on a device's first match, unless today's setting says otherwise; keep the stored choice and map the old on/off.
  - "Last 2 moves" means your teammate's last move on that board and the opponent's reply, then it's your turn.
- **Replay only when it's your turn:** you jump to a board and it's your move there. Never while you sit at your board waiting for
  the opponent.

## 3. Settings
- **"Quick board jump"** goes in the Squads settings as an on/off. It's today's "Jump to my next board", with the same behaviour
  and the same stored choice.
- Remove the toggle and its line ("Each turn you make one move, one board along.") from under the board. Keep the (i) text
  inside settings if it helps.

## 4. Under the board
Only the move arrows (back and forward) and **the turn order**:
- **The turn order** is a box that **keeps one size on every board**. It lists the players of this match in the order they move,
  with the player to move **lit up**. Eric: "you know when you look down right away, being like, oh, I've got 2 turns left."
- To the right of each name sits the move they last played, like the scoreboard's. **A tap on a row** shows the board at that
  position.
- **Open question for Eric (mock both):** Eric said "6 names" (the 3 seated on each side). With 4 a squad, either:
  - (a) the 6 seated players, with your waiting teammate shown as "next in"; or
  - (b) all 8 players in ring order.

  Mock both. The director sends them to Eric and builds his pick.
- **Remove:**
  - "Back to my board": a tap on your mini board does it, and a first-time tip says so;
  - the "Your move" box and any other status text that comes and goes there.

  Whose turn it is shows in the turn order.
- **Nothing is ever cut off at the bottom.** Check with the phone's browser bar showing (`eric-1`): iPhone 13/15 sizes and a
  short Android one.

## 5. First-time tips: 3 coach marks
Like games do, one at a time. The rest of the screen dims; a pointer marks one thing with a short line and an OK. A tap
anywhere or OK goes to the next tip.
1. **Settings:** "Tap here for settings." Mention Quick board jump.
2. **The replay button:** "Tap to replay moves: the last 2, all of them, or off."
3. **The mini boards:** "Tap a board to watch it. Tap yours to come back."

Show them once per device, at a player's first Relay. There's no "Don't show again" for now (Eric). List every line as
player-visible text.

## 6. Sound
The countdown tick plays **only when your real bank is running out**, never during the free seconds (the delay). Eric: it "makes
you panic".

## Done
- **Unit tests:**
  - the ring (every place fixed, the waiting player slots into the first free board, every squad move has exactly one mover, the
    colour balance);
  - 2 of 3 and the clinch;
  - the tie order;
  - an old 4-board match finishing on 4 boards;
  - the coins' scale;
  - the replay states and when replay is skipped;
  - no tick during free seconds;
  - the coach marks' order.
- **e2e** (phone and computer):
  - a Relay match on 3 boards plays to a result;
  - the turn-order box keeps its size and lights the mover;
  - a tap on a row shows that position;
  - the replay button cycles off, 2, all, off;
  - the coach marks run once;
  - nothing below the screen's bottom edge on the phone sizes.
  - Update the existing Relay checks and list them old → new.
- **Stills first** in `docs/squads-three-boards/`, at phone size 390x844 with the browser bar and on a computer:
  - the top with 3 boards and finished ones checked;
  - the replay button's 3 states;
  - your turn and waiting;
  - turn-order options (a) and (b);
  - each coach mark;
  - the settings with Quick board jump.

  **Stop after the stills, report, and wait for the director.** He sends them to Eric, and the corrections come back to you.
- Then: the PR body `docs/squads-three-boards/pr-body.md` (lane: **full e2e**, since the rules and stored matches change) and a
  decision note `docs/decisions/2026-11-05-squads-three-boards.md` quoting Eric. Don't open the PR.
