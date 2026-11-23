# Birdie's fall: a happy hop out (Nov 23, 2026)

Eric: "We need to change the birdie falling animation, I guess it's too morbid that he gets 'hit' by it. Instead have his tumble from
his train be a hop out of it and then him free falling but looking like he's having fun instead of dead. The getting hit effect can be
the same tho."

- His figure's `fall` (`characters/birdie.ts`): a crouch, a hop up and out of the cab with his wings opening, his victory's smiling eyes
  and open beak, then a drop out of the frame, wings up, his cap lifting in the wind. No jolt, shake, feathers or squawk; built from his
  drawing's own parameters, no new art. Same 830 ms, so `BIRDIE_BEATS.fall` is unchanged.
- Its sounds: his hop (`pop`) as he springs, his cheer as he leaves the cab, the whoosh (`fall`) as he leaves the cab, over its roof (fix round: on frame 2, 210 ms in, so its 620 ms end at 830 ms, before the cutscene's whoosh at `dropMs`; at frame 4 the two overlapped, the doubling Nov 23 removed); the kit's unused `squawk` went.
- The cutscene's free fall: the art run's happy drawing (`arena-birdie-fall-fun`), baked into the sheet; the train's hit is unchanged.
