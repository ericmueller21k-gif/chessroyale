import { render } from "preact";
import { useState } from "preact/hooks";
import "../board/pieces.css";
import "../styles.css";
import { CRATES, TIERS, itemDef, type CrateRoll, type ItemInstance, type ItemTier } from "@chessroyale/core";
import { CrateOpening } from "../screens/Crates.tsx";
import { unlockAudio } from "../sound.ts";

/**
 * Dev only (`/crate-open-preview.html` on `npm run dev`; not in the build): the game's own crate opening (Crates.tsx `CrateOpening`,
 * crate-open/) with a fake roll, for watching it frame by frame (scripts/crate-open-frames.ts) and measuring its frame rate
 * (scripts/crate-open-perf.mjs). The roll here is made up; the game's is the server's.
 *
 * Query: `tier=`, `look=beta|winter|hunchess`, `fischer=0|1` (Legendary and Mythic come through Fischer Random in the game: on by
 * default for them), `delay=` (ms the fake server takes: 300), `capture=1` (opens at once, no controls).
 */
const q = new URLSearchParams(location.search);
const capture = q.get("capture") === "1";

function fakeRoll(look: string, tier: ItemTier, fischer: boolean, delay: number) {
  const crate = CRATES.find((c) => c.look === look) ?? CRATES[0]!;
  const def = crate.items.find((i) => itemDef(i)?.tier === tier) ?? crate.items[0]!;
  const item: ItemInstance = { id: "preview", def, color: "red", color2: "yellow", blemish: 9, seed: 7 };
  const roll: CrateRoll = { fischer, def, color: item.color, color2: item.color2 ?? undefined, blemish: item.blemish, seed: item.seed };
  return { crate, open: () => new Promise<{ roll: CrateRoll; item: ItemInstance }>((ok) => setTimeout(() => ok({ roll, item }), delay)) };
}

function Page() {
  const [tier, setTier] = useState<ItemTier>((q.get("tier") as ItemTier) ?? "legendary");
  const [look, setLook] = useState(q.get("look") ?? "beta");
  const [open, setOpen] = useState(capture ? 1 : 0);
  const big = tier === "legendary" || tier === "mythic";
  const fischer = q.get("fischer") ? q.get("fischer") === "1" : big;
  const { crate, open: opener } = fakeRoll(look, tier, fischer, Number(q.get("delay") ?? 300));
  return (
    <div style={{ padding: 16, color: "#fff", font: "14px system-ui", display: "grid", gap: 8 }}>
      <h1 class="ff-title">Crate opening · preview</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {TIERS.map((x) => (
          <button type="button" class="ff-button small" style={{ opacity: x.id === tier ? 1 : 0.55 }} onClick={() => setTier(x.id)}>
            {x.name}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {["beta", "winter", "hunchess"].map((l) => (
          <button type="button" class="ff-button small" style={{ opacity: l === look ? 1 : 0.55 }} onClick={() => setLook(l)}>
            {l}
          </button>
        ))}
      </div>
      <button
        type="button"
        class="ff-button cox-play"
        onClick={() => {
          unlockAudio();
          setOpen((n) => n + 1);
        }}
      >
        ▶ Open
      </button>
      {open > 0 && <CrateOpening key={open} crate={crate} force={{}} opener={opener} onClose={() => setOpen(0)} />}
    </div>
  );
}

/** For the frames script: stop every running animation of the opening at `ms` from its start. */
(window as unknown as { __seek: (ms: number) => void }).__seek = (ms: number) => {
  for (const a of (globalThis as { __crateAnims?: Animation[] }).__crateAnims ?? []) {
    a.pause();
    a.currentTime = ms;
  }
};

render(<Page />, document.getElementById("app")!);
