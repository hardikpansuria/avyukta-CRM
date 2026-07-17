"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    setIsLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <Button
      className={
        compact
          ? "size-9 rounded-md"
          : "h-9 w-full justify-start rounded-md text-zinc-600 dark:text-zinc-300"
      }
      disabled={isLoading}
      size={compact ? "icon" : "default"}
      title={compact ? "Sign out" : undefined}
      type="button"
      variant="outline"
      onClick={handleSignOut}
    >
      <LogOutIcon />
      {compact ? (
        <span className="sr-only">Sign out</span>
      ) : isLoading ? (
        "Signing out..."
      ) : (
        "Sign out"
      )}
    </Button>
  );
}
