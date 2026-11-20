# Admin test button: "Win this match" (Nov 20). Opus, high. Targeted lane (admin-only; server gate checked)

**Eric, Nov 20:** "add in my by the little lightning bolt and the other icons I have as an admin or whatever for testing. Put a button
that lets me just end the current match as like a victory, so I can test going up each floor and stuff like that."
- Today: admins' TestButtons beside the God King (phone) / in the title line (computer, Hud.tsx): ⚡ ultimate, 🐟 Engine move, 🏆 "Win this
  form" (Hidden Boss only: SoloMatch.winForm → runner.bossForceWin; online: net.ts `winForm` → lobby-do → lobby.winFormTrigger, admin-gated).
- Generalize 🏆 to every boss battle an admin plays: Boss alone, raids/parties online, and **Battle Tower floors (solo and party)**:
  "Win this match (testing)": pressed, your next move wins (the same end a mate takes, so the result, XP, the tower's floor write and the
  elevator up all follow as for real). The Hidden Boss keeps its per-form meaning.
- Server: admin-only, as winFormTrigger checks today (never a player; a player's message refused). Tower solo floors: the device reports the
  win; if `soloWinMinSeconds` would refuse an admin's quick win on the live site, let an admin's report through (server checks admin), and
  say so in the decision note. Party floors: the room's force-win path, admin seat only.
- Tests: unit (solo force-win on a normal boss and a tower floor; the server refusing a non-admin), one e2e (admin wins a tower floor with
  the button and rides up). Decision note; the bosses/battle-tower area pages. Stills (phone + computer: the 🏆 by the ⚡).
