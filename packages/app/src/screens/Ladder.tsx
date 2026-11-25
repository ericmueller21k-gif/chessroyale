import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { LADDER, type LadderAnswer, type LadderRow, type RankView } from "@chessroyale/core";
import { account, playerName } from "../account.ts";
import { BackButton, DressedPawn } from "../components/FrontDoor.tsx";
import { RankEmblem } from "../components/RankEmblem.tsx";
import { SIGN_IN_LINE, keepLadderScroll, keptLadder, loadLadder, placeText, placementLine, recordLine, rowsWithYou, totalLine, winPct } from "../ladder.ts";
import { openProfile, type ProfileTarget } from "../profile-nav.ts";
import { MODES } from "./Home.tsx";
import "../ladder.css";

/**
 * The season ladder (/ladder; Eric, Nov 25: "a ladder board for all rank modes for the current season"; on the mockup: "Looks
 * great mockup should be scrollable to the top 200"; docs/decisions/2026-11-25-ladder.md). From the top, fixed: Back and "Ladder",
 * the season and how many are ranked, a tab per ranked mode in home's RANKED row's order (50 v 50 · 1 v 1 · Squads, 1 v 1 in the
 * middle and picked; a mode with no ranks of its own yet greyed, its reason on a tap, never hidden), the columns' names. Then the
 * list, the only part that scrolls: the top LADDER.size, one scroll, place (the top three a medal), their head, name and rank (the
 * tier's color), the emblem, W – L and win %; on a computer also games and streak. At the foot, always: your own row (your exact
 * place, wherever it is), or how many placement games are left, or Sign in. A row's tap opens that player's profile. While it loads:
 * greyed rows in the rows' places, so nothing moves when they come. Classes start with `ld-`.
 */

/** Greyed rows while the list loads (enough to fill a tall phone). */
const GHOST_ROWS = 10;

/** A profile opened from a row: its Back comes to this list again, at the same place, without asking the server (ladder.ts keeps it). */
let backFromProfile = false;
const openFromLadder = (t: ProfileTarget) => {
  backFromProfile = true;
  openProfile(t);
};

/** Why a ranked mode's tab is greyed: it has no ranks of its own yet. */
const soonLine = (label: string) => `${label} has no ranks of its own yet. Its ladder starts when its ranks do.`;

