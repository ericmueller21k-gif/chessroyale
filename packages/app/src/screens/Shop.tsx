import { useState } from "preact/hooks";
import { SHOP_CATEGORIES, SHOP_FREE, SHOP_ITEMS, chatPack, type ShopSlot } from "@chessroyale/core";
import { buyShopItem, equipShopItem } from "../account.ts";
import { HattedPawn, KingEffectPreview } from "../components/Cosmetics.tsx";
import { play } from "../sound.ts";
import { useAccount } from "./Profile.tsx";
import { CratesPanel, LockerPanel } from "./Crates.tsx";

/**
 * The shop: cosmetics by category. Get an item (free while we test), then
 * equip it; one equipped per category. Your choices are saved to your account.
 */
export function ShopScreen({ onBack, initial }: { onBack: () => void; initial?: "shop" | "crates" | "locker" }) {
  const { profile, config } = useAccount();
  const [slot, setSlot] = useState<ShopSlot>("king");
  // (A profile's "Open locker" opens it on the locker.)
  const [area, setArea] = useState<"shop" | "crates" | "locker">(() => initial ?? (new URLSearchParams(location.search).has("crates") ? "crates" : "shop"));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shop = profile?.shop;
  const category = SHOP_CATEGORIES.find((c) => c.slot === slot)!;
  const act = async (id: string, fn: (id: string) => Promise<void>) => {
    setBusy(id);
    setError(null);
    try {
      await fn(id);
      play("menuSelect");
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
          <div class="shop-tabs" role="tablist">
            {SHOP_CATEGORIES.map((c) => (
              <button type="button" role="tab" key={c.slot} aria-selected={c.slot === slot} class={c.slot === slot ? "on" : ""} onClick={() => setSlot(c.slot)}>
                {c.name}
              </button>
            ))}
          </div>
          <p class="muted small">{category.blurb}</p>
          {error && <p class="shop-error">{error}</p>}
          <div class="shop-grid">
            {SHOP_ITEMS.filter((i) => i.slot === slot).map((item) => {
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
          <p class="muted small shop-soon">{slot === "chat" ? "Quick chat is in online 50 v 50 matches and boss raids: preset lines only, no typing." : "Coming later: King kill moves and more animations."}</p>
        </>
      )}
        </>
      )}
    </div>
  );
}
