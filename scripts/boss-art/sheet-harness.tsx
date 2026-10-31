/**
 * The contact sheet item-render.ts shows for `mode: "sheet"`: every drawing in `virtual:drafts` (each a module's exports)
 * on a pawn at phone size, at rest and mid-motion, plus existing items by id (`window.__REQ.extra`), then `__DONE`.
 */
import { render } from "preact";
import * as SHEET from "virtual:drafts";
import { Label, OnPawn, RefOnPawn, RiderView, fin } from "./item-harness.tsx";
import type { ItemDraft, RiderDraft } from "./item-kit.tsx";

interface Req {
  /** Per drawing id, the color it's shown in (default red). */
  colors?: Record<string, string>;
  /** Existing items shown too, by id, with a label. */
  extra?: { def: string; label: string; color?: string }[];
  title?: string;
  /** More looks of a drawing, after the pieces: its id, a color, an existing item worn over it, a label. */
  looks?: { id: string; color: string; over?: string; label: string }[];
}
const req = (window as unknown as { __REQ: Req }).__REQ;
const mods = Object.values(SHEET as Record<string, Record<string, unknown>>);
const pieces = mods.flatMap((m) => Object.values(m)).filter((v): v is ItemDraft | RiderDraft => !!v && typeof v === "object" && "frame" in v && ("Art" in v || "Back" in v));
const isRider = (d: ItemDraft | RiderDraft): d is RiderDraft => "Back" in d;

function Piece({ d }: { d: ItemDraft | RiderDraft }) {
  const color = req.colors?.[d.id] ?? "red";
  const f = fin(color, 15, 777);
  const n = isRider(d) ? d.move.ms.length : d.motion.ms.length;
  const mid = Math.floor(n / 2);
  return (
    <div style={{ background: "#1f2228", borderRadius: "12px", padding: "8px" }}>
      <div style={{ font: "bold 14px sans-serif", color: "#f2c14e", marginBottom: "6px" }}>
        {d.name} <span style={{ color: "#9ca3af", fontWeight: "normal" }}>({isRider(d) ? "ride" : d.slot}, {d.tier}) · {d.id}</span>
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        {isRider(d) ? (
          <>
            <div>
              <RiderView d={d} finish={f} side="w" anim="idle" f={0} scale={0.8} />
              <Label>at rest</Label>
            </div>
            <div>
              <RiderView d={d} finish={f} side="w" anim="move" f={mid} scale={0.8} move />
              <Label>moving</Label>
            </div>
            <div>
              <RiderView d={d} finish={f} side="b" anim="idle" f={0} scale={0.45} />
              <Label>town</Label>
            </div>
          </>
        ) : (
          <>
            <div>
              <OnPawn d={d} finish={f} side="w" f={0} px={130} />
              <Label>at rest</Label>
            </div>
            <div>
              <OnPawn d={d} finish={f} side="w" f={mid} px={130} />
              <Label>{n > 1 ? "its motion" : "still"}</Label>
            </div>
            <div>
              <OnPawn d={d} finish={f} side="b" f={0} px={60} />
              <Label>60 px</Label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

render(
  <div style={{ padding: "12px", background: "#14161b", width: "1460px" }}>
    <div style={{ font: "bold 20px sans-serif", color: "#f2c14e", marginBottom: "10px" }}>{req.title ?? "Contact sheet"}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
      {pieces.map((d) => (
        <Piece key={d.id} d={d} />
      ))}
      {req.looks?.length ? (
        <div style={{ background: "#1f2228", borderRadius: "12px", padding: "8px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            {req.looks.map((l) => {
              const d = pieces.find((p) => p.id === l.id);
              return d && !isRider(d) ? (
                <div key={l.label}>
                  <OnPawn d={d} finish={fin(l.color, 15, 777)} side="w" f={0} px={130} over={l.over} />
                  <Label>{l.label}</Label>
                </div>
              ) : null;
            })}
          </div>
        </div>
      ) : null}
      {(req.extra ?? []).map((x) => (
        <div key={x.def} style={{ background: "#1f2228", borderRadius: "12px", padding: "8px" }}>
          <div style={{ font: "bold 14px sans-serif", color: "#f2c14e", marginBottom: "6px" }}>{x.label}</div>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div>
              <RefOnPawn def={x.def} px={130} color={x.color} />
              <Label>still</Label>
            </div>
            <div>
              <RefOnPawn def={x.def} px={60} side="b" color={x.color} />
              <Label>60 px</Label>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>,
  document.getElementById("app")!,
);
requestAnimationFrame(() => ((window as unknown as { __DONE: object }).__DONE = { facts: { pieces: pieces.map((p) => p.id) }, warnings: [] }));
