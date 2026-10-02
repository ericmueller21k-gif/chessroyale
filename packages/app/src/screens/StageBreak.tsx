import type { BoardView, GameView, Standing } from "../game.ts";
import { MiniBoard } from "../components/MiniBoard.tsx";

const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);

export function StageBreakScreen(props: {
  match: GameView;
  stage: number;
  nextBoards: BoardView[];
  standings: Standing[];
  knockedOut: Standing[];
  cutoff: number;
  youOut: boolean;
}) {
  const { match, stage, standings, knockedOut, cutoff, youOut, nextBoards: boards } = props;
  const finalStage = stage === match.settings.knockoutsPerStage.length - 1;
  return (
    <div class="screen break">
      <h1>Stage {stage + 1} complete</h1>
      <p class={youOut ? "out-msg" : "safe-msg"}>
        {youOut
          ? `You're out, in ${match.placement}${ordinal(match.placement ?? 0)} place. The rest of the match will be played out quickly.`
          : finalStage
            ? "You made the duel! One real game for the win."
            : `You're through to stage ${stage + 2}.`}
      </p>
      <ol class="standings">
        {standings.map((s, i) => (
          <>
            {i === cutoff && <li class="ko-line" aria-hidden="true">knockout line</li>}
            <li key={s.id} class={`${s.isYou ? "you" : ""} ${i >= cutoff ? "out" : ""}`}>
              <span class="st-rank">{i + 1}</span>
              <span class="st-name">{s.name}</span>
              <span class="st-score">{fmt(s.score)}</span>
            </li>
          </>
        ))}
      </ol>
      {!youOut && boards.length > 1 && (
        <>
          <h2 class="muted small">Boards in the next stage</h2>
          <div class={`grid grid-${boards.length}`}>
            {boards.map((b) => (
              <MiniBoard key={b.id} fen={b.fen} lastMove={b.lastMove} label={b.openingName} />
            ))}
          </div>
        </>
      )}
      <p class="muted small">{knockedOut.length} out: {knockedOut.map((k) => k.name).join(", ")}</p>
      <div class="actions">
        {match.serverPaced ? (
          <div class="status">{youOut ? "You can stay and watch, or leave." : "The next stage starts in a few seconds…"}</div>
        ) : (
          <button type="button" class="btn btn-primary" onClick={() => match.continueFromBreak()}>
            {youOut ? "See how it ends" : "Next stage"}
          </button>
        )}
      </div>
    </div>
  );
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
