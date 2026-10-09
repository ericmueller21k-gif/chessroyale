import { useEffect, useState } from "preact/hooks";
import { bossThreat } from "@chessroyale/core";
import { useLive, type LiveCounts } from "../live.ts";
import { loadReplays, replayAt, replayView, type ReplayFile } from "../bot-replays.ts";
import { Board } from "./Board.tsx";

/**
 * The computer's live window, at the top of the home's play column (Eric, Oct 9; DECISIONS.md, "The live window"): a
 * real match when one is running (its board and the crowd's votes, from the live line the home already polls), else a
 * bot match played back from a recording, labelled "Bot match", on a cycle set by the clock so everyone sees the same
 * moment. No engine, nothing per frame: it redraws when the shown move changes.
 */
export function LiveWindow() {
  const live = useLive();
  const real = live?.featured ?? null;
  const [file, setFile] = useState<ReplayFile | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let on = true;
    void loadReplays().then((f) => on && setFile(f));
    // (Back to the tab: straight to the moment it's at now.)
    const back = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", back);
    return () => {
      on = false;
      document.removeEventListener("visibilitychange", back);
    };
  }, []);
  const moment = !real && file ? replayAt(file, now) : null;
  // One timer, to the next change of move (about every 6-9 s).
  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(() => setNow(Date.now()), Math.max(50, moment.until - Date.now() + 20));
    return () => clearTimeout(t);
  }, [moment?.until]);
  if (real) return <RealMatch match={real} />;
  if (!file || !moment) return <section class="fd-livewin empty" aria-hidden="true" />;
  const r = file.replays[moment.replay]!;
  const v = replayView(r, moment.ply);
  const sideName = v.side === "b" ? "Black" : "White";
  const meta = v.end ? "Final result" : moment.ply < 0 ? `${r.names.length} bots` : `Move ${Math.ceil(v.ply / 2)} · ${v.alive} left`;
  const line = v.end ? (
    <>
      {v.end.winner ? `${v.end.winner === "w" ? "White" : "Black"} wins` : "A draw"} · 1st <strong>{v.end.top[0]}</strong>
    </>
  ) : moment.ply < 0 ? (
    "A new match is starting"
  ) : v.final ? (
    <>
      Final · {v.name} plays <strong>{v.votes[0]?.[0]}</strong>
    </>
  ) : (
    <Votes who={`${sideName}'s crowd`} votes={v.votes} />
  );
  return (
    <section class="fd-livewin" aria-label="Bot match, a recording">
      <header class="fd-livewin-head">
        <span class="fd-livewin-tag">Bot match</span>
        <span class="fd-livewin-mode">Crowd · 50 v 50</span>
        <span class="fd-livewin-meta">{meta}</span>
      </header>
      <div class="fd-livewin-board">
        <div class="fd-livewin-sq">
          <Board key={r.id} fen={v.fen} lastMove={v.lastMove} orientation="white" small />
        </div>
      </div>
      <p class="fd-livewin-line">{line}</p>
    </section>
  );
}

/** A real match: its board and the crowd's votes on the move just played (no names), and no "Bot match" label. */
function RealMatch({ match }: { match: NonNullable<LiveCounts["featured"]> }) {
  const b = match.board;
  // (The side that just moved: the one not to move now.)
  const moved = b.fen.split(" ")[1] === "w" ? "Black" : "White";
  const mode = match.mode === "boss" ? `Boss raid${match.bossElo ? ` · ${"💀".repeat(bossThreat(match.bossElo))}` : ""}` : "Crowd · 50 v 50";
  const meta = [b.ply ? `Move ${Math.ceil(b.ply / 2)}` : "Starting", match.alive !== null ? `${match.alive} left` : null].filter(Boolean).join(" · ");
  return (
    <section class="fd-livewin real" aria-label="Live match">
      <header class="fd-livewin-head">
        <span class="fd-livewin-tag live">
          <span class="fd-dot" /> Live
        </span>
        <span class="fd-livewin-mode">{mode}</span>
        <span class="fd-livewin-meta">{meta}</span>
      </header>
      <div class="fd-livewin-board">
        <div class="fd-livewin-sq">
          <Board fen={b.fen} lastMove={b.lastMove} orientation="white" small />
        </div>
      </div>
      <p class="fd-livewin-line">
        {b.votes.length === 1 && b.votes[0]![1] === 1 ? (
          <>
            {moved} plays <strong>{b.votes[0]![0]}</strong>
          </>
        ) : b.votes.length ? (
          <Votes who={`${moved}'s crowd`} votes={b.votes} />
        ) : b.ply ? (
          "The match is on"
        ) : (
          "A match is starting"
        )}
      </p>
    </section>
  );
}

/** "White's crowd: Nf3 31 · e4 12 · d4 5", the move played (the most votes) first and bold. */
function Votes({ who, votes }: { who: string; votes: [string, number][] }) {
  return (
    <>
      {who}:{" "}
      {votes.map(([san, n], i) => (
        <span key={san} class="fd-livewin-vote">
          {i > 0 && " · "}
          {i === 0 ? <strong>{san}</strong> : san} {n}
        </span>
      ))}
    </>
  );
}
