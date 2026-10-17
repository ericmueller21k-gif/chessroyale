import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { bossStrength, bossThreat, hiddenBosses, menuBosses, raidBossElo, type BossDef } from "@chessroyale/core";
import { bossKit } from "../characters/kits.ts";
import { frameKeys, type Character } from "../characters/sprite.ts";
import { SELECT_SOUND, selectLine } from "../characters/boss-select.ts";
import { isPaused, useServerStatus } from "../status.ts";
import { play, unlockAudio, warmSounds } from "../sound.ts";
import { NORMAL, Voice, VoiceBubble } from "../speech.tsx";
import { BossFace } from "./BossCharacter.tsx";
import { SpriteAnim } from "./BossEffect.tsx";
import { useMedia } from "./QuickChat.tsx";

/**
 * The Boss raid screen's character select (Eric, Oct 16: "old school Street Fighter 2 style… slanted squares… the current
 * boss that's selected… shows their full sprite… standing there doing its idle animation"): a grid of slanted tiles, one
 * per boss you can meet (a resting one is left out, as the boss menu leaves it out), the Hidden Boss's dark and locked,
 * and "?" for a random boss; under them a stage, the 1 v 1 versus stage's platform (`dv-st-`), the picked boss on it in
 * its idle animation, its name and its strength against you.
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
const placed = new Map<string, { left: number; width: number }>();
function placeOnStage(ch: Character, idle: string): { left: number; width: number } {
  let p = placed.get(ch.id);
  if (!p) {
    const rows = frameKeys(ch, ch.anims[idle]!.frames[0]!);
    const top = Math.max(0, rows.findIndex((r) => r.some((k) => k !== null)));
    // (Never wider than the stage: a wide one, Wrangler's lasso out to one side, slides over to stay whole.)
    const px = Math.min(PX, TALLEST / Math.max(1, ch.foot[1] - top), 100 / ch.w);
    const width = ch.w * px;
    placed.set(ch.id, (p = { left: Math.max(0, Math.min(100 - width, FOOT_AT - ch.foot[0] * px)), width }));
  }
  return p;
}

/** The "?" tile's value, and the stage's when a random boss is picked. */
export const RANDOM = "";

export function BossSelect({ value, rating, onPick }: { value: string; rating: number | null; onPick: (id: string) => void }) {
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
    unlockAudio();
    warmSounds(Object.values(SELECT_SOUND));
    onPick(id);
    setDrop((d) => ({ n: d.n + 1, at: Date.now() }));
    selectVoice.reset();
    const sound = SELECT_SOUND[id];
    if (sound) play(sound);
    const line = selectLine(id, lastLine.get(id) ?? null);
    if (line) {
      lastLine.set(id, line);
      selectVoice.say(line, `select:${id}:${Date.now()}`, NORMAL);
    }
  };
  // Its strength against you, as the boss menu works it out (a raid's: a step above your rating, plus its own offset).
  const elo = def && !dark ? bossStrength(raidBossElo([rating]), def) : null;
  const kit = def ? bossKit(def.name) : null;
  const idle = kit ? (kit.anims.idle ?? "idle") : null;
  const tile = (id: string, label: string, body: preact.ComponentChildren, cls = "") => (
    <button type="button" role="radio" aria-checked={value === id} aria-label={label} class={`bs-tile${cls}${value === id ? " on" : ""}`} data-boss={hiddenIds.has(id) ? "hidden" : id || "random"} onClick={() => tap(id)}>
      <span class="bs-tile-in">{body}</span>
    </button>
  );
  return (
    <div class="bs-select">
      <div class="bs-tiles" role="radiogroup" aria-label="Bosses">
        {bosses.map((b) => tile(b.id, b.name, <BossFace boss={b} label="" />))}
        {hidden.map((b) => tile(b.id, "Locked boss", <BossFace boss={b} label="" class="bs-shadow" />, " bs-locked"))}
        {tile(RANDOM, "Random boss", <span class="bs-q" aria-hidden="true">?</span>, " bs-random")}
      </div>
      <section class={`bs-stage${dark ? " bs-dark" : ""}`} aria-label="Your boss">
        {/* (Its words over its head, in a room of their own: never over the boss.) */}
        <div class="bs-say">
          <VoiceBubble voice={selectVoice} class="bc-bubble bs-bubble" />
        </div>
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
        <div class="bs-id" aria-live="polite">
          <strong class="bs-name">{dark ? "???" : (def?.name ?? "Random boss")}</strong>
          <span class="bs-rating">
            {dark ? (
              "Locked"
            ) : elo !== null ? (
              <>
                <span class="br-skulls" aria-hidden="true">
                  {"💀".repeat(bossThreat(elo))}
                </span>{" "}
                Rating {elo}
              </>
            ) : (
              "A different boss from last time"
            )}
          </span>
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
