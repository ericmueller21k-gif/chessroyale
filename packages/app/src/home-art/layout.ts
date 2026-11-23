/**
 * How a scene (Chess Town's button picture) sits in its box: pure arithmetic, so it's tested without a browser. All sizes are
 * device pixels unless said; an art pixel is always a whole number of device pixels (nothing is smoothed or blurred).
 */

export interface SceneLayout {
  /** Device pixels per art pixel. */
  d: number;
  /** Where the picture's left edge sits (can be negative: a box narrower than the picture cuts both ends evenly). */
  x: number;
  /** Where its top edge sits; the foot is the box's foot. Negative when the last rows are cut (`drop`). */
  y: number;
  /** How many of the picture's last rows are cut off to fit the box (the plaza's plain rows), 0 when the picture fits whole. */
  drop: number;
  /**
   * What fills the box beside the picture: `none` (it fills the width), `ground` (a narrow gap, under 12 art pixels a side: the
   * ground's end column stretched out to the edge) or `repeat` (a wide one: the picture's own ends repeated, so the town goes on).
   */
  sides: "none" | "ground" | "repeat";
}

/** The sizes tried, in CSS pixels per art pixel, biggest first (the last resort is 1). */
const SCALES = [4, 3, 2] as const;

/**
 * The biggest whole-pixel scale whose picture (less `dropBottom` rows) fits the box's height, give or take 6 CSS pixels, then
 * where that puts it: down on the box's foot, centered across. `dropBottom` rows are cut only when the whole picture is too tall.
 */
export function sceneLayout(art: { w: number; h: number }, box: { w: number; h: number }, dpr: number, dropBottom: number): SceneLayout {
  const whole = (css: number) => Math.max(1, Math.floor(css * dpr));
  const scale = SCALES.find((t) => (art.h - dropBottom) * whole(t) <= box.h + 6 * dpr) ?? 1;
  const d = whole(scale);
  const drop = art.h * d <= box.h ? 0 : dropBottom;
  const x = Math.floor((box.w - art.w * d) / 2);
  const y = box.h - (art.h - drop) * d;
  const sides = x <= 0 ? "none" : x < 12 * d ? "ground" : "repeat";
  return { d, x, y, drop, sides };
}
