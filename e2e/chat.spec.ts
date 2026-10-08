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

/** What the server has for this device's account: its quick chat picks (as ids). */
const savedPicks = (p: Page) => p.evaluate(() => fetch("/api/shop").then((r) => r.json()).then((s) => s.chat as { lines: string[]; emoji: string[] }));

test("quick chat picks in the profile: search, a check, n/10, locked lines to the shop and a pack's nudge back; exactly those lines in a match", async ({ browser }) => {
  test.setTimeout(9 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run plays both a phone and a computer");
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const phone = await (await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as any)).newPage();
  await named(desk, "Desky");
  await named(phone, "Phoney");
  for (const p of [desk, phone]) {
    await p.goto("/");
    await p.getByRole("button", { name: "Your profile" }).click();
    await expect(p.locator(".qp")).toBeVisible();
  }

  // The phone: the defaults to start (10 lines and the 8 free emoji), then its own picks.
  const qp = phone.locator(".qp");
  await expect(qp.locator(".qp-lines .qp-chip")).toHaveText(["Good luck!", "Have fun!", "Nice move!", "Wow!", "Oops…", "Trust the crowd", "Defend the king!", "Go for mate!", "GG", "Thanks!"].map((t) => new RegExp(`^${t}`)));
  await expect(qp.locator(".qp-lines .qp-count")).toHaveText("10/10");
  await expect(qp.locator(".qp-emoji .qp-chip")).toHaveCount(8);
  await qp.getByRole("button", { name: "Take out Trust the crowd" }).click();
  await expect(qp.locator(".qp-lines .qp-count")).toHaveText("9/10");
  await qp.getByRole("button", { name: /Choose lines/ }).click();
  const search = qp.getByPlaceholder("Search lines or packs");
  // (16 px or more: iOS doesn't zoom into it.)
  expect(parseFloat(await search.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await search.fill("pawn");
  await expect(qp.locator(".qp-opt")).toHaveCount(1);
  const pawns = qp.getByRole("checkbox", { name: "Push the pawns!" });
  await expect(pawns).toHaveAttribute("aria-checked", "false");
  await pawns.click();
  await expect(pawns).toHaveAttribute("aria-checked", "true");
  await expect(qp.locator(".qp-menu-foot")).toContainText("10/10 picked");
  // Full: the others wait until one comes out. A pack's lines show locked, with its name.
  await search.fill("crown");
  await expect(qp.locator(".qp-opt.locked", { hasText: "For the crown!" })).toContainText("God King pack");
  await search.fill("");
  await expect(qp.getByRole("checkbox", { name: "Hi all!" })).toBeDisabled();
  // Big tap targets.
  for (const box of await qp.locator(".qp-opt").evaluateAll((els) => els.slice(0, 6).map((e) => e.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
  await qp.getByRole("button", { name: "Done" }).first().click();
  await qp.getByRole("button", { name: "Take out 💀 (skull)" }).click();
  const phonePicks = ["Good luck!", "Have fun!", "Nice move!", "Wow!", "Oops…", "Defend the king!", "Go for mate!", "GG", "Thanks!", "Push the pawns!"];
  await expect.poll(() => savedPicks(phone)).toEqual({
    lines: ["good-luck", "have-fun", "nice-move", "wow", "oops", "defend-king", "go-mate", "gg", "thanks", "push-pawns"],
    emoji: ["e-thumbs", "e-clap", "e-laugh", "e-wow", "e-grimace", "e-fire", "e-party"],
  });
  expect(await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  // The computer: a locked line goes to the shop's chat packs; getting the pack (full picks) says to pick them in
  // the profile, which opens at Quick chat and emoji.
  const dq = desk.locator(".qp");
  await dq.getByRole("button", { name: /Choose lines/ }).click();
  await dq.getByPlaceholder("Search lines or packs").fill("crown");
  await dq.getByRole("button", { name: /For the crown!: locked/ }).click();
  await expect(desk.getByRole("tab", { name: "Chat packs" })).toHaveAttribute("aria-selected", "true");
  await expect(desk.locator(".shop-chat-foot")).toContainText("Choose your lines and emoji in your profile");
  await desk.locator(".shop-item", { hasText: "God King pack" }).getByRole("button", { name: /Get/ }).click();
  await expect(desk.locator(".shop-got")).toContainText("full (10/10)");
  await desk.locator(".shop-got").getByRole("button", { name: "Pick these in your profile ›" }).click();
  await expect(dq).toBeInViewport();
  await dq.getByRole("button", { name: "Take out Thanks!" }).click();
  await dq.getByRole("button", { name: "Take out Oops…" }).click();
  await dq.getByRole("button", { name: /Choose lines/ }).click();
  await dq.getByPlaceholder("Search lines or packs").fill("crown");
  await dq.getByRole("checkbox", { name: "For the crown!" }).click();
  await expect(dq.locator(".qp-lines .qp-count")).toHaveText("9/10");
  const deskPicks = ["Good luck!", "Have fun!", "Nice move!", "Wow!", "Trust the crowd", "Defend the king!", "Go for mate!", "GG", "For the crown!"];
  await expect.poll(() => savedPicks(desk)).toMatchObject({ lines: ["good-luck", "have-fun", "nice-move", "wow", "trust-crowd", "defend-king", "go-mate", "gg", "gk-crown"] });

  // Into a match (a fresh load: the picks come from the account).
  for (const p of [desk, phone]) {
    await p.goto("/?debug&pool=chat");
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    await expect(p.locator(".fd-seats")).toBeVisible();
  }
  // Chat opens in the queue (the lobby's chat, one channel for everyone there; e2e/lobby-chat.spec.ts) and carries on
  // into the match.
  for (const p of [desk, phone]) await expect(p.locator(".fd-queue .qchat-lobby")).toBeVisible();
  for (const p of [desk, phone]) await expect.poll(() => p.evaluate(() => (window as any).match.chat.enabled), { timeout: 60_000 }).toBe(true);
  // Exactly the lines picked in the profile there too.
  await expect(phone.locator(".qchat-lobby .qrow:not(.emoji) .qchip")).toHaveText(phonePicks);
  for (const p of [desk, phone]) await expect.poll(() => phase(p), { timeout: 90_000 }).toMatch(/play|watching/);
  const same = (await team(desk)) === (await team(phone));

  // Phone: chat shares the space under the board with the scoreboard (narrow), side by side. Never over the board.
  await expect(phone.locator(".under-board.ub-split .mini-tower.narrow")).toBeVisible();
  const split = phone.locator(".under-board.ub-split .qchat-split");
  await expect(split).toBeVisible();
  expect(overlaps((await rect(phone, ".qchat-split"))!, (await rect(phone, ".board-area cg-board"))!)).toBe(false);
  // Exactly the lines picked in the profile, in that order; the emoji picked.
  await expect(phone.locator(".qchat-split .qrow:not(.emoji) .qchip")).toHaveText(phonePicks);
  await expect(phone.locator(".qchat-split .qrow.emoji .qchip")).toHaveText(["👍", "👏", "😂", "😮", "😬", "🔥", "🎉"]);
  // Computer: the chat panel in the column beside the board (the leaderboard has the side of the screen).
  await expect(desk.locator(".under-board.side .qchat-side")).toBeVisible();
  await expect(desk.locator(".tower-side")).toBeVisible();
  await expect(desk.locator(".qchat-side .qgroup-lines:not(.emoji) .qchip")).toHaveText(deskPicks);
  await expect(desk.locator(".qchat-side .qgroup-lines.emoji .qchip")).toHaveCount(8);

  // A pack's Hello line to everyone (the switch): the phone sees it with the computer's name, from the server.
  await desk.locator(".qto button", { hasText: "All" }).click();
  await expect(desk.locator(".qchat-side .qfeed-hint")).toContainText("Hello and Sporting lines and emoji go to both teams");
  // In All, plans can't be sent; emoji can.
  await expect(desk.locator(".qchat-side .qchip", { hasText: "Defend the king!" })).toBeDisabled();
  await desk.locator(".qchat-side .qchip", { hasText: "For the crown!" }).click();
  await expect(phone.locator(".qchat-split .qline", { hasText: "For the crown!" }).filter({ hasText: "Desky" })).toBeVisible();
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

  // The server drops free text and lines from packs you don't own (the phone hasn't got the God King pack).
  await phone.evaluate(() => {
    const m = (window as any).match;
    m.send({ t: "chat", say: "Free text, typed!" });
    m.send({ t: "chat", say: "gk-crown", to: "all" });
  });
  await desk.waitForTimeout(800);
  expect(await desk.evaluate(() => (window as any).match.chat.list.filter((l: any) => !["gk-crown", "push-pawns"].includes(l.say) && !/^bot/.test(l.from)).length)).toBe(0);
  expect(await desk.evaluate(() => (window as any).match.chat.list.filter((l: any) => l.say === "gk-crown").length)).toBe(1);

  // An emoji to the team floats over its sender's row on the computer's leaderboard (when they're on the same team).
  await phone.locator(".qchat-split .qrow.emoji .qchip").first().click();
  if (same) await expect(desk.locator(".tower-side .t-float")).toBeVisible();

  // An emoji to everyone: it reaches the phone whichever team it's on. On the other team's scoreboard (no row for
  // the sender) it floats from the header, with the sender's team chip.
  await desk.locator(".qto button", { hasText: "All" }).click();
  const fire = desk.locator(".qchat-side .qgroup-lines.emoji .qchip", { hasText: "🔥" });
  await expect(fire).toBeEnabled();
  await fire.click();
  await expect(phone.locator(".qchat-split .qline.emoji", { hasText: "🔥" }).filter({ hasText: "Desky" })).toBeVisible();
  expect(await phone.evaluate(() => (window as any).match.chat.list.find((l: any) => l.say === "e-fire")?.to)).toBe("all");
  await expect(phone.locator(".mini-tower .t-float").first()).toBeVisible();
  if (!same) await expect(phone.locator(".mini-tower .tower-floats .t-float.away .team-chip")).toBeVisible();
  await desk.locator(".qto button", { hasText: "Team" }).click();

  // The computer mutes the phone (a tap on the name): their lines disappear, and the server stops sending them.
  await phone.waitForTimeout(3100);
  await phone.locator(".qto button", { hasText: "All" }).click();
  await phone.locator(".qchat-split .qchip", { hasText: "Have fun!" }).click();
  const line = desk.locator(".qchat-side .qline", { hasText: "Have fun!" }).filter({ hasText: "Phoney" });
  await expect(line).toBeVisible();
  await line.locator(".qline-name").click();
  await desk.locator(".qmenu").getByRole("button", { name: "Mute for this match" }).click();
  await expect(line).toHaveCount(0);
  await expect(desk.locator(".qchat-side .qfeed-empty", { hasText: "Muted this match: Phoney" })).toBeVisible();
  await phone.waitForTimeout(3100);
  await phone.locator(".qchat-split .qchip", { hasText: "Good luck!" }).click();
  await expect(phone.locator(".qchat-split .qline.you", { hasText: "Good luck!" })).toBeVisible();
  await desk.waitForTimeout(800);
  expect(await desk.evaluate(() => (window as any).match.chat.list.some((l: any) => l.say === "good-luck" && !/^bot/.test(l.from)))).toBe(false);
  await phone.locator(".qto button", { hasText: "Team" }).click();

  // The phone, chat full width: the emoji in one row, no scrolling; the board still takes a move by two taps.
  const boardBefore = (await rect(phone, ".board-area cg-board"))!;
  await phone.getByRole("button", { name: "Chat full width" }).click();
  await expect(phone.locator(".under-board.ub-chat .qchat-full")).toBeVisible();
  await expect(phone.locator(".under-board .mini-tower")).toHaveCount(0);
  const emojiRow = phone.locator(".qchat-full .qrow.emoji");
  expect(await emojiRow.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
  expect(new Set(await emojiRow.locator(".qchip").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))).size).toBe(1);
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
  await expect(phone.locator(".under-board.ub-board .qchat")).toHaveCount(0);
  await untilMyTurn(phone, desk);
  await desk.locator(".qto button", { hasText: "All" }).click();
  await desk.locator(".qchat-side .qchip", { hasText: "GG" }).click();
  const bubble = phone.locator(".qbubble");
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText("GG");
  expect(overlaps((await rect(phone, ".qbubble"))!, (await rect(phone, ".board-area cg-board"))!)).toBe(false);
  // It lets taps through.
  expect(await bubble.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  const second = await tapMove(phone);
  await expect.poll(picked).toEqual([first, second]);
  // While chat is hidden the scoreboard's header counts what's new; a tap brings chat back beside it.
  const unread = phone.locator(".mini-tower-head .qunread");
  await expect(unread).toBeVisible();
  await unread.click();
  await expect(phone.locator(".under-board.ub-split .qchat-split")).toBeVisible();
  await expect(phone.locator(".qchat-split .qline", { hasText: "GG" }).filter({ hasText: "Desky" })).toBeVisible();
  await expect(unread).toHaveCount(0);
  expect(await rect(phone, ".board-area cg-board")).toEqual(boardBefore);
});
