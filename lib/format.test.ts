import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatBirthday, formatLastVisit, formatTime, fullName, initials, isShopToday, signed } from "./format";

const TZ = "Australia/Hobart";

describe("shop-day helpers follow the shop's timezone (F-01)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 00:30 on Tue 27 Oct in Hobart (AEDT, UTC+11), but still Mon 26 Oct in UTC.
    vi.setSystemTime(new Date("2026-10-26T13:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("isShopToday uses the shop's calendar day, not UTC's", () => {
    expect(isShopToday("2026-10-26T13:05:00Z", TZ)).toBe(true); // 00:05 on the 27th in Hobart
    expect(isShopToday("2026-10-26T12:30:00Z", TZ)).toBe(false); // 23:30 on the 26th in Hobart, same UTC day
    expect(isShopToday(null, TZ)).toBe(false);
  });

  it("formatLastVisit says Today, Yesterday, a date, or Never", () => {
    expect(formatLastVisit(null, TZ)).toBe("Never");
    expect(formatLastVisit("2026-10-26T13:05:00Z", TZ)).toBe("Today");
    expect(formatLastVisit("2026-10-26T12:30:00Z", TZ)).toBe("Yesterday");
    expect(formatLastVisit("2026-10-12T03:00:00Z", TZ)).toBe("12 Oct");
    expect(formatLastVisit("2025-03-03T03:00:00Z", TZ)).toBe("3 Mar 2025");
  });

  it("formatTime shows the shop's local time", () => {
    expect(formatTime("2026-10-26T13:30:00Z", TZ)).toBe("12:30 am");
  });
});

describe("names and labels", () => {
  it("joins first and last names, or uses the first name alone", () => {
    expect(fullName({ first_name: "Alice", last_name: "Ng" })).toBe("Alice Ng");
    expect(fullName({ first_name: "Alice", last_name: null })).toBe("Alice");
  });

  it("makes upper-case initials", () => {
    expect(initials({ first_name: "alice", last_name: "ng" })).toBe("AN");
    expect(initials({ first_name: "Bo", last_name: null })).toBe("B");
  });

  it("writes birthdays day first, as in Australia", () => {
    expect(formatBirthday(10, 27)).toBe("27 Oct");
    expect(formatBirthday(2, 29)).toBe("29 Feb");
    expect(formatBirthday(null, 5)).toBeNull();
    expect(formatBirthday(5, null)).toBeNull();
  });

  it("signs point changes with a real minus sign", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(-10)).toBe("−10");
    expect(signed(0)).toBe("0");
  });
});
