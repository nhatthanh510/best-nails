import { mkdir, readFile, writeFile } from "node:fs/promises";
import { test as setup, expect } from "@playwright/test";
import { ADMIN, STAFF, activeShopRewards, createAccount, getSettings, takeKioskPin } from "./support/db";
import { signIn } from "./support/fixtures";

// Signs in the shared admin and staff logins once, and remembers the shop's settings and active
// rewards so the teardown can put them back after the tests have changed them.

setup("remember settings and rewards", async () => {
  await mkdir("e2e/.auth", { recursive: true });
  // Only once: if a previous run stopped before its teardown, the saved PIN is still the shop's.
  const pinFile = "e2e/.auth/kiosk-pin.json";
  const already = await readFile(pinFile, "utf8").catch(() => null);
  const pin = await takeKioskPin();
  if (!already) await writeFile(pinFile, JSON.stringify(pin));
  await writeFile("e2e/.auth/settings.json", JSON.stringify(await getSettings(), null, 2));
  await writeFile("e2e/.auth/rewards.json", JSON.stringify(await activeShopRewards()));
});

setup("sign in as the admin", async ({ page }) => {
  await createAccount({ ...ADMIN, role: "admin" });
  await signIn(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});

setup("sign in as a staff account", async ({ browser }) => {
  await createAccount({ ...STAFF, role: "staff" });
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await signIn(page, STAFF.email, STAFF.password);
  await expect(page).toHaveURL(/\/kiosk$/);
  await context.storageState({ path: "e2e/.auth/staff.json" });
  await context.close();
});
