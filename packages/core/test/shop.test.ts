import { describe, expect, it } from "vitest";
import { SHOP, discountLabel, shopPrice } from "../src/index.ts";

describe("the shop's beta discount (SHOP.discount)", () => {
  it("halves every price at 50% off: 250, 100, 150, 150, 400, 900 become 125, 50, 75, 75, 200, 450", () => {
    const p = SHOP.prices;
    expect([p.key, p.hunchess, p.gift, p.beta, p.boss, p.bundle].map((x) => shopPrice(x, 0.5))).toEqual([125, 50, 75, 75, 200, 450]);
  });
  it("rounds to whole coins, half up", () => {
    expect(shopPrice(75, 0.5)).toBe(38);
    expect(shopPrice(99, 0.25)).toBe(74);
    expect(shopPrice(101, 0.3)).toBe(71);
  });
  it("no discount leaves the price; 100% or more is free, never negative; a negative discount is none", () => {
    expect(shopPrice(250, 0)).toBe(250);
    expect(shopPrice(250, 1)).toBe(0);
    expect(shopPrice(250, 1.5)).toBe(0);
    expect(shopPrice(250, -0.2)).toBe(250);
  });
  it("the ribbon's words come from the setting, and there's none at 0", () => {
    expect(discountLabel(0.5)).toBe("50% OFF");
    expect(discountLabel(0.25)).toBe("25% OFF");
    expect(discountLabel(0)).toBeNull();
  });
});
