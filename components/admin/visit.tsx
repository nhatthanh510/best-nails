import type { CheckInRow } from "@/lib/admin-data";

// What was done on a visit, picked on the kiosk after Check in: shown as the Services and Staff
// columns on Check-ins and in a customer's points history.

type Services = CheckInRow["services"];

/** The services, in menu order, with their category (since "Full set" is in more than one). */
export function VisitServices({ services }: { services: Services }) {
  if (services.length === 0) return <Empty label="No services picked" />;
  return (
    <ul className="flex flex-col gap-1">
      {services.map((s) => (
        <li key={s.position} className="leading-snug whitespace-nowrap">
          <span className="font-semibold">{s.name}</span> <span className="text-[13px] text-muted-foreground">· {s.category_name}</span>
        </li>
      ))}
    </ul>
  );
}

export function VisitStaff({ name }: { name: string | null }) {
  return name ? <span className="font-semibold">{name}</span> : <Empty label="No staff picked" />;
}

/** Both on one line, for phones where the columns are hidden. */
export function VisitSummary({ services, staff }: { services: Services; staff: string | null }) {
  if (services.length === 0 && !staff) return null;
  return (
    <p className="text-[13px] leading-snug text-muted-foreground">
      {services.map((s) => s.name).join(", ")}
      {staff && `${services.length > 0 ? " · " : ""}with ${staff}`}
    </p>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground" aria-label={label}>
      –
    </span>
  );
}
