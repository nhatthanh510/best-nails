"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

/**
 * A GET search form that also searches as you type. Hidden inputs passed as children (filter,
 * sort…) are kept, and the page goes back to 1. Enter searches straight away, and without
 * JavaScript it's a plain form. `replace` keeps each keystroke out of the Back history, and the
 * transition keeps the current list on screen (and the input focused) while results load.
 */
export function SearchBox({
  action,
  id,
  label,
  placeholder,
  defaultValue,
  className,
  inputClassName,
  children,
}: {
  action: string;
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  className?: string;
  inputClassName?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const last = useRef(defaultValue.trim());
  const [pending, startTransition] = useTransition();

  useEffect(() => () => clearTimeout(timer.current), []);

  function search() {
    clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    const sp = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      const v = String(value).trim();
      if (v) sp.set(key, v);
    }
    const q = sp.get("q") ?? "";
    if (q === last.current) return;
    last.current = q;
    const s = sp.toString();
    startTransition(() => router.replace(`${action}${s ? `?${s}` : ""}`, { scroll: false }));
  }

  const Icon = pending ? LoaderCircle : Search;
  return (
    <form
      ref={formRef}
      action={action}
      role="search"
      aria-busy={pending}
      className={cn("relative min-w-0", className)}
      onSubmit={(e) => {
        e.preventDefault();
        search();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon
        className={cn("pointer-events-none absolute top-3.5 left-3.5 size-4.5 text-muted-foreground", pending && "animate-spin")}
        aria-hidden="true"
      />
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        onChange={() => {
          clearTimeout(timer.current);
          timer.current = setTimeout(search, DEBOUNCE_MS);
        }}
        className={cn(
          "h-11 w-full rounded-xl border border-input bg-card pr-3.5 pl-10.5 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          inputClassName,
        )}
      />
      {children}
    </form>
  );
}
