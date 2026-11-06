import type { ComponentChildren, JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  BOSS_CRATES,
  CRATES,
  CRATES_FREE,
  FISCHER,
  ITEM_COLORS,
  PURITY_BANDS,
  SHOP_ITEMS,
  SLOT_NAMES,
  TIERS,
  bossCrateDef,
  crateDef,
  fischerOdds,
  isAdminCopy,
  isShiny,
  itemChance,
  liveStrip,
  presentChance,
  presentItems,
  itemColor,
  bannerPlusMs,
  itemDef,
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
  type BossCrateDef,
  type CrateDef,
  type CrateLook,
  type CrateRoll,
  type ItemInstance,
  type ItemSlot,
  type ItemStack,
  type PresentTier,
} from "@chessroyale/core";
import { deleteLockerItems, equipLockerItem, equipShopItem, grantTestItems, openCrate } from "../account.ts";
import { TokenArt } from "../components/TokenArt.tsx";
import { Avatar, BetaCrateArt, FischerArt, HunchessBoxArt, HunchessCrateArt, ItemArt, KeyArt, PresentArt, SupplyBoxArt, WinterCrateArt } from "../components/Items.tsx";
import { FightBanner } from "../components/FightBanner.tsx";
import { GamblingWarning } from "../components/GamblingWarning.tsx";
import { KingEffectPreview } from "../components/Cosmetics.tsx";
import { play, unlockAudio } from "../sound.ts";
import { useAccount } from "./Profile.tsx";
import { testParams, testSwitchesAllowed } from "../test-switches.ts";

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
const CRATE_LOOKS: Record<CrateLook, { Crate: () => JSX.Element; Box: (p: { color: string }) => JSX.Element; box: string; boxes: string }> = {
  winter: { Crate: WinterCrateArt, Box: PresentArt, box: "present", boxes: "Presents" },
  beta: { Crate: BetaCrateArt, Box: SupplyBoxArt, box: "supply box", boxes: "Supply boxes" },
  hunchess: { Crate: HunchessCrateArt, Box: HunchessBoxArt, box: "box", boxes: "Boxes" },
};

/**
 * A crate opened but not seen yet: the server rolled it, but you left during the spin (Eric, Oct 8). Kept on the
 * device (and in memory, if storage is off) until its reveal shows; coming back to the crates opens straight to it.
 */
type Unseen = { crate: string; roll: CrateRoll; item: ItemInstance };
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

/** A crate by its id: the Crates tab's own (free while testing), or a boss's (bought in its shop, held until you open it: Nov 2). */
const anyCrate = (id: string): CrateDef | undefined => crateDef(id) ?? bossCrateDef(id) ?? (isWelcomeCrate(id) ? WELCOME_CRATE : undefined);
const isBossCrate = (c: CrateDef): c is BossCrateDef => "boss" in c;
/** "Babur's", "Puddles'" (as his home's and his crate's names have it). */
const possessive = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);
/** How many of a boss crate your locker holds, unopened. */
const heldOf = (locker: { bossCrates?: Record<string, number> } | undefined, c: CrateDef) => locker?.bossCrates?.[c.id] ?? 0;

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
  const [open, setOpen] = useState<CrateDef | null>(() => (resume ? anyCrate(resume.crate)! : null));
  const count = (n: number | null | undefined) => (n === null || n === undefined ? "∞" : String(n));
  if (open) return <CratePage crate={open} resume={resume?.crate === open.id ? resume : undefined} onBack={() => setOpen(null)} />;
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
      <WelcomeRow onOpen={() => setOpen(WELCOME_CRATE)} />
      <TokenStock tokens={locker?.tokens ?? {}} admin={!!profile?.admin} />
      {profile?.admin && <AdminGrants />}
      {CRATES.map((c) => {
        const { Crate } = CRATE_LOOKS[c.look];
        return (
          <button type="button" key={c.id} class="ff-window crate-row" data-crate={c.id} onClick={() => setOpen(c)}>
            <span class="crate-row-art">
              <Crate />
            </span>
            <span class="crate-row-text">
              <strong>
                <CrateName name={c.name} />
              </strong>
              <span class="crate-row-blurb">{c.blurb}</span>
              <span>{c.items.length} items</span>
            </span>
            <span class="ff-cursor" aria-hidden="true">
              ▶
            </span>
          </button>
        );
      })}
      {CRATES_FREE && <p class="shop-note">Crates are unlimited while we test.</p>}
      {/* The boss crates (Eric, Nov 2: a buy in a boss's shop "adds the crate to your inventory"): each with how many you hold,
          greyed at none (shown, not hidden: its page still shows what's inside); opened here as any crate. */}
      <h3 class="ff-title">Boss crates</h3>
      {/* (A boss in the game for admins first, Timber: his crate on an admin's list only, or one you hold.) */}
      {BOSS_CRATES.filter((c) => profile?.admin || heldOf(locker, c) > 0 || !adminFirst({ id: c.boss })).map((c) => {
        const { Crate } = CRATE_LOOKS[c.look];
        const n = heldOf(locker, c);
        return (
          <button type="button" key={c.id} class={`ff-window crate-row boss-crate-row${n ? "" : " none"}`} data-crate={c.id} data-held={n} onClick={() => setOpen(c)}>
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
      })}
    </div>
  );
}

