import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { logCustomerActivity } from "@/lib/customers/activity";
import { createAdminClient } from "@/lib/supabase/admin";

type NoteBody = {
  body_html?: unknown;
  body_text?: unknown;
  is_pinned?: unknown;
};

const allowedRoles = new Set(["admin", "sales", "accountant"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/customers/[id]/notes">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowedRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  let body: NoteBody;

  try {
    body = (await request.json()) as NoteBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const bodyText = getString(body.body_text);
  const bodyHtml = getString(body.body_html) || bodyText;

  if (!bodyHtml) {
    return jsonError("Note body is required", 400);
  }

  const admin = createAdminClient();
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .neq("record_status", "deleted")
    .maybeSingle();

  if (customerError) {
    return jsonError("Unable to validate customer", 500);
  }

  if (!customer) {
    return jsonError("Customer not found", 404);
  }

  const { data: note, error } = await admin
    .from("customer_notes")
    .insert({
      org_id: session.org_id,
      customer_id: id,
      body_html: bodyHtml,
      body_text: bodyText || bodyHtml,
      is_pinned: body.is_pinned === true,
      author_id: session.user.id,
    })
    .select("*")
    .single();

  if (error || !note) {
    return jsonError("Unable to add note", 500);
  }

  await logCustomerActivity(admin, {
    org_id: session.org_id,
    customer_id: id,
    activity_type: "note_added",
    description: "Note added",
    actor_id: session.user.id,
    linked_record_type: "customer_note",
    linked_record_id: note.id,
  });

  return NextResponse.json({ note, message: "Note added" }, { status: 201 });
}
