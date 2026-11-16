# A phone's 50 v 50: the steady box, "Black" in line, the chat tab's pickers, bots chatting in solo (Nov 1, 2026)

Eric, Nov 1, from his iPhone in a bots-only 50 v 50: "the container with the score, it still seems like it's flashing…
the container should be static, and anything inside of it should be loading or fading in and out and moving, but not
flashing"; "Black" sat right of "POS"; "I think we should have it in the bot-only game and have the bots just chatting
still"; then "delete those there… put a little T… and then a little emoji button… if you tap on the emoji, it pulls up
your emojis… if you tap the text… it shows your preloaded ones."

- **The flash was real.** Each phase of a turn is a screen of its own (App's `renderPhase`), and each built the box under
  the board anew. A new scoreboard measured its room after its first paint (`useEffect`), so its first frame had 3 rows
  (2 at worst) and the rest wiped in over 0.5 s (the rows' height transition): 2-3 times a turn. Measured in Chromium
  (no WebKit here) at 390 × 750: main built 5 boxes and 5 headers in 2 turns and a cut; now 1 and 1 in 4 turns and 2 cuts.
- **The fix:** the phone's 50 v 50 box is one element per match (`KeptBox`, `QuickChat.tsx`), drawn by a Preact root of
  its own; each screen holds a hidden marker and moves the box in after it before its first paint, and through a cut the
  box waits off the page. `MiniTower` also measures in a layout effect from its last room, so a scoreboard drawn anew
  anywhere (the chat tab's Back, other modes) shows its rows at once. Guard: `e2e/crowd.spec.ts`, "the scoreboard box is
  built once…".
- **"Black" and "POS"** both start 3 px in (the rank squares' edge), phones only; the tab stays 45 × 28 px.
- **The chat tab's pickers:** no rows of buttons under the feed; "T" (Quick phrases) and 😊 (Emoji) left of "⋯" open the
  same picks over the feed's foot; a send, the button again or a tap elsewhere closes them. On a shorter phone (up to
  700 px tall) the chips are 26 px (24 under 640) so the ten phrases fit whole. The header's buttons are 28 px wide under
  360 px so the fold arrow fits at 320. Only the phone's 50 v 50 tab: computers, raids, lobby and town chat unchanged.
- **Bots chatting in solo (call: the pace).** Solo's 50 v 50 keeps its queue chat through the match, with teams (a raid's
  still closes). The bots say what online bots say (`botChatLines`: "Good luck!", a teammate's "Nice move!", "GG") and,
  solo only, now and then an everyday pick from a teammate after about a third of your team's moves
  (`QUICK_CHAT.botChatterChance` 0.35, `botChatter`: lines and emoji every player has), at most 3 lines a minute in all,
  1.5-6 s after the moment, never on the cut screen. Measured: about 1.5 lines a minute reach you. On a computer a solo
  50 v 50 now shows the chat column beside the board, as online does; the board doesn't move.
- Streaks (item 3) dropped: Eric's game was Freestyle, where streaks count from the first move by design.
