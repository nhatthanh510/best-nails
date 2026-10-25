import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** For an action in progress, inside the button that started it. Size it with `className`. */
export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      data-spinner
      aria-hidden="true"
      // With reduced motion it turns slowly instead of spinning.
      className={cn("size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]", className)}
    />
  );
}
