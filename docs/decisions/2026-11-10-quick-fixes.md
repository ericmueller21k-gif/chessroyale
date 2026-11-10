# Quick fixes: rerolls, the auto chess board, the top bar (Nov 10, 2026)

- **Rerolls.** Eric: "1 free reroll every round, and then it costs 1 for the next one, and then 2, and it's capped at 2."
  `shop.reroll` is `{ first: 0, step: 1, max: 2 }`. The bot's rule is unchanged (at most 3 a round, only with 7 gold).
- **Board colors.** Eric: "the colors fuse." Classic's dark square is #b39c7c on the auto chess board only (was #c0ad90):
  color distance 16 → 22, 14 → 18 under their half's dim layer. Other boards and schemes are untouched.
- **Top bar.** Eric: "just make them all black, like the settings... except for your guy." Quests, the shop and Friends are
  outlines in the text color, no fill; the clipboard shape stays. The computer's side menu icons (gold outlines from before
  Nov 9) are left as they were.

**Director, Nov 10:** with the free first reroll the bot keeps gold it used to spend on rerolls and bought XP more often
(229 of 300 test rounds, was 214), past "now and then". `bot.xpChanceFull` 0.8 → 0.7 brings it back to 210.
