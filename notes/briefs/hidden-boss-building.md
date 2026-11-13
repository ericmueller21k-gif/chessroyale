# Hidden Boss: his building in the town and the way up (Nov 13)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (town art, rooms and their wiring).
Read CLAUDE.md, .claude/LESSONS.md, docs/areas/town-square.md. On branch claude/director-notes read
notes/briefs/hidden-boss-house-NOTES.md (the whole plan; "Update (Eric, Nov 12, second message...)" is the building) and the reference
photo notes/mockups/2026-11-12-eric-hidden-boss-building-ref.webp. The top-floor room is built as a mockup on branch claude/hidden-boss-room
(rounds 1-3, the light; its .pr-body.md says what's there; `ShopRoom.tsx` `loadRoomWith`/`fx`, `town/shops/recluse-*.ts`): merge that branch
into yours and make it the real top floor. The kid's drawings come with it (claude/hidden-boss-ages is already merged into it).

Build:
1. **The building in the town:** an old Brooklyn corner walk-up (red-brown brick, 4-5 stories, ornate cornice, arched window hoods, fire
   escapes zigzagging down the front, a ground-floor shop awning), in a town corner with room for it. It's on the minimap like the other
   homes, with its area banner. Id `recluse`. Tapping its door works like the other homes (the door-tap grace from PR #664).
2. **Inside, three rooms** (smaller inside than out is fine):
   - the ground-floor hall: a few apartment doors you can't open (a short line if tapped), the stairs;
   - a stair landing (the second floor): the next flight up;
   - the top floor: the child's room from the mockup, the kid playing his 1956 game on the floor (its 9 x 9 size, its light, its
     one-surface side walls). The room-to-room doors work like Rolling Dough's back room.
   Moving between them: tapping the stairs takes you up or down (a short fade), like the other room-to-room doors.
3. **No challenge yet.** The room's challenge, the 4-player limit, the locked door and the summoning are the next job (server). In the
   room, his home card offers no Challenge for now (say "Coming soon" greyed, per Eric's nothing-hidden rule).
4. **Who sees it:** admins first, the same way Don Dough's home was gated when it was new (find that pattern; BOSS_ADMIN_FIRST). Players
   don't see the building until it's opened to them.
5. His house music: `recluse-house` (themes.json, already in the game) plays in the top-floor room, as the other homes' themes play
   in theirs. Not in the hall.
6. Remove the mockup preview page from the build if it would ship (`/hidden-room-preview.html`: never reachable in production).

Shared code: the room component gained an optional `fx` prop in the mockup; nothing else in other rooms changes. The one-surface walls
stay in this room only.
Lane: targeted (town, a shared room component). e2e: add one focused test in an existing town spec (the door, up two flights, the room
drawn, back down; admin only) and add the new paths to `e2e/areas.json`. Run typecheck, the room tests, and that test locally.
Images for Eric (about 6): the building in the town (phone and computer), the minimap, the hall, the landing, the room with the kid.
Push them to branch stills/hidden-boss-building (never under docs/). About 2.5 hours.
Branch claude/hidden-boss-building (from origin/main, with claude/hidden-boss-room merged in). Push at each real step. Update
docs/areas/town-square.md; decision note at most 80 words. When done: push .pr-body.md (short), then .done last. Don't open a PR.
American English. Never include model names in commits.
