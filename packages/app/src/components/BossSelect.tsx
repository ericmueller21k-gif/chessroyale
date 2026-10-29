import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { BOSS_DIFFICULTY, hiddenBosses, menuBosses, type BossDef, type BossDifficultyId, type ItemLook } from "@chessroyale/core";
import { DressedPawn } from "./FrontDoor.tsx";
import { bossKit } from "../characters/kits.ts";
import { frameKeys, type Character } from "../characters/sprite.ts";
import { rowSizes, SELECT_SOUND, SELECT_TINT, selectLine, TILES_PER_ROW } from "../characters/boss-select.ts";
import { isPaused, useServerStatus } from "../status.ts";
import { playOnTap, warmSounds } from "../sound.ts";
import { NORMAL, Voice, VoiceBubble } from "../speech.tsx";
import { BossArt, BossFace } from "./BossCharacter.tsx";
import { SpriteAnim } from "./BossEffect.tsx";
import { useMedia } from "./QuickChat.tsx";

/**
 * The Boss raid screen's character select (Eric, Oct 16: "old school Street Fighter 2 style… slanted squares… the current
 * boss that's selected… shows their full sprite… standing there doing its idle animation"): a grid of slanted tiles, one
 * per boss you can meet (a resting one is left out, as the boss menu leaves it out), the Hidden Boss's dark and locked,
 * and "?" for a random boss; under them a stage, the 1 v 1 versus stage's platform (`dv-st-`), the picked boss on it in
 * its idle animation, and its name, with its difficulty named under it unless it's Normal. No number or skulls on the
 * stage (Eric, Oct 25; Boss alone's menu keeps its number).
 *
 * The tiles are a fighting game's select grid (Eric, Oct 21 to 23; the last look from Street Fighter 6's): tall slanted tiles,
 * all the same size, a small gap between them, five to a row on a phone and a computer alike (a short row centered), each
 * with the boss's whole figure framed from the neck up and cut off by the tile's corners, on a color from its own palette.
 * No names on the tiles. docs/decisions/2026-10-23-boss-select-sf.md.
 *
 * A tap drops the boss onto the stage (the 1 v 1 opponent's drop, `dv-st-drop`), plays its sound once (SELECT_SOUND,
 * through the mute switch) and says one of its lines in its speech bubble (SELECT_LINES, its own voice here). The Hidden
 * Boss stands there as a silhouette, unnamed. One sprite animates at a time (the stage's; the tiles are still
 * portraits), on the shared animation loop, so it rests while the app is hidden; under reduced motion it's a still and
 * nothing drops. docs/decisions/2026-10-16-boss-character-select.md.
 */

/** The select's own voice (the battle's is `bossVoice`): one line at a time, each tap's replacing the last. */
const selectVoice = new Voice();
/** The last line said by each boss here (no line twice running; the Hidden Boss's two in turn). */
const lastLine = new Map<string, string>();

/** What the select shows: the bosses you can meet (resting ones left out), then the hidden ones (dark, locked). */
export function selectBosses(): { bosses: BossDef[]; hidden: BossDef[] } {
  const on = (b: BossDef) => !isPaused(`boss:${b.id}`);
  return { bosses: menuBosses({ admin: false, raid: true }).filter(on), hidden: hiddenBosses().filter(on) };
}

/**
 * Where a boss stands on the stage, in % of the stage's width (cqi): one size of pixel for every boss (a bigger boss
 * stands taller, as on an old select screen), smaller only for one too tall for the stage (the Hidden Boss); its foot
 * on the platform's middle. Worked out once a character, from its idle's first frame (the rows it draws in).
 */
const PX = 0.8;
const TALLEST = 56;
const FOOT_AT = 50;
/**
 * Where a boss's feet stand, in its own pixels, for one whose frame's `foot` point isn't between its feet (Eric, Oct 25:
 * Big Boy stood off to one side of the platform). Big Boy's feet span x 33 to 66 in his idle; his `foot` is x 44.
 */
const STAGE_FOOT_X: Readonly<Record<string, number>> = { bigboy: 49.5 };
const placed = new Map<string, { left: number; width: number }>();
function placeOnStage(ch: Character, idle: string): { left: number; width: number } {
  let p = placed.get(ch.id);
  if (!p) {
    const rows = frameKeys(ch, ch.anims[idle]!.frames[0]!);
    const top = Math.max(0, rows.findIndex((r) => r.some((k) => k !== null)));
    // (Never wider than the stage: a wide one, Wrangler's lasso out to one side, slides over to stay whole.)
    const px = Math.min(PX, TALLEST / Math.max(1, ch.foot[1] - top), 100 / ch.w);
    const width = ch.w * px;
    const footX = STAGE_FOOT_X[ch.id] ?? ch.foot[0];
    placed.set(ch.id, (p = { left: Math.max(0, Math.min(100 - width, FOOT_AT - footX * px)), width }));
  }
  return p;
}

