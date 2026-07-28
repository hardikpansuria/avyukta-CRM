import * as React from "react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 rounded border border-zinc-300 accent-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:accent-zinc-50",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };

