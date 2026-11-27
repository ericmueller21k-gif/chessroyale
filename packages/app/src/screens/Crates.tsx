import type { ComponentChildren, JSX } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  BOSS_CRATES,
  CRATES,
  MYTHIC_CRATE,
  FISCHER,
  XP,
  everyLevel,
  levelOf,
  ITEM_COLORS,
  GOD_KING_SHOP,
  PAWN_COLORS,
  PURITY_BANDS,
  sideOfPawn,
  SHOP_ITEMS,
  SLOT_NAMES,
  TIERS,
  bossCrateDef,
  crateDef,
  fischerOdds,
  isAdminCopy,
  hiddenByOutfit,
  isShiny,
  ownsOutfit,
  itemChance,
  liveStrip,
  presentChance,
  presentItems,
  itemColor,
  bannerPlusMs,
  itemDef,
  itemName,
  purity,
  rollBlemish,
  secondColor,
  stackItems,
  tierInfo,
  wornFromLocker,
  isPlayable,
  adminFirst,
  tokenBossName,
  tokenBosses,
  HUNCHESS_FINISH,
  WELCOME_CRATE,
  WELCOME_GIFT,
  WELCOME_TEXT,
  isHunchess,
  isWelcomeCrate,
  showsPurity,
  pickableBossCrates,
  bonusOddsLine,
  bonusPool,
  frameClass,
  type BonusRoll,
  type BossCrateDef,
  type CrateDef,
  type CrateLook,
  type CrateRoll,
  type ItemInstance,
  type ItemLook,
  type ItemSlot,
  type ItemStack,
  type PawnColor,
  type PresentTier,
} from "@chessroyale/core";
import { account, deleteLockerItems, equipLockerItem, equipShopItem, grantTestItems, myPawnColor, openCrate, pickBossCrate, setPawnColor, type OpenForce, type Opened } from "../account.ts";
import { TokenArt } from "../components/TokenArt.tsx";
import { Avatar, BetaCrateArt, HunchessBoxArt, HunchessCrateArt, ItemArt, KeyArt, MythicCrateArt, PresentArt, SupplyBoxArt, TranscendentArt, WinterCrateArt } from "../components/Items.tsx";
import { FightBanner } from "../components/FightBanner.tsx";
import { GamblingWarning } from "../components/GamblingWarning.tsx";
import { Confirm } from "../components/MatchMenu.tsx";
import { KingEffectPreview } from "../components/Cosmetics.tsx";
import { crateSoundsReady, play, unlockAudio, warmCrateSounds } from "../sound.ts";
import { BonusStage, CrateStage, OpenLayer } from "../crate-open/CrateOpenStage.tsx";
import { BONUS, STRIPS } from "../crate-open/timeline.ts";
import { useAccount } from "./Profile.tsx";
import { testParams } from "../test-switches.ts";
import { haptic } from "../haptics.ts";
import { welcomeResumeRow, welcomeRows, welcomeRowsShown, type WelcomeRowView } from "../welcome-rows.ts";
import { bossCratesShown, NO_BOSS_CRATES_LINE, readShowUnowned, saveShowUnowned } from "../boss-crate-rows.ts";
import { BoostCrateDialog, BoostCrateRow, BoostStock } from "../components/BoostCrate.tsx";

const tierIndex = (def: string) => TIERS.findIndex((t) => t.id === itemDef(def)?.tier);
const colorIndex = (c: string) => ITEM_COLORS.findIndex((x) => x.id === c);
/** FISCHER RANDOM!'s banner (ms): 2.5 s since Oct 15, and the banners' extra since Oct 24 (bannerPlusMs). */
const fischerBannerMs = () => 2500 + bannerPlusMs();
const pct = (x: number) => (x >= 0.01 ? `${(x * 100).toFixed(x >= 0.1 ? 0 : 1)}%` : `${(x * 100).toFixed(2)}%`);

/** An item's one-line finish: "Emerald · Purity 91.5%". */
/** Its color name (both, for a two-color item). */
type Colored = { def: string; color: string; color2?: string | null; seed: number };
/** An item's color, or both (two-color items, and the tube's second stripe color, which its seed gives). */
export const colorName = (it: Colored) => {
  const c2 = secondColor(it);
  return itemColor(it.color).name + (c2 ? ` & ${itemColor(c2).name}` : "");
};
export const finishLine = (it: Colored & { blemish: number }) => (showsPurity(it.def) ? `${colorName(it)} · Purity ${purity(it.blemish).toFixed(1)}%` : HUNCHESS_FINISH_NAME);
/** A HunChess ride's finish, in place of its color and purity (Eric, Nov 6: "Purity isn't listed for these"). */
const HUNCHESS_FINISH_NAME = "HunChess gold & black";

/** "Not tradeable" (Eric, Nov 6): on the Welcome Crate and its rides, wherever they show. */
export function NotTradeable() {
  return <span class="not-tradeable">{WELCOME_TEXT.notTradeable}</span>;
}

// ---------------- Crates ----------------

/**
 * How each crate looks: its own box on the crate page, and the box each tier comes in on the strip (Winter's
 * presents, Beta's supply boxes; Eric, Oct 11: only the container is new, everything else is reused).
 */
const CRATE_LOOKS: Record<CrateLook, { Crate: () => JSX.Element; Box: (p: { color: string }) => JSX.Element; box: string; boxes: string; lid: number }> = {
  // (`lid`: where the box's lid ends, as a share of its drawing's height: the opening's lid flies off there. The mockup's, measured.)
  winter: { Crate: WinterCrateArt, Box: PresentArt, box: "present", boxes: "Presents", lid: 0.46 },
  beta: { Crate: BetaCrateArt, Box: SupplyBoxArt, box: "supply box", boxes: "Supply boxes", lid: 0.36 },
  hunchess: { Crate: HunchessCrateArt, Box: HunchessBoxArt, box: "box", boxes: "Boxes", lid: 0.38 },
  // (The Mythic Crate, Nov 27: every opening a Transcendent spin, so no tier's box shows; its Box is the HunChess crate's.)
  mythic: { Crate: MythicCrateArt, Box: HunchessBoxArt, box: "box", boxes: "Transcendent", lid: 0.38 },
};

/**
 * A crate opened but not seen yet: the server rolled it, but you left during the spin (Eric, Oct 8). Kept on the
 * device (and in memory, if storage is off) until its reveal shows; coming back to the crates opens straight to it.
 */
type Unseen = { crate: string } & Opened;
const UNSEEN_KEY = "hunchess-crate-unseen";
let unseenHere: Unseen | null = null;
function setUnseen(u: Unseen | null) {
  unseenHere = u;
  try {
    if (u) localStorage.setItem(UNSEEN_KEY, JSON.stringify(u));
    else localStorage.removeItem(UNSEEN_KEY);
  } catch {
    // No storage (private mode): memory alone keeps it while the app is open.
  }
}
function getUnseen(): Unseen | null {
  try {
    const v = localStorage.getItem(UNSEEN_KEY);
    if (v) return JSON.parse(v) as Unseen;
  } catch {
    // Fall back to memory.
  }
  return unseenHere;
}

