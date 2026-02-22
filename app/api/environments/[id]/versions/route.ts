import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await supabase
    .from("environment_versions")
    .select("id, version, created_at, snapshot")
    .eq("environment_id", id)
    .order("version", { ascending: false });

  const versions = (data ?? []).map((v) => {
    const snapshot = v.snapshot as { bucketItems?: unknown[]; configs?: unknown[] };
    return {
      id: v.id,
      version: v.version,
      createdAt: v.created_at,
      itemCount: snapshot.bucketItems?.length ?? 0,
      configCount: snapshot.configs?.length ?? 0,
    };
  });

  return Response.json(versions);
}

// POST to rollback to a specific version
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { version } = await request.json();

  // Fetch the snapshot
  const { data: versionData } = await supabase
    .from("environment_versions")
    .select("snapshot")
    .eq("environment_id", id)
    .eq("version", version)
    .single();

  if (!versionData) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  const snapshot = versionData.snapshot as {
    bucketItems: { category: string; label: string; content: string | null; alignment: string | null; alignment_reason: string | null }[];
    configs: { name: string; spec: import("@/lib/database.types").Json }[];
  };

  // Delete current bucket items and configs
  await supabase.from("bucket_items").delete().eq("environment_id", id);
  await supabase.from("configs").delete().eq("environment_id", id);

  // Restore bucket items
  if (snapshot.bucketItems?.length > 0) {
    await supabase.from("bucket_items").insert(
      snapshot.bucketItems.map((item) => ({
        environment_id: id,
        category: item.category,
        label: item.label,
        content: item.content,
        alignment: item.alignment,
        alignment_reason: item.alignment_reason,
      })),
    );
  }

  // Restore configs
  if (snapshot.configs?.length > 0) {
    await supabase.from("configs").insert(
      snapshot.configs.map((c) => ({
        environment_id: id,
        name: c.name,
        spec: c.spec,
      })),
    );
  }

  // Bump version to record the rollback as a new version
  const { data: env } = await supabase
    .from("environments")
    .select("version")
    .eq("id", id)
    .single();

  const newVersion = (env?.version ?? 0) + 1;
  await supabase
    .from("environments")
    .update({ version: newVersion, updated_at: new Date().toISOString() })
    .eq("id", id);

  // Snapshot the rolled-back state
  await supabase.from("environment_versions").insert({
    environment_id: id,
    version: newVersion,
    snapshot: versionData.snapshot,
  });

  return Response.json({ version: newVersion });
}
