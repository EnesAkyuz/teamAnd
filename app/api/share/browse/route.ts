import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase
    .from("shared_packages")
    .select("share_code, creator_name, environment_name, description, created_at, package_data")
    .order("created_at", { ascending: false })
    .limit(50);

  const packages = (data ?? []).map((d) => ({
    shareCode: d.share_code,
    creatorName: d.creator_name,
    environmentName: d.environment_name,
    description: d.description,
    createdAt: d.created_at,
    itemCount: (d.package_data as { bucketItems?: unknown[] })?.bucketItems?.length ?? 0,
    configCount: (d.package_data as { configs?: unknown[] })?.configs?.length ?? 0,
  }));

  return Response.json(packages);
}
