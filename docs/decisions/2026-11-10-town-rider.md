# Town: your rider in the first frame (Nov 10, 2026)

Eric: "a big bug happens every town load, your rider doesnt appear for a few seconds, gotta fix this too its sloppy." The ride's
chunk was already loaded; its ~70 frames were composed one an animation frame after the town showed (1.5 to 2 s). Now the town waits
for your pawn (`readyYou`), your rider's frames composed in one go (about 0.25 s; 1 s on a phone slowed 4x), at most
`TOWN_FEEL.youWaitMs` (1 s), then shows without it and adds it when ready. The town's start runs in its own task, so the longest task
stays as without a ride. Other players' rides still compose one a frame (about 2 s each; bots wear none).
