import { useLayoutEffect, useRef } from "preact/hooks";
import { BossFace } from "./BossCharacter.tsx";
import type { QuestIcon, QuestView } from "@chessroyale/core";
import { KeyArt, WinterCrateArt } from "./Items.tsx";

/**
 * The daily quests overlay (design: notes/briefs/design-xp-quests.md, section 5; Eric's reference of Nov 9): a framed card over
 * home, the HunChess app icon in a crest, "Daily Quests", when the dailies renew, then one row per quest (its picture, name, goal,
 * progress bar and count, its reward drawn with the shop's art) and "Got it". Two daily rows and the weekly one under its own
 * label and countdown. Each daily has a small reroll button (each its own free one a day: greyed once used, or on a finished quest). The ×,
 * "Got it", Escape or a tap outside close it.
 *
 * It draws what it's given and calls back (Nov 9, phase 3: home gives it the server's quests, quests.ts; the server deals, counts,
 * rerolls and pays them, server/quests.ts). Eric approved its look (the mockup of Nov 9).
 */

/** A quest's row (core's quests.ts: the server answers these). */
export type { QuestIcon, QuestView };

export interface QuestsOverlayProps {
  /** The dailies (two, or three with one carried over; in order), then the weekly. */
  quests: readonly QuestView[];
  /** Until the next daily quests ("12h"). */
  dailyResetIn: string;
  /** Until the weekly resets ("4d"). */
  weeklyResetIn: string;
  /** PAUSE_REWARDS is on: the head says quests are paused, in place of the countdown. */
  paused?: boolean;
  onReroll: (id: string) => void;
  onClose: () => void;
}

const count = (n: number) => n.toLocaleString("en-US");

/** A clock, drawn as the top bar's icons are. */
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/** Reroll: two arrows round. */
const RerollIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 3v5h5" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 21v-5h-5" />
  </svg>
);

/** A scroll with a check: the Quests entry on home. */
export const QuestsIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 3h11a2 2 0 0 1 2 2v1h-4" />
    <path d="M16 6v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10" />
    <path d="M7 3a2 2 0 0 0-2 2v13" />
    <path d="M8.5 11.5l2 2 3.5-4" />
  </svg>
);

/**
 * The quests icon in a phone's top bar (Nov 9; an outline since Nov 10, like the gear): a clipboard with its check, in the text
 * color with no fill (the body's line stops at the clip, so nothing crosses it). QuestsIcon above stays the panels' icon.
 */
export const QuestsBarIcon = () => (
  <svg viewBox="0 0 24 24" width="29" height="29" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 4H6.5A2.5 2.5 0 0 0 4 6.5v13A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5v-13A2.5 2.5 0 0 0 17.5 4H16" />
    <rect x="8" y="2" width="8" height="4" rx="1.2" />
    <path d="M8.5 13.2l2.3 2.3 4.2-4.4" />
  </svg>
);

/** The quest's picture, in its tile. */
function QuestPicture({ icon }: { icon: QuestIcon }) {
  if (icon.kind === "boss") return <BossFace boss={{ name: icon.boss, icon: "" }} class="qo-boss" label="" />;
  if (icon.kind === "squad")
    return (
      <span class="hb-pieces qo-pieces qo-squad" aria-hidden="true">
        <piece class="white pawn" />
        <piece class="white pawn" />
        <piece class="white pawn" />
      </span>
    );
  return (
    <span class="hb-pieces qo-pieces qo-board" aria-hidden="true">
      <piece class={`white ${icon.piece}`} />
    </span>
  );
}

