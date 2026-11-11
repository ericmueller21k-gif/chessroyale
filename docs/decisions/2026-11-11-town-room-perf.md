# Rooms' frame rate, and going in and out (Nov 11)

Eric's iPhone 14 Plus, Safari: "inside shop rooms the frame rate sits at 42-44 fps standing still and never climbs"; "exiting ANY
building drops to 2-4 fps for about a full second"; "running back into the bakery the 3rd time, it stayed at 60".

- **Both numbers were the `?fps` pill, not the frames.** A room had no counter, so inside one the pill stood still on the town's last
  reading (the door's zoom: 42-44; 60 the 3rd time). Out again, its two half-second windows spanned the whole visit: the frames from
  before you went in over the seconds inside, "1 fps · 3 fps" (reproduced headless; a page frame counter saw steady frames throughout).
  Fix: one shared count (`FpsCount`) that the town and the room both tick; a hidden tab restarts it, the handoff doesn't.
- **The report covers rooms**, with "going in" and "going out" marked (two columns: Room, In/out). The handoff isn't a pause: the
  room's first frame carries the wait before it (a first visit paints the room's art behind the black: one frame of about 0.5 s on a
  desktop, about 2 s slowed 4x).
- **A room's real cost was its floor**, laid every frame as clipped triangles (slowed 4x: 20 fps with it, 60 without). Kept as one
  picture while the camera rests (pixel for pixel the same); the follow spring settles exactly so a resting view stays the same.
  Standing still slowed 4x: 21-24 → 58-60 fps. Walking unchanged (22-25): the floor is still drawn while the view moves.
- **Not done: warming a room before the door.** Inside, a first visit already runs like a later one (nothing painted or uploaded in a
  room's frames, either visit). Its one extra cost is painting the room's art as you go in, behind the black. Painting it earlier (on the
  Go in tap, during the walk to the door) would drop the town's frames while you walk (eric.md, Oct 27), so it stays behind the black;
  painting it in small slices during that walk is the option if the black's length on a phone matters.
