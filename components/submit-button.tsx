"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";

/**
 * A plain submit button for a server-rendered `<form action={…}>` (sign out), which has no
 * component state to read: while the form is submitting it's disabled and a spinner takes the
 * place of its icon. `iconClassName` sizes the spinner like the icon it replaces. Buttons in
 * client forms use `<Button pending>` instead.
 */
export function SubmitButton({
  icon,
  iconClassName,
  children,
  disabled,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & { icon?: React.ReactNode; iconClassName?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...props} disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending ? <Spinner className={iconClassName} /> : icon}
      {children}
    </button>
  );
}