// "Colors and purity" opens by default; a player who closes it keeps it closed (Eric, Nov 27). Only the closed choice is stored.
const COLORS_CLOSED_KEY = "hunchess-crate-colors-closed";
function colorsClosedSaved(): boolean {
  try {
    return localStorage.getItem(COLORS_CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}
function setColorsClosedSaved(closed: boolean) {
  try {
    if (closed) localStorage.setItem(COLORS_CLOSED_KEY, "1");
    else localStorage.removeItem(COLORS_CLOSED_KEY);
  } catch {
    // No storage (private mode): it opens again next time, which is the default.
  }
}

/** A crate by its id: the Crates tab's own (a series crate: one you hold opens with a crate key, Nov 9), or a boss's (bought in its shop, picked at a level or won, held until you open it). */
const anyCrate = (id: string): CrateDef | undefined => crateDef(id) ?? bossCrateDef(id) ?? (isWelcomeCrate(id) ? WELCOME_CRATE : undefined);
const isBossCrate = (c: CrateDef): c is BossCrateDef => "boss" in c;
/** "Babur's", "Puddles'" (as his home's and his crate's names have it). */
const possessive = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);
/** How many of a crate your locker holds, unopened (a boss crate's, or since Nov 9 a series crate's). */
const heldOf = (locker: { bossCrates?: Record<string, number>; seriesCrates?: Record<string, number> } | undefined, c: CrateDef) =>
  locker?.bossCrates?.[c.id] ?? locker?.seriesCrates?.[c.id] ?? 0;
/** Your crate keys (none before the locker loads). */
const keysOf = (locker: { keys?: number | null } | undefined) => locker?.keys ?? 0;
/**
 * The test switches ?fischer and ?shiny for a crate's roll (Nov 9): only where the server's TEST_SWITCHES is "1" (local, e2e,
 * staging) or on the dev server, never an admin's elsewhere (Eric: no admin special ability for opening). The server checks too.
 */
const crateSwitchesHere = () => import.meta.env.DEV || !!account().config?.testSwitches;

/** A crate's name with its series on a line of its own ("Beta Crate", then "Series 001"): no line ends on the " · ". */
function CrateName({ name }: { name: string }) {
  const [head, series] = name.split(" · ");
  return (
    <>
      {head}
      {series && (
        <>
          {" "}
          <span class="crate-series">{series}</span>
        </>
      )}
    </>
  );
}

/** Your crates and keys, and each crate's page: what's inside and the odds, and the button to open one. */
export function CratesPanel() {
  const { profile } = useAccount();
  const locker = profile?.locker;
  // A crate you left during its spin opens straight to its reveal (unless that item's gone, e.g. deleted).
  const [resume] = useState(() => {
    const u = getUnseen();
    if (!u || !anyCrate(u.crate) || (locker && !locker.items.some((i) => i.id === u.item.id))) return null;
    return u;
  });
  const [open, setOpen] = useState<CrateDef | null>(() => (resume && !isWelcomeCrate(resume.crate) ? anyCrate(resume.crate)! : null));
  // The Welcome Crate row open (1 or 2); an unseen one's reveal resumes on its own row.
  const [resumeRow] = useState<number | null>(() => (resume && isWelcomeCrate(resume.crate) ? welcomeResumeRow(welcomeRowsNow(profile)) : null));
  const [welcomeOpen, setWelcomeOpen] = useState<number | null>(resumeRow);
  const welcome = welcomeRowsNow(profile);
  // A crate's page opens at its top (you may have scrolled the list down to its row: its hero and the gambling ring show first).
  useEffect(() => {
    if (open || welcomeOpen !== null) window.scrollTo(0, 0);
  }, [open, welcomeOpen]);
  const count = (n: number | null | undefined) => String(n ?? 0);
  const [picking, setPicking] = useState(false);
  const [showUnowned, setShowUnowned] = useState(readShowUnowned);
  // (The coin boost, Nov 26: its crate's dialog over the page.)
  const [boostOpen, setBoostOpen] = useState(false);
  if (picking) return <BossPickPage onBack={() => setPicking(false)} />;
  if (open) return <CratePage crate={open} resume={resume?.crate === open.id ? resume : undefined} onBack={() => setOpen(null)} />;
  if (welcomeOpen !== null) {
    const row = welcome.find((r) => r.n === welcomeOpen)!;
    return <WelcomePage row={row} resume={resumeRow !== null && welcomeOpen === resumeRow ? (resume ?? undefined) : undefined} onBack={() => setWelcomeOpen(null)} />;
  }
  // The page, top to bottom (Eric, Nov 25: "refactor this page a bit"; docs/decisions/2026-11-25-crates-page-tidy.md): your keys and
  // crates; Ready to open (every crate you can open now: Welcome Crates still to open, the crates you hold, a boss crate to choose); your
  // boss tokens; More crates (the rest: each opens its page, odds and contents); and, admins only, the test grants at the very bottom.
  // Each crate is in one place: Ready to open while you hold it, More crates otherwise.
  const unseen = getUnseen();
  const welcomeShown = welcomeRowsShown(welcome, unseen && isWelcomeCrate(unseen.crate) ? welcomeResumeRow(welcome) : null);
  const bosses = BOSS_CRATES.filter((c) => profile?.admin || heldOf(locker, c) > 0 || !adminFirst({ id: c.boss }));
  const heldBoss = bossCratesShown(bosses, (c) => heldOf(locker, c), false);
  // ("Show unowned" (Nov 24) now covers the boss crates you don't hold, in More crates: the ones you hold are under Ready to open.)
  const moreBoss = showUnowned ? bosses.filter((c) => heldOf(locker, c) === 0) : [];
  const picks = locker?.bossPicks ?? 0;
  const pickRow = <BossPickRow picks={picks} onOpen={() => setPicking(true)} />;
  const readyWelcome = welcomeShown.filter((r) => r.state === "ready");
  const heldSeries = [...CRATES, MYTHIC_CRATE].filter((c) => heldOf(locker, c) > 0);
  const boostCrates = locker?.boostCrates ?? 0;
  const boostRow = <BoostCrateRow held={boostCrates} onOpen={() => setBoostOpen(true)} />;
  const nothingReady = !readyWelcome.length && !heldSeries.length && !heldBoss.length && !picks && !boostCrates;
  const welcomeRow = (row: WelcomeRowView) => <WelcomeRow key={`w${row.n}`} row={row} onOpen={() => setWelcomeOpen(row.n)} />;
  const seriesRow = (c: CrateDef) => <SeriesCrateRow key={c.id} crate={c} held={heldOf(locker, c)} keys={keysOf(locker)} onOpen={() => setOpen(c)} />;
  const bossRow = (c: BossCrateDef) => <BossCrateRow key={c.id} crate={c} held={heldOf(locker, c)} onOpen={() => setOpen(c)} />;
  return (
    <div class="crates">
      <GamblingWarning />
      <div class="crate-stock">
        <span class="stock">
          <span class="stock-art">
            <KeyArt />
          </span>
          Keys × {count(locker?.keys)}
        </span>
        <span class="stock">Crates × {count(locker?.crates)}</span>
      </div>
      <BoostStock minutes={locker?.boostMinutes ?? 0} levels={locker?.crateBonus ?? 0} />
      <section class="crates-section crates-ready" aria-label="Ready to open">
        <h3 class="ff-title">Ready to open</h3>
        {readyWelcome.map(welcomeRow)}
        {picks > 0 && pickRow}
        {heldSeries.map(seriesRow)}
        {boostCrates > 0 && boostRow}
        {heldBoss.map(bossRow)}
        {nothingReady && <p class="small muted crates-none">Nothing to open right now.</p>}
      </section>
      <TokenStock tokens={locker?.tokens ?? {}} admin={!!profile?.admin} />
      <section class="crates-section crates-more" aria-label="More crates">
        {/* "More crates" and its "Show unowned" box on one line (Nov 24's box, Nov 25's section). */}
        <div class="boss-crates-head">
          <h3 class="ff-title">More crates</h3>
          <label class="show-unowned">
            <input
              type="checkbox"
              checked={showUnowned}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                setShowUnowned(on);
                saveShowUnowned(on);
              }}
            />
            Show unowned
          </label>
        </div>
        {/* Welcome Crates still to earn (their meters filling), then the series crates you don't hold (greyed, a padlock: shown, not
            hidden, their pages still show what's inside), the boss crate choice with none to choose (greyed), and with "Show unowned"
            every boss crate you don't hold. */}
        {welcomeShown.filter((r) => r.state !== "ready").map(welcomeRow)}
        {CRATES.filter((c) => heldOf(locker, c) === 0).map(seriesRow)}
        {/* (The Mythic Crate, Nov 27: always listed while you hold none, greyed with a padlock as the series crates, never behind "Show
            unowned": nothing hidden (Eric's rule; the boss crates are his one exception, Nov 24). Its page shows its odds. Right after the series crates, so ticking "Show
            unowned" moves only what is below the boss rows.) */}
        {heldOf(locker, MYTHIC_CRATE) === 0 && seriesRow(MYTHIC_CRATE)}
        {boostCrates === 0 && boostRow}
        {picks === 0 && pickRow}
        {/* (A boss in the game for admins first, Timber: his crate on an admin's list only, or one you hold.) */}
        {moreBoss.map(bossRow)}
        {!showUnowned && <p class="small muted no-boss-crates">{heldBoss.length ? MORE_BOSS_CRATES_LINE : NO_BOSS_CRATES_LINE}</p>}
        <p class="small muted crates-how">
          Each crate opens with a crate key. Crates and keys come from leveling up and the daily reward, and an opening sometimes gives a bonus crate (with its key if it needs one). A daily quest
          sometimes gives a Coin Boost Crate (no key needed) or a Crate Bonus.
        </p>
      </section>
      {boostOpen && <BoostCrateDialog held={boostCrates} minutes={locker?.boostMinutes ?? 0} onClose={() => setBoostOpen(false)} />}
      {/* (Admins only, at the very bottom: the page above it is what every player sees. Eric, Nov 25.) */}
      {profile?.admin && <AdminGrants />}
    </div>
  );
}

/** "Check Show unowned" when the boss crates you hold are all under Ready to open. */
const MORE_BOSS_CRATES_LINE = "Check Show unowned to see the boss crates you don't have.";

