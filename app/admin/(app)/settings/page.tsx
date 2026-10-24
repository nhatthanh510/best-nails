import { Suspense } from "react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/action-button";
import { revokeKiosk } from "@/app/admin/actions";
import { getSettings, listKiosks, listStaff } from "@/lib/admin-data";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex max-w-[920px] flex-col gap-6">
      <PageHeader title="Settings" subtitle="Changes apply straight away, from the next check-in or sale." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const [staff, settings, kiosks, team] = await Promise.all([requireStaff(), getSettings(), listKiosks(), listStaff()]);
  const tz = settings.timezone;

  return (
    <>
      <SettingsForm settings={settings} canEdit={staff.role === "owner"} />

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">Paired kiosks</h2>
          <Link href="/kiosk/setup" className="text-sm font-bold text-primary hover:underline">
            Pair this device
          </Link>
        </div>
        {kiosks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No kiosk is paired yet. Open <span className="font-semibold">/kiosk/setup</span> on the shop iPad while signed in.
          </p>
        )}
        {kiosks.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-background p-4">
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-bold">{k.name}</span>
              <span className="text-sm text-muted-foreground">
                Paired {formatDate(k.created_at, tz)} · {k.last_seen_at ? `last used ${formatDateTime(k.last_seen_at, tz)}` : "not used yet"}
              </span>
            </div>
            <ConfirmButton
              variant="outline"
              className="text-destructive hover:text-destructive"
              title={`Unpair “${k.name}”?`}
              description="That device will stop accepting check-ins until a staff member pairs it again."
              confirmLabel="Unpair"
              action={revokeKiosk.bind(null, k.id)}
            >
              Unpair
            </ConfirmButton>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-2 p-6">
        <h2 className="text-lg font-extrabold">Staff accounts</h2>
        <ul className="flex flex-col">
          {team.map((s) => (
            <li key={s.user_id} className="flex justify-between border-b border-secondary py-2.5 text-sm last:border-0">
              <span className="font-bold">{s.display_name}</span>
              <span className="text-muted-foreground">{s.role === "owner" ? "Owner" : "Staff"}</span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-muted-foreground">
          New staff are invited from the Supabase dashboard (Authentication → Users), then added to the staff table.
        </p>
      </Card>
    </>
  );
}
