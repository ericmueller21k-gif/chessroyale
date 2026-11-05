# Rooms: up is up the screen, held in one place (Eric, Nov 5)

## Eric's report

"using the keyboard or the keys, I ran into one of the buildings, and then it reverses on me… if you hold up in one of the rooms,
it actually gave you the kind of sensation you're running down. So it's flipped for some reason when you go into the buildings."

## What was wrong

The town's rows run away from the camera (a row more is up the screen). A room's rows run toward the camera (a row more is down
the screen). The walker (`Walker` in `town/world.ts`) and the arrow keys (`keyWalk` in `town/arrows.ts`) only knew the town's way.
So every room had to fix up two things itself: flip the key's step and swap the back and front views it drew.

The arrow keys came into rooms with #488 (Nov 4) without the flipped step. From then until #493 (Ginger's igloo, merged the same
evening), holding Up in any room walked you down the screen and showed your ride's front. That is exactly Eric's report. I
rebuilt that code and saw it: Up went from (10, 17) to (10, 18), the square was drawn 39 px lower on a phone (61 px on a computer),
and the ride showed its front (view 2) while it moved. #493 fixed it with two separate patches in `ShopRoom.tsx`: a `-dr` on the
keys' step and `roomView`, which swapped the views. That is why main is right today. Every room on main checks out: all ten homes
by keys and by the on-screen arrows, at both zooms, on foot and on a ride, phone and computer. So does Eric's own path: Up held into
a home until its card opens, then Go in with the key still held, then Up pressed again.

The likely reason Eric still saw it on Nov 5: the build on his phone predates #493, for example a deploy from before it or a copy
the service worker kept. That is worth checking on his side. This PR doesn't depend on it: it removes the reason the bug could
happen at all.

## What changed

- `Walker.rowsUp` (`town/world.ts`): which way along the walker's rows is up the screen. It is 1 in the town (the default) and -1
  for you and the boss in a room. The walker's `view` now uses it (1 = up the screen, its back; 2 = down, its front), through one
  helper, `screenRow`.
- `keyWalk` (`town/arrows.ts`) turns the keys' step along the rows by the walker's `rowsUp`, with that same helper. This is now the
  only place the keys' up is mapped onto rows.
- `ShopRoom.tsx`: sets `you.rowsUp = -1` (and the boss's), and starts you facing the counter as `view = 1`. Removed: the `-dr`
  passed to `stepFor` and `roomView`. The ride is drawn from `you.view` as it is.
- Test hook: `__shopRide()` also gives your figure's feet on screen (`foot`), or null.
- Docs: `docs/rules/eric.md` has the new standing rule and names its guards. The "Arrow keys" entry in `docs/areas/town-square.md`
  now says how the rule is held.

## Player-visible changes

None compared with main today: up is already up in every room, and this keeps it that way. Compared with the build Eric reported
on, Up and Down in rooms now go the way they look. No new text.

## Tests

- New unit tests in `packages/app/test/town-arrows.test.ts`, "Eric's rule (Nov 5): up is up the screen in the town and in every
  room (Walker.rowsUp)":
  - `screenRow`;
  - each of Up, Down, Left and Right, in the town and in a room: which way you go on screen and the view shown;
  - the same through a room's own `stepFor`;
  - a tap's walk getting its view from `rowsUp`.
  - With the old mapping, the room's Up and Down cases fail.
- New e2e in `e2e/shop.spec.ts`, "Eric's rule (Nov 5): up is up the screen in every room: …" (on foot, and on a ride), phone and
  computer. It covers Babur's Circus (an ordinary shop), Alfil's Pyramid (its marks laid out across) and Hollow Peak (the cave), each
  way by the keys and by the on-screen arrows. It checks three things: the square you end on is drawn that way of where you were
  (both read in the same frame); your feet move that way on screen and never the other way; and on a ride, the view drawn while
  moving is its back going up, its front going down, and its side facing the right way across. Before the fix it fails on both
  phone and computer: "up by the key on a ride: 10,17 -> 10,18, on screen dy 39.3".
- Also run locally: the Ginger Igloo test (its arrow-key run along the catwalk) and "on a ride (Eric, Nov 2…)" (the ride's back on
  the way in), phone and computer; `npm run typecheck`.

## Changed checks (old → new)

None. No existing test check was changed or removed. The `__shopRide` hook type in `e2e/shop.spec.ts` gains `foot`. The new checks
guard the new rule in `docs/rules/eric.md`.

## Lane

The town square (/town): `packages/app/src/town/**`, its unit test, and `e2e/shop.spec.ts`. No shared code is touched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
