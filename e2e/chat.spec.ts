import { devices, expect, type Page } from "@playwright/test";
import { legalMoves, pieceAt } from "@chessroyale/chess";
import { BOARD_SEL, named, test, pickMode } from "./helpers.ts";

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");
const team = (p: Page) => p.evaluate(() => (window as any).match.standings().find((s: any) => s.isYou)?.team as "w" | "b");

/** The page's board and the box a panel takes, to check they never overlap. */
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
      // (The game's own rules: a 50 v 50 may start from Freestyle's Chess960 position, which chess.js can't read.)
      const mv = legalMoves(fen)[0]!;
      await other.evaluate((m) => {
        const x = (window as any).match;
        if (x.phase.kind === "play" && Date.now() > x.phase.startsAt) x.submit(m);
      }, mv);
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
  const moves = legalMoves(fen)
    .filter((m) => m.length === 4)
    .map((m) => ({ from: m.slice(0, 2), to: m.slice(2, 4) }));
  const mv = moves.find((m) => pieceAt(fen, m.from)?.type === "n") ?? moves[0]!;
  const box = (await rect(p, `.board-area ${BOARD_SEL.squares}`))!;
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

test("quick chat picks in the profile: search, a check, n/10, free lines only (the chat packs are off, Nov 8); exactly those lines in a match", async ({ browser }) => {
  test.setTimeout(9 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run plays both a phone and a computer");
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const phone = await (await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as any)).newPage();
  await named(desk, "Desky");
  await named(phone, "Phoney");
  for (const p of [desk, phone]) {
    await p.goto("/");
    // (Your profile: the top bar's pawn on a phone, the side menu's Profile on a computer: the right column's pawn went, Nov 7.)
    await p.getByRole("button", { name: "Your profile", exact: true }).or(p.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Profile" })).filter({ visible: true }).first().click();
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
  // Full: the others wait until one comes out. The chat packs are off (CHAT_PACKS_SHOP, Nov 8): the picker has no pack lines.
  await search.fill("ho ho");
  await expect(qp.locator(".qp-opt")).toHaveCount(0);
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

  // The computer: 9 of its 10 free lines (the chat packs are off, Nov 8).
  const dq = desk.locator(".qp");
  await dq.getByRole("button", { name: /Choose lines/ }).click();
  await dq.getByRole("button", { name: "Take out Thanks!" }).click();
  await dq.getByRole("button", { name: "Take out Oops…" }).click();
  await dq.getByPlaceholder("Search lines or packs").fill("hi all");
  await dq.getByRole("checkbox", { name: "Hi all!" }).click();
  await expect(dq.locator(".qp-lines .qp-count")).toHaveText("9/10");
  const deskPicks = ["Good luck!", "Have fun!", "Nice move!", "Wow!", "Trust the crowd", "Defend the king!", "Go for mate!", "GG", "Hi all!"];
  await expect.poll(() => savedPicks(desk)).toMatchObject({ lines: ["good-luck", "have-fun", "nice-move", "wow", "trust-crowd", "defend-king", "go-mate", "gg", "hi-all"] });

  // Into a match (a fresh load: the picks come from the account).
  for (const p of [desk, phone]) {
    // (?afk=0: 50 v 50's AFK rule off, CrowdMisses: the computer never picks, and the 4th miss would take it out of the match.)
    await p.goto("/?debug&pool=chat&afk=0");
    await pickMode(p);
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    await expect(p.locator(".fd-seats")).toBeVisible();
  }
  // Chat opens in the queue (the lobby's chat, one channel for everyone there; e2e/lobby-chat.spec.ts) and carries on
  // into the match.
  for (const p of [desk, phone]) await expect(p.locator(".fd-home.queueing .qchat-lobby")).toBeVisible();
  for (const p of [desk, phone]) await expect.poll(() => p.evaluate(() => (window as any).match.chat.enabled), { timeout: 60_000 }).toBe(true);
  // Exactly the lines picked in the profile there too.
  await expect(phone.locator(".qchat-lobby .qrow:not(.emoji) .qchip")).toHaveText(phonePicks);
  for (const p of [desk, phone]) await expect.poll(() => phase(p), { timeout: 90_000 }).toMatch(/play|watching/);
  const same = (await team(desk)) === (await team(phone));
  /** The phone's chat tab: open a picker ("Quick phrases" or "Emoji") and tap a line in it. */
  const sayOnPhone = async (picker: string, text: string) => {
    if (!(await phone.locator(".qchat-tab .qpop").count())) await phone.getByRole("button", { name: picker, exact: true }).click();
    await phone.locator(".qchat-tab .qpop .qchip", { hasText: text }).click();
  };

  // Phone (Nov 1): one box under the vote box, the scoreboard, with Chat as its tab. Chat replaces the scoreboard in the
  // same box (same place, same size); it never covers the board.
  await expect(phone.locator(".under-board.ub-tab .mini-tower")).toBeVisible();
  await expect(phone.locator(".under-board .qchat")).toHaveCount(0);
  const boxBefore = (await rect(phone, ".under-board.ub-tab"))!;
  await phone.getByRole("button", { name: "Chat", exact: true }).click();
  const split = phone.locator(".under-board.ub-tab .qchat-tab");
  await expect(split).toBeVisible();
  await expect(phone.locator(".under-board .mini-tower")).toHaveCount(0);
  expect(await rect(phone, ".under-board.ub-tab")).toEqual(boxBefore);
  expect(overlaps((await rect(phone, ".qchat-tab"))!, (await rect(phone, `.board-area ${BOARD_SEL.squares}`))!)).toBe(false);
  // (Nov 1, Eric: no rows of buttons under the feed; "T" opens the phrases, the emoji button the emoji.) Exactly the lines
  // picked in the profile, in that order; the emoji picked.
  await expect(phone.locator(".qchat-tab .qbuttons")).toHaveCount(0);
  await phone.getByRole("button", { name: "Quick phrases", exact: true }).click();
  await expect(phone.locator(".qchat-tab .qpop .qgroup-lines:not(.emoji) .qchip")).toHaveText(phonePicks);
  await phone.getByRole("button", { name: "Emoji", exact: true }).click();
  await expect(phone.locator(".qchat-tab .qpop .qgroup-lines.emoji .qchip")).toHaveText(["👍", "👏", "😂", "😮", "😬", "🔥", "🎉"]);
  await phone.getByRole("button", { name: "Emoji", exact: true }).click();
  await expect(phone.locator(".qchat-tab .qpop")).toHaveCount(0);
  // Computer: the chat panel in the column beside the board (the leaderboard has the side of the screen).
  await expect(desk.locator(".under-board.side .qchat-side")).toBeVisible();
  await expect(desk.locator(".tower-side")).toBeVisible();
  await expect(desk.locator(".qchat-side .qgroup-lines:not(.emoji) .qchip")).toHaveText(deskPicks);
  await expect(desk.locator(".qchat-side .qgroup-lines.emoji .qchip")).toHaveCount(8);

  // A free Hello line to everyone (the switch): the phone sees it with the computer's name, from the server.
  await desk.locator(".qto button", { hasText: "All" }).click();
  await expect(desk.locator(".qchat-side .qfeed-hint")).toContainText("Hello and Sporting lines and emoji go to both teams");
  // In All, plans can't be sent; emoji can.
  await expect(desk.locator(".qchat-side .qchip", { hasText: "Defend the king!" })).toBeDisabled();
  await desk.locator(".qchat-side .qchip", { hasText: "Hi all!" }).click();
  await expect(phone.locator(".qchat-tab .qline", { hasText: "Hi all!" }).filter({ hasText: "Desky" })).toBeVisible();
  await desk.locator(".qto button", { hasText: "Team" }).click();

  // A plan goes to your team only. Sending closes the phrases; right after, the buttons gray out (one message every 3 s).
  await sayOnPhone("Quick phrases", "Push the pawns!");
  await expect(phone.locator(".qchat-tab .qline.you", { hasText: "Push the pawns!" })).toBeVisible();
  await expect(phone.locator(".qchat-tab .qpop")).toHaveCount(0);
  await phone.getByRole("button", { name: "Quick phrases", exact: true }).click();
  await expect(phone.locator(".qchat-tab .qchip", { hasText: "Wow!" })).toBeDisabled();
  await desk.waitForTimeout(1000);
  expect(await desk.locator(".qchat-side .qline", { hasText: "Push the pawns!" }).count()).toBe(same ? 1 : 0);
  await expect(phone.locator(".qchat-tab .qchip", { hasText: "Wow!" })).toBeEnabled({ timeout: 4000 });
  // The same line again stays grayed for a while.
  await expect(phone.locator(".qchat-tab .qchip", { hasText: "Push the pawns!" })).toBeDisabled();
  // A tap elsewhere (the feed) closes the phrases.
  await phone.locator(".qchat-tab .qfeed").click({ position: { x: 5, y: 5 } });
  await expect(phone.locator(".qchat-tab .qpop")).toHaveCount(0);

  // The server drops free text and lines from packs you don't own (the phone hasn't got the Winter pack, and can't buy one now).
  await phone.evaluate(() => {
    const m = (window as any).match;
    m.send({ t: "chat", say: "Free text, typed!" });
    m.send({ t: "chat", say: "w-hohoho", to: "all" });
  });
  await desk.waitForTimeout(800);
  expect(await desk.evaluate(() => (window as any).match.chat.list.filter((l: any) => !["hi-all", "push-pawns"].includes(l.say) && !/^bot/.test(l.from)).length)).toBe(0);
  expect(await desk.evaluate(() => (window as any).match.chat.list.filter((l: any) => l.say === "w-hohoho").length)).toBe(0);
  // (Bots greet too: only the phone's own "Hi all!" counts.)
  expect(await desk.evaluate(() => (window as any).match.chat.list.filter((l: any) => l.say === "hi-all" && !/^bot/.test(l.from)).length)).toBe(1);

  // An emoji to the team floats over its sender's row on the computer's leaderboard (when they're on the same team).
  await phone.getByRole("button", { name: "Emoji", exact: true }).click();
  await phone.locator(".qchat-tab .qpop .qchip.emoji").first().click();
  if (same) await expect(desk.locator(".tower-side .t-float")).toBeVisible();

  // An emoji to everyone: it reaches the phone whichever team it's on. On the other team's scoreboard (no row for
  // the sender) it floats from the header, with the sender's team chip.
  await desk.locator(".qto button", { hasText: "All" }).click();
  const fire = desk.locator(".qchat-side .qgroup-lines.emoji .qchip", { hasText: "🔥" });
  await expect(fire).toBeEnabled();
  // (The floats are on the scoreboard: the phone is on it while the emoji comes in, then its chat again.)
  await phone.getByRole("button", { name: "Back", exact: true }).click();
  await fire.click();
  await expect(phone.locator(".mini-tower .t-float").first()).toBeVisible();
  if (!same) await expect(phone.locator(".mini-tower .tower-floats .t-float.away .team-chip")).toBeVisible();
  await phone.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(phone.locator(".qchat-tab .qline.emoji", { hasText: "🔥" }).filter({ hasText: "Desky" })).toBeVisible();
  expect(await phone.evaluate(() => (window as any).match.chat.list.find((l: any) => l.say === "e-fire")?.to)).toBe("all");
  await desk.locator(".qto button", { hasText: "Team" }).click();

  // The computer mutes the phone (a tap on the name): their lines disappear, and the server stops sending them.
  await phone.waitForTimeout(3100);
  await phone.locator(".qto button", { hasText: "All" }).click();
  await sayOnPhone("Quick phrases", "Have fun!");
  const line = desk.locator(".qchat-side .qline", { hasText: "Have fun!" }).filter({ hasText: "Phoney" });
  await expect(line).toBeVisible();
  await line.locator(".qline-name").click();
  await desk.locator(".qmenu").getByRole("button", { name: "Mute", exact: true }).click();
  await expect(line).toHaveCount(0);
  await expect(desk.locator(".qchat-side .qfeed-empty", { hasText: "Muted: Phoney" })).toBeVisible();
  await phone.waitForTimeout(3100);
  await sayOnPhone("Quick phrases", "Good luck!");
  await expect(phone.locator(".qchat-tab .qline.you", { hasText: "Good luck!" })).toBeVisible();
  await desk.waitForTimeout(800);
  expect(await desk.evaluate(() => (window as any).match.chat.list.some((l: any) => l.say === "good-luck" && !/^bot/.test(l.from)))).toBe(false);
  await phone.locator(".qto button", { hasText: "Team" }).click();

  // The phone, on its chat tab (the whole box): the emoji picker inside the box, every emoji whole, no sideways scroll, every
  // tap target 24 px or more (its two buttons too); the board still takes a move by two taps.
  const boardBefore = (await rect(phone, `.board-area ${BOARD_SEL.squares}`))!;
  await expect(phone.locator(".under-board.ub-tab .qchat-tab")).toBeVisible();
  await expect(phone.locator(".under-board .mini-tower")).toHaveCount(0);
  await phone.getByRole("button", { name: "Emoji", exact: true }).click();
  const pop = phone.locator(".qchat-tab .qpop");
  expect(await pop.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
  const inBox = (await rect(phone, ".qchat-tab"))!;
  for (const b of await pop.locator(".qchip").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(24);
    expect(b.left >= inBox.x - 0.5 && b.right <= inBox.x + inBox.width + 0.5).toBe(true);
  }
  for (const name of ["Quick phrases", "Emoji"]) {
    const b = (await phone.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(24);
  }
  await phone.getByRole("button", { name: "Emoji", exact: true }).click();
  await expect(pop).toHaveCount(0);
  await untilMyTurn(phone, desk);
  expect(overlaps((await rect(phone, ".qchat-tab"))!, (await rect(phone, `.board-area ${BOARD_SEL.squares}`))!)).toBe(false);
  const picked = () => phone.evaluate(() => (window as any).__picked ?? []);
  const first = await tapMove(phone);
  await expect.poll(picked).toEqual([first]);
  // The board never moved or resized for chat.
  expect(await rect(phone, `.board-area ${BOARD_SEL.squares}`)).toEqual(boardBefore);

  // The scoreboard (chat hidden, "‹ Back"): a new line shows nowhere over or above the board (Eric, Nov 4: the
  // new-message bubble went; chat stays in its box), watched from before it's sent; a move made meanwhile still lands.
  await phone.getByRole("button", { name: "Back", exact: true }).click();
  await expect(phone.locator(".under-board .qchat")).toHaveCount(0);
  await untilMyTurn(phone, desk);
  await phone.evaluate(() => {
    const w = window as any;
    w.__outside = [];
    // (Any text with "GG" added anywhere but the box under the board: the old bubble, or anything like it.)
    const look = (n: Node) => {
      const el = n.nodeType === 1 ? (n as Element) : n.parentElement;
      if (el && !el.closest(".under-board") && /\bGG\b/.test(n.textContent ?? "")) w.__outside.push(el.className || el.tagName);
    };
    new MutationObserver((ms) => ms.forEach((m) => (m.type === "characterData" ? look(m.target) : m.addedNodes.forEach(look)))).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await desk.locator(".qto button", { hasText: "All" }).click();
  await desk.locator(".qchat-side .qchip", { hasText: "GG" }).click();
  const second = await tapMove(phone);
  await expect.poll(picked).toEqual([first, second]);
  // While chat is hidden the scoreboard's Chat tab counts what's new; a tap opens chat in the same box.
  const unread = phone.locator(".under-board .mini-chat-tab .mini-unread");
  await expect(unread).toBeVisible();
  await expect(phone.locator(".qbubble")).toHaveCount(0);
  expect(await phone.evaluate(() => (window as any).__outside), "nothing of the new line outside the box under the board").toEqual([]);
  await phone.locator(".under-board .mini-chat-tab").click();
  await expect(phone.locator(".under-board.ub-tab .qchat-tab")).toBeVisible();
  await expect(phone.locator(".qchat-tab .qline", { hasText: "GG" }).filter({ hasText: "Desky" })).toBeVisible();
  await expect(unread).toHaveCount(0);
  expect(await rect(phone, `.board-area ${BOARD_SEL.squares}`)).toEqual(boardBefore);
});

test("a name's menu and the chat options stay open when the round moves on (each phase draws its own screen)", async ({ browser }) => {
  // (Kept by each screen's panel, the menu closed by itself at the next phase: the test above then waited for its Mute
  // button until it timed out. docs/decisions/2026-10-16-flaky-e2e-batch-4.md)
  test.setTimeout(4 * 60_000);
  test.skip(test.info().project.name !== "desktop", "the computer's chat column");
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await named(desk, "Menus");
  // (?afk=0: 50 v 50's AFK rule off, CrowdMisses: this player never picks, and the 4th miss would take them out of the match.)
  await desk.goto("/?debug&pool=chatmenu&afk=0");
  await pickMode(desk);
  await desk.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => phase(desk), { timeout: 90_000 }).toMatch(/play|watching/);
  const name = desk.locator(".qchat-side .qline .qline-name").first();
  await expect(name).toBeVisible({ timeout: 30_000 });
  // Every frame from before the tap: the phase, and whether the menu (then the options) is on screen.
  await desk.evaluate(() => {
    const w = window as any;
    w.__open = [];
    const tick = () => {
      w.__open.push([w.match?.phase.kind, !!document.querySelector(".qchat-side .qmenu"), !!document.querySelector(".qchat-side .qoptions")]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const frames = () => desk.evaluate(() => (window as any).__open as [string, boolean, boolean][]);
  /** Waits for the phase after this one, and a moment of the next screen. */
  const nextPhase = async () => {
    const at = await phase(desk);
    await expect.poll(() => phase(desk), { timeout: 60_000 }).not.toBe(at);
    const n = (await frames()).length;
    await expect.poll(async () => (await frames()).length, { timeout: 5_000 }).toBeGreaterThan(n + 10);
  };
  /** From the first frame it showed, the panel (`i`: 1 the menu, 2 the options) was on screen in every frame, across a phase change. */
  const heldOpen = async (i: 1 | 2) => {
    const f = await frames();
    const from = f.findIndex((x) => x[i]);
    expect(from, "it opened").toBeGreaterThanOrEqual(0);
    const since = f.slice(from);
    expect(new Set(since.map((x) => x[0])).size, "a phase change while it was open").toBeGreaterThan(1);
    expect(since.filter((x) => !x[i]).map((x) => x[0]), "frames without it").toEqual([]);
  };
  await name.click();
  const menu = desk.locator(".qchat-side .qmenu");
  await expect(menu).toBeVisible();
  await nextPhase();
  await heldOpen(1);
  // And it still works: Mute (a bot's lines, for this match).
  const who = (await menu.getAttribute("aria-label"))!;
  await menu.getByRole("button", { name: /^Mute/ }).click();
  await expect(menu).toHaveCount(0);
  await expect(desk.locator(".qchat-side .qline .qline-name", { hasText: who })).toHaveCount(0);
  // The options too.
  await desk.evaluate(() => ((window as any).__open = []));
  await desk.getByRole("button", { name: "Chat options" }).click();
  await expect(desk.locator(".qchat-side .qoptions")).toBeVisible();
  await nextPhase();
  await heldOpen(2);
  await desk.locator(".qchat-side .qoptions").getByRole("button", { name: "Done" }).click();
  await expect(desk.locator(".qchat-side .qoptions")).toHaveCount(0);
});
