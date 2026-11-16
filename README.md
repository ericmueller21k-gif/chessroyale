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
