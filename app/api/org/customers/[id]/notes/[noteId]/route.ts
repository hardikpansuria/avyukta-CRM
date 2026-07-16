import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

type UpdateNoteBody = {
  body_html?: unknown;
  body_text?: unknown;
  is_pinned?: unknown;
  status?: unknown;
};

const allowedRoles = new Set(["admin", "sales", "accountant"]);
const statuses = new Set(["active", "archived", "deleted"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/customers/[id]/notes/[noteId]">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowedRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id, noteId } = await context.params;
  let body: UpdateNoteBody;

  try {
    body = (await request.json()) as UpdateNoteBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const updates: Record<string, string | boolean> = {
    updated_by: session.user.id,
  };

  if (body.body_html !== undefined || body.body_text !== undefined) {
    const bodyText = getString(body.body_text);
    const bodyHtml = getString(body.body_html) || bodyText;

    if (!bodyHtml) {
      return jsonError("Note body is required", 400);
    }

    updates.body_html = bodyHtml;
    updates.body_text = bodyText || bodyHtml;
  }

  if (body.is_pinned !== undefined) {
    updates.is_pinned = body.is_pinned === true;
  }

  if (body.status !== undefined) {
    const status = getString(body.status);

    if (!statuses.has(status)) {
      return jsonError("Status is invalid", 400);
    }

    updates.status = status;
  }

  if (Object.keys(updates).length === 1) {
    return jsonError("No note updates provided", 400);
  }

  const admin = createAdminClient();
  const { data: note, error } = await admin
    .from("customer_notes")
    .update(updates)
    .eq("id", noteId)
    .eq("customer_id", id)
    .eq("org_id", session.org_id)
    .select("*")
    .maybeSingle();

  if (error) {
    return jsonError("Unable to update note", 500);
  }

  if (!note) {
    return jsonError("Note not found", 404);
  }

  return NextResponse.json({ note, message: "Note updated" });
}
