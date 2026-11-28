/**
 * MOCKUP ONLY (Nov 28, rank piece sets for the shop: not in the build, not for merge). `npm run dev`, then /rank-pieces-mockup.html.
 *
 *   ?view=boards&rank=<gold|sublime|pearlescent>&px=370[&wide=1]   each style on the rank's board and on the default board
 *   ?view=kq&rank=<id>&px=370                                       A and B with only the king and queen in the set
 *   ?view=closeup&rank=<id>                                         every piece of every style at three sizes
 *   ?view=marks                                                     the last move, the picked square, a capture ring and check under every style
 *   ?view=numbers                                                   white against black, measured (window.__rankPieces)
 *   ?view=settings                                                  Settings, with the new switch
 *   ?view=menu                                                      the in-game options, with the new switch
 */
import { render, type ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import "../board/pieces.css";
import "../styles.css";
import { OwnBoard } from "../board/OwnBoard.tsx";
import { RankEmblem } from "../components/RankEmblem.tsx";
import { MatchMenu, SwitchRow } from "../components/MatchMenu.tsx";
import { SettingsScreen } from "../screens/Settings.tsx";
import { skinCss, skinOf, skinVars, type Skin } from "./town-shop-skins.ts";
import { RANKS, RIM, ROLES, STYLES, piecesCss, rankOf, setClass, type RankSet, type StyleId } from "./rank-pieces.ts";

const q = new URLSearchParams(location.search);
const view = q.get("view") ?? "boards";
const rank = rankOf(q.get("rank") ?? "gold");

/** The middlegame: an Italian, 16. Nhf5 just played (1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 a6 8. Bb3 Ba7
 * 9. h3 h6 10. Nbd2 Re8 11. Nf1 Be6 12. Bc2 d5 13. exd5 Bxd5 14. Ng3 Qd7 15. Nh4 Rad8 16. Nhf5). */
const FEN = "3rr1k1/bppq1pp1/p1n2n1p/3bpN2/8/2PP2NP/PPB2PP1/R1BQR1K1 b - - 5 16";
const LAST = "h4f5";

/** The default board (Classic: the page's own variables) as a "skin", for its two colors in the strips. */
const CLASSIC = { light: "#f0d9b5", dark: "#c0ad90" };

function SetBoard({ skin, cls, px, coords = true, marks, fen = FEN, last = LAST }: { skin: Skin | null; cls: string; px: number; coords?: boolean; marks?: Record<string, string>; fen?: string; last?: string }) {
  const fw = Math.max(3, Math.round(px * 0.0135));
  return (
    <div class={`${cls}${skin ? ` skin-${skin.id} skin-framed` : ""}`} style={{ width: `${px}px`, height: `${px}px`, "--fw": `${fw}px`, ...(skin ? skinVars(skin) : {}) }}>
      <OwnBoard fen={fen} orientation="white" lastMove={last} marks={marks} animate={false} silent small={!coords} />
    </div>
  );
}

const STYLE_ROWS: readonly { id: StyleId | "default"; name: string; note: string }[] = [...STYLES, { id: "default", name: "Today's pieces", note: "for comparison" }];
const clsOf = (r: RankSet, s: StyleId | "default", kq = false) => (s === "default" ? "rp-default" : setClass(r.id, s, kq));

function Head({ title, children }: { title: string; children?: ComponentChildren }) {
  return (
    <header class="rp-head">
      <RankEmblem id={rank.emblem} scale={2} />
      <div>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
    </header>
  );
}

/** Each style on the rank's own board and on the default board. Phone: a row a style. `wide`: a column a style. */
function Boards() {
  const px = Number(q.get("px") ?? 370);
  const wide = q.get("wide") === "1";
  const skin = skinOf(rank.id);
  const cell = (s: (typeof STYLE_ROWS)[number], sk: Skin | null) => (
    <figure class="rp-cell">
      <figcaption>
        <strong>{s.name}</strong>
        <em>{sk ? `${skin.name}` : "Default board"}</em>
      </figcaption>
      <SetBoard skin={sk} cls={clsOf(rank, s.id)} px={px} />
    </figure>
  );
  return (
    <div class="sheet">
      <Head title={`${rank.name} pieces: the three styles`}>
        A real middlegame (an Italian, 16. Nhf5 just played, so f5 and h4 carry the last move). {wide ? "Top" : "Left"}: on the {skin.name}. {wide ? "Bottom" : "Right"}: on the default board. Boards are{" "}
        {px} px wide{px < 500 ? ", a phone's size" : ", a computer's size"}.
      </Head>
      {wide ? (
        <div class="rp-grid" style={{ gridTemplateColumns: `repeat(${STYLE_ROWS.length}, ${px}px)` }}>
          {STYLE_ROWS.map((s) => cell(s, skin))}
          {STYLE_ROWS.map((s) => cell(s, null))}
        </div>
      ) : (
        <div class="rp-grid" style={{ gridTemplateColumns: `repeat(2, ${px}px)` }}>
          {STYLE_ROWS.map((s) => [cell(s, skin), cell(s, null)])}
        </div>
      )}
    </div>
  );
}

/** A and B with only the king and queen in the set; the other pieces are today's. */
function KingQueen() {
  const px = Number(q.get("px") ?? 370);
  const skin = skinOf(rank.id);
  const styles = STYLES.filter((s) => s.id !== "solid");
  return (
    <div class="sheet">
      <Head title={`${rank.name} pieces: the king and queen only`}>
        The cheaper purchase: only your king and queen wear the rank's colors, every other piece is today's. Left: on the {skin.name}. Right: on the default board. Boards are {px} px wide.
      </Head>
      <div class="rp-grid" style={{ gridTemplateColumns: `repeat(2, ${px}px)` }}>
        {styles.map((s) =>
          [skin, null].map((sk) => (
            <figure class="rp-cell">
              <figcaption>
                <strong>{s.name}</strong>
                <em>{sk ? skin.name : "Default board"} · king and queen only</em>
              </figcaption>
              <SetBoard skin={sk} cls={clsOf(rank, s.id, true)} px={px} />
            </figure>
          )),
        )}
      </div>
    </div>
  );
}

/** A strip of squares with pieces on them (the board's own piece elements). */
function Strip({ cells, sq, colors, cls }: { cells: readonly { piece: string; mark?: string }[]; sq: number; colors: { light: string; dark: string }; cls: string; }) {
  return (
    <div class={`rp-strip hb-pieces ${cls}`} style={{ width: `${cells.length * sq}px`, height: `${sq}px` }}>
      {cells.map((c, i) => (
        <span class="rp-sq" style={{ left: `${i * sq}px`, width: `${sq}px`, height: `${sq}px`, background: i % 2 ? colors.dark : colors.light }}>
          {c.mark && <i class={`rp-mark ${c.mark}`} />}
          <piece class={c.piece} style={{ width: "100%", height: "100%" }} />
        </span>
      ))}
    </div>
  );
}

const TWELVE = (["white", "black"] as const).flatMap((side) => ROLES.map((role) => ({ piece: `${role} ${side}` })));

/** Every piece of every style at three sizes, in real pixels (the page is shot at 1x). */
function Closeup() {
  const skin = skinOf(rank.id);
  const sizes = [
    { sq: 92, name: "Phone", note: "a 46 px square on a phone's 2x screen: 92 real pixels" },
    { sq: 80, name: "Computer", note: "an 80 px square, 1x" },
    { sq: 160, name: "2x", note: "the computer's square twice as big" },
  ];
  // (Each piece on a light and on a dark square: the second strip starts on the other color.)
  const flip = [TWELVE[0]!, ...TWELVE];
  return (
    <div class="sheet">
      <Head title={`${rank.name} pieces: close up`}>
        King, queen, rook, bishop, knight and pawn, white then black, in each style, at three sizes. First strip of each pair: the {skin.name}'s squares. Second: the default board's, starting on the other
        color, so every piece shows on a light and on a dark square. The border is {RIM} of the piece's 45 units: about 2 px on a phone, 4 px on a computer.
      </Head>
      {STYLE_ROWS.map((s) => (
        <section class="rp-close">
          <h2>
            {s.name} <em>{s.note}</em>
          </h2>
          {sizes.map((z) => (
            <div class="rp-close-size">
              <span class="rp-close-label">
                <strong>{z.name}</strong>
                <em>{z.note}</em>
              </span>
              <div>
                <Strip cells={TWELVE} sq={z.sq} colors={skin} cls={clsOf(rank, s.id)} />
                <div class="rp-clip" style={{ width: `${12 * z.sq}px` }}>
                  <div style={{ marginLeft: `${-z.sq}px` }}>
                    <Strip cells={flip} sq={z.sq} colors={CLASSIC} cls={clsOf(rank, s.id)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** The marks check, at a phone's size: each mark under a white and a black piece, on a light and a dark square. */
function Marks() {
  const sq = 46;
  const MARKS = [
    { cls: "bcol-last", name: "Last move", piece: "knight" },
    { cls: "bcol-sel", name: "Picked", piece: "queen" },
    { cls: "bcol-ring", name: "Capture ring", piece: "pawn" },
    { cls: "rp-check", name: "Check", piece: "king" },
  ];
  // (white on light, white on dark, black on light, black on dark: the strip alternates light, dark, so the order is w, w, b, b.)
  const cells = MARKS.flatMap((m) => [`${m.piece} white`, `${m.piece} white`, `${m.piece} black`, `${m.piece} black`].map((piece) => ({ piece, mark: m.cls })));
  const rows: { r: RankSet; s: (typeof STYLE_ROWS)[number] }[] = RANKS.flatMap((r) => STYLE_ROWS.map((s) => ({ r, s })));
  return (
    <div class="sheet">
      <header class="rp-head">
        <div>
          <h1>The marks under every style, at a phone's size (46 px squares)</h1>
          <p>
            Each mark four times: a white piece on a light and on a dark square, then a black piece on a light and on a dark square. Left: on the rank's own board. Right: on the default board. The marks are
            the board's own (the last move, the picked square, the capture ring, today's red check glow).
          </p>
        </div>
      </header>
      <div class="rp-marks-head" style={{ paddingLeft: "230px" }}>
        {[0, 1].map(() => (
          <div class="rp-marks-names" style={{ width: `${16 * sq}px` }}>
            {MARKS.map((m) => (
              <span style={{ width: `${4 * sq}px` }}>{m.name}</span>
            ))}
          </div>
        ))}
      </div>
      {rows.map(({ r, s }) => {
        const skin = skinOf(r.id);
        return (
          <div class={`rp-marks-row${s.id === "default" ? " rp-marks-end" : ""}`}>
            <span class="rp-marks-label">
              <strong>{r.name}</strong>
              <em>{s.name}</em>
            </span>
            <div style={skinVars(skin)}>
              <Strip cells={cells} sq={sq} colors={skin} cls={clsOf(r, s.id)} />
            </div>
            <div>
              <Strip cells={cells} sq={sq} colors={CLASSIC} cls={clsOf(r, s.id)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- White against black, in numbers: the lightness (0 black to 1 white) of each fill along its gradient, and the contrast between the two fills.
// (B and B-solid keep today's fills, pure white and pure black: 21 to 1 by construction. Only A changes them.)

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const mixHex = (a: string, b: string, t: number) => {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
};
/** The gradient's lightness at 101 points along it. */
const along = (stops: readonly (readonly [number, string])[]) =>
  Array.from({ length: 101 }, (_, i) => {
    const t = i / 100;
    const k = Math.max(1, stops.findIndex(([at]) => at >= t));
    const [a, ca] = stops[k - 1]!;
    const [b, cb] = stops[k]!;
    return lum(mixHex(ca, cb, Math.min(1, Math.max(0, (t - a) / (b - a)))));
  });
function Numbers() {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const ratio = (hi: number, lo: number) => r2((hi + 0.05) / (lo + 0.05));
  const out: Record<string, unknown> = {};
  for (const r of RANKS) {
    const w = along(r.white);
    const b = along(r.black);
    const mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length;
    out[r.id] = {
      whiteFill: `${r2(Math.min(...w))} to ${r2(Math.max(...w))}`,
      blackFill: `${r2(Math.min(...b))} to ${r2(Math.max(...b))}`,
      // (The whole fills, and the hardest pair: the white fill's darkest end against the black fill's lightest end.)
      contrastOfMeans: ratio(mean(w), mean(b)),
      contrastWorstEnds: ratio(Math.min(...w), Math.max(...b)),
      // (B: the rim's lightest and darkest stop against each square it sits on: the rank board's two, the default board's two.)
      rim: Object.fromEntries(
        Object.entries({ rankLight: skinOf(r.id).light, rankDark: skinOf(r.id).dark, defaultLight: CLASSIC.light, defaultDark: CLASSIC.dark }).map(([name, sq]) => {
          const rs = r.rim.map(([, c]) => lum(c));
          const c = (v: number) => ratio(Math.max(v, lum(sq)), Math.min(v, lum(sq)));
          return [name, { gradientBest: Math.max(...rs.map(c)), gradientWorst: Math.min(...rs.map(c)), solid: c(lum(r.solid)) }];
        }),
      ),
    };
  }
  (window as unknown as { __rankPieces: unknown }).__rankPieces = out;
  return <pre id="numbers">{JSON.stringify(out, null, 2)}</pre>;
}

// ---- The setting: "Always default board and pieces", in Settings and in a match's options.

function Menu() {
  useEffect(() => {
    document.querySelector<HTMLButtonElement>(".mm-more")?.click();
  }, []);
  return (
    <div class="rp-menu">
      <div class="rp-menu-top">
        <MatchMenu exit={{ kind: "resign", note: "You lose this game.", go: () => {} }} extra={<SwitchRow icon="♟" label={q.get("label") ?? "Default board and pieces"} on={q.get("plain") === "1"} onClick={() => {}} />} />
      </div>
      <SetBoard skin={skinOf("gold")} cls={clsOf(RANKS[0]!, "b")} px={Math.min(innerWidth, 600) - 20} />
    </div>
  );
}

const CSS = `
html, body { margin: 0; }
body.rp-sheet { background: #1d2230; color: #eef1f6; font-family: system-ui, sans-serif; }
.sheet { display: inline-block; padding: 24px 28px 30px; background: #1d2230; }
.rp-head { display: flex; align-items: center; gap: 16px; margin: 0 0 18px; max-width: 1500px; }
.rp-head h1 { margin: 0 0 4px; font-size: 24px; }
.rp-head p { margin: 0; font-size: 14px; line-height: 1.4; color: #b9c1d0; }
.rp-grid { display: grid; gap: 22px 20px; }
.rp-cell { margin: 0; }
.rp-cell figcaption { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 0 0 6px; font-size: 14px; }
.rp-cell figcaption em { font-style: normal; color: #b9c1d0; font-size: 12.5px; }
.rp-strip { position: relative; }
.rp-sq { position: absolute; top: 0; display: block; }
.rp-sq piece { position: absolute; inset: 0; }
.rp-mark { position: absolute; inset: 0; }
.rp-check { background: radial-gradient(ellipse at center, rgba(255, 0, 0, 1) 0%, rgba(231, 0, 0, 1) 25%, rgba(169, 0, 0, 0) 89%, rgba(158, 0, 0, 0) 100%); }
.rp-close { margin: 0 0 26px; }
.rp-close h2 { margin: 0 0 8px; font-size: 18px; }
.rp-close h2 em, .rp-close-label em, .rp-marks-label em { font-style: normal; font-weight: 400; color: #b9c1d0; font-size: 12.5px; }
.rp-close-size { display: flex; align-items: center; gap: 14px; margin: 0 0 10px; }
.rp-close-label { width: 150px; display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
.rp-clip { overflow: hidden; }
.rp-marks-head, .rp-marks-row { display: flex; align-items: center; gap: 16px; margin: 0 0 6px; }
.rp-marks-names { display: flex; font-size: 12.5px; color: #b9c1d0; }
.rp-marks-names span { text-align: center; }
.rp-marks-label { width: 214px; display: flex; flex-direction: column; font-size: 13.5px; }
.rp-marks-end { margin-bottom: 22px; }
.rp-menu { min-height: 100vh; padding: 10px; box-sizing: border-box; }
.rp-menu-top { display: flex; justify-content: flex-end; padding: 0 0 10px; }
`;

function App() {
  if (view === "settings") return <SettingsScreen onBack={() => {}} onFaq={() => {}} />;
  if (view === "menu") return <Menu />;
  document.body.classList.add("rp-sheet");
  if (view === "kq") return <KingQueen />;
  if (view === "closeup") return <Closeup />;
  if (view === "marks") return <Marks />;
  if (view === "numbers") return <Numbers />;
  return <Boards />;
}

const style = document.createElement("style");
style.textContent = `${CSS}\n${skinCss()}\n${piecesCss()}`;
document.head.append(style);
render(<App />, document.getElementById("app")!);
