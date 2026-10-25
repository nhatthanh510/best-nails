"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionState } from "@/app/admin/actions";

function report(result: ActionState) {
  if (result?.ok) toast.success(result.message ?? "Done");
  else if (result) toast.error(result.message ?? "Something went wrong.");
}

/** Runs a bound Server Action on click and reports the result as a toast. */
export function ActionButton({
  action,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "action"> & { action: () => Promise<ActionState> }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      {...props}
      pending={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          report(result);
          if (result?.ok && result.href) router.push(result.href);
        })
      }
    >
      {children}
    </Button>
  );
}

/** Same as ActionButton, but asks first. For undo, delete and unpair. */
export function ConfirmButton({
  action,
  title,
  description,
  confirmLabel,
  notice,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "action"> & {
  action: () => Promise<ActionState>;
  title: string;
  description: string;
  confirmLabel: string;
  /** Something extra they should know first, e.g. what happens to a customer's gift vouchers. */
  notice?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...props}>{children}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {notice && <p className="rounded-[10px] bg-warning-soft px-3 py-2.5 text-sm font-semibold text-warning">{notice}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="lg">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="lg"
            variant="destructive"
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action();
                report(result);
                if (result?.ok) setOpen(false);
                if (result?.ok && result.href) router.push(result.href);
              })
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Shows the outcome of a useActionState form submission as a toast. Forms that print their
 * error next to the fields pass `{ errors: false }`, so it isn't shown twice.
 */
export function useActionToast(state: ActionState, { errors = true }: { errors?: boolean } = {}) {
  useEffect(() => {
    if (errors || state?.ok) report(state);
  }, [state, errors]);
}
