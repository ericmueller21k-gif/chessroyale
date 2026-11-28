import type { ComponentChildren, FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { ItemLook } from "@chessroyale/core";
import { account, onAccountChange } from "../account.ts";
import { FrontFrame, type FrontNav, type FrontPage } from "../components/FrontMenu.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import type { Stand } from "./world.ts";
import { chunk } from "../stale.ts";
import { pauseEngines } from "../engine.ts";

export type { Stand };

/**
 * A game with a town bot, asked for as you both sit down: the seat to come back to ("6.0.3": the table, your stool, the
 * bot; world.ts `seatText`), the bot's name as shown ("Tempo Tess (bot)"), its rating and its crate items (or a
 * sidekick's face). (Plain data:
 * the main bundle never loads the town's code.)
 */
import type { TowerBack } from "./Town.tsx";
import type { TownPages } from "./TownChatTools.tsx";
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
  /** Leaving for another screen: asked first ("Leave Chess Town?", LeaveTown.tsx); the town's back button and chat sign-up use it. */
  askLeave: (dest: string, go: () => void) => void;
  /** Away too long (town/afk.ts): out of the town, home, with "You've been dropped from the town". */
  onAway: () => void;
  /** A guest's town time is up and they tapped Sign up: out of the town to the app's sign-in. */
  onSignIn: () => void;
  onBossAlone: (id: string) => void;
  /** A boss with an intro challenged (Alfil, Big Boy, Babur, Puddles): start its battle under its transition; resolves once the battle shows. */
  onBossChallenge: (id: string, stand: Stand | null) => Promise<void>;
  /** The Hidden Boss's room's four go in (hidden-net.ts): the summoning has played to black; into his fight with your pass and seat. */
  onHiddenFight: (lobby: string, pass: string, seat: number, stand: Stand | null) => void;
  onPlayBot: (game: BotGameAsk) => void;
  /** A table's Ranked (Nov 27): you sit at that seat ("6.0") and the 1 v 1 search opens over the town. */
  onRanked: (seat: string) => void;
  /** A table's Spectate on a ranked game there: its spectator view; back to where you stood. */
  onWatchGame: (code: string, stand: Stand) => void;
  /** The search from a table is up over the town (it holds the away clock and the keys). */
  searching: boolean;
  onColosseum: () => void;
  seat: string | null;
  /** Back from a boss's challenge: where you stood as you challenged it. */
  stand: Stand | null;
  /** Back from a Battle Tower floor's match (PR 11b): the town opens in the tower (Town.tsx TowerBack). */
  tower: TowerBack | null;
  /** A phone's bar's Quests, Shop & crates and Friends (Nov 22): each opens over the town (App.tsx's town layer). */
  pages?: TownPages;
};
type Screen = FunctionComponent<Props & { framed: boolean }>;

/**
 * A computer: 1024 px wide or more with a mouse. The town sits in the front door's frame there (Eric, Oct 29), in the center
 * column's box, between the side menu and the live panel. A phone or a tablet (a tablet on its side included: touch) has the
 * whole screen, as it always had.
 */
export const COMPUTER = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

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
export function TownPage({ nav, layer, ...props }: Props & { nav: FrontNav; layer?: { page?: FrontPage; node: ComponentChildren } | null }) {
  const framed = useMedia(COMPUTER);
  const [Town, setTown] = useState<Screen | null>(null);
  useEffect(() => {
    let live = true;
    /** What the town didn't take of your pawn made ready (Town.tsx readyYou), given back as the page closes. */
    let release = () => {};
    // (No module when its chunk was gone after a deploy: the page is loading again, stale.ts.) The town shows once your pawn is ready on
    // its ride (Eric, Nov 10: "your rider doesnt appear for a few seconds"), or after a moment (TOWN_FEEL.youWaitMs) without it.
    const load = () =>
      void chunk(import("./Town.tsx")).then((m) => {
        if (!live || !m) return;
        const you = m.readyYou();
        release = you.done;
        // (In a task of its own: the town's start isn't added to the long task that composed your ride, Nov 10.)
        void you.ready.then(() => setTimeout(() => live && setTown(() => m.TownScreen)));
      });
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
        release();
        off();
        clearTimeout(timer);
      };
    }
    return () => {
      live = false;
      release();
    };
  }, []);
  // (Stockfish's workers end while the town is open and start again as it closes (engine.ts pauseEngines; Nov 27): nothing in the town
  // asks them anything, and back from a battle they were up to four of about 56 MB each beside the town's pictures on a phone, which
  // iOS reloads when a page runs out of memory.)
  useEffect(() => {
    let open = () => {};
    void pauseEngines(new Promise<void>((go) => (open = go)));
    return () => open();
  }, []);
  const screen = Town ? <Town {...props} framed={framed} /> : <div class="screen" />;
  return framed ? (
    // (`layer`: a side menu page over the town's middle column, the town under it as it was: App.tsx townLayer, Nov 22.)
    <FrontFrame page="town" nav={nav} layer={layer}>
      {screen}
    </FrontFrame>
  ) : (
    // (A phone's: the layer over the whole screen, PageLayer.tsx.)
    <>
      {screen}
      {layer?.node}
    </>
  );
}