/** A series crate's row (Nov 9): how many you hold; a padlock while it can't be opened (none held, or no key), greyed at none. */
function SeriesCrateRow({ crate: c, held: n, keys, onOpen }: { crate: CrateDef; held: number; keys: number; onOpen: () => void }) {
  const { Crate } = CRATE_LOOKS[c.look];
  const locked = !n || !keys;
  return (
    <button type="button" class={`ff-window crate-row series-crate-row${n ? "" : " none"}${locked ? " locked" : ""}`} data-crate={c.id} data-held={n} onClick={onOpen}>
      <span class="crate-row-art">
        <Crate />
        {locked && (
          <span class="welcome-lock crate-lock">
            <Padlock />
          </span>
        )}
      </span>
      <span class="crate-row-text">
        <strong>
          <CrateName name={c.name} />
        </strong>
        <span class="crate-row-blurb">{c.blurb}</span>
        <span class="crate-row-held">{n ? `You have ${n} · ${c.items.length} items` : `You have none · ${c.items.length} items`}</span>
      </span>
      <span class="ff-cursor" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}

/** A boss crate's row (Eric, Nov 2: bought in its boss's shop, held until opened here): its boss's token on the corner, greyed at none. */
function BossCrateRow({ crate: c, held: n, onOpen }: { crate: BossCrateDef; held: number; onOpen: () => void }) {
  const { Crate } = CRATE_LOOKS[c.look];
  return (
    <button type="button" class={`ff-window crate-row boss-crate-row${n ? "" : " none"}`} data-crate={c.id} data-held={n} onClick={onOpen}>
      <span class="crate-row-art">
        <Crate />
        <span class="crate-row-token">
          <TokenArt boss={c.boss} />
        </span>
      </span>
      <span class="crate-row-text">
        <strong>{c.name}</strong>
        <span class="crate-row-blurb">{c.blurb}</span>
        <span class="crate-row-held">{n ? `You have ${n}` : "You have none"}</span>
      </span>
      <span class="ff-cursor" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}

/** Where the Welcome Crates are (the locker's `welcome`; none earned yet for a guest or before the locker loads). */
const welcomeOf = (profile: ReturnType<typeof useAccount>["profile"]) =>
  profile?.locker?.welcome ?? { games: 0, next: WELCOME_GIFT.milestones[0] as number | null, unopened: 0, status: "locked" as const, notice: false };
/** Both Welcome Crate rows (Eric, Nov 6), from the account's locker: the rides in it are the HunChess ones (welcome-rows.ts). */
const welcomeRowsNow = (profile: ReturnType<typeof useAccount>["profile"]): WelcomeRowView[] => {
  const rides = (profile?.locker?.items ?? []).filter((i) => isHunchess(i.def)).map((i) => ({ id: i.id, def: i.def }));
  return welcomeRows(welcomeOf(profile), !!profile?.user.signedIn, rides);
};

/** A Welcome Crate's meter: its bar filling, and "3/5" beside it (full at ready and opened). */
function WelcomeMeter({ row }: { row: WelcomeRowView }) {
  return (
    <span class="welcome-meter" role="progressbar" aria-label={`Welcome Crate ${row.n} progress`} aria-valuemin={0} aria-valuemax={row.milestone} aria-valuenow={row.done}>
      <span class="welcome-bar">
        <span class="welcome-bar-fill" style={{ width: `${Math.round(row.fill * 100)}%` }} />
      </span>
      <span class="welcome-meter-text">{row.meter}</span>
    </span>
  );
}

/** The padlock on a locked crate (drawn in a 24-unit box). */
function Padlock() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="welcome-lock-icon">
      <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
      <rect x="4" y="10" width="16" height="11" rx="2.5" fill="currentColor" />
    </svg>
  );
}

/**
 * One of the two Welcome Crate rows in the Crates tab (Eric, Nov 6), both there from the start for every player (shown, not hidden):
 * the gold-and-black crate, its name, "Thank you for being an early tester!", "Not tradeable", its own meter and its state: locked (a
 * padlock, greyed a little: "Finish 5 games to unlock"; a guest's "Sign in to earn"), ready ("Ready"), or opened ("Opened" and its ride).
 */
