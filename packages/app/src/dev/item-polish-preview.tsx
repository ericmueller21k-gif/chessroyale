import { render } from "preact";
import "../board/pieces.css";
import "../styles.css";
import { itemColor, itemDef, tierInfo, type ItemLook } from "@chessroyale/core";
import { Avatar, ItemArt } from "../components/Items.tsx";

/**
 * Dev only: the Nov 24 Legendary/Mythic polish mockup (brief: notes/briefs/legendary-mythic-polish.md on the director's notes).
 * Each section shows its item as a card and worn on a white and a black pawn, on a light and a dark panel. `?only=crown`
 * shows one section (the GIF script films them one at a time). `variant` picks a mockup option (Items.tsx `optionOf`).
 */
const q = new URLSearchParams(location.search);
const only = q.get("only");

type Show = { def: string; color: string; color2?: string; variant?: string; label?: string; blemish?: number };
/** `?blemish=30`: every item at that blemish (70% pure: no shine), to measure the animations without the shine. */
const blemishAll = q.get("blemish");
const finish = (s: Show, i: number) => ({ def: s.def, color: s.color, color2: s.color2 ?? null, blemish: blemishAll ? Number(blemishAll) : (s.blemish ?? 8), seed: 7 + i, variant: s.variant });

const Row = ({ s, i, dark }: { s: Show; i: number; dark: boolean }) => {
  const d = itemDef(s.def)!;
  const f = finish(s, i);
  const look: ItemLook = { [d.slot]: f };
  const ink = dark ? "#f1f2f4" : "#1d1d1f";
  return (
    <div style={`display:flex;flex-direction:column;align-items:center;gap:2px;color:${ink};font:11px sans-serif`}>
      <div style="display:flex;gap:2px;align-items:center">
        <div style="width:88px;height:88px">
          <ItemArt def={s.def} finish={f} />
        </div>
        {(["w", "b"] as const).map((side) => (
          <div style="width:88px;height:88px;position:relative">
            <Avatar look={look} side={side} ride />
          </div>
        ))}
      </div>
      <div style="opacity:0.8">
        {s.label ?? itemColor(s.color).name + (d.colors === 2 && s.color2 ? ` & ${itemColor(s.color2).name}` : "")}
      </div>
    </div>
  );
};

const Section = ({ id, title, note, rows }: { id: string; title: string; note: string; rows: Show[] }) => {
  if (only && only !== id) return null;
  const t = tierInfo(itemDef(rows[0]!.def)!.tier);
  return (
    <section id={id} style="padding:10px;background:#2a2d34;border-radius:12px;margin:10px;width:fit-content;max-width:1100px">
      <div style="color:#fff;font:600 15px sans-serif;margin:2px 4px 2px">
        {title} <span style={`color:${t.color};font-weight:800`}>{t.name}</span>
      </div>
      <div style="color:#c9ccd3;font:12px sans-serif;margin:0 4px 8px;max-width:1000px">{note}</div>
      {[false, true].map((dark) => (
        <div style={`display:flex;flex-wrap:wrap;gap:14px;padding:8px;border-radius:8px;margin-top:6px;background:${dark ? "#14161a" : "#eef0f3"}`}>
          {rows.map((s, i) => (
            <Row s={s} i={i} dark={dark} />
          ))}
        </div>
      ))}
    </section>
  );
};

