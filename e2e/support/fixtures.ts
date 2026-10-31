import { test as base, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { resetTestData } from "./db";

/**
 * Waits until React has hydrated an element. Server-rendered pages are visible (and clickable)
 * before React attaches its handlers, and in dev that gap is long enough for a fast test to
 * type or click into nothing.
 */
export async function hydrated(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactFiber"))), { message: "waiting for React to hydrate" })
    .toBe(true);
}

/** The kiosk's number screen and the steps after it, by what a customer sees and taps. */
export class Kiosk {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto("/kiosk");
    await expect(this.page.getByRole("heading", { name: /Welcome in/ })).toBeVisible();
    await hydrated(this.display);
  }

  get display() {
    return this.page.locator("output#phone");
  }
  get continueButton() {
    return this.page.getByRole("button", { name: "Continue" });
  }

  /** Taps the on-screen keypad. */
  async tap(digits: string) {
    for (const d of digits) await this.page.getByRole("button", { name: d, exact: true }).click();
  }

  /** Types a number on the keypad and presses Continue. */
  async enter(digits: string) {
    await this.tap(digits);
    await this.continueButton.click();
  }

  async signUp(firstName: string, birthday?: { day: number; month: string }) {
    await expect(this.page.getByRole("heading", { name: "Nice to meet you!" })).toBeVisible();
    await this.page.getByLabel("First name").fill(firstName);
    if (birthday) {
      await this.page.getByLabel("Birthday month").selectOption({ label: birthday.month });
      await this.page.getByLabel("Birthday day").selectOption(String(birthday.day));
    }
    await this.page.getByRole("button", { name: "Join & check in" }).click();
    await this.skipVisitSteps();
  }

  /** Check in on the Found screen: the first service (one is required), no technician. */
  async checkIn() {
    await this.page.getByRole("button", { name: "Check in", exact: true }).click();
    await this.skipVisitSteps();
  }

  /**
   * The services and staff steps after Check in, whichever the shop has turned on: picks the first
   * service (one is required) and skips the technician.
   */
  async skipVisitSteps() {
    const step = this.page.getByRole("heading", { level: 1, name: /What are you in for today\?|Who's looking after you\?/ });
    const done = this.page.getByText(/You.re checked in|all checked in for today|Something went wrong/).first();
    for (let i = 0; i < 3; i++) {
      await expect(step.or(done).first()).toBeVisible();
      if (await done.isVisible()) return;
      const name = (await step.textContent()) ?? "";
      if (name.startsWith("What are you in")) {
        await this.page.getByRole("checkbox").first().click();
        await this.page.getByRole("button", { name: /^(Next|Check in)/ }).click();
      } else {
        await this.page.getByRole("button", { name: /^Skip/ }).click();
      }
      await expect(this.page.getByRole("heading", { level: 1, name, exact: true })).toHaveCount(0);
    }
  }

  /** Redeem → Yes, redeem on the row with this title. */
  async redeem(title: string) {
    const row = this.page.getByRole("region", { name: "Rewards you can redeem" }).getByRole("listitem").filter({ hasText: title });
    await row.getByRole("button", { name: "Redeem", exact: true }).click();
    await row.getByRole("button", { name: "Yes, redeem" }).click();
  }
}

/** Signs in through the real form and waits until the app has moved on from it. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await hydrated(page.getByRole("button", { name: "Sign in" }));
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/login"));
}

/** An error message shown with role="alert" (Next also keeps an empty route announcer with that role). */
export function alert(page: Page, text: string | RegExp) {
  return page.getByRole("alert").filter({ hasText: text });
}

/**
 * Waits for a dialog's open animation to finish, so a click lands on a button that has stopped
 * moving (a click during the zoom-in can be retried after the action already ran).
 */
export async function settled(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  return dialog;
}

/**
 * Lets React finish rendering and run its effects (they run after the next paint), e.g. before
 * clicking a link that a just-made change should intercept.
 */
export async function nextFrame(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))));
}

/** A fresh browser context with no session, e.g. to sign in as a throwaway account. */
export async function freshPage(browser: Browser) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  return context.newPage();
}

type Fixtures = { kiosk: Kiosk; cleanData: void };

export const test = base.extend<Fixtures>({
  // Every test starts from the same tagged-data state and default settings.
  // (Playwright calls the second argument `use`; it's renamed so the React hooks lint rule leaves it alone.)
  cleanData: [
    async ({}, provide) => {
      await resetTestData();
      await provide();
    },
    { auto: true },
  ],
  kiosk: async ({ page }, provide) => {
    await provide(new Kiosk(page));
  },
});

export { expect };
