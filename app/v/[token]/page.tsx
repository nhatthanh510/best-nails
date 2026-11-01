import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandMark } from "@/components/kiosk/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { GiftVoucherStatusPill } from "@/components/admin/gift-voucher-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney, type GiftVoucherStatus } from "@/lib/gift-vouchers";

// A customer's own balance page, opened from the QR code on a printed gift voucher. Public: the
// link's token is the secret (see public_token in the initial migration). Keep it out of search engines
// and don't pass the link on to other sites.
export const metadata: Metadata = {
  title: "Gift voucher balance",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function VoucherBalancePage({ params }: PageProps<"/v/[token]">) {
  return (
    <main className="flex flex-1 flex-col items-center bg-background px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex items-center gap-3">
          <BrandMark className="size-12" sizes="48px" />
          <span className="font-heading text-[28px] font-bold tracking-wide">Best Nails</span>
        </div>
        <section className="flex w-full flex-col items-center gap-5 rounded-3xl border border-border bg-card px-6 py-8 text-center shadow-sm">
          <Suspense fallback={<BalanceSkeleton />}>
            <Balance params={params} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}

async function Balance({ params }: { params: PageProps<"/v/[token]">["params"] }) {
  const { token } = await params;
  const { data, error } = await createAdminClient().rpc("public_gift_voucher", { p_token: token });
  if (error) {
    console.error(error);
    return <Message title="Something went wrong" body="We couldn't load this voucher. Please try again in a moment." />;
  }
  const r = data as { status: "valid" | "used_up" | "expired" | "not_found" | "not_sold" | "blocked"; code?: string; amount_cents?: number; balance_cents?: number; expires_on?: string };
  if (r.status === "not_found") {
    return <Message title="Voucher not found" body="This link doesn't match a gift voucher. Ask us at the counter and we'll check it for you." />;
  }
  if (r.status === "not_sold") {
    return (
      <>
        <p className="font-mono text-lg font-bold tracking-[0.12em]">{r.code}</p>
        <Message title="Not activated yet" body="This voucher gets its balance when it's bought at the counter. Scan it again after that." />
      </>
    );
  }
  if (r.status === "blocked") {
    return (
      <>
        <p className="font-mono text-lg font-bold tracking-[0.12em]">{r.code}</p>
        <Message title="Voucher blocked" body="This voucher has been blocked, for example after being reported lost. Ask us at the counter." />
      </>
    );
  }
  const status: GiftVoucherStatus = r.status === "valid" ? "active" : r.status;
  return (
    <>
      <p className="text-[13px] font-bold tracking-[0.2em] text-primary uppercase">Gift voucher</p>
      <p className="font-mono text-lg font-bold tracking-[0.12em]">{r.code}</p>
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-[56px] leading-none font-bold tabular-nums lining-nums">{formatMoney(r.balance_cents!)}</h1>
        <p className="text-sm text-muted-foreground">left of {formatMoney(r.amount_cents!)}</p>
      </div>
      <GiftVoucherStatusPill status={status} />
      <p className="text-sm text-muted-foreground">
        {status === "expired" ? `Expired on ${dateLabel(r.expires_on!)}.` : `Valid until ${dateLabel(r.expires_on!)}.`}
        {status === "active" && " Show this voucher at the counter to use it."}
      </p>
    </>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h1 className="text-[32px] leading-tight font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </>
  );
}

function BalanceSkeleton() {
  return (
    <>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-14 w-48" />
      <Skeleton className="h-7 w-24 rounded-full" />
    </>
  );
}
