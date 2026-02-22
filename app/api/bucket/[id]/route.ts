import { supabase } from "@/lib/supabase";
import { bumpVersion } from "@/lib/versioning";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  if (body.label !== undefined) update.label = body.label;
  if (body.alignment !== undefined) update.alignment = body.alignment;
  if (body.alignment_reason !== undefined) update.alignment_reason = body.alignment_reason;

  // Look up environment_id before update for versioning
  const { data: item } = await supabase
    .from("bucket_items")
    .select("environment_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("bucket_items")
    .update(update)
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (item?.environment_id) await bumpVersion(item.environment_id);
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Look up environment_id before delete for versioning
  const { data: item } = await supabase
    .from("bucket_items")
    .select("environment_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("bucket_items")
    .delete()
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (item?.environment_id) await bumpVersion(item.environment_id);
  return Response.json({ ok: true });
}
