/**
 * Chandy's art preview (Nov 16; docs/decisions/2026-11-16-chandy-art.md): everything drawn for him, in the game's own components and
 * styles, before his rules wire him. Admins only, at /chandy in the app (main.tsx), or `npm run dev` then /chandy-preview.html. Not in
 * any menu.
 *
 * - His figure: every animation (idle, point, fire, aim, stow) at every rifle stage (0 to 5), and his clones (level, down, a teleport's
 *   blink and appear, the afterimage's fade).
 * - The board: each power's art on the shared board-effects canvas (the lock-on with its pips, scatter shot, the beam, shields, rapid
 *   fire, the queen lock's aim and shot), over the game's pieces.
 * - The upgrade window at each stage (2 s), and Dodge played through: the scope-in, the slide, the blank board, a vote with three
 *   teleports, the lock, the flash, the blasts, the result.
 *
 * Test hooks: `window.__chandyPreview` (what's playing).
 */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { CHANDY, CHANDY_CLONE, RIFLE_STAGES, STAGES, chandyAnim, type RifleStage } from "../characters/chandy.ts";
import { BoardEffects, SpriteAnim, type BoardItem } from "../components/BossEffect.tsx";
import { ChandyUpgrade, UPGRADE_MS } from "../components/ChandyUpgrade.tsx";
import { ChandyDodge, type DodgeLine, type DodgeView } from "../components/ChandyDodge.tsx";
import "../board/pieces.css";
import "../styles.css";

const FEN = "r1bqk2r/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R";
const NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const pieces = () => {
  const out: { sq: string; color: string; kind: string }[] = [];
  FEN.split("/").forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else out.push({ sq: `${"abcdefgh"[f]}${8 - i}`, color: ch === ch.toUpperCase() ? "white" : "black", kind: NAMES[ch.toLowerCase()]! }), f++;
    }
  });
  return out;
};
const xy = (sq: string) => ["abcdefgh".indexOf(sq[0]!), 8 - Number(sq[1])] as const;

type Power = "lock" | "scatter" | "beam" | "shields" | "rapid" | "queenAim" | "queenShot";
function powerItems(p: Power, since: number): BoardItem[] {
  const sq = (square: string, name: BoardItem["name"], anim?: string, then?: string): BoardItem => ({ square, name, anim, then, since, quiet: false });
  switch (p) {
    case "lock":
      return [sq("c3", "chandyCrosshair")];
    case "scatter":
      return [sq("g5", "chandyScatterBurst"), ...["f5", "h5", "g4", "h4"].map((s) => sq(s, "chandyScatter"))];
    case "beam":
      return [
        ..."abdefgh".split("").map((f) => sq(`${f}3`, "chandyBeam", "rowIn", "row")),
        ...[1, 2, 4, 5, 6, 7, 8].map((r) => sq(`c${r}`, "chandyBeam", "colIn", "col")),
        sq("c3", "chandyBeam", "crossIn", "cross"),
      ];
    case "shields":
      return [sq("e7", "chandyShield"), sq("c6", "chandyShield")];
    case "rapid":
      return ["c3", "f3", "d4"].map((s) => sq(s, "chandyDizzy"));
    case "queenAim":
      return [sq("d1", "chandyCrosshair", "lock", "held"), ...[8, 7, 6, 5, 4, 3, 2].map((r) => sq(`d${r}`, "chandyQueenAim"))];
    case "queenShot":
      return [sq("d1", "chandyCrosshair", "held"), ...[8, 7, 6, 5].map((r) => sq(`d${r}`, "chandyRound", "trail")), sq("d5", "chandyRound", "fly"), sq("d4", "chandyShatter")];
  }
}

