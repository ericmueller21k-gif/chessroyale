import { expect } from "@playwright/test";
import { named, test } from "./helpers.ts";

/**
 * The home page's global chat (DECISIONS.md, "Global chat on the home page"): a computer's right column, under Playing
 * now. Preset lines only, one message every 30 s (the server's limit; the app mirrors it), seen by everyone on the home
 * screen, with bots' lines tagged.
 */

const run = Date.now().toString(36).slice(-4);

test("global chat: post a line, everyone on the home page sees it, then the 30 s limit", async ({ page, browser }, info) => {
  if (info.project.name !== "desktop") {
    // A phone has no right column: the chat is the computer's for now.
    await named(page, "Phone");
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Global chat" })).toBeHidden();
    return;
  }
  test.setTimeout(120_000);
  const me = `Chat${run}`;
  await named(page, me);
  await page.goto("/");
  const chat = page.getByRole("region", { name: "Global chat" });
  await expect(chat).toBeVisible();
  // Under Playing now, in the right column.
  const right = page.getByRole("complementary", { name: "Live" });
  await expect(right.getByRole("region", { name: "Global chat" })).toBeVisible();
  const playingNow = (await right.getByText("PLAYING NOW").boundingBox())!;
  expect((await chat.boundingBox())!.y).toBeGreaterThan(playingNow.y);

  // Someone else on the home page, reading.
  const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const reader = await other.newPage();
  await named(reader, `Read${run}`);
  await reader.goto("/");
  const theirChat = reader.getByRole("region", { name: "Global chat" });
  await expect(theirChat).toBeVisible();

  // Presets only: there's no text box anywhere in it.
  await expect(chat.locator("input, textarea, [contenteditable]")).toHaveCount(0);
  await expect(chat.getByRole("tab", { name: "Lobby" })).toHaveAttribute("aria-selected", "true");
  await chat.getByRole("button", { name: "Anyone up for a raid?" }).click();

  // Mine: "You", the line, a time; then the buttons rest for 30 s.
  const mine = chat.locator(".gline.you").filter({ hasText: "Anyone up for a raid?" }).last();
  await expect(mine).toBeVisible();
  await expect(mine.locator("time")).toHaveText(/\d/);
  await expect(mine.locator(".gicon")).toBeVisible();
  await expect(chat.getByRole("button", { name: "Hey everyone!" })).toBeDisabled();
  await expect(chat.locator(".gchat-status")).toHaveText(/Next message in (29|30) s/);

  // The reader gets it with the live line (every few seconds), with my name: never "You".
  const seen = theirChat.locator(".gline").filter({ hasText: me }).filter({ hasText: "Anyone up for a raid?" });
  await expect(seen).toBeVisible({ timeout: 15_000 });
  await expect(seen).not.toHaveClass(/you/);

  // The server's own limit, whatever the app shows: a second line now is refused.
  const again = await page.request.post("/api/chat", { data: { say: "gg" } });
  expect(again.status()).toBe(429);
  expect(((await again.json()) as { retryMs: number }).retryMs).toBeGreaterThan(20_000);
  // Free text never goes, even straight to the server.
  expect((await reader.request.post("/api/chat", { data: { say: "hello from a script" } })).status()).toBe(400);

  // A reload remembers the wait (from your own line in the chat).
  await page.reload();
  await expect(chat.getByRole("button", { name: "Hey everyone!" })).toBeDisabled();
  await expect(chat.locator(".gchat-status")).toHaveText(/Next message in \d+ s/);

  // Emoji are a tab away; the reader's buttons still work.
  await theirChat.getByRole("tab", { name: "Emoji" }).click();
  await theirChat.getByRole("button", { name: /Send 🔥/ }).click();
  await expect(chat.locator(".gline.emoji").filter({ hasText: `Read${run}` }).filter({ hasText: "🔥" })).toBeVisible({ timeout: 15_000 });

  // Bots chatter for the beta, each line tagged.
  await expect(chat.locator(".gline.bot .gline-bot").first()).toHaveText(/bot/i, { timeout: 40_000 });

  // Muting someone hides their lines here only.
  await seen.getByRole("button", { name: /profile or mute/ }).click();
  await theirChat.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(seen).toHaveCount(0);
  await expect(theirChat.getByRole("button", { name: /muted · unmute/ })).toBeVisible();
  await theirChat.getByRole("button", { name: /muted · unmute/ }).click();
  await expect(seen).toBeVisible();
  await other.close();
});
