# The Hidden Boss's fight: visual check, start to finish (Nov 14)

Read-only review of `main` at `f239f7d` (the transformation, #707), following `notes/briefs/recluse-visual-qa.md`.

**How it was played:** his room's challenge as Eric plays it: the town, up the walk-up, **Challenge**, **Fill with 3 bots**, then the
whole fight online (the party of four). The kid was played for real until he grew to 20; then 🏆 *Win this form* for each form, and on
the four boards. It ran three times, at the same time, on the local Worker (`wrangler dev`, as the e2e does):

- **Phone:** iPhone 13 (390 × 664 CSS viewport, DPR 3), `stills/phone/`
- **Computer:** 1280 × 800, `stills/desktop1280/`
- **Computer:** 1920 × 1080, `stills/desktop1920/`

Each still also recorded the boxes of the board's square, the Moves panel, the chat, the phone's panel, your pawn, your team's pawns, the
God King, the boss bar and the dock, plus every speech box and the drawn top of his figure (`metrics/<size>-metrics.json`).
`capture/diff.py` compares every still with the first one. `sheets/` holds contact sheets (4 or 6 stills each) for a quick look. A first
run (`stills/run1/`) had one problem that the second run did not repeat at the same moment: it is kept for #5. The capture script is
`capture/hidden-boss-room.spec.ts`; it was run from `e2e/qa/`, never committed to `main`.

**The headline:** what Eric asked for in "same frame" holds. From the kid's first move to the last board, the board's square, the Moves
panel, the chat, the phone's panel, your pawn, your team's three pawns and the God King stay within 2 px at all three sizes. The one
exception is the God King's own drawing when he falls (#11). On a computer the four boards' gaps are even: 24/24/24 px across and down
at 1280, 45/46/45 at 1920. On a phone the three small boards are 18/19/18/18 px apart. What's wrong is mostly **speech boxes** and the
**portrait on a computer**. One problem is serious: on a phone, his line at the countdown shows as an empty sliver.

---

## Phone (iPhone 13)

| Beat | Still | OK / what's wrong | How bad |
|---|---|---|---|
| The kid | `01-kid-start`, `02-kid-line` | OK. The kid's bust is in the bar; the frame is the reference. The God King's line ("Mind your queen…") runs left over the Players panel's rows. That is by design (his words beside him), but for its few seconds it covers the scoreboard. | Low |
| Kid at 13 | `03-kid-13` | OK. His line is in the bar, the bust is 13. | — |
| Kid at 20 | `04-kid-20`, `05-kid-20-line` | OK. The bust is in the suit at 20. | — |
| Kid beaten, grows up | `06-kid-beaten`, `07-kid-grows-up` | OK. "Okay. You're good." → the man's answer, both in the bar. The box sits on the bar's bottom edge: its shadow pokes about 2 px onto the board's green line (`run1/phone-07`). | Nit |
| The man (a line) | `08-man-start`, `09-man-line` | OK. "I know an engine move when I see one." is in the bar; nothing moved. | — |
| His fall | `10-man-fall` | OK. "The book said… no… no…" is in the bar. | — |
| Cutscene (two lines) | `11-cutscene-start`, `12-cutscene-line1`…`4` | The lines sit over the right head, the tail on him, inside the screen. **In `12-cutscene-line2` and `12-cutscene-line4` a lone tail (◆) floats over a head with no box** (#2). | Medium |
| Transformation 1: the book, lifted | `13-change-book`, `14-transform-lifted` | OK. The kid's ghost is beside him and the God King is greyed in his place. | — |
| Transformation 2: radiate, white-out | `15-transform-radiate`, `16-transform-white` | At the white beat (about the intro's 8.7 s) **the bottom panel, the pawns, the title and the h1 rook still show through** on a phone, while a computer at the same moment is fully white (#8). | Low–medium (check) |
| Transformation 3: revealed, visor up, line 1 | `17-transform-reveal-line1`, `17b-transform-line1-whole`, `18-transform-leap` | The line is over his helmet, whole by 15.4 s. The box hangs 44 px over the bar's bottom edge and covers the board's top rank (the bar is empty then). The leap goes over the bar's edge, which is fine for a leap. | Low |
| The crack, the split | `19-crack-line2`, `20-split` | OK. "Prepare yourself." is over him; the three small boards rise and yours comes forward. | — |
| Shuffle and countdown | `21-shuffle-countdown` | **His line in the bar is an empty sliver 26 px wide**: "This is the ultimate test of your skill." can't be read (#1). | **High** |
| The four boards (a line) | `22-four-boards`, `23-four-boards-line` | The frame is unchanged, the God King greyed, the SLOW column right of your board. **The three small boards show only a clock, with no name** (#7). | Low–medium |
| A board ending | `24-boards-ending` | OK. "Won" is on each board, "Impossible… all four…" is in the bar, and ✓ shows on the panel's rows. | — |
| The result | `25-boards-won`, `26-results` | OK. His figure is in his suit with the line over his head. The heading reads **"4th of 4"** over "You beat the Hidden Boss on all 4 boards!" (#12). | Low |

## Computer, 1280 × 800

| Beat | Still | OK / what's wrong | How bad |
|---|---|---|---|
| The kid | `01-kid-start`, `02-kid-line` | OK. The kid stands left of the board, his feet on the board's bottom line. The God King's line sits over him. The chat's quick chips are cut at the panel's bottom (third row half shown), and that is so in every still. | Low (not new) |
| Kid at 13 | `03-kid-13` | OK. His words are 18 px over his head. **The portrait in the bar is still the 9-year-old** (#3). | Medium |
| Kid at 20 | `04-kid-20`, `05-kid-20-line` | The figure is 20 and in the suit; **the bar's portrait is the striped-shirt kid** (#3). In `05` the God King has fallen (his Last Stand): his drawing lies down and its box is 14 px higher (#11). | Medium / Low |
| Kid beaten, grows up | `06-kid-beaten`, `07-kid-grows-up` | OK. His words are 17–19 px over his head at each size; the man answers. The bar's portrait stays the kid until the man's match. | Medium (#3) |
| The man (a line) | `08-man-start`, `09-man-line` | OK. His words are 20 px over his head; the portrait is the man. **`run1/desktop1280-09-man-line`: the God King's three-row line covers the bottom of the Chat panel by 17 px, its words over "Trust the crowd"** (#5). | Medium |
| His fall | `10-man-fall` | **His words float 82 px above his head** as he collapses (#4). | Medium |
| Cutscene (two lines) | `11`…`12-cutscene-line4` | Each line is over its speaker. **`12-cutscene-line4` and `run1/desktop1280-12-cutscene-line1`: a lone tail ◆ with no box** (#2). | Medium |
| Transformation 1–3 | `13`…`18` | OK. The light, the full white-out (only a faint gear shows), the reveal. The words over his helmet (27–29 px over it) overlap the bar's bottom by 21 px (#9). The portrait shows the man without the suit from here on (#3). | Low / Medium |
| The crack, the split | `19-crack-line2`, `20-split` | OK. During the crack the square grows 4 px a side (the shake); the four boards part. | — |
| Shuffle and countdown | `21-shuffle-countdown` | OK. The PHASE 2 banner; his line is finished in his place's box. | — |
| The four boards (a line) | `22-four-boards`, `23-four-boards-line` | The frame holds (all boxes within 2 px of the first still). The gaps are 24/24/24 across and down, and each tag (name and clock) is in the gap above its board. **The boards are 3 px smaller and 2–3 px further in than at the split**: a small snap as the shuffle hands over to play (#10). **The Moves panel still lists the man's game ("1. e4")** (#6). | Medium (#6), Low (#10) |
| A board ending | `24-boards-ending` | OK. "Won" on the boards. The scoreboard's "WON" tags squeeze the names ("Coffeeho…"). | Nit |
| The result | `25-boards-won`, `26-results` | OK (a scrolling page, 1194 px tall). "4th of 4"; the review board replays **the kid's match** ("Move 1 of 11"), not the boards just won (#12). | Low |

## Computer, 1920 × 1080

| Beat | Still | OK / what's wrong | How bad |
|---|---|---|---|
| The kid | `01-kid-start`, `02-kid-line` | OK. The board is 952 px with the kid at its bottom left. **The God King's line covers the top 5 px of the top-left teammate's pawn and its hat, and touches the chat's bottom edge** (#5). | Low |
| Kid at 13, 20 | `03-kid-13`, `04-kid-20`, `05-kid-20-line` | His words are 18 px over his head. The bar's portrait stays the kid (#3). | Medium |
| Kid beaten, grows up | `06`, `07` | OK. 32 px, then 16 px over his head. | — |
| The man (a line) | `08`, `09` | OK. | — |
| His fall | `10-man-fall` | **82 px over his head** (#4). | Medium |
| Cutscene | `11`…`12-cutscene-line4` | OK in these stills. The child's lines run right of him and stay inside the board's light. | — |
| Transformation 1–3 | `13`…`18` | OK. At the white-out a faint outline of the right column's panel shows through. The words are 41–44 px over his helmet (more headroom than at 1280; fine). | Nit |
| The crack, the split | `19`, `20` | OK. | — |
| Shuffle and countdown | `21` | OK. | — |
| The four boards | `22`, `23` | The frame holds. The gaps are 45/46/45 across and down. **6 px snap: the boards go from 414 px at the split to 408 px in play** (#10). The Moves panel shows phase 1's game (#6). | Low / Medium |
| A board ending | `24` | OK. | — |
| The result | `25`, `26` | OK, as at 1280. | Low |

---

## Problems, worst first

1. **Phone: his line at the countdown is an empty sliver in the bar** (`stills/phone/21-shuffle-countdown.png`). "This is the ultimate test of
   your skill." (the end of his second line, handed from over his figure to his place as he lands home) gets a box 26 px wide: the words
   are laid out 72 × 97 px inside it and clipped away, so all a player sees is a white strip with a tail beside his bust. On a computer the
   same moment is fine (his place's box is not a fitted one). **Likely cause:** the bar's box is a `balanced` SpeechBox, whose width is
   measured once (`bubbleFit`) in a layout effect keyed on `[text, balanced]`. It was measured while his place's box was hidden during the
   phase change (`rc-away`, "his place's box hidden meanwhile"), got 0 + padding, and was never measured again when it showed.
   **Files:** `packages/app/src/speech.tsx` (SpeechBox's `balanced` effect: re-measure when it becomes visible, or skip measuring at 0
   width); the hiding is in `packages/app/src/screens/Recluse2.tsx` / `styles.css` (`.rc-away`). **High**: Eric will see it on his phone
   at the climax.

2. **Cutscene: a lone tail (◆) over a head with no box.** Seen in 4 of the 13 cutscene stills (`phone/12-cutscene-line2`,
   `phone/12-cutscene-line4`, `desktop1280/12-cutscene-line4`, `run1/desktop1280-12-cutscene-line1`), each time over the speaker of the line
   that had just ended or was about to start, and never seen in the middle of a line. Four in thirteen means it is up for a good part of the
   time between lines, not a one-frame blink. The tail is a separate element (`.cs-tail`), drawn whenever `boxAt` returns a box, and fades
   on its own rule (`c.boxFadeMs`), while the box is a SpeechBox with its own "fresh" and "leaving" states. Between lines the box is
   invisible and the tail is not. I didn't take this down to the frame (a per-frame probe would say which side of the line it hangs on).
   **File:** `packages/app/src/components/RecluseCutscene.tsx` (lines 146–152, the anchor/tail), `packages/app/src/recluse-cutscene.ts`
   (`boxAt`). **Medium**.

3. **Computer: the bar's portrait doesn't follow his form.** It is the striped-shirt 9-year-old while his figure is 13 and then 20 in the
   suit, and while he grows up into the man. Through the transformation and phase 2 it is the man in shirt and tie while the figure wears
   the suit and helmet (`desktop1280/04-kid-20`, `22-four-boards`). The phone's bust follows every age and the suit, so the two platforms
   disagree. **File:** `packages/app/src/screens/Boss.tsx` (`BossBar` → `BossFace`, the `boss-icon-face` used when he has a character),
   keyed on the form only. **Medium** (a player reads it as "the wrong guy").

4. **Computer: his fall's words float 82 px above his head** (`desktop1280/10-man-fall`, `desktop1920/10-man-fall`, `run1/desktop1280-10-man-fall`;
   the same 82 px at both sizes). His collapse lowers his drawn top from about 315 to 377 while the box keeps the standing man's height.
   Everywhere else it is 12–32 px. **Likely:** the collapse animation's entry in his kit's `heads` (the `--bc-head` per animation) is
   missing or uses the standing frame. **Files:** `packages/app/src/components/BossCharacter.tsx` (`--bc-head`), his kit's `heads` (the
   recluse kit, measured by `recluse-child.test.ts`). **Medium**.

5. **Computer: the God King's line runs into the chat and onto a teammate.** At 1280 × 800 a three-row line ("This is no ordinary boss.
   Trust your own moves.") reaches 17 px into the Chat panel's bottom, its words over the "Trust the crowd" chip (`run1/desktop1280-09-man-line`).
   A two-row line reaches 3 px. At 1920 it touches the chat and covers the top 5 px of the top-left teammate's pawn and its hat
   (`desktop1920/01-kid-start`). **File:** `packages/app/src/styles.css`, the party layout's `.gk-bubble` (Nov 14's 2 × 2: the chat ends
   above the God King and the team but his box isn't counted in that room). **Medium**.

6. **Computer: the Moves panel shows phase 1's game in phase 2.** Through the four boards it still lists the man's match ("1. e4" or
   "1. d4"). Your own board's moves never appear, even after you play. On a phone the Moves tab wasn't opened. **Likely file:**
   `packages/app/src/screens/Recluse2.tsx` (phase 2 keeps phase 1's Moves panel for the same-frame rule, fed phase 1's history). **Medium**
   (a player would call it stale).

7. **Phone: phase 2's small boards have no names.** The three small boards show only a clock ("1:57"); a computer's tags read "Castling
   Carl 1:57". A player can't tell whose board is whose. **File:** `packages/app/src/screens/Recluse2.tsx` (the phone's phase-2 layout,
   its tags). **Low–medium**, unless it was a deliberate call for room (`docs/decisions/2026-11-14-recluse-same-frame.md` doesn't say).

8. **Phone: the white-out may not reach the whole screen.** At about the intro's 8.7 s (`phone/16-transform-white`) the bottom panel, the
   pawns, the title and the h1 rook still show through, while at the same moment on a computer the screen is white edge to edge. That
   instant is `downAt` (the light starts dying back), so it may be the fade beginning from the corners. If it is, the light is centered
   on the board and doesn't reach a tall phone's bottom quarter. Worth a still at `whiteFull` (8.0–8.7 s) on a phone. **File:**
   `packages/app/src/components/recluse-light.ts` (the white-out's radius). **Low–medium** (Eric: "whites out the whole screen").

9. **The transformation's words over his helmet overlap the boss bar** by 21 px on a computer and 44 px on a phone, where they also cover
   the board's top rank (`17-transform-reveal-line1`). The bar is empty then (his place is away), so nothing is hidden, but the box hangs
   off the bar's edge. **File:** `styles.css` (`.rc-say`). **Low**.

10. **A small snap as the four boards start:** at the hand-over from the phase change (`20-split` / `21-shuffle-countdown`) to play
    (`22-four-boards`) the boards shrink 3 px at 1280 (219 → 216, moving 2–3 px in) and 6 px at 1920 (414 → 408). The phase change and
    phase 2 size the quarters differently. **Files:** `Recluse2.tsx` (`quarterStyle`) and the phase-2 board layout. **Low** (one
    frame's jump, during the PHASE 2 banner).

11. **The God King's fall moves his box up 14 px** (1280, `05`–`07`: his Last Stand in the kid's match). It is his fallen drawing, and
    he's back in place for the man. **Nit**.

12. **The result reads oddly:** "4th of 4" as the heading over "You beat the Hidden Boss on all 4 boards!", and the review board replays
    the kid's match ("Move 1 of 11"), not the man's or the boards just won (`25-boards-won`). Content rather than layout. **Low**.

Nits: on a phone the bar's box sits 2 px past the bar's bottom onto the board's green line. The chat's chips are cut at the 1280 panel's
bottom (not new). The 1280 scoreboard's "WON" tags squeeze the names.

**Not checked:** light mode only (the room fight's default here; no dark-mode stills). The phone's Moves and Chat tabs in phase 2.
1366 × 768 / 1280 × 600 laptop heights (LESSONS asks for them on a computer; the brief named 1280 × 800 and 1920 × 1080).
