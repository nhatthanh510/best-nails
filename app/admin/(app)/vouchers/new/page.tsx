import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/admin/ui";
import { NewVoucherForm } from "./new-voucher-form";

export const metadata = { title: "New voucher" };

export default function NewVoucherPage() {
  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      <Link href="/admin/vouchers" className="flex min-h-8 w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
        <ChevronLeft className="size-4" strokeWidth={2.4} aria-hidden="true" />
        All vouchers
      </Link>
      <PageHeader title="New voucher" subtitle="Set up the discount and its codes, then print the codes on your vouchers." />
      <Card className="p-6">
        <NewVoucherForm />
      </Card>
    </div>
  );
}
