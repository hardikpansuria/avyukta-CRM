import type { ReactNode } from "react";

import LegalLayout from "@/app/legal/layout";

export default function SecurityLayout({ children }: { children: ReactNode }) {
  return <LegalLayout>{children}</LegalLayout>;
}
