import { Banknote, CreditCard } from "lucide-react";
import type { CheckInRow } from "@/lib/admin-data";
import { cn } from "@/lib/utils";

// What was done on a visit, picked on the kiosk after Check in: shown as the Services, Staff and
// Paid columns on Check-ins and in a customer's points history.

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

type Payment = CheckInRow["payment_method"];

// Cash in the status green (money in hand, and it counts toward the bigger reward), card in the
// neutral grey; each with its icon, so they differ by more than colour.
const PAYMENT = {
  cash: { label: "Cash", Icon: Banknote, className: "bg-success-soft text-success" },
  card: { label: "Card", Icon: CreditCard, className: "bg-secondary text-muted-foreground" },
} as const;

/** How the customer said they're paying (the kiosk asks only while a reward pays more for cash). */
export function VisitPayment({ method }: { method: Payment }) {
  if (!method) return <Empty label="Not asked" />;
  const { label, Icon, className } = PAYMENT[method];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

/** All on one line, for phones where the columns are hidden. */
export function VisitSummary({ services, staff, payment }: { services: Services; staff: string | null; payment?: Payment }) {
  const text = [services.map((s) => s.name).join(", "), staff && `with ${staff}`].filter(Boolean).join(" · ");
  if (!text && !payment) return null;
  return (
    <p className="text-[13px] leading-snug text-muted-foreground">
      {text}
      {payment && (
        <>
          {text && " "}
          <VisitPayment method={payment} />
        </>
      )}
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