function WelcomeRow({ row, onOpen }: { row: WelcomeRowView; onOpen: () => void }) {
  return (
    <button type="button" class={`ff-window crate-row welcome-crate-row ${row.state}`} data-crate={WELCOME_CRATE.id} data-welcome={row.state} data-welcome-n={row.n} onClick={onOpen}>
      <span class="crate-row-art">
        <HunchessCrateArt />
        {row.state === "locked" && (
          <span class="welcome-lock">
            <Padlock />
          </span>
        )}
      </span>
      <span class="crate-row-text">
        <strong>Welcome Crate {row.n}</strong>
        <span class="crate-row-blurb welcome-thanks">{WELCOME_TEXT.thanks}</span>
        <WelcomeMeter row={row} />
        <span class="crate-row-held welcome-progress">{row.line}</span>
        {row.ride && <span class="small">{itemDef(row.ride.def)?.name}</span>}
        <span>
          <NotTradeable />
        </span>
      </span>
      <span class="ff-cursor" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}

/**
 * Your boss tokens (Nov 2, shops round 2), beside your keys and crates: every live boss's token with how many you have (greyed at
 * none: shown, not hidden), and any other boss's you hold (an admin's: Timber's, for admins first). From boss battles; spent on a
 * boss's crate in its shop in the town.
 */
function TokenStock({ tokens, admin }: { tokens: Record<string, number>; admin: boolean }) {
  const bosses = tokenBosses().filter((b) => admin || !!tokens[b.id] || isPlayable(b));
  return (
    <section class="token-stock" aria-label="Boss tokens">
      <h3 class="ff-title">Boss tokens</h3>
      <div class="token-grid">
        {bosses.map((b) => {
          const n = tokens[b.id] ?? 0;
          return (
            <span key={b.id} class={`token-cell${n ? "" : " none"}`} data-boss={b.id} title={`${tokenBossName(b.id)} token`}>
              <TokenArt boss={b.id} />
              <span class="token-count">× {n}</span>
            </span>
          );
        })}
      </div>
      <p class="small muted">From boss battles. Spend them on a boss's crate in its shop in the town.</p>
    </section>
  );
}

/**
 * A level's boss crate to choose (Nov 9: every XP.bossCrateEvery-th level, 20th since Nov 20), always there (shown, not hidden): greyed with none to choose, "Choose your
 * boss crate" when one waits. Its page lists the live bosses' crates.
 */
function BossPickRow({ picks, onOpen }: { picks: number; onOpen: () => void }) {
  const [first] = pickableBossCrates();
  const Crate = first ? CRATE_LOOKS[first.look].Crate : BetaCrateArt;
  return (
    <button type="button" class={`ff-window crate-row boss-pick-row${picks ? "" : " none"}`} data-picks={picks} onClick={onOpen}>
      <span class="crate-row-art">
        <Crate />
      </span>
      <span class="crate-row-text">
        <strong>{picks ? (picks === 1 ? "Choose your boss crate" : `Choose your ${picks} boss crates`) : "Boss crate choice"}</strong>
        <span class="crate-row-blurb">Every {XP.bossCrateEvery}th level, you pick a boss's crate. It opens without tokens or a key.</span>
        <span class="crate-row-held">{picks ? `${picks} to choose` : "None to choose"}</span>
      </span>
      <span class="ff-cursor" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}

/** Choosing a level's boss crate (Nov 9): every live boss's crate, each a tap (greyed with none to choose); the answer under them. */
function BossPickPage({ onBack }: { onBack: () => void }) {
  const picks = useAccount().profile?.locker?.bossPicks ?? 0;
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const choose = (c: BossCrateDef) => {
    setBusy(true);
    setSaid(null);
    unlockAudio();
    play("menuSelect");
    void pickBossCrate(c.id)
      .then(() => setSaid(`${c.name} is in your inventory.`))
      .catch((e: unknown) => setSaid(e instanceof Error ? e.message : "Something went wrong."))
      .finally(() => setBusy(false));
  };
  return (
    <div class="crate-page boss-pick-page">
      <button type="button" class="btn btn-secondary btn-small" onClick={onBack}>
        ‹ Crates
      </button>
      <h3 class="ff-title">{picks ? (picks === 1 ? "Choose your boss crate" : `Choose your ${picks} boss crates`) : "Boss crate choice"}</h3>
      <p class="small muted">
        Every {XP.bossCrateEvery}th level gives you a boss crate: pick whose. It goes into your boss crates and opens like any of them,
        without tokens or a key.
      </p>
      <p class="small boss-pick-said" aria-live="polite">
        {said ?? (picks ? `${picks} to choose.` : `None to choose. Your next is at level ${Math.ceil((levelNow() + 1) / XP.bossCrateEvery) * XP.bossCrateEvery}.`)}
      </p>
      <div class="boss-pick-grid">
        {pickableBossCrates().map((c) => {
          const { Crate } = CRATE_LOOKS[c.look];
          return (
            <button type="button" key={c.id} class="ff-window boss-pick" data-crate={c.id} disabled={!picks || busy} onClick={() => choose(c)}>
              <span class="crate-row-art">
                <Crate />
                <span class="crate-row-token">
                  <TokenArt boss={c.boss} />
                </span>
              </span>
              <span class="boss-pick-name">{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
/** Your level now (the profile's XP). */
const levelNow = () => levelOf(account().profile?.xp ?? 0);

/** Admins only: test grants to yourself (crate keys, any boss's tokens), for trying the boss crates (the server checks it's you). */
function AdminGrants() {
  const [boss, setBoss] = useState("tiger");
  // (Nov 25, Eric: "how do I get more crates?": any series crate or boss crate, 5 at a time.)
  const [crate, setCrate] = useState(CRATES[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const give = (body: { keys?: number; boss?: string; tokens?: number; crate?: string; crates?: number; boost?: number; crateBonus?: number }) => {
    setBusy(true);
    setError(null);
    void grantTestItems(body)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong."))
      .finally(() => setBusy(false));
  };
  return (
    <section class="admin-grants" aria-label="Admin test grants">
      <strong>Admin: test grants</strong>
      <div class="admin-grants-row">
        <button type="button" class="btn btn-secondary btn-small" disabled={busy} onClick={() => give({ keys: 1 })}>
          +1 crate key
        </button>
        {/* (Eric, Nov 9: up to 100 keys at once, now that every crate takes one: BOSS_TOKENS.keysGrantMax.) */}
        <button type="button" class="btn btn-secondary btn-small" disabled={busy} onClick={() => give({ keys: 100 })}>
          +100 crate keys
        </button>
      </div>
      <div class="admin-grants-row">
        <select aria-label="Boss" value={boss} onChange={(e) => setBoss((e.target as HTMLSelectElement).value)}>
          {tokenBosses().map((b) => (
            <option key={b.id} value={b.id}>
              {tokenBossName(b.id)}
            </option>
          ))}
        </select>
        <button type="button" class="btn btn-secondary btn-small" disabled={busy} onClick={() => give({ boss, tokens: 1 })}>
          +1 token
        </button>
        <button type="button" class="btn btn-secondary btn-small" disabled={busy} onClick={() => give({ boss, tokens: 3 })}>
          +3 tokens
        </button>
      </div>
      <div class="admin-grants-row">
        <select aria-label="Crate" value={crate} onChange={(e) => setCrate((e.target as HTMLSelectElement).value)}>
          {[...CRATES, MYTHIC_CRATE, ...BOSS_CRATES].map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" class="btn btn-secondary btn-small" disabled={busy || !crate} onClick={() => give({ crate, crates: 5 })}>
          +5 crates
        </button>
      </div>
      {/* (The coin boost, Nov 26: what a daily quest drops, to test the Crates tab and a boosted game.) */}
      <div class="admin-grants-row">
        <button type="button" class="btn btn-secondary btn-small" disabled={busy} onClick={() => give({ boost: 1 })}>
          +1 Coin Boost Crate
        </button>
        <button type="button" class="btn btn-secondary btn-small" disabled={busy} onClick={() => give({ crateBonus: 1 })}>
          +1 Crate Bonus
        </button>
      </div>
      {error && <p class="shop-error">{error}</p>}
    </section>
  );
}

function CratePage({ crate, resume, onBack }: { crate: CrateDef; resume?: Unseen; onBack: () => void }) {
  // A boss crate opens only one you hold (the server's, once each), never with a test switch; a series crate one you hold, with a key.
  const boss = isBossCrate(crate) ? crate : null;
  const { profile } = useAccount();
  const locker = profile?.locker;
  // (An admin's bonus pool has the bosses not yet released too, as the server rolls it: bonusPool(admin). #923's review, Nov 25.)
  const admin = !!profile?.admin;
  const held = heldOf(locker, crate);
  const keys = keysOf(locker);
  const canOpen = boss ? held > 0 : held > 0 && keys > 0;
  const [peek, openPeek] = usePeek();
  // Test switches (the server checks too): ?fischer=1, ?shiny=1 force the roll, until changed with the boxes below; only where the
  // server's TEST_SWITCHES is on (crateSwitchesHere). (Read on every render: whether you may is known once the config is.)
  const [fischerSet, setForceFischer] = useState<boolean | null>(null);
  const [shinySet, setForceShiny] = useState<boolean | null>(null);
  const forceFischer = crateSwitchesHere() && (fischerSet ?? testParams().get("fischer") === "1");
  const forceShiny = crateSwitchesHere() && (shinySet ?? testParams().get("shiny") === "1");
  // (?bonus=1: a bonus crate for sure, its crate rolled; ?bonus=<crate id>: that one; ?bonus=0 or none: no bonus. Nov 24.)
  const [bonusSet, setForceBonus] = useState<boolean | null>(null);
  const bonusParam = testParams().get("bonus") === "0" ? null : testParams().get("bonus");
  const forceBonus: true | string | undefined = !crateSwitchesHere()
    ? undefined
    : bonusSet === false
      ? undefined
      : bonusSet === true
        ? (bonusParam && bonusParam !== "1" ? bonusParam : true)
        : bonusParam === "1"
          ? true
          : bonusParam || undefined;
  const bonusHeld = locker?.bonusCrates?.[crate.id] ?? 0;
  // (How many of them are bonus ones: "You have 2 (1 bonus)". Nov 24.)
  const heldWords = `${held}${bonusHeld ? ` (${bonusHeld} bonus)` : ""}`;
  const [opening, setOpening] = useState(!!resume);
  // The pop-up a tap on the crate's art asks first (Open this crate?), shown only when the crate can open.
  const [askOpen, setAskOpen] = useState(false);
  // (Read once, on mount: the player's own taps change the open panel after that, never a re-render.)
  const [colorsOpen, setColorsOpen] = useState(() => !colorsClosedSaved());
  // (The opening's sounds made ahead in the sound worker as its page opens, once sound is on: before the Open's tap.)
  useEffect(() => warmCrateSounds(), []);
  // Escape closes the pop-up, and only it: captured here so the shop's own Escape (back) doesn't also run.
  useLayoutEffect(() => {
    if (!askOpen) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setAskOpen(false);
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [askOpen]);
  // The Open: a tap on the button or the pop-up's Open, the same.
  const startOpen = () => {
    // (A tap: the moment a phone allows sound, so the strip's clicks are heard.)
    unlockAudio();
    play("menuSelect");
    setOpening(true);
  };
  const look = CRATE_LOOKS[crate.look];
  // Commonest first; Legendary and Mythic (Fischer Random) last.
  const items = [...crate.items].sort((a, b) => tierIndex(a) - tierIndex(b));
  return (
    <div class="crate-page">
      {peek}
      {/* (The opening on its own layer over this page, which stays as it is under it: Nov 24.) */}
      {opening && (
        <CrateOpening
          crate={crate}
          force={boss ? {} : { fischer: forceFischer, shiny: forceShiny, ...(forceBonus ? { bonus: forceBonus } : {}) }}
          resume={resume}
          onClose={() => setOpening(false)}
        />
      )}
      <GamblingWarning />
      <button type="button" class="btn btn-secondary btn-small" onClick={onBack}>
        ‹ Crates
      </button>
      <div class="ff-window crate-hero">
        {canOpen ? (
          <button type="button" class="crate-hero-art crate-art-btn" aria-label="Open this crate" onClick={() => setAskOpen(true)}>
            <look.Crate />
          </button>
        ) : (
          <span class="crate-hero-art">
            <look.Crate />
          </span>
        )}
        <strong>
          <CrateName name={crate.name} />
        </strong>
        <span class="small">{crate.blurb}</span>
        {boss ? (
          <span class="small crate-held" data-held={held}>
            {held ? `You have ${heldWords}.` : `You have none. ${possessive(tokenBossName(boss.boss))} shop in the town sells it.`}
          </span>
        ) : (
          <span class="small crate-held" data-held={held} data-keys={keys}>
            {!held
              ? crate.id === MYTHIC_CRATE.id
                ? "You have none. None can be earned yet: it will come with the shop's bundles."
                : "You have none. Leveling up and the daily reward give you crates."
              : !keys
                ? `You have ${heldWords}. You need a crate key to open one: ${everyLevel(XP.levelRewardEvery)} gives you one.`
                : `You have ${heldWords}, and ${keys} ${keys === 1 ? "key" : "keys"}.`}
          </span>
        )}
      </div>
      {/* (Greyed with none to open, or a series crate with no key: shown, not hidden. Full width, under the crate: Eric, Nov 27.) */}
      <button type="button" class="ff-button crate-open-btn" disabled={!canOpen} onClick={startOpen}>
        {boss ? "▶ Open" : "▶ Open · uses 1 key"}
      </button>
      {askOpen && (
        <div class="crate-confirm-overlay" onClick={() => setAskOpen(false)}>
          <Confirm
            heading="Open this crate?"
            note={boss ? `You have ${heldWords}.` : "It uses 1 crate key."}
            go="Open"
            onCancel={() => setAskOpen(false)}
            onGo={() => {
              setAskOpen(false);
              startOpen();
            }}
          />
        </div>
      )}
      <h3 class="ff-title">{look.boxes}</h3>
      <p class="small muted">
        {liveStrip(crate).every((x) => x.tier === FISCHER)
          ? "Every one opens to a Transcendent spin: a Legendary or Mythic item."
          : `The crate holds a ${look.box} for each tier, in its color. A ${look.box} opens to one of its tier's items, each as likely as the others.`}
      </p>
      <div class="odds-list">
        {liveStrip(crate).map(({ tier }) => {
          if (tier === FISCHER)
            return (
              <div key={tier} class="odds-row" style={{ "--tier": "#fbbf24" }}>
                <span class="odds-art">
                  <TranscendentArt />
                </span>
                <span class="odds-text">
                  <strong>Transcendent</strong>
                  <span class="odds-tier">{liveStrip(crate).every((x) => x.tier === FISCHER) ? "Legendary or Mythic" : "A second spin: Legendary or Mythic"}</span>
                </span>
                <span class="odds-pct">{pct(presentChance(crate, tier))}</span>
              </div>
            );
          const t = tierInfo(tier);
          const n = presentItems(crate, tier).length;
          return (
            <div key={tier} class="odds-row" style={{ "--tier": t.color }}>
              <span class="odds-art">
                <look.Box color={t.color} />
              </span>
              <span class="odds-text">
                <strong>
                  {t.name} {look.box}
                </strong>
                <span class="odds-tier">{n === 1 ? "1 item" : `${n} items, ${pct(presentChance(crate, tier) / n)} each`}</span>
              </span>
              <span class="odds-pct">{pct(presentChance(crate, tier))}</span>
            </div>
          );
        })}
      </div>
      {/* The bonus crate (Nov 24): one plain line, the same as the FAQ's (core bonusOddsLine). */}
      <p class="small muted crate-bonus-odds">{bonusOddsLine(undefined, bonusPool(admin).length)}</p>
      <h3 class="ff-title">Possible items</h3>
      <div class="odds-list">
        {items.map((def) => {
          const d = itemDef(def)!;
          const t = tierInfo(d.tier);
          const special = d.tier === "legendary" || d.tier === "mythic";
          const finish = { def, color: "red", color2: "emerald", blemish: 12, seed: 1 };
          return (
            <button type="button" key={def} class="odds-row odds-item" style={{ "--tier": t.color }} aria-label={`Preview ${d.name}`} onClick={() => openPeek(finish)}>
              <span class={`odds-art${frameClass(d.tier)}`}>
                <ItemArt def={def} finish={finish} />
                <PeekIcon />
              </span>
              <span class="odds-text">
                <strong>{d.name}</strong>
                <span class="odds-tier">
                  {t.name} · {SLOT_NAMES[d.slot]}
                  {special ? " · Transcendent only" : ""}
                </span>
              </span>
              <span class="odds-pct">{pct(itemChance(crate, def))}</span>
            </button>
          );
        })}
      </div>
      {/* (Saved as it's tapped, not in the details' toggle event: that one comes a moment later, and leaving the page first lost the
          choice: main's run 45954591183.) */}
      <details class="odds-more" open={colorsOpen}>
        <summary
          onClick={(e) => {
            e.preventDefault();
            setColorsOpen(!colorsOpen);
            setColorsClosedSaved(colorsOpen);
          }}
        >
          Colors and purity
        </summary>
        <p class="small">Every item also rolls a color and a purity, 0-100%. The lower its purity, the more it's blotched (at 0%, all over: one color, a shade darker). At 90% or more it's shiny ✨ (about 1 in 250). Exactly 100% and exactly 0% are each 1 in 5,000.</p>
        <div class="color-odds">
          {ITEM_COLORS.map((c) => (
            <span key={c.id} class="color-chip">
              <i style={{ background: c.hex2 ? `linear-gradient(135deg, ${c.hex}, ${c.hex2}, ${c.hex})` : c.hex }} />
              {c.name} {c.weight}%
            </span>
          ))}
        </div>
        <div class="color-odds">
          {PURITY_BANDS.map((b) => (
            <span key={b.low} class="color-chip">
              {b.low === b.high ? `Purity ${b.low}%: about 1 in ${Math.round(100 / b.weight).toLocaleString("en-US")}` : `Purity ${b.low}-${b.high}%${b.low >= 90 ? " ✨" : ""}: ${b.weight}%`}
            </span>
          ))}
        </div>
      </details>
      {!boss && crateSwitchesHere() && (
        <div class="test-switches">
          <span class="muted small">Testing:</span>
          <label class="check small">
            <input type="checkbox" checked={forceFischer} onChange={(e) => setForceFischer(e.currentTarget.checked)} /> Land on Transcendent
          </label>
          <label class="check small">
            <input type="checkbox" checked={forceShiny} onChange={(e) => setForceShiny(e.currentTarget.checked)} /> Shiny
          </label>
          <label class="check small">
            <input type="checkbox" checked={!!forceBonus} onChange={(e) => setForceBonus(e.currentTarget.checked)} /> Bonus crate
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * A Welcome Crate's page (Eric, Nov 6): the crate, its name, "Thank you for being an early tester!", "Not tradeable", its meter and state
 * ("Finish 5 games to unlock", "Ready", "Opened" with its ride), and every ride it can give (each as likely), in the HunChess colorway,
 * with no purity anywhere. "▶ Open" opens a ready one (greyed until then, and once it's opened), with the Crates tab's own strip and reveal.
 */
function WelcomePage({ row, resume, onBack }: { row: WelcomeRowView; resume?: Unseen; onBack: () => void }) {
  const [opening, setOpening] = useState(!!resume);
  const [peek, openPeek] = usePeek();
  useEffect(() => warmCrateSounds(), []);
  return (
    <div class="crate-page welcome-page">
      {peek}
      {opening && <CrateOpening crate={WELCOME_CRATE} force={{}} resume={resume} onClose={() => setOpening(false)} />}
      <button type="button" class="btn btn-secondary btn-small" onClick={onBack}>
        ‹ Crates
      </button>
      <div class={`ff-window crate-hero welcome-crate-hero ${row.state}`}>
        <span class="crate-hero-art">
          <HunchessCrateArt />
          {row.state === "locked" && (
            <span class="welcome-lock">
              <Padlock />
            </span>
          )}
        </span>
        <strong>Welcome Crate {row.n}</strong>
        <span class="small welcome-thanks">{WELCOME_TEXT.thanks}</span>
        <NotTradeable />
        <WelcomeMeter row={row} />
        <span class="small crate-held welcome-progress" data-welcome={row.state}>
          {row.line}
        </span>
        {row.ride && <span class="small">{itemDef(row.ride.def)?.name}</span>}
      </div>
      <button
        type="button"
        class="ff-button crate-open-btn"
        disabled={row.state !== "ready"}
        onClick={() => {
          unlockAudio();
          play("menuSelect");
          setOpening(true);
        }}
      >
        ▶ Open
      </button>
      <p class="small muted">
        Two per account: Welcome Crate 1 for finishing {WELCOME_GIFT.milestones[0]} games in any mode or against any boss, Welcome Crate 2 at{" "}
        {WELCOME_GIFT.milestones[1]}. Each holds one ride, any of the game's rides, each as likely (the second never the first's), in HunChess
        gold and black. They and their rides can't be traded.
      </p>
      <h3 class="ff-title">Possible rides</h3>
      <div class="odds-list">
        {WELCOME_CRATE.items.map((def) => {
          const d = itemDef(def)!;
          const finish = { def, ...HUNCHESS_FINISH, seed: 1 };
          return (
            <button type="button" key={def} class="odds-row odds-item" style={{ "--tier": "#f2c14e" }} aria-label={`Preview ${d.name}`} onClick={() => openPeek(finish)}>
              <span class={`odds-art${frameClass(d.tier)}`}>
                <ItemArt def={def} finish={finish} />
                <PeekIcon />
              </span>
              <span class="odds-text">
                <strong>{d.name}</strong>
                <span class="odds-tier">Ride · HunChess gold & black</span>
              </span>
              <span class="odds-pct">{pct(1 / WELCOME_CRATE.items.length)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Opening ----------------

type Tile =
  | { kind: "item"; def: string; finish: { color: string; color2?: string; blemish: number; seed: number } }
  | { kind: "present"; tier: PresentTier }
  | { kind: "fischer" };

function pickWeighted<T extends { weight: number }>(list: readonly T[]): T {
  let r = Math.random() * list.reduce((s, x) => s + x.weight, 0);
  for (const x of list) if ((r -= x.weight) < 0) return x;
  return list[list.length - 1]!;
}

/** A decoy's look, by the real color and purity odds (so the strip doesn't make a shiny look common). */
const decoyFinish = () => ({ color: pickWeighted(ITEM_COLORS).id, color2: pickWeighted(ITEM_COLORS).id, blemish: rollBlemish(Math.random), seed: Math.floor(Math.random() * 2 ** 31) });

/** A strip of tiles: decoys drawn by `pick`, the result at `land`. */
function stripTiles(pick: () => Tile, landTile: Tile, length: number, land: number): Tile[] {
  return Array.from({ length }, (_, i) => (i === land ? landTile : pick()));
}

/** The crate's strip: presents by the odds, Fischer Random a little more often than it lands (to tease). */
const presentTile = (crate: CrateDef) => (): Tile => {
  const { tier } = pickWeighted(liveStrip(crate).map((x) => (x.tier === FISCHER ? { ...x, weight: x.weight * 3 } : x)));
  return tier === FISCHER ? { kind: "fischer" } : { kind: "present", tier };
};
/** A second spin's decoys: items by their odds. */
const itemTile = (list: readonly { item: string; weight: number }[]) => (): Tile => {
  const def = pickWeighted(list).item;
  // (A HunChess ride's decoy in its own finish: no blotches, no other colors.)
  return { kind: "item", def, finish: isHunchess(def) ? { ...HUNCHESS_FINISH, seed: 1 } : decoyFinish() };
};

function TileView({ tile, look }: { tile: Tile; look: CrateLook }) {
  if (tile.kind === "fischer") {
    return (
      <span class="spin-tile fischer">
        <TranscendentArt />
        <span class="spin-tile-name">Transcendent</span>
      </span>
    );
  }
  if (tile.kind === "present") {
    const t = tierInfo(tile.tier);
    const { Box } = CRATE_LOOKS[look];
    return (
      <span class="spin-tile present" style={{ "--tier": t.color }}>
        <Box color={t.color} />
        <span class="spin-tile-name">{t.name}</span>
      </span>
    );
  }
  const d = itemDef(tile.def)!;
  return (
    <span class="spin-tile" style={{ "--tier": tierInfo(d.tier).color }}>
      <ItemArt def={tile.def} finish={tile.finish} />
      <span class="spin-tile-name">{d.name}</span>
    </span>
  );
}

/**
 * Opening a crate: the server rolls, the strip spins to a tier's present, which unwraps straight to the reveal; or
 * to Fischer Random, which gets its banner and a second spin among its items before the reveal.
 */
/** A boss crate's picture with its boss's token on its corner, as its Crates tab row draws it (and Boingo's claw machine's prize, Nov 6). */
export function BossCrateArt({ crate }: { crate: BossCrateDef }) {
  const { Crate } = CRATE_LOOKS[crate.look];
  return (
    <span class="crate-row-art">
      <Crate />
      <span class="crate-row-token">
        <TokenArt boss={crate.boss} />
      </span>
    </span>
  );
}

/**
 * A crate opening (the Crates tab's, the Welcome Crate's, a boss crate's: from its page, its shop's "Open now" or Boingo's claw machine):
 * the server rolls, then on the opening's own layer (Nov 24: the whole phone screen, a computer's middle column; crate-open/) the strip
 * spins to a tier's box, which drops in, shakes and bursts open with a beam in the item's tier color, the item rising into the reveal
 * card; or to Fischer Random, which gets its banner, then a second strip among its items whose winner's beam comes up without a box.
 * What's rolled, how and what's shown as won are unchanged: only the picture and the sound are new.
 */
export function CrateOpening({
  crate,
  force,
  resume,
  onClose,
  opener = openCrate,
}: {
  crate: CrateDef;
  force: OpenForce;
  /** A crate already opened but not seen (you left during the spin): straight to its reveal. */
  resume?: Unseen;
  onClose: () => void;
  /** The roll (the server's; the dev preview page's own fake one, for its frames). */
  opener?: (crate: string, force: OpenForce) => Promise<Opened>;
}) {
  const [result, setResult] = useState<Opened | null>(resume ?? null);
  // "Open another": only while you hold one more (greyed at none), a series crate also a key (Nov 9). (A Welcome Crate: another only
  // while a second waits.)
  const lockerNow = useAccount().profile?.locker;
  const welcomeLeft = lockerNow?.welcome?.unopened ?? 0;
  const more = isWelcomeCrate(crate.id) ? welcomeLeft > 0 : heldOf(lockerNow, crate) > 0 && (isBossCrate(crate) || keysOf(lockerNow) > 0);
  const [error, setError] = useState<string | null>(null);
  // The strip (and, for a present, its box and the card), Fischer Random's banner, its second strip.
  const [stage, setStage] = useState<"spin" | "fischer" | "spin2">("spin");
  // The card has formed (the reveal is shown: the crate is seen).
  const [shown, setShown] = useState(!!resume);
  const [round, setRound] = useState(0);
  // The bonus crate's card (Nov 24): up a beat after the item's card has formed, until its OK (`bonusSeen`: its OK tapped).
  const [bonusUp, setBonusUp] = useState<BonusRoll | null>(null);
  const [bonusSeen, setBonusSeen] = useState(false);
  // The ~300 ms after its OK (the review, Nov 25): the item's buttons stay inert, so a double tap on OK (over "Open another") opens
  // nothing; then the focus goes back to the item's first button.
  const [calming, setCalming] = useState(false);
  const stages = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  // "Open another": everything back to the start in the same update as the new round, so the new strip never mounts with the last
  // answer (it would start on it, then be stopped as the answer cleared, and wait for ever: its card never shown).
  const again = () => {
    setResult(null);
    setError(null);
    setStage("spin");
    setShown(false);
    setBonusUp(null);
    setBonusSeen(false);
    setCalming(false);
    setRound((r) => r + 1);
  };
  const showBonus = (bonus: BonusRoll) => {
    setBonusUp(bonus);
    play("bannerStart");
  };
  useEffect(() => {
    const bonus = shown ? result?.bonus : undefined;
    if (!bonus || bonusUp || bonusSeen) return;
    const t = setTimeout(() => showBonus(bonus), BONUS.afterCardMs);
    return () => clearTimeout(t);
  }, [shown, result, bonusUp, bonusSeen]);
  // A bonus not seen yet comes first (the review, Nov 25): Done or Open another tapped before its card is up shows it at once, and does
  // nothing else; its OK goes back to the item's card, as always.
  const bonusFirst = (): boolean => {
    const bonus = result?.bonus;
    if (!bonus || bonusSeen) return false;
    if (!bonusUp) showBonus(bonus);
    return true;
  };
  // It's seen once its card has formed and, with a bonus, the bonus's card has had its OK (leave before that, and both wait for you);
  // and the moment Done, Wear or Open another is tapped (Nov 25): they can be tapped while the card is still forming, before its timer
  // (`shown`) fires, and the next visit to the crates then resumed this reveal over the list.
  const seen = () => {
    if (result && (!result.bonus || bonusSeen)) setUnseen(null);
  };
  useEffect(() => {
    if (shown) seen();
  }, [shown, result, bonusSeen]);
  const onAgain = () => {
    if (bonusFirst()) return;
    seen();
    again();
  };
  const onDone = () => {
    if (bonusFirst()) return;
    seen();
    onClose();
  };
  const bonusOk = () => {
    setBonusUp(null);
    setBonusSeen(true);
    setCalming(true);
    refocus.current = true;
  };
  useEffect(() => {
    if (calming) {
      const t = setTimeout(() => setCalming(false), BONUS.calmMs);
      return () => clearTimeout(t);
    }
    // (Inert no more: the focus back to the item's card, its first button that takes one.)
    if (!refocus.current) return;
    refocus.current = false;
    stages.current?.querySelector<HTMLElement>(".reveal-actions button:not(:disabled)")?.focus({ preventScroll: true });
  }, [calming]);
  // The item's buttons: inert while the bonus card is up and the ~300 ms after (not reachable by tap or keyboard).
  const quiet = !!bonusUp || calming;
  const still = round === 0 && !!resume;
  useEffect(() => {
    if (still) return;
    let here = true;
    setResult(null);
    setError(null);
    setStage("spin");
    setShown(false);
    // (Its sounds made ahead in the sound worker, while the server answers: none is made on the opening's frames.)
    warmCrateSounds();
    // (Under "Opening…": the server's answer, and the strip's first sounds made in the worker, up to a short wait.)
    const ready = crateSoundsReady(1500);
    opener(crate.id, force)
      .then(async (r) => {
        // It's yours now: if you leave before the reveal, it waits for you (the reveal clears it).
        setUnseen({ crate: crate.id, ...r });
        warmCrateSounds(itemDef(r.item.def)!.tier);
        await ready;
        if (here) setResult(r);
      })
      .catch((e) => here && setError(e instanceof Error ? e.message : "Couldn't open the crate."));
    return () => {
      here = false;
    };
  }, [round]);
  // The first strip's decoys, drawn as the opening starts (so the strip is set up while the server answers); its winner once it has.
  const decoys = useMemo(() => stripTiles(presentTile(crate), { kind: "present", tier: "common" }, STRIPS.crate.tiles, STRIPS.crate.land), [round]);
  const strips = useMemo(() => {
    if (!result) return null;
    const { roll, item } = result;
    const finish = { color: item.color, color2: item.color2 ?? undefined, blemish: item.blemish, seed: item.seed };
    const tier = itemDef(item.def)!.tier as PresentTier;
    const one = decoys.slice();
    one[STRIPS.crate.land] = roll.fischer ? { kind: "fischer" } : { kind: "present", tier };
    return {
      tier,
      one,
      // Only Fischer Random spins again; a present opens straight to its item (Eric, Oct 7).
      two: roll.fischer ? stripTiles(itemTile(fischerOdds(crate)), { kind: "item", def: item.def, finish }, STRIPS.fischer.tiles, STRIPS.fischer.land) : [],
    };
  }, [result]);
  const look = CRATE_LOOKS[crate.look];
  const fischer = !!result?.roll.fischer;
  // Fischer Random's second strip is set up out of sight while the first spins (its setup off the banner's first frames).
  const [ahead, setAhead] = useState(false);
  useEffect(() => {
    setAhead(false);
    if (!fischer) return;
    const t = setTimeout(() => setAhead(true), 1500);
    return () => clearTimeout(t);
  }, [result]);
  const tier = (result ? itemDef(result.item.def)!.tier : null) as PresentTier | null;
  const art = result && <ItemArt def={result.item.def} finish={result.item} live />;
  const details = result && <RevealDetails item={result.item} again={more} quiet={quiet} onAgain={onAgain} onClose={onDone} onWear={seen} />;
  const one = strips?.one ?? decoys;
  return (
    <OpenLayer label={crate.name}>
      <div class="cox-head">
        <h2 class="ff-title">
          <CrateName name={crate.name} />
        </h2>
        <p class={`cox-status${error ? " error" : ""}`} aria-live="polite">
          {error ?? (!result ? "Opening…" : "")}
        </p>
      </div>
      <div class="cox-room">
        <div class="cox-stages" ref={stages}>
          {still && result && <Reveal item={result.item} again={more} quiet={quiet} onAgain={onAgain} onClose={onDone} onWear={seen} />}
          {!still && stage !== "spin2" && (
            <CrateStage
              key={`a${round}`}
              tiles={STRIPS.crate.tiles}
              land={STRIPS.crate.land}
              tile={(i) => <TileView tile={one[i]!} look={crate.look} />}
              ending={result ? (fischer ? "none" : "box") : null}
              tier={result && !fischer ? tier : null}
              Box={look.Box}
              lid={look.lid}
              item={fischer ? null : art}
              cardClass={result ? revealClass(result.item) : ""}
              cardBody={fischer ? null : details}
              go={!!strips}
              onStop={
                fischer
                  ? () => {
                      // (Its banner's 2.5 s and a beat: every banner a second longer, Eric, Oct 15; and the banners' extra, Oct 24.)
                      setStage("fischer");
                      setTimeout(() => setStage("spin2"), fischerBannerMs() + 200);
                    }
                  : undefined
              }
              onCard={() => setShown(true)}
            />
          )}
          {/* Fischer Random's second strip: set up under its banner, then spun; its winner's beam comes up without a box. */}
          {!still && strips && fischer && (ahead || stage !== "spin") && (
            <CrateStage
              key={`b${round}`}
              tiles={STRIPS.fischer.tiles}
              land={STRIPS.fischer.land}
              tile={(i) => <TileView tile={strips.two[i]!} look={crate.look} />}
              ending="beam"
              tier={tier}
              Box={look.Box}
              lid={look.lid}
              item={art}
              cardClass={revealClass(result!.item)}
              cardBody={details}
              go={stage === "spin2"}
              hidden={stage !== "spin2"}
              onCard={() => setShown(true)}
            />
          )}
          {stage === "fischer" && (
            <div class="fischer-stage">
              <FightBanner tone="hero" face={<TranscendentArt />} text="TRANSCENDENT!" sub={isWelcomeCrate(crate.id) ? "A HunChess ride" : "Legendary or Mythic"} ms={fischerBannerMs()} />
            </div>
          )}
          {error && (
            <button type="button" class="ff-button cox-done" onClick={onClose}>
              ▶ Done
            </button>
          )}
          {bonusUp && (
            <BonusStage key={`c${round}`}>
              <BonusCard bonus={bonusUp} onOk={bonusOk} />
            </BonusStage>
          )}
        </div>
      </div>
    </OpenLayer>
  );
}

/**
 * The bonus crate's card's words and buttons (Nov 24; docs/decisions/2026-11-24-bonus-crate.md), under "BONUS!": the crate's art (a boss
 * crate's with its boss's token), its name, "+1 crate key" with the key when one came with it, where it is, and OK (back to the item's
 * card). It's in your inventory already: the opening's answer brought it.
 */
export function BonusCard({ bonus, onOk }: { bonus: BonusRoll; onOk: () => void }) {
  const crate = anyCrate(bonus.crate);
  const { Crate } = CRATE_LOOKS[crate?.look ?? "beta"];
  return (
    <>
      <span class="reveal-tier">BONUS!</span>
      <span class="reveal-art cox-bonus-art">
        <Crate />
        {crate && isBossCrate(crate) && (
          <span class="crate-row-token">
            <TokenArt boss={crate.boss} />
          </span>
        )}
      </span>
      <strong class="reveal-name">
        <CrateName name={crate?.name ?? bonus.crate} />
      </strong>
      {bonus.key && (
        <span class="cox-bonus-key">
          <span class="stock-art">
            <KeyArt />
          </span>
          +1 crate key
        </span>
      )}
      <span class="reveal-desc">A bonus crate{bonus.key ? " and its key" : ""}, in your inventory's Crates.</span>
      <div class="reveal-actions">
        <button type="button" class="ff-button small" onClick={onOk}>
          ▶ OK
        </button>
      </div>
    </>
  );
}

/** The reveal card's classes: shiny (a high purity), special (Legendary and Mythic). (A HunChess ride: no purity, so no shine; Eric, Nov 6.) */
function revealClass(item: ItemInstance) {
  const d = itemDef(item.def)!;
  const shiny = !isHunchess(item.def) && isShiny(item.blemish);
  const special = d.tier === "legendary" || d.tier === "mythic";
  return `${shiny ? "shiny" : ""}${special ? `${shiny ? " " : ""}special` : ""}`;
}

/**
 * The reveal card already opened and not seen (you left during the spin, Oct 8): the card alone, at once, with the game's reveal sound.
 */
function Reveal({ item, again = true, quiet = false, onAgain, onClose, onWear }: { item: ItemInstance; again?: boolean; quiet?: boolean; onAgain: () => void; onClose: () => void; onWear?: () => void }) {
  const d = itemDef(item.def)!;
  const t = tierInfo(d.tier);
  const cls = revealClass(item);
  useEffect(() => {
    play(cls ? "bannerStart" : "select");
  }, []);
  return (
    <div class={`ff-window reveal-card cox-card-still${cls ? ` ${cls}` : ""}`} style={{ "--tier": t.color }}>
      <span class="reveal-tier">{t.name}</span>
      <span class="reveal-art">
        <ItemArt def={item.def} finish={item} live />
      </span>
      <RevealDetails item={item} again={again} quiet={quiet} onAgain={onAgain} onClose={onClose} onWear={onWear} />
    </div>
  );
}

/**
 * The reveal's words and buttons, under its picture: the item, its tier, color, purity and (if so) its shine; Wear, Open another, Done.
 * `quiet`: its buttons inert (the bonus card over it, and a beat after: CrateOpening). (Its opening clears the unseen record: CrateOpening.)
 */
function RevealDetails({ item, again, quiet, onAgain, onClose, onWear }: { item: ItemInstance; again: boolean; quiet: boolean; onAgain: () => void; onClose: () => void; onWear?: () => void }) {
  const d = itemDef(item.def)!;
  const hc = isHunchess(item.def);
  const shiny = !hc && isShiny(item.blemish);
  const [worn, setWorn] = useState(false);
  // (Quiet: no tap or key does anything, also where `inert` isn't known (Safari before 15.5): the class takes no tap, and each button's
  // own check. #923's re-review, Nov 25.)
  const unlessQuiet = (f: () => void) => () => void (quiet || f());
  return (
    <>
      <strong class="reveal-name">{itemName(item)}</strong>
      <span class="reveal-finish">
        {finishLine(item)}
        {shiny ? " ✨" : ""}
      </span>
      {shiny && <span class="reveal-shiny">Shiny!</span>}
      {hc && <NotTradeable />}
      <span class="reveal-desc">{d.description}</span>
      <div class={`reveal-actions${quiet ? " quiet" : ""}`} inert={quiet}>
        <button
          type="button"
          class="ff-button small"
          disabled={worn}
          onClick={unlessQuiet(() => {
            onWear?.();
            void equipLockerItem(d.slot, item.id).then(() => setWorn(true));
            play("menuSelect");
          })}
        >
          {worn ? "Wearing it" : "▶ Wear"}
        </button>
        <button type="button" class="ff-button small" disabled={!again} onClick={unlessQuiet(onAgain)}>
          ▶ Open another
        </button>
        <button type="button" class="ff-button small" onClick={unlessQuiet(onClose)}>
          ▶ Done
        </button>
      </div>
    </>
  );
}

// ---------------- Locker ----------------

type LockerTab = ItemSlot | "all";
const LOCKER_TABS: readonly LockerTab[] = ["all", "head", "face", "skin", "weapon", "ride"];
const tabName = (t: LockerTab) => (t === "all" ? "All" : SLOT_NAMES[t]);

/**
 * What you own, and the one place to wear it. Crate items, rarest first, with copies of an item in the same color
 * stacked (×3, the purest on top: that's the one you wear). Then what you got in the shop: God King effects. Tap to
 * wear (tap again to take off); hold a crate item (or right-click it) to delete it. Your avatar shows the result (on its ride,
 * if you wear one: Oct 31, in the same box).
 * (The pawn hats are crate items now, from the Beta crate.) An admin's locker has one of everything: an admin copy
 * (core/admin-copies.ts) carries an "Admin" tag, wears like any item and can't be deleted (there's nothing stored).
 * The preview is one pawn in your default color (W or B, bottom right: pawn-color.ts; Eric, Nov 7).
 */
export function LockerPanel({ onShop }: { onShop?: () => void }) {
  const { profile } = useAccount();
  const [tab, setTab] = useState<LockerTab>("all");
  const [deleting, setDeleting] = useState<ItemStack | null>(null);
  const [peek, openPeek] = usePeek();
  const locker = profile?.locker;
  const shop = profile?.shop;
  const pawn = myPawnColor();
  if (!locker) return <p class="muted">Your locker needs your account.</p>;
  const top = (s: ItemStack) => s.items[0]!;
  // (The Outfit slot is secret, Eric, Nov 10: its tab shows only once you own an outfit; his exception to "nothing hidden".)
  const outfits = ownsOutfit(locker.items);
  // (An item this app doesn't know, e.g. one added since it loaded, as an admin's copy of it: left out, not a crash.)
  const stacks = stackItems(locker.items)
    .filter((s) => itemDef(top(s).def) && (tab === "all" || itemDef(top(s).def)?.slot === tab))
    .sort((a, b) => tierIndex(top(b).def) - tierIndex(top(a).def) || colorIndex(top(b).color) - colorIndex(top(a).color) || top(a).blemish - top(b).blemish);
  // What you got in the shop: God King effects (under All; the God King tab is gone, Eric, Nov 7).
  const fromShop = GOD_KING_SHOP ? SHOP_ITEMS.filter((i) => wornFromLocker(i) && shop?.owned.includes(i.id)) : [];
  const shopTab = tab === "all" && GOD_KING_SHOP;
  const wornIn = (s: ItemStack) => {
    const slot = itemDef(top(s).def)!.slot;
    return s.items.some((i) => i.id === locker.equipped[slot]);
  };
  return (
    <div class="locker">
      <div class="ff-window locker-preview">
        <span class="locker-avatar">
          <Avatar look={locker.look} side={sideOfPawn(pawn)} ride outlined live />
        </span>
        <div class="locker-pawn-pick" role="group" aria-label="Your default pawn color">
          {PAWN_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              class={`locker-pawn-letter ${c}${pawn === c ? " on" : ""}`}
              aria-pressed={pawn === c}
              aria-label={c === "white" ? "White" : "Black"}
              onClick={() => pickPawnColor(c)}
            >
              {c === "white" ? "W" : "B"}
            </button>
          ))}
        </div>
      </div>
      <div class={`shop-tabs locker-tabs${outfits ? " with-outfit" : ""}`} role="tablist">
        {(outfits ? [...LOCKER_TABS, "outfit" as const] : LOCKER_TABS).map((t) => (
          <button type="button" role="tab" key={t} aria-selected={tab === t} class={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {tabName(t)}
          </button>
        ))}
      </div>
      {!stacks.length && <p class="muted">No crate items here yet. Open a crate!</p>}
      {stacks.length > 0 && (
        <div class="locker-grid">
          {stacks.map((s) => {
            const it = top(s);
            const d = itemDef(it.def)!;
            const worn = wornIn(s);
            // (An admin copy is never stacked: it's there only for an item you don't own.)
            const admin = isAdminCopy(it.id);
            // (A HunChess ride, the Welcome Crate's: no purity, and "Not tradeable"; Eric, Nov 6.)
            const hc = isHunchess(it.def);
            // (An outfit on, Nov 10: every other item but eyewear shows greyed, still wearable underneath; nothing hidden.)
            const covered = hiddenByOutfit(locker.look, it.def);
            return (
              <div key={s.key} class="locker-cell">
                <HoldButton
                  class={`locker-item${frameClass(d.tier)}${worn ? " worn" : ""}${covered ? " covered" : ""}${!hc && isShiny(it.blemish) ? " shiny" : ""}${hc ? " hunchess-item" : ""}`}
                  style={{ "--tier": tierInfo(d.tier).color }}
                  label={`${itemName(it)}${covered ? ", hidden by your outfit" : ""}, ${hc ? `HunChess gold and black, not tradeable` : `${colorName(it)}, purity ${purity(it.blemish).toFixed(1)}%`}${s.items.length > 1 ? `, ${s.items.length} of them` : ""}. ${admin ? "Admin copy." : "Hold to delete."}`}
                  onTap={() => {
                    play("menuSelect");
                    void equipLockerItem(d.slot, worn ? null : it.id);
                  }}
                  onHold={
                    admin
                      ? undefined
                      : () => {
                          play("menuOpen");
                          setDeleting(s);
                        }
                  }
                >
                  <ItemArt def={it.def} finish={it} />
                  <strong>{itemName(it)}</strong>
                  {hc ? (
                    <>
                      <span class="small">HunChess</span>
                      <NotTradeable />
                    </>
                  ) : (
                    <>
                      <span class="small">{colorName(it)}</span>
                      <span class="small muted">
                        {purity(it.blemish).toFixed(1)}%{isShiny(it.blemish) ? " ✨" : ""}
                      </span>
                    </>
                  )}
                  {worn && <span class="locker-worn">Worn</span>}
                  {covered && <span class="locker-covered">Hidden by your outfit</span>}
                  {s.items.length > 1 && <span class="locker-count">×{s.items.length}</span>}
                  {admin && <span class="locker-admin">Admin</span>}
                </HoldButton>
                {/* The preview (Nov 27): a tile's tap wears it and a hold deletes it, so the preview is this small control of its own. */}
                <button type="button" class="locker-peek" aria-label={`Preview ${itemName(it)}`} onClick={() => openPeek({ ...it, color2: it.color2 ?? undefined })}>
                  <PeekIcon />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {shopTab && shop && (
        <>
          <h3 class="ff-title locker-subhead">From the shop</h3>
          <div class="locker-grid">
            {fromShop.map((item) => {
              const worn = shop.equipped.king === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  class={`locker-item default${worn ? " worn" : ""}`}
                  onClick={() => {
                    play("menuSelect");
                    // A God King effect stays on until you pick another (he always has one).
                    if (!worn) void equipShopItem(item.id);
                  }}
                >
                  <span class="locker-default-art">
                    <KingEffectPreview look={item.look} />
                  </span>
                  <strong>{item.name}</strong>
                  <span class="small muted">God King effect</span>
                  {worn && <span class="locker-worn">On</span>}
                  {shop.admin?.includes(item.id) && <span class="locker-admin">Admin</span>}
                </button>
              );
            })}
          </div>
          {onShop && (
            <p class="muted small">
              More God King effects in the{" "}
              <button type="button" class="link-button" onClick={onShop}>
                Shop ›
              </button>
            </p>
          )}
        </>
      )}
      {peek}
      {deleting && <DeleteDialog stack={deleting} wornId={locker.equipped[itemDef(top(deleting).def)!.slot]} onClose={() => setDeleting(null)} />}
    </div>
  );
}

/** The locker's W or B: your default pawn color, saved (the account, or this device as a guest). A tap on the color you have does nothing. */
function pickPawnColor(c: PawnColor) {
  if (c === myPawnColor()) return;
  play("menuSelect");
  void setPawnColor(c).catch(() => undefined);
}

/**
 * A button you can tap, or hold (about half a second; or right-click) for something else (none without `onHold`).
 * Moving the finger (a scroll) cancels the hold, and a hold doesn't also count as a tap.
 */
function HoldButton({
  onTap,
  onHold,
  label,
  children,
  ...rest
}: { onTap: () => void; onHold?: () => void; label: string; children: ComponentChildren; class: string; style: Record<string, string> }) {
  const timer = useRef(0);
  const held = useRef(false);
  const from = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
  };
  const hold = () => {
    cancel();
    // (Held, with or without anything to do: the click that follows isn't a tap.)
    held.current = true;
    if (!onHold) return;
    haptic("crateHold");
    onHold();
  };
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      onPointerDown={(e) => {
        held.current = false;
        from.current = { x: e.clientX, y: e.clientY };
        cancel();
        timer.current = window.setTimeout(hold, 550);
      }}
      onPointerMove={(e) => {
        if (from.current && Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > 10) cancel();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!held.current) hold();
      }}
      onClick={() => {
        if (held.current) held.current = false;
        else onTap();
      }}
    >
      {children}
    </button>
  );
}

type PeekItem = NonNullable<ItemLook[ItemSlot]>;

/** The preview pop-up and its opener, for a screen with item tiles (Nov 27). */
function usePeek() {
  const [item, setItem] = useState<PeekItem | null>(null);
  const open = (it: PeekItem) => {
    play("menuOpen");
    setItem(it);
  };
  return [item && <ItemPreview item={item} onClose={() => setItem(null)} />, open] as const;
}

/** The small magnifier that says "tap to preview" (the locker's own control; on a crate's rows, where the whole row is the tap). */
function PeekIcon() {
  return (
    <svg class="peek-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10" cy="10" r="6" />
      <path d="M14.5 14.5 20 20" />
    </svg>
  );
}

/**
 * An item's preview (Eric, Nov 12: "if you click on them, it should load up like a little box... a preview of like a pawn...
 * utilizing the rider"): your pawn (your default color) wearing only this item, or riding it, in its own framed box. The
 * locker's Avatar draws it, so every item and ride works with no work of its own. Its name, tier and finish, and Close.
 */
function ItemPreview({ item, onClose }: { item: PeekItem; onClose: () => void }) {
  const d = itemDef(item.def)!;
  const t = tierInfo(d.tier);
  // (A layout effect and its own Escape, heard first, as the delete dialog's: LESSONS.md, Nov 11.)
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopImmediatePropagation(), onClose());
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  return (
    <div class="locker-dialog-back" onClick={onClose}>
      <div class="ff-window locker-dialog item-preview" role="dialog" aria-modal="true" aria-labelledby="item-preview-title" style={{ "--tier": t.color }} onClick={(e) => e.stopPropagation()}>
        <span class={`item-preview-stage${frameClass(d.tier)}`} data-tier={d.tier}>
          <Avatar look={{ [d.slot]: item }} side={sideOfPawn(myPawnColor())} ride outlined live />
        </span>
        <strong id="item-preview-title">{itemName(item)}</strong>
        <span class="small item-preview-tier">
          {t.name} · {SLOT_NAMES[d.slot]}
        </span>
        <span class="small">{finishLine(item)}</span>
        <div class="locker-dialog-actions">
          <button type="button" class="ff-button small" autoFocus onClick={onClose}>
            ▶ Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Deleting a crate item for good, after a confirmation. A stack offers to delete the extras (keeping the purest) or
 * all of them. If the one you wear goes, the one you keep goes on instead.
 */
function DeleteDialog({ stack, wornId, onClose }: { stack: ItemStack; wornId: string | undefined; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = stack.items[0]!;
  const d = itemDef(top.def)!;
  const n = stack.items.length;
  // (A layout effect, as every pop-up's: an effect waits for a paint, and an Escape pressed as it opened was lost. LESSONS.md, Nov 11.)
  useLayoutEffect(() => {
    // (Its Escape is its own, heard first: nothing under it (the inventory layer, a screen) acts on it too.)
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopImmediatePropagation(), onClose());
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  const go = async (ids: string[], keep?: ItemInstance) => {
    setBusy(true);
    setError(null);
    try {
      await deleteLockerItems(ids);
      if (keep && wornId && ids.includes(wornId)) await equipLockerItem(d.slot, keep.id);
      play("menuClose");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete it.");
      setBusy(false);
    }
  };
  return (
    <div class="locker-dialog-back" onClick={onClose}>
      <div class="ff-window locker-dialog" role="dialog" aria-modal="true" aria-labelledby="locker-dialog-title" style={{ "--tier": tierInfo(d.tier).color }} onClick={(e) => e.stopPropagation()}>
        <span class="locker-dialog-art">
          <ItemArt def={top.def} finish={top} />
        </span>
        <strong id="locker-dialog-title">
          Delete {itemName(top)}
          {n > 1 ? ` ×${n}` : ""}?
        </strong>
        <span class="small">{n > 1 && showsPurity(top.def) ? `${colorName(top)} · the best is ${purity(top.blemish).toFixed(1)}%` : finishLine(top)}</span>
        <p class="small">It's gone for good. This can't be undone.</p>
        {error && <p class="shop-error">{error}</p>}
        <div class="locker-dialog-actions">
          {n > 1 && (
            <button type="button" class="ff-button small" disabled={busy} onClick={() => void go(stack.items.slice(1).map((i) => i.id), top)}>
              ▶ Delete {n - 1 === 1 ? "the extra one" : `the ${n - 1} extras`}, keep the best
            </button>
          )}
          <button type="button" class="ff-button small danger" disabled={busy} onClick={() => void go(stack.items.map((i) => i.id))}>
            ▶ {n > 1 ? `Delete all ${n}` : "Delete"}
          </button>
          <button type="button" class="ff-button small" disabled={busy} autoFocus onClick={onClose}>
            ▶ Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export { crateDef };
