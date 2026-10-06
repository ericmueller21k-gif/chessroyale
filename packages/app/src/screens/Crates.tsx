import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  CRATES,
  CRATES_FREE,
  FISCHER,
  ITEM_COLORS,
  PURITY_BANDS,
  SLOT_NAMES,
  TIERS,
  crateDef,
  equippedLook,
  isShiny,
  itemChance,
  presentChance,
  presentItems,
  itemColor,
  itemDef,
  purity,
  rollBlemish,
  tierInfo,
  type CrateDef,
  type CrateRoll,
  type ItemInstance,
  type ItemSlot,
  type PresentTier,
} from "@chessroyale/core";
import { account, equipLockerItem, openCrate } from "../account.ts";
import { Avatar, CrateArt, FischerArt, ItemArt, KeyArt, PresentArt } from "../components/Items.tsx";
import { FightBanner } from "../components/FightBanner.tsx";
import { play, unlockAudio } from "../sound.ts";
import { useAccount } from "./Profile.tsx";

const tierIndex = (def: string) => TIERS.findIndex((t) => t.id === itemDef(def)?.tier);
const colorIndex = (c: string) => ITEM_COLORS.findIndex((x) => x.id === c);
const pct = (x: number) => (x >= 0.01 ? `${(x * 100).toFixed(x >= 0.1 ? 0 : 1)}%` : `${(x * 100).toFixed(2)}%`);

/** An item's one-line finish: "Emerald · Purity 91.5%". */
/** Its colour name (both, for a two-colour item). */
export const colorName = (it: { color: string; color2?: string | null }) => itemColor(it.color).name + (it.color2 ? ` & ${itemColor(it.color2).name}` : "");
export const finishLine = (it: { color: string; color2?: string | null; blemish: number }) => `${colorName(it)} · Purity ${purity(it.blemish).toFixed(1)}%`;

// ---------------- Crates ----------------

/** Your crates and keys, and each crate's page: what's inside and the odds, and the button to open one. */
export function CratesPanel() {
  const { profile } = useAccount();
  const [open, setOpen] = useState<CrateDef | null>(null);
  const locker = profile?.locker;
  const count = (n: number | null | undefined) => (n === null || n === undefined ? "∞" : String(n));
  if (open) return <CratePage crate={open} onBack={() => setOpen(null)} />;
  return (
    <div class="crates">
      <div class="crate-stock">
        <span class="stock">
          <span class="stock-art">
            <KeyArt />
          </span>
          Keys × {count(locker?.keys)}
        </span>
      </div>
      {CRATES.map((c) => (
        <button type="button" key={c.id} class="ff-window crate-row" onClick={() => setOpen(c)}>
          <span class="crate-row-art">
            <CrateArt />
          </span>
          <span class="crate-row-text">
            <strong>{c.name}</strong>
            <span>× {count(locker?.crates)}</span>
          </span>
          <span class="ff-cursor" aria-hidden="true">
            ▶
          </span>
        </button>
      ))}
      {CRATES_FREE && <p class="shop-note">Crates and keys are unlimited while we test.</p>}
    </div>
  );
}

