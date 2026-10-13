import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { SQUADS, type MercItem } from "@chessroyale/core";
import { MERC_ITEMS, type NetWallet } from "@chessroyale/chess/squads";
import { account } from "../account.ts";
import { possessive, type SquadsClient } from "../squads.ts";
import { coinText, itemText, shopRows, squadName, walletOf } from "../squads-view.ts";
import { ChipIcon, CoinIcon, Coins, LockIcon } from "./SquadsBlocks.tsx";

export { CoinIcon, Coins };
import { SquadTag, useNow } from "./SquadsParts.tsx";

/**
 * Mercenary's team shop (Eric, Oct 12; docs/areas/squads.md, "Mercenary"): a quick overlay while your squad waits for
 * its next match (the other match finishing, then the bracket's break), so it adds no time. Anyone on the squad buys
 * from its one wallet and everyone on it sees each purchase as it happens; the items are for the next match only. The
 * other squad's wallet and cart show too (counterplay). The first time an account sees it, a short explainer.
 */

/** The item's own icon (drawn here: these aren't cosmetics, there's no item art for them). */
export function ItemIcon({ item, size = 22 }: { item: MercItem; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const, class: `mc-icon mc-icon-${item}` };
  switch (item) {
    case "stockfish":
      return (
        <svg {...common}>
          <path d="M2.5 12c2.6-4.6 8.4-6.2 12.6-3.3L20.5 5v14l-5.4-3.7C10.9 18.2 5.1 16.6 2.5 12z" fill="currentColor" />
          <circle cx="8.2" cy="11" r="1.3" fill="var(--mc-icon-eye, #fff)" />
        </svg>
      );
    case "blocks":
      return <LockIcon size={size} />;
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 2.2 20 5.3v6.1c0 5-3.4 8.9-8 10.4-4.6-1.5-8-5.4-8-10.4V5.3z" fill="currentColor" />
          <path d="M12 5.2v13.4c2.9-1.3 5-4 5-7.2V7.4z" fill="var(--mc-icon-eye, #fff)" opacity="0.35" />
        </svg>
      );
    case "chip":
      return <ChipIcon size={size} class={common.class} />;
  }
}

/** A squad's cart or kit in a few icons ("×2"), nothing if it's empty. */
export function KitIcons({ counts }: { counts: Readonly<Record<MercItem, number>> }) {
  const have = MERC_ITEMS.filter((it) => (counts[it] ?? 0) > 0);
  if (!have.length) return null;
  return (
    <span class="mc-kit">
      {have.map((it) => (
        <span key={it} class={`mc-kit-item mc-kit-${it}`} title={itemText(it).name}>
          <ItemIcon item={it} size={14} />
          {counts[it]! > 1 ? `×${counts[it]}` : ""}
        </span>
      ))}
    </span>
  );
}

/** The explainer is shown once per account (on this device). */
const seenKey = () => `brc.mercenary.seen.${account().profile?.user.id ?? "guest"}`;
function seenExplainer(): boolean {
  try {
    return localStorage.getItem(seenKey()) === "1";
  } catch {
    return true;
  }
}
function markExplainer() {
  try {
    localStorage.setItem(seenKey(), "1");
  } catch {
    // No storage: it shows again next time.
  }
}

/** Your squad's open shop, if any (Mercenary, still in, waiting for its next match). */
export function myShop(client: SquadsClient): NetWallet | null {
  const sq = client.mySquad;
  if (!sq || !client.me || client.me.isBot || client.me.left) return null;
  const w = walletOf(client.wallets, sq.id);
  return w?.shop ? w : null;
}

/** The squad your squad meets next (null: not decided yet). */
function nextOpponent(client: SquadsClient, round: number): number | null {
  const mine = client.mySquad?.id;
  const b = client.lobby?.bracket.find((x) => x.round === round && x.squads.includes(mine ?? -1));
  if (!b) return null;
  return b.squads.find((x) => x !== null && x !== mine) ?? null;
}

/**
 * The shop overlay: shown while your squad's shop is open, until its next match starts. "Hide" folds it into a pill to
 * watch the boards; the pill opens it again.
 */
export function MercenaryShop({ client }: { client: SquadsClient }) {
  const w = myShop(client);
  const round = w?.shop?.round ?? null;
  const [hidden, setHidden] = useState<number | null>(null);
  const [explain, setExplain] = useState(false);
  useLayoutEffect(() => {
    if (w && !seenExplainer()) setExplain(true);
  }, [!!w]);
  if (!w || round === null) return null;
  if (hidden === round) {
    return (
      <button type="button" class="mc-shop-pill" onClick={() => setHidden(null)} aria-label={`Open the shop: ${coinText(w.coins)} coins`}>
        <ShopBagIcon />
        Shop
        <Coins n={w.coins} />
      </button>
    );
  }
  return <ShopSheet client={client} w={w} round={round} explain={explain} onExplained={() => (markExplainer(), setExplain(false))} onHide={() => setHidden(round)} />;
}

function ShopBagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round">
      <path d="M4.5 8h15l-1.2 12.5h-12.6z" />
      <path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" stroke-linecap="round" />
    </svg>
  );
}

function ShopSheet({ client, w, round, explain, onExplained, onHide }: { client: SquadsClient; w: NetWallet; round: number; explain: boolean; onExplained: () => void; onHide: () => void }) {
  const now = useNow(250);
  const rows = shopRows(w);
  const them = nextOpponent(client, round);
  const theirs = them === null ? null : walletOf(client.wallets, them);
  const secs = w.shop?.until ? Math.max(0, Math.ceil((w.shop.until - now) / 1000)) : null;
  const final = round === 2;
  // Purchases on your squad, the last few (live), and catch-up if it came this round.
  const log = client.shopLog.filter((x) => now - x.at < 60_000).slice(-3);
  const catchUp = client.catchUp && now - client.catchUp.at < 120_000 ? client.catchUp : null;
  // (A purchase on screen at once: its row's count and the wallet change when the server's "wallets" comes.)
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setBusy(null), [w.coins, JSON.stringify(w.cart)]);
  const act = (item: MercItem, undo: boolean) => {
    setBusy(`${item}${undo ? "-" : "+"}`);
    client.buy(item, undo);
  };
  return (
    <section class="mc-shop" role="dialog" aria-label="Mercenary shop">
      <header class="mc-shop-head">
        <h2>
          <ShopBagIcon />
          Mercenary shop
        </h2>
        <span class="mc-shop-when muted">{secs !== null ? `${final ? "The final" : "Next match"} in ${secs} s` : "Next match: when the other one ends"}</span>
        <button type="button" class="mc-shop-hide" onClick={onHide}>
          Hide
        </button>
      </header>
      <p class="mc-shop-line">Spend your coins on items for the next round or save them for later.</p>
      {explain && (
        <div class="mc-explain" role="note">
          <strong>Mercenary</strong>
          <span>
            Your squad shares one wallet. Every match you play pays coins, more for a win; captures, mates and brilliant
            moves add to it, and the squad that has earned less gets catch-up coins. Anyone on your squad can buy, and items last for your next match only: use them
            or lose them. Each item costs {SQUADS.mercenary.priceStep} more for every one your squad has already bought.
          </span>
          <button type="button" class="fd-btn small" onClick={onExplained}>
            Got it
          </button>
        </div>
      )}
      <div class="mc-wallets">
        <span class="mc-wallet you">
          <SquadTag id={w.squadId} you />
          <Coins n={w.coins} class="big" />
        </span>
        {theirs && them !== null && (
          <span class="mc-wallet them" title={`${possessive(squadName(them))} wallet and cart`}>
            <SquadTag id={them} />
            <Coins n={theirs.coins} />
            <KitIcons counts={theirs.cart} />
          </span>
        )}
      </div>
      {catchUp && (
        <p class="mc-catchup">
          Catch-up: <Coins n={catchUp.coins} /> ({catchUp.against >= 0 ? `${squadName(catchUp.against)} had earned more` : "the other squad had earned more"})
        </p>
      )}
      <ul class="mc-items">
        {rows.map((r) => {
          const t = itemText(r.item, SQUADS);
          return (
            <li key={r.item} class={`mc-item${r.count ? " in" : ""}`}>
              <span class="mc-item-icon">
                <ItemIcon item={r.item} size={26} />
              </span>
              <span class="mc-item-text">
                <strong>{t.name}</strong>
                <span class="mc-item-line">{t.line}</span>
              </span>
              <span class="mc-item-buy">
                <span class="mc-item-count" aria-label={r.item === "chip" ? `${r.count} held of ${r.cap}` : `${r.count} of ${r.cap} for this round`}>
                  {r.count}/{r.cap}
                </span>
                {r.inCart > 0 && (
                  <button type="button" class="mc-minus" aria-label={`Put back a ${t.name}`} disabled={!!busy} onClick={() => act(r.item, true)}>
                    −
                  </button>
                )}
                <button type="button" class="mc-plus" disabled={!r.can || !!busy} onClick={() => act(r.item, false)} aria-label={r.why === "cap" ? (r.item === "chip" ? `${t.name}: as many as a squad may hold` : `${t.name}: as many as one round allows`) : `Buy a ${t.name} for ${r.price} coins`}>
                  {r.why === "cap" ? (
                    "Max"
                  ) : (
                    <>
                      <CoinIcon size={12} />
                      {coinText(r.price)}
                    </>
                  )}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {log.length > 0 && (
        <p class="mc-feed" aria-live="polite">
          {log.map((x, i) => (
            <span key={i}>
              {x.by === client.myId ? "You" : client.nameOf(x.by)} {x.undo ? "put back" : "bought"} {itemText(x.item).one}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
