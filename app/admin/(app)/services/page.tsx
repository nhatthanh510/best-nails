import { connection } from "next/server";
import { PageHeader } from "@/components/admin/ui";
import { listServiceMenu, listTechnicians } from "@/lib/admin-data";
import { ServicesManager, TechniciansManager } from "./services-manager";

// Never cached, so a click waits for fresh data with the current page still up (and the admin's
// loading line) rather than showing a skeleton, as on Customers. Not "use cache: private": with the
// browser's cached copy, switching a few rows on and off quickly brought back data from before the
// last change, so switches flipped back on their own (the database was right).
export const instant = false;

export const metadata = { title: "Services & staff" };

export default function ServicesPage() {
  return <Services />;
}

async function Services() {
  // Request time only: a link prefetch prerenders the page with the cookies, and it reads the clock.
  await connection();
  const [categories, technicians] = await Promise.all([listServiceMenu(), listTechnicians()]);
  return (
    <div className="flex max-w-[1100px] flex-col gap-6">
      <PageHeader
        title="Services & staff"
        subtitle="What customers pick on the kiosk after they check in. Turn one off to hide it from the kiosk."
      />
      <div className="flex flex-wrap items-start gap-5">
        <ServicesManager categories={categories} />
        <TechniciansManager technicians={technicians} />
      </div>
    </div>
  );
}