/** Dodge round 3 on a timeline (ms from its start): the phases, the three teleports, the votes. */
function dodgeAt(t: number, t0: number, pick: string | undefined, onPick: (s: string) => void): DodgeView {
  const L = (rank: number, side: "left" | "right", since?: number): DodgeLine => ({ rank, side, since });
  const F = (file: string, since?: number): DodgeLine => ({ file, since });
  const base = { side: "white" as const, king: "e1", center: "e4", round: 3 as const, onPick, mine: pick };
  if (t < 600) return { ...base, phase: "scope", since: t0, lines: [] };
  if (t < 1200) return { ...base, phase: "slide", since: t0 + 600, lines: [] };
  if (t < 1600) return { ...base, phase: "open", since: t0 + 1200, lines: [] };
  const v0 = t0 + 1600;
  const tp = [800, 1400, 1800].map((ms) => v0 + ms);
  const now = t0 + t;
  // The safe square moves f3, f4, e4, e5 as the h-file clone, the e8 clone and the a-file clone teleport.
  let lines: DodgeLine[] = [L(5, "left"), L(4, "right"), F("d"), F("e")];
  const ghosts: DodgeLine[] = [];
  if (now >= tp[0]!) (lines = [L(5, "left"), L(3, "right", tp[0]), F("d"), F("e")]), ghosts.push(L(4, "right", tp[0]));
  if (now >= tp[1]!) (lines = [L(5, "left"), L(3, "right"), F("d"), F("f", tp[1])]), ghosts.push(F("e", tp[1]));
  if (now >= tp[2]!) (lines = [L(4, "left", tp[2]), L(3, "right"), F("d"), F("f")]), ghosts.push(L(5, "left", tp[2]));
  const recent = ghosts.filter((g) => now - (g.since ?? 0) < 700);
  const teleport = tp.some((s) => now >= s && now - s < 400);
  const votes: Record<string, number> = now < tp[0]! ? { f3: 3 } : now < tp[1]! ? { f3: 1, f4: 3 } : now < tp[2]! ? { f4: 1, e4: 3 } : { e4: 1, e5: 4 };
  if (pick) votes[pick] = (votes[pick] ?? 0) + 1;
  if (t < 1600 + 3000) return { ...base, phase: "vote", since: v0, lines, ghosts: recent, votes, endsAt: v0 + 3000, teleport };
  const placed = pick ?? "e5";
  const hit = placed !== "e5";
  if (t < 1600 + 3000 + 700) return { ...base, phase: "locked", since: v0 + 3000, lines, placed };
  if (t < 1600 + 3000 + 700 + 700) return { ...base, phase: "blast", since: v0 + 3700, lines, placed, result: hit ? "hit" : undefined };
  return { ...base, phase: "result", since: v0 + 4400, lines, placed, result: hit ? "hit" : "dodged" };
}

const CSS = `
.chp { padding: 12px 16px 40px; color: var(--ink, #e8eaf0); background: var(--bg, #14161b); min-height: 100vh; font: 14px system-ui, sans-serif; box-sizing: border-box; }
.chp h1 { font-size: 18px; margin: 0 0 4px; }
.chp h2 { font-size: 15px; margin: 18px 0 6px; }
.chp-note { margin: 4px 0; opacity: 0.75; font-size: 12px; }
.chp-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.chp-row button { min-height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid #3a3f4b; background: #22252d; color: inherit; font: inherit; }
.chp-row button.chp-on { border-color: #f2c14e; color: #f2c14e; }
.chp-figure canvas { image-rendering: pixelated; display: block; }
.chp-board { position: relative; margin-top: 40px; background: repeating-conic-gradient(var(--sq-dark) 0 25%, var(--sq-light) 0 50%) 0 0 / calc(var(--board-size) / 4) calc(var(--board-size) / 4); }
.chp-pieces { position: absolute !important; left: 0; top: 0; }
.chp-fx { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; z-index: 3; pointer-events: none; }
`;

