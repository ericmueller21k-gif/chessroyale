# Each timed power's beats written once, in its timeline (Nov 22, 2026)

Follow-up to [solo-resume](2026-11-22-solo-resume.md) (#885). Its last review (delta 3, F1) found the one beat keep before show still
missed: Dash's Scramble Rush was kept only as his sweep began, so a crash or a second window's Resume after the sweep had shown played
it all again (700 to 4,200 ms). Lights out's drop had the same shape. The cause, as the review named it: what each power's screen shows
by the clock was written twice, once in the screen and once in `SoloMatch.moment()`, and the walk test copied `moment()`'s list, so it
checked the code against itself. The Rush's sweep was the screen's own times (`rushRuns` in `DashRush.tsx`), written nowhere else.

**The fix: one list per power, beside its timeline, from the times its screen draws by.** `rushRuns` (his copies' passes and when each
swept piece goes and lands) moved, unchanged, from `DashRush.tsx` to `dash.ts` beside `rushTimeline`, and `rushBeats(rush)` lists the
Rush's beats. `dodgeTimeline()` and `lightsOutTimeline()` return theirs as `beats`. The screens draw by those same times; `moment()`
returns the list as its `reveals`, and the walk in `solo-resume.test.ts` reads it too. A beat is each time the screen first shows
something by the clock alone, with no update, and where a sweep or a drop runs, its end:

| Power | Its beats |
|---|---|
| The Rush | his sweep's start, each swept piece gone from its square and on its new one (each the first whole ms it shows at), the sweep's end, your ten seconds (the swept pieces' edges), time's up (the board as it was). New: each piece, the sweep's end, time's up. |
| The Dodge | the volley's lines, each round as it opens, its lines, each teleport. Unchanged: the scope-in and the beams show nothing to use twice, and a round's beams and hit play out its result, kept by the update that closes it. |
| Lights out | his drop and its end, each round's targets, the lights back. New: the drop's end. |

**Calls:**
- **The director's:** inside a sweep, keep at each piece's change, since that's how the screen draws it, never at the sweep's end as
  soon as it starts. A rejoin midway plays on from the last piece shown (his copies' motion since then plays again, no piece does);
  one after the sweep never plays it again.
- **Mine:** Lights out's drop dims at his smashes, which are his art's cues (`lightsOutSmashes`), not the timeline's, so its beats are
  the drop's start and end (the director's "otherwise"). A rejoin inside the drop plays it from its start: the position already on screen
  before it, for at most 1.8 s.
- **Mine:** `momentNow` now keeps the last beat due within the 100 ms lead, not the first. The sweep's beats can be under 100 ms apart,
  and the first-only rule left the second unkept (the walk caught it against Dash, in Boss alone and a Solo raid).
- **Mine:** a check that the Rush's on-screen board and stage (`rushShownFen`, `rushStage`), taken every ms, change only at its beats,
  and at every one. So the list is the screen's own, which is what the walk couldn't check.

The decision note's "the taking tab resumes at or after everything the other has shown" and "the one thing still shown before it's
kept" (N2) hold again. F2: `solo.ts`'s stale `resumeTurnMs` comment now names `resumed`.

Player-visible timing is unchanged. `rushRuns` gives the same sweep as before on 798 rushes. In a recording of the Rush frame by frame,
before and after, every board state is the one `main`'s sweep draws, each change two or three frames after its time.
