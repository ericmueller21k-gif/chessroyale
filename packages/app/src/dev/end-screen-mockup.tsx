import { render } from "preact";
import { useRef, useState } from "preact/hooks";
import "../board/pieces.css";
import "../styles.css";
import "../board-size.css";
import "../game-frame.css";
import "../tower.css";
import { applyMove, toSan } from "@chessroyale/chess";
import { XP, floorBossCount, type QuestView } from "@chessroyale/core";
import { floorRating } from "../tower.ts";
import type { MoveRecord } from "../game.ts";
import { Breakdown } from "../components/Breakdown.tsx";
import { GameFrame, type FrontNav } from "../components/FrontMenu.tsx";
import { MOUSE_LAYOUT, MatchMenu } from "../components/MatchMenu.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import { Board } from "../components/Board.tsx";
import { renderSoundsWav, unlockAudio } from "../sound.ts";
import {
  EarnedSlot,
  EndDuo,
  EndHeadline,
  QuestRows,
  Track,
  useEndSequence,
  useTrackRefs,
  type EndLog,
  type EndPlanStep,
  type QuestMove,
  type TrackPlan,
} from "../components/EndScreen.tsx";

/**
 * Dev only (not in the build; /end-screen-mockup.html on `npm run dev`): the end screen mockup of Nov 20 on made-up results.
 *   ?s=win       a Battle Tower floor won (3 bosses), +150 XP, two quests moved
 *   ?s=levelup   the same, a quest done (+300 in the XP) and a level reached
 *   ?s=loss      a floor lost, 1 life left: Defeat, the bosses gloating, +60 XP
 *   ?s=ranked    ranked 1 v 1 won: RP +18 then XP, over the board
 *   ?s=rankdown  ranked 1 v 1 lost: RP −14, the bar going down
 *   ?theme=dark|light, ?go=wait (starts on window.__esGo(): the video), ?name=Eric
 */
const q = new URLSearchParams(location.search);
const scenario = q.get("s") ?? "win";
document.documentElement.dataset.theme = q.get("theme") === "dark" ? "dark" : "light";
const who = q.get("name") ?? "Eric";

const log: EndLog = [];
let go: () => void = () => undefined;
const start = q.get("go") === "wait" ? new Promise<void>((r) => (go = r)) : undefined;
Object.assign(window, {
  __esLog: log,
  __esGo: () => go(),
  __esDone: false,
  // The video's sound: the log, rendered offline, as WAV bytes (base64), from `from` (epoch ms) on.
  __esWav: async (from: number, seconds: number) => {
    const wav = await renderSoundsWav(
      log.map((e) => ({ at: Math.max(0, (e.at - from) / 1000), name: e.name, k: e.k, low: e.low })),
      seconds,
    );
    let s = "";
    for (const b of wav) s += String.fromCharCode(b);
    return btoa(s);
  },
});

const nav = new Proxy({}, { get: () => () => undefined }) as FrontNav;

/** A short game you (White) won, as the review's records: every move of yours with the engine's best. */
function fakeGame(): MoveRecord[] {
  const line = ["e2e4","e7e5","g1f3","b8c6","f1c4","g8f6","f3g5","d7d5","e4d5","f6d5","g5f7","e8f7","d1f3","f7e6","b1c3","c6b4","a2a3","b4c2","e1d1","c2a1","c3d5","e6d6","d2d4","c7c6","c1f4","e5f4","d5f4","d8b6","f3e3"];
  const best: Record<number, string> = { 16: "c3d5" };
  const out: MoveRecord[] = [];
  let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  line.forEach((m, i) => {
    if (i % 2 === 0) {
      const b = best[i] ?? m;
      const loss = b === m ? 0 : 1.4;
      out.push({ stage: 1, round: i / 2 + 1, fen, move: m, san: toSan(fen, m), loss, roundScore: b === m ? 1 : -1.4, bestMove: b });
    }
    fen = applyMove(fen, m);
  });
  return out;
}

