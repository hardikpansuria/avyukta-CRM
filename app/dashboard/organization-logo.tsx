"use client";

import Image from "next/image";
import { Building2Icon } from "lucide-react";
import { useState } from "react";

export function OrganizationLogo({
  name,
  src,
}: {
  name: string;
  src: string | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        aria-label={`${name} logo placeholder`}
        className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
        role="img"
      >
        <Building2Icon aria-hidden="true" className="size-10" />
      </div>
    );
  }

  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700">
      <Image
        fill
        unoptimized
        alt={`${name} logo`}
        className="object-contain p-2"
        sizes="80px"
        src={src}
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
