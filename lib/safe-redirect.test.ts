import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath (R-01)", () => {
  it("keeps same-site paths, with their query and hash", () => {
    expect(safeRedirectPath("/admin/customers", "/admin")).toBe("/admin/customers");
    expect(safeRedirectPath("/kiosk?x=1", "/admin")).toBe("/kiosk?x=1");
    expect(safeRedirectPath("/admin/customers?q=0412#list", "/admin")).toBe("/admin/customers?q=0412#list");
  });

  it("resolves dot segments but stays on the site", () => {
    expect(safeRedirectPath("/admin/../kiosk", "/admin")).toBe("/kiosk");
  });

  it("rejects anything that could leave the site", () => {
    for (const next of [
      "//evil.com",
      "/\\evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r/evil.com",
      "/\u0000/evil.com",
      "https://evil.com",
      "javascript:alert(1)",
      "evil.com",
      "",
    ]) {
      expect(safeRedirectPath(next, "/admin")).toBe("/admin");
    }
  });
});
