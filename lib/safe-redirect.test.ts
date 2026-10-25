import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/admin/customers", "/admin")).toBe("/admin/customers");
    expect(safeRedirectPath("/kiosk?x=1", "/admin")).toBe("/kiosk?x=1");
  });

  it("rejects anything that could leave the site", () => {
    for (const next of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "https://evil.com", "evil.com", ""]) {
      expect(safeRedirectPath(next, "/admin")).toBe("/admin");
    }
  });
});