const quest = (id: string, name: string, goal: string, progress: number, target: number, icon: QuestView["icon"], xp = 300, period: QuestView["period"] = "daily"): QuestView => ({
  id,
  period,
  name,
  goal,
  progress,
  target,
  icon,
  reward: { xp },
  canReroll: false,
});

const levelPlan = (before: number, earned: number): TrackPlan => ({
  kind: "xp",
  before,
  earned,
  per: XP.perLevel,
  label: (at) => `Level ${1 + Math.floor(at / XP.perLevel)}`,
  who,
});
const DIVS = ["Gold 4", "Gold 3", "Gold 2", "Gold 1", "Platinum 5"];
const EMBLEMS = ["gold-d4", "gold-d3", "gold-d2", "gold-d1", "platinum-d5"];
const rpPlan = (before: number, earned: number): TrackPlan => ({
  kind: "rp",
  before,
  earned,
  per: 80,
  label: (at) => DIVS[Math.floor(at / 80)] ?? "Gold",
  emblem: (at) => EMBLEMS[Math.floor(at / 80)] ?? null,
  who,
});

const nextLine = (n: number) => `Next: floor ${n} · ${floorBossCount(n)} ${floorBossCount(n) === 1 ? "boss" : "bosses"} · rating ${floorRating(n)}`;

interface TowerCase {
  tone: "win" | "loss";
  title: string;
  line: string;
  bosses: string[];
  xp: TrackPlan;
  quests: QuestMove[];
  next: string;
}

const CASES: Record<string, TowerCase> = {
  win: {
    tone: "win",
    title: "Victory!",
    line: "Floor 3 cleared!",
    bosses: ["Tiger", "Big Boy", "Sawyer"],
    xp: levelPlan(1120, 150),
    quests: [
      { quest: quest("warm-up", "Warm Up", "Finish 3 games", 2, 3, { kind: "board", piece: "pawn" }), from: 1 },
      { quest: quest("regular", "Regular", "Complete 10 games", 7, 10, { kind: "board", piece: "knight" }, 1500, "weekly"), from: 6 },
    ],
    next: nextLine(4),
  },
  levelup: {
    tone: "win",
    title: "Victory!",
    line: "Floor 3 cleared!",
    bosses: ["Tiger", "Big Boy", "Sawyer"],
    xp: levelPlan(1880, 450),
    quests: [
      { quest: quest("warm-up", "Warm Up", "Finish 3 games", 3, 3, { kind: "board", piece: "pawn" }), from: 2 },
      { quest: quest("regular", "Regular", "Complete 10 games", 7, 10, { kind: "board", piece: "knight" }, 1500, "weekly"), from: 6 },
    ],
    next: nextLine(4),
  },
  loss: {
    tone: "loss",
    title: "Defeat",
    line: "Floor 4 lost · 1 life left",
    bosses: ["Wrangler", "Smudgy", "Big Boy"],
    xp: levelPlan(1270, 60),
    quests: [{ quest: quest("warm-up", "Warm Up", "Finish 3 games", 3, 3, { kind: "board", piece: "pawn" }), from: 2 }],
    next: nextLine(5),
  },
};

