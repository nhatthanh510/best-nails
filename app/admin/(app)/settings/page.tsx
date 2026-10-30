import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/ui";
import { AccountsCard } from "@/components/admin/accounts-card";
import { FormCardsSkeleton } from "@/components/admin/skeletons";
import { getSettings, listAccounts } from "@/lib/admin-data";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex max-w-[920px] flex-col gap-6">
      <PageHeader title="Settings" subtitle="Changes apply straight away, from the next check-in or gift voucher." />
      <Suspense fallback={<FormCardsSkeleton cards={3} label="Loading settings" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  // Only admins change this page, and refresh() in their Server Actions clears the browser's
  // copy. A stale time of 5 minutes or more lets the link prefetch carry the data, so even the
  // first visit opens without a skeleton.
  "use cache: private";
  cacheLife({ stale: 300 });
  const [staff, settings, accounts] = await Promise.all([requireAdmin(), getSettings(), listAccounts()]);

  return (
    <>
      <SettingsForm settings={settings} canEdit={staff.role === "admin"} />

      <AccountsCard
        meId={staff.id}
        accounts={accounts.map(({ lastSignInAt, removedAt, ...a }) => ({
          ...a,
          lastSignIn: lastSignInAt && formatDateTime(lastSignInAt, settings.timezone),
          removedOn: removedAt && formatDate(removedAt, settings.timezone),
        }))}
      />
    </>
  );
}
