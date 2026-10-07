import { devices, expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { named, test } from "./helpers.ts";

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");
const team = (p: Page) => p.evaluate(() => (window as any).match.standings().find((s: any) => s.isYou)?.team as "w" | "b");

/** The page's board and the box a panel or bubble takes, to check they never overlap. */
const rect = (p: Page, sel: string) => p.locator(sel).first().boundingBox();
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Waits until this page's team is picking and the board takes moves; meanwhile the other page picks any legal move
 * whenever it has to (so a round never waits for it).
 */
async function untilMyTurn(p: Page, other: Page) {
  const stopAt = Date.now() + 120_000;
  while (Date.now() < stopAt) {
    if ((await phase(other)) === "play") {
      const fen: string = await other.evaluate(() => (window as any).match.phase.board.fen);
      const mv = new Chess(fen).moves({ verbose: true })[0]!;
      await other.evaluate((m) => {
        const x = (window as any).match;
        if (x.phase.kind === "play" && Date.now() > x.phase.startsAt) x.submit(m);
      }, mv.from + mv.to + (mv.promotion ?? ""));
    }
    const ready = await p.evaluate(() => {
      const m = (window as any).match;
      return m?.phase.kind === "play" && Date.now() > m.phase.startsAt + 400;
    });
    if (ready) return;
    await p.waitForTimeout(200);
  }
  throw new Error("never this team's turn");
}

/** Plays a legal move by tapping its two squares on the board (real taps). Returns the move. */
async function tapMove(p: Page): Promise<string> {
  // (Picks are recorded as the board hands them over, whatever the phase is by the time we look.)
  await p.evaluate(() => {
    const m = (window as any).match;
    if (m.__recorded) return;
    m.__recorded = true;
    const submit = m.submit.bind(m);
    m.submit = (mv: string) => {
      ((window as any).__picked ??= []).push(mv);
      submit(mv);
    };
  });
  const fen: string = await p.evaluate(() => (window as any).match.phase.board.fen);
  const side = fen.split(" ")[1];
  const moves = new Chess(fen).moves({ verbose: true }).filter((m) => !m.promotion);
  const mv = moves.find((m) => m.piece === "n") ?? moves[0]!;
  const box = (await rect(p, ".board-area cg-board"))!;
  const at = (sq: string) => {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    const col = side === "w" ? f : 7 - f;
    const row = side === "w" ? 7 - r : r;
    return { x: box.x + ((col + 0.5) * box.width) / 8, y: box.y + ((row + 0.5) * box.height) / 8 };
  };
  await p.touchscreen.tap(at(mv.from).x, at(mv.from).y);
  await p.waitForTimeout(120);
  await p.touchscreen.tap(at(mv.to).x, at(mv.to).y);
  return mv.from + mv.to;
}

test("quick chat in a 50 v 50 on a phone and a computer: presets to team or all, limits, mute, and the board still takes moves with chat open or a bubble showing", async ({ browser }) => {
  test.setTimeout(8 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run plays both a phone and a computer");
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const phone = await (await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as any)).newPage();
  await named(desk, "Desky");
  await named(phone, "Phoney");
  for (const p of [desk, phone]) {
    await p.goto("/?debug&pool=chat");
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    await expect(p.locator(".fd-seats")).toBeVisible();
  }
  // Not in the queue: chat opens with the match.
  await expect(phone.locator(".qchat")).toHaveCount(0);
  for (const p of [desk, phone]) await expect.poll(() => p.evaluate(() => (window as any).match.chat.enabled), { timeout: 60_000 }).toBe(true);
  for (const p of [desk, phone]) await expect.poll(() => phase(p), { timeout: 90_000 }).toMatch(/play|watching/);
  const same = (await team(desk)) === (await team(phone));

  // Phone: chat shares the space under the board with the scoreboard (narrow), side by side. Never over the board.
  await expect(phone.locator(".under-board.split .mini-tower.narrow")).toBeVisible();
  const split = phone.locator(".under-board.split .qchat-split");
  await expect(split).toBeVisible();
  expect(overlaps((await rect(phone, ".qchat-split"))!, (await rect(phone, ".board-area cg-board"))!)).toBe(false);
  // Computer: the chat panel in the column beside the board (the leaderboard has the side of the screen).
  await expect(desk.locator(".under-board.side .qchat-side")).toBeVisible();
  await expect(desk.locator(".tower-side")).toBeVisible();
  await expect(desk.locator(".qchat-side .qgroup-name")).toHaveText(["Hello", "Reactions", "Plans", "Sporting"]);

  // Hello to everyone (the switch): the phone sees it with the computer's name, from the server.
  await desk.locator(".qto button", { hasText: "All" }).click();
  await expect(desk.locator(".qchat-side .qfeed-hint")).toContainText("Hello and Sporting lines go to both teams");
  // In All, plans can't be sent.
  await expect(desk.locator(".qchat-side .qchip", { hasText: "Push the pawns!" })).toBeDisabled();
  await desk.locator(".qchat-side .qchip", { hasText: "Good luck!" }).click();
  await expect(phone.locator(".qchat-split .qline", { hasText: "Good luck!" }).filter({ hasText: "Desky" })).toBeVisible();
  await desk.locator(".qto button", { hasText: "Team" }).click();

  // A plan goes to your team only. Right after sending, the buttons grey out (one message every 3 s).
  await phone.locator(".qchat-split .qchip", { hasText: "Push the pawns!" }).click();
  await expect(phone.locator(".qchat-split .qline.you", { hasText: "Push the pawns!" })).toBeVisible();
  await expect(phone.locator(".qchat-split .qchip", { hasText: "Wow!" })).toBeDisabled();
  await desk.waitForTimeout(1000);
  expect(await desk.locator(".qchat-side .qline", { hasText: "Push the pawns!" }).count()).toBe(same ? 1 : 0);
  await expect(phone.locator(".qchat-split .qchip", { hasText: "Wow!" })).toBeEnabled({ timeout: 4000 });
  // The same line again stays greyed for a while.
  await expect(phone.locator(".qchat-split .qchip", { hasText: "Push the pawns!" })).toBeDisabled();

  // The server drops free text and lines from packs you don't own.
  await phone.evaluate(() => {
    const m = (window as any).match;
    m.send({ t: "chat", say: "Free text, typed!" });
    m.send({ t: "chat", say: "gk-crown", to: "all" });
  });
  await desk.waitForTimeout(800);
  expect(await desk.evaluate(() => (window as any).match.chat.list.filter((l: any) => !["good-luck", "push-pawns"].includes(l.say) && !/^bot/.test(l.from)).length)).toBe(0);

  // An emoji floats over its sender's row on the computer's leaderboard (when they're on the same team).
  await phone.locator(".qchat-split .qrow.emoji .qchip").first().click();
  if (same) await expect(desk.locator(".tower-side .t-float")).toBeVisible();

  // The computer mutes the phone (a tap on the name): their lines disappear, and the server stops sending them.
  await phone.waitForTimeout(3100);
  await phone.locator(".qto button", { hasText: "All" }).click();
  await phone.locator(".qchat-split .qchip", { hasText: "Hi all!" }).click();
  const line = desk.locator(".qchat-side .qline", { hasText: "Hi all!" }).filter({ hasText: "Phoney" });
  await expect(line).toBeVisible();
  await line.locator(".qline-name").click();
  await desk.locator(".qmenu").getByRole("button", { name: "Mute for this match" }).click();
  await expect(line).toHaveCount(0);
  await expect(desk.locator(".qchat-side .qfeed-empty", { hasText: "Muted this match: Phoney" })).toBeVisible();
  await phone.waitForTimeout(3100);
  await phone.locator(".qchat-split .qchip", { hasText: "Let's go!" }).click();
  await expect(phone.locator(".qchat-split .qline.you", { hasText: "Let's go!" })).toBeVisible();
  await desk.waitForTimeout(800);
  expect(await desk.evaluate(() => (window as any).match.chat.list.some((l: any) => l.say === "lets-go"))).toBe(false);
  await phone.locator(".qto button", { hasText: "Team" }).click();

  // The phone, chat full width: the board still takes a move by two taps.
  const boardBefore = (await rect(phone, ".board-area cg-board"))!;
  await phone.getByRole("button", { name: "Chat full width" }).click();
  await expect(phone.locator(".under-board.chat .qchat-full")).toBeVisible();
  await expect(phone.locator(".under-board .mini-tower")).toHaveCount(0);
  await untilMyTurn(phone, desk);
  expect(overlaps((await rect(phone, ".qchat-full"))!, (await rect(phone, ".board-area cg-board"))!)).toBe(false);
  const picked = () => phone.evaluate(() => (window as any).__picked ?? []);
  const first = await tapMove(phone);
  await expect.poll(picked).toEqual([first]);
  // The board never moved or resized for chat.
  expect(await rect(phone, ".board-area cg-board")).toEqual(boardBefore);

  // Scoreboard full width (chat hidden): a new line shows as a bubble under the top bar, never over the board, and a
  // move made while it shows still lands.
  await phone.getByRole("button", { name: "Side by side" }).click();
  await phone.getByRole("button", { name: "Leaderboard full width" }).click();
  await expect(phone.locator(".under-board.board .qchat")).toHaveCount(0);
  await untilMyTurn(phone, desk);
  await desk.locator(".qto button", { hasText: "All" }).click();
  await desk.locator(".qchat-side .qchip", { hasText: "Well played" }).click();
  const bubble = phone.locator(".qbubble");
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText("Well played");
  expect(overlaps((await rect(phone, ".qbubble"))!, (await rect(phone, ".board-area cg-board"))!)).toBe(false);
  // It lets taps through.
  expect(await bubble.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  const second = await tapMove(phone);
  await expect.poll(picked).toEqual([first, second]);
  // While chat is hidden the scoreboard's header counts what's new; a tap brings chat back beside it.
  const unread = phone.locator(".mini-tower-head .qunread");
  await expect(unread).toBeVisible();
  await unread.click();
  await expect(phone.locator(".under-board.split .qchat-split")).toBeVisible();
  await expect(phone.locator(".qchat-split .qline", { hasText: "Well played" })).toBeVisible();
  await expect(unread).toHaveCount(0);
  expect(await rect(phone, ".board-area cg-board")).toEqual(boardBefore);
});
