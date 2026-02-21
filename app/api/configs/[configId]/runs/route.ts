import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ configId: string }> },
) {
  const { configId } = await params;
  const { data } = await supabase
    .from("runs")
    .select("*")
    .eq("config_id", configId)
    .order("created_at", { ascending: false });
  return Response.json(data ?? []);
}
