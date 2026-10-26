import { Suspense } from "react";
import { PageHeader } from "@/components/admin/ui";
import { CardSkeleton } from "@/components/admin/skeletons";
import { listServiceMenu, listTechnicians } from "@/lib/admin-data";
import { ServicesManager, TechniciansManager } from "./services-manager";

export const metadata = { title: "Services & staff" };

export default function ServicesPage() {
  return (
    <div className="flex max-w-[1100px] flex-col gap-6">
      <PageHeader
        title="Services & staff"
        subtitle="What customers pick on the kiosk after they check in. Turn one off to hide it from the kiosk."
      />
      <Suspense
        fallback={
          <div className="flex flex-wrap items-start gap-5">
            <CardSkeleton lines={8} className="min-w-0 flex-[2_1_480px]" />
            <CardSkeleton lines={3} className="min-w-0 flex-[1_1_300px]" />
          </div>
        }
      >
        <Menu />
      </Suspense>
    </div>
  );
}

async function Menu() {
  const [categories, technicians] = await Promise.all([listServiceMenu(), listTechnicians()]);
  return (
    <div className="flex flex-wrap items-start gap-5">
      <ServicesManager categories={categories} />
      <TechniciansManager technicians={technicians} />
    </div>
  );
}
