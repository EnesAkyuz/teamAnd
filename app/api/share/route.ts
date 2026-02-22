import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { environmentId, creatorName, description } = await request.json();

  // Fetch environment
  const { data: env } = await supabase
    .from("environments")
    .select("*")
    .eq("id", environmentId)
    .single();
  if (!env) return Response.json({ error: "Environment not found" }, { status: 404 });

  // Fetch bucket items
  const { data: bucketItems } = await supabase
    .from("bucket_items")
    .select("category, label, content, alignment, alignment_reason")
    .eq("environment_id", environmentId);

  // Fetch configs
  const { data: configs } = await supabase
    .from("configs")
    .select("name, spec")
    .eq("environment_id", environmentId);

  // Generate short share code (use crypto, NOT nanoid — avoid adding deps)
  const shareCode = crypto.randomUUID().slice(0, 8);
  const packageData = {
    bucketItems: bucketItems ?? [],
    configs: configs ?? [],
  };

  const { data, error } = await supabase
    .from("shared_packages")
    .insert({
      share_code: shareCode,
      creator_name: creatorName || "Anonymous",
      environment_name: env.name,
      description: description || null,
      package_data: packageData,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ shareCode, id: data.id, version: env.version ?? 1 });
}
