import { Suspense } from "react";
import { PageHeader } from "@/components/admin/ui";
import { getSettings, listRewards, rewardUsage } from "@/lib/admin-data";
import { requireStaff } from "@/lib/auth";
import { BirthdayDiscountForm, RewardsManager } from "./rewards-manager";

export const metadata = { title: "Rewards" };

export default function RewardsPage() {
  return (
    <div className="flex max-w-[1100px] flex-col gap-6">
      <PageHeader
        title="Rewards"
        subtitle="Customers earn points at every check-in and spend them on rewards. The birthday discount is free, once a year."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Rewards />
      </Suspense>
    </div>
  );
}

async function Rewards() {
  const [staff, rewards, settings] = await Promise.all([requireStaff(), listRewards(), getSettings()]);
  const usage = await rewardUsage(rewards.map((r) => r.id));
  return (
    <div className="flex flex-wrap items-start gap-5">
      <RewardsManager
        pointsPerVisit={settings.points_per_visit}
        items={rewards.map((r) => ({ reward: r, uses: usage.counts.get(r.id) ?? 0 }))}
      />
      <BirthdayDiscountForm settings={settings} usedThisYear={usage.birthdaysThisYear} canEdit={staff.role === "owner"} />
    </div>
  );
}
