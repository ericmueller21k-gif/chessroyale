# Three more retry-passes on main (Nov 25): two real causes found, one to find. Opus high, targeted. Branch `claude/fix-flakes-2` from main

Found by the xp-start helper (run 45563883618; #942 fixes only xp.spec:223, a stale reload):
1. **[phone] crate-banner.spec.ts:118** (a real player bug): an opening is marked seen (`setUnseen(null)`, Crates.tsx ~979) only once
   `shown` is set, and `shown` comes from CrateStage's onCard timer at cardAt+cardMs (CrateOpenStage.tsx:209). "▶ Done" (and Wear / Open
   another) can be tapped before that timer fires, so the round closes with localStorage `hunchess-crate-unseen` still set and the next visit
   to the crates page resumes the old reveal over the list. Fix: the reveal's Done / Wear / Open another mark it seen themselves (in onDone,
   once bonusFirst() is false, setUnseen(null)). Test: tap Done the moment it appears, then reopen /shop?crates: the list shows, no reveal.
2. **[desktop] hidden-boss-room.spec.ts:111**: the admin's bots join HIDDEN_ROOM.botJoinMs (2 s) apart, but the page learns the count from its
   look every pollMs (1.5 s), a setInterval that skips a tick while a look is in flight (hidden-net.ts:161); one slow look steps over "3 of 4".
   Fix at the cause, simplest first: the room's answer carries the joins in order (or the test reads them from the server's hook) so no count
   depends on a poll landing in a 2 s window; never by just lengthening the test's waits.
3. **[phone] squads-play.spec.ts:103** (run 45566751900, shard 6): `.sq-clockline .sq-res-tokens` read ["×5","×4"], expected ["×5","×5"] within
   5 s. Find the cause (a token spent/shown late? a state race between the two pages? a real display bug?), fix it, prove it with repeats.
Start: `git fetch origin main && git checkout -B claude/fix-flakes-2 origin/main`. Read CLAUDE.md ("fix the cause, not add a checker").
Short decision note per cause, `.pr-body.md`, `.done`, push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort high. ~1-1.5 hours.
