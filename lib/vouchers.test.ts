import { describe, expect, it } from "vitest";
import { formatDiscount, voucherStatus } from "./vouchers";

describe("formatDiscount", () => {
  it("formats percent and dollar discounts", () => {
    expect(formatDiscount("percent", 15)).toBe("15% off");
    expect(formatDiscount("amount", 10)).toBe("$10 off");
    expect(formatDiscount("amount", 7.5)).toBe("$7.50 off");
  });
});

describe("voucherStatus", () => {
  const v = { is_active: true, starts_on: null, expires_on: null };
  it("reports each status", () => {
    expect(voucherStatus(v, 3, 100, "2026-10-24")).toBe("active");
    expect(voucherStatus({ ...v, is_active: false }, 3, 100, "2026-10-24")).toBe("paused");
    expect(voucherStatus({ ...v, expires_on: "2026-10-23" }, 3, 100, "2026-10-24")).toBe("expired");
    expect(voucherStatus({ ...v, expires_on: "2026-10-24" }, 3, 100, "2026-10-24")).toBe("active");
    expect(voucherStatus({ ...v, starts_on: "2026-11-01" }, 0, 100, "2026-10-24")).toBe("scheduled");
    expect(voucherStatus(v, 100, 100, "2026-10-24")).toBe("used_up");
  });
});
