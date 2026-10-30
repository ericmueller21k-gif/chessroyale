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
import { PIG } from "./pig.ts";
import { RECLUSE } from "./recluse.ts";
import { ALFIL } from "./alfil.ts";
import { HOPPER } from "./hopper.ts";
import { SMUDGY } from "./smudgy.ts";
import { MOO } from "./moo.ts";
import { GARDENER } from "./gardener.ts";
import { TIGER } from "./tiger.ts";
import { FOLIO } from "./folio.ts";

/** Every boss with powers, by its BOSS_ROSTER id. */
const BOSS_RULES: ReadonlyMap<string, BossRules> = new Map([GINGER, BOINGO, GREX, HOLLOW, BIGBOY, SAWYER, PIG, RECLUSE, ALFIL, HOPPER, SMUDGY, MOO, GARDENER, TIGER, FOLIO].map((r) => [r.id, r]));

/** A boss's rules (null: a boss without powers). */
export const bossRules = (boss: Pick<BossState, "id"> | null | undefined): BossRules | null => (boss?.id ? (BOSS_RULES.get(boss.id) ?? null) : null);
