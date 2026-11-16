# 50 v 50 Party mockup, round 1 (Nov 16)

The real queue screen in party mode with fake data (`?crowdparty=<step>` on branch `claude/crowd-party`, no server yet). Dark,
iPhone 13 and a 1280 × 800 computer.

| Still | What it shows |
| --- | --- |
| phone-0-home.png | Home: 50 v 50 picked, **Party** live ("up to 7 friends"), the line "Queue with up to 7 friends". PLAY opens the party screen. |
| phone-1-alone.png | Just made: you (gold ring) and **7 "+" seats**, "1 / 8", the leader's **Find match** beside **Leave** (in Cancel's place). |
| phone-2-sheet.png | A "+" tapped: **your friends sheet** (online first, what each is doing), Invite on each. No codes, no links. |
| phone-3-invited.png | QueenBee42 invited: their seat shows **"…"** (dashed, gray); the line under the grid says "QueenBee42 invited". |
| phone-4-joined.png | KnightOwl and PawnStorm joined (their pawns, **dashed gold**), QueenBee42 still invited, 4 "+" left: "3 / 8". |
| phone-5-member.png | A member's view: **"Waiting for Castle_Kid"** greyed where Find match is; PawnStorm away (faded). |
| phone-6-searching.png | Find match pressed: the lobby fills round the party (its seats first, then others), "14 / 100", the leader's **Cancel**. |
| computer-4-joined.png | The same on a computer: your card full width (with the names), Leave and Find match under it. |
| computer-5-member.png | A member on a computer. |
| computer-2-sheet.png | The friends sheet on a computer. |

Calls to check: names live in the line under the grid (a phone's seats are 33 px, too small for a name); the count is the party's
("3 / 8") until the search, then the lobby's; any member may invite; the header's back is Leave too. Measured: fits 320 × 568 to
1920 × 1080 with no sideways scroll; on a computer no page scroll from 1280 × 600 up.

# Build (Nov 16): the real thing, from the e2e flow (`PARTY_SHOTS=<dir>`, friends.spec.ts "50 v 50 Party"), dark

Two signed-in friends through the real server: Ann makes the party, invites Bo from a "+", Bo accepts the notice, Ann's Find match
puts both in one lobby, and the match starts with both on one team. iPhone 13 and a 1280 × 800 computer, in `build/`.

| Still | What it shows |
| --- | --- |
| *-1-alone.png | Party made: Ann's seat, seven "+", "1 / 8", Leave and Find match. |
| *-2-sheet.png | A "+" tapped: her friends sheet, "Up to 7 friends queue with you, all on your team.", Invite. |
| *-3-invited.png | Bo invited: his seat waits ("…"), "Bo Party invited" under the grid. |
| *-4-notice.png | Bo's home: the notice at the top right, "Ann Party invited you / to their 50 v 50 party", Decline and Accept. |
| *-5-joined.png | Bo in: Ann sees "2 / 8", his pawn dashed gold, six "+" left. |
| *-6-member.png | Bo's view: "Waiting for Ann Party" greyed; members may invite too ("+" live). |
| *-7-searching.png | Find match: the lobby, the party's seats first, "2 / 100", the leader's Cancel. |
