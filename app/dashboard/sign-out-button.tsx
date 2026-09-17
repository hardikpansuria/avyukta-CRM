"use client";

import { useState } from "react";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(`Sign out failed with ${response.status}`);

      // Discard the App Router cache so no authenticated layout survives logout.
      window.location.replace("/login");
    } catch {
      setError("Unable to sign out. Check your connection and try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className={compact ? "shrink-0" : "w-full"}>
      <Button
        className={
          compact
            ? "size-9 rounded-md"
            : "h-9 w-full justify-start rounded-md text-zinc-600 dark:text-zinc-300"
        }
        disabled={isLoading}
        size={compact ? "icon" : "default"}
        title={compact ? (error ?? "Sign out") : undefined}
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
      {error ? (
        <p
          className={compact ? "sr-only" : "mt-2 text-xs text-red-600 dark:text-red-400"}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
