/**
 * A figure that now and then changes how it rests (Moo & Moon: he hugs the moon, then lets go and sits on it, then hugs it
 * again, Eric, Oct 20). Pure: from how long it has rested in its idle, which animation shows and which frame.
 *
 * The resting spell starts when the figure settles into its idle (a moment's animation over, or the beat itself): `hugMs`
 * in its idle, then the switch (`toSit`, one-shot), `sitMs` in the sit (a loop, by the clock), the switch back (`toHug`),
 * and round again. A moment never waits for it and is never cut by it: the next moment starts its own spell afresh, in the
 * idle, so what plays during a moment is always the moment's own animation and the switch happens only at rest.
 */
import { animLength } from "./power-art.ts";
import type { Anim, Character } from "./sprite.ts";

export interface Stance {
  /** How long it rests in its idle before it switches, and how long it stays in the other pose (ms). */
  hugMs: number;
  sitMs: number;
  /** The animations: into the other pose (a one-shot), the other pose (a loop) and back (a one-shot). */
  toSit: string;
  sit: string;
  toHug: string;
}

/** The frame an animation shows `t` ms in (a loop by the clock, a one-shot holding its last frame). */
function frameIn(a: Anim, t: number): number {
  const len = animLength(a);
  const at = a.loop ? ((t % len) + len) % len : Math.min(t, len - 1);
  let acc = 0;
  for (let i = 0; i < a.frames.length; i++) if (at < (acc += a.frames[i]!.ms)) return i;
  return a.frames.length - 1;
}

/** One whole turn of the spell: hugging, switching, sitting, switching back (ms). */
export const stanceCycle = (ch: Character, st: Stance): number => st.hugMs + animLength(ch.anims[st.toSit]!) + st.sitMs + animLength(ch.anims[st.toHug]!);

/**
 * What shows `t` ms into a resting spell (`t` < 0: just settled): null while it hugs (the idle goes on), else the switch or
 * the sit. `tag` names each showing for sounds played once (the switch's slip and plop).
 */
export function stanceAt(ch: Character, st: Stance, t: number): { anim: string; frame: number; tag: string } | null {
  const down = animLength(ch.anims[st.toSit]!);
  const up = animLength(ch.anims[st.toHug]!);
  const cycle = stanceCycle(ch, st);
  const turn = Math.floor(Math.max(0, t) / cycle);
  const at = Math.max(0, t) - turn * cycle;
  const show = (anim: string, into: number) => {
    const frame = frameIn(ch.anims[anim]!, into);
    return { anim, frame, tag: `stance:${turn}:${anim}:${anim === st.sit ? "" : frame}` };
  };
  if (at < st.hugMs) return null;
  if (at < st.hugMs + down) return show(st.toSit, at - st.hugMs);
  if (at < st.hugMs + down + st.sitMs) return show(st.sit, at - st.hugMs - down);
  return show(st.toHug, at - st.hugMs - down - st.sitMs);
}
