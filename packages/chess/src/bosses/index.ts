/**
 * Every boss with powers, by its BOSS_ROSTER id: the one place a new boss is registered (after its file,
 * bosses/<boss>.ts, fills in the base boss: bosses/base.ts). See docs/areas/bosses.md, "Adding a boss".
 */
import type { BossState } from "@chessroyale/core";
import type { BossRules } from "./base.ts";
import { GINGER } from "./ginger.ts";
import { BOINGO } from "./boingo.ts";
import { GREX } from "./grex.ts";
import { HOLLOW } from "./hollow.ts";
import { BIGBOY } from "./bigboy.ts";
import { SAWYER } from "./sawyer.ts";

/** Every boss with powers, by its BOSS_ROSTER id. */
const BOSS_RULES: ReadonlyMap<string, BossRules> = new Map([GINGER, BOINGO, GREX, HOLLOW, BIGBOY, SAWYER].map((r) => [r.id, r]));

/** A boss's rules (null: a boss without powers). */
export const bossRules = (boss: Pick<BossState, "id"> | null | undefined): BossRules | null => (boss?.id ? (BOSS_RULES.get(boss.id) ?? null) : null);
