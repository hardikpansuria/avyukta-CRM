import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingSpinner({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 shrink-0 animate-spin motion-reduce:animate-none",
        className,
      )}
    >
      <LoaderCircleIcon className="size-full" />
    </span>
  );
}

export function LoadingState({
  message,
  description,
  className,
  compact = false,
}: {
  message: string;
  description?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex items-center justify-center text-center",
        compact ? "gap-2 py-3" : "min-h-56 flex-col gap-4 py-12",
        className,
      )}
      role="status"
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-zinc-100 text-zinc-700 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800",
          compact ? "size-8" : "size-12",
        )}
      >
        <LoadingSpinner className={compact ? "size-4" : "size-6"} />
      </span>
      <span>
        <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {message}
        </span>
        {description ? (
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}
