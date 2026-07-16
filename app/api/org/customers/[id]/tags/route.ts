import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { logCustomerActivity } from "@/lib/customers/activity";
import { createAdminClient } from "@/lib/supabase/admin";

type TagBody = {
  tag_id?: unknown;
  name?: unknown;
  color?: unknown;
};

const allowedRoles = new Set(["admin", "sales", "accountant"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeColor(value: unknown) {
  const color = getString(value);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#64748b";
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/customers/[id]/tags">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowedRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  let body: TagBody;

  try {
    body = (await request.json()) as TagBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const tagIdFromBody = getString(body.tag_id);
  const tagName = getString(body.name);

  if (!tagIdFromBody && !tagName) {
    return jsonError("Tag id or name is required", 400);
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

  let tagId = tagIdFromBody;

  if (tagName) {
    const { data: existingTag, error: existingError } = await admin
      .from("tags")
      .select("id, name, color")
      .eq("org_id", session.org_id)
      .ilike("name", tagName)
      .neq("status", "deleted")
      .maybeSingle();

    if (existingError) {
      return jsonError("Unable to validate tag", 500);
    }

    if (existingTag) {
      tagId = existingTag.id;
    } else {
      const { data: createdTag, error: tagError } = await admin
        .from("tags")
        .insert({
          org_id: session.org_id,
          name: tagName,
          color: normalizeColor(body.color),
          created_by: session.user.id,
        })
        .select("id")
        .single();

      if (tagError || !createdTag) {
        return jsonError("Unable to create tag", 500);
      }

      tagId = createdTag.id;
    }
  }

  const { data: tag, error: tagLookupError } = await admin
    .from("tags")
    .select("id, name, color")
    .eq("id", tagId)
    .eq("org_id", session.org_id)
    .neq("status", "deleted")
    .maybeSingle();

  if (tagLookupError) {
    return jsonError("Unable to validate tag", 500);
  }

  if (!tag) {
    return jsonError("Tag not found", 404);
  }

  const { error: linkError } = await admin.from("customer_tags").upsert(
    {
      org_id: session.org_id,
      customer_id: id,
      tag_id: tag.id,
      created_by: session.user.id,
    },
    { onConflict: "customer_id,tag_id" },
  );

  if (linkError) {
    return jsonError("Unable to add tag", 500);
  }

  await logCustomerActivity(admin, {
    org_id: session.org_id,
    customer_id: id,
    activity_type: "tag_added",
    description: `Tag added: ${tag.name}`,
    actor_id: session.user.id,
    linked_record_type: "tag",
    linked_record_id: tag.id,
    linked_record_number: tag.name,
  });

  return NextResponse.json({ tag, message: "Tag added" }, { status: 201 });
}
