/**
 * Going into a room (Nov 11, Eric: "when it's zooming in... the screen's not interactable anyway, that's actually like part of the true
 * loading"): while the town zooms on the door, `loadRoom` paints the room's pictures a slice a frame (`ms` of work, then the next
 * frame), so the town keeps drawing through the zoom; at 0 (once the black is up) it paints the rest at once. Its own small module:
 * the town sets it without loading the room's code.
 */
let sliceMs = 0;
/** Work a frame while the town zooms (ms); 0: no slicing. */
export function roomLoadSlice(ms: number): void {
  sliceMs = ms;
}
/** The slice now (ms; 0: none). */
export const roomSliceMs = (): number => sliceMs;
/** The next frame (or 50 ms, in a hidden tab, where no frame comes). */
export const nextFrame = (): Promise<void> =>
  new Promise((ok) => {
    const id = setTimeout(ok, 50);
    requestAnimationFrame(() => {
      clearTimeout(id);
      ok();
    });
  });
