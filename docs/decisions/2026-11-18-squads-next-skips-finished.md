# Squads: NEXT skips a finished board (Nov 18, 2026)

Main's run on 36a6366 failed "Relay with Quick board jump" once (`e2e/squads-replay.spec.ts:264`, no NEXT on the board on screen).
Its page snapshot: board 1 had just ended Qf2#, NEXT sat on it, and the quick jump rightly showed board 2 ("your next board"), unmarked.
Not timing (the director's guess) but the app: `myBoards`' Relay `next` came from the schedule alone, `studyBoard` skips finished boards.
Fixed the cause: `next` now skips finished boards, so NEXT marks the board the jump shows. The guard test is unchanged (Eric's OK, Nov 18:
"yes, you have my permission to do whatever we need to do to make it work", wasn't needed); `docs/rules/eric.md` unchanged.
