import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/ui";
import { CardSkeleton } from "@/components/admin/skeletons";
import { getSettings, listRewards, rewardUsage } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { BirthdayDiscountForm, RewardsManager } from "./rewards-manager";

export const metadata = { title: "Rewards" };

export default function RewardsPage() {
  return (
    <div className="flex max-w-[1100px] flex-col gap-6">
      <PageHeader
        title="Rewards"
        subtitle="What customers can redeem their points for, and the birthday discount."
      />
      <Suspense
        fallback={
          <div className="flex flex-wrap items-start gap-5">
            <CardSkeleton lines={2} className="min-w-0 flex-[2_1_420px]" />
            <CardSkeleton lines={3} className="min-w-0 flex-[1_1_300px]" />
          </div>
        }
      >
        <Rewards />
      </Suspense>
    </div>
  );
}

async function Rewards() {
  // Only admins change this page, and refresh() in their Server Actions clears the browser's
  // copy. A stale time of 5 minutes or more lets the link prefetch carry the data, so even the
  // first visit opens without a skeleton.
  "use cache: private";
  cacheLife({ stale: 300 });
  const [staff, rewards, settings] = await Promise.all([requireAdmin(), listRewards(), getSettings()]);
  const usage = await rewardUsage(rewards.map((r) => r.id));
  return (
    <div className="flex flex-wrap items-start gap-5">
      <RewardsManager
        items={rewards.map((r) => ({ reward: r, uses: usage.counts.get(r.id) ?? 0 }))}
      />
      <BirthdayDiscountForm settings={settings} usedThisYear={usage.birthdaysThisYear} canEdit={staff.role === "admin"} />
    </div>
  );
}
