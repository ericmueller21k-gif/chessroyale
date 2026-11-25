import { test } from "./helpers.ts";
import { intoScreen } from "./_probe-into.ts";
const OUT = process.env.PROBE_OUT!;
const LIST = (process.env.STILLS ?? "crowd@1536x730@1.25").split(",");
for (const item of LIST)
  test(`still ${item}`, async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const [screen, size, scale] = item.split("@");
    const [w, h] = size!.split("x").map(Number);
    const ctx = await browser.newContext({ viewport: { width: w!, height: h! }, deviceScaleFactor: Number(scale ?? 1), isMobile: false, hasTouch: false, colorScheme: (process.env.SCHEME as any) ?? "light" });
    const page = await ctx.newPage();
    await intoScreen(page, screen as any);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${screen}-${size}.png` });
    await ctx.close();
  });
