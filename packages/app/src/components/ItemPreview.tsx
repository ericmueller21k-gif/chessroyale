import { useEffect } from "preact/hooks";
import { SLOT_NAMES, itemDef, itemName, tierInfo, type ItemLook } from "@chessroyale/core";
import { Avatar, type Finish } from "./Items.tsx";

/**
 * An item's tile frame (Eric, Nov 12: "a nice clean like gold border or like diamond border"): the class a tile adds for its
 * item's tier (core's `TIERS[].frame`: Legendary gold, Mythic diamond; Common to Epic none). The ring is CSS only (`.tier-frame`).
 */
export function frameClass(def: string): string {
  const d = itemDef(def);
  const frame = d && tierInfo(d.tier).frame;
  return frame ? ` tier-frame ${frame}` : "";
}

/**
 * The item preview (Eric, Nov 12: "if you click on them, it should load up like a little box... a preview of like a pawn...
 * utilizing the rider"): a small box over the screen with a plain white pawn wearing just this item (a ride: the pawn on it, in its
 * idle; an outfit or a skin: the pawn in it), its name, its tier and slot, and Close. It reuses the locker's `Avatar`, so every item and
 * every ride works with no per-item work. A tap outside the box or Escape closes it too.
 */
export function ItemPreview({ def, finish, onClose }: { def: string; finish: Finish; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);
  const d = itemDef(def);
  if (!d) return null;
  const t = tierInfo(d.tier);
  const look: ItemLook = { [d.slot]: { def, color: finish.color, color2: finish.color2 ?? undefined, blemish: finish.blemish, seed: finish.seed } };
  return (
    <div class="locker-dialog-back item-preview-back" onClick={onClose}>
      <div
        class={`ff-window locker-dialog item-preview${t.frame ? ` tier-frame ${t.frame}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-preview-title"
        data-item={def}
        style={{ "--tier": t.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <span class="item-preview-pawn">
          <Avatar look={look} side="w" ride outlined live />
        </span>
        <strong id="item-preview-title">{itemName({ def, seed: finish.seed })}</strong>
        <span class="item-preview-tier">
          <span class="item-preview-chip" style={{ background: t.color }}>
            {t.name}
          </span>{" "}
          {SLOT_NAMES[d.slot]}
        </span>
        <button type="button" class="ff-button small" autoFocus onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
