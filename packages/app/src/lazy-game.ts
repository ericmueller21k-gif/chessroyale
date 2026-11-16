import { lazyGroup } from "./lazy.tsx";

/**
 * A match's screens (screens/game-screens.ts): their own chunk, off the first load (Nov 10, phone load: home starts fast), loaded when
 * play is near (App.tsx). With them every boss's figure, his powers on screen and the God King (Nov 16, the bundle split): home and the
 * boss select draw the bosses' portraits from the first load (BossPortrait.tsx) and the select's stage figure from here.
 */
export const game = lazyGroup(() => import("./screens/game-screens.ts"));