function Preview() {
  const [stage, setStage] = useState<RifleStage>(0);
  const [anim, setAnim] = useState("idle");
  const [animSince, setAnimSince] = useState(Date.now());
  const [clone, setClone] = useState("level");
  const [power, setPower] = useState<{ p: Power; since: number } | null>(null);
  const [upgrade, setUpgrade] = useState<{ stage: Exclude<RifleStage, 0>; since: number } | null>(null);
  const [dodge, setDodge] = useState<{ t0: number; pick?: string } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 50);
    return () => clearInterval(id);
  }, []);
  const now = Date.now();
  if (upgrade && now - upgrade.since > UPGRADE_MS) setUpgrade(null);
  const dodgeView = dodge && now - dodge.t0 < 8000 ? dodgeAt(now - dodge.t0, dodge.t0, dodge.pick, (s) => setDodge((d) => (d ? { ...d, pick: s } : d))) : null;
  (window as unknown as { __chandyPreview: unknown }).__chandyPreview = { stage, anim, power: power?.p ?? null, upgrade: !!upgrade, dodge: dodgeView?.phase ?? null };
  const play = (a: string) => (setAnim(a), setAnimSince(Date.now()));
  const size = Math.min(360, window.innerWidth - 32);
  return (
    <main class="chp">
      <style>{CSS}</style>
      <h1>Chandy · art preview</h1>
      <p class="chp-note">Admins only. His rules aren't wired: this page shows the art in the game's own components.</p>

      <h2>Him, at each rifle stage</h2>
      <div class="chp-row" role="group" aria-label="Rifle stage">
        {STAGES.map((s) => (
          <button type="button" class={s === stage ? "chp-on" : ""} onClick={() => (setStage(s), setAnimSince(Date.now()))}>
            {s}
          </button>
        ))}
      </div>
      <p class="chp-note">{RIFLE_STAGES[stage]}</p>
      <div class="chp-row" role="group" aria-label="Animation">
        {["idle", "point", "fire", "aim", "stow"].map((a) => (
          <button type="button" class={a === anim ? "chp-on" : ""} onClick={() => play(a)}>
            {a}
          </button>
        ))}
      </div>
      <div class="chp-figure">
        <SpriteAnim key={`${anim}:${stage}:${animSince}`} ch={CHANDY} anim={chandyAnim(anim, stage)} then={chandyAnim("idle", stage)} since={animSince} style={{ width: `${CHANDY.w * 2}px`, height: `${CHANDY.h * 2}px` }} />
      </div>

      <h2>His clones (Dodge)</h2>
      <div class="chp-row" role="group" aria-label="Clone">
        {["level", "down", "blinkLevel", "appearLevel", "fadeLevel", "fadeDown"].map((a) => (
          <button type="button" class={a === clone ? "chp-on" : ""} onClick={() => (setClone(a), setAnimSince(Date.now()))}>
            {a}
          </button>
        ))}
      </div>
      <div class="chp-figure">
        <SpriteAnim key={`${clone}:${animSince}`} ch={CHANDY_CLONE} anim={clone} then={clone.endsWith("Down") || clone === "down" ? "down" : "level"} since={animSince} style={{ width: `${CHANDY_CLONE.w}px`, height: `${CHANDY_CLONE.h}px` }} />
      </div>

      <h2>On the board</h2>
      <div class="chp-row" role="group" aria-label="Board art">
        {(["lock", "scatter", "beam", "shields", "rapid", "queenAim", "queenShot"] as Power[]).map((p) => (
          <button type="button" class={power?.p === p ? "chp-on" : ""} onClick={() => (setPower({ p, since: Date.now() }), setDodge(null), setUpgrade(null))}>
            {p}
          </button>
        ))}
      </div>
      <div class="chp-row" role="group" aria-label="Upgrade and Dodge">
        {([1, 2, 3, 4, 5] as const).map((s) => (
          <button type="button" onClick={() => (setUpgrade({ stage: s, since: Date.now() }), setDodge(null))}>
            Upgrade {s}
          </button>
        ))}
        <button type="button" onClick={() => (setDodge({ t0: Date.now() }), setPower(null), setUpgrade(null))}>
          Dodge (round 3)
        </button>
      </div>
      <div class="chp-board" style={{ "--board-size": `${size}px`, width: `${size}px`, height: `${size}px` }}>
        <div class="hb-pieces chp-pieces" style={{ width: `${size}px`, height: `${size}px` }}>
          {pieces().map((pc) => {
            const [x, y] = xy(pc.sq);
            return <piece class={`${pc.color} ${pc.kind}`} style={{ transform: `translate(${x * 100}%, ${y * 100}%)` }} />;
          })}
        </div>
        {power && <BoardEffects items={powerItems(power.p, power.since)} orientation="white" class="chp-fx" />}
        {upgrade && <ChandyUpgrade stage={upgrade.stage} move={["Scatter shot", "Beam", "Shields", "Rapid fire", "Queen lock"][upgrade.stage - 1]} since={upgrade.since} />}
        {dodgeView && <ChandyDodge view={dodgeView} />}
      </div>
      <p class="chp-note">Dodge: tap a square while the vote runs (the safe square ends on e5).</p>
    </main>
  );
}

render(<Preview />, document.getElementById("app")!);
