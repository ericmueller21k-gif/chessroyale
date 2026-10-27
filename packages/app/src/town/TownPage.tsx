import type { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { ItemLook } from "@chessroyale/core";

/**
 * A game with a town bot, asked for as you both sit down: the seat to come back to ("6.0.3": the table, your stool, the
 * bot; world.ts `seatText`), the bot's name as shown ("Tempo Tess (bot)"), its rating and its crate items. (Plain data:
 * the main bundle never loads the town's code.)
 */
export interface BotGameAsk {
  seat: string;
  name: string;
  rating: number;
  look: ItemLook | null;
}

type Props = { onBack: () => void; onBossAlone: (id: string) => void; onPlayBot: (game: BotGameAsk) => void; seat: string | null };
type Screen = FunctionComponent<Props>;

/**
 * The town square's page (/town), loaded when it opens: its code, art and styles are their own chunk, never in the main
 * bundle. Until it arrives (a moment) the page is its plain background: no loading bar. `onBossAlone`: a boss's card's
 * "Challenge alone", confirmed: out of the town square to the Boss raid screen, that boss's tile picked. `onPlayBot`:
 * you and a bot sit down at a table, and the game opens; `seat`: back from that game, you sit at that table again, the
 * bot across.
 */
export function TownPage(props: Props) {
  const [Town, setTown] = useState<Screen | null>(null);
  useEffect(() => {
    let live = true;
    // (No module when its chunk was gone after a deploy: the page is loading again, stale.ts.)
    void import("./Town.tsx").then((m) => live && m && setTown(() => m.TownScreen));
    return () => void (live = false);
  }, []);
  return Town ? <Town {...props} /> : <div class="screen" />;
}
