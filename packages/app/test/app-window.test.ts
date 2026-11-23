import { describe, expect, it, vi } from "vitest";
import { APP_WINDOW } from "@chessroyale/core";
import { sizeAppWindow } from "../src/install.ts";

/** The installed app on a computer opens once at a computer's size, centered (Eric, Nov 20: it opened narrow, in the phone layout). */
function fakeWindow(o: { standalone?: boolean; finePointer?: boolean; outerWidth?: number; availWidth?: number; availHeight?: number } = {}) {
  const media: Record<string, boolean> = {
    "(display-mode: standalone)": o.standalone ?? true,
    "(hover: hover) and (pointer: fine)": o.finePointer ?? true,
  };
  return {
    matchMedia: (q: string) => ({ matches: media[q] ?? false }) as MediaQueryList,
    outerWidth: o.outerWidth ?? 500,
    resizeTo: vi.fn(),
    moveTo: vi.fn(),
    screen: { availWidth: o.availWidth ?? 1920, availHeight: o.availHeight ?? 1040, availLeft: 0, availTop: 0 },
    navigator: {} as Navigator,
  };
}
function fakeStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("the installed app's first window", () => {
  it("opens at APP_WINDOW, centered, on its first launch only", () => {
    const win = fakeWindow();
    const store = fakeStore();
    sizeAppWindow(win, store);
    expect(win.resizeTo).toHaveBeenCalledWith(APP_WINDOW.width, APP_WINDOW.height);
    expect(win.moveTo).toHaveBeenCalledWith((1920 - APP_WINDOW.width) / 2, (1040 - APP_WINDOW.height) / 2);
    const again = fakeWindow();
    sizeAppWindow(again, store);
    expect(again.resizeTo).not.toHaveBeenCalled();
  });

  it("fits a smaller screen", () => {
    const win = fakeWindow({ availWidth: 1366, availHeight: 728 });
    sizeAppWindow(win, fakeStore());
    expect(win.resizeTo).toHaveBeenCalledWith(1366, 728);
  });

  it("leaves a tab, a phone or tablet, and a window already wide alone", () => {
    for (const o of [{ standalone: false }, { finePointer: false }, { outerWidth: 1700 }]) {
      const win = fakeWindow(o);
      sizeAppWindow(win, fakeStore());
      expect(win.resizeTo).not.toHaveBeenCalled();
    }
  });
});
