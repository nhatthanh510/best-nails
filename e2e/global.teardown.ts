import { readFile } from "node:fs/promises";
import { test as teardown } from "@playwright/test";
import { reactivateRewards, resetTestData, updateSettings } from "./support/db";

teardown("clean up test data and restore settings and rewards", async () => {
  await resetTestData();
  // If setup didn't get as far as saving these, the defaults from resetTestData stay.
  const saved = await readFile("e2e/.auth/settings.json", "utf8").catch(() => null);
  if (saved) {
    const settings = JSON.parse(saved);
    delete settings.id;
    delete settings.updated_at;
    await updateSettings(settings);
  }
  const rewards = await readFile("e2e/.auth/rewards.json", "utf8").catch(() => null);
  if (rewards) await reactivateRewards(JSON.parse(rewards));
});