/** A reward: the XP in gold, then the crate and the key as the shop draws them. */
function Reward({ reward }: { reward: QuestView["reward"] }) {
  const parts = [`${count(reward.xp)} XP`];
  if (reward.crates) parts.push(`${reward.crates} ${reward.crates === 1 ? "crate" : "crates"}`);
  if (reward.keys) parts.push(`${reward.keys} ${reward.keys === 1 ? "key" : "keys"}`);
  return (
    <div class="qo-reward" aria-label={`Reward: ${parts.join(", ")}`}>
      <span class="qo-reward-tag" aria-hidden="true">
        Reward
      </span>
      <span class="qo-xp" aria-hidden="true">
        +{count(reward.xp)} XP
      </span>
      {(reward.crates || reward.keys) && (
        <span class="qo-things" aria-hidden="true">
          {!!reward.crates && (
            <span class="qo-thing">
              <WinterCrateArt />
              <small>{reward.crates === 1 ? "Crate" : `${reward.crates} Crates`}</small>
            </span>
          )}
          {!!reward.keys && (
            <span class="qo-thing">
              <KeyArt />
              <small>{reward.keys === 1 ? "Key" : `${reward.keys} Keys`}</small>
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function QuestRow({ q, onReroll }: { q: QuestView; onReroll: (id: string) => void }) {
  const done = q.progress >= q.target;
  const share = Math.min(1, q.progress / q.target);
  const canReroll = q.period === "daily" && q.canReroll && !done;
  return (
    <li class={`qo-row${q.period === "weekly" ? " weekly" : ""}${done ? " done" : ""}`} data-quest={q.id}>
      <span class="qo-pic">
        <QuestPicture icon={q.icon} />
        {done && (
          <span class="qo-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        )}
      </span>
      <div class="qo-text">
        <div class="qo-name-line">
          <strong class="qo-name">{q.name}</strong>
          {/* (Dailies only; always there, greyed when it can't be used: this daily's reroll spent today, or the quest done. Nothing hidden.) */}
          {q.period === "daily" && (
            <button
              type="button"
              class="qo-reroll"
              disabled={!canReroll}
              aria-label={done ? "Reroll (quest done)" : canReroll ? `Reroll ${q.name} (1 free today)` : "Reroll (used today)"}
              title={done ? "Done" : canReroll ? "Swap this quest (1 free a day per quest)" : "This quest's free reroll is used today"}
              onClick={() => canReroll && onReroll(q.id)}
            >
              <RerollIcon />
            </button>
          )}
        </div>
        <span class="qo-goal">{q.goal}</span>
        <div class="qo-progress">
          <span class="qo-bar" role="progressbar" aria-label={`${q.name} progress`} aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={Math.min(q.progress, q.target)}>
            <span class="qo-fill" style={{ width: `${share * 100}%` }} />
          </span>
          <span class="qo-count">{done ? "Done!" : `${count(q.progress)}/${count(q.target)}`}</span>
        </div>
      </div>
      <Reward reward={q.reward} />
    </li>
  );
}

export function QuestsOverlay({ quests, dailyResetIn, weeklyResetIn, paused, onReroll, onClose }: QuestsOverlayProps) {
  const ok = useRef<HTMLButtonElement>(null);
  // (A layout effect, as the other notices': Escape closes it from its first frame, and "Got it" has the focus.)
  useLayoutEffect(() => {
    ok.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const dailies = quests.filter((q) => q.period === "daily");
  const weekly = quests.filter((q) => q.period === "weekly");
  return (
    <div class="qo-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="qo-card" role="dialog" aria-modal="true" aria-labelledby="qo-title">
        <span class="qo-crest" aria-hidden="true">
          <img class="qo-crest-img" src="/icons/icon.svg" alt="" />
        </span>
        <button type="button" class="qo-x" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <header class="qo-head">
          <h2 id="qo-title" class="qo-title">
            Daily Quests
          </h2>
          <span class="qo-when">
            <ClockIcon />
            {paused ? "Quests are paused for a moment." : `New quests in ${dailyResetIn}`}
          </span>
        </header>
        <ul class="qo-rows">
          {dailies.map((q) => (
            <QuestRow key={q.id} q={q} onReroll={onReroll} />
          ))}
        </ul>
        <div class="qo-label">
          <span>Weekly</span>
          <span class="qo-label-when">
            <ClockIcon />
            Resets in {weeklyResetIn}
          </span>
        </div>
        <ul class="qo-rows">
          {weekly.map((q) => (
            <QuestRow key={q.id} q={q} onReroll={onReroll} />
          ))}
        </ul>
        <button type="button" class="fd-btn primary qo-ok" ref={ok} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
