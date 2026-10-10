import { expect, test, type Page } from "@playwright/test";

/** The colour of one icon pixel, read from the editor's canvas (r, g, b, a). */
const pixel = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => Array.from((document.querySelector(".icon-canvas") as HTMLCanvasElement).getContext("2d")!.getImageData(x!, y!, 1, 1).data), [x, y]);

/** Fails, rather than hangs, if the page's main thread is stuck. */
const responds = (page: Page) =>
  Promise.race([page.evaluate(() => 1 + 1), new Promise((_, no) => setTimeout(() => no(new Error("the page stopped responding")), 3_000))]);

// Eric (Oct 10): clicking the fill a few times in a row froze the page, then "Aw, Snap! Out of Memory".
test("the icon builder's tools survive being spammed", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Your profile" }).click();
  await page.getByRole("button", { name: "Edit name & icon" }).click();
  await page.getByRole("button", { name: "Edit your icon" }).click();
  const canvas = page.getByLabel("Your icon, 48 by 48 pixels");
  await expect(canvas).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return (await cdp.send("Runtime.getHeapUsage")).usedSize;
  };
  const heapBefore = await heap();
  const fillButton = page.getByRole("button", { name: "Fill", exact: true });
  const quick = { timeout: 5_000 };

  // 50 fills in a row with one colour: the first fills the blank canvas, the rest change nothing.
  await page.getByRole("radio", { name: "#ed1c24" }).click();
  for (let i = 0; i < 50; i++) {
    await fillButton.click(quick);
    await canvas.click({ ...quick, position: { x: 10, y: 10 } });
  }
  await responds(page);
  expect(await pixel(page, 0, 0)).toEqual([0xed, 0x1c, 0x24, 255]);
  expect(await pixel(page, 47, 47)).toEqual([0xed, 0x1c, 0x24, 255]);
  // A fill that changed nothing isn't an undo step: one undo goes back to the blank canvas.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await pixel(page, 47, 47)).toEqual([0, 0, 0, 0]);

  // Alternating colours: every fill repaints the whole canvas.
  for (let i = 0; i < 20; i++) {
    await page.getByRole("radio", { name: i % 2 ? "#00a2e8" : "#22b14c" }).click(quick);
    await canvas.click({ ...quick, position: { x: 30, y: 30 } });
  }
  await responds(page);
  expect(await pixel(page, 47, 0)).toEqual([0x00, 0xa2, 0xe8, 255]);

  // The other tools, spammed too: pencil strokes, the eraser, clear, and more undos than there are steps.
  for (const tool of ["Pencil", "Eraser"]) {
    await page.getByRole("button", { name: tool, exact: true }).click();
    // (The sheet scrolls on a phone: measure the canvas where it is now, or a stroke lands on the scrim and closes it.)
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(box.x + 2, box.y + 2 + i * 4);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2 - i * 4, { steps: 8 });
      await page.mouse.up();
    }
  }
  for (let i = 0; i < 30; i++) await page.getByRole("button", { name: "Clear", exact: true }).click(quick);
  expect(await pixel(page, 0, 0)).toEqual([0, 0, 0, 0]);
  for (let i = 0; i < 60; i++) await page.getByRole("button", { name: "Undo", exact: true }).click(quick);
  await responds(page);

  // Still taking taps, and memory back where it started (give or take).
  await page.getByRole("button", { name: "Fill", exact: true }).click(quick);
  await expect(page.getByRole("button", { name: "Fill", exact: true })).toHaveAttribute("aria-pressed", "true", quick);
  const grew = (await heap()) - heapBefore;
  expect(grew).toBeLessThan(20 * 1024 * 1024);
});
