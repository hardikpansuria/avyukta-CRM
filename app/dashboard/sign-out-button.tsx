"use client";

import { useState } from "react";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    setIsLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // Discard the App Router cache so no authenticated layout survives logout.
    window.location.replace("/login");
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
