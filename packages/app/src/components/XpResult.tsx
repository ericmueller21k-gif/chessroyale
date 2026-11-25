import { useEffect, useState } from "preact/hooks";
import type { XpGrant } from "@chessroyale/core";
import { gameXp } from "../xp.ts";

/*
 * (The XP box of Nov 9 lived here; the end screen (Nov 20, components/EndScreen.tsx) replaced it on every result screen.)
 */

/** A result screen's XP for its match (online: by its lobby code; solo: when its result comes back). Undefined: still coming. */
export function useGameXp(match: object, opts: { code?: string | null; solo?: boolean }): XpGrant | null | undefined {
  const [xp, setXp] = useState<XpGrant | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void gameXp(match, opts).then((x) => live && setXp(x));
    return () => {
      live = false;
    };
  }, [match]);
  return xp;
}
