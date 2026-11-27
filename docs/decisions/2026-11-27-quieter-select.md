# The select sound 30% quieter (Nov 27, 2026)

Eric: "the sharp noise made when you click on an item, its played in a few other spots in the game, we need to drop the noise level by
about 30%, its hard on the ears." The `menuSelect` sample (`/sounds/menu/select.mp3`) plays at 0.56 (was 0.8) everywhere it's used
(the locker's items, crate pages, menus: 17 places), in `packages/app/src/sound.ts`. Nothing else changes.
