# Bots on Eric's friends list with lifelike activity (Nov 20). Opus, high. Targeted lane (hub)

**Eric, Nov 20:** "can you also add to my account ... I want to like have some bots on my friends list that like have random activity
showing, so I can ... start simulating more what it actually looks like if there are real people, as real as we can get at least."
Read CLAUDE.md, `docs/areas/hub.md`, `packages/server/src/friends.ts`, `friends-api.ts`, `presence.ts`, `test-accounts.ts` (named test
accounts, admin-only, `users.test`), and the app's friends list. Branch `claude/friend-bots` from main.
- **Admins only, never a real player:** an admin action (a button in the admin page, or a route like the test accounts') makes N (about
  8) test accounts with player-like names and looks, and friends them with **the admin who asked** (Eric's own account: found by the
  session, never by a hard-coded name or email). Nobody else ever sees them; public rankings already leave test accounts out.
- **Lifelike activity without writes:** their presence (online/away/offline and what they're doing: "In Chess Town", "In a Boss
  Battle vs <boss>", "Climbing the Battle Tower · floor N", "In the queue") worked out from the time and each bot's id (a seeded
  schedule: sessions of 10-60 minutes, gaps of hours, more in the evening), answered where the friends list asks for presence. No
  timers, no database writes, no cost when nobody looks.
- Removing them: the same admin action removes them (test accounts' delete).
Tests: unit (the schedule is stable and varied; only an admin can add them; they're friends of that admin only). Decision note; hub area
page. One still of Eric's friends list. Done: `.pr-body.md` (under 40 lines) and `.done`; push and end. No PRs, no CI waits.
