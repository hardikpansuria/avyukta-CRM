"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    setIsLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/super-admin/login");
  }

  return (
    <button
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
      type="button"
      disabled={isLoading}
      onClick={handleSignOut}
    >
      {isLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}
