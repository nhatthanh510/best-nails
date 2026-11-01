import { createReward, createTechnician, findCustomer, lastVisit, seedCustomer, testPhone, updateSettings } from "./support/db";
import { alert, expect, test } from "./support/fixtures";

test.describe("Kiosk: entering a number", () => {
  test("K-01 Continue waits for a complete number; Clear and Delete last digit work", async ({ kiosk, page }) => {
    await kiosk.goto();
    await expect(kiosk.continueButton).toBeDisabled();

    await kiosk.tap("049157010");
    await expect(kiosk.display).toHaveText("0491 570 10_");
    await expect(kiosk.continueButton).toBeDisabled();

    await kiosk.tap("1");
    await expect(kiosk.display).toHaveText("0491 570 101");
    await expect(kiosk.continueButton).toBeEnabled();

    await page.getByRole("button", { name: "Delete last digit" }).click();
    await expect(kiosk.display).toHaveText("0491 570 10_");
    await expect(kiosk.continueButton).toBeDisabled();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(kiosk.display).toHaveAccessibleName("Phone number, empty");
  });

  test("K-02 an unusual number shows a warning but can still continue", async ({ kiosk, page }) => {
    await kiosk.goto();
    await kiosk.tap("0512345678");
    await expect(page.getByText("Not a standard Australian number. You can still continue.")).toBeVisible();
    await kiosk.continueButton.click();
    await expect(page.getByRole("heading", { name: "Nice to meet you!" })).toBeVisible();
    await expect(page.getByText("This isn't a standard Australian number.")).toBeVisible();
  });

  test("K-13 a physical keyboard types digits, deletes and continues", async ({ kiosk, page }) => {
    await kiosk.goto();
    await page.keyboard.type("04915701019");
    // Typing past 10 digits is allowed (overseas numbers), up to the 12-digit limit.
    await expect(kiosk.display).toHaveText("0491 570 101 9");
    await page.keyboard.press("Backspace");
    await expect(kiosk.display).toHaveText("0491 570 101");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Nice to meet you!" })).toBeVisible();
  });

  test("K-11 the number is cleared after the idle timeout", async ({ kiosk, page }) => {
    await page.clock.install();
    await kiosk.goto();
    await kiosk.tap("0491");
    await expect(kiosk.display).toHaveText("0491 ___ ___");
    await page.clock.fastForward(61_000);
    await expect(kiosk.display).toHaveAccessibleName("Phone number, empty");
  });

  test("K-12 with no reward and the birthday discount off, there's no program card", async ({ kiosk, page }) => {
    await kiosk.goto();
    await expect(page.getByText(/^After \d+ visits?$/)).toHaveCount(0);
    await expect(page.getByText(/^Birthday \d+% off$/)).toHaveCount(0);
  });

  test("RW-02 a reward and the birthday discount appear on the program card", async ({ kiosk, page }) => {
    await createReward("E2E 10% off", 10);
    await updateSettings({ birthday_discount_enabled: true });
    await kiosk.goto();
    await expect(page.getByText("E2E 10% off")).toBeVisible();
    await expect(page.getByText("After 10 visits")).toBeVisible();
    await expect(page.getByText("10% off on your birthday", { exact: true })).toBeVisible();
    // Every tier gets the same, so there's no tier to reach.
    await expect(page.getByText(/Visit more to reach/)).toHaveCount(0);
  });
});