/** Where your Welcome Crate is: "ready" (yours to open), "opened", or not earned yet ("locked"; a guest's always is). */
const welcomeOf = (profile: ReturnType<typeof useAccount>["profile"]) =>
  profile?.locker?.welcome ?? { games: 0, next: WELCOME_GIFT.milestones[0] as number | null, unopened: 0, status: "locked" as const, notice: false };
/**
 * The line under the crate saying where yours are (Eric: "the first one you get after 5 games, the next one you get after 25"): one
 * waiting ("You have 1. Open it!"), else the next milestone's progress ("Finish 25 games for your second Welcome Crate: 7/25"), else
 * both opened.
 */
function welcomeLine(w: { games: number; next?: number | null; unopened?: number; status: string }, signedIn: boolean): string {
  const waiting = w.unopened ?? (w.status === "ready" ? 1 : 0);
  if (waiting > 0) return `You have ${waiting}. Open ${waiting === 1 ? "it" : "them"}!`;
  const next = w.next === undefined ? (w.status === "locked" ? WELCOME_GIFT.milestones[0] : null) : w.next;
  if (next === null) return "Both opened. Their rides are in your locker.";
  const line = WELCOME_TEXT.progress(w.games, next);
  return signedIn ? line : `${line}. Sign in to earn it.`;
}

/**
 * The HunChess Welcome Crate's row (Eric, Nov 6), first in the Crates tab: the gold-and-black crate, its name, "Thank you for being an
 * early tester!", "Not tradeable", and where yours is (the progress hint until it's earned: shown, greyed, not hidden).
 */
