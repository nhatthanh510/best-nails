import { Suspense } from "react";
import { Card, PageHeader } from "@/components/admin/ui";
import { FormCardsSkeleton } from "@/components/admin/skeletons";
import { getSettings, listStaff } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex max-w-[920px] flex-col gap-6">
      <PageHeader title="Settings" subtitle="Changes apply straight away, from the next check-in or sale." />
      <Suspense fallback={<FormCardsSkeleton cards={3} label="Loading settings" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const [staff, settings, team] = await Promise.all([requireAdmin(), getSettings(), listStaff()]);

  return (
    <>
      <SettingsForm settings={settings} canEdit={staff.role === "admin"} />

      <Card className="flex flex-col gap-2 p-6">
        <h2 className="text-lg font-extrabold">Accounts</h2>
        <ul className="flex flex-col">
          {team.map((s) => (
            <li key={s.user_id} className="flex justify-between border-b border-secondary py-2.5 text-sm last:border-0">
              <span className="font-bold">{s.display_name}</span>
              <span className="text-muted-foreground">{s.role === "admin" ? "Admin · admin and kiosk" : "Staff · kiosk only"}</span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-muted-foreground">
          Admins use the admin and the kiosk; staff sign in to the kiosk only. New accounts are invited from the Supabase dashboard (Authentication → Users), then added to the staff table with a role.
        </p>
      </Card>
    </>
  );
}
