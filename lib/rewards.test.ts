import { describe, expect, it } from "vitest";
import { birthdayWindowLabel } from "./rewards";

describe("birthdayWindowLabel", () => {
  it("names the window the way the kiosk says it", () => {
    expect(birthdayWindowLabel(0)).toBe("on your birthday");
    expect(birthdayWindowLabel(7)).toBe("in your birthday week");
    expect(birthdayWindowLabel(3)).toBe("within 3 days of your birthday");
    expect(birthdayWindowLabel(1)).toBe("within 1 day of your birthday");
    expect(birthdayWindowLabel(31)).toBe("within 31 days of your birthday");
  });
});
