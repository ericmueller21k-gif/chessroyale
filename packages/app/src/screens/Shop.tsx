import { useState } from "preact/hooks";
import { LOCKER_SLOTS, SHOP_CATEGORIES, SHOP_FREE, SHOP_ITEMS, chatPack, chatPickCap, chatSays, shopItem, type ShopSlot } from "@chessroyale/core";
import { account, buyShopItem, equipShopItem } from "../account.ts";
import { openProfile } from "../profile-nav.ts";
import { HattedPawn, KingEffectPreview } from "../components/Cosmetics.tsx";
import { play } from "../sound.ts";
import { useAccount } from "./Profile.tsx";
import { CratesPanel, LockerPanel } from "./Crates.tsx";

/**
 * The shop: cosmetics by category. Get an item (free while we test), then
 * equip it; one equipped per category. Your choices are saved to your account.
 * Pawn hats and God King effects aren't sold here: everyone has them, in the locker (Eric, Oct 8, 2026).
 */
const CATEGORIES = SHOP_CATEGORIES.filter((c) => !(LOCKER_SLOTS as readonly ShopSlot[]).includes(c.slot));
export function ShopScreen({ onBack, initial }: { onBack: () => void; initial?: "shop" | "crates" | "locker" | "chat" }) {
  const { profile, config } = useAccount();
  // (A profile's locked quick chat line opens it on the chat packs.)
  const [slot, setSlot] = useState<ShopSlot>(initial === "chat" ? "chat" : CATEGORIES[0]!.slot);
  // (A profile's "Open locker" opens it on the locker.)
  const [area, setArea] = useState<"shop" | "crates" | "locker">(() =>
    initial && initial !== "chat" ? initial : new URLSearchParams(location.search).has("crates") ? "crates" : "shop",
  );
  /** After getting a chat pack: which of its lines went into your quick chat's empty slots, and which didn't fit. */
  const [gotPack, setGotPack] = useState<{ pack: string; added: string[]; left: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shop = profile?.shop;
  const category = CATEGORIES.find((c) => c.slot === slot) ?? CATEGORIES[0]!;
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
        <button type="button" class="btn btn-secondary" onClick={onBack}>
          ‹ Back
        </button>
        <h1>Shop</h1>
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
      {config?.accounts && profile && area === "crates" ? (
        <CratesPanel />
      ) : config?.accounts && profile && area === "locker" ? (
        <LockerPanel />
      ) : (
        <>
      {SHOP_FREE && <p class="shop-note">Everything is free while we test the shop.</p>}
      {!config?.accounts || !shop ? (
        <p class="muted">The shop needs your account, which isn't available here.</p>
      ) : (
        <>
          <p class="shop-note">
            Your pawn hats and God King effects are in your{" "}
            <button type="button" class="link-button" onClick={() => setArea("locker")}>
              Locker ›
            </button>
          </p>
          <div class="shop-tabs" role="tablist">
            {CATEGORIES.map((c) => (
              <button type="button" role="tab" key={c.slot} aria-selected={c.slot === slot} class={c.slot === slot ? "on" : ""} onClick={() => setSlot(c.slot)}>
                {c.name}
              </button>
            ))}
          </div>
          <p class="muted small">{category.blurb}</p>
          {error && <p class="shop-error">{error}</p>}
          {category.slot === "chat" && gotPack && <GotPackNote got={gotPack} />}
          <div class="shop-grid">
            {SHOP_ITEMS.filter((i) => i.slot === category.slot).map((item) => {
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
                    ) : item.slot === "king" ? (
                      <KingEffectPreview look={item.look} />
                    ) : (
                      <HattedPawn hat={item.look.hat!} />
                    )}
                  </div>
                  <strong>{item.name}</strong>
                  <span class="muted small">{item.description}</span>
                  {pack && owned ? (
                    <span class="shop-tag">{item.starter ? "Free · yours" : "Yours"}</span>
                  ) : equipped ? (
                    <span class="shop-tag">Equipped</span>
                  ) : owned ? (
                    <button type="button" class="btn btn-small" disabled={busy !== null} onClick={() => void act(item.id, equipShopItem)}>
                      Equip
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
          {category.slot === "chat" ? (
            <div class="shop-soon shop-chat-foot">
              <p class="muted small">Quick chat is in online 50 v 50 matches and boss raids: preset lines only, no typing.</p>
              <button type="button" class="btn btn-small" onClick={pickInProfile}>
                Choose your lines and emoji in your profile ›
              </button>
            </div>
          ) : (
            <p class="muted small shop-soon">Coming later: King kill moves and more animations.</p>
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
