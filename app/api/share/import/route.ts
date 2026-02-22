import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

export async function POST(request: Request) {
  const { shareCode } = await request.json();

  // Fetch the shared package
  const { data: pkg } = await supabase
    .from("shared_packages")
    .select("*")
    .eq("share_code", shareCode)
    .single();

  if (!pkg) return Response.json({ error: "Share code not found" }, { status: 404 });

  // Create new environment
  const { data: env, error: envError } = await supabase
    .from("environments")
    .insert({ name: `${pkg.environment_name} (imported)` })
    .select()
    .single();

  if (envError) return Response.json({ error: envError.message }, { status: 400 });

  const packageData = pkg.package_data as {
    bucketItems: { category: string; label: string; content: string | null; alignment: string | null; alignment_reason: string | null }[];
    configs: { name: string; spec: Json }[];
  };

  // Import bucket items
  if (packageData.bucketItems?.length > 0) {
    const items = packageData.bucketItems.map((item) => ({
      environment_id: env.id,
      category: item.category,
      label: item.label,
      content: item.content,
      alignment: item.alignment,
      alignment_reason: item.alignment_reason,
    }));
    await supabase.from("bucket_items").insert(items);
  }

  // Import configs
  if (packageData.configs?.length > 0) {
    const cfgs = packageData.configs.map((c) => ({
      environment_id: env.id,
      name: c.name,
      spec: c.spec,
    }));
    await supabase.from("configs").insert(cfgs);
  }

  return Response.json({ environmentId: env.id, environmentName: env.name });
}
