import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const { data } = await supabase
    .from("shared_packages")
    .select("*")
    .eq("share_code", code)
    .single();

  if (!data) return Response.json({ error: "Share not found" }, { status: 404 });
  return Response.json({
    shareCode: data.share_code,
    creatorName: data.creator_name,
    environmentName: data.environment_name,
    description: data.description,
    packageData: data.package_data,
    createdAt: data.created_at,
  });
}
