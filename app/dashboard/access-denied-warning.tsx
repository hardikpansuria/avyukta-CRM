"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AccessDeniedPayload = {
  code?: string;
  error?: string;
};

export function AccessDeniedWarning() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status === 403) {
        void response
          .clone()
          .json()
          .then((payload: AccessDeniedPayload) => {
            if (payload.code === "ACCESS_DENIED") {
              setMessage(
                payload.error ??
                  "You are not permitted to perform this action. Contact an organization administrator if you need access.",
              );
            }
          })
          .catch(() => undefined);
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <Dialog open={message !== null} onOpenChange={(open) => !open && setMessage(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Access denied</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setMessage(null)}>Understood</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