function WelcomeRow({ onOpen }: { onOpen: () => void }) {
  const { profile } = useAccount();
  const w = welcomeOf(profile);
  return (
    <button type="button" class={`ff-window crate-row welcome-crate-row${w.status === "ready" ? "" : " none"}`} data-crate={WELCOME_CRATE.id} data-welcome={w.status} onClick={onOpen}>
      <span class="crate-row-art">
        <HunchessCrateArt />
      </span>
      <span class="crate-row-text">
        <strong>{WELCOME_TEXT.name}</strong>
        <span class="crate-row-blurb welcome-thanks">{WELCOME_TEXT.thanks}</span>
        <span class="crate-row-held welcome-progress">{welcomeLine(w, !!profile?.user.signedIn)}</span>
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

/** Admins only: test grants to yourself (crate keys, any boss's tokens), for trying the boss crates (the server checks it's you). */
function AdminGrants() {
  const [boss, setBoss] = useState("tiger");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const give = (body: { keys?: number; boss?: string; tokens?: number }) => {
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
      {error && <p class="shop-error">{error}</p>}
    </section>
  );
}

function CratePage({ crate, resume, onBack }: { crate: CrateDef; resume?: Unseen; onBack: () => void }) {
  if (crate.id === WELCOME_CRATE.id) return <WelcomePage resume={resume} onBack={onBack} />;
  // A boss crate opens only one you hold (the server's, once each), never with a test switch.
  const boss = isBossCrate(crate) ? crate : null;
  const held = heldOf(useAccount().profile?.locker, crate);
  // Test switches (test-switches.ts; the server checks too): ?fischer=1, ?shiny=1 force the roll, until changed with
  // the boxes below. (Read on every render: whether you may is known once your account is.)
  const [fischerSet, setForceFischer] = useState<boolean | null>(null);
  const [shinySet, setForceShiny] = useState<boolean | null>(null);
  const forceFischer = testSwitchesAllowed() && (fischerSet ?? testParams().get("fischer") === "1");
  const forceShiny = testSwitchesAllowed() && (shinySet ?? testParams().get("shiny") === "1");
  const [opening, setOpening] = useState(!!resume);
  const look = CRATE_LOOKS[crate.look];
  // Commonest first; Legendary and Mythic (Fischer Random) last.
  const items = [...crate.items].sort((a, b) => tierIndex(a) - tierIndex(b));
  if (opening)
    return <CrateOpening crate={crate} force={boss ? {} : { fischer: forceFischer, shiny: forceShiny }} resume={resume} onClose={() => setOpening(false)} />;
  return (
    <div class="crate-page">
      <GamblingWarning />
      <button type="button" class="btn btn-secondary btn-small" onClick={onBack}>
        ‹ Crates
      </button>
      <div class="ff-window crate-hero">
        <span class="crate-hero-art">
          <look.Crate />
        </span>
        <strong>
          <CrateName name={crate.name} />
        </strong>
        <span class="small">{crate.blurb}</span>
        {boss && (
          <span class="small crate-held" data-held={held}>
            {held ? `You have ${held}.` : `You have none. ${possessive(tokenBossName(boss.boss))} shop in the town sells it.`}
          </span>
        )}
      </div>
      <h3 class="ff-title">{look.boxes}</h3>
      <p class="small muted">
        The crate holds a {look.box} for each tier, in its color. A {look.box} opens to one of its tier's items, each as likely as the others.
      </p>
      <div class="odds-list">
        {liveStrip(crate).map(({ tier }) => {
          if (tier === FISCHER)
            return (
              <div key={tier} class="odds-row" style={{ "--tier": "#fbbf24" }}>
                <span class="odds-art">
                  <FischerArt />
                </span>
                <span class="odds-text">
                  <strong>Fischer Random</strong>
                  <span class="odds-tier">A second spin: Legendary or Mythic</span>
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
      <h3 class="ff-title">Possible items</h3>
      <div class="odds-list">
        {items.map((def) => {
          const d = itemDef(def)!;
          const t = tierInfo(d.tier);
          const special = d.tier === "legendary" || d.tier === "mythic";
          return (
            <div key={def} class="odds-row" style={{ "--tier": t.color }}>
              <span class="odds-art">
                <ItemArt def={def} finish={{ color: "red", color2: "emerald", blemish: 12, seed: 1 }} />
              </span>
              <span class="odds-text">
                <strong>{d.name}</strong>
                <span class="odds-tier">
                  {t.name} · {SLOT_NAMES[d.slot]}
                  {special ? " · Fischer Random only" : ""}
                </span>
              </span>
              <span class="odds-pct">{pct(itemChance(crate, def))}</span>
            </div>
          );
        })}
      </div>
      <details class="odds-more">
        <summary>Colors and purity</summary>
        <p class="small">Every item also rolls a color and a purity, 0-100%. The lower its purity, the more it's blotched (at 0%, all over, a shade darker). At 90% or more it's shiny ✨ (about 1 in 250).</p>
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
              Purity {b.low}-{b.high}%{b.low >= 90 ? " ✨" : ""}: {b.weight}%
            </span>
          ))}
        </div>
      </details>
      {CRATES_FREE && !boss && testSwitchesAllowed() && (
        <div class="test-switches">
          <span class="muted small">Testing:</span>
          <label class="check small">
            <input type="checkbox" checked={forceFischer} onChange={(e) => setForceFischer(e.currentTarget.checked)} /> Land on Fischer Random
          </label>
          <label class="check small">
            <input type="checkbox" checked={forceShiny} onChange={(e) => setForceShiny(e.currentTarget.checked)} /> Shiny
          </label>
        </div>
      )}
      {/* (A boss crate: greyed with none to open, shown, not hidden.) */}
      <button
        type="button"
        class="ff-button"
        disabled={!!boss && held < 1}
        onClick={() => {
          // (A tap: the moment a phone allows sound, so the strip's clicks are heard.)
          unlockAudio();
          play("menuSelect");
          setOpening(true);
        }}
      >
        {boss ? "▶ Open" : "▶ Open · uses 1 key"}
      </button>
    </div>
  );
}

/**
 * The Welcome Crate's page (Eric, Nov 6): the crate, its name, "Thank you for being an early tester!", "Not tradeable", where yours is,
 * and every ride it can give (each as likely), in the HunChess colorway, with no purity anywhere. "▶ Open" opens yours (once: greyed
 * until it's earned and once it's opened), with the Crates tab's own strip and reveal.
 */
function WelcomePage({ resume, onBack }: { resume?: Unseen; onBack: () => void }) {
  const { profile } = useAccount();
  const w = welcomeOf(profile);
  const [opening, setOpening] = useState(!!resume);
  if (opening) return <CrateOpening crate={WELCOME_CRATE} force={{}} resume={resume} onClose={() => setOpening(false)} />;
  return (
    <div class="crate-page welcome-page">
      <button type="button" class="btn btn-secondary btn-small" onClick={onBack}>
        ‹ Crates
      </button>
      <div class="ff-window crate-hero welcome-crate-hero">
        <span class="crate-hero-art">
          <HunchessCrateArt />
        </span>
        <strong>{WELCOME_TEXT.name}</strong>
        <span class="small welcome-thanks">{WELCOME_TEXT.thanks}</span>
        <NotTradeable />
        <span class="small crate-held welcome-progress" data-welcome={w.status}>
          {welcomeLine(w, !!profile?.user.signedIn)}
        </span>
      </div>
      <p class="small muted">
        Two per account: one for finishing {WELCOME_GIFT.milestones[0]} games in any mode or against any boss, another at {WELCOME_GIFT.milestones[1]}. Each holds
        one ride, any of the game's rides, each as likely (the second never the first's), in HunChess gold and black. They and their
        rides can't be traded.
      </p>
      <h3 class="ff-title">Possible rides</h3>
      <div class="odds-list">
        {WELCOME_CRATE.items.map((def) => {
          const d = itemDef(def)!;
          return (
            <div key={def} class="odds-row" style={{ "--tier": "#f2c14e" }}>
              <span class="odds-art">
                <ItemArt def={def} finish={{ ...HUNCHESS_FINISH, seed: 1 }} />
              </span>
              <span class="odds-text">
                <strong>{d.name}</strong>
                <span class="odds-tier">Ride · HunChess gold & black</span>
              </span>
              <span class="odds-pct">{pct(1 / WELCOME_CRATE.items.length)}</span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        class="ff-button"
        disabled={w.status !== "ready"}
        onClick={() => {
          unlockAudio();
          play("menuSelect");
          setOpening(true);
        }}
      >
        ▶ Open
      </button>
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
        <FischerArt />
        <span class="spin-tile-name">Fischer Random</span>
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
 * The strip: it races past a center marker, slows (ease-out) and lands on the result, with a click for every
 * tile that passes (fast, then slower and slower).
 */
function Spin({ tiles, land, ms, look, onDone }: { tiles: Tile[]; land: number; ms: number; look: CrateLook; onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current!;
    const first = el.children[0] as HTMLElement;
    const step = first.offsetWidth + 6;
    const width = box.current!.offsetWidth;
    // Land somewhere inside the tile (not dead center), like a real wheel.
    const target = land * step + step / 2 - width / 2 + (Math.random() - 0.5) * step * 0.6;
    const start = performance.now();
    let last = -1;
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const x = target * (1 - Math.pow(1 - t, 4));
      el.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + width / 2) / step);
      if (idx !== last) {
        if (last >= 0) play("reel");
        last = idx;
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else setTimeout(onDone, 450);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div class="spin" ref={box}>
      <div class="spin-marker" aria-hidden="true" />
      <div class="spin-track" ref={track}>
        {tiles.map((t, i) => (
          <TileView key={i} tile={t} look={look} />
        ))}
      </div>
    </div>
  );
}

/**
 * Opening a crate: the server rolls, the strip spins to a tier's present, which unwraps straight to the reveal; or
 * to Fischer Random, which gets its banner and a second spin among its items before the reveal.
 */
function CrateOpening({
  crate,
  force,
  resume,
  onClose,
}: {
  crate: CrateDef;
  force: { fischer?: boolean; shiny?: boolean };
  /** A crate already opened but not seen (you left during the spin): straight to its reveal. */
  resume?: Unseen;
  onClose: () => void;
}) {
  const [result, setResult] = useState<{ roll: CrateRoll; item: ItemInstance } | null>(resume ?? null);
  // "Open another": a boss crate only while you hold one more (greyed at none); the Crates tab's own, always.
  // (A Welcome Crate: another only while a second waits.)
  const welcomeLeft = useAccount().profile?.locker?.welcome?.unopened ?? 0;
  const more = isWelcomeCrate(crate.id) ? welcomeLeft > 0 : !isBossCrate(crate) || heldOf(useAccount().profile?.locker, crate) > 0;
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"spin" | "fischer" | "unwrap" | "spin2" | "reveal">(resume ? "reveal" : "spin");
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (round === 0 && resume) return;
    let here = true;
    setResult(null);
    setStage("spin");
    openCrate(crate.id, force)
      .then((r) => {
        // It's yours now: if you leave before the reveal, it waits for you (the reveal clears it).
        setUnseen({ crate: crate.id, ...r });
        if (here) setResult(r);
      })
      .catch((e) => here && setError(e instanceof Error ? e.message : "Couldn't open the crate."));
    return () => {
      here = false;
    };
  }, [round]);
  const strips = useMemo(() => {
    if (!result) return null;
    const { roll, item } = result;
    const finish = { color: item.color, color2: item.color2 ?? undefined, blemish: item.blemish, seed: item.seed };
    const tier = itemDef(item.def)!.tier as PresentTier;
    return {
      tier,
      one: stripTiles(presentTile(crate), roll.fischer ? { kind: "fischer" } : { kind: "present", tier }, 46, 38),
      // Only Fischer Random spins again; a present opens straight to its item (Eric, Oct 7).
      two: roll.fischer ? stripTiles(itemTile(fischerOdds(crate)), { kind: "item", def: item.def, finish }, 30, 24) : [],
    };
  }, [result]);
  const afterFirst = () => {
    if (!strips) return;
    if (result?.roll.fischer) {
      // (Its banner's 2.5 s and a beat: every banner a second longer, Eric, Oct 15; and the banners' extra, Oct 24.)
      setStage("fischer");
      setTimeout(() => setStage("spin2"), fischerBannerMs() + 200);
    } else {
      setStage("unwrap");
      setTimeout(() => setStage("reveal"), 1150);
    }
  };
  return (
    <div class="crate-opening">
      <h2 class="ff-title">
        <CrateName name={crate.name} />
      </h2>
      {error && <p class="shop-error">{error}</p>}
      {!result && !error && <p class="muted">Opening…</p>}
      {strips && stage === "spin" && <Spin key={`a${round}`} tiles={strips.one} land={38} ms={6200} look={crate.look} onDone={afterFirst} />}
      {strips && stage === "fischer" && (
        <div class="fischer-stage">
          <FightBanner tone="hero" face={<FischerArt />} text="FISCHER RANDOM!" sub={isWelcomeCrate(crate.id) ? "A HunChess ride" : "Legendary or Mythic"} sound="bannerStart" ms={fischerBannerMs()} />
        </div>
      )}
      {strips && stage === "unwrap" && <Unwrap tier={strips.tier} look={crate.look} />}
      {strips && stage === "spin2" && (
        <Spin key={`b${round}`} tiles={strips.two} land={24} ms={4800} look={crate.look} onDone={() => setStage("reveal")} />
      )}
      {result && stage === "reveal" && (
        <Reveal
          item={result.item}
          again={more}
          onAgain={() => setRound((r) => r + 1)}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/** A present (or a supply box) opening: it shakes, then bursts open. */
function Unwrap({ tier, look }: { tier: PresentTier; look: CrateLook }) {
  const t = tierInfo(tier);
  const { Box, box } = CRATE_LOOKS[look];
  useEffect(() => {
    play("select");
  }, []);
  return (
    <div class="present-stage" style={{ "--tier": t.color }}>
      <span class="present-stage-art">
        <Box color={t.color} />
      </span>
      <strong>
        {t.name} {box}
      </strong>
    </div>
  );
}

/** The reveal: an FF-style window with the item, its tier, color, purity and (if so) its shine. */
function Reveal({ item, again = true, onAgain, onClose }: { item: ItemInstance; again?: boolean; onAgain: () => void; onClose: () => void }) {
  const d = itemDef(item.def)!;
  const t = tierInfo(d.tier);
  // (A HunChess ride: no purity, so no shine named either; Eric, Nov 6.)
  const hc = isHunchess(item.def);
  const shiny = !hc && isShiny(item.blemish);
  const special = d.tier === "legendary" || d.tier === "mythic";
  const [worn, setWorn] = useState(false);
  useEffect(() => {
    setUnseen(null);
    play(special || shiny ? "bannerStart" : "select");
  }, []);
  return (
    <div class={`ff-window reveal-card${shiny ? " shiny" : ""}${special ? " special" : ""}`} style={{ "--tier": t.color }}>
      <span class="reveal-tier">{t.name}</span>
      <span class="reveal-art">
        <ItemArt def={item.def} finish={item} />
      </span>
      <strong class="reveal-name">{d.name}</strong>
      <span class="reveal-finish">
        {finishLine(item)}
        {shiny ? " ✨" : ""}
      </span>
      {shiny && <span class="reveal-shiny">Shiny!</span>}
      {hc && <NotTradeable />}
      <span class="reveal-desc">{d.description}</span>
      <div class="reveal-actions">
        <button
          type="button"
          class="ff-button small"
          disabled={worn}
          onClick={() => {
            void equipLockerItem(d.slot, item.id).then(() => setWorn(true));
            play("menuSelect");
          }}
        >
          {worn ? "Wearing it" : "▶ Wear"}
        </button>
        <button type="button" class="ff-button small" disabled={!again} onClick={onAgain}>
          ▶ Open another
        </button>
        <button type="button" class="ff-button small" onClick={onClose}>
          ▶ Done
        </button>
      </div>
    </div>
  );
}

// ---------------- Locker ----------------

type LockerTab = ItemSlot | "all" | "king";
const LOCKER_TABS: readonly LockerTab[] = ["all", "head", "face", "skin", "weapon", "ride", "king"];
const tabName = (t: LockerTab) => (t === "all" ? "All" : t === "king" ? "God King" : SLOT_NAMES[t]);

/**
 * What you own, and the one place to wear it. Crate items, rarest first, with copies of an item in the same color
 * stacked (×3, the purest on top: that's the one you wear). Then what you got in the shop: God King effects. Tap to
 * wear (tap again to take off); hold a crate item (or right-click it) to delete it. Your avatar shows the result (on its ride,
 * if you wear one: Oct 31, in the same box).
 * (The pawn hats are crate items now, from the Beta crate.) An admin's locker has one of everything: an admin copy
 * (core/admin-copies.ts) carries an "Admin" tag, wears like any item and can't be deleted (there's nothing stored).
 */
export function LockerPanel({ onShop }: { onShop?: () => void }) {
  const { profile } = useAccount();
  const [tab, setTab] = useState<LockerTab>("all");
  const [deleting, setDeleting] = useState<ItemStack | null>(null);
  const locker = profile?.locker;
  const shop = profile?.shop;
  if (!locker) return <p class="muted">Your locker needs your account.</p>;
  const top = (s: ItemStack) => s.items[0]!;
  // (An item this app doesn't know, e.g. one added since it loaded, as an admin's copy of it: left out, not a crash.)
  const stacks = stackItems(locker.items)
    .filter((s) => itemDef(top(s).def) && (tab === "all" || itemDef(top(s).def)?.slot === tab))
    .sort((a, b) => tierIndex(top(b).def) - tierIndex(top(a).def) || colorIndex(top(b).color) - colorIndex(top(a).color) || top(a).blemish - top(b).blemish);
  // What you got in the shop: God King effects.
  const fromShop = SHOP_ITEMS.filter((i) => wornFromLocker(i) && shop?.owned.includes(i.id));
  const shopTab = tab === "all" || tab === "king";
  const wornIn = (s: ItemStack) => {
    const slot = itemDef(top(s).def)!.slot;
    return s.items.some((i) => i.id === locker.equipped[slot]);
  };
  return (
    <div class="locker">
      <div class="ff-window locker-preview">
        <span class="locker-avatar">
          <Avatar look={locker.look} side="w" ride />
        </span>
        <span class="locker-avatar">
          <Avatar look={locker.look} side="b" ride />
        </span>
      </div>
      <div class="shop-tabs locker-tabs" role="tablist">
        {LOCKER_TABS.map((t) => (
          <button type="button" role="tab" key={t} aria-selected={tab === t} class={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {tabName(t)}
          </button>
        ))}
      </div>
      {tab !== "king" && !stacks.length && <p class="muted">No crate items here yet. Open a crate!</p>}
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
            return (
              <HoldButton
                key={s.key}
                class={`locker-item${worn ? " worn" : ""}${!hc && isShiny(it.blemish) ? " shiny" : ""}${hc ? " hunchess-item" : ""}`}
                style={{ "--tier": tierInfo(d.tier).color }}
                label={`${d.name}, ${hc ? `HunChess gold and black, not tradeable` : `${colorName(it)}, purity ${purity(it.blemish).toFixed(1)}%`}${s.items.length > 1 ? `, ${s.items.length} of them` : ""}. ${admin ? "Admin copy." : "Hold to delete."}`}
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
                <strong>{d.name}</strong>
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
                {s.items.length > 1 && <span class="locker-count">×{s.items.length}</span>}
                {admin && <span class="locker-admin">Admin</span>}
              </HoldButton>
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
      {deleting && <DeleteDialog stack={deleting} wornId={locker.equipped[itemDef(top(deleting).def)!.slot]} onClose={() => setDeleting(null)} />}
    </div>
  );
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
    navigator.vibrate?.(15);
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
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
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
          Delete {d.name}
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
