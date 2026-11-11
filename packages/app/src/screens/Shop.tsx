import type { JSX } from "preact";
import { useLayoutEffect, useState } from "preact/hooks";
import { CHAT_PACKS_SHOP, GOD_KING_SHOP, SHOP, SHOP_CATEGORIES, SHOP_FREE, SHOP_ITEMS, chatPack, chatPickCap, chatSays, pausedLine, shopItem, shopOffersPack, shopPrice, discountLabel, wornFromLocker, type ShopSlot } from "@chessroyale/core";
import { account, buyShopItem } from "../account.ts";
import { openProfile } from "../profile-nav.ts";
import { KingEffectPreview } from "../components/Cosmetics.tsx";
import { BetaCrateArt, BossCrateArt, BundleArt, HunchessCrateArt, KeyArt, MythicCrateArt, WinterCrateArt } from "../components/Items.tsx";
import { play } from "../sound.ts";
import { useAccount } from "./Profile.tsx";
import { CratesPanel, LockerPanel } from "./Crates.tsx";
import { BackButton } from "../components/FrontDoor.tsx";
import { isPaused, useServerStatus } from "../status.ts";

/**
 * The shop: cosmetics by category. Get an item; it goes to your locker, where you wear it
 * with your crate items (one place to wear things, Eric, Oct 8, 2026). Chat packs are yours to use once you have
 * them. Your choices are saved to your account.
 */
