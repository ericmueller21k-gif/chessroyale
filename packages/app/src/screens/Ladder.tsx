import { useEffect, useState } from "preact/hooks";
import type { RankView } from "@chessroyale/core";
import { account, playerName } from "../account.ts";
import { BackButton, DressedPawn } from "../components/FrontDoor.tsx";
import { RankEmblem } from "../components/RankEmblem.tsx";
import { LADDER_MODES, ladderMock, ladderSwitch, placeText, placementLine, rankLine, recordLine, winPct, type LadderModeId, type LadderPage, type LadderRow } from "../ladder.ts";
import { openProfile } from "../profile-nav.ts";
import "../ladder.css";

/**
 * The season ladder (/ladder; Eric, Nov 25), a MOCKUP on made-up rows (`?ladder=mock`, ladder.ts). From the top, fixed: Back and
 * "Ladder", the season and how many are ranked, a tab per ranked mode (one with no ranks yet greyed, its reason on a tap),
 * the columns' names. Then the list, the only part that scrolls: place (the top three a medal), their head, name and rank
 * (the tier's color), the emblem, W – L and win %; on a computer also games and streak. At the foot, always: your own row
 * (your place, wherever it is), or how many placement games are left, or Sign in. A row's tap opens that player's profile.
 * Classes start with `ld-`.
 */
export function LadderScreen({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
  const [mode, setMode] = useState<LadderModeId>("1v1");
  const [note, setNote] = useState<string | null>(null);
  const me = account().profile;
  const [page] = useState<LadderPage>(() => ladderMock(ladderSwitch() ?? "off", me?.locker?.look, playerName()));
  useEffect(() => {
    if (location.pathname !== "/ladder") history.replaceState(null, "", `/ladder${location.search}${location.hash}`);
  }, []);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(t);
  }, [note]);
  const you = page.you;
  return (
    <div class="fd-page ld">
      <header class="fd-page-head ld-head">
        <BackButton onClick={onBack} />
        <h1>Ladder</h1>
        <span class="fd-head-spacer" />
      </header>
      <div class="ld-season">
        <strong>Season {page.season}</strong>
        <span>{page.total.toLocaleString("en-US")} ranked players</span>
      </div>
      <div class="ld-tabs" role="tablist" aria-label="Ranked mode">
        {LADDER_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            aria-disabled={m.soon ? true : undefined}
            class={`${mode === m.id ? "on" : ""}${m.soon ? " off" : ""}`}
            title={m.soon ?? undefined}
            onClick={() => (m.soon ? setNote(m.soon) : setMode(m.id))}
          >
            {m.label}
            <span>{m.soon ? "No ranks yet" : "Ranked"}</span>
          </button>
        ))}
      </div>
      <div class="ld-cols" aria-hidden="true">
        <span class="ld-c-place">#</span>
        <span class="ld-c-player">Player</span>
        <span class="ld-c-wide">Games</span>
        <span class="ld-c-wide">Streak</span>
        <span class="ld-c-rec">W – L</span>
      </div>
      <div class="ld-list" role="list" aria-label={`Season ${page.season} ladder, 1 v 1`}>
        {page.rows.map((r) => (
          <Row key={r.uid} r={r} />
        ))}
        <button type="button" class="fd-btn ld-more">Show the next 100</button>
      </div>
      <div class="ld-mine" aria-label="Your place">
        {you === null ? (
          <div class="ld-row ld-pin ld-placing">
            <span class="ld-place">–</span>
            <span class="ld-who">
              <strong class="ld-name">Your place</strong>
              <span class="ld-sub">Sign in and play 1 v 1 to join the ladder</span>
            </span>
            <button type="button" class="fd-btn primary ld-signin" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        ) : "placement" in you ? (
          <div class="ld-row ld-pin ld-placing">
            <span class="ld-place">–</span>
            <Head look={me?.locker?.look} />
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
          <Row r={you} pin />
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

function Row({ r, pin = false }: { r: LadderRow; pin?: boolean }) {
  const games = r.wins + r.losses + r.draws;
  return (
    <button
      type="button"
      role={pin ? undefined : "listitem"}
      class={`ld-row${r.place <= 3 ? ` top t${r.place}` : ""}${r.you ? " you" : ""}${pin ? " ld-pin" : ""}`}
      aria-label={`${placeText(r.place)} ${r.name}, ${rankLine(r.rank)}, ${recordLine(r)}`}
      onClick={() => openProfile(r.you ? { you: true, public: true, name: r.name } : { uid: r.uid, name: r.name })}
    >
      <Place n={r.place} />
      <Head look={r.look} />
      <span class="ld-who">
        <strong class="ld-name">
          <span class="ld-name-text">{r.name}</span>
          {r.you && <span class="ld-tag">You</span>}
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
      {rankLine(rank)}
    </span>
  );
}
