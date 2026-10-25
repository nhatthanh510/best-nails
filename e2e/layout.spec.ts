import type { Page } from "@playwright/test";
import { createReward, seedCustomer, testPhone, updateSettings } from "./support/db";
import { expect, hydrated, test } from "./support/fixtures";

async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${page.url()} scrolls sideways`).toBeLessThanOrEqual(clientWidth);
}

test.describe("Phone width (375 px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("L-01 admin pages don't scroll sideways, and the menu holds account and sign out", async ({ page }) => {
    await seedCustomer({ phone: testPhone(60), firstName: "Wide", lastName: "Name-For-Layout-Testing" });
    for (const path of ["/admin", "/admin/customers", "/admin/check-ins", "/admin/rewards", "/admin/gift-vouchers", "/admin/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("button", { name: "Sign out" }).filter({ visible: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Customers" }).click();
    await expect(page).toHaveURL(/\/admin\/customers$/);
    // Choosing a page closes the menu.
    await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  test("L-02 the kiosk doesn't scroll sideways on a phone", async ({ page }) => {
    await createReward("E2E 10% off", 10);
    await updateSettings({ birthday_discount_enabled: true });
    await page.goto("/kiosk");
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await hydrated(page.locator("output#phone"));
    await page.keyboard.type(testPhone(61));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Nice to meet you!" })).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});

test.describe("iPad", () => {
  test("L-04 landscape: the number screen fits without scrolling", async ({ page }) => {
    await createReward("E2E 10% off", 10);
    await updateSettings({ birthday_discount_enabled: true });
    await page.goto("/kiosk");
    await expect(page.getByRole("button", { name: "Continue" })).toBeInViewport();
    const { scrollHeight, viewportHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(viewportHeight);
    await expectNoSidewaysScroll(page);
  });

  test.describe("portrait", () => {
    test.use({ viewport: { width: 820, height: 1180 } });

    test("L-03 the kiosk and the admin fit the width", async ({ page }) => {
      await page.goto("/kiosk");
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
      await expectNoSidewaysScroll(page);
      await page.goto("/admin/customers");
      await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
      await expectNoSidewaysScroll(page);
    });
  });
});

test.describe("Accessibility basics", () => {
  test("X-01 every button and link has a name, and each page has one main heading", async ({ page }) => {
    for (const path of ["/kiosk", "/admin", "/admin/customers", "/admin/gift-vouchers", "/admin/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveCount(1);
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("button, a[href]")]
          .filter((el) => el.checkVisibility())
          .filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim() || el.getAttribute("title")))
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      expect(unnamed, `${path} has controls with no name`).toEqual([]);
    }
  });
});