function TowerScreen({ c }: { c: TowerCase }) {
  const xpSlot = useRef<HTMLSpanElement>(null);
  const xpRefs = useTrackRefs();
  const qBox = useRef<HTMLDivElement>(null);
  const pawn = useRef<HTMLDivElement>(null);
  const [lvlAt, setLvlAt] = useState(0);
  const [moves] = useState(fakeGame);
  // (A computer's boss result has no gear: Settings is in the side menu, Eric, Nov 3.)
  const computer = useMedia(MOUSE_LAYOUT);
  const steps: EndPlanStep[] = [{ plan: c.xp, slot: xpSlot, refs: xpRefs }];
  useEndSequence(steps, qBox, {
    log,
    start,
    onLevel: () => {
      setLvlAt(Date.now());
      pawn.current?.classList.remove("es-lvl-on");
      void pawn.current?.offsetWidth;
      pawn.current?.classList.add("es-lvl-on");
    },
    onDone: () => Object.assign(window, { __esDone: true }),
  });
  return (
    <GameFrame nav={nav}>
      <div class="screen results mm-screen boss-results">
        <div class="results-top">
          {!computer && (
            <div class="mm-corner">
              <MatchMenu exit={null} />
            </div>
          )}
          <EndHeadline title={c.title} line={c.line} tone={c.tone} />
          <EarnedSlot kind="xp" slot={xpSlot} />
          <EndDuo names={c.bosses} result={c.tone} lvlAt={lvlAt} pawnRef={pawn} />
          <Track plan={c.xp} refs={xpRefs} />
          <QuestRows moves={c.quests} box={qBox} />
          <div class="tw-result">
            <p class="tw-result-sub">{c.next}</p>
            <div class="actions">
              <button type="button" class="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
                Back to the tower
              </button>
            </div>
          </div>
        </div>
        <div class="results-review">
          <Breakdown inline moves={moves} dp={1} solo estRating={1728} />
        </div>
      </div>
    </GameFrame>
  );
}

function RankedScreen({ won }: { won: boolean }) {
  const rpSlot = useRef<HTMLSpanElement>(null);
  const xpSlot = useRef<HTMLSpanElement>(null);
  const rpRefs = useTrackRefs();
  const xpRefs = useTrackRefs();
  const qBox = useRef<HTMLDivElement>(null);
  const rp = won ? rpPlan(80 + 27, 18) : rpPlan(80 + 9, -14);
  const xp = won ? levelPlan(4410, 150) : levelPlan(4410, 90);
  const quests: QuestMove[] = won
    ? [
        { quest: quest("winner", "Winner", "Win 2 online games", 1, 2, { kind: "board", piece: "rook" }), from: 0 },
        { quest: quest("warm-up", "Warm Up", "Finish 3 games", 2, 3, { kind: "board", piece: "pawn" }), from: 1 },
      ]
    : [{ quest: quest("warm-up", "Warm Up", "Finish 3 games", 2, 3, { kind: "board", piece: "pawn" }), from: 1 }];
  useEndSequence(
    [
      { plan: rp, slot: rpSlot, refs: rpRefs },
      { plan: xp, slot: xpSlot, refs: xpRefs },
    ],
    qBox,
    { log, start, onDone: () => Object.assign(window, { __esDone: true }) },
  );
  return (
    <GameFrame nav={nav}>
      <div class="screen es-ranked">
        <div class="es-ranked-board" aria-hidden="true">
          <Board fen="r1bq1k1r/pppp1Qp1/2n2pN1/8/2B5/8/P4PPP/b4RK1 b - - 0 16" orientation="white" small animate={false} />
        </div>
        <div class="es-ranked-over">
          <div class={`es-card ${won ? "es-win" : "es-loss"}`}>
            <EndHeadline title={won ? "Victory!" : "Defeat"} line={won ? "You won by checkmate." : "Mira won by checkmate."} tone={won ? "win" : "loss"} plain />
            <div class={`es-earned es-earned-rp${won ? "" : " es-down"}`}>
              <span class="es-earned-label">RP EARNED</span>
              <span class="es-earned-num" ref={rpSlot}>
                {won ? "+0" : "−0"}
              </span>
            </div>
            <Track plan={rp} refs={rpRefs} />
            <EarnedSlot kind="xp" slot={xpSlot} />
            <Track plan={xp} refs={xpRefs} />
            <QuestRows moves={quests} box={qBox} />
            <div class="dv-result-actions">
              <button type="button" class="btn btn-primary">
                Play again
              </button>
              <button type="button" class="btn btn-secondary">
                Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </GameFrame>
  );
}

function App() {
  // (Sound: a tap anywhere wakes the page's audio, as the app's first tap does.)
  return scenario === "ranked" || scenario === "rankdown" ? <RankedScreen won={scenario === "ranked"} /> : <TowerScreen c={CASES[scenario] ?? CASES.win!} />;
}

addEventListener("pointerdown", () => unlockAudio(), { once: true });
render(<App />, document.getElementById("app")!);