test.describe("Kiosk: joining and checking in", () => {
  test("K-03/K-04 a new number signs up and checks in with 1 point", async ({ kiosk, page }) => {
    await createReward("E2E 10% off", 10);
    await kiosk.goto();
    await kiosk.enter(testPhone(1));
    await expect(page.getByText("0491 570 101 isn't in our rewards yet.")).toBeVisible();
    await kiosk.signUp("Alice", { day: 27, month: "October" });

    await expect(page.getByRole("status").filter({ hasText: "You're checked in, Alice!" })).toBeVisible();
    await expect(page.getByText("+1 point")).toBeVisible();
    await expect(page.getByRole("img", { name: "1 of 10 stamps" })).toBeVisible();
    await expect(page.getByText("9 more visits to E2E 10% off")).toBeVisible();

    const customer = await findCustomer(testPhone(1));
    expect(customer).toMatchObject({ first_name: "Alice", points_balance: 1, lifetime_points: 1, visit_count: 1 });
  });

  test("K-05 an empty name is flagged by the field", async ({ kiosk, page }) => {
    await kiosk.goto();
    await kiosk.enter(testPhone(2));
    await page.getByRole("button", { name: "Join & check in" }).click();
    await expect(alert(page, "Please enter your name.")).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true");
    expect(await findCustomer(testPhone(2))).toBeNull();
  });

  test("K-05b the day list follows the month, and half a birthday is refused", async ({ kiosk, page }) => {
    await kiosk.goto();
    await kiosk.enter(testPhone(3));
    const day = page.getByLabel("Birthday day");
    const month = page.getByLabel("Birthday month");

    await month.selectOption({ label: "February" });
    await expect(day.locator("option", { hasText: /^29$/ })).toHaveCount(1);
    await expect(day.locator("option", { hasText: /^30$/ })).toHaveCount(0);

    // A day the new month doesn't have is cleared, not kept.
    await month.selectOption({ label: "January" });
    await day.selectOption("31");
    await month.selectOption({ label: "April" });
    await expect(day).toHaveValue("");

    await page.getByLabel("Your name").fill("Bea");
    await page.getByRole("button", { name: "Join & check in" }).click();
    await expect(alert(page, "Please pick both the day and the month of your birthday, or leave both blank.")).toBeVisible();

    // 29 February is a real birthday and is stored.
    await month.selectOption({ label: "February" });
    await day.selectOption("29");
    await page.getByRole("button", { name: "Join & check in" }).click();
    await kiosk.skipVisitSteps();
    await expect(page.getByText("You're checked in, Bea!")).toBeVisible();
  });

  test("K-09 a returning customer goes straight to the visit steps, greeted by name with a masked number", async ({ kiosk, page }) => {
    await createReward("E2E 10% off", 10);
    await seedCustomer({ phone: testPhone(4), firstName: "Cara", points: 6 });
    await kiosk.goto();
    await kiosk.enter(testPhone(4));

    // No Welcome back → Check in step: the first visit step says who they are.
    await expect(page.getByRole("heading", { name: "What are you in for today?" })).toBeVisible();
    await expect(page.getByText(/Welcome back, Cara · 04•• ••• 104/)).toBeVisible();
    await expect(page.getByText("0491 570 104")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Not you? Start over" })).toBeVisible();

    await kiosk.checkIn();
    await expect(page.getByText("You're checked in, Cara!")).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "you now have" })).toHaveText("+1 point · you now have 7");
    await expect(page.getByRole("img", { name: "7 of 10 stamps" })).toBeVisible();
    await expect(page.getByText("3 more visits to E2E 10% off")).toBeVisible();
  });

  test("K-10 after Check in the customer picks services and their technician", async ({ kiosk, page }) => {
    await createTechnician("E2E Linh");
    await seedCustomer({ phone: testPhone(8), firstName: "Fay" });
    await kiosk.goto();
    await kiosk.enter(testPhone(8));

    await expect(page.getByRole("heading", { name: "What are you in for today?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waxing" })).toBeVisible();
    const next = page.getByRole("button", { name: /^Next/ });
    await expect(next).toBeDisabled();
    const pedicure = page.getByRole("region", { name: "Pedicure" });
    await pedicure.getByRole("checkbox", { name: "Deluxe pedicure" }).click();
    await page.getByRole("region", { name: "Acrylic / Gel" }).getByRole("checkbox", { name: "Full set" }).click();
    await expect(pedicure.getByRole("checkbox", { name: "Deluxe pedicure" })).toBeChecked();
    await expect(next).toHaveAccessibleName("Next (2 selected)");
    await next.click();

    await expect(page.getByRole("heading", { name: "Who's looking after you?" })).toBeVisible();
    // Back keeps what was picked.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(pedicure.getByRole("checkbox", { name: "Deluxe pedicure" })).toBeChecked();
    await next.click();
    await page.getByRole("radio", { name: /E2E Linh/ }).click();
    await page.getByRole("button", { name: "Check in", exact: true }).click();

    await expect(page.getByText("You're checked in, Fay!")).toBeVisible();
    await expect(page.getByText("Have a seat. E2E Linh will be with you shortly.")).toBeVisible();
    // The done screen lists what was recorded.
    await expect(page.getByText("Full set · Deluxe pedicure")).toBeVisible();
    await expect(page.getByText("With E2E Linh")).toBeVisible();
    expect(await lastVisit(testPhone(8))).toEqual({
      technician: "E2E Linh",
      services: ["Full set (Acrylic / Gel)", "Deluxe pedicure (Pedicure)"],
    });
  });

  test("K-06 a second visit the same day doesn't add a point", async ({ kiosk, page }) => {
    await createReward("E2E 10% off", 10);
    await seedCustomer({ phone: testPhone(5), firstName: "Dee", checkedIn: true });
    await kiosk.goto();
    await kiosk.enter(testPhone(5));

    // Already checked in today: straight to "all set", no Check in button.
    await expect(page.getByText(/Checked in today at/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Check in", exact: true })).toHaveCount(0);
    await expect(page.getByText("You're all checked in for today. See you next time!")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("heading", { name: /Welcome in/ })).toBeVisible();

    expect(await findCustomer(testPhone(5))).toMatchObject({ points_balance: 1, visit_count: 1 });
  });

  test("the success screen returns to the start on its own", async ({ kiosk, page }) => {
    await page.clock.install();
    await seedCustomer({ phone: testPhone(6), firstName: "Eve" });
    await kiosk.goto();
    await kiosk.enter(testPhone(6));
    await kiosk.checkIn();
    await expect(page.getByText("You're checked in, Eve!")).toBeVisible();
    await expect(page.getByText(/closing in \d+s/)).toBeVisible();
    for (let i = 0; i < 9; i++) await page.clock.runFor(1_000);
    await expect(page.getByRole("heading", { name: /Welcome in/ })).toBeVisible();
    await expect(kiosk.display).toHaveAccessibleName("Phone number, empty");
  });

  test("Not you? Start over goes back and clears the number", async ({ kiosk, page }) => {
    await seedCustomer({ phone: testPhone(7), firstName: "Fay" });
    await kiosk.goto();
    await kiosk.enter(testPhone(7));
    await page.getByRole("button", { name: "Not you? Start over" }).click();
    await expect(kiosk.display).toHaveAccessibleName("Phone number, empty");
  });
});
