# Squads move replay: its end never waits for a lobby message (Nov 23, 2026)

Main's run 45230830938: `squads-replay.spec.ts:207` saw the replay still up 1.6 s after its end (the free pill, on its own clock, read
"free 1.4"). Cause, in the app: `useMoveReplay` picked its next redraw inside `useEffect`, which runs a frame after drawing; on a busy
device that frame can come after the end, so the old timer was cleared and none set, and the replay stayed up until the next lobby
message. Fix: the next moment is picked at drawing time (as the reveal's are) and a late effect fires it at once. App only; the test
and its checks are unchanged (it guards Eric's "Squads: move replay" rule, so no check was touched).