const SECTIONS: { id: string; title: string; note: string; rows: Show[] }[] = [
  {
    id: "crown",
    title: "Fire & Ice Crown (rebuilt)",
    note: "Real flames rise out of the ice (no more floating tips), layered: the item's color outside, lighter inside, a near-white core; a soft glow and the odd ember. Calm flicker, each flame at its own pace. The ice stays ice.",
    rows: [
      { def: "fire-ice-crown", color: "red" },
      { def: "fire-ice-crown", color: "cobalt" },
      { def: "fire-ice-crown", color: "emerald" },
      { def: "fire-ice-crown", color: "pearl" },
      { def: "fire-ice-crown", color: "midnight" },
    ],
  },
  {
    id: "cane",
    title: "Candy Cane",
    note: "A band of light winds up its stripes from the bottom, round the hook, a sparkle pops at the tip; then a rest of about 4 seconds.",
    rows: [
      { def: "candy-cane", color: "red" },
      { def: "candy-cane", color: "emerald" },
      { def: "candy-cane", color: "cobalt" },
    ],
  },
  {
    id: "tube",
    title: "Gift-Wrap Tube",
    note: "Lead (left two): every few seconds its stripes wind up two turns like a barber pole and a sparkle pings at the tip. Option (right two): a small puff of confetti in its colors from the tip.",
    rows: [
      { def: "gift-tube", color: "red", label: "Barber pole (pick)" },
      { def: "gift-tube", color: "cobalt", label: "Barber pole (pick)" },
      { def: "gift-tube", color: "red", variant: "confetti", label: "Confetti puff" },
      { def: "gift-tube", color: "cobalt", variant: "confetti", label: "Confetti puff" },
    ],
  },
  {
    id: "parrot",
    title: "Parrot",
    note: "Pick: a quick double flap of its wing every 6 seconds. Option: a curious head tilt instead.",
    rows: [
      { def: "parrot", color: "emerald", color2: "red", label: "Wing flap (pick)" },
      { def: "parrot", color: "cobalt", color2: "yellow", label: "Wing flap (pick)" },
      { def: "parrot", color: "emerald", color2: "red", variant: "tilt", label: "Head tilt" },
    ],
  },
  {
    id: "tommy",
    title: "Tommy Gun",
    note: "A: the drum's winding key turns a notch now and then. B: a tiny puff of smoke from the muzzle. Pick: both, a few seconds apart.",
    rows: [
      { def: "tommy-gun", color: "emerald", color2: "yellow", variant: "drum", label: "A: drum notch" },
      { def: "tommy-gun", color: "red", color2: "sage", variant: "puff", label: "B: muzzle puff" },
      { def: "tommy-gun", color: "cobalt", color2: "red", label: "A + B (pick)" },
    ],
  },
  {
    id: "smiley",
    title: "Smiley Face: expressions (no animation)",
    note: "Six expressions of the same item, drawn in its style. Recommended: the expression comes from the item's seed, like the Gift-Wrap Tube's second color (no stored data, no crate change).",
    rows: [
      { def: "smiley-face", color: "yellow", variant: "smile", label: "Smile", blemish: 0 },
      { def: "smiley-face", color: "yellow", variant: "wink", label: "Wink", blemish: 0 },
      { def: "smiley-face", color: "yellow", variant: "tongue", label: "Tongue", blemish: 0 },
      { def: "smiley-face", color: "yellow", variant: "cool", label: "Cool", blemish: 0 },
      { def: "smiley-face", color: "yellow", variant: "surprised", label: "Surprised", blemish: 0 },
      { def: "smiley-face", color: "yellow", variant: "laughing", label: "Laughing", blemish: 0 },
      { def: "smiley-face", color: "midnight", variant: "wink", label: "Wink (Midnight)", blemish: 0 },
      { def: "smiley-face", color: "pearl", variant: "laughing", label: "Laughing (Pearl)", blemish: 0 },
    ],
  },
  {
    id: "pirate",
    title: "Pirate Hat (OPTIONAL extra)",
    note: "Optional, only if wanted: the skull on the hat winks every 9 seconds. Otherwise the hat stays as it is.",
    rows: [
      { def: "pirate-hat", color: "red", variant: "wink", label: "Skull wink (optional)" },
      { def: "pirate-hat", color: "midnight", variant: "wink", label: "Skull wink (optional)" },
    ],
  },
];

/** `?big=<def>&colors=red,cobalt`: the item's card at 240 px, for drawing (and a pawn wearing it at 240 px). */
const big = q.get("big");
const Big = ({ def }: { def: string }) => (
  <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px">
    {(q.get("colors") ?? "red,cobalt").split(",").map((c, i) => {
      const s: Show = { def, color: c, color2: q.get("color2") ?? "yellow", variant: q.get("variant") ?? undefined };
      const f = finish(s, i);
      return (
        <>
          <div style="width:240px;height:240px;background:#eef0f3">
            <ItemArt def={def} finish={f} />
          </div>
          <div style="width:240px;height:240px;position:relative;background:#14161a">
            <Avatar look={{ [itemDef(def)!.slot]: f }} side="w" ride />
          </div>
        </>
      );
    })}
  </div>
);

render(
  big ? <Big def={big} /> : <div>
    {SECTIONS.map((s) => (
      <Section {...s} />
    ))}
  </div>,
  document.getElementById("app")!,
);
