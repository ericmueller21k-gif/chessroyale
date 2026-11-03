import type { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { ItemLook } from "@chessroyale/core";
import { account, onAccountChange } from "../account.ts";
import { FrontFrame, type FrontNav } from "../components/FrontMenu.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import type { Stand } from "./world.ts";

export type { Stand };

/**
 * A game with a town bot, asked for as you both sit down: the seat to come back to ("6.0.3": the table, your stool, the
 * bot; world.ts `seatText`), the bot's name as shown ("Tempo Tess (bot)"), its rating and its crate items (or a
 * sidekick's face). (Plain data:
 * the main bundle never loads the town's code.)
 */
export interface BotGameAsk {
  seat: string;
  name: string;
  rating: number;
  look: ItemLook | null;
  /** A sidekick's face (its idle's first frame, an image's address) for its strip, in place of the pawn; null: a pawn. */
  face: string | null;
}

type Props = {
  onBack: () => void;
  onBossAlone: (id: string) => void;
  /** A boss with an intro challenged (Alfil, Big Boy, Babur, Puddles): start its battle under its transition; resolves once the battle shows. */
  onBossChallenge: (id: string, stand: Stand | null) => Promise<void>;
  onPlayBot: (game: BotGameAsk) => void;
  onColosseum: () => void;
  seat: string | null;
  /** Back from a boss's challenge: where you stood as you challenged it. */
  stand: Stand | null;
};
type Screen = FunctionComponent<Props & { framed: boolean }>;

/**
 * A computer: 1024 px wide or more with a mouse. The town sits in the front door's frame there (Eric, Oct 29), in the center
 * column's box, between the side menu and the live panel. A phone or a tablet (a tablet on its side included: touch) has the
 * whole screen, as it always had.
 */
const COMPUTER = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

/** Whether your account is known: the server's answer, and your profile where there are accounts (or none: no server). */
const accountKnown = () => {
  const a = account();
  return !!a.config && (!a.config.accounts || !!a.profile);
};
/** The longest the town waits for your account before it loads without it (ms). */
const ACCOUNT_WAIT_MS = 3000;

/**
 * The town square's page (/town), loaded when it opens: its code, art and styles are their own chunk, never in the main
 * bundle. Until it arrives (a moment) the page is its plain background: no loading bar. `onBossAlone`: a boss's card's
 * "Challenge alone", confirmed: out of the town square to the Boss raid screen, that boss's tile picked. `onBossChallenge`: the
 * same for a boss with an intro (Pokémon-gym style: town/shops/challenge.ts), its battle started at once under its transition;
 * `stand`: back from that battle, where you stood. `onPlayBot`:
 * you and a bot sit down at a table, and the game opens; `seat`: back from that game, you sit at that table again, the
 * bot across.
 */
export function TownPage({ nav, ...props }: Props & { nav: FrontNav }) {
  const framed = useMedia(COMPUTER);
  const [Town, setTown] = useState<Screen | null>(null);
  useEffect(() => {
    let live = true;
    // (No module when its chunk was gone after a deploy: the page is loading again, stale.ts.)
    const load = () => void import("./Town.tsx").then((m) => live && m && setTown(() => m.TownScreen));
    // Your account first (a moment, on a page opened at /town; at once from home): an admin's town has the homes of the bosses in
    // the game for admins first (admin-town.ts), read as the town's code loads. Not waiting past ACCOUNT_WAIT_MS: a town without them.
    if (accountKnown()) load();
    else {
      const go = () => {
        off();
        clearTimeout(timer);
        load();
      };
      const off = onAccountChange(() => accountKnown() && go());
      const timer = setTimeout(go, ACCOUNT_WAIT_MS);
      return () => {
        live = false;
        off();
        clearTimeout(timer);
      };
    }
    return () => void (live = false);
  }, []);
  const screen = Town ? <Town {...props} framed={framed} /> : <div class="screen" />;
  return framed ? (
    <FrontFrame page="town" nav={nav}>
      {screen}
    </FrontFrame>
  ) : (
    screen
  );
}