export function LadderScreen({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
  const [kept] = useState(() => (backFromProfile ? keptLadder("1v1") : null));
  backFromProfile = false;
  const [answer, setAnswer] = useState<LadderAnswer | null>(kept?.answer ?? null);
  const [failed, setFailed] = useState(false);
  const [asks, setAsks] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (location.pathname !== "/ladder") history.replaceState(null, "", `/ladder${location.search}${location.hash}`);
  }, []);
  useEffect(() => {
    if (answer) return;
    let live = true;
    setFailed(false);
    loadLadder("1v1")
      .then((a) => live && setAnswer(a))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [asks]);
  // (Back from a profile: the list where it was, on its first frame.)
  useLayoutEffect(() => {
    if (kept && list.current) list.current.scrollTop = kept.scroll;
  }, []);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(t);
  }, [note]);
  const you = answer?.you ?? null;
  const mine = you && !("placement" in you) ? you.uid : null;
  const rows = answer ? rowsWithYou(answer) : null;
  return (
    <div class="fd-page ld">
      <header class="fd-page-head ld-head">
        <BackButton onClick={onBack} />
        <h1>Ladder</h1>
        <span class="fd-head-spacer" />
      </header>
      <div class="ld-season">
        <strong>Season {answer?.season ?? LADDER.season}</strong>
        <span class="ld-total">{answer ? totalLine(answer.total) : "Loading…"}</span>
      </div>
      <div class="ld-tabs" role="tablist" aria-label="Ranked mode">
        {MODES.map((m) => {
          const soon = m.id === "1v1" ? null : soonLine(m.label);
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              data-mode={m.id}
              aria-selected={!soon}
              aria-disabled={soon ? true : undefined}
              class={soon ? "off" : "on"}
              title={soon ?? undefined}
              onClick={() => soon && setNote(soon)}
            >
              {m.label}
              <span>{soon ? "No ranks yet" : "Ranked"}</span>
            </button>
          );
        })}
      </div>
      <div class="ld-cols" aria-hidden="true">
        <span class="ld-c-place">#</span>
        <span class="ld-c-player">Player</span>
        <span class="ld-c-wide">Games</span>
        <span class="ld-c-wide">Streak</span>
        <span class="ld-c-rec">W – L</span>
      </div>
      <div
        ref={list}
        class={`ld-list${rows ? "" : " ld-loading"}`}
        role="list"
        aria-label={`Season ${answer?.season ?? LADDER.season} ladder, 1 v 1`}
        aria-busy={rows ? undefined : true}
        onScroll={(e) => keepLadderScroll("1v1", (e.currentTarget as HTMLDivElement).scrollTop)}
      >
        {rows ? (
          rows.length ? (
            rows.map((r) => <Row key={r.uid} r={r} you={r.uid === mine} />)
          ) : (
            <p class="ld-empty">Nobody is on the ladder yet. Finish your placement games in 1 v 1 to be the first.</p>
          )
        ) : failed ? (
          <div class="ld-empty">
            <p>The ladder didn't load.</p>
            <button type="button" class="fd-btn" onClick={() => setAsks((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : (
          Array.from({ length: GHOST_ROWS }, (_, i) => <div key={i} class="ld-row ld-ghost" aria-hidden="true" />)
        )}
      </div>
      <div class="ld-mine" aria-label="Your place">
        {!answer ? (
          <div class="ld-row ld-pin ld-ghost" aria-hidden="true" />
        ) : you === null ? (
          <div class="ld-row ld-pin ld-placing ld-guest">
            <span class="ld-place">–</span>
            <span class="ld-who">
              <strong class="ld-name">Your place</strong>
              <span class="ld-sub">{SIGN_IN_LINE}</span>
            </span>
            <button type="button" class="fd-btn primary ld-signin" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        ) : "placement" in you ? (
          <div class="ld-row ld-pin ld-placing">
            <span class="ld-place">–</span>
            <Head look={account().profile?.locker?.look} />
            <span class="ld-who">
              <strong class="ld-name">
                <span class="ld-name-text">{playerName()}</span>
                <span class="ld-tag">You</span>
              </strong>
              <span class="ld-sub">{placementLine(you.placement)}</span>
            </span>
            <span class="ld-badge" aria-hidden="true">
              {you.placement.played}/{you.placement.of}
            </span>
          </div>
        ) : (
          <Row r={you} you pin />
        )}
      </div>
      {note && (
        <p key={note} class="ld-note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}

function Head({ look }: { look?: LadderRow["look"] }) {
  return (
    <span class="ld-face">
      <DressedPawn size="seat" look={look} />
    </span>
  );
}

function Place({ n }: { n: number }) {
  if (n <= 3)
    return (
      <span class={`ld-place ld-medal m${n}`} aria-label={`Place ${n}`}>
        {n}
      </span>
    );
  return <span class={`ld-place${n >= 1000 ? " long" : ""}`}>{n.toLocaleString("en-US")}</span>;
}

function Row({ r, you = false, pin = false }: { r: LadderRow; you?: boolean; pin?: boolean }) {
  const games = r.wins + r.losses + r.draws;
  return (
    <button
      type="button"
      role={pin ? undefined : "listitem"}
      class={`ld-row${r.place <= 3 ? ` top t${r.place}` : ""}${you ? " you" : ""}${pin ? " ld-pin" : ""}`}
      data-uid={r.uid}
      aria-label={`${placeText(r.place)} ${r.name}, ${r.rank.label}, ${recordLine(r)}`}
      onClick={() => openFromLadder(you ? { you: true, public: true, name: r.name } : { uid: r.uid, name: r.name })}
    >
      <Place n={r.place} />
      <Head look={r.look} />
      <span class="ld-who">
        <strong class="ld-name">
          <span class="ld-name-text">{r.name}</span>
          {you && <span class="ld-tag">You</span>}
        </strong>
        <RankWords rank={r.rank} />
      </span>
      <RankEmblem rank={r.rank} class="ld-emblem" />
      <span class="ld-wide">{games}</span>
      <span class="ld-wide">{r.streak > 0 ? `W${r.streak}` : "–"}</span>
      <span class="ld-rec">
        <strong>{recordLine(r)}</strong>
        <span>{winPct(r)}</span>
      </span>
    </button>
  );
}

function RankWords({ rank }: { rank: RankView }) {
  return (
    <span class="ld-rank" style={{ "--tier": rank.color }}>
      {rank.label}
    </span>
  );
}
