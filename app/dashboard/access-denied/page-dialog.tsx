"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AccessDeniedPageDialog({ module }: { module: string }) {
  const router = useRouter();
  const label = module.replaceAll("_", " ");

  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Access denied</DialogTitle>
          <DialogDescription>
            You are not permitted to access {label}. Contact an organization administrator if you need access.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => router.back()}>Go back</Button>
          <Button onClick={() => router.push("/dashboard")}>Dashboard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
