"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function RequiredMark({ className }: { className?: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn("text-xs font-semibold text-red-600 dark:text-red-400", className)}
      >
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  )
}

function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required ? <RequiredMark className="-ml-1" /> : null}
    </label>
  )
}

export { Label, RequiredMark }