export function ShopScreen({ onBack, initial }: { onBack: () => void; initial?: "shop" | "crates" | "locker" | "chat" }) {
  const { profile, config } = useAccount();
  useServerStatus();
  // (A profile's locked quick chat line opens it on the chat packs.)
  // The tabs the shop shows: the God King's effects only with GOD_KING_SHOP, the chat packs only with CHAT_PACKS_SHOP (settings.ts).
  const shopCategories = SHOP_CATEGORIES.filter((c) => (c.slot !== "king" || GOD_KING_SHOP) && (c.slot !== "chat" || CHAT_PACKS_SHOP));
  const [slot, setSlot] = useState<ShopSlot>(initial === "chat" && CHAT_PACKS_SHOP ? "chat" : GOD_KING_SHOP ? "king" : (shopCategories[0]?.slot ?? "king"));
  // (A profile's "Open locker" opens it on the locker.)
  const [area, setArea] = useState<"shop" | "crates" | "locker">(() =>
    initial && initial !== "chat" ? initial : new URLSearchParams(location.search).has("crates") ? "crates" : "shop",
  );
  /** After getting a chat pack: which of its lines went into your quick chat's empty slots, and which didn't fit. */
  const [gotPack, setGotPack] = useState<{ pack: string; added: string[]; left: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shop = profile?.shop;
  // (With every tab hidden, nothing of a hidden tab shows: no blurb, no items.)
  const shown = shopCategories.some((c) => c.slot === slot);
  const category = SHOP_CATEGORIES.find((c) => c.slot === slot) ?? SHOP_CATEGORIES[0]!;
  const act = async (id: string, fn: (id: string) => Promise<void>) => {
    setBusy(id);
    setError(null);
    setGotPack(null);
    const before = account().profile?.shop?.chat;
    try {
      await fn(id);
      play("menuSelect");
      // A chat pack: its lines fill any empty slots in your quick chat; the rest you pick in your profile.
      const pack = shopItem(id)?.slot === "chat" ? chatPack(shopItem(id)!.look.pack ?? "") : undefined;
      const after = account().profile?.shop?.chat;
      if (pack && before && after) {
        const kind = pack.kind === "emoji" ? "emoji" : "lines";
        const added = after[kind].filter((x) => !before[kind].includes(x));
        setGotPack({ pack: pack.id, added, left: pack.lines.filter((l) => !after[kind].includes(l.id)).length });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div class="screen shop">
      <div class="shop-head">
        <BackButton onClick={onBack} />
        <span class="shop-coins" aria-label={`${shop?.coins ?? 0} coins`}>
          🪙 {shop?.coins ?? 0}
        </span>
      </div>
      <div class="area-tabs" role="tablist">
        {(["shop", "crates", "locker"] as const).map((a) => (
          <button type="button" role="tab" key={a} aria-selected={area === a} class={area === a ? "on" : ""} onClick={() => setArea(a)}>
            {a === "shop" ? "Shop" : a === "crates" ? "Crates" : "Locker"}
          </button>
        ))}
      </div>
      {/* (The shop resting, a kill switch: the shop and crates say so; your locker stays.) */}
      {area !== "locker" && isPaused("shop") ? (
        <p class="shop-note">{pausedLine("shop")}</p>
      ) : config?.accounts && profile && area === "crates" ? (
        <CratesPanel />
      ) : config?.accounts && profile && area === "locker" ? (
        <LockerPanel onShop={() => setArea("shop")} />
      ) : (
        <>
      {!shop ? (
        // (Still loading on a first visit: the guest account is being made. Unavailable only once that's known.)
        <p class="muted">{config && (!config.accounts || profile) ? "The shop needs your account, which isn't available here." : "Loading the shop…"}</p>
      ) : (
        <>
          <ShopPage />
          <div class="shop-tabs" role="tablist">
            {shopCategories.map((c) => (
              <button type="button" role="tab" key={c.slot} aria-selected={c.slot === slot} class={c.slot === slot ? "on" : ""} onClick={() => setSlot(c.slot)}>
                {c.name}
              </button>
            ))}
          </div>
          {shown && (
            <p class="muted small">
              {category.blurb}
              {slot !== "chat" && " What you get goes to your Locker, where you wear it."}
            </p>
          )}
          {error && <p class="shop-error">{error}</p>}
          {slot === "chat" && gotPack && <GotPackNote got={gotPack} />}
          <div class="shop-grid">
            {SHOP_ITEMS.filter((i) => shown && i.slot === slot && (i.slot !== "chat" || shopOffersPack(i.look.pack ?? ""))).map((item) => {
              const owned = shop.owned.includes(item.id);
              const equipped = item.slot !== "chat" && shop.equipped[item.slot] === item.id;
              // Chat packs: their lines are the preview, and owning one is all it takes (nothing to equip).
              const pack = item.slot === "chat" ? chatPack(item.look.pack ?? "") : undefined;
              return (
                <div key={item.id} class={`shop-item${equipped ? " equipped" : ""}${pack ? " chat-pack" : ""}`}>
                  <div class="shop-preview">
                    {pack ? (
                      <div class={`chat-pack-lines${pack.kind === "emoji" ? " emoji" : ""}`} aria-label={`${pack.name}: ${pack.lines.map((l) => l.text).join(", ")}`}>
                        {pack.lines.slice(0, pack.kind === "emoji" ? 8 : 4).map((l) => (
                          <span key={l.id}>{l.text}</span>
                        ))}
                        {pack.kind !== "emoji" && pack.lines.length > 4 && <span class="more">+{pack.lines.length - 4} more</span>}
                      </div>
                    ) : (
                      <KingEffectPreview look={item.look} />
                    )}
                  </div>
                  <strong>{item.name}</strong>
                  <span class="muted small">{item.description}</span>
                  {pack && owned ? (
                    <span class="shop-tag">{item.starter ? "Free · yours" : "Yours"}</span>
                  ) : owned && wornFromLocker(item) ? (
                    // Yours: you wear it from the locker, with everything else.
                    <button type="button" class="btn btn-small" onClick={() => setArea("locker")}>
                      {equipped ? "Wearing · Locker ›" : "In your Locker ›"}
                    </button>
                  ) : (
                    <button type="button" class="btn btn-small btn-primary" disabled={busy !== null} onClick={() => void act(item.id, buyShopItem)}>
                      {SHOP_FREE || item.price === 0 ? "Get · Free" : `Buy · 🪙 ${item.price}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {slot === "chat" ? (
            <div class="shop-soon shop-chat-foot">
              <p class="muted small">Quick chat is in online 50 v 50 matches and Boss Battles: preset lines only, no typing.</p>
              <button type="button" class="btn btn-small" onClick={pickInProfile}>
                Choose your lines and emoji in your profile ›
              </button>
            </div>
          ) : (
            GOD_KING_SHOP && <p class="muted small shop-soon">Coming later: King kill moves and more animations.</p>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}

/** Your profile, at its Quick chat and emoji section (closing it comes back to the shop). */
const pickInProfile = () => openProfile({ you: true, name: account().profile?.user.name ?? "", section: "chat" });

/** After getting a chat pack: what went into your quick chat, and a way to pick the rest. */
function GotPackNote({ got }: { got: { pack: string; added: string[]; left: number } }) {
  const pack = chatPack(got.pack);
  if (!pack) return null;
  const kind = pack.kind === "emoji" ? "emoji" : "lines";
  const cap = chatPickCap(kind);
  const words = kind === "emoji" ? "emoji" : "lines";
  return (
    <div class="shop-note shop-got" role="status">
      <p>
        {got.added.length > 0 ? (
          <>
            Added to your quick chat: {chatSays(got.added).map((s) => (kind === "emoji" ? s.text : `“${s.text}”`)).join(kind === "emoji" ? " " : ", ")}.
            {got.left > 0 && ` Your ${words} are full now (${cap}/${cap}).`}
          </>
        ) : (
          `Your quick chat ${words} are full (${cap}/${cap}), so nothing changed in your games yet.`
        )}
      </p>
      {(got.left > 0 || got.added.length === 0) && (
        <button type="button" class="btn btn-small btn-primary" onClick={pickInProfile}>
          Pick these in your profile ›
        </button>
      )}
    </div>
  );
}

type Offer = keyof typeof SHOP.prices;
/** The grid's cards, in the mockup's order (Eric, Nov 9), then the key. Their prices are SHOP.prices; the clock is SHOP.limited. */
const CARDS: readonly { id: Exclude<Offer, "bundle">; name: string; line: string; Art: () => JSX.Element }[] = [
  { id: "boss", name: "Boss Crate", line: "A random boss's crate. Opens without a key.", Art: () => <BossCrateArt /> },
  { id: "hunchess", name: "HunChess Crate", line: "A classic crate with a variety of rewards.", Art: HunchessCrateArt },
  { id: "gift", name: "Gift Crate", line: "A limited-time crate with special rewards.", Art: WinterCrateArt },
  { id: "beta", name: "Beta Crate", line: "A limited-time crate for early supporters.", Art: BetaCrateArt },
  { id: "key", name: "Crate Key", line: "Opens one crate.", Art: KeyArt },
];
const POP = {
  limited: "Limited: a rotating shop item. It leaves the shop when its time is up.",
  soon: "Buying opens soon.",
} as const;

/**
 * The Shop tab's page (Eric's mockup, Nov 9, in our own art): the special offer, then the crates and the key. Look only: a price
 * tapped says "Buying opens soon" (the buttons are there, nothing hidden). With SHOP.discount on, every card and the bundle wear its
 * red ribbon ("50% OFF") and their pills strike the full price through beside the discounted one.
 */
function ShopPage() {
  const [pop, setPop] = useState<keyof typeof POP | null>(null);
  const ribbon = discountLabel();
  const soon = () => setPop("soon");
  return (
    <>
      <p class="muted shop-line">{ribbon ? `Everything in the shop is ${ribbon.replace(" OFF", " off")} during beta.` : "Buying opens soon."}</p>
      <section class="shop-offer" data-offer="bundle" aria-label="Special offer: Crate + Key Bundle">
        <span class="shop-offer-tab">
          <svg viewBox="0 0 20 14" aria-hidden="true">
            <path d="M2 12 L1 3 L6 7 L10 1 L14 7 L19 3 L18 12 Z" fill="currentColor" />
          </svg>
          SPECIAL OFFER
        </span>
        {ribbon && <span class="shop-ribbon">{ribbon}</span>}
        <span class="shop-offer-art">
          <BundleArt />
        </span>
        <div class="shop-offer-text">
          <h2>Crate + Key Bundle</h2>
          <strong>3 Keys + 3 Random Crates</strong>
          <em>
            Includes a chance at a{" "}
            <span class="shop-mythic-icon">
              <MythicCrateArt />
            </span>{" "}
            Mythic Crate.
          </em>
          <Price id="bundle" onTap={soon} />
        </div>
      </section>
      <div class="shop-cards">
        {CARDS.map(({ id, name, line, Art }) => (
          <div key={id} class="shop-card" data-offer={id}>
            {SHOP.limited.includes(id) && (
              <button type="button" class="shop-clock" aria-label={`${name} is limited`} onClick={() => setPop("limited")}>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="10" cy="10" r="7.5" fill="#fffaf0" stroke="#1d1d1f" stroke-width="2" />
                  <path d="M10 5.5 V10 H13.5" fill="none" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            )}
            {ribbon && <span class="shop-ribbon">{ribbon}</span>}
            <span class="shop-card-art">
              <Art />
            </span>
            <strong>{name}</strong>
            <span class="shop-card-line">{line}</span>
            <Price id={id} onTap={soon} />
          </div>
        ))}
      </div>
      {pop && <ShopPop text={POP[pop]} onClose={() => setPop(null)} />}
    </>
  );
}

/** A price pill (a button: look only for now): the coin, the full price struck through while the discount is on, the price to pay. */
function Price({ id, onTap }: { id: Offer; onTap: () => void }) {
  const full = SHOP.prices[id];
  const now = shopPrice(full);
  return (
    <button type="button" class="shop-price" aria-label={now === full ? `${now} coins` : `${now} coins, was ${full}`} onClick={onTap}>
      <span aria-hidden="true">🪙</span>
      {now !== full && <s>{full}</s>}
      <b>{now}</b>
    </button>
  );
}

/** The shop's small pop-up (the limited clock's words, "Buying opens soon"): OK, Escape or a tap outside closes it. */
function ShopPop({ text, onClose }: { text: string; onClose: () => void }) {
  // (A layout effect: an effect waits for a paint, and an Escape pressed as it opened was lost: shop.spec.ts, CI, Nov 11.)
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div class="locker-dialog-back" onClick={onClose}>
      <div class="shop-pop" role="dialog" aria-modal="true" aria-label="Shop" onClick={(e) => e.stopPropagation()}>
        <p>{text}</p>
        <button type="button" class="btn btn-small btn-primary" autoFocus onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}
