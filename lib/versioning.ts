import { supabase } from "./supabase";

/**
 * Bump an environment's version and snapshot its current state.
 * Call this after any mutation to bucket items or configs.
 */
export async function bumpVersion(environmentId: string): Promise<number> {
  // Increment version
  const { data: env } = await supabase
    .from("environments")
    .select("version")
    .eq("id", environmentId)
    .single();

  const newVersion = (env?.version ?? 0) + 1;

  await supabase
    .from("environments")
    .update({ version: newVersion, updated_at: new Date().toISOString() })
    .eq("id", environmentId);

  // Snapshot current state
  const { data: bucketItems } = await supabase
    .from("bucket_items")
    .select("category, label, content, alignment, alignment_reason")
    .eq("environment_id", environmentId);

  const { data: configs } = await supabase
    .from("configs")
    .select("name, spec")
    .eq("environment_id", environmentId);

  await supabase.from("environment_versions").insert({
    environment_id: environmentId,
    version: newVersion,
    snapshot: {
      bucketItems: bucketItems ?? [],
      configs: configs ?? [],
    },
  });

  return newVersion;
}
