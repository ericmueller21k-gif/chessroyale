# Boss art made on first use, not on every load (Nov 10)

Eric: "less lag and simpler code over all else." Every load built all boss art: about 1.4 s of a fast core, 5.2 s on a
4x-slowed phone. Now each animation is made when first read (`lazyAnim`), parts when first drawn (`lazyParts`).

Calls: the art must stay pixel-identical, so the four bosses whose frames share rounded-pose caches or a counter (Pig, Tiger,
Gardener, Moo) make their animations in file order (`lazyAnimsTogether`). The cost moves to quiet moments: the battle's
load (sliced, `prewarmAnims`) and home's first seconds (the tiles' portraits). Smudgy's idle is one ~90 ms build that can't
be split. Area page: docs/areas/bosses.md, "Adding a boss".