function CratePage({ crate, onBack }: { crate: CrateDef; onBack: () => void }) {
  const q = new URLSearchParams(location.search);
  const [forceFischer, setForceFischer] = useState(q.get("fischer") === "1");
  const [forceShiny, setForceShiny] = useState(q.get("shiny") === "1");
  const [opening, setOpening] = useState(false);
  const items = [...crate.items, ...crate.fischer.map((s) => s.item)];
  if (opening) return <CrateOpening crate={crate} force={{ fischer: forceFischer, shiny: forceShiny }} onClose={() => setOpening(false)} />;
  return (
    <div class="crate-page">
      <button type="button" class="btn btn-secondary btn-small" onClick={onBack}>
        ‹ Crates
      </button>
      <div class="ff-window crate-hero">
        <span class="crate-hero-art">
          <CrateArt />
        </span>
        <strong>{crate.name}</strong>
      </div>
      <h3 class="ff-title">Presents</h3>
      <p class="small muted">The crate holds a present for each tier, in its colour. A present opens to one of its tier's items, each as likely as the others.</p>
      <div class="odds-list">
        {crate.strip.map(({ tier }) => {
          if (tier === FISCHER)
            return (
              <div key={tier} class="odds-row" style={{ "--tier": "#fbbf24" }}>
                <span class="odds-art">
                  <FischerArt />
                </span>
                <span class="odds-text">
                  <strong>Fischer Random</strong>
                  <span class="odds-tier">A second spin: Exalted or Transcendent</span>
                </span>
                <span class="odds-pct">{pct(presentChance(crate, tier))}</span>
              </div>
            );
          const t = tierInfo(tier);
          const n = presentItems(crate, tier).length;
          return (
            <div key={tier} class="odds-row" style={{ "--tier": t.color }}>
              <span class="odds-art">
                <PresentArt color={t.color} />
              </span>
              <span class="odds-text">
                <strong>{t.name} present</strong>
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
          const special = d.tier === "exalted" || d.tier === "transcendent";
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
        <summary>Colours and purity</summary>
        <p class="small">Every item also rolls a colour and a purity, 0-100%. The lower its purity, the more it's blotched (at 0%, all over, a shade darker). At 90% or more it's shiny ✨ (about 1 in 250).</p>
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
      {CRATES_FREE && (
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
      <button
        type="button"
        class="ff-button"
        onClick={() => {
          // (A tap: the moment a phone allows sound, so the strip's clicks are heard.)
          unlockAudio();
          play("menuSelect");
          setOpening(true);
        }}
      >
        ▶ Open · uses 1 key
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

/** A decoy's look, by the real colour and purity odds (so the strip doesn't make a shiny look common). */
const decoyFinish = () => ({ color: pickWeighted(ITEM_COLORS).id, color2: pickWeighted(ITEM_COLORS).id, blemish: rollBlemish(Math.random), seed: Math.floor(Math.random() * 2 ** 31) });

/** A strip of tiles: decoys drawn by `pick`, the result at `land`. */
function stripTiles(pick: () => Tile, landTile: Tile, length: number, land: number): Tile[] {
  return Array.from({ length }, (_, i) => (i === land ? landTile : pick()));
}

/** The crate's strip: presents by the odds, Fischer Random a little more often than it lands (to tease). */
const presentTile = (crate: CrateDef) => (): Tile => {
  const { tier } = pickWeighted(crate.strip.map((x) => (x.tier === FISCHER ? { ...x, weight: x.weight * 3 } : x)));
  return tier === FISCHER ? { kind: "fischer" } : { kind: "present", tier };
};
/** A second spin's decoys: items by their odds. */
const itemTile = (list: readonly { item: string; weight: number }[]) => (): Tile => ({ kind: "item", def: pickWeighted(list).item, finish: decoyFinish() });

function TileView({ tile }: { tile: Tile }) {
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
    return (
      <span class="spin-tile present" style={{ "--tier": t.color }}>
        <PresentArt color={t.color} />
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
 * The strip: it races past a centre marker, slows (ease-out) and lands on the result, with a click for every
 * tile that passes (fast, then slower and slower).
 */
function Spin({ tiles, land, ms, onDone }: { tiles: Tile[]; land: number; ms: number; onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current!;
    const first = el.children[0] as HTMLElement;
    const step = first.offsetWidth + 6;
    const width = box.current!.offsetWidth;
    // Land somewhere inside the tile (not dead centre), like a real wheel.
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
          <TileView key={i} tile={t} />
        ))}
      </div>
    </div>
  );
}

/**
 * Opening a crate: the server rolls, the strip spins to a tier's present (or Fischer Random), the present unwraps,
 * a second spin picks among its tier's items (when it holds more than one), then the reveal.
 */
function CrateOpening({ crate, force, onClose }: { crate: CrateDef; force: { fischer?: boolean; shiny?: boolean }; onClose: () => void }) {
  const [result, setResult] = useState<{ roll: CrateRoll; item: ItemInstance } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"spin" | "fischer" | "unwrap" | "spin2" | "reveal">("spin");
  const [round, setRound] = useState(0);
  useEffect(() => {
    setResult(null);
    setStage("spin");
    openCrate(crate.id, force)
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't open the crate."));
  }, [round]);
  const strips = useMemo(() => {
    if (!result) return null;
    const { roll, item } = result;
    const finish = { color: item.color, color2: item.color2 ?? undefined, blemish: item.blemish, seed: item.seed };
    const tier = itemDef(item.def)!.tier as PresentTier;
    const inside = roll.fischer ? crate.fischer : presentItems(crate, tier).map((def) => ({ item: def, weight: 1 }));
    return {
      tier,
      many: inside.length > 1,
      one: stripTiles(presentTile(crate), roll.fischer ? { kind: "fischer" } : { kind: "present", tier }, 46, 38),
      two: stripTiles(itemTile(inside), { kind: "item", def: item.def, finish }, 30, 24),
    };
  }, [result]);
  const afterFirst = () => {
    if (!strips) return;
    if (result?.roll.fischer) {
      setStage("fischer");
      setTimeout(() => setStage("spin2"), 1700);
    } else {
      setStage("unwrap");
      setTimeout(() => setStage(strips.many ? "spin2" : "reveal"), 1150);
    }
  };
  return (
    <div class="crate-opening">
      <h2 class="ff-title">{crate.name}</h2>
      {error && <p class="shop-error">{error}</p>}
      {!result && !error && <p class="muted">Opening…</p>}
      {strips && stage === "spin" && <Spin key={`a${round}`} tiles={strips.one} land={38} ms={6200} onDone={afterFirst} />}
      {strips && stage === "fischer" && (
        <div class="fischer-stage">
          <FightBanner tone="hero" face={<FischerArt />} text="FISCHER RANDOM!" sub="Exalted or Transcendent" sound="bannerStart" />
        </div>
      )}
      {strips && stage === "unwrap" && <Unwrap tier={strips.tier} />}
      {strips && stage === "spin2" && (
        <Spin key={`b${round}`} tiles={strips.two} land={24} ms={result?.roll.fischer ? 4800 : 3400} onDone={() => setStage("reveal")} />
      )}
      {result && stage === "reveal" && (
        <Reveal
          item={result.item}
          onAgain={() => setRound((r) => r + 1)}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/** A present unwrapping: it shakes, then bursts open. */
function Unwrap({ tier }: { tier: PresentTier }) {
  const t = tierInfo(tier);
  useEffect(() => {
    play("select");
  }, []);
  return (
    <div class="present-stage" style={{ "--tier": t.color }}>
      <span class="present-stage-art">
        <PresentArt color={t.color} />
      </span>
      <strong>{t.name} present</strong>
    </div>
  );
}

/** The reveal: an FF-style window with the item, its tier, colour, purity and (if so) its shine. */
function Reveal({ item, onAgain, onClose }: { item: ItemInstance; onAgain: () => void; onClose: () => void }) {
  const d = itemDef(item.def)!;
  const t = tierInfo(d.tier);
  const shiny = isShiny(item.blemish);
  const special = d.tier === "exalted" || d.tier === "transcendent";
  const [worn, setWorn] = useState(false);
  useEffect(() => {
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
        <button type="button" class="ff-button small" onClick={onAgain}>
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

/** What you own, rarest first; tap to wear it (tap again to take it off). Your avatar shows the result. */
export function LockerPanel() {
  const { profile } = useAccount();
  const [slot, setSlot] = useState<ItemSlot | "all">("all");
  const locker = profile?.locker;
  const hat = equippedLook(account().profile?.shop, "hat").hat ?? "none";
  if (!locker) return <p class="muted">Your locker needs your account.</p>;
  const items = locker.items
    .filter((i) => slot === "all" || itemDef(i.def)?.slot === slot)
    .sort((a, b) => tierIndex(b.def) - tierIndex(a.def) || colorIndex(b.color) - colorIndex(a.color) || a.blemish - b.blemish);
  return (
    <div class="locker">
      <div class="ff-window locker-preview">
        <span class="locker-avatar">
          <Avatar look={locker.look} side="w" hat={hat} />
        </span>
        <span class="locker-avatar">
          <Avatar look={locker.look} side="b" hat={hat} />
        </span>
      </div>
      <div class="shop-tabs" role="tablist">
        {(["all", "head", "face", "skin", "weapon"] as const).map((s) => (
          <button type="button" role="tab" key={s} aria-selected={slot === s} class={slot === s ? "on" : ""} onClick={() => setSlot(s)}>
            {s === "all" ? "All" : SLOT_NAMES[s]}
          </button>
        ))}
      </div>
      {!items.length && <p class="muted">Nothing here yet. Open a crate!</p>}
      <div class="locker-grid">
        {items.map((it) => {
          const d = itemDef(it.def)!;
          const worn = locker.equipped[d.slot] === it.id;
          return (
            <button
              type="button"
              key={it.id}
              class={`locker-item${worn ? " worn" : ""}${isShiny(it.blemish) ? " shiny" : ""}`}
              style={{ "--tier": tierInfo(d.tier).color }}
              onClick={() => {
                play("menuSelect");
                void equipLockerItem(d.slot, worn ? null : it.id);
              }}
            >
              <ItemArt def={it.def} finish={it} />
              <strong>{d.name}</strong>
              <span class="small">{colorName(it)}</span>
              <span class="small muted">
                {purity(it.blemish).toFixed(1)}%{isShiny(it.blemish) ? " ✨" : ""}
              </span>
              {worn && <span class="locker-worn">Worn</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { crateDef };
