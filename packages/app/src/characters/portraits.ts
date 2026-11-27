import { BOSS_ROSTER, type BossDef } from "@chessroyale/core";
import { testSwitchesAllowed } from "../test-switches.ts";
import { PORTRAITS } from "./portraits.gen.ts";

/**
 * Every boss's portrait without his own code (Nov 16, the bundle split: each boss's code is its own chunk, loaded with his match): his
 * portrait frame as pixels (portraits.gen.ts, made from his drawing by scripts/portraits.ts; portraits.test.ts keeps it in step), so home,
 * the boss select's tiles, the menus and the profiles draw him on their first frame from the first load. Inside a battle a face that
 * follows his look (BossFace's `live`) draws from his kit as before.
 */
export interface PortraitData {
  /** The portrait frame's size, px (his drawing's whole frame: the select tiles show it whole). */
  w: number;
  h: number;
  /** The face's window in it (`BossKit.portrait`): x, y, w, h. */
  face: readonly [number, number, number, number];
  /** Its colors, 8 hex digits (RGBA) each, in the order `px` names them. */
  pal: string;
  /** Its pixels, row by row: a key per color ("A" the first, "." empty), each followed by its run's length when over 1. */
  px: string;
}

/** The Hidden Boss's child form's portrait (kits.ts, RECLUSE_CHILD_KIT). */
export const CHILD_FORM = "Hidden Boss:child";
/** His final form's (the four boards: his coat, from his transformation on; test/portraits-make.ts). Only the profile's match history draws it. */
export const FINAL_FORM = "Hidden Boss:four";
const KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-/:;<=>?@[]^_{|}~";

/** Test links only (?wip=1&kit=<name>, as kits.ts's wipKit): that kit's portrait in every boss's place. */
const WIP_KIT_ASKED = (() => {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? "");
    return q.get("wip") === "1" ? q.get("kit") : null;
  } catch {
    return null;
  }
})();

/** Which portrait a boss shows (the same lookup as kits.ts's bossKitOf: his kit by name or by the roster's `kit`, his form, a test link's kit). */
export function portraitName(boss: { name: string; form?: string } | null | undefined, roster: readonly BossDef[] = BOSS_ROSTER): string | null {
  const name = boss?.name;
  if (!name) return null;
  if (WIP_KIT_ASKED && !name.startsWith("original:") && testSwitchesAllowed()) {
    const wip = PORTRAITS[WIP_KIT_ASKED] ? WIP_KIT_ASKED : Object.keys(PORTRAITS).find((k) => k.replace(/\s/g, "") === WIP_KIT_ASKED.replace(/\s/g, ""));
    if (wip) return wip;
  }
  const kit = PORTRAITS[name] ? name : (roster.find((b) => b.name === name)?.kit ?? name);
  if (!PORTRAITS[kit]) return null;
  return boss.form === "child" && kit === "Hidden Boss" ? CHILD_FORM : kit;
}

export const portraitOf = (name: string | null): PortraitData | null => (name ? (PORTRAITS[name] ?? null) : null);

/** A portrait's whole frame as RGBA pixels, decoded once. */
const pixels = new Map<string, Uint8ClampedArray>();
export function portraitPixels(name: string): Uint8ClampedArray | null {
  const p = PORTRAITS[name];
  if (!p) return null;
  let data = pixels.get(name);
  if (data) return data;
  data = new Uint8ClampedArray(p.w * p.h * 4);
  const pal = Array.from({ length: p.pal.length / 8 }, (_, i) => [0, 1, 2, 3].map((j) => parseInt(p.pal.slice(i * 8 + j * 2, i * 8 + j * 2 + 2), 16)));
  let at = 0;
  for (const [, key, count] of p.px.matchAll(/([^0-9])(\d*)/g)) {
    const n = count ? Number(count) : 1;
    const c = key === "." ? null : pal[KEYS.indexOf(key!)]!;
    if (c) for (let i = 0; i < n; i++) data.set(c, (at + i) * 4);
    at += n;
  }
  pixels.set(name, data);
  return data;
}

/** A portrait's whole frame as an image, made once (a browser's: ImageData). */
const images = new Map<string, ImageData>();
export function portraitImage(name: string): ImageData | null {
  const p = PORTRAITS[name];
  const data = portraitPixels(name);
  if (!p || !data) return null;
  let img = images.get(name);
  if (!img) images.set(name, (img = new ImageData(new Uint8ClampedArray(data), p.w, p.h)));
  return img;
}