/** The "?" tile's value, and the stage's when a random boss is picked. */
export const RANDOM = "";

/** An invite circle: a crisp dashed ring, a very light fill and a person-plus, as in Eric's picture. */
const InviteCircle = () => (
  <span class="bs-inv" role="img" aria-label="Invite a friend (coming soon)">
    <svg class="bs-inv-ring" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="19.2" />
    </svg>
    <svg class="bs-inv-icon" viewBox="0 0 28 22" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="9" cy="5.6" r="4.6" />
      <path d="M0 21.5c0-5.600 3.800-8.600 9-8.600s9 3 9 8.600z" />
      <path d="M22 4.200v8M18 8.200h8" stroke="currentColor" stroke-width="2.600" stroke-linecap="round" fill="none" />
    </svg>
  </span>
);
const Arrow = ({ left }: { left?: boolean }) => (
  <svg viewBox="0 0 10 14" width="10" height="14" aria-hidden="true" focusable="false">
    <path d={left ? "M8 1.5 2 7l6 5.5z" : "M2 1.5 8 7l-6 5.5z"} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
  </svg>
);

export function BossSelect({ value, difficulty, name, look, onPick, onDifficulty }: { value: string; difficulty: BossDifficultyId; name: string; look?: ItemLook; onPick: (id: string) => void; onDifficulty: (id: BossDifficultyId) => void }) {
  useServerStatus();
  const { bosses, hidden } = selectBosses();
  const still = useMedia("(prefers-reduced-motion: reduce)");
  // Each tap (re)starts the drop and the idle under it.
  const [drop, setDrop] = useState({ n: 0, at: Date.now() });
  const hiddenIds = new Set(hidden.map((b) => b.id));
  const dark = hiddenIds.has(value);
  const def = [...bosses, ...hidden].find((b) => b.id === value) ?? null;
  // Their sounds made ahead (in the sound worker), so a tap never waits on one.
  useEffect(() => {
    warmSounds(Object.values(SELECT_SOUND));
    return () => selectVoice.reset();
  }, []);
  const tap = (id: string) => {
    warmSounds(Object.values(SELECT_SOUND));
    onPick(id);
    setDrop((d) => ({ n: d.n + 1, at: Date.now() }));
    selectVoice.reset();
    const sound = SELECT_SOUND[id];
    if (sound) playOnTap(sound);
    const line = selectLine(id, lastLine.get(id) ?? null);
    if (line) {
      lastLine.set(id, line);
      selectVoice.say(line, `select:${id}:${Date.now()}`, NORMAL);
    }
  };
  const at = Math.max(0, BOSS_DIFFICULTY.findIndex((d) => d.id === difficulty));
  const step = (by: number) => {
    const next = BOSS_DIFFICULTY[at + by];
    if (next) onDifficulty(next.id);
  };
  const kit = def ? bossKit(def.name) : null;
  const idle = kit ? (kit.anims.idle ?? "idle") : null;
  const tile = (id: string, label: string, body: preact.ComponentChildren, cls = "", tint?: string) => (
    <button type="button" role="radio" key={id || "random"} aria-checked={value === id} aria-label={label} class={`bs-tile${cls}${value === id ? " on" : ""}`} data-boss={hiddenIds.has(id) ? "hidden" : id || "random"} onClick={() => tap(id)}>
      <span class={`bs-tile-in${tint ? " bs-tinted" : ""}`} style={tint ? { "--bs-tint": tint } : undefined}>
        {body}
      </span>
    </button>
  );
  const tiles = [
    ...bosses.map((b) => tile(b.id, b.name, <BossArt boss={b} />, "", SELECT_TINT[b.id])),
    ...hidden.map((b) => tile(b.id, "Locked boss", <BossArt boss={b} class="bs-shadow" />, " bs-locked")),
    tile(RANDOM, "Random boss", <span class="bs-q" aria-hidden="true">?</span>, " bs-random"),
  ];
  const rows = rowSizes(tiles.length, TILES_PER_ROW).map((n) => tiles.splice(0, n));
  return (
    <div class="bs-select">
      {/* (Rows are layout only: the radios stay one group, in order.) */}
      <div class="bs-tiles" role="radiogroup" aria-label="Bosses" style={{ "--bs-per": TILES_PER_ROW }}>
        {rows.map((row, i) => (
          <div class="bs-row" role="presentation" key={i}>
            {row}
          </div>
        ))}
      </div>
      <section class={`bs-stage${dark ? " bs-dark" : ""}`} aria-label="Your stage">
        <div class="bs-say">
          <VoiceBubble voice={selectVoice} class="bc-bubble bs-bubble" />
        </div>
        <div class="bs-row-stage">
          <div class="bs-side">
            {/* Your pawn in front, two smaller platforms behind you with an invite circle over each (greyed: no live party yet). */}
            <div class="bs-spot bs-mine">
              {(["l", "r"] as const).map((k) => (
                <span class={`bs-back bs-${k}`} key={k}>
                  <InviteCircle />
                  <span class="dv-st-plat" aria-hidden="true" />
                </span>
              ))}
              <span class="dv-st-plat" aria-hidden="true" />
              <span class="bs-me" aria-hidden="true">
                <DressedPawn look={look} size="stage" />
              </span>
            </div>
            <strong class="bs-name">{name}</strong>
          </div>
          <span class="bs-vs">VS</span>
          <div class="bs-side" aria-label="Your boss" role="group">
            <div class="bs-spot">
              <span class="dv-st-plat" aria-hidden="true" />
              {/* (Its own key each tap: the drop plays again, from the top.) */}
              <span class="dv-st-pawn bs-fig" key={drop.n}>
                {kit && idle ? (
                  <SpriteAnim ch={kit.ch} anim={idle} since={drop.at} still={still} class="bs-sprite" style={(({ left, width }) => ({ left: `${left}cqi`, width: `${width}cqi` }))(placeOnStage(kit.ch, idle))} />
                ) : (
                  <span class="bs-q bs-q-big" aria-hidden="true">
                    ?
                  </span>
                )}
              </span>
            </div>
            <strong class="bs-name" aria-live="polite">
              {dark ? "???" : (def?.name ?? "Random boss")}
            </strong>
            {/* The difficulty: arrows step through the five levels and stop at the ends (greyed there); the dots show where you are. */}
            <div class="bs-diff" role="group" aria-label="Difficulty">
              <button type="button" class="bs-arrow" aria-label="Easier" aria-disabled={at === 0 || undefined} onClick={() => step(-1)}>
                <Arrow left />
              </button>
              <span class="bs-level" data-level={difficulty} aria-live="polite">
                {BOSS_DIFFICULTY[at]!.label}
              </span>
              <button type="button" class="bs-arrow" aria-label="Harder" aria-disabled={at === BOSS_DIFFICULTY.length - 1 || undefined} onClick={() => step(1)}>
                <Arrow />
              </button>
            </div>
            <div class="bs-dots" aria-hidden="true">
              {BOSS_DIFFICULTY.map((d, i) => (
                <span class={`bs-dot${i === at ? " on" : ""}`} data-level={d.id} key={d.id} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Home's Boss raid card's portrait (Eric, Oct 16): a still of one boss you can meet, moving on to the next every
 * `FRONT_DOOR.bossCardMs` with a fade (`bossCardFadeMs`); never the Hidden Boss, never a resting one. The new one fades
 * in over the last, in the same box, so the card never changes size. It waits while the app is hidden (the timer starts
 * again when it's back), and under reduced motion the new one simply replaces the last.
 */
export function BossCardFace({ everyMs, fadeMs }: { everyMs: number; fadeMs: number }) {
  useServerStatus();
  const { bosses } = selectBosses();
  const [n, setN] = useState(0);
  const prev = useRef<{ n: number; at: number } | null>(null);
  useEffect(() => {
    let t = 0;
    const arm = () => {
      clearTimeout(t);
      if (document.visibilityState === "visible") t = window.setTimeout(next, everyMs);
    };
    const next = () => {
      setN((k) => {
        prev.current = { n: k, at: Date.now() };
        return k + 1;
      });
      arm();
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [everyMs]);
  // (The last one, under the new one while it fades in; gone after.)
  const [, bump] = useState(0);
  const fading = prev.current && Date.now() - prev.current.at < fadeMs ? prev.current : null;
  useLayoutEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => bump((x) => x + 1), fadeMs);
    return () => clearTimeout(t);
  }, [fading?.at]);
  if (!bosses.length) return null;
  const at = (k: number) => bosses[k % bosses.length]!;
  const cur = at(n);
  return (
    <span class="rd-face-stack" data-boss={cur.id} style={{ "--rd-fade": `${fadeMs}ms` }}>
      {fading && at(fading.n).id !== cur.id && (
        <span class="rd-face-one" key={`${fading.n}`}>
          <BossFace boss={at(fading.n)} />
        </span>
      )}
      <span class={`rd-face-one${fading ? " rd-face-in" : ""}`} key={`${n}`}>
        <BossFace boss={cur} />
      </span>
    </span>
  );
}
